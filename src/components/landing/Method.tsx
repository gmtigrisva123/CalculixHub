/**
 * How it works, and Fig. 2: a whole placement on one sheet.
 *
 * The sheet at the top of the page lets a visitor answer a problem or two.
 * What the engine is for only shows over a full placement, so this section
 * prints one from the first question to the last. Time runs down the page and
 * ability across it, on the same axis as Fig. 1. Each row is a question, set
 * at its difficulty and marked; the shaded bar on the row is the engine's
 * margin of error around its estimate once that answer was in. Read down the
 * rows and the bar can be watched closing.
 *
 * The placement printed here is engineRun.ts's: the real engine and the real
 * placement bank, answering to a simulated student whose ability is known, so
 * the figure can also show the thing a real placement never can, which is
 * where the truth was all along. Once the visitor has answered something, the
 * figure can show their own sitting instead.
 */

import { useEffect, useRef, useState } from 'react';
import { ENGINE_RUN, SIMULATED_LEARNER } from './engineRun';
import { PenCross, PenTick, prefersReducedMotion } from './kit';
import { BAND_SHARES, TIER_BANDS, along } from './levels';
import { useSitting } from './sitting';

/** One question of a placement, as the figure needs it. */
interface Row {
  id: string;
  /** Where the question sat on the scale. */
  difficulty: number;
  correct: boolean;
  topic: string;
  /** The level band the engine filed it under. */
  band: string;
  /** The estimate and its margin after this answer. */
  theta: number;
  sem: number;
}

interface Run {
  /** The estimate and margin before any answer. */
  start: { theta: number; sem: number };
  rows: Row[];
}

const SIMULATED: Run = {
  start: ENGINE_RUN.steps[0],
  rows: ENGINE_RUN.steps.slice(1).map(step => ({
    id: step.item!.id,
    difficulty: step.item!.b,
    correct: Boolean(step.correct),
    topic: step.item!.domain,
    band: step.item!.source,
    theta: step.theta,
    sem: step.sem,
  })),
};

const pct = (theta: number) => `${(along(theta) * 100).toFixed(2)}`;

const STEPS = [
  {
    title: 'It starts by assuming nothing.',
    body: 'Before your first answer every level is possible. That is the low, wide hill in Fig. 1.',
  },
  {
    title: 'It asks what it most needs to know.',
    body: 'Not the next problem on a list. The one whose answer would shrink its doubt the furthest, taken from the topic it has seen least.',
  },
  {
    title: 'It stops when it is sure.',
    body: 'There is no fixed length and no score out of 25. When the margin of error is small enough to trust, it tells you where to start.',
  },
];

export default function Method() {
  const sitting = useSitting();
  const mine: Run = {
    start: sitting.marks[0]?.before ?? sitting.belief,
    rows: sitting.marks.map(mark => ({
      id: mark.item.id,
      difficulty: mark.item.b,
      correct: mark.correct,
      topic: mark.item.domain,
      band: mark.item.source,
      theta: mark.after.theta,
      sem: mark.after.sem,
    })),
  };
  const hasMine = mine.rows.length > 0;
  // The visitor's own sitting is shown as soon as there is one, unless they have asked for the other.
  const [picked, setPicked] = useState<'whole' | 'mine' | null>(null);
  const view = picked ?? (hasMine ? 'mine' : 'whole');
  const run = view === 'mine' && hasMine ? mine : SIMULATED;
  const whole = run === SIMULATED;

  // Replaying deals the rows out one at a time; `dealt` is how many are on the sheet.
  const [dealt, setDealt] = useState<number | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => { window.clearInterval(timer.current); setDealt(null); }, [view]);
  const replay = () => {
    window.clearInterval(timer.current);
    if (prefersReducedMotion()) { setDealt(null); return; }
    setDealt(0);
    let count = 0;
    timer.current = window.setInterval(() => {
      count += 1;
      if (count >= run.rows.length) { window.clearInterval(timer.current); setDealt(null); }
      else setDealt(count);
    }, 420);
  };
  const shown = dealt ?? run.rows.length;
  const last = run.rows[shown - 1] ?? run.start;

  return (
    <section className="p1-sec p1-method" id="engine" aria-labelledby="p1-method-title">
      <div className="p1-wrap p1-method-grid">
        <div className="p1-method-copy">
          <h2 id="p1-method-title" className="p1-title">Every answer redraws the curve.</h2>
          <p className="p1-prose">
            Most practice apps adapt by guessing: one right, so try a harder one. CalculixHub keeps an actual estimate of your
            level, with a margin of error attached, and chooses each problem to shrink that margin.
          </p>
          <ol className="p1-steps">
            {STEPS.map(step => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <figure className="p1-run" aria-labelledby="p1-run-caption">
          <div className="p1-run-bar">
            <div className="p1-seg" role="group" aria-label="Which placement to show">
              <button type="button" aria-pressed={whole} onClick={() => setPicked('whole')}>A whole placement</button>
              <button type="button" aria-pressed={!whole} disabled={!hasMine} onClick={() => setPicked('mine')}>
                {hasMine ? `Yours so far (${mine.rows.length})` : 'Yours so far'}
              </button>
            </div>
            <button type="button" className="p1-textbtn" onClick={replay} disabled={dealt !== null}>Replay</button>
          </div>

          <div className="p1-run-sheet">
            <ol className="p1-run-rows">
              <li className="p1-run-row">
                <span className="p1-run-no" aria-hidden="true" />
                <span className="p1-run-track" aria-hidden="true">
                  <Span theta={run.start.theta} sem={run.start.sem} />
                </span>
                <span className="p1-run-what">Before any answer</span>
              </li>
              {run.rows.map((row, index) => (
                <li key={row.id} className={index < shown ? 'p1-run-row' : 'p1-run-row is-undealt'}>
                  <span className="p1-run-no p1-num">{index + 1}</span>
                  <span className="p1-run-track" aria-hidden="true">
                    {index < shown && (
                      <>
                        <Span theta={row.theta} sem={row.sem} />
                        <span className={row.correct ? 'p1-run-mark is-right' : 'p1-run-mark'} style={{ left: `${pct(row.difficulty)}%` }}>
                          {row.correct ? <PenTick /> : <PenCross />}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="p1-run-what">
                    <span className="sr-only">A {row.band} level problem in </span>{row.topic}
                    <span className="sr-only">, {row.correct ? 'answered right' : 'missed'}. Margin of error afterwards: {row.sem.toFixed(2)}.</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="p1-run-lines" aria-hidden="true">
              {TIER_BANDS.slice(1).map(tier => <span key={tier.tier} className="p1-run-edge" style={{ left: `${pct(tier.from)}%` }} />)}
              {whole && <span className="p1-run-truth" style={{ left: `${pct(SIMULATED_LEARNER.theta)}%` }}><span>its true level</span></span>}
            </div>

            <div className="p1-run-axis" aria-hidden="true">
              <div className="p1-levels" style={{ ['--bands' as string]: BAND_SHARES.map(share => `${(share * 100).toFixed(3)}fr`).join(' ') }}>
                {TIER_BANDS.map(tier => <span key={tier.tier}>{tier.tier}</span>)}
              </div>
            </div>
          </div>

          <p className="p1-run-readout" role="status">
            {shown === 0
              ? <>Before the first answer: anywhere, <span className="p1-num">±{run.start.sem.toFixed(2)}</span>.</>
              : <>After {shown} {shown === 1 ? 'answer' : 'answers'}: <b>{tierOf(last.theta)}</b>, <span className="p1-num">±{last.sem.toFixed(2)}</span>.{whole && shown === run.rows.length && <> Sure enough to stop. It starts this student on {ENGINE_RUN.source} problems.</>}</>}
          </p>

          <figcaption id="p1-run-caption" className="p1-caption">
            <b>Fig. 2.</b>{' '}
            {whole
              ? <>A whole placement, as the engine ran it. A simulated student of fixed ability (the dashed line) answers what the engine asks. Each row is a question, marked and set at its difficulty; the bar is the margin of error round the engine’s estimate once that answer was in. It stopped itself after {SIMULATED.rows.length} questions.</>
              : <>Your own sitting so far. Each row is a problem you answered, set at its difficulty; the bar is the margin of error round the engine’s estimate of you once that answer was in.</>}
            {' '}Difficulties are provisional until they are fitted to real answers; the margin of error is the engine’s own arithmetic.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** The margin of error round an estimate, as a bar on a row, with the estimate itself ruled through it. */
function Span({ theta, sem }: { theta: number; sem: number }) {
  const from = along(theta - sem) * 100;
  const to = along(theta + sem) * 100;
  return (
    <>
      <span className="p1-run-span" style={{ left: `${from.toFixed(2)}%`, width: `${(to - from).toFixed(2)}%` }} />
      <span className="p1-run-est" style={{ left: `${pct(theta)}%` }} />
    </>
  );
}

function tierOf(theta: number): string {
  return (TIER_BANDS.find(band => theta >= band.from && theta < band.to) ?? TIER_BANDS[TIER_BANDS.length - 1]).tier;
}
