/**
 * The chalkboard: the thread shatters into chalk dust that settles onto the board; extruded chalk glyphs for the four rooms.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class TopicsScene implements ThreadScene {
  id = 'topics';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function topicsLeg(_self: TopicsScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createTopicsExtras(_self: TopicsScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
