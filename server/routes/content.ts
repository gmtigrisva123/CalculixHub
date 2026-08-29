/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-only content routes: the problem bank and the seeded fixtures behind the
 * leaderboard, challenges, contests and discussion list.
 *
 * These serve constant data, so they are cheap, cacheable and classed as
 * `read` by the rate limiter rather than sharing the AI routes' much tighter
 * allowance.
 */

import { initialContests, initialDiscussions, initialLeaderboard, initialWeeklyChallenges, problems } from '../data';
import { adminClient } from '../auth/supabaseAdmin';
import { json } from '../http';
import type { Handler } from '../pipeline';

/**
 * How long a client may reuse this content.
 *
 * The bank is immutable within a deployment, so a short private cache removes
 * the repeat fetches a navigating single-page app would otherwise make. It is
 * `private` rather than `public` because the response will become
 * learner-specific once progress is server-held, and a cache directive that
 * has to be tightened later is one that leaks in the interim.
 */
const CONTENT_CACHE = 'private, max-age=300';

/**
 * The problem bank.
 *
 * Note for the reader: this response includes `correctAnswer` and `solution`
 * for every item, so the answer key is public. That is a genuine integrity
 * defect -- it makes any score or ranking unverifiable -- but it is *load
 * bearing* right now: `src/lib/offline.ts` grades queued answers on the device
 * using exactly these fields, which is what lets practice continue without a
 * connection.
 *
 * It is left intact here deliberately. Removing the key requires moving the
 * solution reveal into the `/api/evaluate` response and changing what offline
 * practice promises the learner, which is a product change with its own client
 * work and its own review -- not something to slip into a request-pipeline
 * change. It is the next piece of work after this one.
 */
export const problemsHandler: Handler = () =>
  json(problems, { headers: { 'cache-control': CONTENT_CACHE } });

/**
 * Platform content, plus the live leaderboard.
 *
 * The leaderboard is read from `public.leaderboard_view`, which ranks learners
 * by points derived from their real attempt log. It is served from here rather
 * than queried directly by the browser so that an unconfigured build -- GitHub
 * Pages, or a fork with no project -- still gets a well-formed response instead
 * of a failed request; it simply gets an empty ranking.
 *
 * Challenges and contests remain fixtures. They are platform content rather
 * than user data, so nothing about them is a claim about a person.
 */
export const statisticsSeedHandler: Handler = async () => {
  const client = adminClient();
  let leaderboard = initialLeaderboard;

  if (client) {
    const { data, error } = await client
      .from('leaderboard_view')
      .select('rank, user_id, username, display_name, avatar_url, country, level, points, problems_solved, current_streak, accuracy_pct')
      .order('rank', { ascending: true })
      .limit(50);

    if (error) {
      // An empty ranking is the correct degradation. Falling back to invented
      // entries would be worse than showing nothing.
      console.error('[CalculixHub] Could not load the leaderboard', error.message);
    } else {
      leaderboard = (data ?? []).map((row) => {
        const entry = row as Record<string, unknown>;
        return {
          rank: Number(entry.rank),
          name: String(entry.display_name ?? entry.username ?? 'Learner'),
          points: Number(entry.points ?? 0),
          country: String(entry.country ?? ''),
          // Age is not collected. The field survives in the shared type, so it
          // is reported as zero rather than invented.
          age: 0,
          avatarSeed: String(entry.username ?? ''),
          accuracy: entry.accuracy_pct === null ? undefined : Number(entry.accuracy_pct),
        };
      });
    }
  }

  return json(
    {
      leaderboard,
      weeklyChallenges: initialWeeklyChallenges,
      contests: initialContests,
      discussions: initialDiscussions,
    },
    // Not cached: a ranking that lags behind the activity that produced it is
    // the thing a leaderboard most needs to avoid.
    { headers: { 'cache-control': 'no-store' } },
  );
};
