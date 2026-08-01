/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Recording a graded attempt.
 *
 * This is the only writer to `public.problem_attempts`, and that is enforced by
 * the schema rather than by convention: the table has no client-facing INSERT
 * policy, so a browser holding a valid session still cannot write one. Points,
 * accuracy, streaks, mastery and leaderboard rank are all derived from this
 * table by trigger, so the integrity of every number the platform displays
 * reduces to the integrity of this function.
 *
 * Three properties it must preserve:
 *
 *   1. **The caller's identity comes from a verified token**, never from the
 *      request body. A `userId` field in JSON is a claim; a signature is proof.
 *   2. **The grade and the points come from the server's own bank**, never from
 *      the client. The client sends only what was typed.
 *   3. **Recording never breaks grading.** If the database is unreachable the
 *      learner still gets their verdict and explanation; only the persistence
 *      is lost, and that is logged rather than surfaced as a failure.
 */

import type { Problem } from '../types';
import { adminClient } from './auth/supabaseAdmin';

export interface RecordAttemptInput {
  userId: string;
  problem: Problem;
  submittedAnswer: string;
  isCorrect: boolean;
  durationMs?: number;
}

export type RecordAttemptOutcome =
  /** Persisted, and `pointsAwarded` were credited. */
  | { status: 'recorded'; pointsAwarded: number }
  /** Already solved: logged as practice, deliberately worth nothing. */
  | { status: 'already-solved'; pointsAwarded: 0 }
  /** No backend configured. Practice still works; nothing is persisted. */
  | { status: 'not-configured'; pointsAwarded: 0 }
  /** The write failed. Logged server-side; the learner still gets a verdict. */
  | { status: 'failed'; pointsAwarded: 0 };

/**
 * Persist one graded attempt.
 *
 * Points are awarded only for a first correct solve. The partial unique index
 * `problem_attempts_first_solve_key` is what guarantees that -- this function's
 * pre-check is an optimisation that avoids a round trip, not the rule. Racing
 * requests both pass the check and one loses at the index, which is handled as
 * `already-solved` rather than as an error.
 */
export async function recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptOutcome> {
  const client = adminClient();
  if (!client) return { status: 'not-configured', pointsAwarded: 0 };

  const { userId, problem, submittedAnswer, isCorrect, durationMs } = input;

  // Points are read from the server-side bank. Nothing the client sends can
  // influence this number.
  let pointsAwarded = 0;

  if (isCorrect) {
    const { data: alreadySolved, error: lookupError } = await client
      .from('problem_attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('problem_id', problem.id)
      .gt('points_awarded', 0)
      .maybeSingle();

    if (lookupError) {
      console.error('[CalculixHub] Could not check prior solves', lookupError.message);
      return { status: 'failed', pointsAwarded: 0 };
    }

    if (!alreadySolved) pointsAwarded = problem.points;
  }

  const { error } = await client.from('problem_attempts').insert({
    user_id: userId,
    problem_id: problem.id,
    topic: problem.topic,
    level: problem.level,
    // Bounded to the column's limit. The API already caps this, but this
    // function is the last writer before the database and should not depend on
    // a check made two layers away.
    submitted_answer: submittedAnswer.slice(0, 4000),
    is_correct: isCorrect,
    points_awarded: pointsAwarded,
    duration_ms: durationMs ?? null,
  });

  if (error) {
    // 23505: the first-solve index rejected a concurrent duplicate. Expected
    // under a double submit, and not a failure -- the learner had already
    // solved it, so the attempt is simply worth nothing.
    if (error.code === '23505') return { status: 'already-solved', pointsAwarded: 0 };

    console.error('[CalculixHub] Could not record attempt', { code: error.code, message: error.message });
    return { status: 'failed', pointsAwarded: 0 };
  }

  return pointsAwarded > 0
    ? { status: 'recorded', pointsAwarded }
    : { status: isCorrect ? 'already-solved' : 'recorded', pointsAwarded: 0 };
}
