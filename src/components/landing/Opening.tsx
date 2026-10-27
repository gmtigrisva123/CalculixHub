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
 * The manifesto is the page's thesis, lit word by word as it is read: dim words
 * ahead of the reader, full ink behind. The figures under it are imported from
 * the engine itself, not typed in.
 */

import { forwardRef, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ITEM_BANK } from '../../domain/itemBank';
import { TARGET_SEM } from '../../domain/irt';
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
            A workspace for competition mathematics. Placement that measures what you know,{' '}
            {ARCHIVE_FIGURES.problems.toLocaleString('en-US')} past problems from AMC to IMO, and solutions that explain the step behind the answer.
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
            <HeroStat label="exam papers"><CountUp value={ARCHIVE_FIGURES.papers} delay={1.18} /></HeroStat>
            <HeroStat label="years of contests">{ARCHIVE_FIGURES.firstYear}<span className="lx-dash">–</span>{ARCHIVE_FIGURES.lastYear}</HeroStat>
            <HeroStat label="domains"><CountUp value={4} delay={1.3} duration={1.2} /></HeroStat>
          </m.dl>
          <m.p className="lx-hero-caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 1.6 }}>
            <span className="lx-live" aria-hidden="true" />
            <span>Now drawing <em>the Möbius strip</em> · one side, one edge. Follow the warm line: it is the only edge there is.</span>
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
// Manifesto
// ---------------------------------------------------------------------------

/*
 * `*emphasis*` is set in Newsreader italic; ⟨dice⟩ and ⟨bell⟩ are small inline
 * drawings that light with the words around them.
 */
const THESIS = 'Most practice apps *guess* ⟨dice⟩ — get one right and they hand you something harder. CalculixHub *measures*. ⟨bell⟩ Every answer sharpens an estimate of what you know, with its margin of error attached, and the next problem is the one that will tell it the most. When the estimate is sharp enough, it stops asking and starts teaching.';

type Token = { kind: 'word'; text: string; em: boolean } | { kind: 'glyph'; name: 'dice' | 'bell' };

function tokenize(source: string): Token[] {
  let em = false;
  return source.split(' ').filter(Boolean).map((raw): Token => {
    if (raw === '⟨dice⟩' || raw === '⟨bell⟩') return { kind: 'glyph', name: raw === '⟨dice⟩' ? 'dice' : 'bell' };
    const opens = raw.startsWith('*');
    const closes = raw.replace(/[.,—]+$/, '').endsWith('*');
    if (opens) em = true;
    const token: Token = { kind: 'word', text: raw.replace(/\*/g, ''), em };
    if (closes) em = false;
    return token;
  });
}

const TOKENS = tokenize(THESIS);

const Manifesto = forwardRef<HTMLElement>(function Manifesto(_, ref) {
  const reduce = Boolean(useReducedMotion());
  const textRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ['start 0.82', 'end 0.42'] });
  const total = TOKENS.length;

  return (
    <section ref={ref} className="lx-sheet lx-manifesto" id="idea" data-tone="paper" aria-labelledby="lx-idea-title">
      <div className="lx-wrap">
        <div className="lx-manifesto-head">
          <Eyebrow index="01">The idea</Eyebrow>
          <h2 id="lx-idea-title" className="sr-only">Most practice apps guess. CalculixHub measures.</h2>
        </div>
        <p ref={textRef} className="lx-manifesto-text">
          {TOKENS.map((token, index) => (
            <LitToken key={index} token={token} progress={scrollYProgress} still={reduce} range={[index / total, Math.min(1, (index + 2.5) / total)]} />
          ))}
        </p>
        <div className="lx-proofs">
          <Rise as="figure" className="lx-proof" delay={0}>
            <strong><CountUp value={ITEM_BANK.length} duration={1.4} /></strong>
            <figcaption>placement items, each carrying its own difficulty and discrimination</figcaption>
          </Rise>
          <Rise as="figure" className="lx-proof" delay={0.08}>
            <strong>±<CountUp value={TARGET_SEM} from={1} format={value => value.toFixed(2)} duration={1.6} /></strong>
            <figcaption>the margin of error at which placement stops asking</figcaption>
          </Rise>
          <Rise as="figure" className="lx-proof" delay={0.16}>
            <strong><CountUp value={4} duration={1.2} /></strong>
            <figcaption>domains kept in balance, so no single topic decides your level</figcaption>
          </Rise>
        </div>
      </div>
    </section>
  );
});

function LitToken({ token, progress, still, range }: { token: Token; progress: MotionValue<number>; still: boolean; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const style = still ? undefined : { opacity };
  if (token.kind === 'glyph') {
    return <><m.span className={`lx-glyph lx-glyph-${token.name}`} style={style} aria-hidden="true">{token.name === 'dice' ? <DiceGlyph /> : <BellGlyph />}</m.span>{' '}</>;
  }
  return <><m.span className={token.em ? 'lx-lit lx-lit-em' : 'lx-lit'} style={style}>{token.text}</m.span>{' '}</>;
}

function DiceGlyph() {
  return (
    <svg viewBox="0 0 48 32" fill="none">
      <rect x="6" y="5" width="22" height="22" rx="5" transform="rotate(-12 17 16)" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="13" cy="13" r="1.8" fill="currentColor" /><circle cx="18" cy="18.5" r="1.8" fill="currentColor" /><circle cx="22.5" cy="12" r="1.8" fill="currentColor" />
      <path d="M33 22c3-6 6-9 11-10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 3.2" />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg viewBox="0 0 56 32" fill="none">
      <path d="M3 27h50" stroke="currentColor" strokeWidth="1.3" opacity=".45" />
      <path d="M4 27C14 27 18 4 28 4s14 23 24 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 4v23" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2.5" />
      <path d="M20 30h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
