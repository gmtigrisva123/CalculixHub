/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Seeded randomness, for anything that has to come out the same on every visit.
 *
 * The landing page's placement replay draws its simulated answers from it, and
 * the landing's particle forms are laid out with it, so every visitor watches
 * the same placement and sees the same shapes. It used to live in the old
 * landing's particleShapes.ts; it moved here because it belongs to neither
 * landing (docs/landing-v2-brief.md §4.2).
 */

export type Rng = () => number;

/** A small, fast, seedable generator of numbers in [0, 1): the same seed draws the same sequence. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
