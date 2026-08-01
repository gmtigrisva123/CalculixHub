/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Per-client request rate limiting.
 *
 * Routes are limited by class rather than uniformly. `/api/chat` costs an
 * upstream model call; `/api/problems` costs a constant-time array read. A
 * single limit for both would either throttle cheap reads pointlessly or leave
 * the expensive routes far too open, so each class carries its own policy and
 * its own counter namespace -- exhausting the AI allowance must not lock a
 * learner out of loading the item bank.
 */

import type { CounterStore } from './counters';

/** Cost classes. `ai` calls a paid upstream; `read` serves local data. */
export type RouteClass = 'ai' | 'read';

export interface RateLimitPolicy {
  max: number;
  windowSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Headers describing the client's remaining allowance. */
  headers: Record<string, string>;
}

/**
 * Count a request against a client's allowance.
 *
 * The counter is incremented even when the request is refused. A client that
 * keeps hammering a closed door keeps its window open rather than recovering
 * partway through, which makes a sustained flood strictly worse for the sender
 * than backing off -- the incentive a limiter should create.
 *
 * @param store Backing counter store.
 * @param clientKey Stable per-client identifier from `http.clientKey`.
 * @param routeClass Cost class, which also namespaces the counter.
 * @param policy Allowance for this class.
 */
export async function checkRateLimit(
  store: CounterStore,
  clientKey: string,
  routeClass: RouteClass,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const state = await store.increment(`rl:${routeClass}:${clientKey}`, policy.windowSeconds);
  const remaining = Math.max(0, policy.max - state.count);
  const resetSeconds = Math.max(0, Math.ceil((state.resetAt - Date.now()) / 1_000));

  const headers: Record<string, string> = {
    'ratelimit-limit': String(policy.max),
    'ratelimit-remaining': String(remaining),
    'ratelimit-reset': String(resetSeconds),
  };

  if (state.count > policy.max) {
    // Retry-After tells a well-behaved client exactly when to return, which is
    // what turns a limiter into backpressure rather than a source of retry storms.
    headers['retry-after'] = String(resetSeconds);
    return { allowed: false, headers };
  }

  return { allowed: true, headers };
}
