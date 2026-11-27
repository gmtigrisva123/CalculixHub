/**
 * Fig. 1: what the engine believes about the visitor.
 *
 * One curve over the ability scale: the engine's posterior, the same weights
 * every estimate in the product is read from. Before any answer it is the
 * prior, a low wide hill. Each answer on the sheet redraws it, and the picture
 * of an estimate sharpening is the estimator's own state rather than a drawing
 * of it. The red line is the estimate ("you"), the heavy blue bar on the axis
 * its margin of error, and the small marks along the axis are the problems
 * answered so far, each at its own difficulty.
 *
 * The area under the curve is always the same, so a belief that narrows has to
 * rise. That is the whole story the figure tells, and it is why the hill is
 * allowed to start low.
 *
 * Moving from one belief to the next, the weights themselves are eased, and
 * the path, the marker and the four percentages are all written from the eased
 * weights on each frame. They go straight to the DOM: nothing in React
 * re-renders while the curve is in motion.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AXIS, BAND_SHARES, TIER_BANDS, along } from './levels';
import { PenCross, PenTick, smoothPath, tween, useOnScreen } from './kit';
import { GRID, tierShares, useSitting, type Belief, type Mark } from './sitting';

// The plot, in viewBox units. It is stretched to whatever width it is given.
const W = 1000;
const H = 100;
/** The weight drawn at full height: a belief about as sharp as the engine asks for before it stops. */
const PEAK = 0.12;
const HEADROOM = 6;

const DRAWN = GRID.map((theta, index) => ({ theta, index })).filter(node => node.theta >= AXIS.min - 1e-9 && node.theta <= AXIS.max + 1e-9);
const yOf = (weight: number) => Math.max(HEADROOM / 2, H - (weight / PEAK) * (H - HEADROOM));

/** The curve's height at any ability, between grid points. */
function weightAt(weights: readonly number[], theta: number): number {
  const position = (theta - GRID[0]) / (GRID[1] - GRID[0]);
  const lower = Math.max(0, Math.min(GRID.length - 2, Math.floor(position)));
  const blend = position - lower;
  return weights[lower] * (1 - blend) + weights[lower + 1] * blend;
}

/** Problems of nearly the same difficulty stack upwards instead of landing on each other. */
function stackLevels(marks: readonly Mark[]): number[] {
  return marks.map((mark, index) => marks.slice(0, index).filter(earlier => Math.abs(earlier.item.b - mark.item.b) < 0.16).length);
}

const NOTHING: Belief = { theta: 0, sem: 1, tier: 'Intermediate', weights: GRID.map(() => 0), shares: TIER_BANDS.map(() => 0) };

export default function BeliefFigure() {
  const sitting = useSitting();
  /*
   * The curve only moves while it can be seen. On a narrow screen the figure
   * sits under the sheet, and an answer given there would otherwise redraw it
   * out of sight; instead the figure keeps showing the sitting as it last
   * drew it, and catches up, all of it together, when the reader scrolls to
   * it. Cause and effect stay visible whichever way the page is laid out.
   */
  const [plotRef, onScreen] = useOnScreen<HTMLDivElement>(0.4);
  const [state, setState] = useState(sitting);
  useEffect(() => { if (onScreen) setState(sitting); }, [onScreen, sitting]);
  const { belief, marks } = state;
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const stemRef = useRef<SVGLineElement>(null);
  const spanRef = useRef<SVGLineElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const shareRefs = useRef<(HTMLElement | null)[]>([]);
  /** What is on screen now, so a new belief starts from there even if it arrives mid-flight. */
  const shown = useRef<Belief>(NOTHING);

  const draw = (now: Belief) => {
    const points = DRAWN.map(({ theta, index }) => [along(theta) * W, yOf(now.weights[index])] as const);
    const line = smoothPath(points);
    lineRef.current?.setAttribute('d', line);
    areaRef.current?.setAttribute('d', `${line}L${W} ${H}L0 ${H}Z`);

    const x = along(now.theta);
    const top = yOf(weightAt(now.weights, now.theta));
    if (stemRef.current) {
      stemRef.current.setAttribute('x1', (x * W).toFixed(1));
      stemRef.current.setAttribute('x2', (x * W).toFixed(1));
      stemRef.current.setAttribute('y1', top.toFixed(2));
    }
    if (spanRef.current) {
      spanRef.current.setAttribute('x1', (along(now.theta - now.sem) * W).toFixed(1));
      spanRef.current.setAttribute('x2', (along(now.theta + now.sem) * W).toFixed(1));
    }
    if (youRef.current) {
      youRef.current.style.transform = `translate(${(x * 100).toFixed(2)}%, ${top.toFixed(2)}%)`;
      youRef.current.dataset.side = x > 0.86 ? 'end' : x < 0.14 ? 'start' : 'middle';
    }
    const shares = tierShares(now.weights);
    const total = shares.reduce((sum, share) => sum + share, 0) || 1;
    shareRefs.current.forEach((node, index) => {
      if (node) node.textContent = `${Math.round((shares[index] / total) * 100)}%`;
    });
  };

  // Before the first paint: the axis with nothing on it, so the hill can rise rather than appear.
  useLayoutEffect(() => { draw(shown.current); }, []);

  useEffect(() => {
    if (!onScreen) return;
    const from = shown.current;
    const to = belief;
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    // The first belief drawn is the prior, lifting off the axis: the page's one entrance.
    const first = from === NOTHING;
    const stop = tween(first ? 1100 : 760, t => {
      const now: Belief = {
        ...to,
        theta: mix(from.theta, to.theta, t),
        sem: mix(from.sem, to.sem, t),
        weights: to.weights.map((weight, index) => mix(from.weights[index], weight, t)),
      };
      shown.current = now;
      draw(now);
    });
    return stop;
  }, [belief, onScreen]);

  const levels = stackLevels(marks);
  const answered = marks.length;
  const leading = TIER_BANDS.findIndex(band => band.tier === belief.tier);

  return (
    <figure className="p1-fig" aria-labelledby="p1-fig-caption">
      <div ref={plotRef} className="p1-fig-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {TIER_BANDS.slice(1).map(band => (
            <line key={band.tier} className="p1-fig-edge" x1={along(band.from) * W} x2={along(band.from) * W} y1={0} y2={H} />
          ))}
          <path ref={areaRef} className="p1-fig-area" />
          <path ref={lineRef} className="p1-fig-line" />
          <line ref={stemRef} className="p1-fig-stem" x1={W / 2} x2={W / 2} y1={H} y2={H} />
          <line className="p1-fig-axis" x1={0} x2={W} y1={H} y2={H} />
          <line ref={spanRef} className="p1-fig-span" x1={W / 2} x2={W / 2} y1={H} y2={H} />
        </svg>

        <div ref={youRef} className="p1-fig-at" aria-hidden="true">
          <span className="p1-fig-dot" />
          <span className="p1-fig-you">{answered ? 'you' : 'you?'}</span>
        </div>

        {marks.map((mark, index) => (
          <span
            key={mark.item.id}
            className={mark.correct ? 'p1-fig-mark is-right' : 'p1-fig-mark'}
            style={{ left: `${(along(mark.item.b) * 100).toFixed(2)}%`, ['--stack' as string]: levels[index] }}
            aria-hidden="true"
          >
            {mark.correct ? <PenTick /> : <PenCross />}
          </span>
        ))}
      </div>

      <dl className="p1-fig-bands" style={{ ['--bands' as string]: BAND_SHARES.map(share => `${(share * 100).toFixed(3)}fr`).join(' ') }}>
        {TIER_BANDS.map((band, index) => (
          <div key={band.tier} className={index === leading && answered ? 'p1-fig-band is-leading' : 'p1-fig-band'}>
            <dt><span>{band.tier}</span></dt>
            <dd className="p1-fig-share p1-num" ref={node => { shareRefs.current[index] = node; }}>{Math.round(belief.shares[index] * 100)}%</dd>
            <dd className="p1-fig-starts">{band.starts}{index === TIER_BANDS.length - 1 ? ', IMO' : ''}</dd>
          </div>
        ))}
      </dl>

      <figcaption id="p1-fig-caption" className="p1-caption">
        <b>Fig. 1.</b>{' '}
        {answered === 0
          ? 'What the engine believes about you. No answers yet, so the hill is low and wide: you could be anywhere. The percentages are its odds for each level, named with the contest it would start you on.'
          : `What the engine believes about you after ${answered} ${answered === 1 ? 'answer' : 'answers'}: most likely ${belief.tier}. The heavy bar on the axis is its margin of error, ${belief.sem.toFixed(2)} either way, and each mark is a problem you answered, set at its difficulty.`}
      </figcaption>
    </figure>
  );
}
