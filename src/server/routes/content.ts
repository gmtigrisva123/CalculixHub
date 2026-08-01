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

/** Seeded leaderboard, challenges, contests and discussions. */
export const statisticsSeedHandler: Handler = () =>
  json(
    {
      leaderboard: initialLeaderboard,
      weeklyChallenges: initialWeeklyChallenges,
      contests: initialContests,
      discussions: initialDiscussions,
    },
    { headers: { 'cache-control': CONTENT_CACHE } },
  );
