/**
 * The close: a note before you begin, and the two ways in.
 *
 * An ink stage again, so the page ends where it opened. Behind the words a
 * single pencilled line climbs the stage as it is scrolled through — dipping,
 * looping back, and still ending higher than it started — with a point of light
 * at its tip. Progress is rarely a straight line; this one is drawn by the
 * reader's own scrolling, through the follow spring, so it runs on a moment
 * after the scroll stops.
 *
 * Where WebGL runs, the stage draws the line as a tube of light receding into
 * the dark, and when it is fully drawn its tip blooms into a small Lorenz
 * butterfly (sceneFinal.ts): the page ends where it began. The stage reads the
 * very values this component draws with (useStageSpring with a key), so the
 * two can never disagree. The SVG here is the drawing without WebGL; its path
 * (finalLine.ts) keeps to the floor under the words and climbs behind the two
 * cards, so it never crosses a line of text.
 */

import { useLayoutEffect, useRef } from 'react';
import { m, useInView, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { Arrow, Magnetic, Rise, SplitText, useSpotlight, useStageArrival } from './kit';
import { useStageScroll, useStageSpring } from './stageLayout';
import { useStageState } from './ThreadStage';
import { FINAL_ARRIVAL_KEY, FINAL_DRAWN_KEY, FINAL_PATH } from './finalLine';
import { useMediaQuery } from '../../hooks/useBreakpoint';

interface FinalStageProps {
  onRegister: () => void;
}

export default function FinalStage({ onRegister }: FinalStageProps) {
  const reduce = Boolean(useReducedMotion());
  const gl = useStageState();
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  /*
   * The line must finish where it can be seen, because its end is where the
   * butterfly opens. On a wide stage it ends near the stage's top-right corner,
   * so it is drawn as the stage rises into view and done as its top reaches
   * the top of the screen. On a narrow one it runs along the stage's floor,
   * so it is drawn as that floor comes up the screen.
   */
  const wide = useMediaQuery('(min-width: 961px)');
  const wideProgress = useStageScroll(sectionRef, ['start 0.9', 'start 0.04']);
  const narrowProgress = useStageScroll(sectionRef, ['end 1.05', 'end 0.7']);
  // The line is drawn by the scroll, through the follow spring: it keeps pace while the reader
  // scrolls and runs on a moment after they stop, the way a pencil finishes its stroke.
  const eased = useStageSpring(wide ? wideProgress : narrowProgress, { key: FINAL_DRAWN_KEY, still: reduce });
  const drawn = useTransform(eased, [0, 0.85], [reduce ? 1 : 0.02, 1]);
  const arrival = useStageArrival(sectionRef, FINAL_ARRIVAL_KEY);

  /*
   * The pencil tip rides the end of the drawn line. Finding a point along an
   * SVG path makes the browser bring its layout up to date first, so it is
   * only asked for while the stage is on screen: this section is at the foot
   * of the page, and placing its tip on every spring tick while the reader was
   * still at the top was costing a fifth of a second of forced layout during
   * the page's first seconds. The path's length never changes, so it is
   * measured once.
   */
  // While the stage draws the line in 3D the SVG is put away, and asking it for points would only cost a layout.
  const onScreen = useInView(sectionRef, { margin: '300px 0px' }) && gl !== 'on';
  const length = useRef(0);
  const placeTip = (value: number) => {
    const path = pathRef.current;
    const tip = tipRef.current;
    if (!path || !tip) return;
    length.current ||= path.getTotalLength();
    const point = path.getPointAtLength(length.current * Math.max(0, Math.min(1, value)));
    tip.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  };
  useMotionValueEvent(drawn, 'change', value => { if (onScreen) placeTip(value); });
  useLayoutEffect(() => { if (onScreen) placeTip(drawn.get()); }, [drawn, onScreen]);

  return (
    <section ref={sectionRef} className="lx-final" id="begin" aria-labelledby="lx-final-title">
      <m.div className="lx-final-stage" data-tone="ink" style={arrival}>
        <svg className="lx-final-curve" data-gl-swap viewBox="0 0 1240 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d={FINAL_PATH} className="lx-final-trace" />
          {/* A wide, faint stroke under the line for its glow: a filter here would be re-rasterised on every frame it draws. */}
          <m.path d={FINAL_PATH} className="lx-final-glow" style={{ pathLength: drawn }} />
          <m.path ref={pathRef} d={FINAL_PATH} className="lx-final-line" style={{ pathLength: drawn }} />
          <g ref={tipRef}>
            <circle r="22" className="lx-final-halo" />
            <circle r="5.5" className="lx-final-tip" />
          </g>
        </svg>

        <div className="lx-wrap lx-final-grid">
          <div className="lx-final-letter">
            <SplitText as="h2" id="lx-final-title" className="lx-h2" text={'You’re allowed\nto *not know yet.*'} />
            <Rise as="p" className="lx-lead">Cross things out. Try a smaller case. Come back tomorrow.</Rise>
          </div>

          <div className="lx-final-paths">
            <PathCard
              title="Try a problem"
              copy="Pick one and give it a go."
              action="Open practice"
              href="/?auth=signup&tab=learn"
              delay={0}
            />
            <PathCard
              title="Find your level"
              copy="A quiz that adapts as you answer."
              action="Create a free account"
              onClick={onRegister}
              featured
              delay={0.1}
            />
          </div>
        </div>
        <p className="lx-final-caption" aria-hidden="true">progress is rarely a straight line.</p>
      </m.div>
    </section>
  );
}

interface PathCardProps {
  title: string;
  copy: string;
  action: string;
  href?: string;
  onClick?: () => void;
  featured?: boolean;
  delay: number;
}

function PathCard({ title, copy, action, href, onClick, featured = false, delay }: PathCardProps) {
  const ref = useSpotlight<HTMLAnchorElement & HTMLButtonElement>();
  const body = (
    <>
      <span className="lx-path-title">
        {title}
        <span className="lx-path-icon" aria-hidden="true"><Arrow size={18} /></span>
      </span>
      <span className="lx-path-copy">{copy}</span>
      <span className="lx-path-action">{action} <Arrow direction="right" size={15} /></span>
    </>
  );
  const className = featured ? 'lx-path lx-spot is-featured' : 'lx-path lx-spot';
  return (
    <Rise delay={delay} y={40} panel>
      <Magnetic strength={0.06} className="lx-path-magnet">
        {href
          ? <a ref={ref} className={className} href={href}>{body}</a>
          : <button ref={ref} type="button" className={className} onClick={onClick}>{body}</button>}
      </Magnetic>
    </Rise>
  );
}
