/**
 * Motion tokens for landing v2 (docs/landing-v2-brief.md §8.2). The matching
 * CSS custom properties are in styles/tokens.css.
 *
 * Durations are in seconds. Easing curves are cubic Béziers. Springs use
 * Motion's `visualDuration` and `bounce`. DAMP holds the rates for frame-rate
 * independent damping: x += (target - x) * (1 - Math.exp(-λ * dt)).
 */

export const DUR = { micro: 0.12, short: 0.2, base: 0.32, long: 0.56, scene: 0.9, cinematic: 1.4 } as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1], // entering (expo-out)
  in: [0.5, 0, 0.75, 0], // leaving (quart-in)
  inOut: [0.65, 0, 0.35, 1], // moving on screen, flying to a scene
  outSoft: [0.25, 1, 0.5, 1], // figures settling (quart-out)
} as const;

export const SPRING = {
  press: { type: 'spring', visualDuration: 0.25, bounce: 0.2 }, // buttons, taps
  ui: { type: 'spring', visualDuration: 0.45, bounce: 0.08 }, // panels, pills, reordering
  text: { type: 'spring', visualDuration: 0.8, bounce: 0.1 }, // headings rising
  lock: { type: 'spring', visualDuration: 0.55, bounce: 0.35 }, // the Lock-on only
} as const;

export const STAGGER = { word: 0.04, line: 0.08, item: 0.06, max: 0.4 } as const;

export const DAMP = { camera: 6, pointer: 12, reticle: 18, readout: 10, parallax: 4 } as const;
