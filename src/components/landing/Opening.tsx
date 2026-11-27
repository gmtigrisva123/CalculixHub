/**
 * The first two screens: the hero, and the sheet of paper that slides over it.
 *
 * The hero is an ink stage holding the Lorenz attractor. It is sticky inside this
 * wrapper, so as the reader scrolls the manifesto rises over it like a sheet
 * drawn across a lit table: the stage recedes, its words lift away, and the
 * butterfly loosens into the dark. Once the sheet has covered it, the wrapper ends
 * and the hero leaves with it — it is never uncovered again, which is what lets
 * its render loop stop (the IntersectionObserver sees it go).
 *
 * The idea is the page's thesis in three short lines, lit word by word as they
 * are read: dim words ahead of the reader, full ink behind.
 *
 * Both screens are rendered twice. Once into the HTML at build time
 * (staticMode.tsx), so the hero is the first thing a visitor sees, and once
 * live. The hero's entrance is CSS keyed on the boot script's cue
 * (landing-entrance.css), so it plays from the HTML while the bundles are
 * still on their way, and the live page continues it from wherever it has got
 * to (entrance.ts). The markup is the same in both; only what follows the
 * scroll and what answers a click is added live.
 */

import { forwardRef, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { Arrow, CountUp, Eyebrow, GLIDE, Magnetic, Rise, SIGNUP_HREF, SplitText, linkAction } from './kit';
import { jumpTo } from './LandingNav';
import HeroGlow from './HeroGlow';
import { whenIdle } from '../../lib/lazy';
import { afterChapters } from './chapters';
import { useStatic } from './staticMode';
import { STATS_APPEAR, useEntranceState } from './entrance';

const ParticleField = lazy(() => import('./ParticleField'));

/**
 * The butterfly's code is three.js, most of half a megabyte. Asking for it at
 * mount meant it arrived, was parsed and compiled its shaders in the middle of
 * the headline's entrance.
 *
 * The first seconds are now taken in turn, so no two heavy things overlap: the
 * headline lands; the chapters below are mounted while the hero is still (a
 * busy moment nobody can see, because nothing on screen is moving); and only
 * then is the butterfly asked for. Its particles gather out of the dark on
 * their own, which is the entrance they were written to make. If the chapters
 * are slow to arrive the butterfly does not wait for ever.
 */
function useFieldCue(cued: boolean): boolean {
  const [field, setField] = useState(false);
  useEffect(() => {
    if (!cued) return;
    let live = true;
    let cancelIdle = () => {};
    const show = () => { if (live) cancelIdle = whenIdle(() => { if (live) setField(true); }, 800); };
    void afterChapters().then(show);
    const patience = window.setTimeout(show, 5000);
    return () => { live = false; window.clearTimeout(patience); cancelIdle(); };
  }, [cued]);
  return field;
}

interface OpeningProps {
  onRegister: () => void;
}

export default function Opening({ onRegister }: OpeningProps) {
  const sheetRef = useRef<HTMLElement>(null);
  // 0 while the sheet waits below the fold, 1 once it has covered the hero.
  const { scrollYProgress: cover } = useScroll({ target: sheetRef, offset: ['start end', 'start start'] });
  return (
    <div className="lx-opening">
      <Hero cover={cover} onRegister={onRegister} />
      <Manifesto ref={sheetRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/** The hero's figures, and when each starts to count after the cue (s): just after it appears. */
const COUNT_AT = [STATS_APPEAR + 0.05, STATS_APPEAR + 0.12, STATS_APPEAR + 0.19];

function Hero({ cover, onRegister }: { cover: MotionValue<number>; onRegister: () => void }) {
  const reduce = Boolean(useReducedMotion());
  const isStatic = useStatic();
  const entrance = useEntranceState();
  const [ready, setReady] = useState(false);
  // The entrance has begun: the cue has fired for this page.
  const cued = !isStatic && entrance.startedAt !== null;
  const field = useFieldCue(cued);
  const stageScale = useTransform(cover, [0, 1], [1, reduce ? 1 : 0.9]);
  const stageY = useTransform(cover, [0, 1], ['0vh', reduce ? '0vh' : '-4vh']);
  const copyY = useTransform(cover, [0, 0.8], ['0vh', reduce ? '0vh' : '-16vh']);
  const copyOpacity = useTransform(cover, [0.05, 0.6], [1, 0]);
  const shade = useTransform(cover, [0, 1], [0, 0.55]);
  const release = useTransform(cover, [0, 1], [0, 1]);
  // A count resumes from the static frame's clock: by the time the live page arrives, part of the wait has passed.
  const countDelay = (at: number) => Math.max(0, at - entrance.elapsed / 1000);
  const counting = { start: cued, play: entrance.countUps };

  return (
    <section className="lx-hero" id="top" data-tone="ink" aria-labelledby="lx-hero-title">
      <m.div className="lx-hero-stage" style={{ scale: stageScale, y: stageY }}>
        <div className="lx-hero-sky" aria-hidden="true" />
        {field && <Suspense fallback={null}>
          <ParticleField
            release={release}
            still={reduce}
            className={ready ? 'lx-hero-field is-ready' : 'lx-hero-field'}
            onReady={() => setReady(true)}
          />
        </Suspense>}
        <div className="lx-hero-vignette" aria-hidden="true" />
        <div className="lx-hero-grain" aria-hidden="true" />

        <m.div className="lx-hero-copy" style={{ y: copyY, opacity: copyOpacity }}>
          {/*
            The opening choreography (landing-entrance.css): the headline word
            by word, then the eyebrow, the lead and the two ways in. The buttons
            are on screen inside the first second, and work from the first
            frame: before the page's code arrives they are plain links.
          */}
          <div className="lx-in lx-in-eyebrow">
            <Eyebrow>Competition mathematics · AMC to IMO</Eyebrow>
          </div>
          <SplitText as="h1" id="lx-hero-title" className="lx-hero-title" text={'Stay with\nthe *question*.'} entrance="css" />
          <p className="lx-hero-lead lx-in lx-in-lead">
            Contest problems chosen to fit your level, each with a hint and a full solution.
          </p>
          <div className="lx-hero-actions lx-in lx-in-actions">
            <Magnetic>
              <a className="lx-btn lx-btn-cream" href={SIGNUP_HREF} onClick={linkAction(onRegister)}>
                <span>Find your level</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </a>
            </Magnetic>
            <a className="lx-btn lx-btn-glass" href="#playground" onClick={event => jumpTo(event, 'playground')}>
              <span>Try a problem</span>
              <Arrow direction="down" size={15} />
            </a>
          </div>
        </m.div>

        <m.div className="lx-hero-foot" style={{ opacity: copyOpacity }}>
          <dl className="lx-hero-stats">
            <HeroStat index={0} label="past problems"><CountUp value={ARCHIVE_FIGURES.problems} delay={countDelay(COUNT_AT[0])} {...counting} /></HeroStat>
            <HeroStat index={1} label="real exams"><CountUp value={ARCHIVE_FIGURES.papers} delay={countDelay(COUNT_AT[1])} {...counting} /></HeroStat>
            <HeroStat index={2} label="years of contests">
              {ARCHIVE_FIGURES.firstYear}<span className="lx-dash">–</span>
              {/* The range opens: its end counts up from the first year. */}
              <CountUp value={ARCHIVE_FIGURES.lastYear} from={ARCHIVE_FIGURES.firstYear} plain delay={countDelay(COUNT_AT[2])} {...counting} />
            </HeroStat>
          </dl>
          <p className="lx-hero-caption lx-in-caption">
            <svg className="lx-hero-scribble" viewBox="0 0 150 120" fill="none" aria-hidden="true">
              <path
                className="lx-draw lx-draw-stroke"
                pathLength={1}
                d="M136 112C92 114 40 100 26 62C20 44 30 26 48 12"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              />
              <path
                className="lx-draw lx-draw-head"
                pathLength={1}
                d="M34 12 49 11 47 27"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <span>Three short equations draw this one path. It never repeats, never crosses itself — <em>chaos, but it never gets lost.</em></span>
          </p>
          <a className="lx-scroll-cue" href="#idea" onClick={event => jumpTo(event, 'idea')}>
            <span>Scroll</span>
            <span className="lx-scroll-line" aria-hidden="true" />
          </a>
        </m.div>
        <m.div className="lx-hero-shade" style={{ opacity: shade }} aria-hidden="true" />
      </m.div>
      <HeroGlow cover={cover} />
    </section>
  );
}

/** One of the hero's figures. Its place in the row sets when it arrives (`--n`, landing-entrance.css). */
function HeroStat({ label, index, children }: { label: string; index: number; children: ReactNode }) {
  return (
    <div className="lx-hero-stat lx-in lx-in-stat" style={{ ['--n' as string]: index }}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The idea
// ---------------------------------------------------------------------------

/*
 * Three lines, lit word by word as they are read. The last word of each acts
 * itself out as it lights: "easy" drifts up as if it weighed nothing, "hard"
 * lands with a thud, and "right" is underlined.
 */
type Role = 'easy' | 'hard' | 'right';
const IDEA: { words: string[]; role: Role }[] = [
  { words: ['Not', 'too', 'easy.'], role: 'easy' },
  { words: ['Not', 'too', 'hard.'], role: 'hard' },
  { words: ['Just', 'right.'], role: 'right' },
];
const IDEA_WORDS = IDEA.flatMap((line, row) => line.words.map((text, position) => ({
  text,
  row,
  role: position === line.words.length - 1 ? line.role : undefined,
})));

const Manifesto = forwardRef<HTMLElement>(function Manifesto(_, ref) {
  const reduce = Boolean(useReducedMotion());
  const isStatic = useStatic();
  // Rendered into the HTML, every word is already lit: a reader without script sees the settled sheet.
  const still = reduce || isStatic;
  const textRef = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ['start 0.85', 'end 0.5'] });
  const total = IDEA_WORDS.length;

  return (
    <section ref={ref} className="lx-sheet lx-manifesto" id="idea" data-tone="paper" aria-labelledby="lx-idea-title">
      <div className="lx-wrap">
        <h2 ref={textRef} id="lx-idea-title" className="lx-idea">
          {IDEA.map((line, row) => (
            <span key={line.role} className="lx-idea-line">
              {IDEA_WORDS.map((word, index) => word.row === row && (
                <IdeaWord
                  key={index}
                  text={word.text}
                  role={word.role}
                  progress={scrollYProgress}
                  range={[index / total, Math.min(1, (index + 2) / total)]}
                  still={still}
                />
              ))}
            </span>
          ))}
        </h2>
        <div className="lx-idea-foot">
          <Rise as="p" className="lx-idea-sub">
            CalculixHub finds your level,{' '}
            <br className="lx-idea-br" />then gives you problems that <em>fit.</em>
          </Rise>
          <Rise delay={0.08}>
            <a className="lx-link lx-idea-cta" href="#engine" onClick={event => jumpTo(event, 'engine')}>
              See how it works <Arrow direction="down" size={15} />
            </a>
          </Rise>
        </div>
      </div>
    </section>
  );
});

interface IdeaWordProps {
  text: string;
  role?: Role;
  progress: MotionValue<number>;
  range: [number, number];
  still: boolean;
}

function IdeaWord({ text, role, progress, range, still }: IdeaWordProps) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  // The acted-out words play once they are half lit, and rewind if the reader scrolls back.
  const threshold = range[0] + (range[1] - range[0]) * 0.5;
  const [lit, setLit] = useState(false);
  useMotionValueEvent(progress, 'change', value => { if (role) setLit(value >= threshold); });
  useLayoutEffect(() => { if (role) setLit(progress.get() >= threshold); }, [progress, role, threshold]);

  if (!role) return <><m.span className="lx-lit" style={still ? undefined : { opacity }}>{text}</m.span>{' '}</>;
  const on = lit || still;
  const act = still ? {} : role === 'easy'
    ? { animate: { y: on ? '-0.12em' : '0.06em' }, transition: { type: 'spring' as const, stiffness: 46, damping: 7, mass: 1.3 } }
    : role === 'hard'
      ? {
          animate: on ? { y: '0em', scaleY: [1.08, 0.86, 1] } : { y: '-0.36em', scaleY: 1.08 },
          transition: on
            ? { y: { type: 'spring' as const, stiffness: 520, damping: 17, mass: 1.6 }, scaleY: { duration: 0.5, times: [0, 0.32, 1], ease: 'easeOut' as const } }
            : { duration: 0.5, ease: GLIDE },
        }
      : {};
  return (
    <>
      <m.span className={`lx-lit lx-idea-${role}`} style={still ? undefined : { opacity }} initial={false} {...act}>
        {text}
        {role === 'right' && (
          <m.span
            className="lx-idea-underline"
            aria-hidden="true"
            initial={false}
            animate={{ clipPath: on ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)' }}
            transition={{ duration: still ? 0 : 1, ease: GLIDE }}
          />
        )}
      </m.span>{' '}
    </>
  );
}
