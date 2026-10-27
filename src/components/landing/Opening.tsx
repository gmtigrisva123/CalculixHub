/**
 * The first two screens: the hero, and the sheet of paper that slides over it.
 *
 * The hero is an ink stage holding the Möbius strip. It is sticky inside this
 * wrapper, so as the reader scrolls the manifesto rises over it like a sheet
 * drawn across a lit table: the stage recedes, its words lift away, and the
 * strip loosens into the dark. Once the sheet has covered it, the wrapper ends
 * and the hero leaves with it — it is never uncovered again, which is what lets
 * its render loop stop (the IntersectionObserver sees it go).
 *
 * The idea is the page's thesis in three short lines, lit word by word as they
 * are read: dim words ahead of the reader, full ink behind.
 */

import { forwardRef, lazy, Suspense, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { Arrow, CountUp, Eyebrow, GLIDE, Magnetic, Rise, SplitText } from './kit';
import { jumpTo } from './LandingNav';

const ParticleField = lazy(() => import('./ParticleField'));

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

function Hero({ cover, onRegister }: { cover: MotionValue<number>; onRegister: () => void }) {
  const reduce = Boolean(useReducedMotion());
  const [ready, setReady] = useState(false);
  const stageScale = useTransform(cover, [0, 1], [1, reduce ? 1 : 0.9]);
  const stageY = useTransform(cover, [0, 1], ['0vh', reduce ? '0vh' : '-4vh']);
  const copyY = useTransform(cover, [0, 0.8], ['0vh', reduce ? '0vh' : '-16vh']);
  const copyOpacity = useTransform(cover, [0.05, 0.6], [1, 0]);
  const shade = useTransform(cover, [0, 1], [0, 0.55]);
  const release = useTransform(cover, [0, 1], [0, 1]);

  return (
    <section className="lx-hero" id="top" data-tone="ink" aria-labelledby="lx-hero-title">
      <m.div className="lx-hero-stage" style={{ scale: stageScale, y: stageY }}>
        <div className="lx-hero-sky" aria-hidden="true" />
        <Suspense fallback={null}>
          <ParticleField
            variant="mobius"
            release={release}
            still={reduce}
            className={ready ? 'lx-hero-field is-ready' : 'lx-hero-field'}
            onReady={() => setReady(true)}
          />
        </Suspense>
        <div className="lx-hero-vignette" aria-hidden="true" />

        <m.div className="lx-hero-copy" style={{ y: copyY, opacity: copyOpacity }}>
          <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: GLIDE, delay: 0.1 }}>
            <Eyebrow live>Competition mathematics · AMC to IMO</Eyebrow>
          </m.div>
          <SplitText as="h1" id="lx-hero-title" className="lx-hero-title" text={'Stay with\nthe *question*.'} trigger="mount" delay={0.22} stagger={0.085} />
          <m.p className="lx-hero-lead" initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.1, ease: GLIDE, delay: 0.75 }}>
            Real contest problems, matched to your level and explained step by step.
          </m.p>
          <m.div className="lx-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: GLIDE, delay: 0.92 }}>
            <Magnetic>
              <button type="button" className="lx-btn lx-btn-cream" onClick={onRegister}>
                <span>Find your level</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </button>
            </Magnetic>
            <a className="lx-btn lx-btn-glass" href="#playground" onClick={event => jumpTo(event, 'playground')}>
              <span>Try a problem</span>
              <Arrow direction="down" size={15} />
            </a>
          </m.div>
        </m.div>

        <m.div className="lx-hero-foot" style={{ opacity: copyOpacity }}>
          <m.dl className="lx-hero-stats" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.08, delayChildren: 1.05 } } }}>
            <HeroStat label="past problems"><CountUp value={ARCHIVE_FIGURES.problems} delay={1.1} /></HeroStat>
            <HeroStat label="real exams"><CountUp value={ARCHIVE_FIGURES.papers} delay={1.18} /></HeroStat>
            <HeroStat label="years of contests">{ARCHIVE_FIGURES.firstYear}<span className="lx-dash">–</span>{ARCHIVE_FIGURES.lastYear}</HeroStat>
          </m.dl>
          <m.p className="lx-hero-caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 1.6 }}>
            <span className="lx-live" aria-hidden="true" />
            <span><em>A Möbius strip</em> · one side, one edge.</span>
          </m.p>
          <a className="lx-scroll-cue" href="#idea" onClick={event => jumpTo(event, 'idea')}>
            <span>Scroll</span>
            <span className="lx-scroll-line" aria-hidden="true" />
          </a>
        </m.div>
        <m.div className="lx-hero-shade" style={{ opacity: shade }} aria-hidden="true" />
      </m.div>
    </section>
  );
}

function HeroStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <m.div className="lx-hero-stat" variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: { duration: 0.9, ease: GLIDE } } }}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </m.div>
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
  const textRef = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ['start 0.85', 'end 0.5'] });
  const total = IDEA_WORDS.length;

  return (
    <section ref={ref} className="lx-sheet lx-manifesto" id="idea" data-tone="paper" aria-labelledby="lx-idea-title">
      <div className="lx-wrap">
        <div className="lx-manifesto-head">
          <Eyebrow index="01">The idea</Eyebrow>
        </div>
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
                  still={reduce}
                />
              ))}
            </span>
          ))}
        </h2>
        <div className="lx-idea-foot">
          <Rise as="p" className="lx-idea-sub">CalculixHub finds your level, then gives you problems that fit.</Rise>
          <Rise delay={0.08}>
            <a className="lx-link" href="#engine" onClick={event => jumpTo(event, 'engine')}>
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
