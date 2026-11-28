/**
 * The three plan cards, as both halves of the page see them.
 *
 * The cards lie on one plane in CSS 3D. As the chapter arrives the plane is
 * tipped back, like sheets on a table, and rises to face the reader, a pure
 * function of the scroll. Pro is raised above the plane in z, and scaled back
 * by exactly the perspective's enlargement, so once the plane faces the reader
 * Pro is drawn at its own size, its text crisp; while the plane is tipped the
 * raise shows as Pro floating above the other two. The WebGL stage follows
 * Pro's edge with the same arithmetic (scenePlans.ts).
 */

import { rotateX, type Vec3 } from './deskStage';

/** How far the plane is tipped back as it arrives (deg), over which stretch of scroll it rises, its perspective, and Pro's raise (px). */
export const PLANS_TILT = 16;
export const PLANS_SETTLE_EDGES = ['start 0.98', 'start 0.4'] as const;
export const PLANS_PERSPECTIVE = 1600;
export const PLANS_RAISE = 34;
/** Below this width the cards stack in one column and the plane is not tipped. */
export const PLANS_STACKED = 1020;

/** The plane's tilt (deg) for a settle progress. */
export function plansTilt(settle: number, stacked: boolean): number {
  if (stacked) return 0;
  const eased = 1 - (1 - Math.min(1, Math.max(0, settle))) ** 3;
  return PLANS_TILT * (1 - eased);
}

/**
 * A point of the raised Pro card (px from its centre, y down) on the page, for
 * a plane tipped `tilt` degrees about its centre, which is also the
 * perspective origin. `raise` is Pro's height above the plane (0 when stacked).
 */
export function raisedPoint(centre: [number, number], card: [number, number], tilt: number, raise: number, x: number, y: number): [number, number] {
  const shrink = (PLANS_PERSPECTIVE - raise) / PLANS_PERSPECTIVE;
  const q: Vec3 = [card[0] + x * shrink - centre[0], card[1] + y * shrink - centre[1], raise];
  const [rx, ry, rz] = rotateX(q, tilt);
  const k = PLANS_PERSPECTIVE / (PLANS_PERSPECTIVE - rz);
  return [centre[0] + rx * k, centre[1] + ry * k];
}
