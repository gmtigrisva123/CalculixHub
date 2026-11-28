/**
 * Lamplight: the thread lands on the scratch sheet as the triangle the pencil draws; a pencil and a cone of lamplight.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class DeskScene implements ThreadScene {
  id = 'desk';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function deskLeg(_self: DeskScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createDeskExtras(_self: DeskScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
