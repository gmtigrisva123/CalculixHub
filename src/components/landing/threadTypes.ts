/**
 * The contract between the WebGL stage and the scenes it draws.
 *
 * A scene owns one chapter of the page. It measures its anchors when the
 * layout changes (never while scrolling), and on each frame says where the
 * thread is while that chapter holds it (`slot`), which parts of the screen
 * are ink stages (`ink`), and draws anything of its own (`extras`). A leg
 * joins two neighbouring scenes: over its stretch of scroll the thread is
 * carried from one scene's shape to the next.
 */

import type { Matrix4, Object3D, Vector4 } from 'three';

export interface StageFrame {
  /** Scroll position (CSS px). */
  y: number;
  /** Scroll velocity (px/s). */
  vy: number;
  /** The layout viewport, as the page's CSS sees it. */
  vw: number;
  vh: number;
  /** The canvas, in CSS px (on a phone it is as tall as the largest viewport). */
  cw: number;
  ch: number;
  /** Stage time in seconds: stands still under reduced motion. */
  time: number;
  dt: number;
  now: number;
  /** Reduced motion: nothing moves on its own; changes follow the scroll only. */
  still: boolean;
  /** The pointer, in CSS px on screen, and whether it is a mouse over the page. */
  pointer: { x: number; y: number; active: boolean };
}

/** Where the thread is while one scene holds it. */
export interface Slot {
  shape: number;
  /** Shape space to world space (world = CSS px about the screen centre, y up, z toward the viewer). */
  matrix: Matrix4;
  /** Shape parameters; see threadShaders.ts for each shape's meaning. */
  p: [Vector4, Vector4, Vector4];
  /** Point size (px), brightness, share of particles shown, brightness of the hero's loose dust. */
  look: Vector4;
  /** Clip rectangle on screen (x, y, w, h); w = 0 for none. */
  clip: Vector4;
  /** Clip radius, occluder feather, vignette from the left, vignette from the foot. */
  shade: Vector4;
  /** Up to four rectangles in front of the thread. */
  occ: [Vector4, Vector4, Vector4, Vector4];
  occR: Vector4;
  /** Samples for polyline and curve shapes, written to this slot's row of the data texture. */
  data: Float32Array | null;
  /** True when the slot changes with time (the stage must keep drawing). */
  flowing: boolean;
  /** How strongly this slot answers the pointer (0 to 1), and the reach in px. */
  pointer: number;
  pointerRadius: number;
}

export interface InkRect { x: number; y: number; w: number; h: number; r: number }

export interface Leg {
  from: string;
  to: string;
  /** The stretch of scroll (start, end) over which the thread travels; null while an anchor is missing. */
  window(frame: StageFrame): [number, number] | null;
  /** How spread out the departures are (0 = together), and whether they leave in order along the thread. */
  stagger: number;
  orderByU: number;
  /** Stray (px) and lift toward the viewer (px) at the middle of the flight. */
  swirl: number;
  lift: number;
}

export interface ThreadScene {
  id: string;
  measure(): void;
  present(): boolean;
  slot(frame: StageFrame, out: Slot, row: number): void;
  ink?(frame: StageFrame, out: InkRect[]): void;
}

/** Something a scene draws besides the thread: meshes, lights, paper. */
export interface Extra {
  object: Object3D;
  /** Update for this frame; return true while animating on its own. */
  update(frame: StageFrame, timeline: TimelineState): boolean;
  dispose(): void;
}

export interface TimelineState {
  /** The scene the thread is leaving (or settled in), and the one it is heading for. */
  a: string;
  b: string;
  /** 0 settled in `a`, 1 arrived in `b`. */
  morph: number;
}
