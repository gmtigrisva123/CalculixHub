/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

/**
 * Subscribes to a media query.
 *
 * Motion needs this where CSS cannot help: a surface that is a bottom sheet on
 * a phone and a side drawer on a desktop travels along a different axis in each
 * case, and the axis has to be chosen in JavaScript because it is expressed as
 * an animated transform rather than a class. Getting it wrong is worse than not
 * animating — the original CSS keyframe had to be switched off entirely above
 * md because sliding a side drawer up from the bottom is simply the wrong
 * geometry.
 *
 * Reads synchronously during the first render so the opening frame already has
 * the right axis; there is no correct-after-a-tick state to flash through.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Re-read on subscribe: the viewport can change between the first render
    // and this effect, most commonly when a phone is rotated during load.
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint, where the sidebar replaces the bottom rail. */
export const useIsDesktop = () => useMediaQuery('(min-width: 48rem)');
