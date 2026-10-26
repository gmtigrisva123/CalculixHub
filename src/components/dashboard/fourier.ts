/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The drawing machine behind the dashboard hero: any closed curve, rebuilt as a
 * chain of circles turning at whole-number speeds.
 *
 * A curve is sampled at evenly spaced points along its length, its discrete
 * Fourier transform gives one circle per frequency, and adding the circles tip
 * to tail redraws the curve. Only the largest circles are kept, so corners come
 * out very slightly rounded -- which is the honest look of a finite sum.
 *
 * Pure geometry, no DOM: the stage draws what this file computes, and the tests
 * check the arithmetic.
 */

import type { Topic } from '../../../shared/types';

export type Point = [number, number];

export interface Term {
  /** Whole turns per drawing; negative frequencies turn clockwise. */
  k: number;
  re: number;
  im: number;
  radius: number;
}

export interface Machine {
  /** The circles, largest first. */
  terms: Term[];
  /** The centre the chain hangs from (the curve's centroid term). */
  origin: Point;
  /** The curve the kept circles draw, sampled evenly in time, scaled to fit a unit circle. */
  path: Point[];
  /** Scale applied to `terms` and `origin` so the drawing fits a unit circle. */
  scale: number;
}

export interface Figure {
  key: string;
  topic: Topic;
  name: string;
  /** One line of mathematics under the name. */
  formula: string;
  /** Builds the closed outline, at any scale and any position. */
  outline: () => Point[];
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

/** Lemniscate of Bernoulli, (x² + y²)² = x² − y². */
export function lemniscate(steps = 1200): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * TAU;
    const d = 1 + Math.sin(t) ** 2;
    return [Math.cos(t) / d, (Math.sin(t) * Math.cos(t)) / d] as Point;
  });
}

/**
 * Reuleaux triangle: three arcs, each centred on the opposite corner of an
 * equilateral triangle, with the side as radius.
 */
export function reuleaux(stepsPerArc = 400): Point[] {
  const corners: Point[] = [0, 1, 2].map((i) => {
    const angle = Math.PI / 2 + (i * TAU) / 3;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const side = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
  const points: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const centre = corners[i];
    const from = corners[(i + 1) % 3];
    const to = corners[(i + 2) % 3];
    const start = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
    let sweep = Math.atan2(to[1] - centre[1], to[0] - centre[0]) - start;
    if (sweep < 0) sweep += TAU;
    for (let s = 0; s < stepsPerArc; s++) {
      const angle = start + (sweep * s) / stepsPerArc;
      points.push([centre[0] + Math.cos(angle) * side, centre[1] + Math.sin(angle) * side]);
    }
  }
  return points;
}

/** The Koch snowflake after `depth` steps: 3 × 4^depth sides, every bump pointing outwards. */
export function koch(depth = 3): Point[] {
  let points: Point[] = [0, 1, 2].map((i) => {
    const angle = Math.PI / 2 + (i * TAU) / 3;
    return [Math.cos(angle), Math.sin(angle)];
  });
  for (let level = 0; level < depth; level++) {
    const next: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      const dx = (bx - ax) / 3;
      const dy = (by - ay) / 3;
      // Counter-clockwise outline: outwards is to the right of travel, a -60° turn.
      const cos = Math.cos(-Math.PI / 3);
      const sin = Math.sin(-Math.PI / 3);
      next.push(
        [ax, ay],
        [ax + dx, ay + dy],
        [ax + dx + dx * cos - dy * sin, ay + dy + dx * sin + dy * cos],
        [ax + 2 * dx, ay + 2 * dy],
      );
    }
    points = next;
  }
  return points;
}

/** The star polygon {n/step}: n points on a circle, each joined to the one `step` places on. */
export function starPolygon(n: number, step: number): Point[] {
  const order: number[] = [];
  let index = 0;
  do {
    order.push(index);
    index = (index + step) % n;
  } while (index !== 0 && order.length <= n);
  return order.map((i) => {
    const angle = Math.PI / 2 + (i * TAU) / n;
    return [Math.cos(angle), Math.sin(angle)] as Point;
  });
}

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** One curve per domain, in the order the topics are always listed. */
export const FIGURES: Figure[] = [
  {
    key: 'lemniscate',
    topic: 'Algebra',
    name: 'The lemniscate of Bernoulli',
    formula: '(x² + y²)² = x² − y²',
    outline: () => lemniscate(),
  },
  {
    key: 'reuleaux',
    topic: 'Geometry',
    name: 'The Reuleaux triangle',
    formula: 'The same width in every direction',
    outline: () => reuleaux(),
  },
  {
    key: 'koch',
    topic: 'Combinatorics',
    name: 'The Koch snowflake',
    formula: '3 × 4³ = 192 sides',
    outline: () => koch(3),
  },
  {
    key: 'heptagram',
    topic: 'Number Theory',
    name: 'The heptagram {7/3}',
    formula: 'Closes in one pass, since gcd(7, 3) = 1',
    outline: () => starPolygon(7, 3),
  },
];

// ---------------------------------------------------------------------------
// Sampling and the transform
// ---------------------------------------------------------------------------

/** `count` points spaced evenly along a closed polyline, so the pen keeps a steady speed. */
export function resample(points: Point[], count: number): Point[] {
  const lengths = [0];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    lengths.push(lengths[i] + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[points.length];
  const out: Point[] = [];
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (segment < points.length - 1 && lengths[segment + 1] < target) segment++;
    const span = lengths[segment + 1] - lengths[segment] || 1;
    const t = (target - lengths[segment]) / span;
    const [ax, ay] = points[segment];
    const [bx, by] = points[(segment + 1) % points.length];
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

/** The discrete Fourier transform of a closed curve read as complex numbers x + iy. */
export function dft(points: Point[]): Term[] {
  const n = points.length;
  const cos = new Float64Array(n);
  const sin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    cos[i] = Math.cos((TAU * i) / n);
    sin[i] = Math.sin((TAU * i) / n);
  }
  const terms: Term[] = [];
  const low = -Math.floor(n / 2);
  for (let k = low; k < low + n; k++) {
    let re = 0;
    let im = 0;
    const step = ((k % n) + n) % n;
    let phase = 0;
    for (let j = 0; j < n; j++) {
      const [x, y] = points[j];
      // (x + iy) · e^(−iθ)
      re += x * cos[phase] + y * sin[phase];
      im += y * cos[phase] - x * sin[phase];
      phase += step;
      if (phase >= n) phase -= n;
    }
    re /= n;
    im /= n;
    terms.push({ k, re, im, radius: Math.hypot(re, im) });
  }
  return terms;
}

/** Where the tip of a chain of circles is at time `t` (0 to 1 is one full drawing). */
export function tipAt(terms: Term[], origin: Point, t: number): Point {
  let x = origin[0];
  let y = origin[1];
  for (const term of terms) {
    const angle = TAU * term.k * t;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    x += term.re * c - term.im * s;
    y += term.re * s + term.im * c;
  }
  return [x, y];
}

/**
 * Builds the machine for one figure.
 *
 * The figure is centred and sized before the transform, so every machine hangs
 * from the middle of the stage and fills the same circle.
 */
export function buildMachine(outline: Point[], { samples = 512, circles = 64, pathSteps = 720 } = {}): Machine {
  const even = resample(outline, samples);
  const terms = dft(even);
  const zero = terms.find((term) => term.k === 0);
  const origin: Point = zero ? [zero.re, zero.im] : [0, 0];
  const kept = terms
    .filter((term) => term.k !== 0)
    .sort((a, b) => b.radius - a.radius)
    .slice(0, circles);
  const raw = Array.from({ length: pathSteps }, (_, i) => tipAt(kept, origin, i / pathSteps));
  const reach = Math.max(...raw.map(([x, y]) => Math.hypot(x - origin[0], y - origin[1]))) || 1;
  const scale = 1 / reach;
  return {
    terms: kept.map((term) => ({ ...term, re: term.re * scale, im: term.im * scale, radius: term.radius * scale })),
    origin: [0, 0],
    path: raw.map(([x, y]) => [(x - origin[0]) * scale, (y - origin[1]) * scale] as Point),
    scale,
  };
}

const machines = new Map<string, Machine>();

/** Builds each figure's machine once per session; tab switches reuse it. */
export function machineFor(figure: Figure): Machine {
  let machine = machines.get(figure.key);
  if (!machine) {
    machine = buildMachine(figure.outline());
    machines.set(figure.key, machine);
  }
  return machine;
}
