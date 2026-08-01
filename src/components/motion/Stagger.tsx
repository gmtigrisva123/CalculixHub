/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { duration, ease, spring, staggerDelay, travel } from '../../lib/motion';

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  /** Position in the list. Drives the delay, so pass the map index. */
  index: number;
  /** Per-item delay in seconds. */
  step?: number;
  /** Ceiling on the total delay, so long lists do not crawl. */
  max?: number;
  /** Reveal on scroll instead of on mount. For lists below the fold. */
  inView?: boolean;
  as?: 'div' | 'li' | 'article' | 'tr';
}

/**
 * One item in a staggered list, sequenced by its index.
 *
 * Index-driven rather than driven by Motion's `staggerChildren` because that
 * has no ceiling: a forty-row leaderboard at 35ms per row would take one and a
 * half seconds to finish arriving, and the last rows would land long after the
 * user started reading. `staggerDelay` clamps the total, so a short list reads
 * as a sequence and a long one reads as a single wave.
 *
 * Self-contained by design — it needs no parent provider, so it drops into the
 * existing `.map()` calls without restructuring the markup around them.
 */
export function StaggerItem({
  children,
  className,
  index,
  step,
  max,
  inView = false,
  as = 'div',
}: StaggerItemProps) {
  const Component = m[as];
  const delay = staggerDelay(index, step, max);

  const settled = { opacity: 1, y: 0 };

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: travel.sm }}
      {...(inView
        ? { whileInView: settled, viewport: { once: true, amount: 0.1 } }
        : { animate: settled })}
      transition={{
        ...spring.smooth,
        delay,
        opacity: { duration: duration.base, ease: ease.standard, delay },
      }}
    >
      {children}
    </Component>
  );
}

export default StaggerItem;
