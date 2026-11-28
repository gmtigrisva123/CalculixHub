/**
 * The landing page's one clock.
 *
 * Every value on the page that follows the scroll is computed here, once per
 * frame, from one reading of the scroll position: the inertial scroll itself
 * (Lenis), the progress of every scroll-linked scene (stageLayout.ts), and the
 * thread of light drawn on the WebGL stage. They used to run on four loops —
 * Lenis's own, Motion's, the hero's render loop and the margins' — and the
 * scroll-linked values were a frame behind the scroll: Lenis moved the page in
 * its callback, and Motion only heard about it from the scroll event one frame
 * later. Text and 3D could not agree on where the page was.
 *
 * Now the order inside a frame is fixed: Lenis advances the scroll; every
 * listener reads that one value and writes what it owns; Motion's own steps
 * (springs, derived values, style writes) run afterwards in the same batch.
 * Everything lands in the frame that shows the new scroll position.
 *
 * The clock is built on Motion's frameloop rather than a requestAnimationFrame
 * of its own, so the whole page still runs on a single rAF. It sleeps when
 * nothing moves — no scroll, no smooth scroll in flight, no listener asking for
 * another frame — and wakes on the next input. Nothing here reads layout: the
 * scroll position and the viewport size are the only inputs.
 */

import { cancelFrame, frame } from 'motion/react';
import type Lenis from 'lenis';

export interface Tick {
  /** The scroll position this frame, in CSS px. */
  y: number;
  /** How far it moved since the last frame. */
  dy: number;
  /** Scroll velocity, px per second, lightly smoothed. */
  vy: number;
  /** The layout viewport, in CSS px. */
  vw: number;
  vh: number;
  /** performance.now() of this frame, in ms. */
  now: number;
  /** Seconds since the last frame, capped so a pause never reads as a leap. */
  dt: number;
  /** Increments each frame the clock runs. */
  frame: number;
}

/**
 * Lower runs first. Progress values are written before anything that reads
 * them (the GL stage), and the stage before late DOM writes that follow it.
 */
export const PRIORITY = { scroll: 0, progress: 10, stage: 20, late: 30 } as const;

/** A listener returns true when it needs another frame even if nothing else moves. */
type Listener = (tick: Tick) => boolean | void;

interface Entry { fn: Listener; priority: number }

const entries: Entry[] = [];
let lenis: Lenis | null = null;
let scheduled = false;
let installed = false;

const tick: Tick = { y: 0, dy: 0, vy: 0, vw: 1, vh: 1, now: 0, dt: 1 / 60, frame: 0 };
let lastNow = 0;

function readViewport() {
  const root = document.documentElement;
  tick.vw = root.clientWidth || window.innerWidth || 1;
  tick.vh = root.clientHeight || window.innerHeight || 1;
}

function step() {
  scheduled = false;
  const now = performance.now();
  const dt = lastNow ? Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000)) : 1 / 60;
  // A gap longer than a few frames is a pause (hidden tab, idle clock), not motion.
  const resumed = !lastNow || now - lastNow > 120;
  lastNow = now;

  lenis?.raf(now);
  const y = window.scrollY;
  const dy = y - tick.y;
  tick.dy = dy;
  tick.y = y;
  tick.now = now;
  tick.dt = dt;
  tick.frame += 1;
  const instant = resumed ? 0 : dy / dt;
  tick.vy += (instant - tick.vy) * (resumed ? 1 : 0.25);
  if (Math.abs(tick.vy) < 0.5) tick.vy = 0;

  let busy = Boolean(lenis?.isScrolling) || dy !== 0 || Math.abs(tick.vy) > 0;
  for (const entry of entries.slice()) {
    if (entry.fn(tick)) busy = true;
  }
  if (busy) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  frame.setup(step);
}

/** Ask for a frame: an input arrived, or something started to move. */
export function wake(): void {
  if (!installed) install();
  schedule();
}

const onResize = () => { readViewport(); wake(); };
const onVisibility = () => { if (!document.hidden) { lastNow = 0; wake(); } };

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  readViewport();
  tick.y = window.scrollY;
  const passive = { passive: true } as const;
  // Native scrolling (touch, keys, the scrollbar, find in page) and the inputs Lenis turns into scrolling.
  window.addEventListener('scroll', wake, passive);
  window.addEventListener('wheel', wake, passive);
  window.addEventListener('touchmove', wake, passive);
  window.addEventListener('keydown', wake, passive);
  window.addEventListener('resize', onResize, passive);
  document.addEventListener('visibilitychange', onVisibility);
}

function uninstall() {
  if (!installed || entries.length || lenis) return;
  installed = false;
  window.removeEventListener('scroll', wake);
  window.removeEventListener('wheel', wake);
  window.removeEventListener('touchmove', wake);
  window.removeEventListener('keydown', wake);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
  cancelFrame(step);
  scheduled = false;
}

/** Run `fn` on every frame the clock runs, in priority order. */
export function onTick(fn: Listener, priority: number = PRIORITY.late): () => void {
  install();
  const entry = { fn, priority };
  const at = entries.findIndex(other => other.priority > priority);
  if (at === -1) entries.push(entry);
  else entries.splice(at, 0, entry);
  wake();
  return () => {
    const index = entries.indexOf(entry);
    if (index !== -1) entries.splice(index, 1);
    uninstall();
  };
}

/** The values of the latest frame. Safe to read at any time; refreshed when stale. */
export function currentTick(): Tick {
  if (!installed) install();
  if (!scheduled && Math.abs(window.scrollY - tick.y) > 0.5) {
    tick.y = window.scrollY;
    readViewport();
  }
  return tick;
}

/** Hand the clock an inertial scroll to drive (or take it away). */
export function attachLenis(instance: Lenis | null): void {
  lenis = instance;
  if (instance) wake();
  else uninstall();
}

/** Re-read the viewport, after a change the resize event does not report. */
export function refreshViewport(): void {
  readViewport();
  wake();
}
