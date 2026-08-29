/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global ceiling on upstream model calls.
 *
 * Per-client rate limiting bounds how fast *one* caller can spend the API key.
 * It says nothing about the total, so a thousand callers -- or one caller with a
 * thousand addresses -- still spend without limit. Only a global counter turns
 * "unbounded financial exposure" into a number the operator chose in advance.
 *
 * The design point that makes this cheap: exhausting the budget is not an
 * error. Every AI route in this codebase already carries a deterministic
 * fallback, written originally for upstream quota failures. Reusing it as the
 * budget-exhausted path means the ceiling degrades answer quality rather than
 * availability, so it can be set aggressively without risking an outage.
 */

import type { CounterStore } from './counters';

const DAY_SECONDS = 86_400;
const BUDGET_KEY = 'ai:daily-calls';

export interface BudgetDecision {
  /** Whether the upstream model may be called. */
  allowed: boolean;
  /** Calls consumed in the current day, including this one. */
  used: number;
  /** The configured ceiling. */
  limit: number;
}

/**
 * Claim one upstream call against the daily budget.
 *
 * Call this immediately before dispatching to the model, never at the start of
 * a request: reservations that are never spent -- because validation failed, or
 * a cache hit served the response -- would consume the budget without buying
 * anything.
 *
 * A budget of zero disables upstream calls entirely, which is a useful state:
 * it forces the deterministic engine everywhere without removing the API key,
 * making the fallback path exercisable in a real deployment.
 *
 * @param store Backing counter store.
 * @param limit Maximum upstream calls per rolling day.
 */
export async function claimAiCall(store: CounterStore, limit: number): Promise<BudgetDecision> {
  if (limit <= 0) return { allowed: false, used: 0, limit };

  const state = await store.increment(BUDGET_KEY, DAY_SECONDS);
  const allowed = state.count <= limit;

  // Log the crossing once, not on every subsequent refusal, so the signal is a
  // discrete event in the operator's log rather than a flood.
  if (!allowed && state.count === limit + 1) {
    console.warn(
      `[CalculixHub] Daily AI call budget of ${limit} exhausted. ` +
        'Serving the deterministic engine until the window resets.',
    );
  }

  return { allowed, used: state.count, limit };
}

/** Read budget consumption without claiming a call. For observability. */
export async function readAiBudget(store: CounterStore, limit: number): Promise<BudgetDecision> {
  const state = await store.peek(BUDGET_KEY);
  const used = state?.count ?? 0;
  return { allowed: used < limit, used, limit };
}
