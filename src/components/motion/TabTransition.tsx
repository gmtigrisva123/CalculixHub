/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { duration, ease, spring, travel } from '../../lib/motion';

interface TabTransitionProps {
  /** The active workspace. A change to this drives the transition. */
  tabKey: string;
  children: React.ReactNode;
}

/**
 * The product's route transition.
 *
 * CalculixHub has no router — navigation is a single `activeTab` string — but
 * a tab change is a route change to the person using it, and it should read as
 * one. Outgoing content fades and lifts a few pixels; incoming content settles
 * up into place on a spring.
 *
 * Deliberately direction-agnostic. A horizontal slide keyed on tab index would
 * be more literally "native", but the eight workspaces have no meaningful
 * left-right ordering, and the desktop sidebar has no horizontal semantics at
 * all. Vertical settle communicates "new content arrived" without implying a
 * spatial relationship that does not exist.
 *
 * `mode="wait"` so the two never overlap. Cross-dissolving two full workspaces
 * double-paints large surfaces and briefly renders two competing headings.
 *
 * `initial={false}` keeps the first paint still. On load the whole app shell is
 * already arriving; animating the workspace on top of that is one motion too
 * many, and the screens stagger their own cards in regardless.
 */
export default function TabTransition({ tabKey, children }: TabTransitionProps) {
  const isFirstRender = useRef(true);

  /**
   * Return to the top of the page when the workspace changes.
   *
   * Without this, switching from a scrolled Learn list to the dashboard lands
   * the user halfway down a screen they have not seen, and the exit animation
   * plays somewhere off-screen. Every tabbed application does this; the site
   * was simply missing it.
   *
   * `behavior: 'instant'` is required rather than assumed: `html` carries
   * `scroll-behavior: smooth` globally for the landing page's anchor links,
   * which would otherwise turn this into a visible scroll race against the
   * transition.
   */
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tabKey]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={tabKey}
        initial={{ opacity: 0, y: travel.sm }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            ...spring.smooth,
            opacity: { duration: duration.base, ease: ease.standard },
          },
        }}
        exit={{
          opacity: 0,
          y: -travel.xs,
          transition: { duration: duration.instant + 0.02, ease: ease.exit },
        }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
