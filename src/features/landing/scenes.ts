/**
 * The scene registry (docs/landing-v2-brief.md §9.4): the eleven scenes of
 * landing v2, in page order, and the stretch of scroll each one is given.
 *
 * Each scene's <section> is in the document from the first render, sized from
 * this table (styles/layout.css), so the page has its full length before any
 * content mounts and the scroll position never jumps.
 *
 * The camera's pose through each scene, `cameraAt(p, aspect)` (§9.9), joins
 * this record in Phase 2, together with the camera.
 */

import { COPY } from './copy';
import type { FormId } from './gl/swarm/forms';

export type SceneId = 'top' | 'how-it-works' | 'try' | 'why' | 'tutor' | 'map'
  | 'archive' | 'arena' | 'plans' | 'faq' | 'begin';

/**
 * How long a scene's stretch of scroll is, in svh: on a desktop or tablet, and
 * on a phone (narrower than 768px, §12.1). 'content' when its content sets it.
 */
export type SceneBudget = { desktop: number; mobile: number } | 'content';

export interface Scene {
  /** Also the id of the scene's <section> and its hash in the URL. */
  id: SceneId;
  /** The short name in the nav and the scene ruler. */
  label: string;
  world: 'night' | 'day';
  budget: SceneBudget;
  /** Whether a sticky stage holds the screen while the scene scrolls past. */
  pinned: boolean;
  /** The swarm's form during the scene's act (p 0.12 to 0.88, §8.3). */
  form: FormId;
  /** The side the text sits on. The camera puts the figure on the other side (§7.4). */
  textSide: 'left' | 'right' | 'center';
  /** Clear ground in svh at the top of a Day scene, where Night turns to Day (§10.9). */
  dawn?: number;
}

const scene = (id: SceneId, rest: Omit<Scene, 'id' | 'label'>): Scene => ({ id, label: COPY.scenes[id], ...rest });

export const SCENES: readonly Scene[] = [
  scene('top', { world: 'night', budget: { desktop: 100, mobile: 100 }, pinned: false, form: 'cloud', textSide: 'left' }),
  scene('how-it-works', { world: 'night', budget: { desktop: 300, mobile: 220 }, pinned: true, form: 'posterior', textSide: 'left' }),
  // The tabs morph between the four figure forms (§10.3); the first tab is Algebra.
  scene('try', { world: 'night', budget: 'content', pinned: false, form: 'figure-algebra', textSide: 'right' }),
  scene('why', { world: 'night', budget: { desktop: 160, mobile: 130 }, pinned: true, form: 'layers', textSide: 'left' }),
  scene('tutor', { world: 'night', budget: { desktop: 120, mobile: 110 }, pinned: true, form: 'quiet', textSide: 'left' }),
  scene('map', { world: 'night', budget: { desktop: 180, mobile: 140 }, pinned: true, form: 'constellation', textSide: 'left' }),
  // The tunnel opens into the four banks at the scene's exit (§10.7).
  scene('archive', { world: 'night', budget: { desktop: 240, mobile: 170 }, pinned: true, form: 'tunnel', textSide: 'center' }),
  scene('arena', { world: 'night', budget: { desktop: 130, mobile: 110 }, pinned: true, form: 'track', textSide: 'left' }),
  scene('plans', { world: 'day', budget: 'content', dawn: 60, pinned: false, form: 'grid', textSide: 'center' }),
  // The canvas sleeps under FAQ (§9.6).
  scene('faq', { world: 'day', budget: 'content', pinned: false, form: 'grid', textSide: 'left' }),
  scene('begin', { world: 'night', budget: { desktop: 130, mobile: 110 }, pinned: true, form: 'mark', textSide: 'center' }),
];
