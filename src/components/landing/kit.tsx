/**
 * The small parts every section of the landing page shares.
 *
 * The page is a contest paper, and it is marked by hand: the tick, the cross
 * and the ring below are what a marker's red pen leaves, drawn as strokes so
 * they can be written onto the sheet rather than switched on. The rest is
 * plumbing: the house arrow, the mark, and a way to move a figure from one
 * state to another without it lurching.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MARK_DOT, MARK_PATH, MARK_STROKE, MARK_VIEWBOX } from '../brand';

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/** Whether the visitor has asked for less motion. Read live: the setting can change while the page is open. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A fast departure that settles without overshoot: the page's one curve, as a function. */
export const easeOut = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * Run `frame` with a value easing from 0 to 1 over `ms`, once per animation
 * frame. Returns a function that stops it where it is. With reduced motion the
 * value is 1 at once: the figure shows its new state without travelling to it.
 */
export function tween(ms: number, frame: (progress: number) => void): () => void {
  if (prefersReducedMotion() || ms <= 0) {
    frame(1);
    return () => {};
  }
  let raf = 0;
  const started = performance.now();
  const tick = (time: number) => {
    const t = Math.min(1, (time - started) / ms);
    frame(easeOut(t));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** True once the element has come into view. It stays true: nothing on the page plays twice. */
export function useSeen<T extends Element>(amount = 0.35): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver !== 'function') { setSeen(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    }, { threshold: amount });
    observer.observe(node);
    return () => observer.disconnect();
  }, [amount, seen]);
  return [ref, seen];
}

/** Whether the element is on screen right now. Unlike `useSeen`, it goes back to false when the element leaves. */
export function useOnScreen<T extends Element>(amount = 0.25): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver !== 'function') { setOn(true); return; }
    const observer = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { threshold: amount });
    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);
  return [ref, on];
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

/**
 * A smooth path through the points, as an SVG `d` string. Each stretch is a
 * cubic whose handles follow the line between its neighbours (a Catmull-Rom
 * spline), so the curve passes through every point exactly.
 */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length === 0) return '';
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(0, index - 1)];
    const from = points[index];
    const to = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const c1x = from[0] + (to[0] - before[0]) / 6;
    const c1y = from[1] + (to[1] - before[1]) / 6;
    const c2x = to[0] - (after[0] - from[0]) / 6;
    const c2y = to[1] - (after[1] - from[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(2)} ${c2x.toFixed(1)} ${c2y.toFixed(2)} ${to[0].toFixed(1)} ${to[1].toFixed(2)}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// The marker's red pen
// ---------------------------------------------------------------------------

/** A tick, as a marker writes one: down, then up and away. */
export function PenTick({ className }: { className?: string }) {
  return (
    <svg className={className ? `p1-pen ${className}` : 'p1-pen'} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path pathLength={1} d="M4.5 15.5c2.2 2.1 4 4.6 5.4 7.4C13.6 14.2 18.3 8.3 24.5 4" />
    </svg>
  );
}

/** A cross: two strokes, the second written after the first. */
export function PenCross({ className }: { className?: string }) {
  return (
    <svg className={className ? `p1-pen ${className}` : 'p1-pen'} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path pathLength={1} d="M5.5 5c5.3 5.2 11 11.3 17.5 18.5" />
      <path pathLength={1} className="p1-pen-second" d="M23 4.5C16.8 10.7 10.9 16.7 4.5 23.5" />
    </svg>
  );
}

/**
 * The ring a marker draws round the right answer: one loop that overshoots
 * where it began. It is stretched to whatever it circles, so its stroke is
 * kept at a constant width on screen rather than scaled with it.
 */
export function PenRing({ className }: { className?: string }) {
  return (
    <svg className={className ? `p1-ring ${className}` : 'p1-ring'} viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M12 9C30 2 72 1 90 9c9 4.5 9 20-3 25.5C70 41 28 40.5 11 33.5-2 27.5 0 12 18 6.5 30 3 44 3 52 4.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small shared marks
// ---------------------------------------------------------------------------

/** The house arrow, drawn at the page's stroke weight rather than an icon set's. */
export function Arrow({ direction = 'right', size = 16 }: { direction?: 'right' | 'up-right' | 'down' | 'up'; size?: number }) {
  const rotate = { right: 0, 'up-right': -45, down: 90, up: -90 }[direction];
  return (
    <svg className="p1-arrow" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M2.5 8h10.5M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The CalculixHub mark, read from brand.ts like every other surface that draws it. */
export function BrandMark() {
  return (
    <svg className="p1-mark" viewBox={MARK_VIEWBOX} fill="none" aria-hidden="true">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={MARK_STROKE} strokeLinecap="round" />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill="currentColor" />
    </svg>
  );
}

/** The wordmark as the product writes it everywhere: "calculix" set heavy, "hub" light. */
export function Wordmark() {
  return (
    <span className="p1-wordmark">
      <BrandMark />
      <span className="p1-wordmark-word">calculix<span>hub</span></span>
    </span>
  );
}

/** A phrase run over with the highlighter. Emphasis in a heading is colour here, never italics. */
export function Hl({ children, swipe = false }: { children: ReactNode; swipe?: boolean }) {
  return <span className={swipe ? 'p1-hl is-swipe' : 'p1-hl'}>{children}</span>;
}

/** Go to a section of the page. Native scrolling: the page never takes the scroll away from the reader. */
export function goTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  // Move focus with the view, so the next Tab starts from the section and not from the link.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
