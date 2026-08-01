/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { spring } from '../../lib/motion';

interface AnimatedNumberProps {
  /** The true value. Always what the element reads once settled. */
  value: number;
  /**
   * Turns the in-flight number into display text. Defaults to a rounded
   * integer. Pass `(n) => Math.round(n).toLocaleString()` for grouped
   * thousands, or a fixed-decimal formatter for rates.
   */
  format?: (value: number) => string;
  /**
   * Where the first animation starts. Defaults to 0, which is the count-up
   * every dashboard figure wants. Later changes always animate from wherever
   * the number currently is, never from this.
   */
  from?: number;
  className?: string;
}

const defaultFormat = (value: number) => String(Math.round(value));

/**
 * A number that animates to its value instead of snapping to it.
 *
 * Counts up from `from` the first time it renders, then interpolates between
 * successive values. That second behaviour matters more than the first here:
 * the landing hero polls live platform stats every five seconds, and a counter
 * that restarted from zero on each poll would be both wrong and distracting.
 * Interpolating turns the same component into a ticker.
 *
 * Updates are written straight to the DOM node from a motion value rather than
 * through React state. A spring emits a value every frame, and re-rendering the
 * owning component sixty times a second to change one text node would cost far
 * more than the animation it is driving.
 *
 * The element's JSX text is the settled value, so the correct number is present
 * before any effect runs — the animation's start position is applied in a
 * layout effect, ahead of paint, so there is no flash of the wrong figure.
 */
export default function AnimatedNumber({
  value,
  format = defaultFormat,
  from = 0,
  className,
}: AnimatedNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const progress = useMotionValue(from);
  const hasAnimated = useRef(false);

  // Read through refs so a caller passing an inline arrow for `format` does not
  // restart the animation on every render.
  const formatRef = useRef(format);
  formatRef.current = format;

  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    // Reduce Motion means the figure updates instantly. It is information, not
    // decoration, so it must never be withheld — only the travel is dropped.
    if (prefersReducedMotion) {
      progress.set(value);
      node.textContent = formatRef.current(value);
      hasAnimated.current = true;
      return;
    }

    if (!hasAnimated.current) {
      hasAnimated.current = true;
      progress.set(from);
      node.textContent = formatRef.current(from);
    }

    const unsubscribe = progress.on('change', (latest) => {
      node.textContent = formatRef.current(latest);
    });

    const controls = animate(progress, value, spring.data);

    return () => {
      controls.stop();
      unsubscribe();
    };
    // `from` is intentionally excluded: it seeds the first run only, and
    // reacting to it would restart a settled counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion, progress]);

  return (
    <span ref={nodeRef} className={className}>
      {format(value)}
    </span>
  );
}
