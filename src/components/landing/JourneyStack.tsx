/**
 * "The workspace": four ways in, as cards that stack.
 *
 * Each card is sticky a little lower than the one before, so scrolling deals
 * them onto a pile; as a card is covered it settles back — smaller, dimmer —
 * like paper under paper. Each carries a small working picture of its part of
 * the product, which plays when the card arrives and rests when it leaves.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import MathText from '../MathText';
import { ENGINE_RUN } from './engineRun';
import { useMediaQuery } from '../../hooks/useBreakpoint';
import { Arrow, Eyebrow, GLIDE, Rise, SplitText } from './kit';

interface JourneyStackProps {
  onRegister: () => void;
}

interface Step {
  label: string;
  title: string;
  copy: string;
  action: string;
  href?: string;
  tone: 'paper' | 'mist' | 'ink' | 'cream';
  visual: ReactNode;
}

export default function JourneyStack({ onRegister }: JourneyStackProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stackRef, offset: ['start start', 'end end'] });
  const steps: Step[] = [
    {
      label: 'Find your starting point',
      title: 'A path that listens.',
      copy: 'Adaptive placement chooses each question from your answers so far. Watch the estimate take shape, then begin at a level that suits you.',
      action: 'Sign up to find my level',
      tone: 'paper',
      visual: <PlacementVisual />,
    },
    {
      label: 'Learn through a real attempt',
      title: 'Give the idea a chance.',
      copy: 'Work through competition problems. Submit an answer, rethink a step, and compare your approach with the worked solution when it opens.',
      action: 'Explore Learn',
      href: '/?auth=signup&tab=learn',
      tone: 'mist',
      visual: <LearnVisual />,
    },
    {
      label: 'Put your thinking into play',
      title: 'Meet a different challenge.',
      copy: 'Arena runs competitions scheduled by an administrator. A live event starts with real participants and a timer the server keeps.',
      action: 'Explore Arena',
      href: '/?auth=signup&tab=compete',
      tone: 'ink',
      visual: <ArenaVisual />,
    },
    {
      label: 'Think out loud',
      title: 'Ask for a nudge, not an answer.',
      copy: 'The tutor answers with a guiding question rather than the solution, and the community keeps good ideas in conversation. Gemini explanations use your own API key.',
      action: 'Visit the community',
      href: '/?auth=signup&tab=community',
      tone: 'cream',
      visual: <TutorVisual />,
    },
  ];

  return (
    <section className="lx-journey" id="workspace" data-tone="paper" aria-labelledby="lx-journey-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <div>
            <Eyebrow index="06">The workspace</Eyebrow>
            <SplitText as="h2" id="lx-journey-title" className="lx-h2" text={'A mathematics workspace.\n*With room for your thinking.*'} />
          </div>
          <Rise as="p" className="lx-lead" delay={0.1}>
            For the student working towards a competition, the curious problem-solver, and anyone who wants the step behind the answer.
          </Rise>
        </header>
        <div className="lx-stack" ref={stackRef}>
          {steps.map((step, index) => (
            <StackCard key={step.title} step={step} index={index} total={steps.length} progress={scrollYProgress} onRegister={onRegister} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StackCard({ step, index, total, progress, onRegister }: { step: Step; index: number; total: number; progress: MotionValue<number>; onRegister: () => void }) {
  const reduce = useReducedMotion();
  // Only a pinned pile settles back; in the narrow, unpinned column every card stays as it is.
  const pinned = useMediaQuery('(min-width: 901px)') && !reduce;
  const start = index / total;
  const scale = useTransform(progress, [start, 1], [1, pinned ? 1 - (total - 1 - index) * 0.04 : 1]);
  const dim = useTransform(progress, [start + 0.5 / total, 1], [0, pinned ? (total - 1 - index) * 0.12 : 0]);
  return (
    <div className="lx-stack-slot" style={{ ['--i' as string]: index }}>
      <m.article className="lx-card" data-card-tone={step.tone} data-tone={step.tone === 'ink' ? 'ink' : undefined} style={{ scale }}>
        <div className="lx-card-copy">
          <span className="lx-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="lx-card-label">{step.label}</span>
          <h3 className="lx-card-title">{step.title}</h3>
          <p className="lx-card-text">{step.copy}</p>
          {step.href
            ? <a className="lx-link" href={step.href}>{step.action} <Arrow size={15} /></a>
            : <button type="button" className="lx-link" onClick={onRegister}>{step.action} <Arrow direction="right" size={15} /></button>}
        </div>
        <div className="lx-card-visual" aria-hidden="true">{step.visual}</div>
        <m.div className="lx-card-dim" style={{ opacity: dim }} aria-hidden="true" />
      </m.article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------

/** Steps through the landing page's placement replay on a loop while on screen. */
function useLoop(length: number, interval: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(reduce ? length - 1 : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const timer = window.setInterval(() => setTick(value => (value + 1) % length), interval);
    return () => window.clearInterval(timer);
  }, [inView, reduce, length, interval]);
  return { ref, tick, inView };
}

const MINI_STEPS = ENGINE_RUN.steps;
function miniCurve(weights: number[]) {
  const points = ENGINE_RUN.grid.map((theta, index) => ({ theta, weight: weights[index] })).filter(point => point.theta >= -3 && point.theta <= 3);
  return points.map((point, index) => `${index ? 'L' : 'M'}${(20 + ((point.theta + 3) / 6) * 320).toFixed(1)} ${(150 - (point.weight / ENGINE_RUN.peak) * 126).toFixed(1)}`).join('');
}
const MINI_PATHS = MINI_STEPS.map(step => miniCurve(step.weights));
/** Answers at similar difficulty pile up instead of overlapping. */
const MINI_LEVEL = MINI_STEPS.slice(1).map((step, index, all) =>
  all.slice(0, index).filter(previous => Math.abs(previous.item!.b - step.item!.b) < 0.2).length);

function PlacementVisual() {
  const { ref, tick } = useLoop(MINI_STEPS.length + 3, 900);
  const index = Math.min(tick, MINI_STEPS.length - 1);
  const step = MINI_STEPS[index];
  return (
    <div className="lx-vis lx-vis-placement" ref={ref}>
      <div className="lx-vis-readout">
        <span>θ <b className="lx-tabular">{step.theta.toFixed(2)}</b></span>
        <span>± <b className="lx-tabular">{step.sem.toFixed(2)}</b></span>
        <span className="lx-vis-pill">{step.tier}</span>
      </div>
      <svg viewBox="0 0 360 214">
        <path d="M20 150H340" className="lx-vis-axis" />
        <m.path className="lx-vis-area" animate={{ d: `${MINI_PATHS[index]}L340 150L20 150Z` }} transition={{ duration: 0.7, ease: GLIDE }} initial={false} />
        <m.path className="lx-vis-curve" animate={{ d: MINI_PATHS[index] }} transition={{ duration: 0.7, ease: GLIDE }} initial={false} />
        {MINI_STEPS.slice(1, index + 1).map((entry, k) => (
          <m.circle
            key={entry.item!.id}
            cx={20 + ((entry.item!.b + 3) / 6) * 320}
            r={4.5}
            className={entry.correct ? 'lx-vis-dot is-right' : 'lx-vis-dot is-miss'}
            initial={{ opacity: 0, cy: 110 }}
            animate={{ opacity: 1, cy: 172 + MINI_LEVEL[k] * 12 }}
            transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.35 }}
          />
        ))}
      </svg>
      <span className="lx-vis-caption">Question {index} of a real placement replay</span>
    </div>
  );
}

function LearnVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const show = inView || Boolean(reduce);
  const at = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: show ? { opacity: 1, y: 0 } : undefined, transition: { duration: 0.7, ease: GLIDE, delay } });
  return (
    <div className="lx-vis lx-vis-learn" ref={ref}>
      <div className="lx-sheet-card">
        <span className="lx-sheet-tag">Algebra · a glimpse of the thinking</span>
        <MathText className="lx-sheet-question" text="If $x+y+z=0$, why does $x^3+y^3+z^3=3xyz$?" />
        <m.p
          className="lx-sheet-pencil"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={show ? { clipPath: 'inset(0 0% 0 0)' } : undefined}
          transition={{ duration: 1.6, ease: [0.45, 0, 0.2, 1], delay: 0.5 }}
        >
          Look for a factor before you expand.
        </m.p>
        <m.div className="lx-sheet-step" {...at(1.9)}>
          <MathText text="$x^3+y^3+z^3-3xyz$" />
        </m.div>
        <m.div className="lx-sheet-step" {...at(2.3)}>
          <MathText text="$=(x+y+z)(x^2+y^2+z^2-xy-yz-zx)$" />
        </m.div>
        <m.div className="lx-sheet-step is-final" {...at(2.8)}>
          <MathText text="$=0$" />
          <span className="lx-sheet-check">✓ so the two sides agree</span>
        </m.div>
      </div>
    </div>
  );
}

const SOLVERS = [
  { id: 'you', score: 62, you: true },
  { id: 'b', score: 71 },
  { id: 'c', score: 55 },
  { id: 'd', score: 48 },
];
const ROUNDS = [[62, 71, 55, 48], [74, 71, 58, 49], [74, 78, 64, 57], [86, 78, 66, 61]];

function ArenaVisual() {
  const { ref, tick } = useLoop(ROUNDS.length, 2100);
  const scores = ROUNDS[tick];
  const order = SOLVERS.map((solver, index) => ({ ...solver, score: scores[index] })).sort((a, b) => b.score - a.score);
  return (
    <div className="lx-vis lx-vis-arena" ref={ref}>
      <div className="lx-arena-clock">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" className="lx-arena-track" />
          <circle cx="60" cy="60" r="50" className="lx-arena-sweep" pathLength={100} />
        </svg>
        <span className="lx-arena-live"><span className="lx-live" aria-hidden="true" />Live</span>
      </div>
      <ol className="lx-arena-board">
        {order.map((solver, rank) => (
          <m.li key={solver.id} layout transition={{ type: 'spring', visualDuration: 0.55, bounce: 0.2 }} data-you={solver.you || undefined}>
            <span className="lx-arena-rank">{rank + 1}</span>
            <span className="lx-arena-who">{solver.you ? 'You' : <span className="lx-arena-avatar" data-seat={solver.id} />}</span>
            <span className="lx-arena-bar"><m.span animate={{ scaleX: solver.score / 100 }} transition={{ duration: 0.8, ease: GLIDE }} initial={false} /></span>
            <span className="lx-arena-score lx-tabular">{solver.score}</span>
          </m.li>
        ))}
      </ol>
    </div>
  );
}

const CHAT = [
  { who: 'learner', text: 'I’m stuck on the two chords.' },
  { who: 'tutor', text: 'Where does the perpendicular from the centre meet each chord?' },
  { who: 'learner', text: 'At its midpoint… so O sits at −6 along one and −10 along the other.' },
  { who: 'tutor', text: 'Exactly. What does that give you for O’s coordinates?' },
] as const;

function TutorVisual() {
  const { ref, tick, inView } = useLoop(CHAT.length + 2, 1700);
  const shown = Math.min(CHAT.length, tick + 1);
  return (
    <div className="lx-vis lx-vis-tutor" ref={ref}>
      <AnimatePresence initial={false}>
        {inView && CHAT.slice(0, shown).map((line, index) => (
          <m.p
            key={index}
            className={line.who === 'tutor' ? 'lx-bubble is-tutor' : 'lx-bubble'}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', visualDuration: 0.45, bounce: 0.25 }}
          >
            {line.who === 'tutor' && <span className="lx-bubble-who">Tutor</span>}
            {line.text}
          </m.p>
        ))}
      </AnimatePresence>
      {inView && shown < CHAT.length && (
        <span className="lx-typing" aria-hidden="true"><span /><span /><span /></span>
      )}
    </div>
  );
}
