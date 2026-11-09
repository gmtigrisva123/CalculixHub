/**
 * The point set the landing hero's particle stage is drawn from.
 *
 * Pure functions with no WebGL in them, so the form can be tested and the 2D
 * fallback can draw exactly what the shader would.
 *
 * The form is a person thinking: a head in profile, turned towards the page's
 * words, drawn in light. Where the mind would be, a sunflower of seeds grows by
 * the golden angle — each seed turned 137.5° from the last, the most irrational
 * turn there is, which is why no two seeds ever line up. A few seeds drift up
 * out of it, as thoughts do.
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

export type Point = [number, number];

/** 137.5°: the turn between successive seeds of a sunflower. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ---------------------------------------------------------------------------
// The figure
// ---------------------------------------------------------------------------

/**
 * The profile, as control points of a smooth curve (y up, facing −x). It runs
 * from the front of the neck, up over the chin, lips, nose and brow, across the
 * crown, and down the back of the head to the nape. The neck is left open at the
 * bottom so the figure dissolves there rather than ending on a cut.
 */
export const PROFILE: readonly Point[] = [
  [0.02, -2.1],
  [-0.12, -1.6],
  [-0.26, -1.18],
  [-0.4, -0.99],
  [-0.62, -0.93],
  [-0.83, -0.87],
  [-0.96, -0.74],
  [-0.96, -0.62],
  [-0.91, -0.55],
  [-0.99, -0.47],
  [-0.96, -0.39],
  [-1.03, -0.31],
  [-1.0, -0.2],
  [-1.03, -0.12],
  [-1.2, -0.02],
  [-1.12, 0.12],
  [-1.0, 0.33],
  [-0.97, 0.43],
  [-1.0, 0.55],
  [-0.94, 0.84],
  [-0.76, 1.13],
  [-0.44, 1.36],
  [0.0, 1.47],
  [0.47, 1.42],
  [0.84, 1.2],
  [1.05, 0.84],
  [1.1, 0.42],
  [1.02, 0.02],
  [0.84, -0.34],
  [0.66, -0.66],
  [0.64, -1.05],
  [0.76, -1.6],
  [0.98, -2.1],
];

/**
 * Where the hair ends on the side of the head: from the forehead, round the
 * temple, over the ear and down behind it to the nape.
 */
const HAIRLINE: readonly Point[] = [
  [-0.96, 0.98], [-0.66, 0.98], [-0.46, 0.74], [-0.2, 0.6], [0.14, 0.54], [0.5, 0.42], [0.62, 0.0], [0.7, -0.44], [0.9, -0.5],
];

/** The ear: a soft C behind the jaw. */
const EAR: readonly Point[] = [
  [0.26, 0.38], [0.38, 0.4], [0.47, 0.26], [0.47, 0.04], [0.4, -0.16], [0.29, -0.24], [0.22, -0.18],
];

/** The eye, closed in thought: one lid line, curving down. */
const EYE: readonly Point[] = [
  [-0.88, 0.33], [-0.8, 0.29], [-0.71, 0.285], [-0.64, 0.31],
];

/** The brow above it, a single light stroke. */
const BROW: readonly Point[] = [
  [-0.93, 0.5], [-0.82, 0.53], [-0.7, 0.52], [-0.62, 0.48],
];

/** The mouth: a short line between the lips, resting. */
const MOUTH: readonly Point[] = [
  [-0.98, -0.37], [-0.92, -0.375], [-0.87, -0.36],
];

/** Where the seeds grow, and how far they reach. */
export const MIND = { x: 0.18, y: 0.82, z: 0.22, radius: 0.56 } as const;

/** Half the head's width, ear to ear, and the neck's. */
const HEAD_DEPTH = 0.78;
const NECK_DEPTH = 0.46;

/** A Catmull–Rom curve through `points`, sampled `per` times a span, ends included. */
export function smoothCurve(points: readonly Point[], per = 12): Point[] {
  const out: Point[] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k += 1) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Points spaced evenly along a polyline, each with its share of the way along. */
function alongCurve(curve: Point[], count: number, rng: Rng, spread = 0) {
  const lengths = [0];
  for (let i = 1; i < curve.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const out: { x: number; y: number; t: number }[] = [];
  let j = 1;
  for (let k = 0; k < count; k += 1) {
    const t = Math.min(1, Math.max(0, (k + 0.5 + (rng() - 0.5) * 0.6) / count));
    const want = t * total;
    while (j < lengths.length - 1 && lengths[j] < want) j += 1;
    j = Math.max(1, j);
    // A point can step back if its jitter lands it before the last one.
    while (j > 1 && lengths[j - 1] > want) j -= 1;
    const span = lengths[j] - lengths[j - 1] || 1;
    const f = (want - lengths[j - 1]) / span;
    const [ax, ay] = curve[j - 1];
    const [bx, by] = curve[j];
    out.push({ x: ax + (bx - ax) * f + (rng() - 0.5) * spread, y: ay + (by - ay) * f + (rng() - 0.5) * spread, t });
  }
  return out;
}

/** Whether (x, y) lies inside the silhouette, closed across the bottom of the neck. */
export function insideFigure(x: number, y: number, outline: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const [xi, yi] = outline[i];
    const [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToCurve(x: number, y: number, curve: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < curve.length; i += 1) {
    const [ax, ay] = curve[i - 1];
    const [bx, by] = curve[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (d < best) best = d;
  }
  return best;
}

/** How the figure fades out down the neck: 1 above the jaw, 0 at the bottom. */
export function neckFade(y: number): number {
  const t = Math.max(0, Math.min(1, (y + 2.05) / 0.95));
  return t * t * (3 - 2 * t);
}

/** The near half of the head's depth at a point `edge` in from the silhouette. */
function depthAt(y: number, edge: number): number {
  const inward = Math.min(1, edge / 0.55);
  const full = y < -0.9 ? NECK_DEPTH + (HEAD_DEPTH - NECK_DEPTH) * Math.max(0, Math.min(1, (y + 1.3) / 0.4)) : HEAD_DEPTH;
  return full * Math.sqrt(1 - (1 - inward) * (1 - inward));
}

/** The curve `offset` in from `curve` (negative is outside it). The profile runs clockwise, so inside is to the right. */
function offsetCurve(curve: Point[], offset: (t: number) => number): Point[] {
  return curve.map(([x, y], i) => {
    const [ax, ay] = curve[Math.max(0, i - 1)];
    const [bx, by] = curve[Math.min(curve.length - 1, i + 1)];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const d = offset(i / (curve.length - 1));
    return [x + ((by - ay) / length) * d, y - ((bx - ax) / length) * d];
  });
}

/**
 * Particle kinds, stored in the fourth component of `meta`: the profile line,
 * the lit surface of the head, hair, the features (ear, eye, brow, mouth), the
 * seeds of the thought, thoughts drifting up, and loose dust.
 */
export const KIND = { outline: 0, surface: 1, hair: 2, feature: 3, seed: 4, rising: 5, dust: 6 } as const;

export interface FigureLayout {
  /** Per particle: the resting position (for seeds, rising thoughts and dust, their own coordinates; see the shader). */
  position: Float32Array;
  /** Per particle: seed in (0, 1], a value along the particle's own path, a light level, and the kind. */
  meta: Float32Array;
  count: number;
}

export interface FigureCounts {
  outline: number;
  surface: number;
  hair: number;
  features: number;
  seeds: number;
  rising: number;
  dust: number;
}

/**
 * The figure as particles. The surface is the near half of the head, sampled
 * evenly across the silhouette and lifted towards the viewer by a rounded
 * depth, so it turns with the head like a real volume and is brightest at its
 * rim. The hair is strands laid over the skull, each following its curve a
 * little further in than the last.
 */
export function figureLayout(counts: FigureCounts, rng: Rng = mulberry32(11)): FigureLayout {
  const total = counts.outline + counts.surface + counts.hair + counts.features + counts.seeds + counts.rising + counts.dust;
  const position = new Float32Array(total * 3);
  const meta = new Float32Array(total * 4);
  let index = 0;
  const put = (x: number, y: number, z: number, path: number, light: number, kind: number) => {
    if (index >= total) return;
    position[index * 3] = x;
    position[index * 3 + 1] = y;
    position[index * 3 + 2] = z;
    meta[index * 4] = 0.02 + rng() * 0.98;
    meta[index * 4 + 1] = path;
    meta[index * 4 + 2] = light;
    meta[index * 4 + 3] = kind;
    index += 1;
  };

  const outline = smoothCurve(PROFILE, 14);
  // Inside and distance tests run thousands of times at startup; a coarser copy of the curve is plenty for them.
  const coarse = smoothCurve(PROFILE, 5);
  const hairRegion = [...coarse.filter(([x, y]) => y > -0.5 && (x > -0.97 || y > 0.97)), ...[...HAIRLINE].reverse()] as Point[];
  const inHair = (x: number, y: number) => insideFigure(x, y, hairRegion);
  const nearMind = (x: number, y: number) => Math.hypot(x - MIND.x, (y - MIND.y) / 0.9) < MIND.radius * 1.12;

  // The profile line, which carries most of the light. Under the hair it gives way to the strands.
  for (const p of alongCurve(outline, counts.outline, rng, 0.01)) {
    const underHair = p.y > 0.98 || (p.x > 0.3 && p.y > -0.5);
    put(p.x, p.y, 0, p.t, neckFade(p.y) * (underHair ? 0.35 : 1), KIND.outline);
  }

  // The surface: depth rises from zero at the silhouette to the head's full half-width a little way in.
  let placed = 0;
  for (let guard = 0; placed < counts.surface && guard < counts.surface * 40; guard += 1) {
    const x = -1.25 + rng() * 2.45;
    const y = -2.1 + rng() * 3.6;
    if (!insideFigure(x, y, coarse)) continue;
    const fade = neckFade(y);
    if (rng() > 0.15 + 0.85 * fade) continue;
    // Under the hair the skin shows only faintly, and it clears round the thought so the seeds can be read.
    if (inHair(x, y) && rng() < 0.7) continue;
    if (nearMind(x, y) && rng() < 0.8) continue;
    const edge = distanceToCurve(x, y, coarse);
    const inward = Math.min(1, edge / 0.55);
    put(x, y, depthAt(y, edge), inward, fade * (1 - 0.55 * inward), KIND.surface);
    placed += 1;
  }

  // Hair: strands from the forehead back over the crown to the nape, laid at
  // depths from just outside the skull to well over its side.
  const crownStart = outline.findIndex(([x, y]) => x > -0.9 && y > 0.98);
  const napeEnd = outline.findIndex(([x, y], i) => i > crownStart && x > 0.5 && y < -0.5);
  const scalp = outline.slice(crownStart, napeEnd);
  const strands = Math.max(1, Math.round(counts.hair / 150));
  const perStrand = Math.floor(counts.hair / strands);
  for (let k = 0; k < strands; k += 1) {
    const layer = k / Math.max(1, strands - 1);
    const lift = -0.07 + layer * 0.62 + (rng() - 0.5) * 0.04;
    const wave = 0.02 + rng() * 0.03;
    const phase = rng() * Math.PI * 2;
    const strand = offsetCurve(scalp, t => lift + wave * Math.sin(t * Math.PI * (2 + layer * 2) + phase));
    for (const p of alongCurve(strand, perStrand, rng, 0.006)) {
      const outside = !insideFigure(p.x, p.y, coarse);
      if (!outside && !inHair(p.x, p.y)) continue;
      if (nearMind(p.x, p.y) && rng() < 0.65) continue;
      const edge = outside ? 0 : distanceToCurve(p.x, p.y, coarse);
      // Hair sits a little proud of the skull, and fuller over the crown.
      put(p.x, p.y, depthAt(p.y, edge) + 0.05, p.t, outside ? 0.75 : 0.85 - 0.45 * Math.min(1, edge / 0.55), KIND.hair);
    }
  }

  // Ear, eye, brow and mouth: fine lines of light on the near side of the head.
  const features: [readonly Point[], number][] = [[EAR, 0.48], [EYE, 0.18], [BROW, 0.2], [MOUTH, 0.14]];
  for (const [points, share] of features) {
    const curve = smoothCurve(points, 10);
    for (const p of alongCurve(curve, Math.round(counts.features * share), rng, 0.006)) {
      put(p.x, p.y, depthAt(p.y, distanceToCurve(p.x, p.y, coarse)) + 0.01, p.t, 1, KIND.feature);
    }
  }

  // The seeds. Seed n sits at angle n·φ and radius ∝ √n — Vogel's model of a
  // sunflower head. The shader turns the whole head slowly about its centre.
  for (let n = 0; n < counts.seeds; n += 1) {
    const share = (n + 0.5) / counts.seeds;
    put(MIND.radius * Math.sqrt(share), n * GOLDEN_ANGLE, 0, share, 1, KIND.seed);
  }

  // Thoughts rising out of the crown, each on its own slow loop: a sideways sway, a phase, and a speed.
  for (let k = 0; k < counts.rising; k += 1) {
    put((rng() - 0.5) * 0.9, rng() * Math.PI * 2, 0.6 + rng() * 0.8, rng(), 1, KIND.rising);
  }

  // Dust stores a direction and a radius instead of a position. It also takes
  // up any share the strands or the silhouette left unused, so the count is exact.
  while (index < total) put(rng() * Math.PI * 2, Math.acos(2 * rng() - 1), 2.9 + rng() * 2.4, 0, 1, KIND.dust);

  return { position, meta, count: total };
}

/** Where a seed of the thought sits, given its stored radius and angle and the turn of the flower. */
export function seedPoint(radius: number, angle: number, turn = 0): [number, number, number] {
  const a = angle + turn;
  // The disc faces the viewer, tipped back a little, so it reads as a flower and not a line.
  const v = radius * Math.sin(a);
  return [MIND.x + radius * Math.cos(a), MIND.y + v * 0.9, MIND.z + v * 0.42];
}

/** Where a rising thought is, `cycle` of the way (0–1) through its climb. */
export function risingPoint(sway: number, phase: number, cycle: number): [number, number, number] {
  const lift = cycle * 1.5;
  return [MIND.x + sway * (0.4 + cycle) + 0.12 * Math.sin(phase + cycle * 5), MIND.y + 0.45 + lift, MIND.z + 0.1 * Math.cos(phase + cycle * 4)];
}
