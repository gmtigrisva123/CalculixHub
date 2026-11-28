/**
 * Small tools every stage scene shares: where a pinned element is, how to
 * place a shape on screen, and a clean slot to start each frame from.
 *
 * World space on the stage is CSS pixels measured from the centre of the
 * screen, y up and z toward the viewer. The camera stands where a 30° lens
 * sees exactly the viewport at z = 0, so a point placed at (x, y) on screen
 * with z = 0 lands on that pixel, and anything nearer or farther is drawn in
 * true perspective around it.
 */

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Box } from './stageLayout';
import { SHAPE } from './threadShaders';
import type { Slot, StageFrame } from './threadTypes';

export const EMPTY_BOX: Box = { top: 0, left: 0, width: 0, height: 0 };
export const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

/** The stage camera's field of view, in degrees. */
export const STAGE_FOV = 30;

/** How far the camera stands from the screen plane, for a canvas `height` CSS px tall. */
export const cameraDistance = (height: number) => height / 2 / Math.tan((STAGE_FOV * Math.PI) / 360);

/** Where a `position: sticky; top: 0` element sits on screen, from its static box and its container's. */
export function stickyTop(element: Box, container: Box, y: number, top = 0): number {
  return Math.min(Math.max(element.top - y, top), container.top + container.height - element.height - y);
}

/** The page's stage radius, read from its token once per measure. */
export function stageRadius(): number {
  const root = query('.lx');
  if (!root) return 14;
  const probe = Number.parseFloat(getComputedStyle(root).getPropertyValue('--lx-stage-r'));
  // clamp(10px, 1.1vw, 16px): resolve the vw term ourselves when the token is not a plain length.
  return Number.isFinite(probe) && probe > 0 ? probe : Math.min(16, Math.max(10, window.innerWidth * 0.011));
}

const position = new Vector3();
const quaternion = new Quaternion();
const scaling = new Vector3();
const euler = new Euler();

/** Place a shape: its origin at screen point (sx, sy), scaled, then turned. */
export function place(out: Matrix4, frame: StageFrame, sx: number, sy: number, scale = 1, depth = scale, turn?: [number, number, number], z = 0): Matrix4 {
  position.set(sx - frame.cw / 2, frame.ch / 2 - sy, z);
  if (turn) quaternion.setFromEuler(euler.set(turn[0], turn[1], turn[2]));
  else quaternion.identity();
  scaling.set(scale, scale, depth);
  return out.compose(position, quaternion, scaling);
}

export function resetSlot(slot: Slot): void {
  slot.shape = SHAPE.none;
  slot.matrix.identity();
  for (const p of slot.p) p.set(0, 0, 0, 0);
  slot.look.set(2, 1, 1, 0);
  slot.clip.set(0, 0, 0, 0);
  slot.shade.set(0, 2, 0, 0);
  for (const o of slot.occ) o.set(0, 0, 0, 0);
  slot.occR.set(0, 0, 0, 0);
  slot.data = null;
  slot.flowing = false;
  slot.pointer = 0;
  slot.pointerRadius = 150;
}

/** One step of the page's `follow` spring (stiffness 170, damping 26, mass 0.5). */
export function follow(state: { x: number; v: number }, target: number, dt: number) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    const acceleration = (-170 * (state.x - target) - 26 * state.v) / 0.5;
    state.v += acceleration * h;
    state.x += state.v * h;
  }
}


/** A world point (x, y, z), on screen in CSS px. */
export function projectToScreen(frame: StageFrame, x: number, y: number, z = 0): [number, number] {
  const distance = cameraDistance(frame.ch);
  const f = distance / (distance - z);
  return [frame.cw / 2 + x * f, frame.ch / 2 - y * f];
}

/** A screen point (CSS px) on the plane z = 0, in world space. */
export const toWorld = (frame: StageFrame, sx: number, sy: number): [number, number] => [sx - frame.cw / 2, frame.ch / 2 - sy];
