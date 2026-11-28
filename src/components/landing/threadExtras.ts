/**
 * What the stage draws besides the thread: each chapter's own meshes, made
 * procedurally in code (no downloaded assets). Every extra is a small module
 * that is handed the scenes it belongs to and updates itself each frame.
 */

import { createEngineExtra } from './glEngine';
import { createPaperEdge } from './glPaper';
import type { Extra } from './threadTypes';
import type { createScenes } from './threadScenes';

export function createExtras(scenes: ReturnType<typeof createScenes>, style: CSSStyleDeclaration, still: boolean): Extra[] {
  return [
    // The idea's sheet, sliding up over the hero.
    createPaperEdge(frame => scenes.hero.sheetEdge(frame), 1, style, 34),
    createEngineExtra(scenes.engine, style, still),
  ];
}
