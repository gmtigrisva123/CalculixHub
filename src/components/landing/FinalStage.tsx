/**
 * The close: a note before you begin, and the two ways in.
 *
 * An ink stage again, so the page ends where it opened. Behind the words a
 * single pencilled line climbs the stage as it is scrolled through — dipping,
 * looping back, and still ending higher than it started — with a point of light
 * at its tip. Progress is rarely a straight line; this one is drawn by the
 * reader's own scrolling.
 */

import { useLayoutEffect, useRef } from 'react';
import { m, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Arrow, Eyebrow, Magnetic, Rise, SplitText, useSpotlight } from './kit';

/*
 * The line keeps to the floor of the stage under the words, then climbs behind
 * the two path cards and breaks out above them: it never crosses a line of text.
 */
const PATH = 'M-20 652C80 652 140 612 220 616S330 668 400 642 470 566 540 592 610 662 680 612 720 482 760 422 820 302 880 332 960 382 1010 262 1080 122 1150 140 1196 96 1222 70';

interface FinalStageProps {
  onRegister: () => void;
}

export default function FinalStage({ onRegister }: FinalStageProps) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 0.9', 'end 0.75'] });
  const drawn = useTransform(scrollYProgress, [0, 0.85], [reduce ? 1 : 0.02, 1]);

  const placeTip = (value: number) => {
    const path = pathRef.current;
    const tip = tipRef.current;
    if (!path || !tip) return;
    const point = path.getPointAtLength(path.getTotalLength() * Math.max(0, Math.min(1, value)));
    tip.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  };
  useMotionValueEvent(drawn, 'change', placeTip);
  useLayoutEffect(() => placeTip(drawn.get()), [drawn]);

  return (
    <section ref={sectionRef} className="lx-final" id="begin" aria-labelledby="lx-final-title">
      <div className="lx-final-stage" data-tone="ink">
        <svg className="lx-final-curve" viewBox="0 0 1240 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d={PATH} className="lx-final-trace" />
          <m.path ref={pathRef} d={PATH} className="lx-final-line" style={{ pathLength: drawn }} />
          <g ref={tipRef}>
            <circle r="22" className="lx-final-halo" />
            <circle r="5.5" className="lx-final-tip" />
          </g>
        </svg>

        <div className="lx-wrap lx-final-grid">
          <div className="lx-final-letter">
            <Eyebrow>A note before you begin</Eyebrow>
            <SplitText as="h2" id="lx-final-title" className="lx-h2" text={'You’re allowed\nto *not know yet.*'} />
            <Rise as="p" className="lx-lead">Cross things out. Try a smaller case. Come back tomorrow.</Rise>
            <Rise as="p" className="lx-final-signoff" delay={0.08}>Bring a little patience. We’ll bring the questions.</Rise>
          </div>

          <div className="lx-final-paths">
            <PathCard
              note="Follow your curiosity"
              title="Explore a problem"
              copy="Pick one and give it a go."
              action="Open practice"
              href="/?auth=signup&tab=learn"
              delay={0}
            />
            <PathCard
              note="Find your starting point"
              title="Discover your level"
              copy="A quiz that adapts as you answer."
              action="Create a free account"
              onClick={onRegister}
              featured
              delay={0.1}
            />
          </div>
        </div>
        <p className="lx-final-caption" aria-hidden="true">progress is rarely a straight line.</p>
      </div>
    </section>
  );
}

interface PathCardProps {
  note: string;
  title: string;
  copy: string;
  action: string;
  href?: string;
  onClick?: () => void;
  featured?: boolean;
  delay: number;
}

function PathCard({ note, title, copy, action, href, onClick, featured = false, delay }: PathCardProps) {
  const ref = useSpotlight<HTMLAnchorElement & HTMLButtonElement>();
  const body = (
    <>
      <span className="lx-path-note">{note}</span>
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
    <Rise delay={delay} y={40} blur={false}>
      <Magnetic strength={0.06} className="lx-path-magnet">
        {href
          ? <a ref={ref} className={className} href={href}>{body}</a>
          : <button ref={ref} type="button" className={className} onClick={onClick}>{body}</button>}
      </Magnetic>
    </Rise>
  );
}
