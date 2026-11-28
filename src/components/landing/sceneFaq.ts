/**
 * Questions: the thread rests along the list while the heading stays put.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class FaqScene implements ThreadScene {
  id = 'faq';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function faqLeg(_self: FaqScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createFaqExtras(_self: FaqScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
