/**
 * The pile: four cards dealt onto a pile; the thread waits beside it.
 *
 * A stub until the scene is built: not present, so the thread passes it by.
 */

import { resetSlot } from './threadKit';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export class WorkspaceScene implements ThreadScene {
  id = 'workspace';
  measure() {}
  present() { return false; }
  slot(_frame: StageFrame, out: Slot) { resetSlot(out); }
}

/** How the thread arrives in this scene from wherever it was. */
export function workspaceLeg(_self: WorkspaceScene): Leg | null {
  return null;
}

/** What this scene draws besides the thread. */
export function createWorkspaceExtras(_self: WorkspaceScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
