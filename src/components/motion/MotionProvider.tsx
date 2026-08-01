/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { transition } from '../../lib/motion';

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app in the shared motion runtime. Mounted once, in main.tsx.
 *
 * `LazyMotion` + the `m` components exist so the feature set is imported once
 * here rather than pulled in whole at every call site by `motion.*`. `strict`
 * makes that a build-time contract: touching `motion.div` anywhere in the app
 * throws, which is the only reliable way to stop the heavier import creeping
 * back in as the codebase grows.
 *
 * `domMax` rather than `domAnimation` because the mobile tab rail needs shared
 * layout animation — the active tab grows from flex 1 to 1.6, and projecting
 * that through transforms is what keeps it off the layout path.
 *
 * `reducedMotion="user"` is the accessibility contract for every Motion-driven
 * animation in the product. It follows the OS setting and, when reduction is
 * requested, drops transform and layout animation while keeping opacity — which
 * is what Apple's own Reduce Motion does. State changes stay legible; nothing
 * simply vanishes. CSS-driven animation is handled separately, by the
 * `prefers-reduced-motion` block in index.css.
 */
export default function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={transition.base}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
