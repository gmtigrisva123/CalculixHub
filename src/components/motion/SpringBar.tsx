/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { spring } from '../../lib/motion';

interface SpringBarProps {
  /** Fill percentage, 0-100. Clamped, so callers can pass raw ratios safely. */
  value: number;
  /** Classes for the track. Carries the background, height and radius. */
  track: string;
  /** Classes for the fill. Carries its colour, height and radius. */
  fill: string;
  /** Optional label for assistive tech, turning the bar into a real meter. */
  label?: string;
}

/**
 * A determinate progress bar that springs to its value.
 *
 * Replaces the `transition-all duration-1000` linear fills used across the
 * dashboard, progress and compete screens. A linear one-second ramp reads as a
 * loading bar — as though the app were still fetching something. A spring reads
 * as a value settling, which is what these actually are: a number that just
 * changed because the learner did something.
 *
 * `spring.data` has zero bounce on purpose. Overshooting past 94% accuracy and
 * springing back would misreport the figure, however briefly.
 *
 * On `width` rather than `scaleX`: every bar in the product is `rounded-full`
 * at a 1.5-2px radius, and scaling horizontally squashes those end caps into
 * visible ellipses at low percentages. Width animates layout, but only for a
 * childless leaf inside a parent of fixed size, so the work is confined to that
 * element and never reaches the page. Correctness of the existing design wins
 * over a compositor property that would change how the bar looks.
 */
export default function SpringBar({ value, track, fill, label }: SpringBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={track}
      {...(label
        ? {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuenow': Math.round(clamped),
            'aria-valuemin': 0,
            'aria-valuemax': 100,
          }
        : {})}
    >
      <m.div
        className={fill}
        initial={{ width: '0%' }}
        animate={{ width: `${clamped}%` }}
        transition={spring.data}
      />
    </div>
  );
}
