/**
 * The archive's staircase, as numbers.
 *
 * Four stacks of past papers stand on one floor, each taller than the last:
 * a staircase of difficulty, not of size. The stacks are CSS 3D, because the
 * sample problem printed on each top sheet has to stay crisp DOM text, and the
 * thread of light runs along their stair edges on the WebGL stage. The two
 * have to agree to the pixel, so everything that moves is a pure function of
 * the track's scroll progress and is written here once: the chapter turns it
 * into CSS transforms, and the stage replays the very same CSS 3D projection
 * in JS to find where the stair edges land on screen. Scrolling back rewinds
 * both exactly.
 *
 * Coordinates follow CSS: x right, y down, z toward the viewer, in CSS px.
 * Rotations use CSS's own matrices (rotateY(+a) turns an element's right edge
 * away from the viewer; rotateX(+a) turns its top edge away), so a transform
 * string built here and the arithmetic below describe the same motion.
 */

import { POLY_SAMPLES, clamp01, lerp, smoothstep, type Point } from './threadShapes';

/** Each bank's step, as a share of the tallest: AMC 12, AIME, USAMO, IMO. */
export const STEP = [0.44, 0.61, 0.8, 1] as const;

export const STAIRS = {
  /** Every stack's turn about its own upright axis (CSS rotateY, degrees). */
  turn: -12,
  /** Where the stack in focus stands: its centre across the stage, its top edge down it (shares of the stage). */
  focusX: 0.5,
  focusY: 0.7,
  /** The camera's height: the perspective origin, as a share of the stage's height (above the tops, so they show). */
  originY: 0.36,
  /**
   * The opening shot, the first share of the runway: the stage arrives showing
   * the whole staircase at once, small, and the camera moves in to the first
   * stack before the climb begins. `fill` is how much of the view's width the
   * staircase takes in that shot, `floor` where its floor stands (shares).
   */
  opening: 0.16,
  overview: { fill: 0.86, floor: 0.88 },
  /** How much the track slows as a stack passes the centre (0 steady, 1 stops dead). */
  dwell: 0.72,
  /** How long the last stack holds at the centre before the pin lets go, in stacks of travel. */
  hold: 0.3,
  /** The lifted top sheet: px it floats above its stack, px it comes toward you, degrees it leans back from upright. */
  rise: 18,
  forward: 56,
  lean: 8,
  /** The sheet is fully up within `near` of the focus and flat beyond `far` (in stacks). */
  near: 0.1,
  far: 0.62,
} as const;

const DEG = Math.PI / 180;

/** The CSS camera for a stage this size: the perspective distance and origin, in the stage's own px. */
export function stairsCamera(width: number, height: number) {
  return {
    perspective: Math.round(Math.min(2200, Math.max(1100, width * 1.25))),
    ox: width * 0.5,
    oy: height * STAIRS.originY,
  };
}
export type StairsCamera = ReturnType<typeof stairsCamera>;

/** Where the reading focus waits during the opening shot: far enough before the first stack that no sheet is up. */
const BEFORE = -STAIRS.far;

/**
 * Which stack is in focus for the track's scroll progress: 0 is the first,
 * 3 the last, fractions in between. Through the opening shot it waits before
 * the first stack and arrives at it as the camera does. Then the track never
 * stops, but it slows as each stack passes the centre, which is where its top
 * sheet is up and can be read; between stacks it travels faster. Monotonic,
 * so the scroll always moves it the same way.
 */
export function stairsFocus(progress: number, count = STEP.length): number {
  const p = clamp01(progress);
  if (p < STAIRS.opening) return lerp(BEFORE, 0, smoothstep(0.4, 1, p / STAIRS.opening));
  const t = ((p - STAIRS.opening) / (1 - STAIRS.opening)) * (count - 1 + STAIRS.hold);
  // Past the last stack the focus holds there: its problem can be read before the stage leaves.
  return Math.min(count - 1, t - (STAIRS.dwell * Math.sin(2 * Math.PI * t)) / (2 * Math.PI));
}

/**
 * The track's progress for a scroll position: 0 as the stage pins, 1 as it
 * lets go. The stage is taller than the screen, so it lets go when the
 * runway's foot reaches the stage's foot, not the screen's; measuring against
 * the stage's own height keeps the whole climb inside the pinned stretch.
 */
export function stairsProgress(runway: { top: number; height: number }, stageHeight: number, y: number): number {
  return clamp01((y - runway.top) / Math.max(1, runway.height - stageHeight));
}

/** How far stack `index`'s top sheet has lifted (0 flat on the stack, 1 standing to face you). */
export function sheetLift(focus: number, index: number): number {
  return smoothstep(STAIRS.far, STAIRS.near, Math.abs(focus - index));
}

/** The count and the format label appear as a stack reaches the centre, and stay once it has passed. */
export function labelIn(focus: number, index: number): number {
  return smoothstep(index - 0.45, index - 0.12, focus);
}

/** True once a stack is arriving at the centre: its count starts counting then (once), as its label fades in. */
export const reached = (focus: number, index: number) => focus >= index - 0.42;

// ---------------------------------------------------------------------------
// The measured stage
// ---------------------------------------------------------------------------

export interface Rect { left: number; top: number; width: number; height: number }

/** The staircase's layout, read from the DOM when the page changes, never while scrolling. */
export interface StairsMeasure {
  /** The pinned stage (the perspective container): its size. It reaches below the screen, down to the floor. */
  pin: { width: number; height: number };
  /** The part of the stage the screen shows while it is pinned (its top, a screen tall): the camera frames this. */
  view: { width: number; height: number };
  /** The track's static box inside the stage, before its transform. */
  track: Rect;
  /** Each stack's static box inside the track (its front face). */
  stacks: Rect[];
  /** How deep each stack is, which is also how tall its top sheet stands. */
  depth: number;
}

/**
 * Where the track is: moved by (x, y) and scaled about its top-left corner,
 * the CSS `translate3d(x, y, 0) scale3d(s, s, s)` with `transform-origin: 0 0 0`.
 */
export interface TrackPose { x: number; y: number; scale: number }

/** The track's CSS transform for a pose. */
export const trackTransform = (pose: TrackPose) => {
  const s = pose.scale.toFixed(4);
  return `translate3d(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px, 0px) scale3d(${s}, ${s}, ${s})`;
};

/** The opening shot: the whole staircase, scaled to fit across the view, standing on a floor near its foot. */
export function overviewPose(m: StairsMeasure): TrackPose {
  const n = m.stacks.length;
  if (!n) return { x: 0, y: 0, scale: 1 };
  const first = m.stacks[0];
  const last = m.stacks[n - 1];
  // The turned stacks show their right sides: allow for the last one's.
  const left = first.left;
  const right = last.left + last.width * 1.3;
  const floor = Math.max(...m.stacks.map(box => box.top + box.height));
  const scale = Math.min(1, (m.view.width * STAIRS.overview.fill) / Math.max(1, right - left));
  return {
    x: m.view.width / 2 - m.track.left - (scale * (left + right)) / 2,
    y: m.view.height * STAIRS.overview.floor - m.track.top - scale * floor,
    scale,
  };
}

/**
 * The track's pose for the scroll progress: through the opening shot every
 * point of the staircase glides from where it stands in the overview to where
 * it stands in the close-up of the first stack; then the close-up travels.
 */
export function trackPose(m: StairsMeasure, progress: number): TrackPose {
  const p = clamp01(progress);
  const close = trackOffset(m, Math.max(0, stairsFocus(p)));
  if (p >= STAIRS.opening) return close;
  const wide = overviewPose(m);
  const e = smoothstep(0, 1, p / STAIRS.opening);
  return { x: lerp(wide.x, close.x, e), y: lerp(wide.y, close.y, e), scale: lerp(wide.scale, close.scale, e) };
}

/** Where the track is moved for a focus at full size: the focused stack's centre at `focusX`, its top edge at `focusY`. */
export function trackOffset(m: StairsMeasure, focus: number): TrackPose {
  const n = m.stacks.length;
  if (!n) return { x: 0, y: 0, scale: 1 };
  const centre = (i: number) => m.stacks[i].left + m.stacks[i].width / 2;
  const pitch = n > 1 ? centre(1) - centre(0) : 0;
  let x: number;
  let top: number;
  if (focus <= 0) {
    // Before the first stack the track carries on at the same pitch; the camera's height holds.
    x = centre(0) + focus * pitch;
    top = m.stacks[0].top;
  } else if (focus >= n - 1) {
    x = centre(n - 1) + (focus - (n - 1)) * pitch;
    top = m.stacks[n - 1].top;
  } else {
    const lo = Math.floor(focus);
    const f = focus - lo;
    x = lerp(centre(lo), centre(lo + 1), f);
    // The camera climbs with the stairs: it is as high as the stack in focus.
    top = lerp(m.stacks[lo].top, m.stacks[lo + 1].top, f);
  }
  return {
    x: m.view.width * STAIRS.focusX - m.track.left - x,
    y: m.view.height * STAIRS.focusY - m.track.top - top,
    scale: 1,
  };
}

/** The lifted sheet's pose for a lift: what the CSS transform and the projection below both use. */
export function sheetPose(lift: number) {
  return {
    rise: 1.5 + STAIRS.rise * lift,
    forward: STAIRS.forward * lift,
    // The stack's turn is undone as the sheet lifts, so it ends square to the viewer and its text stays sharp.
    yaw: -STAIRS.turn * lift,
    pitch: 90 - (90 - STAIRS.lean) * lift,
  };
}

/**
 * The top sheet's CSS transform. Its origin is its bottom edge, the front top
 * edge of the stack: first it turns with the stack, then it floats up and
 * forward, squares to the viewer and stands up on that edge.
 */
export function sheetTransform(lift: number): string {
  const pose = sheetPose(lift);
  return `rotateY(${STAIRS.turn}deg) translate3d(0px, ${(-pose.rise).toFixed(2)}px, ${pose.forward.toFixed(2)}px) rotateY(${pose.yaw.toFixed(3)}deg) rotateX(${pose.pitch.toFixed(3)}deg)`;
}

// ---------------------------------------------------------------------------
// The CSS 3D projection, replayed
// ---------------------------------------------------------------------------

type V3 = [number, number, number];
/** A point on screen (x, y, and a depth the thread ignores): mutable, so a caller can move a path onto the page. */
export type ScreenPoint = [number, number, number];

/** CSS rotateY(a): x' = x cos a + z sin a, z' = −x sin a + z cos a. */
export function rotateY([x, y, z]: V3, degrees: number): V3 {
  const a = degrees * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

/** CSS rotateX(a): y' = y cos a − z sin a, z' = y sin a + z cos a. */
export function rotateX([x, y, z]: V3, degrees: number): V3 {
  const a = degrees * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

/** A point in the stage's 3D space, on the stage's screen plane: the CSS `perspective` divide about its origin. */
export function perspectiveProject(camera: StairsCamera, [x, y, z]: V3): [number, number] {
  const f = camera.perspective / Math.max(1, camera.perspective - z);
  return [camera.ox + (x - camera.ox) * f, camera.oy + (y - camera.oy) * f];
}

/** A point in the track's own coordinates, in the stage's 3D space once the track is posed. */
function posed(m: StairsMeasure, pose: TrackPose, [x, y, z]: V3): V3 {
  return [m.track.left + pose.x + pose.scale * x, m.track.top + pose.y + pose.scale * y, pose.scale * z];
}

/** A point on stack `i`'s front face (x across, y down from its top edge, z toward the viewer), in the stage's 3D space. */
export function stackPoint(m: StairsMeasure, pose: TrackPose, i: number, x: number, y: number, z = 0): V3 {
  const box = m.stacks[i];
  const turned = rotateY([x - box.width / 2, y - box.height / 2, z], STAIRS.turn);
  return posed(m, pose, [box.left + box.width / 2 + turned[0], box.top + box.height / 2 + turned[1], turned[2]]);
}

/** A point on stack `i`'s top sheet (x across, y down from the sheet's top edge), in the stage's 3D space. */
export function sheetPoint(m: StairsMeasure, pose: TrackPose, i: number, lift: number, x: number, y: number): V3 {
  const box = m.stacks[i];
  const sheet = sheetPose(lift);
  // Relative to the sheet's origin, its bottom centre, which sits on the stack's front top edge.
  let p: V3 = [x - box.width / 2, y - m.depth, 0];
  p = rotateX(p, sheet.pitch);
  p = rotateY(p, sheet.yaw);
  p = [p[0], p[1] - sheet.rise, p[2] + sheet.forward];
  p = rotateY(p, STAIRS.turn);
  return posed(m, pose, [box.left + box.width / 2 + p[0], box.top + p[1], p[2]]);
}

/** A point in the track's own plane (unturned), in the stage's 3D space. */
const trackPoint = (m: StairsMeasure, pose: TrackPose, x: number, y: number): V3 => posed(m, pose, [x, y, 0]);

/**
 * The stair edges, on the stage's screen plane: in along the floor, up the
 * first stack's front edge, along its top, across to the next stack and up
 * its edge, and so on to the top of the last, then on to the right.
 */
export function stairEdges(m: StairsMeasure, camera: StairsCamera, offset: TrackPose): ScreenPoint[] {
  const n = m.stacks.length;
  if (!n) return [];
  const pitch = n > 1 ? m.stacks[1].left - m.stacks[0].left : m.stacks[0].width * 1.5;
  const first = m.stacks[0];
  const last = m.stacks[n - 1];
  const out: ScreenPoint[] = [];
  const push = (p: V3) => {
    const [x, y] = perspectiveProject(camera, p);
    out.push([x, y, 0]);
  };
  push(trackPoint(m, offset, first.left - pitch * 0.7, first.top + first.height));
  push(stackPoint(m, offset, 0, 0, first.height));
  for (let i = 0; i < n; i += 1) {
    const box = m.stacks[i];
    // The previous step's height, on this stack's front edge: the riser starts there.
    if (i > 0) push(stackPoint(m, offset, i, 0, m.stacks[i - 1].top - box.top));
    push(stackPoint(m, offset, i, 0, 0));
    push(stackPoint(m, offset, i, box.width, 0));
  }
  // On past the top of the climb and off the screen: the thread carries on to the next chapter.
  push(trackPoint(m, offset, last.left + last.width + Math.max(pitch * 1.6, m.view.width * 0.6), last.top));
  return out;
}

/** The bounding box on the stage's screen plane of stack `i`'s top sheet at a lift. */
export function sheetRect(m: StairsMeasure, camera: StairsCamera, offset: TrackPose, i: number, lift: number): Rect {
  const box = m.stacks[i];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of [[0, 0], [box.width, 0], [0, m.depth], [box.width, m.depth]]) {
    const [sx, sy] = perspectiveProject(camera, sheetPoint(m, offset, i, lift, x, y));
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
  }
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

// ---------------------------------------------------------------------------
// The flat list (narrow screens, reduced motion)
// ---------------------------------------------------------------------------

/**
 * The stair edges when the stacks are laid out flat (a row, or a column on a
 * phone): along each stack's top edge; to a stack on the right, across and up
 * its front edge, as stairs; to one below, down the gutter beside it and back
 * along its top the other way, as a switchback. Boxes are on screen, in px.
 */
export function flatEdges(boxes: Rect[], gutter: number): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  let side: 'left' | 'right' = 'left';
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    const right = box.left + box.width;
    if (i === 0) {
      out.push([box.left - gutter, box.top, 0], [box.left, box.top, 0], [right, box.top, 0]);
      side = 'right';
      continue;
    }
    const previous = boxes[i - 1];
    const beside = box.left >= previous.left + previous.width - 1;
    if (beside) {
      out.push([box.left, previous.top, 0], [box.left, box.top, 0], [right, box.top, 0]);
      side = 'right';
    } else if (side === 'right') {
      const x = Math.max(previous.left + previous.width, right) + gutter;
      out.push([x, previous.top, 0], [x, box.top, 0], [right, box.top, 0], [box.left, box.top, 0]);
      side = 'left';
    } else {
      const x = Math.min(previous.left, box.left) - gutter;
      out.push([x, previous.top, 0], [x, box.top, 0], [box.left, box.top, 0], [right, box.top, 0]);
      side = 'right';
    }
  }
  const end = boxes[boxes.length - 1];
  if (end) out.push(side === 'right' ? [end.left + end.width + gutter, end.top, 0] : [end.left - gutter, end.top, 0]);
  return out;
}

/**
 * The part of a path that can be seen: from where it first enters the box to
 * where it last leaves it, cut at the box's edges. The thread's particles are
 * spread evenly along whatever path it is given, so handing it only the stairs
 * on screen (and a margin) keeps the line as dense as a short one, however
 * long the staircase is. A path that never enters the box is returned whole.
 */
export function clipToView(points: readonly ScreenPoint[], x0: number, y0: number, x1: number, y1: number): ScreenPoint[] {
  let first = -1;
  let firstT = 0;
  let last = -1;
  let lastT = 1;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    // Liang–Barsky: the share of the segment a→b inside the box.
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dy = by - ay;
    const edges: [number, number][] = [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]];
    let inside = true;
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) { inside = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { inside = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { inside = false; break; } if (r < t1) t1 = r; }
    }
    if (!inside) continue;
    if (first === -1) { first = i; firstT = t0; }
    last = i;
    lastT = t1;
  }
  if (first === -1) return points.slice();
  const at = (i: number, t: number): ScreenPoint => {
    const a = points[i - 1];
    const b = points[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  const out: ScreenPoint[] = [at(first, firstT)];
  for (let i = first; i < last; i += 1) out.push(points[i]);
  out.push(at(last, lastT));
  return out;
}

/**
 * A polyline resampled into `out` at POLY_SAMPLES points evenly spaced along
 * its length (x, y, z, share of the length), the layout the thread's POLY
 * shape reads. Like threadShapes' resampleByLength, but into a buffer the
 * stage keeps, because the stairs are re-projected on every scrolled frame.
 */
export function resampleInto(points: readonly Point[], out: Float32Array, count = POLY_SAMPLES): Float32Array {
  if (!points.length) { out.fill(0); return out; }
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  }
  let segment = 1;
  let reachedLength = 0;
  let segmentLength = points.length > 1 ? Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1], points[1][2] - points[0][2]) : 0;
  for (let i = 0; i < count; i += 1) {
    const at = (i / Math.max(1, count - 1)) * total;
    while (segment < points.length - 1 && reachedLength + segmentLength < at) {
      reachedLength += segmentLength;
      segment += 1;
      const a = points[segment - 1];
      const b = points[segment];
      segmentLength = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    const a = points[Math.max(0, segment - 1)];
    const b = points[Math.min(points.length - 1, segment)];
    const f = segmentLength > 0 ? clamp01((at - reachedLength) / segmentLength) : 0;
    out[i * 4] = a[0] + (b[0] - a[0]) * f;
    out[i * 4 + 1] = a[1] + (b[1] - a[1]) * f;
    out[i * 4 + 2] = a[2] + (b[2] - a[2]) * f;
    out[i * 4 + 3] = total > 0 ? at / total : i / Math.max(1, count - 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reading the DOM (on a layout change only)
// ---------------------------------------------------------------------------

/** An element's box relative to an ancestor on its offset chain, ignoring transforms. */
function offsetBox(element: HTMLElement, within: HTMLElement): Rect {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== within) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

/** Measure the staircase inside its pinned stage. Call from a measure callback, never while scrolling. */
export function measureStairs(pin: HTMLElement | null): StairsMeasure | null {
  const track = pin?.querySelector<HTMLElement>('[data-stairs-track]');
  if (!pin || !track) return null;
  const stacks = Array.from(track.querySelectorAll<HTMLElement>('[data-stack]')).map(stack => offsetBox(stack, track));
  const sheet = track.querySelector<HTMLElement>('[data-stack-sheet]');
  const frame = pin.querySelector<HTMLElement>('[data-stairs-view]');
  if (!stacks.length) return null;
  return {
    pin: { width: pin.offsetWidth, height: pin.offsetHeight },
    view: { width: pin.offsetWidth, height: frame?.offsetHeight || Math.min(pin.offsetHeight, window.innerHeight) },
    track: offsetBox(track, pin),
    stacks,
    depth: sheet?.offsetHeight ?? stacks[0].width,
  };
}
