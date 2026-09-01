/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CalculixHub Achievements & Unlock Tracking System.
 */

import type { UserStats, Topic } from '../../shared/types';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  condition: (stats: UserStats, completedCount: number) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'b1',
    title: 'Getting Started',
    desc: 'Joined CalculixHub and started your journey',
    icon: '🌱',
    condition: () => true,
  },
  {
    id: 'b2',
    title: 'Algebra Reflex',
    desc: 'Reach 50 total points in problem solving',
    icon: '📐',
    condition: (stats) => (stats?.points ?? 0) >= 50,
  },
  {
    id: 'b3',
    title: 'Combinatorics Warrior',
    desc: 'Master discrete math (60%+ skill rating)',
    icon: '🎲',
    condition: (stats) => (stats?.skills?.Combinatorics ?? 0) >= 60,
  },
  {
    id: 'b4',
    title: 'Leaderboard Breaker',
    desc: 'Cross 250 cumulative points',
    icon: '🏆',
    condition: (stats) => (stats?.points ?? 0) >= 250,
  },
  {
    id: 'b5',
    title: 'Unbreakable Streak',
    desc: 'Hit a 3-day consecutive activity streak',
    icon: '🔥',
    condition: (stats) => (stats?.streak ?? 0) >= 3,
  },
  {
    id: 'b6',
    title: 'Problem Solver',
    desc: 'Solve 5 competition problems correctly',
    icon: '⚡',
    condition: (stats, completedCount) => (completedCount ?? 0) >= 5 || (stats?.completedCount ?? 0) >= 5,
  },
  {
    id: 'b7',
    title: 'Master Strategist',
    desc: 'Cross 500 cumulative points on the ladder',
    icon: '👑',
    condition: (stats) => (stats?.points ?? 0) >= 500,
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
export function getShownToastIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_TOASTS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

/** Save updated set of shown toast achievement IDs to storage. */
export function saveShownToastIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SHOWN_TOASTS_KEY, JSON.stringify(Array.from(ids)));
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
