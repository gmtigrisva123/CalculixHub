/**
 * The staircase: four exam stacks climbing in difficulty; the thread runs along the stair edges.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class ArchiveScene implements ThreadScene {
  id = 'archive';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function archiveLeg(_self: ArchiveScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createArchiveExtras(_self: ArchiveScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
