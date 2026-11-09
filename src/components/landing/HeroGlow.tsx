/**
 * The light the hero spills onto its frame.
 *
 * The hero stage is lit from within, so the strip of paper round it catches
 * some of that light: a soft bloom of teal and brass — the butterfly's colours
 * and the lamp's — that drifts slowly round the stage, and a fine rim where
 * the light meets the edge. Both sit behind the stage, so only the frame shows
 * them. They fade as the next sheet slides over and the stage recedes.
 */

import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';

export default function HeroGlow({ cover }: { cover: MotionValue<number> }) {
  const reduce = Boolean(useReducedMotion());
  const opacity = useTransform(cover, [0, 0.25], [1, 0]);
  return (
    <m.div className="lxg" aria-hidden="true" style={reduce ? undefined : { opacity }}>
      <div className="lxg-bloom" />
      <div className="lxg-bloom lxg-bloom-wide" />
      <div className="lxg-rim" />
    </m.div>
  );
}
