/**
 * What the stage draws besides the thread: each chapter's own meshes, made
 * procedurally in code (no downloaded assets). Every extra is a small module
 * that is handed the scene it belongs to and updates itself each frame.
 */

import { createEngineExtra } from './glEngine';
import { createPaperEdge } from './glPaper';
import { createPlaygroundExtras } from './scenePlayground';
import { createTopicsExtras } from './sceneTopics';
import { createArchiveExtras } from './sceneArchive';
import { createWorkspaceExtras } from './sceneWorkspace';
import { createDeskExtras } from './sceneDesk';
import { createPlansExtras } from './scenePlans';
import { createFaqExtras } from './sceneFaq';
import { createFinalExtras } from './sceneFinal';
import type { Scenes } from './threadRegistry';
import type { Extra } from './threadTypes';

export function createExtras(scenes: Scenes, style: CSSStyleDeclaration, still: boolean): Extra[] {
  return [
    // The idea's sheet, sliding up over the hero.
    createPaperEdge(frame => scenes.hero.sheetEdge(frame), 1, style, 34),
    createEngineExtra(scenes.engine, style, still),
    ...createPlaygroundExtras(scenes.playground, style, still),
    ...createTopicsExtras(scenes.topics, style, still),
    ...createArchiveExtras(scenes.archive, style, still),
    ...createWorkspaceExtras(scenes.workspace, style, still),
    ...createDeskExtras(scenes.desk, style, still),
    ...createPlansExtras(scenes.plans, style, still),
    ...createFaqExtras(scenes.faq, style, still),
    ...createFinalExtras(scenes.final, style, still),
  ];
}
