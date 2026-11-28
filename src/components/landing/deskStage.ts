/**
 * The desk, as both halves of the page see it.
 *
 * The desk is drawn by the DOM: a plane of real elements turned in CSS 3D (the
 * scratch sheet is the real canvas, the index card the real date picker). The
 * WebGL stage draws on top of it: a pencil whose tip rides the triangle as it
 * draws itself, the thread lying on the sheet, a cone of lamplight. For those
 * to land exactly on the paper, both sides work the desk out from the same
 * numbers: this file holds the pose (a pure function of the scroll and of how
 * flat the sheet is), the CSS transforms built from it, and the same
 * transforms as arithmetic, so the stage can follow a point of the sheet to
 * the screen without asking the browser for any layout.
 *
 * It also holds the triangle the sheet draws for itself, and the projective
 * map that turns a pointer on the tilted sheet back into a point on the paper.
 */

import type { ScratchStroke, ScratchTool } from '../../domain/scratch';

// ---------------------------------------------------------------------------
// The pose
// ---------------------------------------------------------------------------

/** The stretch of scroll over which the desk settles from a steeper lean, as the stage arrives. */
export const DESK_SETTLE_EDGES = ['start 0.98', 'start 0.42'] as const;
/** Published values (readStageValue) the stage reads: how flat the sheet is, how far the triangle is drawn, and the stage's arrival. */
export const DESK_FLAT_KEY = 'desk-flat';
export const DESK_DEMO_KEY = 'desk-demo';
export const DESK_ARRIVAL_KEY = 'desk-arrival';
/** Below this width the desk leans less: a phone is held closer and flatter. */
export const DESK_NARROW = 720;
/** How far the sheet is lifted toward the reader when it turns flat to be drawn on (px). */
export const SHEET_LIFT = 26;

export interface DeskPose {
  /** The desk leaning back (deg, CSS rotateX) and the objects turned on it (deg, CSS rotateZ). */
  tiltX: number;
  tiltZ: number;
  /** Still sinking into place (px down). */
  rise: number;
  /** The CSS perspective of the desk (px). */
  perspective: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The desk's pose for a settle progress (0 arriving, 1 in place). */
export function deskPose(settle: number, narrow: boolean): DeskPose {
  const eased = 1 - (1 - clamp01(settle)) ** 3;
  const rest = narrow ? { x: 12, z: -2.5 } : { x: 25, z: -5 };
  return {
    tiltX: rest.x + (1 - eased) * (narrow ? 10 : 16),
    tiltZ: rest.z - (1 - eased) * 4,
    rise: (1 - eased) * (narrow ? 34 : 64),
    perspective: narrow ? 1100 : 1600,
  };
}

const n = (value: number) => Math.round(value * 1000) / 1000;

/** The desk plane's CSS transform. */
export function planeTransform(pose: DeskPose): string {
  return `translate3d(0px, ${n(pose.rise)}px, 0px) rotateX(${n(pose.tiltX)}deg) rotateZ(${n(pose.tiltZ)}deg)`;
}

/** The sheet's CSS transform: at `flat` 1 it undoes the desk's turn and faces the reader, lifted a little. */
export function sheetTransform(pose: DeskPose, flat: number): string {
  return `translate3d(0px, 0px, ${n(SHEET_LIFT * flat)}px) rotateZ(${n(-pose.tiltZ * flat)}deg) rotateX(${n(-pose.tiltX * flat)}deg)`;
}

// ---------------------------------------------------------------------------
// The same transforms as arithmetic
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;

/** CSS rotateX (y down, z toward the reader). */
export function rotateX([x, y, z]: Vec3, degrees: number): Vec3 {
  const c = Math.cos(degrees * RAD);
  const s = Math.sin(degrees * RAD);
  return [x, y * c - z * s, y * s + z * c];
}

/** CSS rotateZ (clockwise on screen for positive angles, since y is down). */
export function rotateZ([x, y, z]: Vec3, degrees: number): Vec3 {
  const c = Math.cos(degrees * RAD);
  const s = Math.sin(degrees * RAD);
  return [x * c - y * s, x * s + y * c, z];
}

/** Where the desk's layout puts its two centres of rotation (page px, before any transform). */
export interface DeskLayout {
  /** The plane's centre, which is also the perspective origin. */
  origin: [number, number];
  /** The sheet's centre: it turns flat about it. */
  sheet: [number, number];
}

/**
 * A point of the sheet (page px, as laid out before any transform) in the
 * desk's 3D space: px from the perspective origin, y down, z toward the reader.
 */
export function sheetPoint(layout: DeskLayout, pose: DeskPose, flat: number, x: number, y: number): Vec3 {
  // The sheet's own transform about its centre: translateZ(lift) rotateZ(-Z f) rotateX(-X f).
  let p: Vec3 = [x - layout.sheet[0], y - layout.sheet[1], 0];
  p = rotateX(p, -pose.tiltX * flat);
  p = rotateZ(p, -pose.tiltZ * flat);
  return planePoint(layout, pose, p[0] + layout.sheet[0], p[1] + layout.sheet[1], p[2] + SHEET_LIFT * flat);
}

/** A point of the desk plane (page px as laid out, with a height z above it) in the desk's 3D space. */
export function planePoint(layout: DeskLayout, pose: DeskPose, x: number, y: number, z = 0): Vec3 {
  // translate3d(0, rise, 0) rotateX(X) rotateZ(Z) about the plane's centre.
  let p: Vec3 = [x - layout.origin[0], y - layout.origin[1], z];
  p = rotateZ(p, pose.tiltZ);
  p = rotateX(p, pose.tiltX);
  return [p[0], p[1] + pose.rise, p[2]];
}

/** A direction in the sheet's own frame, turned the way the sheet is (no translation). */
export function sheetDirection(pose: DeskPose, flat: number, v: Vec3): Vec3 {
  let p = rotateX(v, -pose.tiltX * flat);
  p = rotateZ(p, -pose.tiltZ * flat);
  p = rotateZ(p, pose.tiltZ);
  return rotateX(p, pose.tiltX);
}

/** A point in the desk's 3D space, projected by the CSS perspective: page px (before the stage's own transform). */
export function projectDesk(layout: DeskLayout, pose: DeskPose, [x, y, z]: Vec3): [number, number] {
  const k = pose.perspective / Math.max(1, pose.perspective - z);
  return [layout.origin[0] + x * k, layout.origin[1] + y * k];
}

// ---------------------------------------------------------------------------
// A pointer on the tilted sheet, back to a point of the paper
// ---------------------------------------------------------------------------

export type Quad = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];

/**
 * The projective map from the unit square to a quad (corners in the order
 * (0,0), (1,0), (1,1), (0,1)), as a 3x3 matrix in row order. A plane under a
 * perspective is exactly such a map, so this is exact for the turned sheet.
 */
export function squareToQuad(quad: Quad): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const det = dx1 * dy2 - dx2 * dy1 || 1e-9;
    g = (sx * dy2 - dx2 * sy) / det;
    h = (dx1 * sy - sx * dy1) / det;
  }
  return [
    x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
    g, h, 1,
  ];
}

/** Where a point of the screen falls on the unit square, under the map squareToQuad gave. */
export function quadToSquare(map: number[], x: number, y: number): [number, number] {
  const [a, b, c, d, e, f, g, h, i] = map;
  // The inverse by cofactors (the scale of the inverse cancels in the division).
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
  const D = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  const w = G * x + H * y + I || 1e-9;
  return [(A * x + B * y + C) / w, (D * x + E * y + F) / w];
}

// ---------------------------------------------------------------------------
// The triangle the sheet draws for itself
// ---------------------------------------------------------------------------

/** A line from a to b with a hand's slight wander. The wobble is a fixed function of position, so it is the same every visit. */
function handLine(tool: ScratchTool, ax: number, ay: number, bx: number, by: number, steps = 26): ScratchStroke {
  const points: number[] = [];
  const nx = -(by - ay), ny = bx - ax;
  const length = Math.hypot(nx, ny) || 1;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const wobble = Math.sin(t * 9.4 + ax * 31) * 0.0022 * Math.sin(t * Math.PI);
    points.push(ax + (bx - ax) * t + (nx / length) * wobble, ay + (by - ay) * t + (ny / length) * wobble);
  }
  return { tool, points };
}

/* A 5-12-13 triangle, its altitude to the hypotenuse, the right-angle marks, and one side picked out.
   Coordinates are fractions of the sheet's width, both ways, as the scratch paper stores them. */
const BASE = 0.64, RISE = BASE * 5 / 12;
export const TRIANGLE = { A: [0.16, 0.56], B: [0.16 + BASE, 0.56], C: [0.16, 0.56 - RISE] } as const;
const { A, B, C } = TRIANGLE;
/* Where the altitude from the right angle meets the hypotenuse. */
const ALONG = RISE ** 2 / (BASE ** 2 + RISE ** 2);
export const FOOT = [C[0] + BASE * ALONG, C[1] + RISE * ALONG] as const;

export const DEMO: readonly ScratchStroke[] = [
  handLine('pen', A[0], A[1], B[0], B[1], 34),
  handLine('pen', B[0], B[1], C[0], C[1], 36),
  handLine('pen', C[0], C[1], A[0], A[1], 20),
  handLine('accent', A[0], A[1], FOOT[0], FOOT[1], 18),
  handLine('accent', A[0] + 0.03, A[1], A[0] + 0.03, A[1] - 0.03, 5),
  handLine('accent', A[0] + 0.03, A[1] - 0.03, A[0], A[1] - 0.03, 5),
  handLine('mark', A[0] + 0.01, A[1] + 0.035, B[0] - 0.01, B[1] + 0.035, 22),
];
export const DEMO_POINTS = DEMO.reduce((total, stroke) => total + stroke.points.length / 2, 0);

/** The first `count` points of the demo, stroke by stroke. */
export function demoUpTo(count: number): ScratchStroke[] {
  const shown: ScratchStroke[] = [];
  let left = Math.floor(count);
  for (const stroke of DEMO) {
    if (left <= 0) break;
    const take = Math.min(left, stroke.points.length / 2);
    shown.push({ tool: stroke.tool, points: stroke.points.slice(0, take * 2) });
    left -= take;
  }
  return shown;
}

/**
 * Where the pencil is when `count` points of the demo are drawn (fractions of
 * the sheet's width), between points as well as on them, and how far it is
 * through the stroke it is on: a pencil lifts between strokes.
 */
export function demoPoint(count: number): { x: number; y: number; stroke: number; through: number } {
  let left = Math.max(0, Math.min(DEMO_POINTS, count));
  for (let index = 0; index < DEMO.length; index += 1) {
    const points = DEMO[index].points;
    const length = points.length / 2;
    if (left <= length || index === DEMO.length - 1) {
      const at = Math.max(0, Math.min(length - 1, left - 1));
      const i = Math.floor(at);
      const j = Math.min(length - 1, i + 1);
      const f = at - i;
      return {
        x: points[i * 2] + (points[j * 2] - points[i * 2]) * f,
        y: points[i * 2 + 1] + (points[j * 2 + 1] - points[i * 2 + 1]) * f,
        stroke: index,
        through: length > 1 ? at / (length - 1) : 1,
      };
    }
    left -= length;
  }
  return { x: A[0], y: A[1], stroke: 0, through: 0 };
}

/** The demo's progress (0 to 1) after `elapsed` ms: a short wait, then eased like a hand that slows down at the end. */
export function demoProgress(elapsed: number): number {
  const t = Math.min(1, (elapsed - 350) / 2600);
  return t <= 0 ? 0 : 1 - (1 - t) ** 2;
}

/** The figure the thread lies along on the sheet: round the triangle and down its altitude, as the pencil goes. */
export const THREAD_FIGURE: readonly (readonly [number, number])[] = [A, B, C, A, FOOT];
