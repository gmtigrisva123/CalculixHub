/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/**
 * Pauses a perpetually-looping CSS animation whenever nobody can see it.
 *
 * The product uses a handful of infinite loops as ambient signal — the tutor
 * launcher's notification ping, the "live" status dots, the slowly rotating
 * ring in the landing hero. Each is cheap per frame, but `animation-play-state`
 * defaults to running forever: offscreen, in a background tab, and on a locked
 * phone. Inside a WKWebView that is a battery drain the user pays for
 * continuously and never sees.
 *
 * Attaching this ref keeps the animation visually identical while it is on
 * screen, and stops the compositor doing work the moment it is not. Nothing
 * about the animation's appearance changes.
 *
 * Usage — attach to the element that carries the `animate-*` class:
 *
 *   const ref = useAmbient<SVGSVGElement>();
 *   <Sparkles ref={ref} className="w-5 h-5 animate-pulse" />
 *
 * The ref goes on the animating element itself, not a wrapper, so no extra DOM
 * is introduced and layout is untouched.
 */
export function useAmbient<T extends HTMLElement | SVGElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Start optimistic on both axes: an element that is already in view when it
    // mounts must not flicker to paused before the observer's first callback.
    let onScreen = true;
    let pageVisible = !document.hidden;

    const apply = () => {
      // Clearing the property rather than writing 'running' hands control back
      // to the stylesheet, so a `prefers-reduced-motion` rule that disables the
      // animation entirely still wins.
      element.style.animationPlayState = onScreen && pageVisible ? '' : 'paused';
    };

    // The margin resumes the animation just before it scrolls into view, so it
    // is already at speed by the time the user can see it.
    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        apply();
      },
      { rootMargin: '64px' },
    );
    observer.observe(element);

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      apply();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Leave the element as the stylesheet intends, in case it outlives this
      // hook (React 19 StrictMode mounts effects twice in development).
      element.style.animationPlayState = '';
    };
  }, []);

  return ref;
}
