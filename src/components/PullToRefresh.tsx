/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

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
      return;
    }

    setPull(Math.min(MAX_PULL, delta * RESISTANCE));
  };

  const onPointerUp = async () => {
    if (startY.current === null || refreshing) return;
    startY.current = null;

    if (pull < THRESHOLD) {
      setPull(0);
      return;
    }

    // Hold the indicator open at the threshold while the work runs, so a fast
    // refresh still reads as having done something.
    setRefreshing(true);
    setPull(THRESHOLD);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
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
      <div
        className="flex items-end justify-center overflow-hidden text-ink-400"
        style={{
          height: pull,
          // Animate the spring-back, but not the drag itself: transitioning
          // while the finger is down makes the indicator lag behind it.
          transition: startY.current === null ? 'height 200ms ease-out' : 'none',
        }}
      >
        <RefreshCw
          className={`w-4 h-4 mb-3 shrink-0 transition-colors ${
            armed ? 'text-brass-600' : 'text-ink-300'
          } ${refreshing ? 'animate-spin' : ''}`}
          style={{
            // Before the threshold the icon tracks the drag; past it, it holds
            // still to signal that releasing will now do something.
            transform: refreshing ? undefined : `rotate(${Math.min(pull, THRESHOLD) * 3}deg)`,
          }}
          aria-hidden="true"
        />
      </div>

      {children}
    </div>
  );
}
