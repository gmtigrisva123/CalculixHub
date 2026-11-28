/**
 * The fixed layer the thread of light is drawn in, and the moment it is
 * allowed to arrive.
 *
 * three.js is most of half a megabyte. Asking for it at mount meant it was
 * parsed and its shaders compiled in the middle of the headline's entrance, so
 * the first seconds are taken in turn and no two heavy things overlap: the
 * headline lands (fonts in, two painted frames); the chapters below are
 * mounted while the hero is still; and only then, in an idle moment, is the
 * stage asked for. Its particles gather out of the dark on their own, which is
 * the entrance they were written to make. If the chapters are slow to arrive
 * the stage does not wait for ever.
 *
 * Until it is drawing, and on any machine where it cannot (data-gl="off"),
 * the page shows its own DOM drawings: the hero's 2D butterfly, the engine's
 * SVG chart, the chord figure, the final line. The stage only ever replaces
 * what it can draw better, and hands everything back if its context is lost.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { whenIdle } from '../../lib/lazy';
import { afterChapters } from './chapters';
import { onStageState, setStageState, stageState, type StageState } from './threadBus';

/**
 * The moment the hero may start to move: a painted frame of the finished
 * layout (two animation frames after mount) and the display face in hand, so
 * the words rise in their real type. The font wait is capped so a slow font
 * only delays the entrance by a moment, never holds it.
 */
export function useHeroCue(): boolean {
  const [cued, setCued] = useState(false);
  useEffect(() => {
    let live = true;
    const fonts = typeof document.fonts?.load === 'function'
      ? document.fonts.load("560 1em 'Geist'").catch(() => undefined)
      : Promise.resolve();
    const painted = new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const cap = new Promise<void>(resolve => window.setTimeout(resolve, 900));
    void Promise.all([painted, Promise.race([fonts, cap])]).then(() => { if (live) setCued(true); });
    return () => { live = false; };
  }, []);
  return cued;
}

/** After the headline has landed and the chapters are in: an idle moment, or five seconds at most. */
function useStageCue(cued: boolean): boolean {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!cued) return;
    let live = true;
    let cancelIdle = () => {};
    const show = () => { if (live) cancelIdle = whenIdle(() => { if (live) setGo(true); }, 800); };
    void afterChapters().then(show);
    const patience = window.setTimeout(show, 5000);
    return () => { live = false; window.clearTimeout(patience); cancelIdle(); };
  }, [cued]);
  return go;
}

/** The stage's state, for components that swap a DOM drawing for it. */
export function useStageState(): StageState {
  const [state, setState] = useState<StageState>(stageState);
  useEffect(() => onStageState(setState), []);
  return state;
}

export default function ThreadStage() {
  const reduce = Boolean(useReducedMotion());
  const hostRef = useRef<HTMLDivElement>(null);
  const cued = useHeroCue();
  const go = useStageCue(cued);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!go) return;
    let live = true;
    let stop = () => {};
    void import('./threadEngine')
      .then(({ startThreadStage }) => {
        const host = hostRef.current;
        if (!live || !host) return;
        stop = startThreadStage({
          host,
          still: reduce,
          onReady: () => { setReady(true); setStageState('on'); },
          onFail: () => { setReady(false); setStageState('off'); },
          onRestore: () => { setReady(true); setStageState('on'); },
        });
      })
      .catch(error => {
        if (import.meta.env.DEV) console.error('[landing] the WebGL stage could not start', error);
        setStageState('off');
      });
    return () => {
      live = false;
      stop();
      setReady(false);
      setStageState('pending');
    };
  }, [go, reduce]);

  return <div ref={hostRef} className={ready ? 'lx-thread is-ready' : 'lx-thread'} aria-hidden="true" />;
}
