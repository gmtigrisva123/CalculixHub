/**
 * What the page tells the WebGL stage, and what the stage tells the page.
 *
 * The chapters are ordinary React; the stage is a lazily loaded three.js
 * module that may never arrive (no WebGL, a software renderer, reduced data).
 * This file is the small, dependency-free meeting point between them: a
 * chapter can report a moment ("a wrong answer in the geometry room", "the
 * reader started drawing") without importing three, and can ask whether the
 * stage is live without waiting for it.
 */

export type ThreadEvent =
  | { type: 'topic-choice'; room: number; right: boolean }
  | { type: 'chord-drag'; active: boolean }
  // The chord figure has begun to draw itself in: the circle of light under it hands over.
  | { type: 'chord-draw' }
  | { type: 'desk-draw'; active: boolean }
  | { type: 'desk-demo'; progress: number; x: number; y: number }
  | { type: 'pointer-scene'; scene: string | null };

type Handler = (event: ThreadEvent) => void;

const handlers = new Set<Handler>();

export function emitThread(event: ThreadEvent): void {
  for (const handler of handlers) handler(event);
}

export function onThread(handler: Handler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

/**
 * The stage's state, mirrored on the landing root as `data-gl` so CSS can
 * swap the DOM drawings that stand in for it:
 *
 *   pending   not asked for yet, or still loading: the DOM drawings show
 *   on        the live stage is drawing; what it replaces is hidden
 *   off       no usable WebGL (or a software rasteriser): the DOM drawings stay
 */
export type StageState = 'pending' | 'on' | 'off';

let state: StageState = 'pending';
const watchers = new Set<(state: StageState) => void>();

export function stageState(): StageState {
  return state;
}

export function setStageState(next: StageState): void {
  if (next === state) return;
  state = next;
  const root = document.querySelector<HTMLElement>('.lx');
  if (root) root.dataset.gl = next;
  for (const watcher of watchers) watcher(next);
}

export function onStageState(watcher: (state: StageState) => void): () => void {
  watchers.add(watcher);
  return () => { watchers.delete(watcher); };
}
