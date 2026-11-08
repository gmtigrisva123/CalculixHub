/**
 * The point set the landing hero's particle stage is drawn from.
 *
 * Pure functions with no WebGL in them, so the form can be tested and the 2D
 * fallback can draw exactly what the shader would. The form is real mathematics
 * rather than a decorative blob: the Möbius strip — one side, one edge, and a
 * path you can follow forever without crossing a boundary.
 */

export type Rng = () => number;

/** A small, fast, seedable generator: the same seed draws the same forms. */
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

// ---------------------------------------------------------------------------
// The hero: a Möbius strip
// ---------------------------------------------------------------------------

/** Centre-line radius and half-width of the strip. Mirrored in the hero shader. */
export const MOBIUS = { radius: 1.75, halfWidth: 0.62 } as const;

/**
 * A point on the strip. `u` runs along it (period 4π: one lap flips the
 * side, the second brings it back) and `s` across it, in [-halfWidth, halfWidth].
 * The strip lies in the x/z plane with its twist rising through y.
 */
export function mobiusPoint(u: number, s: number): [number, number, number] {
  const half = u / 2;
  const reach = MOBIUS.radius + s * Math.cos(half);
  return [reach * Math.cos(u), s * Math.sin(half), reach * Math.sin(u)];
}

export interface MobiusLayout {
  /** Per particle: u, s, speed factor, seed. Dust particles carry a negative seed. */
  params: Float32Array;
  count: number;
  rails: number;
}

/**
 * The strip as rails of light: `rails` lines across its width, each carrying
 * `perRail` particles that the shader slides along u. Rails at ±s swap places
 * after one lap, so the flow never shows a seam. A little loose dust around the
 * strip gives the stage depth.
 */
export function mobiusLayout(rails: number, perRail: number, dust: number, rng: Rng = mulberry32(11)): MobiusLayout {
  const count = rails * perRail + dust;
  const params = new Float32Array(count * 4);
  let index = 0;
  for (let rail = 0; rail < rails; rail += 1) {
    const s = rails === 1 ? 0 : -MOBIUS.halfWidth + (2 * MOBIUS.halfWidth * rail) / (rails - 1);
    // Edge rails move a touch faster than the middle, which reads as depth.
    const speed = 0.85 + 0.3 * Math.abs(s / MOBIUS.halfWidth);
    for (let k = 0; k < perRail; k += 1) {
      const jitter = (rng() - 0.5) * 0.55;
      params[index * 4] = ((k + jitter) / perRail) * Math.PI * 2;
      params[index * 4 + 1] = s + (rng() - 0.5) * 0.012;
      params[index * 4 + 2] = speed * (0.94 + rng() * 0.12);
      params[index * 4 + 3] = 0.02 + rng() * 0.98;
      index += 1;
    }
  }
  for (let k = 0; k < dust; k += 1) {
    // Dust stores a direction and a radius instead of strip coordinates.
    params[index * 4] = rng() * Math.PI * 2;
    params[index * 4 + 1] = Math.acos(2 * rng() - 1);
    params[index * 4 + 2] = 2.6 + rng() * 2.6;
    params[index * 4 + 3] = -(0.02 + rng() * 0.98);
    index += 1;
  }
  return { params, count, rails };
}
