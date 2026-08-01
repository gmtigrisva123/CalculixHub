/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The motion primitive set.
 *
 * Screens import from here rather than reaching for `motion/react` directly, so
 * that the shared behaviours — reveal distance, stagger ceilings, spring choice
 * and reduced-motion handling — stay in one place instead of being re-decided
 * at each call site. Reach past this barrel only for genuinely bespoke motion,
 * such as the SVG chart paths.
 */

export { default as MotionProvider } from './MotionProvider';
export { default as Reveal } from './Reveal';
export { StaggerItem } from './Stagger';
export { default as AnimatedNumber } from './AnimatedNumber';
export { default as SpringBar } from './SpringBar';
export { default as TabTransition } from './TabTransition';
export { default as Collapse } from './Collapse';
