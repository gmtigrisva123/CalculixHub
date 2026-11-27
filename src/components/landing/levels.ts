/**
 * The four levels, as bands on the engine's ability scale.
 *
 * The boundaries are `tierForTheta`'s (src/domain/irt.ts), written out so a
 * figure can draw them; the tests beside engineRun and sitting check that the
 * two agree at every point of the scale. Kept apart from engineRun.ts so the
 * hero, which only needs the bands, does not have to bring the placement bank
 * and its replay along with it.
 */

import type { ItemSource, Tier } from '../../domain/irt';

export interface TierBand {
  tier: Tier;
  from: number;
  to: number;
  /** The contest whose problems the engine starts a learner of this level on. */
  starts: ItemSource;
}

/** Provisional tier boundaries on the ability scale, as `tierForTheta` draws them. */
export const TIER_BANDS: readonly TierBand[] = [
  { tier: 'Foundation', from: -4, to: -0.8, starts: 'AMC 8' },
  { tier: 'Intermediate', from: -0.8, to: 0.4, starts: 'AMC 10' },
  { tier: 'Advanced', from: 0.4, to: 1.2, starts: 'AIME' },
  { tier: 'Olympiad', from: 1.2, to: 4, starts: 'USAMO' },
];

/** The stretch of the scale the page's figures draw. Almost nobody is placed outside it. */
export const AXIS = { min: -3, max: 3 } as const;

/** Where an ability sits along a figure's axis, from 0 at its left end to 1 at its right. */
export const along = (theta: number): number =>
  Math.max(0, Math.min(1, (theta - AXIS.min) / (AXIS.max - AXIS.min)));

/** Each band's share of the drawn axis, in order. They add up to 1. */
export const BAND_SHARES: readonly number[] = TIER_BANDS.map(band => along(band.to) - along(band.from));
