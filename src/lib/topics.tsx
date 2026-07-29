/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sigma, Triangle, Shuffle, Hash, type LucideIcon } from 'lucide-react';
import { Topic, Level } from '../types';

// Single source of truth for topic/level/rank display metadata.
// Previously each component (Dashboard, Learn, ProgressView, Profile) carried
// its own near-identical translateTopic switch statement — consolidated here.

interface TopicMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
  ring: string;
}

export const TOPIC_META: Record<Topic, TopicMeta> = {
  Algebra: {
    label: 'Algebra',
    short: 'ALG',
    icon: Sigma,
    text: 'text-brass-700',
    bg: 'bg-brass-50',
    border: 'border-brass-200',
    ring: 'ring-brass-400',
  },
  Geometry: {
    label: 'Geometry',
    short: 'GEO',
    icon: Triangle,
    text: 'text-proof-700',
    bg: 'bg-proof-50',
    border: 'border-proof-200',
    ring: 'ring-proof-400',
  },
  Combinatorics: {
    label: 'Combinatorics',
    short: 'CMB',
    icon: Shuffle,
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    ring: 'ring-violet-400',
  },
  'Number Theory': {
    label: 'Number Theory',
    short: 'NT',
    icon: Hash,
    text: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    ring: 'ring-sky-400',
  },
};

export const TOPIC_LIST: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

interface LevelMeta {
  label: string;
  audience: string;
  scope: string;
  shape: 'square' | 'pentagon' | 'hexagon';
  text: string;
  bg: string;
  border: string;
}

export const LEVEL_META: Record<Level, LevelMeta> = {
  Foundation: {
    label: 'Foundation',
    audience: 'Middle grade (7-9)',
    scope: 'AMC 8 - AMC 10',
    shape: 'square',
    text: 'text-stone-700',
    bg: 'bg-stone-100',
    border: 'border-stone-300',
  },
  Advanced: {
    label: 'Advanced',
    audience: 'High school (10-12)',
    scope: 'AIME - AMC 12',
    shape: 'pentagon',
    text: 'text-brass-700',
    bg: 'bg-brass-100',
    border: 'border-brass-300',
  },
  Olympiad: {
    label: 'Olympiad',
    audience: 'Competitive & ambitious',
    scope: 'USAMO - IMO',
    shape: 'hexagon',
    text: 'text-violet-700',
    bg: 'bg-violet-100',
    border: 'border-violet-300',
  },
};

export const LEVEL_LIST: Level[] = ['Foundation', 'Advanced', 'Olympiad'];

// Competition skill ladder (blueprint 2.3.2): Beginner -> Intermediate -> Advanced -> Elite.
// Independent of the learning `Level` above, which governs content difficulty rather than rank.
export interface RankTier {
  name: string;
  minPoints: number;
  text: string;
  bg: string;
  border: string;
  glyph: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: 'Beginner', minPoints: 0, text: 'text-stone-600', bg: 'bg-stone-100', border: 'border-stone-300', glyph: '1' },
  { name: 'Intermediate', minPoints: 150, text: 'text-proof-700', bg: 'bg-proof-100', border: 'border-proof-300', glyph: '2' },
  { name: 'Advanced', minPoints: 400, text: 'text-brass-700', bg: 'bg-brass-100', border: 'border-brass-300', glyph: '3' },
  { name: 'Elite', minPoints: 800, text: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-300', glyph: '4' },
];

export function getRankForPoints(points: number): RankTier {
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

export function nextRankFor(points: number): RankTier | null {
  const idx = RANK_TIERS.findIndex((t) => t.name === getRankForPoints(points).name);
  return idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
