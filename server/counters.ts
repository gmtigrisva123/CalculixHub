/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fixed-window counters, the primitive underneath both per-client rate limiting
 * and the global AI spend ceiling.
 *
 * The store is an interface with an in-process implementation. That seam is the
 * point of this file: on Vercel each serverless instance holds its own memory,
 * so an in-process counter bounds abuse *per instance* and the effective
 * ceiling is (instances x limit). It genuinely stops a single-client flood --
 * the dominant case -- but it is not a distributed guarantee, and pretending
 * otherwise would be the more dangerous outcome.
 *
 * Swapping in Vercel KV or Upstash Redis means implementing `CounterStore` and
 * passing it to the pipeline. Nothing else changes. That work belongs with the
 * Supabase integration, which introduces the shared infrastructure to host it.
 */

/** Result of incrementing a windowed counter. */
export interface CounterState {
  /** Count within the current window, including this increment. */
  count: number;
  /** Epoch milliseconds at which the current window expires. */
  resetAt: number;
}

/**
 * A windowed counter backed by some store.
 *
 * Async by contract so a network-backed implementation is a drop-in
 * replacement, even though the in-process one resolves immediately.
 */
export interface CounterStore {
  /**
   * Increment `key`'s counter, starting a fresh window if none is active.
   *
   * @param key Opaque namespaced identifier.
   * @param windowSeconds Window length.
   */
  increment(key: string, windowSeconds: number): Promise<CounterState>;

  /** Read `key` without incrementing. Returns `undefined` if no window is active. */
  peek(key: string): Promise<CounterState | undefined>;
}

/**
 * Upper bound on tracked keys.
 *
 * Without one, a rate limiter is itself a memory-exhaustion vector: an attacker
 * rotating source addresses inserts an unbounded number of map entries, and the
 * defence becomes the vulnerability. On overflow the oldest windows are dropped
 * first, since they are closest to expiring anyway.
 */
const MAX_TRACKED_KEYS = 10_000;

/** In-process `CounterStore`. Correct for one instance; see the file header. */
export class MemoryCounterStore implements CounterStore {
  private readonly windows = new Map<string, CounterState>();

  constructor(private readonly now: () => number = Date.now) {}

  async increment(key: string, windowSeconds: number): Promise<CounterState> {
    const now = this.now();
    const existing = this.windows.get(key);

    if (existing && existing.resetAt > now) {
      existing.count += 1;
      // Re-insert so iteration order tracks recency, which `evict` relies on.
      this.windows.delete(key);
      this.windows.set(key, existing);
      return { ...existing };
    }

    const fresh: CounterState = { count: 1, resetAt: now + windowSeconds * 1_000 };
    this.windows.set(key, fresh);

    if (this.windows.size > MAX_TRACKED_KEYS) this.evict(now);

    return { ...fresh };
  }

  async peek(key: string): Promise<CounterState | undefined> {
    const existing = this.windows.get(key);
    if (!existing) return undefined;
    if (existing.resetAt <= this.now()) {
      this.windows.delete(key);
      return undefined;
    }
    return { ...existing };
  }

  /**
   * Reclaim capacity: expired windows first, then the least recently touched.
   *
   * Evicting a live window forgives an attacker's accumulated count, so expired
   * entries are always preferred. Reaching the second phase means more distinct
   * clients are active than the cap allows, which is itself worth surfacing.
   */
  private evict(now: number): void {
    for (const [key, state] of this.windows) {
      if (state.resetAt <= now) this.windows.delete(key);
    }

    if (this.windows.size <= MAX_TRACKED_KEYS) return;

    const surplus = this.windows.size - MAX_TRACKED_KEYS;
    let dropped = 0;
    for (const key of this.windows.keys()) {
      if (dropped >= surplus) break;
      this.windows.delete(key);
      dropped += 1;
    }

    console.warn(
      `[CalculixHub] Rate-limit store at capacity; dropped ${dropped} live window(s). ` +
        'Sustained pressure here indicates either genuine scale or a distributed flood.',
    );
  }
}

/** Process-wide store. Replace at the composition root to change backends. */
export const defaultCounterStore: CounterStore = new MemoryCounterStore();
