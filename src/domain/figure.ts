/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Every learner has a figure.
 *
 * Someone who has not uploaded a photo is not a grey silhouette here: they are
 * a curve. The figure is worked out from their id alone, so it is the same on
 * every screen and every device, costs no request and no storage, and two
 * people in one thread can be told apart at eighteen pixels.
 *
 * Four families, each a curve a contest student will meet sooner or later:
 * roses (r = cos kθ), star polygons {n/k}, Lissajous figures, and
 * hypotrochoids (the spirograph). Pure and deterministic: no React, no DOM.
 */

export interface Figure {
  /** An SVG path in a 100 by 100 box, centred, with room for the stroke. */
  path: string;
  /** What the curve is, for a tooltip: "Rose curve, 5 petals", "Star polygon {7/3}". */
  name: string;
  /** The same, as it reads inside a sentence: "a rose curve with 5 petals". */
  phrase: string;
  /** The ground it is drawn on. */
  ground: string;
  /** The line it is drawn in. */
  ink: string;
}

/** Deep grounds with a pale line, like the app's night stages. Fixed in both themes, as a photo would be. */
const PALETTES: ReadonlyArray<readonly [ground: string, ink: string]> = [
  ['#17333b', '#9fd3cf'],
  ['#1d2b45', '#a9c4f0'],
  ['#33233f', '#d5b4e8'],
  ['#1b3528', '#a8d8b0'],
  ['#3b2a1c', '#ecc98f'],
  ['#401f26', '#f0b3b0'],
  ['#2a3138', '#c9d4dc'],
  ['#33341c', '#dadd9a'],
];

type Point = readonly [number, number];

const TAU = Math.PI * 2;
const R = 38;

/** FNV-1a, 32 bit: small, fast, and spreads similar ids well apart. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function toPath(points: Point[], close = true): string {
  const d = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${(50 + x).toFixed(1)} ${(50 + y).toFixed(1)}`).join('');
  return close ? `${d}Z` : d;
}

function sample(turns: number, steps: number, at: (t: number) => Point): Point[] {
  const points: Point[] = [];
  for (let step = 0; step < steps; step++) points.push(at((step / steps) * turns * TAU));
  return points;
}

// r = cos(n/d · θ): n petals when n/d is an odd integer, 2n when even, and a woven rosette when it is a fraction.
const ROSES: ReadonlyArray<readonly [n: number, d: number, petals: number | null]> = [
  [2, 1, 4], [3, 1, 3], [4, 1, 8], [5, 1, 5], [7, 1, 7],
  [3, 2, null], [5, 2, null], [4, 3, null], [5, 3, null], [7, 3, null],
];

function rose(n: number, d: number): Point[] {
  // The curve closes after d turns when n·d is odd, and after 2d otherwise.
  const turns = (n * d) % 2 === 1 ? d : 2 * d;
  return sample(turns / 2, 90 * turns, (t) => {
    const r = R * Math.cos((n / d) * t);
    return [r * Math.cos(t), r * Math.sin(t)];
  });
}

const STARS: ReadonlyArray<readonly [n: number, k: number]> = [[5, 2], [7, 2], [7, 3], [8, 3], [9, 2], [9, 4], [10, 3], [11, 4], [12, 5]];

function star(n: number, k: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step < n; step++) {
    const angle = ((step * k) % n) * (TAU / n) - Math.PI / 2;
    points.push([R * Math.cos(angle), R * Math.sin(angle)]);
  }
  return points;
}

const LISSAJOUS: ReadonlyArray<readonly [a: number, b: number]> = [[1, 2], [2, 3], [3, 4], [3, 5], [1, 3], [2, 5], [4, 5]];

function lissajous(a: number, b: number): Point[] {
  const r = R * 0.94;
  return sample(1, 220, (t) => [r * Math.sin(a * t + Math.PI / 2), r * Math.sin(b * t)]);
}

// A point at distance d from the centre of a circle of radius r rolling inside one of radius big.
const TROCHOIDS: ReadonlyArray<readonly [big: number, small: number, arm: number]> = [[5, 3, 5], [7, 2, 3], [8, 3, 6], [5, 2, 4], [7, 3, 6], [9, 4, 7]];

function hypotrochoid(big: number, small: number, arm: number): Point[] {
  const turns = small / gcd(big, small);
  const scale = R / (big - small + arm);
  return sample(turns, 110 * turns, (t) => [
    scale * ((big - small) * Math.cos(t) + arm * Math.cos(((big - small) / small) * t)),
    scale * ((big - small) * Math.sin(t) - arm * Math.sin(((big - small) / small) * t)),
  ]);
}

const cache = new Map<string, Figure>();

/** The figure that belongs to this id. The same seed always draws the same curve. */
export function figureFor(seed: string): Figure {
  const known = cache.get(seed);
  if (known) return known;

  const hash = hashSeed(seed);
  // A second, independent draw for the colour, so figures of one family do not share a ground.
  const [ground, ink] = PALETTES[hashSeed(`${seed}:ground`) % PALETTES.length]!;
  const family = hash % 4;
  const pick = Math.floor(hash / 4);

  let path: string;
  let name: string;
  let phrase: string;
  if (family === 0) {
    const [n, d, petals] = ROSES[pick % ROSES.length]!;
    path = toPath(rose(n, d));
    name = petals ? `Rose curve, ${petals} petals` : `Rose curve, k = ${n}/${d}`;
    phrase = petals ? `a rose curve with ${petals} petals` : `the rose curve r = cos(${n}θ/${d})`;
  } else if (family === 1) {
    const [n, k] = STARS[pick % STARS.length]!;
    path = toPath(star(n, k));
    name = `Star polygon {${n}/${k}}`;
    phrase = `the star polygon {${n}/${k}}`;
  } else if (family === 2) {
    const [a, b] = LISSAJOUS[pick % LISSAJOUS.length]!;
    path = toPath(lissajous(a, b));
    name = `Lissajous figure ${a}:${b}`;
    phrase = `a ${a}:${b} Lissajous figure`;
  } else {
    const [big, small, arm] = TROCHOIDS[pick % TROCHOIDS.length]!;
    path = toPath(hypotrochoid(big, small, arm));
    name = `Hypotrochoid ${big}:${small}`;
    phrase = `a ${big}:${small} hypotrochoid`;
  }

  const figure: Figure = { path, name, phrase, ground, ink };
  if (cache.size > 400) cache.clear();
  cache.set(seed, figure);
  return figure;
}
