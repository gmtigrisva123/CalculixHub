/**
 * The hero's frame: a pearl mount with an edge of light.
 *
 * The strip of paper round the hero stage is tinted like mother-of-pearl, and
 * the stage's edge is a thin tube of light whose colours (cyan, teal, gold,
 * coral, violet) travel slowly round it, with two brighter glints among them.
 *
 * All of that is one moving thing. A single large square of conic gradient
 * turns behind the stage (`.lxg-spin`); turning is a transform, which the GPU
 * does by itself without the page being painted again. Everything else here is
 * still: a pearl veil over the strip that lets the turning colour tint through
 * and leaves the last few pixels next to the stage uncovered, which is the
 * tube; and, in front, a faint glow on the inside of the stage edge.
 *
 * An earlier frame was built from six turning squares behind ring-shaped masks
 * and blur filters, two full-screen gradients animated by `background-position`
 * and twenty-eight twinkling stars. It looked like one effect and cost like
 * nine: the two gradients alone repainted the whole screen on every frame, for
 * as long as the hero was on screen. It was the main reason the page stuttered
 * on arrival, and the picture did not need any of it.
 *
 * Both layers fade as the next sheet slides over the hero, because by then the
 * stage has started to recede from the screen edge.
 */

import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';

export default function HeroGlow({ cover }: { cover: MotionValue<number> }) {
  const reduce = Boolean(useReducedMotion());
  const opacity = useTransform(cover, [0, 0.25], [1, 0]);
  const style = reduce ? undefined : { opacity };

  return (
    <>
      <m.div className="lxg lxg-back" aria-hidden="true" style={style}>
        <i className="lxg-spin" />
        <i className="lxg-veil" />
        <i className="lxg-sheen" />
      </m.div>
      <m.div className="lxg lxg-front" aria-hidden="true" style={style}>
        <i className="lxg-inner" />
      </m.div>
    </>
  );
}
