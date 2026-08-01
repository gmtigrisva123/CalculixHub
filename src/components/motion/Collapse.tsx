/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { duration, ease } from '../../lib/motion';

interface CollapseProps {
  /** Whether the content is shown. Drives mount and unmount. */
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Expands and collapses disclosure content — hints, solutions, inline notices.
 *
 * These currently appear and vanish instantly, which makes the surrounding
 * layout jump and leaves the user to work out what changed. Growing the panel
 * from zero height ties the new content to the control that revealed it.
 *
 * Height is animated to and from `auto`, which Motion measures for us. That is
 * a layout animation and the one place in this system where that is accepted:
 * the alternative — a transform-based reveal — cannot push the content below it
 * down, so the panel would overlap whatever follows.
 *
 * `overflow-hidden` lives on the animating wrapper rather than on the caller's
 * element so the content is clipped while the height is mid-flight, and the
 * caller keeps whatever padding and borders it already had.
 *
 * Opacity is deliberately faster than the height and offset to start: the panel
 * should be legible by the time it stops moving, not fade in after it lands.
 */
export default function Collapse({ open, children, className }: CollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          className={className}
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: 'auto',
            opacity: 1,
            transition: {
              height: { duration: duration.slow, ease: ease.standard },
              opacity: { duration: duration.base, ease: ease.standard, delay: 0.04 },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: duration.base, ease: ease.exit },
              opacity: { duration: duration.instant, ease: ease.exit },
            },
          }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
