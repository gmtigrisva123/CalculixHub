/**
 * The landing page's scroll: inertial while the page is mounted, and the one
 * place the page moves itself.
 *
 * A mouse wheel scrolls in notches, 100px at a time, and every scroll-linked
 * figure on the page — the sheet sliding over the hero, the engine replay, the
 * four worlds morphing — would step with it. Lenis interpolates the wheel into
 * one continuous movement over native scrolling, so `position: sticky`, find in
 * page, keyboard scrolling and the scrollbar all keep working, and touch input
 * is left entirely to the platform's own momentum.
 *
 * It is not created at all for reduced motion: the preference asks for scroll
 * to track the input device exactly, and the cheapest way to honour that is to
 * leave the browser in charge.
 */

import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let active: Lenis | null = null;

/** Expo in-out: a long, quiet start and finish for travel across many screens. */
const travel = (t: number) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2);

export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 0.95, stopInertiaOnNavigate: true });
    active = lenis;
    return () => {
      lenis.destroy();
      if (active === lenis) active = null;
    };
  }, [enabled]);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scroll to an element (or a y position). The duration grows with the distance
 * so a hop to the next section and a trip to the bottom of the page both feel
 * deliberate rather than one crawling and the other teleporting.
 */
export function scrollToTarget(target: HTMLElement | number, { offset = 0, immediate = false }: { offset?: number; immediate?: boolean } = {}) {
  const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
  const destination = Math.max(0, y + offset);
  const jump = immediate || prefersReducedMotion();
  if (active) {
    const distance = Math.abs(destination - window.scrollY);
    active.scrollTo(destination, { immediate: jump, duration: Math.min(2.2, 0.9 + distance / 5200), easing: travel, force: true });
    return;
  }
  window.scrollTo({ top: destination, behavior: jump ? 'auto' : 'smooth' });
}

/** Freeze the page behind an overlay (the mobile menu) and release it again. */
export function setScrollLocked(locked: boolean) {
  if (active) {
    if (locked) active.stop();
    else active.start();
  }
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}
