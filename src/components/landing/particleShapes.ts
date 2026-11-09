/**
 * The point set the landing hero's particle stage is drawn from.
 *
 * Pure functions with no WebGL in them, so the form can be tested and the 2D
 * fallback can draw exactly what the shader would.
 *
 * The form is the Lorenz attractor: three short equations whose one path loops
 * round two wings for ever, never crossing itself and never repeating, so that
 * two starts a hair apart end up anywhere. It is chaos, but not disorder — the
 * path never leaves the butterfly — which is what staying with a hard question
 * feels like.
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
// The hero: the Lorenz attractor
// ---------------------------------------------------------------------------

/** Lorenz's own parameters, the ones that make the butterfly. */
export const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3 } as const;

/** How the attractor is fitted to the stage: its centre in Lorenz's z, and the scale to world units. */
const CENTRE_Z = 23.5;
const SCALE = 0.082;

type Vec3 = [number, number, number];

function lorenz([x, y, z]: Vec3): Vec3 {
  return [LORENZ.sigma * (y - x), x * (LORENZ.rho - z) - y, x * y - LORENZ.beta * z];
}

/** One fourth-order Runge–Kutta step. */
function step(p: Vec3, dt: number): Vec3 {
  const add = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const k1 = lorenz(p);
  const k2 = lorenz(add(p, k1, dt / 2));
  const k3 = lorenz(add(p, k2, dt / 2));
  const k4 = lorenz(add(p, k3, dt));
  return [
    p[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    p[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    p[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
  ];
}

export interface LorenzPath {
  /**
   * Per sample: x, y, z in world units (y up, the wings spread along x), and
   * how fast the path moves there, from 0 (slowest) to 1 (fastest).
   */
  samples: Float32Array;
  length: number;
}

/**
 * The attractor as one long path of `length` evenly timed samples, after the
 * first steps — which only find their way onto the attractor — are dropped.
 * In world space Lorenz's z becomes height, so the two wings stand side by side.
 */
export function lorenzPath(length: number, dt = 0.0024, start: Vec3 = [0.1, 0, 0]): LorenzPath {
  let p = start;
  // Starting near the origin, the path circles one wing for a long while before it first crosses; skip that.
  for (let k = 0, warm = Math.ceil(25 / dt); k < warm; k += 1) p = step(p, dt);
  const samples = new Float32Array(length * 4);
  let fastest = 0;
  let slowest = Infinity;
  for (let i = 0; i < length; i += 1) {
    // Two half steps per sample keep the integration accurate at this spacing.
    p = step(step(p, dt / 2), dt / 2);
    const [vx, vy, vz] = lorenz(p);
    const speed = Math.hypot(vx, vy, vz);
    samples[i * 4] = p[0] * SCALE;
    samples[i * 4 + 1] = (p[2] - CENTRE_Z) * SCALE;
    samples[i * 4 + 2] = p[1] * SCALE;
    samples[i * 4 + 3] = speed;
    fastest = Math.max(fastest, speed);
    slowest = Math.min(slowest, speed);
  }
  for (let i = 0; i < length; i += 1) samples[i * 4 + 3] = Math.max(0, Math.min(1, (samples[i * 4 + 3] - slowest) / (fastest - slowest || 1)));
  return { samples, length };
}

/** A sample of the path at a fractional index, interpolated between neighbours. */
export function pathPoint(path: LorenzPath, at: number): [number, number, number, number] {
  const wrapped = ((at % path.length) + path.length) % path.length;
  const i = Math.floor(wrapped);
  const j = Math.min(path.length - 1, i + 1);
  const f = wrapped - i;
  const s = path.samples;
  return [0, 1, 2, 3].map(k => s[i * 4 + k] + (s[j * 4 + k] - s[i * 4 + k]) * f) as [number, number, number, number];
}

export interface FlowLayout {
  /**
   * Per particle: where along the path it starts (0–1), its speed factor, a
   * seed in (0, 1], and how far it strays from the path's centre line. Dust
   * particles store a direction and a radius in the first three instead, and
   * carry a negative seed.
   */
  params: Float32Array;
  /** Per particle: the direction it strays in, a unit vector. Unused by dust. */
  offsets: Float32Array;
  count: number;
}

/**
 * `threads` particles spread along the path, each a little off its centre line
 * so the path reads as a silk ribbon rather than a wire, plus loose dust round
 * the form for depth.
 */
export function flowLayout(threads: number, dust: number, rng: Rng = mulberry32(11)): FlowLayout {
  const count = threads + dust;
  const params = new Float32Array(count * 4);
  const offsets = new Float32Array(count * 3);
  for (let i = 0; i < threads; i += 1) {
    params[i * 4] = (i + rng()) / threads;
    params[i * 4 + 1] = 0.82 + rng() * 0.36;
    params[i * 4 + 2] = 0.02 + rng() * 0.98;
    // Most stay close to the line; a few wander wider, as fibres do.
    params[i * 4 + 3] = 0.002 + 0.03 * rng() ** 3;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    offsets[i * 3] = Math.sin(phi) * Math.cos(theta);
    offsets[i * 3 + 1] = Math.cos(phi);
    offsets[i * 3 + 2] = Math.sin(phi) * Math.sin(theta);
  }
  for (let i = threads; i < count; i += 1) {
    params[i * 4] = rng() * Math.PI * 2;
    params[i * 4 + 1] = Math.acos(2 * rng() - 1);
    params[i * 4 + 2] = 2.7 + rng() * 2.6;
    params[i * 4 + 3] = -(0.02 + rng() * 0.98);
  }
  return { params, offsets, count };
}
