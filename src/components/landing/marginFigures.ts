/**
 * The figures drawn in the page margins: one point cloud per chapter.
 *
 * On a wide screen the landing's column leaves two strips of bare paper either
 * side of it. The margin rails fill them the way a mathematician fills the
 * margin of a working sheet — and the right-hand rail keeps one small figure
 * that turns slowly and re-forms itself, point by point, each time the reader
 * crosses into a new chapter.
 *
 * Every figure here is the same number of points, so any one can morph into
 * any other by moving point i to point i. Pure functions, no canvas: the
 * shapes can be tested, and the rail only has to project and draw them.
 */

import { lorenzPath, mulberry32, type Rng } from './particleShapes';

/** Points per figure. Every figure has exactly this many, so they morph one to one. */
export const FIGURE_POINTS = 720;

export type Figure = Float32Array; // x, y, z per point; fitted to the unit sphere

const TAU = Math.PI * 2;

/** Fit a raw list of points into the unit sphere, centred, and to exactly FIGURE_POINTS. */
function fit(raw: number[][], rng: Rng): Figure {
  const out = new Float32Array(FIGURE_POINTS * 3);
  if (raw.length === 0) return out;

  let cx = 0, cy = 0, cz = 0;
  for (const [x, y, z] of raw) { cx += x; cy += y; cz += z; }
  cx /= raw.length; cy /= raw.length; cz /= raw.length;
  let reach = 0;
  for (const [x, y, z] of raw) reach = Math.max(reach, Math.hypot(x - cx, y - cy, z - cz));
  const k = reach > 0 ? 1 / reach : 1;

  for (let i = 0; i < FIGURE_POINTS; i += 1) {
    // Fewer source points than slots: repeat with a hair of jitter so doubles don't stack.
    const source = raw[i % raw.length];
    const jitter = i >= raw.length ? 0.012 : 0;
    out[i * 3] = (source[0] - cx) * k + (rng() - 0.5) * jitter;
    out[i * 3 + 1] = (source[1] - cy) * k + (rng() - 0.5) * jitter;
    out[i * 3 + 2] = (source[2] - cz) * k + (rng() - 0.5) * jitter;
  }
  return out;
}

/** Evenly spaced points along a segment, end exclusive. */
function segment(a: number[], b: number[], count: number) {
  const pts: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

const shapes: Record<string, (rng: Rng) => number[][]> = {
  /** The hero's own butterfly, in miniature. */
  lorenz: () => {
    const path = lorenzPath(FIGURE_POINTS * 6);
    const pts: number[][] = [];
    for (let i = 0; i < FIGURE_POINTS; i += 1) {
      const j = i * 6;
      pts.push([path.samples[j * 4], path.samples[j * 4 + 1], path.samples[j * 4 + 2]]);
    }
    return pts;
  },

  /** Not too easy, not too hard: a bell, its peak in the middle. */
  bell: () => {
    const pts: number[][] = [];
    const n = 27;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const x = (i / (n - 1)) * 2 - 1;
        const z = (j / (n - 1)) * 2 - 1;
        pts.push([x, Math.exp(-(x * x + z * z) * 3.2) * 1.15 - 0.3, z]);
      }
    }
    return pts;
  },

  /** A hyperboloid of one sheet: curved, yet woven entirely from straight lines. */
  hyperboloid: () => {
    const pts: number[][] = [];
    const lines = 24;
    const per = FIGURE_POINTS / lines;
    for (let l = 0; l < lines; l += 1) {
      const a = (l / lines) * TAU;
      for (let s = 0; s < per; s += 1) {
        const t = (s / (per - 1)) * 2 - 1;
        pts.push([Math.cos(a) * 0.55 - t * Math.sin(a) * 0.55, t * 1.05, Math.sin(a) * 0.55 + t * Math.cos(a) * 0.55]);
      }
    }
    return pts;
  },

  /** The playground's problem: a circle, and two chords crossing at P. */
  chords: () => {
    const pts: number[][] = [];
    for (let i = 0; i < 400; i += 1) {
      const a = (i / 400) * TAU;
      pts.push([Math.cos(a), Math.sin(a), 0]);
    }
    const at = (deg: number) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0];
    pts.push(...segment(at(112), at(-62), 160));
    pts.push(...segment(at(64), at(212), 160));
    return pts;
  },

  /** A trefoil: the simplest knot that will not come undone. */
  trefoil: rng => {
    const pts: number[][] = [];
    for (let i = 0; i < FIGURE_POINTS; i += 1) {
      const t = (i / FIGURE_POINTS) * TAU;
      const r = 0.09 * Math.sqrt(rng());
      const phi = rng() * TAU;
      pts.push([
        Math.sin(t) + 2 * Math.sin(2 * t) + r * Math.cos(phi),
        Math.cos(t) - 2 * Math.cos(2 * t) + r * Math.sin(phi),
        -Math.sin(3 * t) + r * Math.cos(phi + 1),
      ]);
    }
    return pts;
  },

  /** Two strands and the rungs between them: one rung a year. */
  helix: () => {
    const pts: number[][] = [];
    const turns = 2.4;
    for (let i = 0; i < 260; i += 1) {
      const t = i / 259;
      const a = t * turns * TAU;
      const y = t * 2.6 - 1.3;
      pts.push([Math.cos(a), y, Math.sin(a)]);
      pts.push([Math.cos(a + Math.PI), y, Math.sin(a + Math.PI)]);
    }
    const rungs = 20;
    for (let r = 0; r < rungs; r += 1) {
      const t = (r + 0.5) / rungs;
      const a = t * turns * TAU;
      const y = t * 2.6 - 1.3;
      pts.push(...segment([Math.cos(a), y, Math.sin(a)], [Math.cos(a + Math.PI), y, Math.sin(a + Math.PI)], 10));
    }
    return pts;
  },

  /** One side, one edge. */
  mobius: () => {
    const pts: number[][] = [];
    const around = 48;
    const across = 15;
    for (let i = 0; i < around; i += 1) {
      const u = (i / around) * TAU;
      for (let j = 0; j < across; j += 1) {
        const v = (j / (across - 1)) * 0.8 - 0.4;
        pts.push([(1 + v * Math.cos(u / 2)) * Math.cos(u), v * Math.sin(u / 2), (1 + v * Math.cos(u / 2)) * Math.sin(u)]);
      }
    }
    return pts;
  },

  /** A tesseract's shadow: a cube inside a cube, corner joined to corner. */
  tesseract: () => {
    const pts: number[][] = [];
    const corners = (s: number) => {
      const c: number[][] = [];
      for (let i = 0; i < 8; i += 1) c.push([i & 1 ? s : -s, i & 2 ? s : -s, i & 4 ? s : -s]);
      return c;
    };
    const outer = corners(1);
    const inner = corners(0.48);
    const edges: [number, number][] = [];
    for (let a = 0; a < 8; a += 1) {
      for (let b = a + 1; b < 8; b += 1) {
        const diff = a ^ b;
        if (diff === 1 || diff === 2 || diff === 4) edges.push([a, b]);
      }
    }
    for (const [a, b] of edges) {
      pts.push(...segment(outer[a], outer[b], 22));
      pts.push(...segment(inner[a], inner[b], 14));
    }
    for (let i = 0; i < 8; i += 1) pts.push(...segment(outer[i], inner[i], 12));
    return pts;
  },

  /** Every loop comes back round. */
  torus: () => {
    const pts: number[][] = [];
    const around = 48;
    const tube = 15;
    for (let i = 0; i < around; i += 1) {
      const u = (i / around) * TAU;
      for (let j = 0; j < tube; j += 1) {
        const v = (j / tube) * TAU + (i % 2) * (Math.PI / tube);
        pts.push([(1 + 0.38 * Math.cos(v)) * Math.cos(u), 0.38 * Math.sin(v), (1 + 0.38 * Math.cos(v)) * Math.sin(u)]);
      }
    }
    return pts;
  },

  /** A sphere, laid with the golden angle so no point crowds another. */
  sphere: () => {
    const pts: number[][] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < FIGURE_POINTS; i += 1) {
      const y = 1 - (i / (FIGURE_POINTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      pts.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
    }
    return pts;
  },
};

export type FigureName = keyof typeof shapes;
export const FIGURE_NAMES = Object.keys(shapes) as FigureName[];

const cache = new Map<string, Figure>();

/** A figure by name, built once and kept. */
export function figure(name: FigureName): Figure {
  let built = cache.get(name);
  if (!built) {
    built = fit(shapes[name](mulberry32(name.length * 7919 + 17)), mulberry32(name.length * 31 + 3));
    cache.set(name, built);
  }
  return built;
}
