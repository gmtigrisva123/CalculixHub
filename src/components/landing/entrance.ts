/**
 * The hero's entrance, and how the live page takes over the static one.
 *
 * The production HTML already holds the first two screens (staticMode.tsx),
 * and the inline boot script in index.html decides when they may move: once
 * the display face has loaded (capped at 900 ms, so a slow font never holds
 * the page) and two frames have been painted, it sets `html[data-cue]`. The
 * entrance is CSS keyed on that attribute (landing-entrance.css), so it plays
 * while the bundles are still on their way.
 *
 * When the live page arrives it renders the same markup and the static copy is
 * removed in the same commit (src/boot/BootLift.tsx). CSS animations on new
 * nodes start again from zero, so the live root carries how far the entrance
 * has got (`--lx-elapsed`) and how long the frame has been on screen
 * (`--lx-since`); every entrance and loop subtracts them from its delay and so
 * resumes exactly where the static copy was. A count-up only runs if its
 * figures have not been seen yet: a number the reader has read never resets.
 *
 * A page with no static frame (a development server, or the landing reached
 * later from a workspace boot) plays the entrance itself, from the start, with
 * the same wait the boot script uses.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useStatic } from './staticMode';

/** How long after the cue the hero's figures first appear; a count-up after this point would reset a figure already shown. */
export const STATS_APPEAR = 0.7;

/** The longest the entrance waits for the display face; the boot script in index.html waits the same. */
export const FONT_PATIENCE = 900;

/** Whether this load painted the static first frame. Read once, before the frame is removed. */
const PAINTED_STATIC = typeof document !== 'undefined'
  && document.getElementById('lx-static') !== null
  && document.documentElement.dataset.landing !== undefined;

let takeoverUsed = false;

const readTime = (value: string | undefined): number | null => {
  const number = value === undefined ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
};

/** The cue's time on the page clock (performance.now()), once the boot script or the page has set it. */
export function cueTime(): number | null {
  return typeof document === 'undefined' ? null : readTime(document.documentElement.dataset.cueAt);
}

/** Resolves with the cue's time as soon as the entrance has been cued. */
export function whenCued(): Promise<number> {
  const at = cueTime();
  if (at !== null) return Promise.resolve(at);
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('lx-cue', done);
      window.clearTimeout(patience);
      resolve(cueTime() ?? performance.now());
    };
    window.addEventListener('lx-cue', done);
    // The boot script always cues within about a second; this only covers a page that lost it.
    const patience = window.setTimeout(done, FONT_PATIENCE * 3);
  });
}

/**
 * Where a takeover resumes: how far into the entrance (from the cue) and how
 * long since the first painted frame, in ms. Never negative.
 */
export function resumePoint(now: number, cueAt: number | null, paintAt: number | null): { elapsed: number; since: number } {
  return {
    elapsed: cueAt === null ? 0 : Math.max(0, now - cueAt),
    since: paintAt === null ? 0 : Math.max(0, now - paintAt),
  };
}

/** Whether the hero's count-ups may still run: only while their figures have not appeared. */
export function mayCount(now: number, cueAt: number | null): boolean {
  return cueAt === null || now - cueAt < STATS_APPEAR * 1000 - 50;
}

export interface Entrance {
  /** The entrance may play: the live root carries `data-entrance`. */
  playing: boolean;
  /** ms already played when the live page took over the static frame; 0 otherwise. */
  elapsed: number;
  /** ms since the static frame was first painted, for the hero's endless loops; 0 otherwise. */
  since: number;
  /** Whether the hero's figures may count up. */
  countUps: boolean;
  /** Whether this render continues the static first frame. */
  takeover: boolean;
  /** When this page's entrance started, on the page clock; null until it has. */
  startedAt: number | null;
}

const SETTLED: Entrance = { playing: true, elapsed: 0, since: 0, countUps: false, takeover: false, startedAt: null };

export const EntranceContext = createContext<Entrance>(SETTLED);
export const useEntranceState = (): Entrance => useContext(EntranceContext);

/** The local cue, for a page that painted no static frame: the display face (capped) and two painted frames. */
function localCue(): Promise<void> {
  const fonts = typeof document.fonts?.load === 'function'
    ? document.fonts.load("560 1em 'Geist'").then(() => undefined, () => undefined)
    : Promise.resolve();
  const cap = new Promise<void>(resolve => window.setTimeout(resolve, FONT_PATIENCE));
  const painted = new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return Promise.all([painted, Promise.race([fonts, cap])]).then(() => undefined);
}

/**
 * The landing root's entrance state. A takeover plays at once from where the
 * static frame is; otherwise the page waits for its own cue and plays from the
 * start. Under reduced motion there is nothing to wait for.
 */
export function useEntrance(): Entrance {
  const isStatic = useStatic();
  const reduce = Boolean(useReducedMotion());
  const [state, setState] = useState<Entrance>(() => {
    if (isStatic) return SETTLED;
    const now = performance.now();
    if (PAINTED_STATIC && !takeoverUsed) {
      takeoverUsed = true;
      const cueAt = cueTime();
      const { elapsed, since } = resumePoint(now, cueAt, readTime(document.documentElement.dataset.t0));
      return { playing: true, elapsed, since, countUps: !reduce && mayCount(now, cueAt), takeover: true, startedAt: cueAt };
    }
    return { playing: reduce, elapsed: 0, since: 0, countUps: !reduce, takeover: false, startedAt: reduce ? now : null };
  });

  // A takeover that arrived before the cue: the static frame's entrance starts with the boot script's cue.
  useEffect(() => {
    if (!state.takeover || state.startedAt !== null) return;
    let live = true;
    void whenCued().then(at => { if (live) setState(current => ({ ...current, startedAt: at })); });
    return () => { live = false; };
  }, [state.takeover, state.startedAt]);

  // No static frame to continue: wait for this page's own cue, then play from the start.
  useEffect(() => {
    if (state.playing) return;
    let live = true;
    void localCue().then(() => {
      if (!live) return;
      const now = performance.now();
      const root = document.documentElement;
      // Nothing has cued this document (no boot script ran): cue it, for the CSS and anything else that waits.
      if (root.dataset.cue === undefined) {
        root.dataset.cueAt = String(Math.round(now));
        root.dataset.cue = '';
        window.dispatchEvent(new Event('lx-cue'));
      }
      setState(current => ({ ...current, playing: true, startedAt: now }));
    });
    return () => { live = false; };
  }, [state.playing]);

  return state;
}
