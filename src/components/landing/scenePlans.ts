/**
 * Three sheets: the thread becomes the pearl light tube round the Pro card's edge.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class PlansScene implements ThreadScene {
  id = 'plans';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function plansLeg(_self: PlansScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createPlansExtras(_self: PlansScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
