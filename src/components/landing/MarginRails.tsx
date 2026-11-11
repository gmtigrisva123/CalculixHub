/**
 * The margins.
 *
 * On a wide screen the landing's column stops at 1320px and leaves a strip of
 * bare paper down each side. These rails fill them the way a mathematician
 * fills the margin of a working sheet:
 *
 *   left   the chapter you are in — a big rolling numeral, its name, and a
 *          spine of all ten chapters that fills as you read, with a comet at
 *          the reading position and a live readout underneath;
 *   right  one small figure that turns in space and re-forms itself, point by
 *          point, each time you cross into a new chapter, with its caption and
 *          a margin note in pencil — and formulas drifting up past it.
 *
 * Under both, ink threads flow through a slow field, stirred by the scroll
 * and swirled by the pointer.
 *
 * The layer is laid over the sheet with `mix-blend-mode: multiply`, so it reads
 * as ink on the paper: on the ink stages (the hero, the topics board, the
 * closing card) it all but disappears, as if the stage had been set down on
 * top of the margin. It only exists where there is a margin to draw in — below
 * that width nothing is mounted and no frame is ever scheduled.
 *
 * Everything that moves every frame is written straight to the DOM or a
 * canvas from one requestAnimationFrame loop; React only re-renders when the
 * chapter changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import katex from 'katex';
import { useMediaQuery } from '../../hooks/useBreakpoint';
import { GLIDE, SPRING, fade } from './kit';
import { scrollToTarget } from './smoothScroll';
import { FIGURE_POINTS, figure, type FigureName } from './marginFigures';
import '../../styles/landing-margins.css';

interface Chapter {
  id: string;
  label: string;
  title: string;
  fig: FigureName;
  figName: string;
  note: string;
}

/** How far each margin pattern travels before it repeats, in px. Must match landing-margins.css. */
const GRID_PERIOD = 110;
const RULER_PERIOD = 50;

const CHAPTERS: Chapter[] = [
  { id: 'top', label: 'Opening', title: 'Stay with the question', fig: 'lorenz', figName: 'Lorenz attractor', note: 'never repeats, never gets lost' },
  { id: 'idea', label: 'The idea', title: 'Just right', fig: 'bell', figName: 'A Gaussian bell', note: 'the sweet spot sits in the middle' },
  { id: 'engine', label: 'How it works', title: 'Finding your level', fig: 'hyperboloid', figName: 'Hyperboloid', note: 'straight lines, curved surface' },
  { id: 'playground', label: 'Try one', title: 'Two chords', fig: 'chords', figName: 'Circle & two chords', note: 'PA · PB = PC · PD' },
  { id: 'topics', label: 'Topics', title: 'Four rooms', fig: 'trefoil', figName: 'Trefoil knot', note: 'the simplest knot that won’t undo' },
  { id: 'archive', label: 'Past papers', title: 'Since 1959', fig: 'helix', figName: 'Double helix', note: 'one more rung every year' },
  { id: 'workspace', label: 'Practise', title: 'Get unstuck', fig: 'mobius', figName: 'Möbius strip', note: 'one side, one edge — keep going' },
  { id: 'plans', label: 'Pricing', title: 'Free to practise', fig: 'tesseract', figName: 'Tesseract', note: 'a cube, one dimension further' },
  { id: 'faq', label: 'Questions', title: 'Answered', fig: 'torus', figName: 'Torus', note: 'every loop comes back around' },
  { id: 'begin', label: 'Begin', title: 'You’re allowed', fig: 'sphere', figName: 'Sphere', note: 'start anywhere, it’s all the same' },
];

const FORMULAS = [
  'e^{i\\pi}+1=0',
  '\\sum_{n\\ge 1}\\frac{1}{n^2}=\\frac{\\pi^2}{6}',
  '\\dot x=\\sigma(y-x)',
  '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx=\\sqrt{\\pi}',
  '\\varphi=\\frac{1+\\sqrt5}{2}',
  'a^2+b^2=c^2',
  'V-E+F=2',
  'PA\\cdot PB=PC\\cdot PD',
  '\\binom{n}{k}=\\binom{n-1}{k-1}+\\binom{n-1}{k}',
  'a^{p}\\equiv a \\pmod{p}',
  '\\frac{a+b}{2}\\ge\\sqrt{ab}',
  'n!\\sim\\sqrt{2\\pi n}\\left(\\frac{n}{e}\\right)^{n}',
  '\\zeta(s)=\\prod_{p}\\frac{1}{1-p^{-s}}',
  '\\left(1+\\tfrac1n\\right)^{n}\\to e',
  'F_{n+1}=F_n+F_{n-1}',
  '\\dot z=xy-\\beta z',
];

/** Rails are only drawn where the column leaves at least this much paper beside it. */
const WIDE = '(min-width: 1480px)';
const SLOTS = 7;
const ANCHOR = 0.45; // the line on screen that decides which chapter you're in

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function MarginRails() {
  const wide = useMediaQuery(WIDE);
  if (!wide) return null;
  return <Rails />;
}

function Rails() {
  const reduce = Boolean(useReducedMotion());
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const flowLeftRef = useRef<HTMLCanvasElement>(null);
  const flowRightRef = useRef<HTMLCanvasElement>(null);
  const figRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const cometRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const velRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(0);

  const rendered = useMemo(
    () => FORMULAS.map(tex => katex.renderToString(tex, { throwOnError: false, displayMode: false, strict: 'ignore' })),
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const flowL = flowLeftRef.current;
    const flowR = flowRightRef.current;
    const figCanvas = figRef.current;
    const stream = streamRef.current;
    if (!root || !left || !right || !flowL || !flowR || !figCanvas || !stream) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sections = CHAPTERS.map(c => document.getElementById(c.id));
    // The drifting patterns, and the last value written to each thing that is only touched on change.
    const grids = Array.from(root.querySelectorAll<HTMLElement>('.mr-grid > i'));
    const rulers = Array.from(root.querySelectorAll<HTMLElement>('.mr-ruler > i'));
    const written = { arrive: '', tail: '', reading: '', heading: '', moving: false };
    // The ink stages, and the archive's full-bleed marquee. Where one reaches into a margin, the margin steps aside for it.
    const stages = Array.from(document.querySelectorAll<HTMLElement>('.lx-hero-stage, .lx-engine-stage, .lx-topics-stage, .lx-desk-stage, .lx-final-stage, .lx-marquee'));
    const hero = document.querySelector<HTMLElement>('.lx-hero-stage');
    const masks = ['', ''];
    type Box = { top: number; bottom: number; left: number; right: number };
    const maskRail = (el: HTMLElement, slot: number, x0: number, x1: number, rects: Box[], vh: number) => {
      const bands: [number, number][] = [];
      for (const r of rects) {
        if (r.right <= x0 + 2 || r.left >= x1 - 2 || r.bottom <= 0 || r.top >= vh || r.bottom <= r.top) continue;
        bands.push([r.top, r.bottom]);
      }
      bands.sort((a, b) => a[0] - b[0]);
      let css = 'none';
      if (bands.length) {
        const F = 18; // feather
        const G = 46; // gap kept clear round a stage
        const stops: string[] = ['#000 0px'];
        for (const [top, bottom] of bands) {
          stops.push(`#000 ${Math.round(top - G - F)}px`, `transparent ${Math.round(top - G)}px`, `transparent ${Math.round(bottom + G)}px`, `#000 ${Math.round(bottom + G + F)}px`);
        }
        css = `linear-gradient(180deg, ${stops.join(', ')})`;
      }
      if (css !== masks[slot]) {
        masks[slot] = css;
        el.style.maskImage = css;
        el.style.setProperty('-webkit-mask-image', css);
      }
    };

    // ---------------------------------------------------------------- sizing
    const size = { lw: 0, lh: 0, rw: 0, rh: 0, fig: 0, rLeft: 0, rTop: 0, lLeft: 0 };
    const measure = () => {
      const lr = left.getBoundingClientRect();
      const rr = right.getBoundingClientRect();
      size.lw = lr.width; size.lh = lr.height; size.lLeft = lr.left;
      size.rw = rr.width; size.rh = rr.height; size.rLeft = rr.left; size.rTop = rr.top;
      for (const [c, w, h] of [[flowL, lr.width, lr.height], [flowR, rr.width, rr.height]] as const) {
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
      }
      const fr = figCanvas.getBoundingClientRect();
      size.fig = fr.width;
      figCanvas.width = Math.max(1, Math.round(fr.width * dpr));
      figCanvas.height = Math.max(1, Math.round(fr.height * dpr));
      seedFlow(flowA, size.lw, size.lh);
      seedFlow(flowB, size.rw, size.rh);
    };

    // ------------------------------------------------------------ flow field
    type Thread = { x: number; y: number; px: number; py: number; life: number; warm: boolean };
    const flowA: Thread[] = [];
    const flowB: Thread[] = [];
    const spawn = (t: Thread, w: number, h: number) => {
      t.x = t.px = Math.random() * w;
      t.y = t.py = Math.random() * h;
      t.life = 220 + Math.random() * 380;
      t.warm = Math.random() < 0.08;
    };
    function seedFlow(list: Thread[], w: number, h: number) {
      const count = Math.min(220, Math.round((w * h) / 2600));
      list.length = 0;
      for (let i = 0; i < count; i += 1) {
        const t = { x: 0, y: 0, px: 0, py: 0, life: 0, warm: false };
        spawn(t, w, h);
        t.life *= Math.random();
        list.push(t);
      }
    }
    const field = (x: number, y: number, time: number, seed: number) =>
      Math.sin(x * 0.0062 + time * 0.11 + seed) * Math.cos(y * 0.0047 - time * 0.07) * 2.6 +
      Math.sin((x + y) * 0.0031 + time * 0.05 + seed * 2) * 1.4 +
      Math.cos(y * 0.011 + time * 0.03) * 0.6;

    const drawFlow = (canvas: HTMLCanvasElement, list: Thread[], w: number, h: number, originX: number, time: number, vel: number, seed: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const px = pointer.x - originX;
      const py = pointer.y - size.rTop;
      const cool = new Path2D();
      const warm = new Path2D();
      for (const t of list) {
        const a = field(t.x, t.y, time, seed);
        let vx = Math.cos(a) * 0.5;
        let vy = Math.sin(a) * 0.5 - clamp(vel, -5, 5) * 0.24;
        const dx = t.x - px;
        const dy = t.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          const f = (1 - Math.sqrt(d2) / 140) * 2.2;
          vx += (-dy / 140) * f + (dx / 140) * f * 0.35;
          vy += (dx / 140) * f + (dy / 140) * f * 0.35;
        }
        t.px = t.x; t.py = t.y;
        t.x += vx; t.y += vy;
        t.life -= 1;
        if (t.life <= 0 || t.x < -4 || t.x > w + 4 || t.y < -40 || t.y > h + 40) {
          spawn(t, w, h);
          continue;
        }
        const path = t.warm ? warm : cool;
        path.moveTo(t.px, t.py);
        path.lineTo(t.x, t.y);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(28, 88, 112, 0.5)';
      ctx.stroke(cool);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(190, 120, 30, 0.55)';
      ctx.stroke(warm);
    };

    // ---------------------------------------------------------------- figure
    const pos = new Float32Array(FIGURE_POINTS * 3);
    pos.set(figure(CHAPTERS[0].fig));
    let from = new Float32Array(pos);
    let to = figure(CHAPTERS[0].fig);
    let morphAt = -1e9;
    const MORPH = 1.7;
    const delay = new Float32Array(FIGURE_POINTS);
    const swirl = new Float32Array(FIGURE_POINTS * 3);
    const tone = new Uint8Array(FIGURE_POINTS);
    for (let i = 0; i < FIGURE_POINTS; i += 1) {
      delay[i] = Math.random() * 0.55;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      swirl[i * 3] = Math.sin(ph) * Math.cos(th);
      swirl[i * 3 + 1] = Math.cos(ph);
      swirl[i * 3 + 2] = Math.sin(ph) * Math.sin(th);
      tone[i] = Math.random() < 0.07 ? 1 : 0;
    }
    const morphTo = (index: number, now: number) => {
      from = new Float32Array(pos);
      to = figure(CHAPTERS[index].fig);
      morphAt = now;
      if (reduce) pos.set(to);
    };

    let yaw = 0.6;
    let tilt = 0.32;
    let spin = 0;
    const drawFigure = (now: number, dt: number, vel: number) => {
      const ctx = figCanvas.getContext('2d');
      if (!ctx || size.fig <= 0) return;
      const S = size.fig;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);

      const p = reduce ? 1 : (now - morphAt) / MORPH;
      const morphing = p < 1.5;
      if (morphing && !reduce) {
        const bulge = Math.sin(clamp(p / 1.3) * Math.PI);
        for (let i = 0; i < FIGURE_POINTS; i += 1) {
          const local = easeInOut(clamp((p * 1.55 - delay[i]) / 1));
          const k = i * 3;
          const lift = bulge * 0.42;
          pos[k] = from[k] + (to[k] - from[k]) * local + swirl[k] * lift;
          pos[k + 1] = from[k + 1] + (to[k + 1] - from[k + 1]) * local + swirl[k + 1] * lift;
          pos[k + 2] = from[k + 2] + (to[k + 2] - from[k + 2]) * local + swirl[k + 2] * lift;
        }
      }

      if (!reduce) {
        spin += dt * (0.32 + Math.min(2.4, Math.abs(vel) * 0.05));
        // Lean toward the pointer, gently.
        const towardX = pointer.x > 0 ? clamp((pointer.x - (size.rLeft + size.rw / 2)) / 900, -1, 1) : 0;
        const towardY = pointer.y > 0 ? clamp((pointer.y - window.innerHeight / 2) / window.innerHeight, -1, 1) : 0;
        yaw += (towardX * 0.6 - yaw + 0.6) * Math.min(1, dt * 1.6);
        tilt += (0.32 + towardY * 0.5 - tilt) * Math.min(1, dt * 1.6);
      }
      const a = spin + yaw;
      const ca = Math.cos(a), sa = Math.sin(a);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const R = S * 0.36;
      const cx = S / 2;
      const cy = S / 2;
      const f = 3.4;

      for (let i = 0; i < FIGURE_POINTS; i += 1) {
        const k = i * 3;
        const x0 = pos[k], y0 = pos[k + 1], z0 = pos[k + 2];
        const x1 = x0 * ca + z0 * sa;
        const z1 = -x0 * sa + z0 * ca;
        const y2 = y0 * ct - z1 * st;
        const z2 = y0 * st + z1 * ct;
        const s = f / (f + z2);
        const depth = clamp((1 - z2) / 2); // 1 near, 0 far
        const sx = cx + x1 * R * s;
        const sy = cy - y2 * R * s;
        const r = (0.55 + depth * 1.25) * (S / 260);
        if (tone[i]) ctx.fillStyle = `rgba(196, 124, 28, ${0.35 + depth * 0.6})`;
        else ctx.fillStyle = `rgba(${18 + depth * 10}, ${70 + depth * 30}, ${96 + depth * 22}, ${0.18 + depth * 0.7})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // ------------------------------------------------------- formula stream
    type Slot = { el: HTMLDivElement; y: number; x: number; z: number; speed: number; phase: number; scale: number; rot: number; h: number };
    const slots: Slot[] = Array.from(stream.children).map(el => ({ el: el as HTMLDivElement, y: 0, x: 0, z: 0, speed: 0, phase: 0, scale: 1, rot: 0, h: 0 }));
    let nextFormula = Math.floor(Math.random() * FORMULAS.length);
    const recycle = (s: Slot, startY: number) => {
      s.el.innerHTML = rendered[nextFormula];
      s.el.dataset.tone = nextFormula % 5 === 2 ? 'warm' : nextFormula % 3 === 0 ? 'pencil' : 'ink';
      nextFormula = (nextFormula + 3) % FORMULAS.length;
      s.z = Math.random();
      s.speed = 10 + s.z * 16;
      s.phase = Math.random() * Math.PI * 2;
      s.rot = (Math.random() - 0.5) * 7;
      const width = s.el.offsetWidth || 120;
      s.h = s.el.offsetHeight || 30;
      const room = Math.max(40, stream.clientWidth);
      const base = 0.72 + s.z * 0.42;
      s.scale = Math.min(base, (room * 0.94) / width);
      s.x = Math.random() * Math.max(0, room - width * s.scale);
      s.y = startY;
      s.el.style.opacity = String(0.38 + s.z * 0.55);
      s.el.style.filter = s.z < 0.28 ? `blur(${(0.28 - s.z) * 5}px)` : '';
      place(s, 0);
    };
    const place = (s: Slot, now: number) => {
      const sway = reduce ? 0 : Math.sin(now * 0.35 + s.phase) * 9;
      const wobble = reduce ? 0 : Math.sin(now * 0.5 + s.phase) * 1.5;
      s.el.style.transform = `translate3d(${(s.x + sway).toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotate(${(s.rot + wobble).toFixed(2)}deg) scale(${s.scale.toFixed(3)})`;
    };

    // ------------------------------------------------------------- pointer
    const pointer = { x: -1, y: -1 };
    const onPointer = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const ro = new ResizeObserver(() => {
      measure();
      slots.forEach((s, i) => recycle(s, (size.rh / SLOTS) * i + Math.random() * 40));
    });
    ro.observe(left);
    ro.observe(right);
    measure();
    slots.forEach((s, i) => recycle(s, (size.rh / SLOTS) * i + Math.random() * 40));

    // ------------------------------------------------------------------ loop
    let raf = 0;
    let last = performance.now();
    let lastY = window.scrollY;
    let vel = 0;
    let shownPct = -1;

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const now = nowMs / 1000;
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;

      const y = window.scrollY;
      const instant = dt > 0 ? (y - lastY) / dt / 60 : 0; // px per 60fps frame
      lastY = y;
      vel += (instant - vel) * 0.18;

      // Where the reader is.
      const vh = window.innerHeight;
      const line = vh * ANCHOR;
      const tops = sections.map(s => (s ? s.getBoundingClientRect().top : Infinity));
      let index = 0;
      for (let i = 0; i < tops.length; i += 1) if (tops[i] <= line) index = i;
      const nextTop = index + 1 < tops.length ? tops[index + 1] : (sections[index]?.getBoundingClientRect().bottom ?? line);
      const frac = clamp((line - tops[index]) / Math.max(1, nextTop - tops[index]));
      const along = clamp((index + frac) / (CHAPTERS.length - 1));

      if (index !== activeRef.current) {
        setDir(index > activeRef.current ? 1 : -1);
        activeRef.current = index;
        setActive(index);
        morphTo(index, now);
      }

      // The rails arrive as the hero is covered.
      const ideaTop = tops[1];
      const arrive = Number.isFinite(ideaTop) ? clamp((vh - ideaTop) / (vh * 0.7)) : 1;
      /*
       * Everything below is written as a transform, or only when its value has
       * actually changed. This loop runs on every frame of a scroll, so a
       * property that needs layout or paint here is paid for sixty or more
       * times a second: the patterns used to drift by `background-position`
       * (a repaint of both rails per frame) and the comet by `top` (a layout).
       */
      const arrived = arrive.toFixed(3);
      if (arrived !== written.arrive) { written.arrive = arrived; root.style.setProperty('--mr-in', arrived); }

      // Graph paper drifts at a third of the scroll, the ruler with it; each wraps at its own period.
      const gridShift = `translate3d(0,${(-((y * 0.3) % GRID_PERIOD)).toFixed(1)}px,0)`;
      const rulerShift = `translate3d(0,${(-(y % RULER_PERIOD)).toFixed(1)}px,0)`;
      for (const node of grids) node.style.transform = gridShift;
      for (const node of rulers) node.style.transform = rulerShift;

      const speed = clamp(Math.abs(vel) / 40);
      const tail = speed.toFixed(2);
      if (tail !== written.tail && cometRef.current) { written.tail = tail; cometRef.current.style.setProperty('--mr-v', tail); }
      // The numeral inks in while the page is moving. A switch with some slack either side, so it does not flicker at the threshold.
      const moving = written.moving ? speed > 0.04 : speed > 0.12;
      if (moving !== written.moving) { written.moving = moving; root.toggleAttribute('data-moving', moving); }

      if (fillRef.current) fillRef.current.style.transform = `scaleY(${along})`;
      if (cometRef.current) cometRef.current.style.transform = `translate3d(0,${(along * 100).toFixed(3)}%,0)`;
      const doc = document.documentElement.scrollHeight - vh;
      const pct = Math.round(clamp(doc > 0 ? y / doc : 0) * 100);
      if (pct !== shownPct && pctRef.current) {
        shownPct = pct;
        pctRef.current.textContent = String(pct).padStart(3, '0');
      }
      const reading = Math.abs(vel).toFixed(1).padStart(4, '0');
      if (reading !== written.reading && velRef.current) { written.reading = reading; velRef.current.textContent = reading; }
      const heading = Math.abs(vel) < 0.3 ? 'still' : vel > 0 ? 'down' : 'up';
      if (heading !== written.heading && arrowRef.current) { written.heading = heading; arrowRef.current.dataset.dir = heading; }

      const rects: Box[] = stages.map(st => {
        const r = st.getBoundingClientRect();
        // The hero stays pinned under the next sheet as it slides over; only its uncovered part counts.
        const bottom = st === hero ? Math.min(r.bottom, tops[1]) : r.bottom;
        return { top: r.top, bottom, left: r.left, right: r.right };
      });
      maskRail(left, 0, size.lLeft, size.lLeft + size.lw, rects, vh);
      maskRail(right, 1, size.rLeft, size.rLeft + size.rw, rects, vh);
      // The spine only takes clicks while it can be seen, and while nothing has masked it away.
      const live = arrive > 0.9 && masks[0] === 'none';
      if ((root.dataset.live === '1') !== live) root.dataset.live = live ? '1' : '';

      if (arrive <= 0.001) return; // nothing to see yet: keep the canvases idle

      if (!reduce) {
        drawFlow(flowL, flowA, size.lw, size.lh, size.lLeft, now, vel, 0);
        drawFlow(flowR, flowB, size.rw, size.rh, size.rLeft, now, vel, 3.7);

        for (const s of slots) {
          s.y -= s.speed * dt + vel * (0.08 + s.z * 0.32);
          if (s.y < -s.h - 30) recycle(s, Math.max(size.rh + 20, ...slots.map(o => o.y + o.h + 48)) + Math.random() * 60);
          else if (s.y > size.rh + 120) recycle(s, -s.h - 20);
          place(s, now);
        }
      }
      drawFigure(now, dt, vel);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
    };
  }, [reduce, rendered]);

  const chapter = CHAPTERS[active];
  const number = String(active + 1).padStart(2, '0');

  return (
    <div className="mr" ref={rootRef} aria-hidden="true">
      {/* ---------------------------------------------------------- left */}
      <div className="mr-rail mr-left" ref={leftRef}>
        <canvas className="mr-flow" ref={flowLeftRef} />
        <div className="mr-grid"><i /></div>
        <div className="mr-ruler"><i /></div>

        <div className="mr-left-inner">
          <div className="mr-chapter">
            <span className="mr-eyebrow"><i className="mr-pulse" /> Chapter</span>
            <div className="mr-numeral">
              {number.split('').map((digit, i) => (
                <span className="mr-digit" key={i}>
                  <AnimatePresence initial={false} custom={dir}>
                    <m.span
                      key={digit}
                      custom={dir}
                      variants={digitRoll}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.9, ease: GLIDE, delay: i * 0.06 }}
                    >
                      {digit}
                    </m.span>
                  </AnimatePresence>
                </span>
              ))}
            </div>
            <div className="mr-stack mr-title">
              <AnimatePresence initial={false}>
                <m.p
                  key={chapter.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ ...SPRING.arrive, opacity: fade() }}
                >
                  {chapter.title}
                </m.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="mr-spine">
            <span className="mr-spine-track" />
            <span className="mr-spine-fill" ref={fillRef} />
            <span className="mr-comet" ref={cometRef}><i /></span>
            {CHAPTERS.map((c, i) => (
              <div
                key={c.id}
                className="mr-node"
                data-state={i === active ? 'active' : i < active ? 'past' : 'ahead'}
                style={{ top: `${(i / (CHAPTERS.length - 1)) * 100}%` }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const target = document.getElementById(c.id);
                    if (target) scrollToTarget(target);
                  }}
                >
                  <i className="mr-dot" />
                  <span className="mr-node-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mr-node-label">{c.label}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="mr-readout">
            <div><span className="mr-read-big" ref={pctRef}>000</span><span className="mr-read-unit">%</span></div>
            <div className="mr-read-row">
              <span className="mr-arrow" ref={arrowRef} data-dir="still">↓</span>
              <span>v</span>
              <span ref={velRef}>00.0</span>
              <span className="mr-read-dim">px/f</span>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- right */}
      <div className="mr-rail mr-right" ref={rightRef}>
        <canvas className="mr-flow" ref={flowRightRef} />
        <div className="mr-grid"><i /></div>
        <div className="mr-ruler"><i /></div>

        <div className="mr-stream" ref={streamRef}>
          {Array.from({ length: SLOTS }, (_, i) => <div className="mr-formula" key={i} />)}
        </div>

        <div className="mr-right-inner">
          <figure className="mr-figure">
            <div className="mr-halo" />
            <div className="mr-shadow" />
            <div className="mr-orbit"><div className="mr-orbit-ring"><i /></div></div>
            <div className="mr-orbit mr-orbit-b"><div className="mr-orbit-ring"><i /></div></div>
            <canvas className="mr-fig-canvas" ref={figRef} />
            <AnimatePresence initial={false}>
              <m.span
                key={chapter.id}
                className="mr-flash"
                initial={{ opacity: 0.9, scale: 0.4 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 1.4, ease: GLIDE }}
              />
            </AnimatePresence>
          </figure>

          <figcaption className="mr-caption">
            <div className="mr-stack">
              <AnimatePresence initial={false}>
                <m.div
                  key={chapter.id}
                  className="mr-caption-head"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.7, ease: GLIDE }}
                >
                  <span className="mr-fig-tag">Fig. {number}</span>
                  <span className="mr-fig-name">
                    {chapter.figName.split('').map((ch, i) => (
                      <m.span
                        key={i}
                        initial={{ opacity: 0, y: '0.5em' }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: GLIDE, delay: 0.15 + i * 0.022 }}
                      >
                        {ch === ' ' ? ' ' : ch}
                      </m.span>
                    ))}
                  </span>
                </m.div>
              </AnimatePresence>
            </div>
            <div className="mr-stack">
              <AnimatePresence initial={false}>
                <m.p
                  key={chapter.id}
                  className="mr-note"
                  initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }}
                  animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 1.3, ease: [0.45, 0, 0.2, 1], delay: 0.35 }}
                >
                  {chapter.note}
                </m.p>
              </AnimatePresence>
            </div>
          </figcaption>
        </div>
      </div>
    </div>
  );
}

const digitRoll = {
  enter: (d: number) => ({ y: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: '0%', opacity: 1 },
  exit: (d: number) => ({ y: d > 0 ? '-100%' : '100%', opacity: 0 }),
};
