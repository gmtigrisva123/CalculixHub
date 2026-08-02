/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * The card.
 *
 * Every surface in the product used to be spelled out at its call site as some
 * variation on `bg-white border border-stone-200 p-5 rounded-2xl shadow-xs`.
 * Ninety-six of those strings existed, no two of them agreed, and each one
 * hard-coded a lighting condition that no theme switch could reach. This
 * component is where that decision is made once.
 *
 * `tone` is the interesting parameter. It is not a colour — it is what the
 * surface is *for*, and the elevation, the material and the border follow from
 * it. A `raised` card and a `sunken` well are not the same rectangle in two
 * shades; they sit on opposite sides of the page and catch light differently.
 */

type Tone = 'raised' | 'flush' | 'sunken' | 'inverse';
type Elevation = 0 | 1 | 2 | 3 | 4 | 5;

const TONE: Record<Tone, string> = {
  /** A sheet of paper lying on the page. The default for content. */
  raised: 'bg-surface-raised border-line text-content',
  /** Same plane as the page: grouping without claiming height. */
  flush: 'bg-surface border-line text-content',
  /** Recessed into the page: wells, tracks, empty states. */
  sunken: 'bg-surface-sunken border-line-faint text-content',
  /**
   * The ink block in daylight, the paper block at night. Used for heroes and
   * anything that should read as the opposite material to its surroundings.
   */
  inverse: 'bg-surface-inverse border-transparent text-content-inverse',
};

const ELEVATION: Record<Elevation, string> = {
  0: '',
  1: 'shadow-e1',
  2: 'shadow-e2',
  3: 'shadow-e3',
  4: 'shadow-e4',
  5: 'shadow-e5',
};

const RADIUS = {
  card: 'rounded-card',
  panel: 'rounded-panel',
  control: 'rounded-control',
  none: '',
} as const;

/*
 * Attributes are typed against the generic `HTMLElement` rather than
 * `HTMLDivElement`. A polymorphic component whose props are pinned to a div
 * cannot be rendered as anything else — every event handler would be declared
 * over the wrong element type — and `as="li"` is genuinely useful for the
 * leaderboard and discussion lists.
 */
interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  tone?: Tone;
  elevation?: Elevation;
  radius?: keyof typeof RADIUS;
  /**
   * Paper tooth. On by default for raised surfaces and off for the rest —
   * grain on a recessed well reads as dirt rather than as fibre.
   */
  grain?: boolean;
  /** Drafting registration marks. Reserved for genuinely notable surfaces. */
  brackets?: boolean;
  /**
   * Lifts on hover. Only for surfaces that are themselves a link or button;
   * a card that rises under the pointer and then does nothing is a lie about
   * what is clickable.
   */
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}

export default function Panel({
  tone = 'raised',
  elevation = 1,
  radius = 'card',
  grain,
  brackets = false,
  interactive = false,
  as = 'div',
  className = '',
  children,
  ...rest
}: PanelProps) {
  const Tag = as as React.ElementType;
  const withGrain = grain ?? (tone === 'raised' || tone === 'inverse');

  /*
   * The hover lift animates `box-shadow` and `translate` only. Animating the
   * shadow alone is the common version and it looks inert, because a real object
   * that casts a longer shadow has also moved further from the surface — the
   * one-pixel rise is what sells the other half of the effect.
   */
  const lift = interactive
    ? 'transition-[box-shadow,transform,border-color] duration-240 ease-standard hover:-translate-y-px hover:shadow-e3 hover:border-line-strong'
    : '';

  return (
    <Tag
      className={[
        'border',
        TONE[tone],
        ELEVATION[elevation],
        RADIUS[radius],
        withGrain ? 'material-card' : '',
        brackets ? 'bp-corners' : '',
        lift,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
