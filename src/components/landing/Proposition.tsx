/**
 * "Try one", and Fig. 3: a theorem to pick up and turn.
 *
 * Two chords of a circle cross at P. Point C can be dragged round the circle
 * (or turned from the keyboard), and the two rectangles beside the figure show
 * what Euclid proved: the parts of one chord make a rectangle exactly as large
 * as the parts of the other, however the chord is turned. The figure is drawn
 * after Oliver Byrne's 1847 Euclid, which told its proofs in four colours where
 * other books used letters; here each part of a chord keeps its colour in the
 * figure, in the rectangles and in the sentence that states the proposition.
 *
 * Under it is an original AIME-style problem that turns on that one fact, with
 * what the product offers a stuck learner, in order: a nudge from the tutor
 * first, the full solution only when asked for.
 */

import { useId, useRef, useState } from 'react';
import MathText from '../MathText';
import { CHORD_POINT, CHORD_RADIUS, INITIAL_CHORD_ANGLE, chordEndpoints } from './chords';
import { PenCross, PenTick } from './kit';

// The figure, in viewBox units: the circle's centre, and how many units one unit of length takes.
const SIZE = 400;
const CENTRE = SIZE / 2;
const SCALE = 10;
const at = (point: { x: number; y: number }) => ({ x: CENTRE + point.x * SCALE, y: CENTRE - point.y * SCALE });
/** A point's label sits just outside the circle, on the line from the centre through the point. */
const outside = (point: { x: number; y: number }, by = 22) => {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: CENTRE + (point.x / length) * (CHORD_RADIUS * SCALE + by), y: CENTRE - (point.y / length) * (CHORD_RADIUS * SCALE + by) };
};

const HALF_AB = Math.sqrt(CHORD_RADIUS ** 2 - CHORD_POINT.x ** 2);
const A = { x: CHORD_POINT.x, y: HALF_AB };
const B = { x: CHORD_POINT.x, y: -HALF_AB };
const PA = HALF_AB - CHORD_POINT.y;
const PB = HALF_AB + CHORD_POINT.y;
const TURN = { min: -25, max: 155 } as const;
const ANSWER = CHORD_RADIUS ** 2;

const SOLUTION = [
  'The two rectangles are equal: $PA\\cdot PB=PC\\cdot PD=189$. Put $P$ at the origin with $PA$ along the vertical axis.',
  'The perpendicular from the centre bisects each chord, so $O$ projects to $-6$ on line $PA$ and to $-10$ on line $PC$.',
  'With $\\cos\\angle APC=3/5$, line $PC$ points along $(4/5,\\,3/5)$. So $O_y=-6$, and $\\tfrac45 O_x+\\tfrac35(-6)=-10$ gives $O_x=-8$.',
  'Then $OP^2=8^2+6^2=100$, and $r^2=OP^2+189=289$.',
];

const EXCHANGE = [
  { who: 'You', line: 'I’m stuck on the two chords.' },
  { who: 'Tutor', line: 'What do you know about the point where two chords cross?' },
  { who: 'You', line: 'That PA × PB = PC × PD?' },
  { who: 'Tutor', line: 'Exactly. Now, where could the centre be? What does a chord tell you about it?' },
] as const;

export default function Proposition() {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [angle, setAngle] = useState(INITIAL_CHORD_ANGLE);
  const [dragging, setDragging] = useState(false);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [solved, setSolved] = useState(false);

  const chord = chordEndpoints(angle);
  const p = at(CHORD_POINT);
  const a = at(A);
  const b = at(B);
  const c = at(chord.c);
  const d = at(chord.d);
  const midCD = at({ x: (chord.c.x + chord.d.x) / 2, y: (chord.c.y + chord.d.y) / 2 });
  const midAB = at({ x: CHORD_POINT.x, y: 0 });
  const moved = Math.abs(angle - INITIAL_CHORD_ANGLE) > 0.05;
  const right = checked && Number(answer) === ANSWER;

  const turn = (degrees: number) => setAngle(Math.max(TURN.min, Math.min(TURN.max, degrees)));
  const follow = (event: React.PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    turn(Math.atan2(p.y - point.y, point.x - p.x) * 180 / Math.PI);
  };
  const onKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') turn(angle + step);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') turn(angle - step);
    else if (event.key === 'Home') turn(INITIAL_CHORD_ANGLE);
    else return;
    event.preventDefault();
  };

  // One unit of length in the rectangles, in rem. The tallest they are asked to stand is PD at its start, 27 units.
  const unit = 0.3;
  const rem = (length: number) => `${(length * unit).toFixed(3)}rem`;

  return (
    <section className="p1-sec p1-prop" id="playground" aria-labelledby="p1-prop-title">
      <div className="p1-wrap p1-prop-grid">
        <figure className="p1-chords" aria-labelledby={`${id}-caption`}>
          <svg
            ref={svg}
            className={dragging ? 'p1-chords-svg is-dragging' : 'p1-chords-svg'}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            onPointerMove={dragging ? follow : undefined}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <circle className="p1-chords-circle" cx={CENTRE} cy={CENTRE} r={CHORD_RADIUS * SCALE} />
            {solved && (
              <g className="p1-chords-working">
                <line x1={CENTRE} y1={CENTRE} x2={midAB.x} y2={midAB.y} />
                <line x1={CENTRE} y1={CENTRE} x2={midCD.x} y2={midCD.y} />
                <line className="is-solid" x1={CENTRE} y1={CENTRE} x2={p.x} y2={p.y} />
                <circle cx={CENTRE} cy={CENTRE} r={4} />
                <text x={CENTRE - 20} y={CENTRE + 22}>O</text>
              </g>
            )}
            <line className="p1-seg-pa" x1={p.x} y1={p.y} x2={a.x} y2={a.y} />
            <line className="p1-seg-pb" x1={p.x} y1={p.y} x2={b.x} y2={b.y} />
            <line className="p1-seg-pc" x1={p.x} y1={p.y} x2={c.x} y2={c.y} />
            <line className="p1-seg-pd" x1={p.x} y1={p.y} x2={d.x} y2={d.y} />
            <circle className="p1-chords-joint" cx={p.x} cy={p.y} r={6} />
            {[a, b, d].map((point, index) => <circle key={index} className="p1-chords-end" cx={point.x} cy={point.y} r={4.5} />)}
            <g className="p1-chords-names" aria-hidden="true">
              <text {...outside(A)}>A</text>
              <text {...outside(B)}>B</text>
              <text {...outside(chord.c, 30)}>C</text>
              <text {...outside(chord.d)}>D</text>
              <text x={p.x - 24} y={p.y - 4}>P</text>
            </g>
            <g
              className="p1-chords-handle"
              role="slider"
              tabIndex={0}
              aria-label="Point C. Turn chord CD round the circle."
              aria-valuemin={TURN.min}
              aria-valuemax={TURN.max}
              aria-valuenow={Math.round(angle)}
              aria-valuetext={`PC is ${chord.near.toFixed(2)} and PD is ${chord.far.toFixed(2)}. Their product is ${chord.power}.`}
              onKeyDown={onKey}
              onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); setDragging(true); }}
            >
              <circle className="p1-chords-reach" cx={c.x} cy={c.y} r={28} />
              <circle className="p1-chords-knob" cx={c.x} cy={c.y} r={11} />
            </g>
          </svg>

          <div className="p1-rects" aria-hidden="true">
            <div className="p1-rect">
              <span className="p1-rect-box is-ab" style={{ width: rem(PA), height: rem(PB) }} />
              <span className="p1-rect-sides p1-num">{PA} × {PB} = <b>{chord.power}</b></span>
            </div>
            <div className="p1-rect">
              <span className="p1-rect-box is-cd" style={{ width: rem(chord.near), height: rem(chord.far) }} />
              <span className="p1-rect-sides p1-num">{chord.near.toFixed(2)} × {chord.far.toFixed(2)} = <b>{chord.power}</b></span>
            </div>
          </div>

          <figcaption id={`${id}-caption`} className="p1-caption">
            <b>Fig. 3.</b> Drag <i>C</i> round the circle, or focus it and use the arrow keys. The two parts of chord <i>CD</i> change;
            the rectangle they make does not. After Euclid, <i>Elements</i> III.35, drawn in the manner of Oliver Byrne’s 1847 edition,
            which used colour where other books used letters.
            {moved && <> <button type="button" className="p1-textbtn is-inline" onClick={() => setAngle(INITIAL_CHORD_ANGLE)}>Put C back</button></>}
          </figcaption>
        </figure>

        <div className="p1-prop-copy">
          <h2 id="p1-prop-title" className="p1-title">Two chords cross. One number will not move.</h2>
          <p className="p1-prop-statement">
            If two chords of a circle cut one another, the rectangle under the two parts of one,{' '}
            <Part of="pa" name="PA" /> and <Part of="pb" name="PB" />, is equal to the rectangle under the two parts of the other,{' '}
            <Part of="pc" name="PC" /> and <Part of="pd" name="PD" />.
          </p>
          <p className="p1-prose">
            That is the whole of the idea, and it is easier to see than to be told. Now use it.
          </p>

          <form className="p1-task" onSubmit={event => { event.preventDefault(); if (answer) setChecked(true); }}>
            <p className="p1-task-text">
              <MathText text="In the figure as it first stands, $PA=9$, $PB=21$, $PC=7$, $PD=27$ and $\cos\angle APC=\tfrac35$. What is the square of the circle’s radius?" />
            </p>
            <div className="p1-task-row">
              <label htmlFor={`${id}-answer`}><MathText text="$r^2=$" /></label>
              <input
                id={`${id}-answer`}
                className="p1-input"
                inputMode="numeric"
                pattern="[0-9]{1,3}"
                maxLength={3}
                autoComplete="off"
                placeholder="0 to 999"
                value={answer}
                data-state={checked ? (right ? 'right' : 'wrong') : undefined}
                aria-describedby={`${id}-feedback`}
                aria-invalid={checked && !right || undefined}
                onChange={event => { setAnswer(event.target.value.replace(/[^0-9]/g, '')); setChecked(false); }}
              />
              <button type="submit" className="p1-btn is-outline" disabled={!answer}>Check</button>
            </div>
            <p id={`${id}-feedback`} className="p1-task-feedback" role="status">
              {checked && (right
                ? <><PenTick /> Right: 289. Compare your route with the solution.</>
                : <><PenCross /> Not yet. The centre is the key: every chord’s perpendicular bisector passes through it.</>)}
            </p>
            <div className="p1-task-help">
              <button type="button" className="p1-textbtn" aria-expanded={nudge} aria-controls={`${id}-nudge`} onClick={() => setNudge(open => !open)}>
                {nudge ? 'Hide the nudge' : 'Ask for a nudge'}
              </button>
              <button type="button" className="p1-textbtn" aria-expanded={solved} aria-controls={`${id}-solution`} onClick={() => setSolved(open => !open)}>
                {solved ? 'Hide the solution' : 'Show the solution'}
              </button>
            </div>
          </form>

          {nudge && (
            <div id={`${id}-nudge`} className="p1-reveal">
              <dl className="p1-dialogue">
                {EXCHANGE.map((turnOf, index) => (
                  <div key={index} className={turnOf.who === 'Tutor' ? 'is-tutor' : undefined}>
                    <dt>{turnOf.who}</dt>
                    <dd>{turnOf.line}</dd>
                  </div>
                ))}
              </dl>
              <p className="p1-caption">A sample of how the tutor talks. It asks the question that gets you moving again; it does not hand over the answer.</p>
            </div>
          )}
          {solved && (
            <ol id={`${id}-solution`} className="p1-reveal p1-solution">
              {SOLUTION.map((step, index) => <li key={index}><MathText text={step} /></li>)}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

/** One part of a chord, named in the sentence by its colour, as Byrne named them. */
function Part({ of, name }: { of: 'pa' | 'pb' | 'pc' | 'pd'; name: string }) {
  return (
    <span className="p1-part">
      <span className={`p1-part-bar is-${of}`} aria-hidden="true" />
      <span className="p1-part-name">{name}</span>
    </span>
  );
}
