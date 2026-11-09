/**
 * The hero's frame: a pearl mount with a neon edge.
 *
 * The strip of paper round the hero stage is drawn as mother-of-pearl, its
 * colours drifting and a satin sheen sweeping across it now and then. The
 * stage edge is a tube of light — cyan, teal, gold, coral and violet — that
 * blooms outward onto the pearl and inward onto the dark, with two white-hot
 * sparks chasing each other round it. Small stars twinkle in the frame.
 *
 * The colour never repaints: each ring holds one large square of conic
 * gradient that only *rotates* (a transform the GPU does on its own), seen
 * through a rounded clip or a ring-shaped mask that stays still. So the light
 * runs round the edge without a single gradient being redrawn per frame.
 *
 * Two layers: one behind the stage (only the frame shows it) and one in front,
 * which never reaches more than a few pixels past the stage edge and never
 * takes a pointer. Both fade as the next sheet slides over the hero, because
 * by then the stage has started to recede from the screen edge.
 */

import { useMemo, type CSSProperties } from 'react';
import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { mulberry32 } from './particleShapes';

const SPARKLES = 28;

const Spin = ({ sparks = false }: { sparks?: boolean }) => <i className={sparks ? 'lxg-spin lxg-spin-sparks' : 'lxg-spin'} />;

export default function HeroGlow({ cover }: { cover: MotionValue<number> }) {
  const reduce = Boolean(useReducedMotion());
  const opacity = useTransform(cover, [0, 0.25], [1, 0]);
  const style = reduce ? undefined : { opacity };

  // Stars sit on the centre line of the frame, spread round all four sides.
  const sparkles = useMemo(() => {
    const rng = mulberry32(2026);
    return Array.from({ length: SPARKLES }, (_, i) => {
      const side = i % 4;
      const along = 4 + rng() * 92;
      const size = 12 + rng() * 12;
      const pos =
        side === 0 ? { left: `${along}%`, top: 'calc(var(--lx-frame) / 2)' }
          : side === 1 ? { left: 'calc(100% - var(--lx-frame) / 2)', top: `${along}%` }
            : side === 2 ? { left: `${along}%`, top: 'calc(100% - var(--lx-frame) / 2)' }
              : { left: 'calc(var(--lx-frame) / 2)', top: `${along}%` };
      return {
        ...pos,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${2.2 + rng() * 2.8}s`,
        animationDelay: `${-rng() * 5}s`,
        '--lxg-hue': rng() < 0.6 ? 'var(--lxg-gold)' : rng() < 0.5 ? 'var(--lxg-cyan)' : 'var(--lxg-coral)',
      } as CSSProperties;
    });
  }, []);

  return (
    <>
      <m.div className="lxg lxg-back" aria-hidden="true" style={style}>
        <div className="lxg-pearl" />
        <div className="lxg-satin" />
        <div className="lxg-clip lxg-bloom"><Spin /></div>
        <div className="lxg-clip lxg-rim"><Spin /></div>
        <div className="lxg-stars">
          {sparkles.map((s, i) => <i key={i} style={s} />)}
        </div>
      </m.div>
      <m.div className="lxg lxg-front" aria-hidden="true" style={style}>
        <div className="lxg-haze"><div className="lxg-clip lxg-ring lxg-ring-thick"><Spin /></div></div>
        <div className="lxg-clip lxg-ring lxg-ring-core"><Spin /></div>
        <div className="lxg-haze lxg-haze-spark"><div className="lxg-clip lxg-ring lxg-ring-glint"><Spin sparks /></div></div>
        <div className="lxg-clip lxg-ring lxg-ring-spark"><Spin sparks /></div>
      </m.div>
    </>
  );
}
