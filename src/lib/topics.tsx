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
    text: 'text-algebra-ink',
    bg: 'bg-algebra-soft',
    border: 'border-algebra',
    ring: 'ring-algebra',
    tint: 'cx-tint-algebra',
    vars: { '--cx-hue': 'var(--algebra)', '--cx-hue-text': 'var(--algebra-ink)' },
  },
  Geometry: {
    label: 'Geometry',
    short: 'GEO',
    icon: Triangle,
    text: 'text-geometry-ink',
    bg: 'bg-geometry-soft',
    border: 'border-geometry',
    ring: 'ring-geometry',
    tint: 'cx-tint-geometry',
    vars: { '--cx-hue': 'var(--geometry)', '--cx-hue-text': 'var(--geometry-ink)' },
  },
  Combinatorics: {
    label: 'Combinatorics',
    short: 'CMB',
    icon: Shuffle,
    text: 'text-combinatorics-ink',
    bg: 'bg-combinatorics-soft',
    border: 'border-combinatorics',
    ring: 'ring-combinatorics',
    tint: 'cx-tint-combinatorics',
    vars: { '--cx-hue': 'var(--combinatorics)', '--cx-hue-text': 'var(--combinatorics-ink)' },
  },
  'Number Theory': {
    label: 'Number Theory',
    short: 'NT',
    icon: Hash,
    text: 'text-number-theory-ink',
    bg: 'bg-number-theory-soft',
    border: 'border-number-theory',
    ring: 'ring-number-theory',
    tint: 'cx-tint-number-theory',
    vars: { '--cx-hue': 'var(--number-theory)', '--cx-hue-text': 'var(--number-theory-ink)' },
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
    text: 'text-ink-2',
    bg: 'bg-paper-2',
    border: 'border-rule',
  },
  Intermediate: {
    label: 'Intermediate',
    audience: 'Building competition confidence',
    scope: 'AMC 10 - AMC 12',
    shape: 'pentagon',
    text: 'text-ink-2',
    bg: 'bg-paper-2',
    border: 'border-rule',
  },
  Advanced: {
    label: 'Advanced',
    audience: 'High school (10-12)',
    scope: 'AIME - AMC 12',
    shape: 'pentagon',
    text: 'text-ink-2',
    bg: 'bg-paper-2',
    border: 'border-rule',
  },
  Olympiad: {
    label: 'Olympiad',
    audience: 'Competitive & ambitious',
    scope: 'USAMO - IMO',
    shape: 'hexagon',
    text: 'text-ink-2',
    bg: 'bg-paper-2',
    border: 'border-rule',
  },
};

export const LEVEL_LIST: Level[] = ['Foundation', 'Intermediate', 'Advanced', 'Olympiad'];

export const COMPETITION_META: Record<CompetitionLevel, { label: string; scope: string; text: string; bg: string; border: string }> = {
  AMC: { label: 'AMC', scope: 'Multiple choice', text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule' },
  AIME: { label: 'AIME', scope: 'Three-digit answer', text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule' },
  USAMO: { label: 'USAMO', scope: 'Proof response · Pro', text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule' },
  IMO: { label: 'IMO', scope: 'Proof response · Pro', text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule' },
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
  { name: 'Beginner', minPoints: 0, text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule', glyph: '1' },
  { name: 'Intermediate', minPoints: 150, text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule', glyph: '2' },
  { name: 'Advanced', minPoints: 400, text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule', glyph: '3' },
  { name: 'Elite', minPoints: 800, text: 'text-ink-2', bg: 'bg-paper-2', border: 'border-rule', glyph: '4' },
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
