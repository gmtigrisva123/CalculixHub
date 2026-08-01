/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { m, useSpring, useTransform } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { spring } from '../lib/motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

/** Drag distance, in px, at which releasing triggers a refresh. */
const THRESHOLD = 64;

/** Hard cap on the spacer, so a long drag cannot push content off-screen. */
const MAX_PULL = 96;

/**
 * Resistance applied to the drag.
 *
 * The spacer grows at a fraction of finger travel, which is what makes the
 * gesture feel elastic rather than like dragging a panel. Matches the damping
 * iOS uses for its own scroll rubber-banding closely enough to feel native.
 */
const RESISTANCE = 0.5;

/**
 * Pull-to-refresh for the mobile workspace.
 *
 * Pointer events rather than touch events, so the gesture is exercisable with a
 * mouse and testable in a desktop browser; `touch-action: pan-y` keeps vertical
 * scrolling native rather than reimplementing it.
 *
 * The gesture only begins at the very top of the page. Starting it mid-scroll
 * would fight the browser's own scrolling, and pulling down from anywhere else
 * should keep scrolling up.
 */
export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  /**
   * The indicator's height, as a spring rather than a CSS transition.
   *
   * The original implementation toggled a `height 200ms ease-out` transition on
   * and off depending on whether a finger was down, because transitioning
   * during the drag made the indicator lag behind the finger. The same split
   * survives here but expressed through the motion value instead of the
   * stylesheet: `jump` during the drag writes the value with no animation at
   * all, and `set` on release lets the spring run. One value, two behaviours,
   * no stylesheet switching.
   *
   * Tuned slightly overdamped so the snap back has weight without wobbling —
   * a bouncing refresh indicator reads as a toy rather than as UIScrollView's
   * own rubber-banding, which is what this is imitating.
   */
  const height = useSpring(0, { stiffness: 700, damping: 42, mass: 0.9 });

  /**
   * The icon's rotation is derived from the pull rather than stored separately,
   * so it can never disagree with the indicator's position, and it runs on the
   * compositor instead of being recalculated in React on every pointer move.
   */
  const iconRotation = useTransform(height, [0, THRESHOLD], [0, 190], {
    clamp: true,
  });

  const atTop = () => window.scrollY <= 0;

  const onPointerDown = (event: React.PointerEvent) => {
    // Ignore secondary buttons and any drag that does not start at the top.
    if (refreshing || event.button !== 0 || !atTop()) return;
    startY.current = event.clientY;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (startY.current === null || refreshing) return;

    const delta = event.clientY - startY.current;

    // Upward movement means the user is scrolling, not pulling. Abandon.
    if (delta <= 0) {
      startY.current = null;
      setPull(0);
      height.set(0);
      return;
    }

    const next = Math.min(MAX_PULL, delta * RESISTANCE);
    setPull(next);
    // `jump` rather than `set`: while the finger is down the indicator must be
    // exactly where the finger put it. Springing toward each pointer sample
    // would introduce a few frames of lag, and a pull-to-refresh that trails
    // the thumb feels broken however good the physics are.
    height.jump(next);
  };

  const onPointerUp = async () => {
    if (startY.current === null || refreshing) return;
    startY.current = null;

    if (pull < THRESHOLD) {
      setPull(0);
      // `set` here, so the spring takes over and the snap back has momentum.
      height.set(0);
      return;
    }

    // Hold the indicator open at the threshold while the work runs, so a fast
    // refresh still reads as having done something.
    setRefreshing(true);
    setPull(THRESHOLD);
    height.set(THRESHOLD);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
      height.set(0);
    }
  };

  const armed = pull >= THRESHOLD;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: 'pan-y' }}
    >
      <m.div
        className="flex items-end justify-center overflow-hidden text-ink-400"
        style={{ height }}
      >
        {/*
          Two states, cleanly separated. While the user is pulling, the icon is
          rotated by a motion value derived from the drag, so it turns under the
          thumb and comes to rest once the threshold is armed. Once the refresh
          is running it hands over to the CSS spinner, and the inline transform
          is dropped so the two never fight over the same property.

          The armed state also gets a small scale bump — the moment the gesture
          becomes committed is the one thing here worth confirming physically.
        */}
        <m.div
          className="mb-3 shrink-0"
          style={refreshing ? undefined : { rotate: iconRotation }}
          animate={{ scale: armed && !refreshing ? 1.15 : 1 }}
          transition={spring.press}
        >
          <RefreshCw
            className={`w-4 h-4 transition-colors duration-160 ease-standard ${
              armed ? 'text-brass-600' : 'text-ink-300'
            } ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </m.div>
      </m.div>

      {children}
    </div>
  );
}
