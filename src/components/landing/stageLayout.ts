/**
 * Where things are on the landing page, measured when the layout changes and
 * never while it scrolls.
 *
 * The WebGL stage draws in screen space, but everything it draws belongs to
 * something on the page: the butterfly to the hero, the belief curve to the
 * engine's chart, the circle to the chord figure. Asking the DOM where those
 * are on every frame would make the browser lay the page out sixty times a
 * second during a scroll. So each element's place in the document is read
 * once, whenever the document changes size (a chapter mounts, a font arrives,
 * an answer opens, the window is resized), and on each frame its place on
 * screen is that position less the scroll.
 *
 * Positions come from the offsetTop chain rather than getBoundingClientRect:
 * offsets ignore CSS transforms and a stuck element's offset stays where it
 * would sit unstuck, so a measurement taken while a panel is mid-entrance or
 * a stage is pinned is still the element's real place. The transforms the
 * page applies on purpose (a stage receding, the archive track sliding) are
 * applied again, analytically, by whoever owns them.
 *
 * The same measurements drive `useStageScroll`, this page's replacement for
 * Motion's useScroll: a progress value computed by the page clock in the same
 * frame as the scroll, so DOM transforms and the 3D stage are always reading
 * one number.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { frame, motionValue, type MotionValue } from 'motion/react';
import { PRIORITY, currentTick, onTick, wake } from './pageClock';

export interface Box { top: number; left: number; width: number; height: number }

const EMPTY: Box = { top: 0, left: 0, width: 0, height: 0 };

/**
 * An element's box in document coordinates, ignoring transforms. With
 * `within`, relative to that ancestor instead (it must be on the offset chain).
 */
export function docBox(element: HTMLElement | null, within?: HTMLElement | null): Box {
  if (!element) return EMPTY;
  let top = 0;
  let left = 0;
  let node: HTMLElement | null = element;
  while (node && node !== within) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left, width: element.offsetWidth, height: element.offsetHeight };
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

type Measure = () => void;
const measures = new Set<Measure>();
let pending = false;
let observer: ResizeObserver | null = null;
let version = 0;

/** Bumped every time the page is measured, so caches can tell they are stale. */
export function layoutVersion(): number {
  return version;
}

function measureAll() {
  pending = false;
  version += 1;
  for (const measure of measures) measure();
  wake();
}

/** Measure again in the next frame's read step (a layout change was noticed). */
export function scheduleMeasure(): void {
  if (pending) return;
  pending = true;
  frame.read(measureAll);
}

function watch() {
  if (observer || typeof ResizeObserver !== 'function') return;
  observer = new ResizeObserver(scheduleMeasure);
  // The landing root grows as chapters mount, and changes height when text reflows or an answer opens.
  const root = document.querySelector('.lx') ?? document.body;
  observer.observe(root);
  observer.observe(document.documentElement);
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  void document.fonts?.ready.then(scheduleMeasure);
}

function unwatch() {
  if (measures.size || !observer) return;
  observer.disconnect();
  observer = null;
  window.removeEventListener('resize', scheduleMeasure);
}

/** Run `measure` now and again whenever the page's layout changes. */
export function onMeasure(measure: Measure): () => void {
  watch();
  measures.add(measure);
  measure();
  return () => {
    measures.delete(measure);
    unwatch();
  };
}

// ---------------------------------------------------------------------------
// Scroll progress, the same way Motion's useScroll describes it
// ---------------------------------------------------------------------------

/** An edge pair: where on the target meets where on the viewport. "start end" = the target's top at the viewport's bottom. */
export type Edge = string;

const NAMED: Record<string, number> = { start: 0, center: 0.5, end: 1 };

function parsePoint(token: string): number {
  if (token in NAMED) return NAMED[token];
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : 0;
}

export function parseEdge(edge: Edge): { target: number; viewport: number } {
  const [target = 'start', viewport = target] = edge.trim().split(/\s+/);
  return { target: parsePoint(target), viewport: parsePoint(viewport) };
}

/** The scroll position at which a target point meets a viewport point. */
export function scrollAt(box: Box, edge: Edge, viewportHeight: number): number {
  const { target, viewport } = parseEdge(edge);
  return box.top + box.height * target - viewportHeight * viewport;
}

/** Progress from 0 to 1 between two edges, clamped, as a pure function of the scroll. */
export function progressAt(box: Box, edges: readonly [Edge, Edge], y: number, viewportHeight: number): number {
  const from = scrollAt(box, edges[0], viewportHeight);
  const to = scrollAt(box, edges[1], viewportHeight);
  if (to === from) return y >= to ? 1 : 0;
  return Math.min(1, Math.max(0, (y - from) / (to - from)));
}

/**
 * Scroll progress through an element, as a MotionValue that is written by the
 * page clock in the same frame as the scroll. Use it wherever a DOM transform
 * and the 3D stage must agree; it accepts the same edge words as useScroll.
 */
export function useStageScroll(ref: RefObject<HTMLElement | null>, edges: readonly [Edge, Edge] = ['start end', 'end start']): MotionValue<number> {
  const value = useRef<MotionValue<number> | null>(null);
  value.current ??= motionValue(0);
  const progress = value.current;
  const [from, to] = edges;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let box = docBox(element);
    const stopMeasure = onMeasure(() => { box = docBox(element); });
    const update = (tick: { y: number; vh: number }) => {
      const next = progressAt(box, [from, to], tick.y, tick.vh);
      if (next !== progress.get()) progress.set(next);
    };
    update(currentTick());
    const stopTick = onTick(update, PRIORITY.progress);
    return () => { stopMeasure(); stopTick(); };
  }, [ref, progress, from, to]);

  return progress;
}

// ---------------------------------------------------------------------------
// Values that chase the scroll on the page's `follow` spring, shared with the stage
// ---------------------------------------------------------------------------

const published = new Map<string, MotionValue<number>>();

/** A value the WebGL stage may read by name: the same number the DOM is drawing with this frame. */
export function readStageValue(key: string): number | undefined {
  return published.get(key)?.get();
}

/** One step of the follow spring (stiffness 170, damping 26, mass 0.5), sub-stepped for stability. */
export function followStep(state: { x: number; v: number }, target: number, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    const acceleration = (-170 * (state.x - target) - 26 * state.v) / 0.5;
    state.v += acceleration * h;
    state.x += state.v * h;
  }
}

/**
 * `source` followed on the page's follow spring, integrated by the page clock
 * (not by Motion's own spring), so it is computed once per frame and, when
 * given a `key`, the WebGL stage reads exactly the value the DOM draws with.
 * With `still` it simply equals the source.
 */
export function useStageSpring(source: MotionValue<number>, { key, still = false }: { key?: string; still?: boolean } = {}): MotionValue<number> {
  const value = useRef<MotionValue<number> | null>(null);
  value.current ??= motionValue(source.get());
  const out = value.current;

  useLayoutEffect(() => {
    const state = { x: source.get(), v: 0 };
    out.set(state.x);
    const stop = onTick(tick => {
      const target = source.get();
      if (still) {
        state.x = target;
        state.v = 0;
      } else {
        followStep(state, target, tick.dt);
        if (Math.abs(state.x - target) < 1e-4 && Math.abs(state.v) < 1e-3) { state.x = target; state.v = 0; }
      }
      if (state.x !== out.get()) out.set(state.x);
      return state.x !== target;
    }, PRIORITY.progress + 1);
    return stop;
  }, [source, out, still]);

  useEffect(() => {
    if (!key) return;
    published.set(key, out);
    return () => { if (published.get(key) === out) published.delete(key); };
  }, [key, out]);

  return out;
}

// ---------------------------------------------------------------------------
// Elements that may sit inside a pinned (sticky) parent
// ---------------------------------------------------------------------------

export interface Tracked {
  /** The element's box: in the document, or relative to its sticky ancestor when it has one. */
  box: Box;
  sticky: null | {
    /** The sticky element's static box, its container's box, and its `top` offset. */
    self: Box;
    container: Box;
    top: number;
  };
}

/**
 * Measure an element so its place on screen can be worked out for any scroll
 * position without asking the DOM again, including when it rides inside a
 * `position: sticky` parent (the hero, the engine's pin). Reads computed style,
 * so call it from a measure, never from a frame.
 */
export function track(element: HTMLElement): Tracked {
  let sticky: HTMLElement | null = null;
  for (let node: HTMLElement | null = element; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'sticky') { sticky = node; break; }
  }
  if (!sticky || !sticky.parentElement) return { box: docBox(element), sticky: null };
  const container = docBox(sticky.parentElement);
  const self = docBox(sticky);
  const within = element === sticky ? { ...self, top: 0, left: 0 } : docBox(element, sticky);
  return {
    box: { top: within.top, left: within.left, width: element.offsetWidth, height: element.offsetHeight },
    sticky: { self, container, top: Number.parseFloat(getComputedStyle(sticky).top) || 0 },
  };
}

/** A tracked element's box on screen at scroll position `y` (transforms excepted). */
export function rectAt(tracked: Tracked, y: number): Box {
  const { box, sticky } = tracked;
  if (!sticky) return { top: box.top - y, left: box.left, width: box.width, height: box.height };
  const { self, container, top } = sticky;
  const stuck = Math.min(Math.max(self.top - y, top), container.top + container.height - self.height - y);
  return { top: stuck + box.top, left: self.left + box.left, width: box.width, height: box.height };
}
