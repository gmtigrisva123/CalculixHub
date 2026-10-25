/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Arena stage's scene model.
 *
 * A stadium seen from the upper tier: four stands, one per domain, banked
 * around a pitch that is a coordinate plane. Everything here is plain geometry
 * in world units -- the outermost row sits at radius 1 -- so the drawing
 * component stays a thin loop that projects and paints.
 *
 * The figures drawn on the pitch are real constructions, step for step: the
 * equilateral triangle is Euclid I.1 with its two circles, the circumcentre is
 * found where two perpendicular bisectors actually meet. Nothing on the stage
 * stands for data. It is a picture of the place, not a feed.
 */

export type Vec = readonly [number, number];
export type Team = 0 | 1 | 2 | 3;

/** One stand per domain, in the order they sit around the bowl. */
export const TEAM_NAMES = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'] as const;

/** What each stand throws into the air when it cheers. */
export const TEAM_GLYPHS: readonly (readonly string[])[] = [
  ['x', 'y', '=', '√', 'x²', 'f(x)', '+', '∑'],
  ['△', '∠', '○', '⊥', 'π', '∥', 'θ'],
  ['n!', '∑', '∏', 'C', '2ⁿ', '{ }', '⋯'],
  ['p', '≡', '∣', 'ℕ', 'φ', 'mod', '%'],
];

/** Pitch radius and the radius of the outermost row, in world units. */
export const PITCH = 0.56;
export const RIM = 1;
/** How steeply the stands rise: height gained per unit of radius. */
export const RAKE = 0.36;
/** Half-width of the aisle between two stands, in radians. */
const AISLE = 0.05;
/** Foreshortening: the near side of the bowl draws a little larger. */
const DEPTH = 0.14;

const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;

export interface Seat {
  x: number;
  y: number;
  h: number;
  theta: number;
  row: number;
  team: Team;
  /** A stable per-seat random in [0, 1), so each light twinkles on its own beat. */
  phase: number;
}

/** Wraps an angle into [-π, π]. */
export const wrapAngle = (angle: number) => {
  const a = (angle + Math.PI) % TAU;
  return (a < 0 ? a + TAU : a) - Math.PI;
};

/** The stand a direction belongs to. Stands are centred on 0, π/2, π, 3π/2. */
export const teamAt = (theta: number): Team => {
  const t = (((theta + Math.PI / 4) % TAU) + TAU) % TAU;
  return Math.min(3, Math.floor(t / QUARTER)) as Team;
};

const aisleDistance = (theta: number) => {
  const t = (((theta - Math.PI / 4) % QUARTER) + QUARTER) % QUARTER;
  return Math.min(t, QUARTER - t);
};

/**
 * Seats, row by row from the pitch outwards, with an aisle between stands.
 *
 * Alternate rows are offset by half a seat the way real seating is, which is
 * what stops the bowl reading as a polar grid. The random source is a seeded
 * LCG so the same stage looks the same on every visit.
 */
export function layoutSeats(rows: number, spacing: number, seed = 7): Seat[] {
  const seats: Seat[] = [];
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let row = 0; row < rows; row++) {
    const r = PITCH + 0.07 + (row / Math.max(1, rows - 1)) * (RIM - PITCH - 0.07);
    const h = (r - PITCH) * RAKE;
    const count = Math.round((TAU * r) / spacing);
    const offset = (row % 2) * 0.5;
    for (let i = 0; i < count; i++) {
      const theta = ((i + offset) / count) * TAU;
      if (aisleDistance(theta) < AISLE) continue;
      seats.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r, h, theta, row, team: teamAt(theta), phase: random() });
    }
  }
  return seats;
}

/** Where the camera is and how the world maps onto the canvas, in CSS pixels. */
export interface View {
  cx: number;
  cy: number;
  /** Pixels per world unit. */
  s: number;
  /** Sine and cosine of the camera's elevation. */
  sin: number;
  cos: number;
  /** Cosine and sine of the bowl's rotation. */
  rc: number;
  rs: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Local scale, larger toward the viewer. */
  k: number;
}

/**
 * Fits the bowl into a canvas, keeping `reserveBottom` pixels clear for the
 * captions that sit over the stage.
 */
export function fitView(width: number, height: number, rotation: number, elevation: number, reserveBottom: number): View {
  const sin = Math.sin(elevation);
  const cos = Math.cos(elevation);
  // How far the bowl reaches above and below its centre, per unit of scale:
  // the far rim rises with the rake, the near rim sinks and is foreshortened.
  const signs = RIM + 0.03;
  const above = (signs * sin + (RIM - PITCH) * RAKE * cos + 0.07 * cos) * (1 - DEPTH * signs) + 0.04;
  const below = (signs * sin - (RIM - PITCH) * RAKE * cos) * (1 + DEPTH * signs) + 0.05;
  const s = Math.max(40, Math.min(width * 0.42, (height - reserveBottom - 24) / (above + below)));
  const top = above * s + 18;
  const bottom = height - reserveBottom - below * s;
  return {
    cx: width / 2,
    cy: top < bottom ? (top + bottom) / 2 : top,
    s,
    sin,
    cos,
    rc: Math.cos(rotation),
    rs: Math.sin(rotation),
  };
}

/** World point (on the pitch plane, raised by `h`) to canvas pixels. Writes into `out`. */
export function project(view: View, x: number, y: number, h: number, out: Projected): Projected {
  const xr = x * view.rc - y * view.rs;
  const yr = x * view.rs + y * view.rc;
  const k = 1 + DEPTH * yr;
  out.x = view.cx + xr * view.s * k;
  out.y = view.cy + (yr * view.sin - h * view.cos) * view.s * k;
  out.k = k;
  return out;
}

/** Canvas pixels back to the pitch plane (h = 0). Used for hit-testing taps. */
export function unproject(view: View, px: number, py: number): { x: number; y: number } {
  let yr = (py - view.cy) / (view.s * view.sin);
  for (let i = 0; i < 3; i++) yr = (py - view.cy) / (view.s * view.sin * (1 + DEPTH * yr));
  const xr = (px - view.cx) / (view.s * (1 + DEPTH * yr));
  return { x: xr * view.rc + yr * view.rs, y: -xr * view.rs + yr * view.rc };
}

// ---------------------------------------------------------------------------
// Constructions
// ---------------------------------------------------------------------------

/** The two points where circles (a, ra) and (b, rb) cross, or null if they do not. */
export function circleIntersections(a: Vec, ra: number, b: Vec, rb: number): [Vec, Vec] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > ra + rb || d < Math.abs(ra - rb)) return null;
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const half = Math.sqrt(Math.max(0, ra * ra - along * along));
  const mx = a[0] + (dx * along) / d;
  const my = a[1] + (dy * along) / d;
  return [
    [mx - (dy * half) / d, my + (dx * half) / d],
    [mx + (dy * half) / d, my - (dx * half) / d],
  ];
}

/** Centre of the circle through three points. */
export function circumcenter(a: Vec, b: Vec, c: Vec): Vec {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  return [
    (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
    (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
  ];
}

const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const along = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const angleOf = (from: Vec, to: Vec) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const distance = (a: Vec, b: Vec) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * What a figure is allowed to do. The stage implements it against the canvas;
 * `p` is always the step's progress in [0, 1], so a step drawn at p = 0.5 is a
 * line half-way along or an arc half-way round.
 */
export interface Pen {
  segment(a: Vec, b: Vec, p: number, guide?: boolean): void;
  arc(centre: Vec, radius: number, from: number, to: number, p: number, guide?: boolean): void;
  point(at: Vec, p: number, label?: string): void;
  area(points: readonly Vec[], p: number): void;
  note(at: Vec, text: string, p: number): void;
  rightAngle(at: Vec, direction: Vec, size: number, p: number): void;
  trace(points: readonly Vec[], p: number): void;
}

export interface Step {
  /** Seconds. */
  d: number;
  draw(pen: Pen, p: number): void;
}

export interface Figure {
  name: string;
  steps: readonly Step[];
}

export const figureLength = (figure: Figure) => figure.steps.reduce((total, step) => total + step.d, 0);

function euclidOne(): Figure {
  const A: Vec = [-0.17, 0.07];
  const B: Vec = [0.17, 0.07];
  const r = distance(A, B);
  const C: Vec = [0, A[1] - (r * Math.sqrt(3)) / 2];
  return {
    name: 'Euclid I.1 · an equilateral triangle',
    steps: [
      { d: 0.45, draw: (pen, p) => { pen.point(A, p, 'A'); pen.point(B, p, 'B'); } },
      { d: 0.5, draw: (pen, p) => pen.segment(A, B, p) },
      { d: 1.05, draw: (pen, p) => pen.arc(A, r, 0, -Math.PI * 2, p, true) },
      { d: 1.05, draw: (pen, p) => pen.arc(B, r, Math.PI, -Math.PI, p, true) },
      { d: 0.35, draw: (pen, p) => pen.point(C, p, 'C') },
      { d: 0.6, draw: (pen, p) => { pen.segment(A, C, p); pen.segment(B, C, p); } },
      { d: 0.45, draw: (pen, p) => pen.area([A, B, C], p) },
    ],
  };
}

function perpendicularBisector(): Figure {
  const A: Vec = [-0.3, 0.12];
  const B: Vec = [0.27, -0.1];
  const r = 0.4;
  const [P, Q] = circleIntersections(A, r, B, r)!;
  const M = mid(A, B);
  const half = Math.acos(distance(A, B) / 2 / r) + 0.28;
  const toB = angleOf(A, B);
  const toA = angleOf(B, A);
  const extend = (from: Vec, to: Vec, by: number): Vec => {
    const d = distance(from, to);
    return [to[0] + ((to[0] - from[0]) / d) * by, to[1] + ((to[1] - from[1]) / d) * by];
  };
  return {
    name: 'The perpendicular bisector, from two arcs',
    steps: [
      { d: 0.35, draw: (pen, p) => { pen.point(A, p, 'A'); pen.point(B, p, 'B'); } },
      { d: 0.5, draw: (pen, p) => pen.segment(A, B, p) },
      { d: 0.75, draw: (pen, p) => pen.arc(A, r, toB - half, toB + half, p, true) },
      { d: 0.75, draw: (pen, p) => pen.arc(B, r, toA - half, toA + half, p, true) },
      { d: 0.3, draw: (pen, p) => { pen.point(P, p, 'P'); pen.point(Q, p, 'Q'); } },
      { d: 0.6, draw: (pen, p) => pen.segment(extend(Q, P, 0.08), extend(P, Q, 0.08), p) },
      { d: 0.4, draw: (pen, p) => { pen.point(M, p, 'M'); pen.rightAngle(M, [B[0] - M[0], B[1] - M[1]], 0.045, p); } },
    ],
  };
}

function circumcircle(): Figure {
  const A: Vec = [-0.25, 0.1];
  const B: Vec = [0.21, 0.15];
  const C: Vec = [0.05, -0.19];
  const O = circumcenter(A, B, C);
  const R = distance(O, A);
  const bisector = (a: Vec, b: Vec): [Vec, Vec] => {
    const m = mid(a, b);
    return [along(O, m, 1.45), along(m, O, 1.35)];
  };
  const [ab0, ab1] = bisector(A, B);
  const [bc0, bc1] = bisector(B, C);
  return {
    name: 'Three points, one circle: the circumcircle',
    steps: [
      { d: 0.45, draw: (pen, p) => { pen.point(A, p, 'A'); pen.point(B, p, 'B'); pen.point(C, p, 'C'); } },
      { d: 0.75, draw: (pen, p) => { pen.segment(A, B, p); pen.segment(B, C, p); pen.segment(C, A, p); } },
      { d: 0.55, draw: (pen, p) => pen.segment(ab0, ab1, p, true) },
      { d: 0.55, draw: (pen, p) => pen.segment(bc0, bc1, p, true) },
      { d: 0.3, draw: (pen, p) => pen.point(O, p, 'O') },
      { d: 1.1, draw: (pen, p) => pen.arc(O, R, angleOf(O, A), angleOf(O, A) - Math.PI * 2, p) },
    ],
  };
}

/**
 * Fibonacci squares 1, 1, 2, 3, 5, 8 and the quarter arcs through them.
 * Laid out in unit squares with y up, then mapped onto the pitch.
 */
function goldenSpiral(): Figure {
  const unit = 0.05;
  const toWorld = (ux: number, uy: number): Vec => [(ux - 3.5) * unit, -(uy + 1) * unit];
  const squares: [number, number, number][] = [[0, 0, 1], [1, 0, 1], [0, 1, 2], [-3, 0, 3], [-3, -5, 5], [2, -5, 8]];
  const arcs: [number, number, number, number][] = [[1, 1, 180, 270], [1, 1, 270, 360], [0, 1, 0, 90], [0, 0, 90, 180], [2, 0, 180, 270], [2, 3, 270, 360]];
  const steps: Step[] = [];
  squares.forEach(([x, y, size], i) => {
    const corners = [toWorld(x, y), toWorld(x + size, y), toWorld(x + size, y + size), toWorld(x, y + size)];
    // Small squares go quickly, so the field is never empty for long.
    steps.push({
      d: 0.16 + size * 0.03,
      draw: (pen, p) => {
        for (let side = 0; side < 4; side++) pen.segment(corners[side], corners[(side + 1) % 4], Math.min(1, Math.max(0, p * 4 - side)), true);
        if (size > 1) pen.note(toWorld(x + size / 2, y + size / 2), String(size), p);
      },
    });
    const [cx, cy, from, to] = arcs[i];
    // Angles are measured with y up; the pitch has y pointing at the viewer.
    steps.push({ d: 0.2 + size * 0.04, draw: (pen, p) => pen.arc(toWorld(cx, cy), size * unit, (-from * Math.PI) / 180, (-to * Math.PI) / 180, p) });
  });
  return { name: 'Fibonacci squares and the golden spiral', steps };
}

function sineFromCircle(): Figure {
  const centre: Vec = [-0.27, 0];
  const r = 0.12;
  const x0 = -0.11;
  const x1 = 0.37;
  const turns = 1.25;
  const samples = 120;
  const wave: Vec[] = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return [x0 + t * (x1 - x0), -r * Math.sin(t * turns * Math.PI * 2)];
  });
  return {
    name: 'A turning point draws the sine wave',
    steps: [
      { d: 0.8, draw: (pen, p) => { pen.point(centre, p); pen.arc(centre, r, 0, -Math.PI * 2, p); } },
      { d: 0.4, draw: (pen, p) => pen.segment([x0 - 0.02, 0], [x1 + 0.03, 0], p, true) },
      {
        d: 3.2,
        draw: (pen, p) => {
          const angle = p * turns * Math.PI * 2;
          const onCircle: Vec = [centre[0] + r * Math.cos(angle), centre[1] - r * Math.sin(angle)];
          const head = wave[Math.round(p * samples)];
          pen.trace(wave, p);
          pen.segment(centre, onCircle, 1, true);
          pen.segment(onCircle, head, 1, true);
          pen.point(onCircle, 1);
          pen.point(head, 1);
        },
      },
    ],
  };
}

/** The pitch's running order. */
export const FIGURES: readonly Figure[] = [euclidOne(), goldenSpiral(), perpendicularBisector(), sineFromCircle(), circumcircle()];
