/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';
import { Sigma, Triangle, Shuffle, Hash, type LucideIcon } from 'lucide-react';
import { Topic, Level, CompetitionLevel } from '../../shared/types';

/**
 * A style object that may also carry CSS custom properties.
 *
 * React's `CSSProperties` has no index signature, so an object literal
 * containing `--cx-hue` fails the excess-property check even though the DOM
 * accepts it and React writes it through verbatim. Widening with a template
 * key is the narrowest way to say "known CSS properties, plus custom ones".
 */
type StyleVars = CSSProperties & Record<`--${string}`, string>;

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
  /** The `.cx-tint-*` modifier that tints a panel in this domain's hue. */
  tint: string;
  /**
   * Stroke and text colours for `.cx-tag`, handed over as inline custom
   * properties. They are here rather than in a class per domain because the tag
   * is one rule parameterised by hue, and four near-identical CSS blocks would
   * be four places to forget to update.
   */
  vars: StyleVars;
}

/*
 * Topic colours are a categorical set, taken from the source design: Algebra
 * gold, Geometry verdigris, Combinatorics violet, Number Theory sky.
 *
 * Algebra sharing a family with the brass accent is deliberate. The usual rule
 * — no topic wears the action colour, so that nothing on a dashboard listing
 * four domains reads as a call to action — is broken here because the design
 * leads with gold as the first domain, and honouring the rule would have meant
 * inventing a fifth hue belonging to neither set. What keeps it legible is that
 * this system has no filled accent buttons to be confused with: an Algebra tag
 * is a stroked capital label and a primary action is a stroked *button*, and
 * the two are never the same shape.
 *
 * The hex values are duplicated from the ramps in styles/tokens.css rather than
 * read from them, because these are handed to inline `style` and a
 * `var(--hu-amber-500)` there would resolve against the element rather than the
 * theme root when the tag sits inside a `.ramp-static` subtree.
 */
export const TOPIC_META: Record<Topic, TopicMeta> = {
  Algebra: {
    label: 'Algebra',
    short: 'ALG',
    icon: Sigma,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-400',
    tint: 'cx-tint-algebra',
    vars: { '--cx-hue': '#c8842a', '--cx-hue-text': '#a06f24' },
  },
  Geometry: {
    label: 'Geometry',
    short: 'GEO',
    icon: Triangle,
    text: 'text-proof-700',
    bg: 'bg-proof-50',
    border: 'border-proof-200',
    ring: 'ring-proof-400',
    tint: 'cx-tint-geometry',
    vars: { '--cx-hue': '#2f9c8c', '--cx-hue-text': '#185f56' },
  },
  Combinatorics: {
    label: 'Combinatorics',
    short: 'CMB',
    icon: Shuffle,
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    ring: 'ring-violet-400',
    tint: 'cx-tint-combinatorics',
    vars: { '--cx-hue': '#8b5cf6', '--cx-hue-text': '#6d3fd6' },
  },
  'Number Theory': {
    label: 'Number Theory',
    short: 'NT',
    icon: Hash,
    text: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    ring: 'ring-sky-400',
    tint: 'cx-tint-number-theory',
    vars: { '--cx-hue': '#0ea5e9', '--cx-hue-text': '#0369a1' },
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
  Intermediate: {
    label: 'Intermediate',
    audience: 'Building competition confidence',
    scope: 'AMC 10 - AMC 12',
    shape: 'pentagon',
    text: 'text-teal-700',
    bg: 'bg-teal-100',
    border: 'border-teal-300',
  },
  Advanced: {
    label: 'Advanced',
    audience: 'High school (10-12)',
    scope: 'AIME - AMC 12',
    shape: 'pentagon',
    text: 'text-sky-700',
    bg: 'bg-sky-100',
    border: 'border-sky-300',
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

export const LEVEL_LIST: Level[] = ['Foundation', 'Intermediate', 'Advanced', 'Olympiad'];

export const COMPETITION_META: Record<CompetitionLevel, { label: string; scope: string; text: string; bg: string; border: string }> = {
  AMC: { label: 'AMC', scope: 'Multiple choice', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  AIME: { label: 'AIME', scope: 'Three-digit answer', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  USAMO: { label: 'USAMO', scope: 'Proof response · Pro', text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  IMO: { label: 'IMO', scope: 'Proof response · Pro', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

export const COMPETITION_LIST: CompetitionLevel[] = ['AMC', 'AIME', 'USAMO', 'IMO'];

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
  { name: 'Advanced', minPoints: 400, text: 'text-sky-700', bg: 'bg-sky-100', border: 'border-sky-300', glyph: '3' },
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
