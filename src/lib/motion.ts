/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Transition, Variants } from 'motion/react';

/**
 * CalculixHub Motion Design System — the single source of timing truth.
 *
 * Every animated surface in the product, web or iOS, reads its durations,
 * easings and springs from this file. The same values are mirrored as CSS
 * custom properties in index.css (`--mo-*`) so Tailwind utility classes and
 * Motion components move on identical curves; changing a value here and there
 * changes it everywhere rather than leaving two systems to drift apart.
 *
 * The app ships as a Capacitor WKWebView on iOS, so the web bundle *is* the
 * native app. That makes iOS the reference platform for feel: the house curves
 * below are Apple's, not generic web easing, and the defaults favour springs
 * over fixed-duration tweens for anything the user directly manipulates.
 */

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/**
 * Seconds, because that is Motion's unit. The CSS mirror in index.css carries
 * the same numbers in milliseconds.
 *
 * The scale is deliberately short. Nielsen's 100ms threshold for "instant" and
 * Apple's own UIKit defaults both sit well under a third of a second; anything
 * past `slower` reads as the interface being slow rather than considered.
 */
export const duration = {
  /** Press/release feedback. Below this the user cannot perceive the change. */
  instant: 0.1,
  /** Colour, opacity and other non-spatial micro-feedback. */
  fast: 0.16,
  /** The default for most discrete state changes. */
  base: 0.24,
  /** Panels, sheets, and anything crossing a meaningful distance. */
  slow: 0.34,
  /** Large surfaces and first-paint reveals. */
  slower: 0.48,
  /** Data settling into place: chart draw-on, counters. Never interactive. */
  deliberate: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Easing curves
// ---------------------------------------------------------------------------

/**
 * Cubic-bezier control points, in Motion's tuple form.
 *
 * `standard` is the curve iOS uses for sheet presentation — a very fast start
 * that decelerates hard into the target. It is the house entrance curve and
 * should be the default choice for anything arriving on screen.
 *
 * `emphasized` predates this system: it is the curve the AI tutor sheet already
 * animated on. It is kept, and reused, so the one hand-authored animation in
 * the original codebase stays consistent with everything built around it.
 */
export const ease = {
  /** Entrances and most state changes. Apple's sheet curve. */
  standard: [0.32, 0.72, 0, 1],
  /** Settles with a touch of overshoot. For surfaces that should feel physical. */
  emphasized: [0.2, 0.9, 0.3, 1],
  /**
   * Exits. Accelerating away is correct: leaving content should get out of the
   * way immediately rather than lingering, which is why exits are also shorter
   * than the entrance that replaces them.
   */
  exit: [0.4, 0, 1, 1],
  /** Symmetric, for reversible transitions like a toggle or an accordion. */
  inOut: [0.65, 0, 0.35, 1],
} as const;

// ---------------------------------------------------------------------------
// Springs
// ---------------------------------------------------------------------------

/**
 * Springs are expressed with `visualDuration` + `bounce` rather than raw
 * stiffness/damping/mass.
 *
 * `visualDuration` is the time until the animation *appears* to arrive, with
 * the bounce resolving after. That makes a spring directly comparable to a
 * tween of the same number, so a spring-driven panel and a CSS-driven fade can
 * be tuned to land together — impossible to do reliably with stiffness values.
 */
export const spring = {
  /** Press and release. Tight, with enough bounce to feel tactile. */
  press: { type: 'spring', visualDuration: 0.18, bounce: 0.3 },
  /** Small elements: chips, icons, badges, tab pills. */
  snappy: { type: 'spring', visualDuration: 0.26, bounce: 0.16 },
  /** The default. Panels, cards, tab content, list items. */
  smooth: { type: 'spring', visualDuration: 0.34, bounce: 0.18 },
  /** Large surfaces that should feel weighty: sheets, drawers, modals. */
  gentle: { type: 'spring', visualDuration: 0.46, bounce: 0.12 },
  /**
   * Data settling. Zero bounce — a progress bar that overshoots its value is
   * lying about the number, however briefly.
   */
  data: { type: 'spring', visualDuration: 0.7, bounce: 0 },
} satisfies Record<string, Transition>;

// ---------------------------------------------------------------------------
// Travel distances
// ---------------------------------------------------------------------------

/**
 * How far things move, in pixels.
 *
 * Kept small on purpose. The offset exists to communicate direction and
 * hierarchy, not to draw attention to itself; past roughly 24px a reveal stops
 * reading as "settling into place" and starts reading as "flying in".
 */
export const travel = {
  /** Exits, and nudges within a component. */
  xs: 4,
  /** The default reveal distance. */
  sm: 8,
  /** Section reveals on the landing page, where there is more room. */
  md: 12,
  /** Sheets and drawers, which move a real distance. */
  lg: 16,
} as const;

// ---------------------------------------------------------------------------
// Composed transitions
// ---------------------------------------------------------------------------

/** Ready-made transitions for the cases that recur across the product. */
export const transition = {
  /** Non-spatial changes: colour, opacity, shadow. */
  micro: { duration: duration.fast, ease: ease.standard },
  /** The default tween where a spring would be overkill. */
  base: { duration: duration.base, ease: ease.standard },
  /** Anything leaving the screen. */
  exit: { duration: duration.fast, ease: ease.exit },
  /** Chart paths and other one-shot data reveals. */
  draw: { duration: duration.deliberate, ease: ease.standard },
} satisfies Record<string, Transition>;

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * The house reveal: fade up a short distance, settle on a spring.
 *
 * Used by section reveals, tab panels and staggered list items so that
 * everything entering the viewport shares one motion signature. Exits are a
 * plain fast tween in the opposite direction — asymmetry is intentional, since
 * arriving deserves more attention than departing.
 */
export const fadeLift: Variants = {
  hidden: { opacity: 0, y: travel.sm },
  visible: { opacity: 1, y: 0, transition: spring.smooth },
  exit: { opacity: 0, y: -travel.xs, transition: transition.exit },
};

/** Opacity only. The reduced-motion fallback, and correct for pure crossfades. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.exit },
};

/**
 * Stagger container.
 *
 * `staggerChildren` is small — a longer gap turns a six-card grid into a
 * sequence the user has to wait out. `delayChildren` covers the frame or two
 * the browser needs to settle layout before the first child moves.
 */
export const staggerGroup: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.035, delayChildren: 0.02 },
  },
  exit: {},
};

/** Dialogs and centred modals: scale up fractionally as they fade in. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: travel.sm },
  visible: { opacity: 1, scale: 1, y: 0, transition: spring.gentle },
  exit: { opacity: 0, scale: 0.98, y: travel.xs, transition: transition.exit },
};

/** Bottom sheets. Travels its own height, so it is driven by percentage. */
export const sheetUp: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: spring.gentle },
  exit: { y: '100%', transition: { duration: duration.base, ease: ease.exit } },
};

/** Right-hand drawers, the md+ form of the same surface as `sheetUp`. */
export const drawerRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: spring.gentle },
  exit: { x: '100%', transition: { duration: duration.base, ease: ease.exit } },
};

/** Scrims behind sheets, drawers and modals. */
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: ease.standard } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.exit } },
};

// ---------------------------------------------------------------------------
// Stagger budget
// ---------------------------------------------------------------------------

/**
 * Per-index delay for a staggered list, capped.
 *
 * A fixed per-item delay is fine for four cards and unacceptable for forty: the
 * last row of a long leaderboard would arrive seconds after the first. Clamping
 * the total means large lists still read as a wave without the tail dragging.
 *
 * Used where items animate individually (a `.map` over data) rather than
 * through `staggerGroup`, which has no equivalent ceiling.
 */
export const staggerDelay = (index: number, step = 0.035, max = 0.28): number =>
  Math.min(index * step, max);
