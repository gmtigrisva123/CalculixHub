/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared date/streak helpers driven entirely by real activity dates
// (userStats.learningTimeline), so the streak reflects actual consecutive
// calendar days active rather than a counter bumped on every correct answer.

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getLastNDateKeys(n: number, today: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}

/**
 * Counts consecutive calendar days ending today (or yesterday, if today has
 * no activity yet) that appear in `activeDateKeys`. Stops at the first gap.
 */
export function computeStreak(activeDateKeys: Iterable<string>, today: Date = new Date()): number {
  const active = new Set(activeDateKeys);
  let cursor = new Date(today);

  // If today has no activity yet, the streak is still "alive" as long as
  // yesterday was active; start counting from yesterday in that case.
  if (!active.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!active.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (active.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
