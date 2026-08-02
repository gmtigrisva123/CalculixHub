/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { spring } from '../../lib/motion';

/**
 * A surface that responds to the pointer as a physical object would.
 *
 * Three things happen together, and it only works because they happen together:
 * the card rotates a little away from the cursor, a specular highlight tracks
 * the cursor across its face, and any child marked as a layer floats above the
 * surface in real 3D. Rotation alone reads as a gimmick; rotation plus a light
 * that stays consistent with it reads as a solid object under a lamp.
 *
 * Restraint is the whole design here. `MAX_TILT` is six degrees, which is far
 * less than the fifteen or twenty these effects usually use — at that angle text
 * visibly keystones and the card becomes something you play with instead of
 * something you read. Six degrees is enough for the eye to register depth and
 * small enough that a paragraph on the card stays perfectly legible.
 *
 * It is also, deliberately, a pointer-only effect. There is no hover on a
 * touchscreen: the finger arrives already touching, so a tilt would fire on tap
 * and fight the press animation. On the iOS build this component renders as a
 * plain static surface, which is the correct behaviour rather than a limitation.
 */

/**
 * Degrees of rotation at the very corner of the card.
 *
 * Scale this down as the surface grows. Rotation is angular but the travel it
 * produces is proportional to the distance from the centre, so the same six
 * degrees that feel tactile on a 260px stat card throw the corner of a
 * full-width hero a very long way and start to keystone its headline.
 */
const MAX_TILT = 6;

/*
 * The drag and animation handlers are omitted because Motion redefines them.
 * React's `onAnimationStart` receives a DOM AnimationEvent; Motion's receives
 * the animation definition, and the two signatures are not compatible. Since
 * this component forwards its rest props onto an `m.div`, the React versions
 * have to be off the table rather than silently shadowed.
 */
interface TiltCardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  children: React.ReactNode;
  /** Disables the effect without changing the markup — for a card in a busy grid. */
  disabled?: boolean;
  /** Strength of the tracking highlight, 0–1. */
  glare?: number;
  /** Corner rotation in degrees. Lower it for large surfaces. */
  maxTilt?: number;
}

export default function TiltCard({
  children,
  disabled = false,
  glare = 0.14,
  maxTilt = MAX_TILT,
  className = '',
  style,
  ...rest
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  /*
   * Motion values rather than React state.
   *
   * A pointermove handler that called setState would re-render this subtree on
   * every mouse position — hundreds of renders a second, each one reconciling
   * children that have not changed. Motion values write straight to the DOM node
   * and never touch React's render cycle, which is what makes a per-frame effect
   * affordable at all.
   */
  const rotateX = useSpring(useMotionValue(0), spring.smooth);
  const rotateY = useSpring(useMotionValue(0), spring.smooth);

  // Highlight position, in percent, following the pointer with a softer spring
  // so the light lags the geometry very slightly — as a real reflection does.
  const glareX = useSpring(useMotionValue(50), spring.gentle);
  const glareY = useSpring(useMotionValue(50), spring.gentle);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / ${glare}), transparent 55%)`;

  const inactive = disabled || reduceMotion;

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Mouse and pen only. A coarse pointer has no hover state to speak of.
    if (inactive || event.pointerType === 'touch') return;

    const node = ref.current;
    if (!node) return;

    const box = node.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;

    /*
     * Y drives rotateX and X drives rotateY — the axes cross, because tilting
     * "toward" a pointer that is high on the card is a rotation about the
     * horizontal axis. The sign on rotateX is negative so the card leans away
     * from the cursor rather than into it, which is what makes the near edge
     * appear to rise toward the viewer.
     */
    rotateX.set(-(py - 0.5) * 2 * maxTilt);
    rotateY.set((px - 0.5) * 2 * maxTilt);
    glareX.set(px * 100);
    glareY.set(py * 100);
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    glareX.set(50);
    glareY.set(50);
  };

  if (inactive) {
    return (
      <div ref={ref} className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }

  return (
    /*
     * Perspective lives on the wrapper, not on the rotating element. Applied to
     * the element itself it would be recomputed as part of its own transform and
     * the vanishing point would travel with the rotation, which flattens the
     * effect at exactly the angles where it should be strongest.
     */
    <div
      className="[perspective:1200px]"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <m.div
        ref={ref}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d', ...style }}
        className={`relative ${className}`}
        {...rest}
      >
        {children}

        {/*
          The highlight sits above the content and ignores the pointer. It is a
          sibling rather than a background on the card so it can stay pure white
          at low alpha in both themes — a specular reflection is the colour of
          the light source, not of the material it lands on.
        */}
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-10"
          style={{ background: glareBackground }}
        />
      </m.div>
    </div>
  );
}

/**
 * A child that floats above the tilting surface.
 *
 * `translateZ` inside a `preserve-3d` parent is what turns a rotation into
 * parallax: layers at different depths sweep across each other as the card
 * moves, which is the cue the eye actually reads as three-dimensionality. The
 * rotation on its own only skews a flat picture.
 */
export function TiltLayer({
  depth = 24,
  className = '',
  children,
}: {
  depth?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} style={{ transform: `translateZ(${depth}px)` }}>
      {children}
    </div>
  );
}
