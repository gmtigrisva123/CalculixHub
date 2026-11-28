/**
 * The shapes the particle swarm can take (docs/landing-v2-brief.md §9.11).
 *
 * The order is the index: a form's position in this list is its block of rows
 * in the forms texture, and the number the vertex shader compares against
 * (FORM_POSTERIOR = 1). `posterior` is computed in the shader but keeps its
 * empty block, so index and block always agree. How each form is baked is
 * added in Phase 2.
 */

export const FORM_IDS = [
  'cloud',
  'posterior',
  'figure-algebra',
  'figure-geometry',
  'figure-combinatorics',
  'figure-number',
  'layers',
  'quiet',
  'constellation',
  'tunnel',
  'banks',
  'track',
  'grid',
  'mark',
] as const;

export type FormId = (typeof FORM_IDS)[number];
