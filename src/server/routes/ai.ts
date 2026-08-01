/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The three routes that can spend money: tutor chat, answer evaluation and
 * recommendation.
 *
 * Each follows the same shape, and the shape is the point:
 *
 *   validate -> decide deterministically -> optionally enrich with the model
 *
 * The deterministic step always runs and always produces a complete answer. The
 * model only ever *improves the prose*. Nothing the model returns is permitted
 * to change a verdict, a score or a routing decision.
 *
 * That inversion matters most in `evaluate`. The previous implementation graded
 * the answer server-side, told the model the verdict, asked it to echo that
 * verdict back inside its JSON, and then returned the model's copy to the
 * client -- which awarded points from it. A hallucinated or injected `true`
 * was therefore a scoring exploit. Here the deterministic verdict is the
 * response, and the model's `correct` field is discarded.
 */

import { Type } from '@google/genai';
import type { ZodType } from 'zod';
import type { Level, Topic } from '../../types';
import { recordAttempt } from '../attempts';
import { verifyAccessToken } from '../auth/supabaseAdmin';
import { findProblem } from '../data';
import { parseJsonReply, type ModelClient } from '../gemini';
import { json, problem, readJsonBody } from '../http';
import type { Handler, RouteContext } from '../pipeline';
import {
  chatRequestSchema,
  evaluateRequestSchema,
  recommendRequestSchema,
  TOPICS,
} from '../schemas';

/** Supplied by the composition root so routes never construct dependencies. */
export interface AiRouteDependencies {
  /** `null` when no API key is configured; the deterministic engine serves everything. */
  model: ModelClient | null;
}

/**
 * Validate a JSON body against a schema, returning a 400 problem document on
 * failure. Zod's issue list is summarised to field names and reasons -- enough
 * for a developer to fix the call, without echoing the submitted values back.
 */
async function parseBody<T>(
  context: RouteContext,
  schema: ZodType<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const body = await readJsonBody(context.request, context.config.maxBodyBytes);
  if (!body.ok) return { ok: false, response: body.response };

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || 'body'}: ${issue.message}`)
      .slice(0, 5)
      .join('; ');
    return { ok: false, response: problem(400, 'invalid-request', 'Invalid request', detail) };
  }

  return { ok: true, value: parsed.data };
}

/* -------------------------------------------------------------------------- */
/* Tutor chat                                                                  */
/* -------------------------------------------------------------------------- */

const TUTOR_SYSTEM_INSTRUCTION = [
  'You are the Calculix AI Tutor: a warm but rigorous mathematics teacher for a motivated secondary-school student.',
  'Teach by the Socratic method. Draw the next step out of the learner rather than handing over the answer.',
  'Write clear English with real academic substance. Use LaTeX for notation, e.g. $x^2$ and $\\frac{a}{b}$.',
  'Be concise and precise. Stay on deep, guided mathematical practice.',
].join(' ');

/**
 * Deterministic tutor replies.
 *
 * Not a placeholder: this is what every learner on the GitHub Pages deployment
 * receives, and what everyone receives once the daily budget is spent. Keeping
 * it genuinely useful is what makes the budget ceiling safe to enforce.
 */
function fallbackTutorReply(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('handshake')) {
    return `Let's break down the Handshake Problem. With $n$ people, the first shakes hands with $n-1$ others, the second with $n-2$ remaining (having already shaken with the first), and so on.
The general formula is $S = \\frac{n(n-1)}{2}$. For $n=10$: $\\frac{10 \\times 9}{2} = 45$. That's the elegance of combinatorics!`;
  }

  if (normalized.includes('cauchy') || normalized.includes('am-gm') || normalized.includes('inequality')) {
    return `Great question! The AM-GM inequality for positive reals $x_1, x_2, \\dots, x_n$ states:
$\\frac{x_1 + x_2 + \\dots + x_n}{n} \\ge \\sqrt[n]{x_1 x_2 \\dots x_n}$
Equality holds exactly when all the terms are equal. In the classic minimisation $P = 1/a + 1/b + 1/c$ with $a+b+c=1$, equality at $a=b=c=1/3$ gives the minimum value of 9 - a beautifully symmetric result!`;
  }

  return `Hi! I'm the Calculix AI Tutor, here to help you uncover the beauty of mathematics.
The live AI connection is temporarily unavailable, but here are a few pointers:
- Master **Algebra** by drilling symmetric expressions until they're second nature.
- For **Geometry**, drawing an auxiliary line is almost always the key to an otherwise-hidden angle.
- Got a specific question about the handshake problem or the Cauchy-Schwarz inequality?`;
}

export function createChatHandler({ model }: AiRouteDependencies): Handler {
  return async (context) => {
    const parsed = await parseBody(context, chatRequestSchema(context.config.maxTextChars));
    if (!parsed.ok) return parsed.response;

    const { message, history } = parsed.value;

    if (model) {
      const result = await model.generate({
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        // Prior turns plus the new message, all in the data channel. The
        // previous implementation dropped history entirely and spliced the
        // message into the instruction string -- losing the conversation and
        // creating the injection surface in one stroke.
        turns: [...history, { role: 'user' as const, content: message }],
      });

      if (result.ok) return json({ reply: result.value, isFallback: false });
    }

    return json({ reply: fallbackTutorReply(message), isFallback: true });
  };
}

/* -------------------------------------------------------------------------- */
/* Answer evaluation                                                           */
/* -------------------------------------------------------------------------- */

const EVALUATOR_SYSTEM_INSTRUCTION = [
  'You are a mathematics professor giving feedback on one submitted answer at CalculixHub.',
  'You will be given the problem, the model solution, the learner\'s answer, and the grade already determined by the platform.',
  'The grade is final and is not yours to change. Comment on the reasoning; never state a different verdict.',
  'If the grade is correct: name the technique that makes the solution elegant and suggest how to extend it.',
  'If the grade is incorrect: diagnose the likely slip and give an open hint. Do not simply solve it for them.',
  'Reply as JSON with "explanation" and "guidance". Use LaTeX for notation.',
].join(' ');

/**
 * Compare a submitted answer with the expected one.
 *
 * Deliberately identical to the client-side comparison in `offline.ts`, so a
 * queued offline answer receives the same verdict it would have received live.
 * Divergence between the two would be a correctness bug that only ever appears
 * to users who lost connectivity -- the hardest kind to observe.
 */
function gradeAnswer(submitted: string, expected: string): boolean {
  return submitted.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function createEvaluateHandler({ model }: AiRouteDependencies): Handler {
  return async (context) => {
    const parsed = await parseBody(context, evaluateRequestSchema(context.config.maxTextChars));
    if (!parsed.ok) return parsed.response;

    const { problemId, userAnswer, durationMs } = parsed.value;
    const item = findProblem(problemId);
    if (!item) return problem(404, 'not-found', 'Problem not found', 'No item with that identifier.');

    // The verdict, decided here and nowhere else.
    const correct = gradeAnswer(userAnswer, item.correctAnswer);

    // Persist for a signed-in learner. Identity comes from the verified bearer
    // token, never from the request body -- a `userId` field in JSON is a claim
    // anyone can make, while a signature is proof.
    //
    // Anonymous practice is still allowed and still graded; it simply is not
    // recorded, so it cannot appear on a leaderboard.
    let pointsAwarded = 0;
    const caller = await verifyAccessToken(context.request.headers.get('authorization'));

    if (caller) {
      const outcome = await recordAttempt({
        userId: caller.id,
        problem: item,
        submittedAnswer: userAnswer,
        isCorrect: correct,
        durationMs,
      });
      pointsAwarded = outcome.pointsAwarded;
    }

    if (model) {
      const result = await model.generate({
        systemInstruction: EVALUATOR_SYSTEM_INSTRUCTION,
        turns: [
          {
            role: 'user',
            content: [
              `Problem: ${item.title} (${item.topic}, ${item.level})`,
              `Question: ${item.question}`,
              `Model solution: ${item.solution}`,
              `Platform grade: ${correct ? 'CORRECT' : 'INCORRECT'}`,
              `Learner's answer: ${userAnswer}`,
            ].join('\n'),
          },
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: { explanation: { type: Type.STRING }, guidance: { type: Type.STRING } },
          required: ['explanation', 'guidance'],
        },
      });

      if (result.ok) {
        const commentary = parseJsonReply(result.value, (value) => {
          if (typeof value !== 'object' || value === null) return undefined;
          const { explanation, guidance } = value as Record<string, unknown>;
          if (typeof explanation !== 'string' || typeof guidance !== 'string') return undefined;
          return { explanation, guidance };
        });

        if (commentary) {
          // `correct` and `pointsAwarded` come from the server, never from the
          // parsed reply. The model supplies prose and nothing else.
          return json({ correct, pointsAwarded, ...commentary, isFallback: false });
        }
      }
    }

    return json({
      correct,
      pointsAwarded,
      explanation: correct
        ? `Correct! You reasoned through the logical structure of this ${item.topic} problem cleanly.`
        : `Not quite - that isn't the expected answer. You likely slipped somewhere in the intermediate steps, or the hint's technique hasn't clicked yet.`,
      guidance: correct
        ? `Keep pushing: try the next ${item.level === 'Foundation' ? 'Advanced' : 'Olympiad'} tier now!`
        : `Hint: ${item.hint} Try re-deriving it carefully, step by step.`,
      isFallback: true,
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendation                                                              */
/* -------------------------------------------------------------------------- */

const RECOMMENDER_SYSTEM_INSTRUCTION = [
  'You are EduReach Core, the personalisation engine inside the CalculixHub mathematics platform.',
  'You will be given a learner\'s statistics and the weakest domain the platform has already identified.',
  'Write an analysis in an inspiring but rigorous academic voice, addressed to the learner.',
  'Reply as JSON with "recommendation" and "rationale". The platform supplies the topic and level itself.',
].join(' ');

/** Deterministic analysis per domain, used whenever the model is unavailable. */
const FALLBACK_ANALYSIS: Record<Topic, { recommendation: (score: number) => string; rationale: string }> = {
  Combinatorics: {
    recommendation: (score) =>
      `Your skill map shows solid algebraic reasoning, but Combinatorics (${score}%) is your main bottleneck right now. Shoring up stars-and-bars technique and permutation cycles will unlock more points.`,
    rationale:
      'Stronger discrete-structure thinking is exactly what unlocks the hardest questions on AMC and Olympiad exams.',
  },
  Geometry: {
    recommendation: (score) =>
      `You have strong algebraic intuition, but Geometry (${score}%) is currently your blind spot. Drawing helper lines and applying Ptolemy/Brahmagupta flexibly hasn't become a reflex yet.`,
    rationale: 'A 15% improvement in geometry would meaningfully raise your overall training ceiling.',
  },
  Algebra: {
    recommendation: (score) =>
      `Algebra (${score}%) is your main challenge at the current tier. Functional-equation and inequality problems haven't found their equality case reflex yet.`,
    rationale: 'Mastering equivalent algebraic manipulation and factoring pays off across every other topic.',
  },
  'Number Theory': {
    recommendation: (score) =>
      `Modular arithmetic patterns and prime properties in Number Theory (${score}%) are holding back your overall results.`,
    rationale:
      "Locking in Euler's totient function and the Chinese Remainder Theorem unlocks a lot of integer-based reasoning.",
  },
};

/** Lowest-scoring domain, with ties broken by a stable topic order. */
function weakestDomain(skills: Record<Topic, number>): { topic: Topic; score: number } {
  let weakest: { topic: Topic; score: number } = { topic: TOPICS[0], score: skills[TOPICS[0]] };
  for (const topic of TOPICS) {
    if (skills[topic] < weakest.score) weakest = { topic, score: skills[topic] };
  }
  return weakest;
}

/** Tier the learner should be practising at, from cumulative points. */
function targetLevel(points: number): Level {
  if (points > 300) return 'Olympiad';
  if (points > 100) return 'Advanced';
  return 'Foundation';
}

export function createRecommendHandler({ model }: AiRouteDependencies): Handler {
  return async (context) => {
    const parsed = await parseBody(context, recommendRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { points, completedCount, accuracy, skills } = parsed.value;
    const weakest = weakestDomain(skills);
    const level = targetLevel(points);

    if (model) {
      const result = await model.generate({
        systemInstruction: RECOMMENDER_SYSTEM_INSTRUCTION,
        turns: [
          {
            role: 'user',
            content: [
              `Cumulative points: ${points}`,
              `Problems completed: ${completedCount}`,
              `Average accuracy: ${accuracy}%`,
              `Skill map: ${TOPICS.map((topic) => `${topic} ${skills[topic]}%`).join(', ')}`,
              `Weakest domain: ${weakest.topic} at ${weakest.score}%`,
              `Target tier: ${level}`,
            ].join('\n'),
          },
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: { recommendation: { type: Type.STRING }, rationale: { type: Type.STRING } },
          required: ['recommendation', 'rationale'],
        },
      });

      if (result.ok) {
        const analysis = parseJsonReply(result.value, (value) => {
          if (typeof value !== 'object' || value === null) return undefined;
          const { recommendation, rationale } = value as Record<string, unknown>;
          if (typeof recommendation !== 'string' || typeof rationale !== 'string') return undefined;
          return { recommendation, rationale };
        });

        if (analysis) {
          // Topic and level are the platform's determination. Letting the model
          // choose them would let injected text steer a learner's curriculum,
          // and would let a malformed reply produce a topic the client cannot
          // filter on.
          return json({
            ...analysis,
            recommendedTopic: weakest.topic,
            suggestedLevel: level,
            isFallback: false,
          });
        }
      }
    }

    const fallback = FALLBACK_ANALYSIS[weakest.topic];
    return json({
      recommendation: fallback.recommendation(weakest.score),
      rationale: fallback.rationale,
      recommendedTopic: weakest.topic,
      suggestedLevel: level,
      isFallback: true,
    });
  };
}
