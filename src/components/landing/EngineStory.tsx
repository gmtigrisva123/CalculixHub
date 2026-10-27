/**
 * "Watch it find your level": the placement engine, replayed by scrolling.
 *
 * The section is tall and its stage is sticky, so the scroll position becomes
 * a playhead. Scrubbing through it steps a simulated learner through a real
 * placement (engineRun.ts): each answer drops onto the difficulty axis, and the
 * curve — the engine's own state, not a drawing of it — narrows and moves until
 * the engine is sure enough to stop.
 *
 * The story is told without statistics. The reader sees how many questions have
 * been asked, the level the engine would give now, and a meter of how sure it
 * is; the curve and the "you" marker carry the rest.
 *
 * Between answers the curve eases from one state to the next. The playhead moves
 * every frame, so the curve, the marker and the meter are written straight to
 * the SVG and DOM nodes; React only re-renders when something discrete changes
 * (a new answer, a new beat of the story).
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ENGINE_RUN, TIER_BANDS, certainty, type EngineStep } from './engineRun';
import { Arrow, Eyebrow, GLIDE, Magnetic, SplitText } from './kit';

const RUN = ENGINE_RUN;
const ANSWERS = RUN.steps.length - 1;
const SURE = RUN.steps.map((_, index) => certainty(RUN, index));

// Chart geometry, in viewBox units.
const W = 800;
const PAD = 26;
const BASE = 318;
const CURVE_H = 236;
const RUG = 380;
const RUG_STEP = 16;
const HEIGHT = 440;
const THETA_MIN = -3.4;
const THETA_MAX = 3.4;
const x = (theta: number) => PAD + ((theta - THETA_MIN) / (THETA_MAX - THETA_MIN)) * (W - 2 * PAD);
const VISIBLE = RUN.grid.map((theta, index) => ({ theta, index })).filter(node => node.theta >= THETA_MIN - 1e-9 && node.theta <= THETA_MAX + 1e-9);

const BEATS = [
  { title: 'It starts open-minded.', body: 'Before the first answer, any level is possible.' },
  { title: 'Each answer narrows it down.', body: 'Right answers move the guess up. Misses move it down.' },
  { title: 'Each question fits.', body: 'Not too easy, not too hard.' },
  { title: 'It stops when it’s sure.', body: `This time, after ${ANSWERS} questions.` },
];

/** Which beat of the story a playhead position belongs to. */
function beatAt(k: number) {
  if (k < 0.6) return 0;
  if (k < 5.6) return 1;
  if (k < ANSWERS - 0.4) return 2;
  return 3;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Dots for answers at similar difficulty stack upwards instead of overlapping. */
const RUG_LEVEL = RUN.steps.slice(1).map((step, index, all) =>
  all.slice(0, index).filter(previous => Math.abs(previous.item!.b - step.item!.b) < 0.14).length);

const DOMAIN_TONE: Record<string, string> = {
  Algebra: 'var(--lx-w1-a)', Geometry: 'var(--lx-w2-a)', Combinatorics: 'var(--lx-w3-a)', 'Number Theory': 'var(--lx-w4-a)',
};

interface EngineStoryProps {
  onRegister: () => void;
}

export default function EngineStory({ onRegister }: EngineStoryProps) {
  const reduce = Boolean(useReducedMotion());
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: playhead } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const { scrollYProgress: arrival } = useScroll({ target: sectionRef, offset: ['start end', 'start start'] });
  const stageScale = useTransform(arrival, [0, 1], [reduce ? 1 : 0.9, 1]);
  const stageRadius = useTransform(arrival, [0.6, 1], ['56px', '40px']);

  const [beat, setBeat] = useState(0);
  const [answered, setAnswered] = useState(0);

  const areaRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const estimateRef = useRef<SVGGElement>(null);
  const intervalRef = useRef<SVGRectElement>(null);
  const markRef = useRef<SVGTextElement>(null);
  const tierRef = useRef<HTMLSpanElement>(null);
  const sureRef = useRef<HTMLSpanElement>(null);
  const bandRefs = useRef<(SVGGElement | null)[]>([]);
  const frame = useRef(0);

  const draw = useCallback((progress: number) => {
    // A short hold at either end: the open start gets a moment, and so does the result.
    const k = Math.max(0, Math.min(ANSWERS, ((progress - 0.07) / 0.8) * ANSWERS));
    const from = Math.min(ANSWERS, Math.floor(k));
    const to = Math.min(ANSWERS, from + 1);
    const raw = k - from;
    const t = reduce ? Math.round(raw) : smooth(Math.max(0, Math.min(1, (raw - 0.12) / 0.76)));
    const a: EngineStep = RUN.steps[from];
    const b: EngineStep = RUN.steps[to];
    const mix = (p: number, q: number) => p + (q - p) * t;

    let line = '';
    for (const { theta, index } of VISIBLE) {
      const weight = mix(a.weights[index], b.weights[index]);
      const px = x(theta).toFixed(1);
      const py = (BASE - (weight / RUN.peak) * CURVE_H).toFixed(1);
      line += `${line ? 'L' : 'M'}${px} ${py}`;
    }
    const area = `${line}L${x(THETA_MAX).toFixed(1)} ${BASE}L${x(THETA_MIN).toFixed(1)} ${BASE}Z`;
    areaRef.current?.setAttribute('d', area);
    lineRef.current?.setAttribute('d', line);
    glowRef.current?.setAttribute('d', line);

    const theta = mix(a.theta, b.theta);
    const sem = mix(a.sem, b.sem);
    // Height of the interpolated curve at the estimate, for the marker's top.
    const position = ((theta - RUN.grid[0]) / (RUN.grid[1] - RUN.grid[0]));
    const lower = Math.max(0, Math.min(RUN.grid.length - 2, Math.floor(position)));
    const blend = position - lower;
    const heightAt = (step: EngineStep) => step.weights[lower] * (1 - blend) + step.weights[lower + 1] * blend;
    const top = BASE - (mix(heightAt(a), heightAt(b)) / RUN.peak) * CURVE_H;
    if (estimateRef.current) {
      estimateRef.current.style.transform = `translateX(${x(theta).toFixed(1)}px)`;
      estimateRef.current.querySelector('line')?.setAttribute('y1', top.toFixed(1));
      estimateRef.current.querySelector('circle')?.setAttribute('cy', top.toFixed(1));
    }
    markRef.current?.setAttribute('y', (top - 18).toFixed(1));
    if (intervalRef.current) {
      intervalRef.current.setAttribute('x', x(theta - sem).toFixed(1));
      intervalRef.current.setAttribute('width', (x(theta + sem) - x(theta - sem)).toFixed(1));
    }
    if (sureRef.current) sureRef.current.style.transform = `scaleX(${mix(SURE[from], SURE[to]).toFixed(3)})`;
    const tier = TIER_BANDS.find(band => theta >= band.from && theta < band.to) ?? TIER_BANDS[1];
    if (tierRef.current && tierRef.current.textContent !== tier.tier) tierRef.current.textContent = tier.tier;
    bandRefs.current.forEach((node, index) => node?.toggleAttribute('data-active', TIER_BANDS[index] === tier));

    setAnswered(Math.min(ANSWERS, Math.floor(k + 0.88)));
    setBeat(beatAt(k));
  }, [reduce]);

  useMotionValueEvent(playhead, 'change', () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw(playhead.get());
    });
  });
  useLayoutEffect(() => {
    draw(playhead.get());
    return () => cancelAnimationFrame(frame.current);
  }, [draw, playhead]);

  const latest = answered > 0 ? RUN.steps[answered] : null;
  const done = beat === 3;

  return (
    <section ref={sectionRef} className="lx-engine" id="engine" aria-labelledby="lx-engine-title">
      <div className="lx-engine-pin">
        <m.div className="lx-engine-stage" data-tone="ink" style={{ scale: stageScale, borderRadius: stageRadius }}>
          <div className="lx-engine-grid" aria-hidden="true" />
          <header className="lx-engine-head">
            <Eyebrow index="02">How it works</Eyebrow>
            <SplitText as="h2" id="lx-engine-title" className="lx-engine-title" text="Watch it find *your level.*" />
            <p className="lx-engine-note">Scroll to watch one student’s placement, answer by answer.</p>
          </header>

          <ol className="lx-beats" aria-label="How placement works">
            {BEATS.map((item, index) => (
              <li key={item.title} className="lx-beat" data-state={index === beat ? 'active' : index < beat ? 'past' : 'ahead'}>
                <span className="lx-beat-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{item.title}</h3>
                  <div className="lx-beat-body"><p>{item.body}</p></div>
                </div>
              </li>
            ))}
          </ol>

          <div className="lx-instrument">
            <dl className="lx-readouts">
              <div><dt>Questions</dt><dd className="lx-tabular">{answered}</dd></div>
              <div><dt>Level</dt><dd><span ref={tierRef}>Intermediate</span></dd></div>
              <div className="lx-sure">
                <dt>How sure</dt>
                <dd>
                  <span className="lx-sure-track" aria-hidden="true"><span ref={sureRef} className="lx-sure-fill" /></span>
                  <span className="sr-only">{answered === ANSWERS ? 'Sure enough to stop' : 'Not sure yet'}</span>
                </dd>
              </div>
            </dl>

            <svg className="lx-chart" viewBox={`0 0 ${W} ${HEIGHT}`} role="img" aria-label={`The guess of one student’s level, after each answer. It was sure after ${ANSWERS} questions: ${RUN.tier}.`}>
              <defs>
                <linearGradient id="lx-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--lx-cyan)', stopOpacity: 0.42 }} />
                  <stop offset="1" style={{ stopColor: 'var(--lx-cyan)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {TIER_BANDS.map((band, index) => {
                const from = x(Math.max(THETA_MIN, band.from));
                const to = x(Math.min(THETA_MAX, band.to));
                return (
                  <g key={band.tier} className="lx-band" ref={node => { bandRefs.current[index] = node; }}>
                    <rect x={from} y={40} width={to - from} height={BASE - 40} />
                    {index > 0 && <line x1={from} x2={from} y1={34} y2={HEIGHT - 6} />}
                    <text x={(from + to) / 2} y={HEIGHT - 8} textAnchor="middle">{band.tier}</text>
                  </g>
                );
              })}
              <line className="lx-axis" x1={PAD} x2={W - PAD} y1={BASE} y2={BASE} />
              <rect ref={intervalRef} className="lx-interval" y={BASE - 4} height={8} rx={4} x={x(-1)} width={x(1) - x(-1)} />
              <path ref={areaRef} className="lx-curve-area" fill="url(#lx-curve-fill)" />
              <path ref={glowRef} className="lx-curve-glow" />
              <path ref={lineRef} className="lx-curve-line" />
              <g ref={estimateRef} className="lx-estimate">
                <line x1={0} x2={0} y1={100} y2={BASE} />
                <circle cx={0} cy={100} r={5.5} />
                <text ref={markRef} x={0} y={82} textAnchor="middle">YOU</text>
              </g>
              <g className="lx-rug">
                <AnimatePresence initial={false}>
                  {RUN.steps.slice(1, answered + 1).map((step, index) => (
                    <m.g
                      key={step.item!.id}
                      className={step.correct ? 'lx-dot is-right' : 'lx-dot is-miss'}
                      initial={{ opacity: 0, y: -120 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40, transition: { duration: 0.25 } }}
                      transition={{ type: 'spring', visualDuration: 0.6, bounce: 0.32 }}
                    >
                      <circle cx={x(step.item!.b)} cy={RUG - RUG_LEVEL[index] * RUG_STEP} r={7} style={{ ['--dot' as string]: DOMAIN_TONE[step.item!.domain] }} />
                      {step.correct
                        ? <path d={`M${x(step.item!.b) - 3} ${RUG - RUG_LEVEL[index] * RUG_STEP}l2.2 2.4 4-4.6`} />
                        : <path d={`M${x(step.item!.b) - 2.6} ${RUG - RUG_LEVEL[index] * RUG_STEP - 2.6}l5.2 5.2m0-5.2-5.2 5.2`} />}
                    </m.g>
                  ))}
                </AnimatePresence>
              </g>
              <text className="lx-axis-end" x={PAD} y={BASE + 22}>easier</text>
              <text className="lx-axis-end" x={W - PAD} y={BASE + 22} textAnchor="end">harder</text>
            </svg>

            <AnimatePresence>
              {done && (
                <m.div
                  className="lx-verdict"
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ duration: 0.7, ease: GLIDE }}
                >
                  <span className="lx-verdict-label">Level found</span>
                  <strong>{RUN.tier}</strong>
                  <span className="lx-verdict-copy">Start with {RUN.source} problems.</span>
                </m.div>
              )}
            </AnimatePresence>
            <div className="lx-ticker" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.p
                  key={latest ? latest.item!.id : 'start'}
                  initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: GLIDE }}
                >
                  {latest ? (
                    <>
                      <span className="lx-ticker-q">Q{answered}</span>
                      <span className="lx-ticker-dot" style={{ background: DOMAIN_TONE[latest.item!.domain] }} aria-hidden="true" />
                      <span>{latest.item!.source} {latest.item!.domain.toLowerCase()}</span>
                      <span className={latest.correct ? 'lx-ticker-result is-right' : 'lx-ticker-result is-miss'}>{latest.correct ? 'Right' : 'Missed'}</span>
                    </>
                  ) : (
                    <><span className="lx-ticker-q">Q0</span><span>No answers yet</span></>
                  )}
                </m.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="lx-engine-cta">
            <Magnetic>
              <button type="button" className="lx-btn lx-btn-cream" onClick={onRegister}>
                <span>Find your own level</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </button>
            </Magnetic>
            <span className="lx-engine-cta-note">Free account</span>
          </div>
        </m.div>
      </div>
    </section>
  );
}
