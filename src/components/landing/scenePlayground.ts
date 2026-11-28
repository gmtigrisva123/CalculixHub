/**
 * The chord problem: the engine curve's peak bends round into a circle drawn in light exactly beneath the SVG circle, then fades as the SVG draws itself in.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class PlaygroundScene implements ThreadScene {
  id = 'playground';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function playgroundLeg(_self: PlaygroundScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createPlaygroundExtras(_self: PlaygroundScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
