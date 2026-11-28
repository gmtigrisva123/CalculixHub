/**
 * What the stage draws besides the thread: each chapter's own meshes, made
 * procedurally in code (no downloaded assets). Every extra is a small module
 * that is handed the scenes it belongs to and updates itself each frame.
 */

import type { Extra } from './threadTypes';
import type { createScenes } from './threadScenes';

export function createExtras(_scenes: ReturnType<typeof createScenes>, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
