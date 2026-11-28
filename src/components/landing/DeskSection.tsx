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
 *
 * Both lie on a desk seen at a three-quarter angle: one plane of real elements
 * turned in CSS 3D, under a lamp. The WebGL stage, when there is one, draws a
 * pencil whose tip rides the triangle as it draws itself, and the lamplight;
 * it follows the sheet from the same pose (deskStage.ts). When the pen touches
 * the sheet, it turns flat to face the reader, and the pointer is mapped back
 * onto the paper through the corners the browser draws, so a stroke lands where
 * it is drawn at any angle.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, m, useInView, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { drawPage, extendStroke, type ScratchInk, type ScratchStroke, type ScratchTool } from '../../domain/scratch';
import { PHASE_LABEL, dateKey, daysUntil, trainingPlan } from '../../domain/raceDay';
import { useMediaQuery } from '../../hooks/useBreakpoint';
import { Arrow, Magnetic, Rise, SPRING, SplitText, Stagger, StaggerItem, useStageArrival } from './kit';
import {
  DEMO_POINTS, DESK_ARRIVAL_KEY, DESK_DEMO_KEY, DESK_FLAT_KEY, DESK_NARROW, DESK_SETTLE_EDGES,
  demoProgress, demoUpTo, deskPose, planeTransform, quadToSquare, sheetTransform, squareToQuad, type Quad,
} from './deskStage';
import { PRIORITY, onTick, wake } from './pageClock';
import { publishStageValue, useStageScroll, useStageSpring } from './stageLayout';
import { emitThread } from './threadBus';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** The sheet is always paper, whatever the visitor's theme: it is an object on the desk. */
const INK: ScratchInk = { pen: '#22333b', accent: '#c2552d', mark: '#e2a93b' };

const TOOLS: readonly { tool: ScratchTool; label: string }[] = [
  { tool: 'pen', label: 'Pen' },
  { tool: 'accent', label: 'Red pen' },
  { tool: 'mark', label: 'Highlighter' },
  { tool: 'eraser', label: 'Eraser' },
];

/** How long the sheet stays flat after the pen leaves it, before it lies back on the desk (ms). */
const LIE_BACK = { mouse: 700, touch: 2200 } as const;

function Sheet({ settle, narrow }: { settle: MotionValue<number>; narrow: boolean }) {
  const reduce = Boolean(useReducedMotion());
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const corners = useRef<(HTMLElement | null)[]>([]);
  // Once most of the sheet is in view: the thread has come down onto it by then (sceneDesk.ts, deskLeg).
  const inView = useInView(frame, { once: true, amount: 0.85 });
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

  // How far the triangle has drawn itself (0–1), and how flat the sheet is (0 on the desk, 1 facing the reader):
  // the stage reads both by name, so its pencil and the sheet move together.
  const demo = useMotionValue(reduce ? 1 : 0);
  useEffect(() => publishStageValue(DESK_DEMO_KEY, demo), [demo]);
  const flatTarget = useMotionValue(0);
  const flat = useStageSpring(flatTarget, { key: DESK_FLAT_KEY, still: reduce });
  const transform = useMotionValue('none');
  useLayoutEffect(() => {
    const update = () => transform.set(sheetTransform(deskPose(settle.get(), narrow), flat.get()));
    update();
    const stopSettle = settle.on('change', update);
    const stopFlat = flat.on('change', update);
    return () => { stopSettle(); stopFlat(); };
  }, [settle, flat, narrow, transform]);

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

  // The triangle draws itself once, the first time the sheet is properly on screen. It runs on the page
  // clock, so the pencil the stage draws follows the very point the sheet has reached this frame.
  useEffect(() => {
    if (!inView || reduce) { paint(); return; }
    let started = 0;
    const stop = onTick(tick => {
      started ||= tick.now;
      const progress = demoProgress(tick.now - started);
      demo.set(progress);
      shown.current = progress * DEMO_POINTS;
      paint();
      if (progress < 1) return true;
      setLabelled(true);
      stop();
      return false;
    }, PRIORITY.progress);
    wake();
    return stop;
  }, [inView, reduce, paint, demo]);

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

  // The sheet lies on a desk turned in 3D, so the pointer cannot be mapped through the canvas's bounding box.
  // Its four corners, as the browser draws them this moment, give the exact projective map back to the paper,
  // whether it is lying on the desk, turning flat, or flat.
  const map = useRef<number[] | null>(null);
  const measureCorners = () => {
    const points = corners.current.map(corner => {
      const box = corner?.getBoundingClientRect();
      return [box?.left ?? 0, box?.top ?? 0] as const;
    });
    map.current = points.length === 4 ? squareToQuad(points as unknown as Quad) : null;
  };
  const at = (event: { clientX: number; clientY: number }) => {
    const { width, height } = size.current;
    if (!map.current || !width) return [0, 0] as const;
    const [u, v] = quadToSquare(map.current, event.clientX, event.clientY);
    return [u, (v * height) / width] as const;
  };

  // As the pen comes to the sheet it turns flat to face the reader, so ink lands exactly where it is drawn;
  // once the pen has left it, it lies back down. With a mouse that is as the pointer settles on the paper,
  // before the press; a finger or a stylus has no hover, so its first touch lifts the paper, and the stroke
  // starts once the paper faces it rather than sliding about under it.
  const lieBack = useRef(0);
  const arm = useRef(0);
  const waiting = useRef(false);
  const holdFlat = () => {
    window.clearTimeout(lieBack.current);
    window.clearTimeout(arm.current);
    if (flatTarget.get() !== 1) { flatTarget.set(1); wake(); }
  };
  const releaseFlat = (after: number) => {
    window.clearTimeout(lieBack.current);
    window.clearTimeout(arm.current);
    lieBack.current = window.setTimeout(() => { if (!live.current && !waiting.current) { flatTarget.set(0); wake(); } }, after);
  };
  useEffect(() => () => { window.clearTimeout(lieBack.current); window.clearTimeout(arm.current); }, []);
  const facing = () => reduce || flat.get() > 0.97;

  const startStroke = (event: { clientX: number; clientY: number }) => {
    measureCorners();
    live.current = { tool, points: [] };
    extendStroke(live.current, ...at(event));
    paint();
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdFlat();
    emitThread({ type: 'desk-draw', active: true });
    if (facing()) startStroke(event);
    else waiting.current = true;
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (waiting.current) {
      if (facing()) { waiting.current = false; startStroke(event); }
      return;
    }
    if (!live.current) return;
    measureCorners();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    let changed = false;
    for (const sample of samples.length ? samples : [event.nativeEvent]) changed = extendStroke(live.current, ...at(sample)) || changed;
    if (changed) paint();
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = live.current;
    live.current = null;
    waiting.current = false;
    emitThread({ type: 'desk-draw', active: false });
    if (event.pointerType !== 'mouse') releaseFlat(LIE_BACK.touch);
    if (stroke && stroke.points.length >= 2) setMine(current => [...current, stroke]);
  };

  const drawn = mine.length > 0;

  return (
    <m.div
      className="lx-desk-sheet"
      ref={frame}
      style={{ transform }}
      onPointerEnter={event => { if (event.pointerType === 'mouse' && flatTarget.get() === 1) holdFlat(); }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') releaseFlat(LIE_BACK.mouse); }}
    >
      <span className="lx-desk-tape" aria-hidden="true" />
      <div className="lx-desk-paper">
        <canvas ref={canvas} className={`lx-desk-canvas is-${tool}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          onPointerEnter={event => {
            if (event.pointerType !== 'mouse') return;
            window.clearTimeout(arm.current);
            arm.current = window.setTimeout(holdFlat, 140);
          }}
          role="img" aria-label="Scratch paper with a right triangle drawn on it. You can draw on it with a mouse, finger or stylus." />
        {[0, 1, 2, 3].map(corner => <i key={corner} className="lx-desk-corner" data-corner={corner} ref={node => { corners.current[corner] = node; }} aria-hidden="true" />)}
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
    </m.div>
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
          {/* The weeks re-divide when the date changes: each segment slides and stretches to its new place
              (measured once and animated as a transform, so the card is not laid out again every frame). */}
          <ol className="lx-desk-track" aria-label={`${weeks.length} weeks: build, sharpen, taper`}>
            <AnimatePresence initial={false} mode="popLayout">
              {weeks.map(week => (
                <m.li
                  key={week.index}
                  layout="position"
                  className={`is-${week.phase}`}
                  style={{ '--span': week.days } as Vars}
                  initial={{ opacity: 0, scaleX: 0.2 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0.2 }}
                  transition={SPRING.settle}
                />
              ))}
            </AnimatePresence>
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
  const objectsRef = useRef<HTMLDivElement>(null);
  const reduce = Boolean(useReducedMotion());
  const narrow = useMediaQuery(`(max-width: ${DESK_NARROW}px)`);
  const arrival = useStageArrival(sectionRef, DESK_ARRIVAL_KEY);

  // The desk settles from a steeper lean as it arrives: a pure function of the scroll, which the stage
  // works out for itself from the same edges (deskStage.ts), so its pencil lies on this very plane.
  const settleScroll = useStageScroll(objectsRef, DESK_SETTLE_EDGES);
  const settle = useMotionValue(1);
  const plane = useMotionValue('none');
  useLayoutEffect(() => {
    const update = () => {
      settle.set(reduce ? 1 : settleScroll.get());
      plane.set(planeTransform(deskPose(settle.get(), narrow)));
    };
    update();
    return settleScroll.on('change', update);
  }, [settleScroll, reduce, narrow, settle, plane]);
  const perspective = deskPose(1, narrow).perspective;

  return (
    <section ref={sectionRef} className="lx-desk" id="desk" aria-labelledby="lx-desk-title">
      <m.div className="lx-desk-stage" data-tone="ink" style={arrival}>
        <div className="lx-wrap lx-desk-grid">
          <header className="lx-desk-copy">
            <SplitText as="h2" id="lx-desk-title" className="lx-h2" text={'Pen, paper,\nand *a date.*'} />
            <Rise as="p" className="lx-lead">Contest maths is done by hand, toward a day on the calendar. So every page has scratch paper under it, and your practice counts down to the day that matters.</Rise>
            <Stagger as="ul" className="lx-desk-points" delay={0.1} gap={0.09}>
              <StaggerItem as="li"><b>Scratch paper</b> on every screen. Press S and it slides in beside the problem.</StaggerItem>
              <StaggerItem as="li"><b>A countdown</b> to your contest, with the weeks before it planned: build, sharpen, taper.</StaggerItem>
              <StaggerItem as="li"><b>A card to share</b> when a streak or a rank is worth showing someone.</StaggerItem>
            </Stagger>
          </header>
          {/* The desk, seen at a three-quarter angle: a plane of real elements turned in CSS 3D. */}
          <div className="lx-desk-objects" ref={objectsRef} style={{ perspective: `${perspective}px` }}>
            <m.div className="lx-desk-plane" style={{ transform: plane }}>
              <Sheet settle={settle} narrow={narrow} />
              <Rise y={30} panel delay={0.12} amount={0.2}><CountdownCard onRegister={onRegister} /></Rise>
            </m.div>
          </div>
        </div>
      </m.div>
    </section>
  );
}
