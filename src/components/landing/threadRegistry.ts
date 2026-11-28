/**
 * Every scene the thread passes through, in page order, and the legs that
 * carry it into each one. A scene that is not on the page (its chapter has
 * not mounted, or it decided to let the thread pass) is skipped, and the
 * thread travels straight from the scene before it to the scene after.
 */

import { EngineScene, HeroScene, IdeaScene, createLegs } from './threadScenes';
import { PlaygroundScene, playgroundLeg } from './scenePlayground';
import { TopicsScene, topicsLeg } from './sceneTopics';
import { ArchiveScene, archiveLeg } from './sceneArchive';
import { WorkspaceScene, workspaceLeg } from './sceneWorkspace';
import { DeskScene, deskLeg } from './sceneDesk';
import { PlansScene, plansLeg } from './scenePlans';
import { FaqScene, faqLeg } from './sceneFaq';
import { FinalScene, finalLeg } from './sceneFinal';
import type { Leg, ThreadScene } from './threadTypes';

export function createScenes() {
  const hero = new HeroScene();
  const idea = new IdeaScene();
  const engine = new EngineScene();
  const playground = new PlaygroundScene();
  const topics = new TopicsScene();
  const archive = new ArchiveScene();
  const workspace = new WorkspaceScene();
  const desk = new DeskScene();
  const plans = new PlansScene();
  const faq = new FaqScene();
  const final = new FinalScene();
  const list: ThreadScene[] = [hero, idea, engine, playground, topics, archive, workspace, desk, plans, faq, final];
  const legs = [
    ...createLegs(hero, idea, engine),
    playgroundLeg(playground),
    topicsLeg(topics),
    archiveLeg(archive),
    workspaceLeg(workspace),
    deskLeg(desk),
    plansLeg(plans),
    faqLeg(faq),
    finalLeg(final),
  ].filter((leg): leg is Leg => Boolean(leg));
  return { hero, idea, engine, playground, topics, archive, workspace, desk, plans, faq, final, list, legs };
}

export type Scenes = ReturnType<typeof createScenes>;
