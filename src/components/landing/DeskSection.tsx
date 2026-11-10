/**
 * "Your desk": the two things on a contest student's desk that a quiz app
 * leaves out, both of them usable right here.
 *
 * On the left of the stage lies a sheet of squared paper. A triangle draws
 * itself onto it as the section is scrolled to, and then the pen is the
 * visitor's: it is the same scratch paper the workspace has, running on the
 * same drawing code. Beside it is an index card with a contest date on it.
 * Change the date and the weeks rearrange themselves, using the same planner
 * the dashboard uses. Nothing here is a recording of the product.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { m, useInView, useReducedMotion } from 'motion/react';
import { drawPage, extendStroke, type ScratchInk, type ScratchStroke, type ScratchTool } from '../../domain/scratch';
import { PHASE_LABEL, dateKey, daysUntil, trainingPlan } from '../../domain/raceDay';
import { Arrow, Eyebrow, Magnetic, Rise, SplitText, Stagger, StaggerItem, useStageArrival } from './kit';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** The sheet is always paper, whatever the visitor's theme: it is an object on the desk. */
const INK: ScratchInk = { pen: '#22333b', accent: '#c2552d', mark: '#e2a93b' };

/** A line from a to b with a hand's slight wander. The wobble is a fixed function of position, so it is the same every visit. */
function handLine(tool: ScratchTool, ax: number, ay: number, bx: number, by: number, steps = 26): ScratchStroke {
  const points: number[] = [];
  const nx = -(by - ay), ny = bx - ax;
  const length = Math.hypot(nx, ny) || 1;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const wobble = Math.sin(t * 9.4 + ax * 31) * 0.0022 * Math.sin(t * Math.PI);
    points.push(ax + (bx - ax) * t + (nx / length) * wobble, ay + (by - ay) * t + (ny / length) * wobble);
  }
  return { tool, points };
}

/* A 5-12-13 triangle, its altitude to the hypotenuse, the right-angle marks, and one side picked out. */
const BASE = 0.64, RISE = BASE * 5 / 12;
const A = [0.16, 0.56], B = [A[0] + BASE, A[1]], C = [A[0], A[1] - RISE];
/* Where the altitude from the right angle meets the hypotenuse. */
const ALONG = RISE ** 2 / (BASE ** 2 + RISE ** 2);
const FOOT = [C[0] + BASE * ALONG, C[1] + RISE * ALONG];
const DEMO: readonly ScratchStroke[] = [
  handLine('pen', A[0], A[1], B[0], B[1], 34),
  handLine('pen', B[0], B[1], C[0], C[1], 36),
  handLine('pen', C[0], C[1], A[0], A[1], 20),
  handLine('accent', A[0], A[1], FOOT[0], FOOT[1], 18),
  handLine('accent', A[0] + 0.03, A[1], A[0] + 0.03, A[1] - 0.03, 5),
  handLine('accent', A[0] + 0.03, A[1] - 0.03, A[0], A[1] - 0.03, 5),
  handLine('mark', A[0] + 0.01, A[1] + 0.035, B[0] - 0.01, B[1] + 0.035, 22),
];
const DEMO_POINTS = DEMO.reduce((total, stroke) => total + stroke.points.length / 2, 0);

/** The first `count` points of the demo, stroke by stroke. */
function demoUpTo(count: number): ScratchStroke[] {
  const shown: ScratchStroke[] = [];
  let left = Math.floor(count);
  for (const stroke of DEMO) {
    if (left <= 0) break;
    const take = Math.min(left, stroke.points.length / 2);
    shown.push({ tool: stroke.tool, points: stroke.points.slice(0, take * 2) });
    left -= take;
  }
  return shown;
}

const TOOLS: readonly { tool: ScratchTool; label: string }[] = [
  { tool: 'pen', label: 'Pen' },
  { tool: 'accent', label: 'Red pen' },
  { tool: 'mark', label: 'Highlighter' },
  { tool: 'eraser', label: 'Eraser' },
];

function Sheet() {
  const reduce = Boolean(useReducedMotion());
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const inView = useInView(frame, { once: true, amount: 0.5 });
  const [tool, setTool] = useState<ScratchTool>('pen');
  const [mine, setMine] = useState<ScratchStroke[]>([]);
  const [cleared, setCleared] = useState(false);
  const [labelled, setLabelled] = useState(reduce);
  const shown = useRef(reduce ? DEMO_POINTS : 0);
  const live = useRef<ScratchStroke | null>(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;

  // The sheet's size in CSS pixels, measured when it changes rather than on every frame:
  // reading clientWidth inside the drawing loop made the browser lay the page out each time.
  const size = useRef({ width: 0, height: 0 });

  const paint = useCallback(() => {
    const node = canvas.current;
    if (!node) return;
    const { width, height } = size.current;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2.5);
    if (node.width !== Math.round(width * density)) { node.width = Math.round(width * density); node.height = Math.round(height * density); }
    const context = node.getContext('2d');
    if (!context) return;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    const strokes = [...(clearedRef.current ? [] : demoUpTo(shown.current)), ...mineRef.current];
    drawPage(context, live.current ? [...strokes, live.current] : strokes, width, INK);
  }, []);

  // The triangle draws itself once, the first time the sheet is properly on screen.
  useEffect(() => {
    if (!inView || reduce) { paint(); return; }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started - 350) / 2600);
      shown.current = progress <= 0 ? 0 : (1 - (1 - progress) ** 2) * DEMO_POINTS;
      paint();
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setLabelled(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, paint]);

  useEffect(() => { paint(); }, [mine, cleared, paint]);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      paint();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [paint]);

  const at = (event: { clientX: number; clientY: number }, target: HTMLCanvasElement) => {
    const box = target.getBoundingClientRect();
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.width] as const;
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    live.current = { tool, points: [] };
    extendStroke(live.current, ...at(event, event.currentTarget));
    paint();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    let changed = false;
    for (const sample of samples.length ? samples : [event.nativeEvent]) changed = extendStroke(live.current, ...at(sample, event.currentTarget)) || changed;
    if (changed) paint();
  };
  const end = () => {
    const stroke = live.current;
    live.current = null;
    if (stroke && stroke.points.length >= 2) setMine(current => [...current, stroke]);
  };

  const drawn = mine.length > 0;

  return (
    <div className="lx-desk-sheet" ref={frame}>
      <span className="lx-desk-tape" aria-hidden="true" />
      <div className="lx-desk-paper">
        <canvas ref={canvas} className={`lx-desk-canvas is-${tool}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          role="img" aria-label="Scratch paper with a right triangle drawn on it. You can draw on it with a mouse, finger or stylus." />
        {!cleared && (
          <div className={`lx-desk-labels${labelled ? ' is-shown' : ''}`} aria-hidden="true">
            <span style={{ left: '46%', top: '82%' } as Vars}>12</span>
            <span style={{ left: '10%', top: '52%' } as Vars}>5</span>
            <span style={{ left: '51%', top: '40%' } as Vars}>13</span>
            <span className="is-red" style={{ left: '25%', top: '56%' } as Vars}>h = ?</span>
          </div>
        )}
      </div>
      <div className="lx-desk-tools">
        <div role="radiogroup" aria-label="Tool">
          {TOOLS.map(({ tool: value, label }) => (
            <button key={value} type="button" role="radio" aria-checked={tool === value} aria-label={label} title={label} className={`is-${value}`} onClick={() => setTool(value)}><i aria-hidden="true" /></button>
          ))}
        </div>
        <button type="button" className="lx-desk-clear" onClick={() => { setMine([]); setCleared(true); }} disabled={cleared && !drawn}>Fresh sheet</button>
      </div>
      {!drawn && labelled && <p className="lx-desk-nudge" aria-hidden="true">go on, draw on it<svg viewBox="0 0 60 40" fill="none"><path d="M4 6c14 2 30 10 40 26M44 32l-9-3M44 32l2-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></p>}
    </div>
  );
}

const addDays = (days: number) => { const when = new Date(); when.setDate(when.getDate() + days); return dateKey(when); };

function CountdownCard({ onRegister }: { onRegister: () => void }) {
  const today = dateKey(new Date());
  const [date, setDate] = useState(() => addDays(70));
  const left = date ? daysUntil(date, today) : 0;
  const weeks = useMemo(() => (date && left > 0 ? trainingPlan({ date, today, minutesPerDay: 30, skills: {}, contest: 'the contest' }) : []), [date, left, today]);
  const first = weeks[0];

  return (
    <div className="lx-desk-card">
      <span className="lx-desk-pin" aria-hidden="true" />
      <label className="lx-desk-date">
        <span>My contest is on</span>
        <input type="date" value={date} min={addDays(1)} max={addDays(730)} onChange={event => setDate(event.target.value)} />
      </label>
      <p className="lx-desk-count" aria-live="polite">
        <strong className="lx-tabular">{left > 0 ? left : '—'}</strong>
        <span>{left > 0 ? `${left === 1 ? 'day' : 'days'} to go` : 'pick a day ahead of today'}</span>
      </p>
      {first && (
        <>
          <ol className="lx-desk-track" aria-label={`${weeks.length} weeks: build, sharpen, taper`}>
            {weeks.map(week => <li key={week.index} className={`is-${week.phase}`} style={{ '--span': week.days } as Vars} />)}
          </ol>
          <p className="lx-desk-legend" aria-hidden="true"><i className="is-build" />Build<i className="is-sharpen" />Sharpen<i className="is-taper" />Taper</p>
          <p className="lx-desk-week"><b>This week: {PHASE_LABEL[first.phase].toLowerCase()}.</b> {first.problemsPerDay} problems a day, your weakest topic first.</p>
        </>
      )}
      <Magnetic strength={0.12}>
        <button type="button" className="lx-btn lx-btn-ink" onClick={onRegister}>
          <span>Start my countdown</span>
          <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
        </button>
      </Magnetic>
    </div>
  );
}

export default function DeskSection({ onRegister }: { onRegister: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const arrival = useStageArrival(sectionRef);
  return (
    <section ref={sectionRef} className="lx-desk" id="desk" aria-labelledby="lx-desk-title">
      <m.div className="lx-desk-stage" data-tone="ink" style={arrival}>
        <div className="lx-wrap lx-desk-grid">
          <header className="lx-desk-copy">
            <Eyebrow index="07">Your desk</Eyebrow>
            <SplitText as="h2" id="lx-desk-title" className="lx-h2" text={'Pen, paper,\n*and a date.*'} />
            <Rise as="p" className="lx-lead">Contest maths is done by hand, toward a day on the calendar. So every page has scratch paper under it, and your practice counts down to the day that matters.</Rise>
            <Stagger as="ul" className="lx-desk-points" delay={0.1} gap={0.09}>
              <StaggerItem as="li"><b>Scratch paper</b> on every screen. Press S and it slides in beside the problem.</StaggerItem>
              <StaggerItem as="li"><b>A countdown</b> to your contest, with the weeks before it planned: build, sharpen, taper.</StaggerItem>
              <StaggerItem as="li"><b>A card to share</b> when a streak or a rank is worth showing someone.</StaggerItem>
            </Stagger>
          </header>
          <div className="lx-desk-objects">
            <Rise y={50} panel amount={0.2}><Sheet /></Rise>
            <Rise y={50} panel delay={0.12} amount={0.2}><CountdownCard onRegister={onRegister} /></Rise>
          </div>
        </div>
      </m.div>
    </section>
  );
}
