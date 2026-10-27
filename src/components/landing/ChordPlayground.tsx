/**
 * "Try one now": an original AIME-style problem the reader can hold in their hands.
 *
 * Two chords meet at P; point C can be dragged (or the chord turned with the
 * slider) and the readout shows PC · PD staying at 189 however the chord
 * turns — the power of the point, discovered rather than stated. The given
 * problem refers to the starting figure, and Reset returns to it.
 *
 * The figure draws itself in when it is scrolled to: the circle, then the
 * chords, then the points. Checking an answer responds in place — a settled
 * tick for 289, a small shake and a nudge otherwise — and the worked reasoning
 * unfolds beneath the form, adding the centre O to the drawing.
 */

import { useRef, useState } from 'react';
import { AnimatePresence, m, useAnimationControls, useReducedMotion } from 'motion/react';
import MathText from '../MathText';
import { chordEndpoints, INITIAL_CHORD_ANGLE } from './chords';
import { Arrow, Eyebrow, GLIDE, Rise, SplitText } from './kit';

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  shown: (delay: number) => ({ pathLength: 1, opacity: 1, transition: { pathLength: { duration: 1.4, ease: GLIDE, delay }, opacity: { duration: 0.2, delay } } }),
};
/** Dashed strokes fade in instead: drawing on would overwrite their dash pattern. */
const fade = {
  hidden: { opacity: 0 },
  shown: (delay: number) => ({ opacity: 1, transition: { duration: 0.8, ease: GLIDE, delay } }),
};
const pop = {
  hidden: { scale: 0, opacity: 0 },
  shown: (delay: number) => ({ scale: 1, opacity: 1, transition: { type: 'spring' as const, visualDuration: 0.5, bounce: 0.4, delay } }),
};
const SELF = { transformBox: 'fill-box' as const, transformOrigin: 'center' };

export default function ChordPlayground() {
  const reduce = useReducedMotion();
  const [angle, setAngle] = useState(INITIAL_CHORD_ANGLE);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const shake = useAnimationControls();

  const geometry = chordEndpoints(angle);
  const xy = (point: { x: number; y: number }) => ({ x: 300 + point.x * 8, y: 190 - point.y * 8 });
  const c = xy(geometry.c);
  const d = xy(geometry.d);
  const p = xy({ x: 8, y: 6 });
  const right = checked && Number(answer) === 289;

  const turn = (value: number) => {
    setAngle(value);
    setMoved(true);
  };
  const reset = () => {
    setAngle(INITIAL_CHORD_ANGLE);
    setRevealed(false);
    setAnswer('');
    setChecked(false);
    setMoved(false);
  };
  const check = () => {
    setChecked(true);
    if (Number(answer) !== 289 && !reduce) void shake.start({ x: [0, -7, 6, -4, 3, 0], transition: { duration: 0.45, ease: 'easeOut' } });
  };

  return (
    <section className="lx-play" id="playground" data-tone="paper" aria-labelledby="lx-play-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <div>
            <Eyebrow index="03">Try one</Eyebrow>
            <SplitText as="h2" id="lx-play-title" className="lx-h2" text={'Two chords.\n*One hidden radius.*'} />
          </div>
          <Rise as="p" className="lx-lead" delay={0.1}>
            No timer, no score. Move the picture until you see it.
          </Rise>
        </header>

        <Rise className="lx-bezel" y={70} amount={0.15} blur={false}>
          <div className="lx-bezel-core lx-play-card">
            <div className="lx-play-problem">
              <span className="lx-play-tag">The problem</span>
              <p className="lx-play-statement">Two chords of a circle meet at a point <i>P</i> inside it.</p>
              <div className="lx-play-givens">
                <MathText text="$PA=9,\;PB=21,\;PC=7,\;PD=27$" />
                <MathText text="$\cos\angle APC=\tfrac{3}{5}$" />
              </div>
              <p className="lx-play-ask">What is the square of the circle’s radius?</p>

              <form className="lx-answer" onSubmit={event => { event.preventDefault(); check(); }}>
                <label htmlFor="lx-radius-answer">Your answer for <i>r</i>²</label>
                <m.div className="lx-answer-row" animate={shake} data-state={checked ? (right ? 'right' : 'wrong') : undefined}>
                  <input
                    id="lx-radius-answer"
                    inputMode="numeric"
                    pattern="[0-9]{1,3}"
                    maxLength={3}
                    autoComplete="off"
                    value={answer}
                    placeholder="0 to 999"
                    onChange={event => { setAnswer(event.target.value.replace(/[^0-9]/g, '')); setChecked(false); }}
                    aria-describedby="lx-answer-feedback"
                  />
                  <button type="submit" className="lx-answer-check" disabled={!answer}>
                    <span>Check</span>
                    <Arrow direction="right" size={15} />
                  </button>
                </m.div>
                <div id="lx-answer-feedback" className="lx-answer-feedback" role="status">
                  <AnimatePresence mode="wait" initial={false}>
                    {checked && (
                      <m.p
                        key={right ? 'right' : 'wrong'}
                        className={right ? 'is-right' : 'is-wrong'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.35, ease: GLIDE }}
                      >
                        {right
                          ? <><TickMark /> Right: 289. Compare with the solution below.</>
                          : 'Not quite. Hint: find the centre from the midpoints of the chords.'}
                      </m.p>
                    )}
                  </AnimatePresence>
                </div>
              </form>

              <button type="button" className="lx-reveal" aria-expanded={revealed} aria-controls="lx-chord-solution" onClick={() => setRevealed(open => !open)}>
                <span>{revealed ? 'Hide the solution' : 'Show the solution'}</span>
                <span className="lx-reveal-sign" aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {revealed && (
                  <m.div
                    id="lx-chord-solution"
                    className="lx-solution"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ height: { duration: 0.6, ease: GLIDE }, opacity: { duration: 0.35 } }}
                  >
                    <m.ol initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}>
                      {[
                        'The intersecting-chord theorem gives $PA\\cdot PB=PC\\cdot PD=189$. Put $P$ at the origin with $PA$ along the vertical axis.',
                        'The perpendicular from the centre bisects each chord, so $O$ projects to $-6$ on line $PA$ and to $-10$ on line $PC$.',
                        'With $\\cos\\angle APC=3/5$, line $PC$ points along $(4/5,\\,3/5)$. So $O_y=-6$, and $\\tfrac45 O_x+\\tfrac35(-6)=-10$ gives $O_x=-8$.',
                        'Then $OP^2=8^2+6^2=100$, and $r^2=OP^2+189=\\boxed{289}$.',
                      ].map((step, index) => (
                        <m.li key={index} variants={{ hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: GLIDE } } }}>
                          <span className="lx-step">{index + 1}</span>
                          <MathText text={step} />
                        </m.li>
                      ))}
                    </m.ol>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lx-play-figure">
              <div className="lx-figure-bar">
                <span>Move <i>C</i>. Watch what stays.</span>
                <button type="button" className="lx-icon-btn" onClick={reset} aria-label="Reset to the problem’s starting figure">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4M4.5 3.5V6.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <m.svg
                ref={svg}
                className="lx-chord-svg"
                viewBox="0 0 600 390"
                role="img"
                aria-label="Two chords AB and CD meet at P inside a circle. Turn chord CD with the slider, or drag point C."
                initial="hidden"
                whileInView="shown"
                viewport={{ once: true, amount: 0.4 }}
                onPointerMove={event => {
                  if (!dragging || !svg.current) return;
                  const matrix = svg.current.getScreenCTM();
                  if (!matrix) return;
                  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
                  const degrees = Math.atan2(p.y - point.y, point.x - p.x) * 180 / Math.PI;
                  turn(Math.max(-25, Math.min(155, degrees)));
                }}
                onPointerUp={() => setDragging(false)}
                onPointerCancel={() => setDragging(false)}
              >
                <defs>
                  <pattern id="lx-chord-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".9" className="lx-grid-dot" /></pattern>
                  <radialGradient id="lx-chord-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0" style={{ stopColor: 'var(--lx-accent-soft)', stopOpacity: 0.9 }} />
                    <stop offset="1" style={{ stopColor: 'var(--lx-accent-soft)', stopOpacity: 0 }} />
                  </radialGradient>
                </defs>
                <rect width="600" height="390" fill="url(#lx-chord-grid)" />
                <circle cx="300" cy="190" r="168" fill="url(#lx-chord-glow)" />
                <m.circle cx="300" cy="190" r="136" className="lx-chord-circle" variants={draw} custom={0} />
                <m.path d={`M364 70L${c.x} ${c.y}L364 310L${d.x} ${d.y}Z`} className="lx-chord-quad" variants={fade} custom={1.1} />
                <m.path d="M364 70L364 310" className="lx-chord-line" variants={draw} custom={0.45} />
                <m.path d={`M${c.x} ${c.y}L${d.x} ${d.y}`} className="lx-chord-line is-live" variants={draw} custom={0.65} />
                {[[364, 70], [364, 310], [d.x, d.y], [p.x, p.y]].map(([cx, cy], index) => (
                  <m.circle key={index} cx={cx} cy={cy} r="4.5" className="lx-chord-point" variants={pop} custom={1.1 + index * 0.08} style={SELF} />
                ))}
                <g className="lx-chord-labels">
                  <text x="374" y="60">A</text>
                  <text x="374" y="334">B</text>
                  <text x={p.x - 26} y={p.y - 8}>P</text>
                  <text x={c.x + 14} y={c.y - 14}>C</text>
                  <text x={d.x - 24} y={d.y + 26}>D</text>
                </g>
                <text x="380" y="110" className="lx-chord-length">9</text>
                <text x="380" y="232" className="lx-chord-length">21</text>
                <AnimatePresence>
                  {revealed && (
                    <m.g initial="hidden" animate="shown" exit="hidden">
                      <m.path d="M300 190L364 142" className="lx-chord-radius" variants={draw} custom={0.1} />
                      <m.path d="M300 190H364V142" className="lx-chord-proj" variants={fade} custom={0.35} />
                      <m.circle cx="300" cy="190" r="4.5" className="lx-chord-centre" variants={pop} custom={0.2} style={SELF} />
                      <m.text x="276" y="212" className="lx-chord-o" variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { delay: 0.4 } } }}>O</m.text>
                    </m.g>
                  )}
                </AnimatePresence>
                <g
                  className={dragging ? 'lx-handle is-dragging' : 'lx-handle'}
                  onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
                >
                  <circle cx={c.x} cy={c.y} r="30" className="lx-handle-hit" />
                  {!moved && !reduce && <circle cx={c.x} cy={c.y} r="14" className="lx-handle-ping" />}
                  <circle cx={c.x} cy={c.y} r="14" className="lx-handle-halo" />
                  <circle cx={c.x} cy={c.y} r="6.5" className="lx-handle-dot" />
                </g>
              </m.svg>

              <div className="lx-chord-control">
                <label htmlFor="lx-chord-angle">Turn chord <i>CD</i></label>
                <input
                  id="lx-chord-angle"
                  type="range"
                  min="-25"
                  max="155"
                  step="0.1"
                  value={angle}
                  onChange={event => turn(Number(event.target.value))}
                  aria-valuetext={`${angle.toFixed(1)} degrees`}
                />
              </div>
              <div className="lx-invariant" data-moved={moved || undefined}>
                <div>
                  <span>PC × PD</span>
                  <strong className="lx-tabular">{geometry.near.toFixed(2)} × {geometry.far.toFixed(2)}</strong>
                </div>
                <span className="lx-invariant-eq" aria-hidden="true">≈</span>
                <div className="lx-invariant-power">
                  <span>always</span>
                  <strong className="lx-tabular">{geometry.power}</strong>
                </div>
              </div>
              <p className="lx-chord-note">
                {moved ? 'The lengths change. Their product never does.' : 'Drag C, or use the slider.'}
              </p>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}

function TickMark() {
  return (
    <svg className="lx-tick-mark" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <m.path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: GLIDE, delay: 0.1 }} />
    </svg>
  );
}
