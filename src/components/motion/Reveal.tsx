/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { ease, duration, spring, travel } from '../../lib/motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Forwarded to the rendered element. The landing page's sections are anchor
   * targets for its own nav (`#mission`, `#architecture`, ...), so a reveal
   * wrapper that swallowed the id would silently break in-page navigation.
   */
  id?: string;
  /**
   * Distance travelled, in px. Defaults to the house reveal distance; landing
   * sections use a larger value because they have the room for it.
   */
  distance?: number;
  /** Seconds of delay. Use `staggerDelay()` when revealing a list. */
  delay?: number;
  /**
   * How much of the element must be visible before it reveals. The default
   * fires early so content is already settled by the time it is comfortably
   * in view rather than animating under the user's eye.
   */
  amount?: number;
  /** Renders as this element instead of a div, to preserve document semantics. */
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
}

/**
 * Reveals its children as they scroll into view, once.
 *
 * The workhorse of the landing page and of any long in-app screen. Deliberately
 * fire-once: re-animating on every scroll direction change is the single most
 * common way a reveal system tips over from polished into irritating.
 *
 * Uses `whileInView` rather than a bare IntersectionObserver so reveals share
 * the same spring, the same reduced-motion handling and the same scheduler as
 * every other animation in the product.
 */
export default function Reveal({
  children,
  className,
  id,
  distance = travel.sm,
  delay = 0,
  amount = 0.15,
  as = 'div',
}: RevealProps) {
  const Component = m[as];

  return (
    <Component
      id={id}
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{
        ...spring.smooth,
        delay,
        // Opacity leads the movement slightly. Fading in on a spring lets the
        // bounce show up as a visible flicker in the alpha channel, so it gets
        // a plain tween while the position keeps the spring.
        opacity: { duration: duration.base, ease: ease.standard, delay },
      }}
    >
      {children}
    </Component>
  );
}
