/**
 * The line: a pencil line climbing the last stage as a 3D tube, its tip blooming into a tiny Lorenz butterfly; the footer's uncovering curl.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class FinalScene implements ThreadScene {
  id = 'final';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function finalLeg(_self: FinalScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createFinalExtras(_self: FinalScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
