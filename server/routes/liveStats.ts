/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Activity counters for the landing page.
 *
 * These are unauthenticated: anyone who can reach the endpoint can report an
 * event, so the numbers are advisory and are labelled as such in the response.
 * Rate limiting bounds how fast one caller can inflate them; it cannot make
 * them true. Trustworthy engagement figures need authenticated sessions and a
 * shared store, both of which arrive with the Supabase integration -- at which
 * point this module is deleted rather than patched.
 *
 * Two defects from the previous implementation are fixed here, because they
 * would otherwise be carried forward into that work:
 *
 * - **Randomness in a request handler.** `problem-solved` used to advance the
 *   improvement rate on a coin flip, making the endpoint's effect on server
 *   state unreproducible and untestable. Counters now move deterministically.
 * - **A monotonic "active users".** The count only ever rose, so it measured
 *   cumulative arrivals while being displayed as concurrency. It is now derived
 *   from arrivals within a trailing window, which is what the label claims.
 */

import { json, problem, readJsonBody } from '../http';
import type { Handler } from '../pipeline';
import { liveStatsEventSchema } from '../schemas';

/** Arrivals older than this stop counting toward "active". */
const ACTIVE_WINDOW_MS = 15 * 60 * 1_000;

/** Retained arrival timestamps, bounding memory regardless of traffic. */
const MAX_TRACKED_ARRIVALS = 5_000;

/**
 * Per-instance, in-memory, and lost on restart.
 *
 * On a serverless platform each instance keeps its own copy, so a client's
 * successive requests may be served by instances with different totals. This is
 * inherent to counting in process memory and is the reason the response marks
 * the figures unverified rather than presenting them as telemetry.
 */
interface LiveStatsState {
  arrivals: number[];
  testsCompleted: number;
  problemsSolved: number;
}

const state: LiveStatsState = { arrivals: [], testsCompleted: 0, problemsSolved: 0 };

/** Drop arrivals that have aged out, and cap retention. */
function pruneArrivals(now: number): void {
  const cutoff = now - ACTIVE_WINDOW_MS;
  let firstLive = 0;
  while (firstLive < state.arrivals.length && state.arrivals[firstLive]! < cutoff) firstLive += 1;
  if (firstLive > 0) state.arrivals.splice(0, firstLive);

  const surplus = state.arrivals.length - MAX_TRACKED_ARRIVALS;
  if (surplus > 0) state.arrivals.splice(0, surplus);
}

/**
 * Fields with no source of truth behind them.
 *
 * They are served as zero today and are kept in the payload only because
 * `WelcomeScreen` replaces its whole state object with this response and then
 * calls `.toLocaleString()` on the result -- so omitting one would not degrade
 * a number, it would throw and take the landing page down. Removing them is a
 * client change, made there first.
 */
const UNSOURCED_FIELDS = {
  activeContestsCount: 0,
  facebookAcquisitions: 0,
  tiktokAcquisitions: 0,
  youtubeAcquisitions: 0,
  improvementRate: 0,
} as const;

/** Current counters. `unverified` is part of the contract, not a comment. */
function snapshot(now: number) {
  pruneArrivals(now);

  return {
    ...UNSOURCED_FIELDS,
    activeUsers: state.arrivals.length,
    testsCompleted: state.testsCompleted,
    problemsSolved: state.problemsSolved,
    /**
     * Explicit so a consumer cannot mistake these for measured telemetry. The
     * landing page can present them honestly, and a future dashboard cannot
     * accidentally build a metric on top of them.
     */
    unverified: true as const,
  };
}

export const liveStatsHandler: Handler = () =>
  // Deliberately not cached: the value of these numbers is that they move.
  json(snapshot(Date.now()));

export const liveStatsEventHandler: Handler = async (context) => {
  const body = await readJsonBody(context.request, context.config.maxBodyBytes);
  if (!body.ok) return body.response;

  const parsed = liveStatsEventSchema.safeParse(body.value);
  if (!parsed.success) {
    return problem(400, 'invalid-request', 'Invalid request', `event must be one of the supported activity events.`);
  }

  const now = Date.now();

  switch (parsed.data.event) {
    case 'user-joined':
      state.arrivals.push(now);
      break;
    case 'test-completed':
      state.testsCompleted += 1;
      state.arrivals.push(now);
      break;
    case 'problem-solved':
      state.problemsSolved += 1;
      break;
  }

  return json(snapshot(now));
};

/** Reset counters. Test-only. */
export function resetLiveStatsForTests(): void {
  state.arrivals.length = 0;
  state.testsCompleted = 0;
  state.problemsSolved = 0;
}
