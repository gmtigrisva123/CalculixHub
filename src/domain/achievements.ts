/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Badges: what earns each one, and which have been earned and announced.
 */

import type { UserStats, Topic } from '../../shared/types';

export interface Achievement {
  id: string;
  title: string;
  /** What earned it, as a plain fact. */
  desc: string;
  condition: (stats: UserStats, completedCount: number) => boolean;
  /** How far along a learner is, for badges that are counted towards. */
  progress?: (stats: UserStats, completedCount: number) => { now: number; goal: number; unit: string };
}

/*
 * Named for what was done, and described as a fact. The coin each is struck
 * with is chosen by id in components/badgeIcons.ts.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'b1',
    title: 'Name on the cover',
    desc: 'You have an account, so your work is kept.',
    condition: () => true,
  },
  {
    id: 'b2',
    title: 'First fifty',
    desc: '50 points from problems you solved.',
    condition: (stats) => (stats?.points ?? 0) >= 50,
    progress: (stats) => ({ now: stats?.points ?? 0, goal: 50, unit: 'points' }),
  },
  {
    id: 'b3',
    title: 'Counts without counting',
    desc: 'A Combinatorics rating of 60% or better.',
    condition: (stats) => (stats?.skills?.Combinatorics ?? 0) >= 60,
    progress: (stats) => ({ now: Math.round(stats?.skills?.Combinatorics ?? 0), goal: 60, unit: '% in Combinatorics' }),
  },
  {
    id: 'b4',
    title: 'Two hundred and fifty',
    desc: '250 points from problems you solved.',
    condition: (stats) => (stats?.points ?? 0) >= 250,
    progress: (stats) => ({ now: stats?.points ?? 0, goal: 250, unit: 'points' }),
  },
  {
    id: 'b5',
    title: 'Three days running',
    desc: 'You practised three days in a row.',
    condition: (stats) => (stats?.streak ?? 0) >= 3,
    progress: (stats) => ({ now: stats?.streak ?? 0, goal: 3, unit: 'days in a row' }),
  },
  {
    id: 'b6',
    title: 'First five',
    desc: 'Five problems solved.',
    condition: (stats, completedCount) => (completedCount ?? 0) >= 5 || (stats?.completedCount ?? 0) >= 5,
    progress: (stats, completedCount) => ({ now: Math.max(completedCount ?? 0, stats?.completedCount ?? 0), goal: 5, unit: 'solved' }),
  },
  {
    id: 'b7',
    title: 'Five hundred',
    desc: '500 points from problems you solved.',
    condition: (stats) => (stats?.points ?? 0) >= 500,
    progress: (stats) => ({ now: stats?.points ?? 0, goal: 500, unit: 'points' }),
  },
];

const UNLOCKED_KEY = 'calculix_unlocked_achievements';
const SHOWN_TOASTS_KEY = 'calculix_shown_toasts_achievements';

/** Returns the set of currently unlocked achievement IDs from storage. */
export function getUnlockedAchievementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

/** Save updated set of unlocked achievement IDs to storage. */
export function saveUnlockedAchievementIds(ids: Set<string>): void {
  try {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(Array.from(ids)));
  } catch (err) {
    console.error('[CalculixHub] Error saving unlocked achievements:', err);
  }
}

/** Returns the set of achievement IDs whose Toast Alert has already been shown on screen. */
export function getShownToastIds(userId?: string): Set<string> {
  try {
    const raw = localStorage.getItem(userId ? `${SHOWN_TOASTS_KEY}:${userId}` : SHOWN_TOASTS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

/** Save updated set of shown toast achievement IDs to storage. */
export function saveShownToastIds(ids: Set<string>, userId?: string): void {
  try {
    localStorage.setItem(userId ? `${SHOWN_TOASTS_KEY}:${userId}` : SHOWN_TOASTS_KEY, JSON.stringify(Array.from(ids)));
  } catch (err) {
    console.error('[CalculixHub] Error saving shown toasts:', err);
  }
}

/**
 * Evaluates all achievement conditions against the given stats.
 * Returns achievements whose unlock condition is met and whose Toast alert has not yet been shown.
 */
export function checkNewAchievements(stats: UserStats, completedCount: number = 0): Achievement[] {
  const unlocked = getUnlockedAchievementIds();
  const shownToasts = getShownToastIds();
  const newlyAlerted: Achievement[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (ach.condition(stats, completedCount)) {
      unlocked.add(ach.id);
      if (!shownToasts.has(ach.id)) {
        shownToasts.add(ach.id);
        newlyAlerted.push(ach);
      }
    }
  }

  saveUnlockedAchievementIds(unlocked);
  if (newlyAlerted.length > 0) {
    saveShownToastIds(shownToasts);
  }

  return newlyAlerted;
}
