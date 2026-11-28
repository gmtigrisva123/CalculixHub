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
 *
 * Where WebGL runs, the chart is drawn in 3D by the page's stage (glEngine.ts):
 * the curve becomes a ribbon of light, the tiers frosted-glass slabs, each
 * answer a bead that drops onto the axis. Both drawings read the replay from
 * engineReplay.ts and the playhead from the page clock, so the readouts here
 * and the ribbon there are always on the same answer. The SVG below stays in
 * the document as the drawing for a machine without WebGL, and the labels the
 * 3D chart needs (tiers, easier and harder, YOU) stay DOM text, moved by the
 * stage to where their 3D anchors land.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { TIER_BANDS } from './engineRun';
import { ANSWERS, CHART, RUG_LEVEL, RUN, chartX as x, heightAtEstimate, replayAt, weightAt } from './engineReplay';
import { useStageScroll } from './stageLayout';
import { ENGINE_PINNED, ENGINE_UNPINNED_EDGES } from './engineReplay';
import { useMediaQuery } from '../../hooks/useBreakpoint';
import { Arrow, GLIDE, Magnetic, SPRING, SplitText } from './kit';

// Chart geometry, in viewBox units (shared with the 3D chart).
const { W, PAD, BASE, CURVE_H, RUG, RUG_STEP, HEIGHT, THETA_MIN, THETA_MAX } = CHART;
const VISIBLE = RUN.grid.map((theta, index) => ({ theta, index })).filter(node => node.theta >= THETA_MIN - 1e-9 && node.theta <= THETA_MAX + 1e-9);

const BEATS = [
  { title: 'It starts open-minded.', body: 'Before the first answer, any level is possible.' },
  { title: 'Each answer narrows it down.', body: 'Right answers move the guess up. Misses move it down.' },
  { title: 'Each question fits.', body: 'Not too easy, not too hard.' },
  { title: 'It stops when it’s sure.', body: `This time, after ${ANSWERS} questions.` },
];

const DOMAIN_TONE: Record<string, string> = {
  Algebra: 'var(--lx-w1-a)', Geometry: 'var(--lx-w2-a)', Combinatorics: 'var(--lx-w3-a)', 'Number Theory': 'var(--lx-w4-a)',
};

interface EngineStoryProps {
  onRegister: () => void;
}

export default function EngineStory({ onRegister }: EngineStoryProps) {
  const reduce = Boolean(useReducedMotion());
  const sectionRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  /*
   * Pinned on a screen wide and tall enough to hold the whole instrument; below
   * that the stage scrolls like any other block and the replay runs while its
   * chart passes through the screen. Both playheads are written by the page
   * clock in the scroll's own frame (the same numbers the 3D chart reads); the
   * section says which one is in use (data-pinned), so the stage cannot pick
   * the other.
   */
  const pinned = useMediaQuery(ENGINE_PINNED);
  const pinnedPlayhead = useStageScroll(sectionRef, ['start start', 'end end']);
  const passingPlayhead = useStageScroll(chartRef, ENGINE_UNPINNED_EDGES);
  const playhead = pinned ? pinnedPlayhead : passingPlayhead;
  const arrival = useStageScroll(sectionRef, ['start end', 'start start']);
  // The stage grows into the frame as it arrives. Scale only: its corner radius used to
  // tighten on the way in, which repainted the whole stage on every frame of the approach.
  const stageScale = useTransform(arrival, [0, 1], [reduce ? 1 : 0.9, 1]);

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

  const draw = useCallback((progress: number) => {
    const state = replayAt(progress, reduce);

    let line = '';
    for (const { theta, index } of VISIBLE) {
      const weight = weightAt(state, index);
      const px = x(theta).toFixed(1);
      const py = (BASE - (weight / RUN.peak) * CURVE_H).toFixed(1);
      line += `${line ? 'L' : 'M'}${px} ${py}`;
    }
    const area = `${line}L${x(THETA_MAX).toFixed(1)} ${BASE}L${x(THETA_MIN).toFixed(1)} ${BASE}Z`;
    areaRef.current?.setAttribute('d', area);
    lineRef.current?.setAttribute('d', line);
    glowRef.current?.setAttribute('d', line);

    // Height of the interpolated curve at the estimate, for the marker's top.
    const top = BASE - (heightAtEstimate(state) / RUN.peak) * CURVE_H;
    if (estimateRef.current) {
      estimateRef.current.style.transform = `translateX(${x(state.theta).toFixed(1)}px)`;
      estimateRef.current.querySelector('line')?.setAttribute('y1', top.toFixed(1));
      estimateRef.current.querySelector('circle')?.setAttribute('cy', top.toFixed(1));
    }
    markRef.current?.setAttribute('y', (top - 18).toFixed(1));
    if (intervalRef.current) {
      intervalRef.current.setAttribute('x', x(state.theta - state.sem).toFixed(1));
      intervalRef.current.setAttribute('width', (x(state.theta + state.sem) - x(state.theta - state.sem)).toFixed(1));
    }
    if (sureRef.current) sureRef.current.style.transform = `scaleX(${state.sure.toFixed(3)})`;
    const tier = TIER_BANDS[state.tierIndex];
    if (tierRef.current && tierRef.current.textContent !== tier.tier) tierRef.current.textContent = tier.tier;
    bandRefs.current.forEach((node, index) => node?.toggleAttribute('data-active', index === state.tierIndex));

    setAnswered(state.answered);
    setBeat(state.beat);
  }, [reduce]);

  // The playhead is written once per frame by the page clock, so drawing on its change is drawing once per frame.
  useMotionValueEvent(playhead, 'change', value => draw(value));
  useLayoutEffect(() => { draw(playhead.get()); }, [draw, playhead]);

  const latest = answered > 0 ? RUN.steps[answered] : null;
  const done = beat === 3;

  return (
    <section ref={sectionRef} className="lx-engine" id="engine" data-pinned={pinned ? 'true' : 'false'} aria-labelledby="lx-engine-title">
      <div className="lx-engine-pin">
        <m.div className="lx-engine-stage" data-tone="ink" style={{ scale: stageScale }}>
          <div className="lx-engine-grid" aria-hidden="true" />
          {/* Labels for the 3D chart, placed each frame by the stage where their anchors land. */}
          <div className="lx-chart-labels" data-engine-labels aria-hidden="true">
            {TIER_BANDS.map(band => <span key={band.tier} data-tier>{band.tier}</span>)}
            <span data-end="easier">easier</span>
            <span data-end="harder">harder</span>
            <span data-you>YOU</span>
          </div>
          <header className="lx-engine-head">
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

            {/* The 3D chart is drawn over this box; the SVG inside is the drawing without WebGL. */}
            {/* The description lives on the box, which stays in place whichever drawing is showing. */}
            <div className="lx-chart-wrap" data-engine-chart ref={chartRef} role="img" aria-label={`The guess of one student’s level, after each answer. It was sure after ${ANSWERS} questions: ${RUN.tier}.`}>
            <svg className="lx-chart" data-gl-swap viewBox={`0 0 ${W} ${HEIGHT}`} aria-hidden="true">
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
            </div>

            {/* Always in the document (hidden until the end) so the 3D stage can measure it and keep its light behind it. */}
            <m.div
              className="lx-verdict"
              aria-hidden={!done}
              initial={false}
              animate={done ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ ...SPRING.settle, opacity: { duration: 0.5, ease: GLIDE } }}
              style={{ visibility: done ? 'visible' : 'hidden', transitionProperty: 'visibility', transitionDelay: done ? '0s' : '0.5s' }}
            >
              <span className="lx-verdict-label">Level found</span>
              <strong>{RUN.tier}</strong>
              <span className="lx-verdict-copy">Start with {RUN.source} problems.</span>
            </m.div>
            <div className="lx-ticker" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.p
                  key={latest ? latest.item!.id : 'start'}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ ...SPRING.press, opacity: { duration: 0.25 } }}
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
