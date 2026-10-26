/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The dashboard's centrepiece: a drawing machine on a polar dial.
 *
 * Sixty-four circles, each turning at a whole-number speed and each hung from
 * the rim of the one before, add up to a classical curve -- one for each
 * domain. The pen leaves a trail like a long exposure; when the figure closes
 * it holds, fades, and the next one unfolds. Hovering slows time so the chain
 * can be read; a click moves on to the next figure.
 *
 * It is an illustration of a mathematical idea, not a report on the learner:
 * no part of it stands for a score. The instruments below carry the numbers.
 */

import { memo, useCallback, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { ease } from '../../lib/motion';
import { FIGURES, machineFor, type Machine } from './fourier';
import { TOPIC_KEY } from './dashboardModel';
import { clamp01, easeInOut, easeOut, useCanvasScene, withAlpha, type Scene, type SceneSize } from './useCanvasScene';

interface EpicycleStageProps {
  /** prefers-reduced-motion: one finished figure, no loop. */
  still: boolean;
  paused: boolean;
  onTogglePause: () => void;
}

type Phase = 'grow' | 'draw' | 'hold' | 'fade';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

interface StageScene extends Scene {
  select(index: number): void;
  next(): void;
}

const GROW = 1.1;
const DRAW = 11;
const HOLD = 2.4;
const FADE = 0.9;
const MAX_SPARKS = 90;
const TICKS = 120;

const FIGURE_KEYS = FIGURES.map((figure) => TOPIC_KEY[figure.topic]);

function makeGlow(color: string): HTMLCanvasElement {
  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const g = sprite.getContext('2d');
  if (!g) return sprite;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, withAlpha(color, 0.95));
  gradient.addColorStop(0.18, withAlpha(color, 0.55));
  gradient.addColorStop(0.5, withAlpha(color, 0.12));
  gradient.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return sprite;
}

interface StageHooks {
  onFigure: (index: number) => void;
  /** One progress fill per figure, so the right one updates before React re-renders. */
  progress: { current: (HTMLElement | null)[] };
  paused: { current: boolean };
  redraw: { current: () => void };
}

function createStage(canvas: HTMLCanvasElement, still: boolean, hooks: StageHooks): StageScene {
  const colors = { ink: '#f4f1e8', muted: '#9fb3b9', hues: ['#e1ad66', '#4fb8a8', '#a98cf8', '#4dbdf0'] };
  let glows: HTMLCanvasElement[] = [];
  let dial: HTMLCanvasElement | null = null;
  let size: SceneSize = { width: 0, height: 0, dpr: 1 };
  let layout = { cx: 0, cy: 0, r: 0 };

  const state = {
    figure: 0,
    machine: machineFor(FIGURES[0]) as Machine,
    phase: (still ? 'hold' : 'grow') as Phase,
    clock: 0,
    tau: 0,
    slow: 0,
    hover: false,
    /** Parallax: the figure drifts a few pixels with the pointer while the dial holds still. */
    shift: { x: 0, y: 0, tx: 0, ty: 0 },
    time: 0,
    sparkDebt: 0,
    sparks: [] as Spark[],
  };

  const setProgress = (value: number) => {
    const bar = hooks.progress.current[state.figure];
    if (bar) bar.style.transform = `scaleX(${value.toFixed(4)})`;
  };

  const show = (index: number) => {
    // Still or paused, a newly chosen figure appears finished rather than as an empty dial.
    const resting = still || hooks.paused.current;
    setProgress(0);
    state.figure = ((index % FIGURES.length) + FIGURES.length) % FIGURES.length;
    state.machine = machineFor(FIGURES[state.figure]);
    state.phase = resting ? 'hold' : 'grow';
    state.clock = 0;
    state.tau = 0;
    state.sparks.length = 0;
    setProgress(resting ? 1 : 0);
    hooks.onFigure(state.figure);
    if (resting) hooks.redraw.current();
  };

  const place = () => {
    const { width: w, height: h } = size;
    // Room kept clear above the dial for the hint and pause control, and below
    // it for the caption and the figure picker.
    const top = w >= 380 ? 52 : 24;
    const reserve = w >= 520 ? 96 : 150;
    const room = Math.max(120, h - reserve - top);
    const r = Math.max(40, Math.min(w / 2 - 28, room / 2 - 18) / 1.24);
    layout = { cx: w / 2, cy: top + room / 2, r };
  };

  /** The static dial: bezel, ticks, polar grid and radian marks, drawn once per size and theme. */
  const paintDial = () => {
    const { cx, cy, r } = layout;
    dial = document.createElement('canvas');
    dial.width = Math.round(size.width * size.dpr);
    dial.height = Math.round(size.height * size.dpr);
    const g = dial.getContext('2d');
    if (!g) return;
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const bezel = r * 1.16;
    g.lineWidth = 1;
    g.strokeStyle = withAlpha(colors.ink, 0.12);
    g.beginPath();
    g.arc(cx, cy, bezel, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < TICKS; i++) {
      const angle = (i / TICKS) * Math.PI * 2;
      const major = i % 10 === 0;
      const inner = bezel - (major ? 9 : 4);
      g.strokeStyle = withAlpha(colors.ink, major ? 0.3 : 0.11);
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      g.lineTo(cx + Math.cos(angle) * bezel, cy + Math.sin(angle) * bezel);
      g.stroke();
    }
    g.strokeStyle = withAlpha(colors.ink, 0.05);
    for (const ring of [0.5, 1]) {
      g.beginPath();
      g.arc(cx, cy, r * ring, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = withAlpha(colors.ink, 0.035);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * r * 0.14, cy + Math.sin(angle) * r * 0.14);
      g.lineTo(cx + Math.cos(angle) * r * 1.06, cy + Math.sin(angle) * r * 1.06);
      g.stroke();
    }
    g.fillStyle = withAlpha(colors.muted, 0.75);
    g.font = `italic 400 ${Math.round(Math.max(11, Math.min(14, r * 0.075)))}px Newsreader, Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const labels: [string, number][] = [['0', 0], ['π/2', -Math.PI / 2], ['π', Math.PI], ['3π/2', Math.PI / 2]];
    for (const [text, angle] of labels) {
      const at = bezel + 16;
      g.fillText(text, cx + Math.cos(angle) * at, cy + Math.sin(angle) * at);
    }
  };

  const toScreen = (x: number, y: number, scale: number): [number, number] => [
    layout.cx + state.shift.x + x * layout.r * scale,
    // Mathematics draws y upwards; the canvas counts it downwards.
    layout.cy + state.shift.y - y * layout.r * scale,
  ];

  const advance = (dt: number) => {
    state.time += dt;
    state.slow += ((state.hover ? 1 : 0) - state.slow) * (1 - Math.exp(-dt * 4));
    const follow = 1 - Math.exp(-dt * 3);
    state.shift.x += (state.shift.tx - state.shift.x) * follow;
    state.shift.y += (state.shift.ty - state.shift.y) * follow;
    const speed = 1 - 0.68 * state.slow;
    const step = dt * speed;
    state.clock += step;
    if (state.phase !== 'grow') state.tau += step / DRAW;

    if (state.phase === 'grow' && state.clock >= GROW) {
      state.phase = 'draw';
      state.clock = 0;
    } else if (state.phase === 'draw' && state.tau >= 1) {
      state.phase = 'hold';
      state.clock = 0;
    } else if (state.phase === 'hold' && state.clock >= HOLD) {
      state.phase = 'fade';
      state.clock = 0;
    } else if (state.phase === 'fade' && state.clock >= FADE) {
      show(state.figure + 1);
      return;
    }
    setProgress(state.phase === 'grow' ? 0 : Math.min(1, state.tau));
  };

  const drawTrail = (ctx: CanvasRenderingContext2D, hue: string, fade: number) => {
    const { path } = state.machine;
    const full = state.phase === 'hold' || state.phase === 'fade';
    const count = full ? path.length : Math.floor(Math.min(1, state.tau) * path.length);
    if (count < 2 || fade <= 0) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const trace = (from: number, to: number) => {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const [sx, sy] = toScreen(path[i][0], path[i][1], 1);
        if (i === from) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      if (full) ctx.closePath();
    };

    // A wide, faint pass first: the bloom around the line.
    const breath = full ? 0.5 + 0.5 * Math.sin(state.time * 2.2) : 0;
    ctx.strokeStyle = withAlpha(hue, (0.1 + 0.06 * breath) * fade);
    ctx.lineWidth = 7;
    trace(0, count - 1);
    ctx.stroke();

    if (full) {
      ctx.strokeStyle = withAlpha(hue, 0.92 * fade);
      ctx.lineWidth = 1.9;
      trace(0, count - 1);
      ctx.stroke();
      return;
    }
    // The trail brightens towards the pen, like a long exposure.
    const chunks = 14;
    for (let c = 0; c < chunks; c++) {
      const from = Math.floor((c / chunks) * (count - 1));
      const to = Math.floor(((c + 1) / chunks) * (count - 1));
      if (to <= from) continue;
      ctx.strokeStyle = withAlpha(hue, (0.32 + 0.68 * ((c + 1) / chunks) ** 1.4) * fade);
      ctx.lineWidth = 1.9;
      trace(from, to);
      ctx.stroke();
    }
  };

  const drawChain = (ctx: CanvasRenderingContext2D, scale: number, alpha: number): [number, number] => {
    const { terms } = state.machine;
    const unfold = 1 - scale;
    let x = 0;
    let y = 0;
    const angleBase = Math.PI * 2 * state.tau;
    ctx.lineWidth = 1;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const radius = term.radius * scale;
      const depth = 1 - i / terms.length;
      const angle = angleBase * term.k + unfold * (i + 1) * 0.55;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const nx = x + (term.re * c - term.im * s) * scale;
      const ny = y + (term.re * s + term.im * c) * scale;
      const [sx, sy] = toScreen(x, y, 1);
      const [ex, ey] = toScreen(nx, ny, 1);
      const pixels = radius * layout.r;
      if (pixels > 0.7) {
        ctx.strokeStyle = withAlpha(colors.ink, (0.05 + 0.2 * depth * depth) * alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, pixels, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (pixels > 0.35) {
        ctx.strokeStyle = withAlpha(colors.ink, (0.16 + 0.46 * depth) * alpha);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      if (i < 6 && pixels > 3) {
        ctx.fillStyle = withAlpha(colors.ink, 0.55 * alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      x = nx;
      y = ny;
    }
    return toScreen(x, y, 1);
  };

  const updateSparks = (dt: number, tip: [number, number], emitting: boolean) => {
    if (emitting && dt > 0) {
      state.sparkDebt += dt * 24;
      while (state.sparkDebt >= 1) {
        state.sparkDebt -= 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * 34;
        state.sparks.push({
          x: tip[0],
          y: tip[1],
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: 0.6 + Math.random() * 0.8,
          size: 0.7 + Math.random() * 1.5,
        });
      }
      if (state.sparks.length > MAX_SPARKS) state.sparks.splice(0, state.sparks.length - MAX_SPARKS);
    }
    let kept = 0;
    for (const spark of state.sparks) {
      spark.age += dt;
      spark.vx *= 1 - dt * 1.6;
      spark.vy *= 1 - dt * 1.6;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      if (spark.age < spark.life) state.sparks[kept++] = spark;
    }
    state.sparks.length = kept;
  };

  const onMove = (event: PointerEvent) => {
    // Slowing time is a pointer-only nicety; a finger arrives already pressing.
    if (event.pointerType === 'touch') return;
    state.hover = true;
    const box = canvas.getBoundingClientRect();
    state.shift.tx = ((event.clientX - box.left) / box.width - 0.5) * 16;
    state.shift.ty = ((event.clientY - box.top) / box.height - 0.5) * 12;
  };
  const onLeave = () => {
    state.hover = false;
    state.shift.tx = 0;
    state.shift.ty = 0;
  };
  const onClick = () => scene.next();
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
  canvas.addEventListener('click', onClick);

  // The first figure is built now; the rest wait for an idle moment, so moving
  // on to the next one never costs a frame mid-animation.
  const hasIdle = typeof window.requestIdleCallback === 'function';
  const warmUp = () => FIGURES.forEach(machineFor);
  const warm = hasIdle ? window.requestIdleCallback(warmUp) : window.setTimeout(warmUp, 400);
  const cancelIdle = () => (hasIdle ? window.cancelIdleCallback(warm) : window.clearTimeout(warm));

  const scene: StageScene = {
    palette(read) {
      colors.ink = read('--dh-stage-ink', colors.ink);
      colors.muted = read('--dh-stage-muted', colors.muted);
      colors.hues = FIGURE_KEYS.map((key, i) => read(`--dh-${key}-glow`, colors.hues[i]));
      glows = colors.hues.map(makeGlow);
      if (size.width) paintDial();
    },
    resize(next) {
      size = next;
      place();
      paintDial();
    },
    rest() {
      state.phase = 'hold';
      state.clock = 0;
      state.tau = 0;
      state.sparks.length = 0;
      setProgress(1);
    },
    frame(ctx, frameSize, dt) {
      if (dt > 0) advance(dt);
      ctx.clearRect(0, 0, frameSize.width, frameSize.height);
      if (dial) ctx.drawImage(dial, 0, 0, frameSize.width, frameSize.height);

      const hue = colors.hues[state.figure];
      const fade = state.phase === 'fade' ? 1 - easeInOut(state.clock / FADE) : 1;
      const scale =
        state.phase === 'grow' ? easeOut(state.clock / GROW) : state.phase === 'fade' ? 0.15 + 0.85 * fade : 1;

      // A slow sweep around the bezel: the dial is alive even while the pen rests.
      if (!still) {
        const sweep = state.time * 0.35;
        const bezel = layout.r * 1.16;
        for (let i = 0; i < 10; i++) {
          ctx.strokeStyle = withAlpha(hue, 0.045 * (i + 1));
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(layout.cx, layout.cy, bezel, sweep + i * 0.035, sweep + (i + 1) * 0.035);
          ctx.stroke();
        }
      }

      // A faint guide of the whole figure, so the eye knows where the pen is headed.
      if (state.phase === 'grow' || state.phase === 'draw') {
        const { path } = state.machine;
        ctx.setLineDash([2, 6]);
        ctx.lineCap = 'round';
        ctx.strokeStyle = withAlpha(hue, 0.16 * (state.phase === 'grow' ? easeOut(state.clock / GROW) : 1));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        path.forEach(([x, y], i) => {
          const [sx, sy] = toScreen(x, y, 1);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawTrail(ctx, hue, fade);
      const tip = drawChain(ctx, scale, clamp01(scale * 1.2) * (0.55 + 0.45 * fade));

      updateSparks(dt, tip, !still && state.phase === 'draw');
      for (const spark of state.sparks) {
        const life = 1 - spark.age / spark.life;
        ctx.fillStyle = withAlpha(hue, life * life * 0.9);
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const glow = glows[state.figure];
      const penAlpha = state.phase === 'grow' ? easeOut(state.clock / GROW) : fade;
      if (glow && penAlpha > 0) {
        const radius = 22 + (state.phase === 'draw' ? 4 * Math.sin(state.time * 6) : 0);
        ctx.globalAlpha = penAlpha;
        ctx.drawImage(glow, tip[0] - radius, tip[1] - radius, radius * 2, radius * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = withAlpha(colors.ink, penAlpha);
        ctx.beginPath();
        ctx.arc(tip[0], tip[1], 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    select(index) {
      show(index);
    },
    next() {
      show(state.figure + 1);
    },
    dispose() {
      cancelIdle();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('click', onClick);
    },
  };
  return scene;
}

function EpicycleStage({ still, paused, onTogglePause }: EpicycleStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<(HTMLSpanElement | null)[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const redrawRef = useRef<() => void>(() => {});
  const [figure, setFigure] = useState(0);

  const create = useCallback(
    (canvas: HTMLCanvasElement) =>
      createStage(canvas, still, { onFigure: setFigure, progress: progressRef, paused: pausedRef, redraw: redrawRef }),
    [still],
  );
  const { controls, sceneRef } = useCanvasScene(canvasRef, create, { still, paused });
  redrawRef.current = () => controls.current.redraw();

  const current = FIGURES[figure];

  return (
    <div className="dh-stage" data-still={still || undefined}>
      <canvas
        ref={canvasRef}
        className="dh-stage-canvas"
        role="img"
        aria-label={`An animated drawing machine: sixty-four turning circles, added tip to tip, draw ${current.name.toLowerCase()}. Click it for the next figure.`}
      />
      {!still && (
        <div className="dh-stage-top">
          <p className="dh-stage-hint" aria-hidden="true">Hover to slow it down · click for the next figure</p>
          <button
            type="button"
            className="dh-stage-pause"
            onClick={onTogglePause}
            aria-pressed={paused}
            aria-label={paused ? 'Play the dashboard animations' : 'Pause the dashboard animations'}
          >
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        </div>
      )}
      <div className="dh-stage-foot">
        <p className="dh-stage-caption">
          <span className="dh-stage-kicker">Now drawing</span>
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={current.key}
              className="dh-stage-name"
              initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
              transition={{ duration: 0.3, ease: ease.standard }}
            >
              <strong>{current.name}</strong>
              <span className="dh-stage-formula">{current.formula}</span>
            </m.span>
          </AnimatePresence>
          <span className="dh-stage-count">64 turning circles · {current.topic}</span>
        </p>
        <div className="dh-picker" role="group" aria-label="Choose a figure">
          {FIGURES.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className="dh-pick"
              data-topic={TOPIC_KEY[item.topic]}
              aria-pressed={index === figure}
              aria-label={`Draw ${item.name.toLowerCase()} (${item.topic})`}
              onClick={() => sceneRef.current?.select(index)}
            >
              <span className="dh-pick-pill">
                <span
                  className="dh-pick-fill"
                  ref={(node) => {
                    progressRef.current[index] = node;
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(EpicycleStage);
