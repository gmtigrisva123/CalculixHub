/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Arena lobby's centrepiece: a floodlit stadium, drawn on a canvas.
 *
 * Four stands -- Algebra, Geometry, Combinatorics, Number Theory -- carry a
 * travelling wave of light, while the field, a coordinate plane, hosts one
 * compass-and-straightedge construction after another. When a construction
 * closes, two stands cheer. Tap a stand and it starts a wave of its own; tap
 * the field and an idea ripples out of it.
 *
 * It is a picture of the arena, not a report on it: no figure here stands for
 * a person, a score or a count. The match board below is where real data
 * lives.
 *
 * ---------------------------------------------------------------------------
 * On cost.
 *
 * One 2D canvas, a device pixel ratio capped at 2, seats painted from
 * pre-rendered sprites, and a frame loop that runs only while the stage is on
 * screen, the tab is visible and the viewer has not paused it. Under
 * prefers-reduced-motion it draws one still frame and never loops.
 *
 * Colours are read from custom properties on the stage (arena-lobby.css) and
 * re-read whenever the theme flips, so no palette is hard-coded here.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Hand, Pause, Play } from 'lucide-react';
import {
  FIGURES,
  PITCH,
  RAKE,
  RIM,
  TEAM_GLYPHS,
  TEAM_NAMES,
  figureLength,
  fitView,
  layoutSeats,
  project,
  teamAt,
  unproject,
  wrapAngle,
  type Pen,
  type Projected,
  type Seat,
  type Team,
  type Vec,
  type View,
} from './stadium';

interface ArenaStageProps {
  /** Honour prefers-reduced-motion: one still frame, no loop, no taps. */
  still: boolean;
  /** The viewer's own pause. Freezes the scene where it is. */
  paused: boolean;
  onTogglePause: () => void;
}

interface Palette {
  ink: string;
  muted: string;
  glow: string;
  pencil: string;
  flood: string;
  sign: string;
  spark: string;
  teams: string[];
}

interface Wave { origin: number; direction: number; age: number }
interface Cheer { team: Team; age: number }
interface Ripple { x: number; y: number; age: number }
interface Glyph { x: number; y: number; vx: number; vy: number; age: number; life: number; text: string; team: Team; size: number; spin: number }

/** Seconds a finished construction stays on the field, then takes to fade. */
const HOLD = 2;
const FADE = 0.7;
const ELEVATION = 0.66;
const WAVE_SPEED = 0.9;
const WAVE_WIDTH = 0.34;
const WAVE_LIFE = 3.4;
const CHEER_LIFE = 1.8;
const RIPPLE_LIFE = 1.4;
const MAX_GLYPHS = 150;
/** Room kept clear at the bottom of the stage for the caption and controls. */
const RESERVE = 46;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: read('--al-stage-ink', '#f4f1e8'),
    muted: read('--al-stage-muted', '#a9bcc1'),
    glow: read('--al-stage-glow', '#afcbd3'),
    pencil: read('--al-stage-pencil', '#f0a283'),
    flood: read('--al-stage-flood', '#fff3d6'),
    sign: read('--al-stage-sign', '#0c171c'),
    spark: read('--al-stage-spark', '#fffaf0'),
    teams: [
      read('--al-stage-alg', '#e1ad66'),
      read('--al-stage-geo', '#4fb8a8'),
      read('--al-stage-com', '#a98cf8'),
      read('--al-stage-num', '#4dbdf0'),
    ],
  };
}

/** `#rgb` or `#rrggbb` at an alpha. Any other colour string passes through as is. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : '';
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  const n = parseInt(full, 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** A soft round light: a solid core that falls off into a glow. */
function makeSprite(color: string, core: number): HTMLCanvasElement {
  const size = 48;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const context = sprite.getContext('2d');
  if (!context) return sprite;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, withAlpha(color, 1));
  gradient.addColorStop(core, withAlpha(color, 1));
  gradient.addColorStop(Math.min(1, core + 0.14), withAlpha(color, 0.4));
  gradient.addColorStop(1, withAlpha(color, 0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return sprite;
}

function ArenaStage({ still, paused, onTogglePause }: ArenaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const wakeRef = useRef<() => void>(() => {});
  const [figure, setFigure] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frameId = 0;
    let last = 0;
    let visible = true;
    let lastView: View | null = null;
    let layoutKey = '';
    let quality = 0;
    let frameCost = 0;
    let framesSinceCheck = 0;
    let seats: Seat[] = [];
    let teamSeats: number[][] = [[], [], [], []];
    let palette = readPalette(canvas);
    let sprites: HTMLCanvasElement[] = [];
    let white: HTMLCanvasElement | null = null;
    let lamp: HTMLCanvasElement | null = null;
    const A: Projected = { x: 0, y: 0, k: 1 };
    const B: Projected = { x: 0, y: 0, k: 1 };
    const C: Projected = { x: 0, y: 0, k: 1 };

    const scene = {
      time: 0,
      intro: still ? 1 : 0,
      spin: -0.35,
      yaw: 0,
      tilt: 0,
      pointer: { x: 0, y: 0, inside: false },
      hover: -1,
      wave: 0.6,
      figure: 0,
      figureTime: still ? figureLength(FIGURES[0]) + 0.2 : -0.9,
      qed: -1,
      waves: [] as Wave[],
      cheers: [] as Cheer[],
      ripples: [] as Ripple[],
      glyphs: [] as Glyph[],
    };

    const paint = () => {
      palette = readPalette(canvas);
      sprites = palette.teams.map((color) => makeSprite(color, 0.4));
      white = makeSprite(palette.spark, 0.34);
      lamp = makeSprite(palette.flood, 0.12);
    };
    paint();

    const glyphScale = () => (lastView ? Math.min(1.25, Math.max(0.7, lastView.s / 260)) : 1);

    const spawnGlyph = (x: number, y: number, team: Team) => {
      const scale = glyphScale();
      scene.glyphs.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 36 * scale,
        vy: -(55 + Math.random() * 75) * scale,
        age: 0,
        life: 1.2 + Math.random() * 0.9,
        text: pick(TEAM_GLYPHS[team]),
        team,
        size: Math.round((12 + Math.random() * 8) * scale),
        spin: (Math.random() - 0.5) * 1.6,
      });
      if (scene.glyphs.length > MAX_GLYPHS) scene.glyphs.shift();
    };

    const burst = (team: Team, count: number) => {
      const pool = teamSeats[team];
      if (!lastView || !pool.length) return;
      for (let i = 0; i < count; i++) {
        const seat = seats[pick(pool)];
        project(lastView, seat.x, seat.y, seat.h, A);
        spawnGlyph(A.x, A.y - 4, team);
      }
    };

    const cheer = (team: Team, theta: number) => {
      scene.cheers.push({ team, age: 0 });
      scene.waves.push({ origin: theta, direction: 1, age: 0 }, { origin: theta, direction: -1, age: 0 });
      if (scene.cheers.length > 4) scene.cheers.shift();
      if (scene.waves.length > 6) scene.waves.splice(0, scene.waves.length - 6);
      burst(team, 16);
    };

    const celebrate = () => {
      scene.qed = 0;
      const first = Math.floor(Math.random() * 4) as Team;
      const second = ((first + 1 + Math.floor(Math.random() * 3)) % 4) as Team;
      cheer(first, (first * Math.PI) / 2);
      cheer(second, (second * Math.PI) / 2);
    };

    // -------------------------------------------------------------------
    // Simulation
    // -------------------------------------------------------------------

    const prune = <T extends { age: number }>(items: T[], life: (item: T) => number) => {
      let kept = 0;
      for (const item of items) if (item.age < life(item)) items[kept++] = item;
      items.length = kept;
    };

    const update = (dt: number) => {
      scene.time += dt;
      scene.intro = Math.min(1, scene.intro + dt / 1.8);
      scene.spin += dt * 0.035;
      const follow = 1 - Math.exp(-dt * 3);
      scene.yaw += ((scene.pointer.inside ? scene.pointer.x * 0.22 : 0) - scene.yaw) * follow;
      scene.tilt += ((scene.pointer.inside ? scene.pointer.y * 0.07 : 0) - scene.tilt) * follow;
      scene.wave += dt * WAVE_SPEED;

      const length = figureLength(FIGURES[scene.figure]);
      const before = scene.figureTime;
      scene.figureTime += dt;
      if (before < length && scene.figureTime >= length) celebrate();
      if (scene.figureTime >= length + HOLD + FADE) {
        scene.figure = (scene.figure + 1) % FIGURES.length;
        scene.figureTime = -0.35;
        setFigure(scene.figure);
      }

      for (const wave of scene.waves) wave.age += dt;
      for (const ripple of scene.ripples) ripple.age += dt;
      for (const glyph of scene.glyphs) {
        glyph.age += dt;
        glyph.vy += 64 * dt;
        glyph.x += glyph.vx * dt;
        glyph.y += glyph.vy * dt;
      }
      for (const item of scene.cheers) {
        item.age += dt;
        const due = item.age < 0.55 ? dt * 30 : 0;
        const whole = Math.floor(due);
        burst(item.team, whole + (Math.random() < due - whole ? 1 : 0));
      }
      prune(scene.waves, () => WAVE_LIFE);
      prune(scene.cheers, () => CHEER_LIFE);
      prune(scene.ripples, () => RIPPLE_LIFE);
      prune(scene.glyphs, (glyph) => glyph.life);
      if (scene.qed >= 0) scene.qed = scene.qed + dt > 2.2 ? -1 : scene.qed + dt;
    };

    // -------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------

    const makePen = (view: View, alpha: number): Pen => {
      const style = (guide?: boolean) => {
        ctx.setLineDash(guide ? [3, 4] : []);
        ctx.strokeStyle = guide ? palette.pencil : palette.glow;
        ctx.lineWidth = guide ? 1.1 : 1.9;
        ctx.globalAlpha = alpha * (guide ? 0.7 : 0.95);
      };
      const polyline = (count: number, at: (i: number) => Vec) => {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const [x, y] = at(i);
          project(view, x, y, 0, A);
          if (i) ctx.lineTo(A.x, A.y);
          else ctx.moveTo(A.x, A.y);
        }
      };
      return {
        segment(a, b, p, guide) {
          if (p <= 0) return;
          polyline(7, (i) => [a[0] + (b[0] - a[0]) * (i / 6) * p, a[1] + (b[1] - a[1]) * (i / 6) * p]);
          style(guide);
          ctx.stroke();
        },
        arc(centre, radius, from, to, p, guide) {
          if (p <= 0) return;
          const sweep = (to - from) * p;
          const steps = Math.max(6, Math.ceil(Math.abs(sweep) * 22));
          polyline(steps + 1, (i) => {
            const angle = from + (sweep * i) / steps;
            return [centre[0] + Math.cos(angle) * radius, centre[1] + Math.sin(angle) * radius];
          });
          style(guide);
          ctx.stroke();
        },
        point(at, p, label) {
          if (p <= 0) return;
          project(view, at[0], at[1], 0, A);
          const pop = Math.max(0, backOut(p));
          ctx.setLineDash([]);
          ctx.fillStyle = palette.glow;
          ctx.globalAlpha = alpha * 0.28 * p;
          ctx.beginPath();
          ctx.arc(A.x, A.y, 6.5 * pop * A.k, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = palette.ink;
          ctx.globalAlpha = alpha * p;
          ctx.beginPath();
          ctx.arc(A.x, A.y, 2.6 * pop * A.k, 0, Math.PI * 2);
          ctx.fill();
          if (!label) return;
          ctx.font = `italic 500 ${Math.round(15 * A.k)}px Newsreader, Georgia, serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = alpha * p * 0.92;
          ctx.fillText(label, A.x + 7 * A.k, A.y - 7 * A.k);
        },
        area(points, p) {
          if (p <= 0) return;
          polyline(points.length, (i) => points[i]);
          ctx.closePath();
          ctx.fillStyle = palette.glow;
          ctx.globalAlpha = alpha * 0.16 * p;
          ctx.fill();
        },
        note(at, text, p) {
          if (p <= 0) return;
          project(view, at[0], at[1], 0, A);
          ctx.font = `600 ${Math.round(11 * A.k)}px "DM Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = palette.muted;
          ctx.globalAlpha = alpha * 0.85 * p;
          ctx.fillText(text, A.x, A.y);
        },
        rightAngle(at, direction, size, p) {
          if (p <= 0) return;
          const length = Math.hypot(direction[0], direction[1]) || 1;
          const u: Vec = [(direction[0] / length) * size, (direction[1] / length) * size];
          const corners: Vec[] = [[at[0] + u[0], at[1] + u[1]], [at[0] + u[0] - u[1], at[1] + u[1] + u[0]], [at[0] - u[1], at[1] + u[0]]];
          polyline(3, (i) => corners[i]);
          style();
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = alpha * 0.8 * p;
          ctx.stroke();
        },
        trace(points, p) {
          const count = Math.floor((points.length - 1) * p) + 1;
          if (count < 2) return;
          polyline(count, (i) => points[i]);
          style();
          ctx.stroke();
        },
      };
    };

    const pitchPath = (view: View, radius: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        project(view, Math.cos(angle) * radius, Math.sin(angle) * radius, 0, A);
        if (i) ctx.lineTo(A.x, A.y);
        else ctx.moveTo(A.x, A.y);
      }
      ctx.closePath();
    };

    const drawFloodlights = (view: View) => {
      for (let i = 0; i < 4; i++) {
        const on = smooth((scene.intro - 0.04 - i * 0.09) / 0.12);
        if (on <= 0) continue;
        const flicker = on < 1 ? 0.55 + 0.45 * Math.sin(scene.time * 70 + i * 2) : 1;
        const theta = Math.PI / 4 + (i * Math.PI) / 2;
        const r = RIM + 0.13;
        const top = project(view, Math.cos(theta) * r, Math.sin(theta) * r, 0.62, A);
        const left = project(view, Math.cos(theta + 0.42) * PITCH * 0.86, Math.sin(theta + 0.42) * PITCH * 0.86, 0, B);
        const right = project(view, Math.cos(theta - 0.42) * PITCH * 0.86, Math.sin(theta - 0.42) * PITCH * 0.86, 0, C);
        const beam = ctx.createLinearGradient(top.x, top.y, (left.x + right.x) / 2, (left.y + right.y) / 2);
        beam.addColorStop(0, withAlpha(palette.flood, 0.15 * on * flicker));
        beam.addColorStop(1, withAlpha(palette.flood, 0));
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const tx = top.x;
        const ty = top.y;
        const size = 26 * top.k * glyphScale();
        project(view, Math.cos(theta) * r, Math.sin(theta) * r, (r - PITCH) * RAKE * 0.9, B);
        ctx.setLineDash([]);
        ctx.strokeStyle = palette.muted;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3 * on;
        ctx.beginPath();
        ctx.moveTo(B.x, B.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        if (lamp) {
          ctx.globalAlpha = on * flicker;
          ctx.drawImage(lamp, tx - size / 2, ty - size / 2, size, size);
        }
      }
    };

    const drawPitch = (view: View, on: number) => {
      project(view, 0, 0, 0, C);
      pitchPath(view, PITCH);
      const lawn = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, view.s * PITCH * 1.15);
      lawn.addColorStop(0, withAlpha(palette.glow, 0.17));
      lawn.addColorStop(1, withAlpha(palette.glow, 0.035));
      ctx.fillStyle = lawn;
      ctx.globalAlpha = on;
      ctx.fill();
      ctx.setLineDash([]);
      ctx.strokeStyle = palette.glow;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.5 * on;
      ctx.stroke();

      pitchPath(view, PITCH + 0.035);
      ctx.setLineDash([2, 6]);
      ctx.globalAlpha = 0.18 * on;
      ctx.stroke();
      ctx.setLineDash([]);

      // Graph paper. Each line is its own chord of the pitch, so nothing needs clipping.
      ctx.lineWidth = 1;
      for (let g = -5; g <= 5; g++) {
        const v = g / 10;
        const half = Math.sqrt(PITCH * PITCH - v * v);
        ctx.globalAlpha = (g === 0 ? 0.3 : 0.08) * on;
        for (const horizontal of [false, true]) {
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) {
            const t = -half + (i / 8) * 2 * half;
            if (horizontal) project(view, t, v, 0, A);
            else project(view, v, t, 0, A);
            if (i) ctx.lineTo(A.x, A.y);
            else ctx.moveTo(A.x, A.y);
          }
          ctx.stroke();
        }
      }

      ctx.font = 'italic 500 14px Newsreader, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.muted;
      ctx.globalAlpha = 0.65 * on;
      project(view, PITCH * 0.86, -0.04, 0, A);
      ctx.fillText('x', A.x, A.y);
      project(view, 0.04, -PITCH * 0.86, 0, A);
      ctx.fillText('y', A.x, A.y);
    };

    const drawFigure = (view: View, on: number) => {
      if (scene.figureTime <= 0) return;
      const current = FIGURES[scene.figure];
      const length = figureLength(current);
      const fade = scene.figureTime > length + HOLD ? 1 - (scene.figureTime - length - HOLD) / FADE : 1;
      const pen = makePen(view, clamp01(fade) * on);
      let t = scene.figureTime;
      for (const step of current.steps) {
        if (t <= 0) break;
        step.draw(pen, easeInOut(Math.min(1, t / step.d)));
        t -= step.d;
      }
      ctx.setLineDash([]);
    };

    const drawRipples = (view: View) => {
      ctx.setLineDash([]);
      ctx.strokeStyle = palette.glow;
      ctx.lineWidth = 1.3;
      for (const ripple of scene.ripples) {
        const life = ripple.age / RIPPLE_LIFE;
        for (let ring = 0; ring < 3; ring++) {
          const radius = ripple.age * 0.26 + ring * 0.045;
          ctx.globalAlpha = Math.max(0, (1 - life) * (0.55 - ring * 0.14));
          ctx.beginPath();
          for (let i = 0; i <= 36; i++) {
            const angle = (i / 36) * Math.PI * 2;
            project(view, ripple.x + Math.cos(angle) * radius, ripple.y + Math.sin(angle) * radius, 0, A);
            if (i) ctx.lineTo(A.x, A.y);
            else ctx.moveTo(A.x, A.y);
          }
          ctx.stroke();
        }
      }
    };

    const drawSeats = (view: View) => {
      const spread = 1 / (2 * WAVE_WIDTH * WAVE_WIDTH);
      const base = view.s * 0.0105;
      for (const seat of seats) {
        const rowOn = smooth((scene.intro * 1.8 - 0.25 - seat.row * 0.07) / 0.3);
        if (rowOn <= 0) continue;
        const d = wrapAngle(seat.theta - scene.wave - seat.row * 0.035);
        let a = 0.8 * Math.exp(-d * d * spread);
        for (const wave of scene.waves) {
          const dw = wrapAngle(seat.theta - (wave.origin + wave.direction * wave.age * 1.7));
          const lit = (1 - wave.age / WAVE_LIFE) * Math.exp(-dw * dw * spread * 1.4);
          if (lit > a) a = lit;
        }
        for (const item of scene.cheers) {
          if (item.team === seat.team) a += (1 - item.age / CHEER_LIFE) * 0.75 * (0.5 + 0.5 * Math.sin(scene.time * 17 + seat.phase * 60));
        }
        a = clamp01(a + 0.07 * Math.sin(scene.time * 1.9 + seat.phase * 40));
        project(view, seat.x, seat.y, seat.h, A);
        const radius = base * A.k * (1 + 0.4 * a);
        const y = A.y - a * view.s * 0.012 * A.k;
        const size = radius * 4.4;
        ctx.globalAlpha = rowOn * Math.min(1, 0.25 + 0.75 * a + (seat.team === scene.hover ? 0.22 : 0));
        ctx.drawImage(sprites[seat.team], A.x - size / 2, y - size / 2, size, size);
        if (a > 0.5 && white) {
          const core = radius * 1.9;
          ctx.globalAlpha = rowOn * (a - 0.5) * 1.5;
          ctx.drawImage(white, A.x - core / 2, y - core / 2, core, core);
        }
      }
    };

    /** Section signs on each stand's outer rim, a dark pill so they read over the lights. */
    const drawLabels = (view: View, on: number) => {
      if (on <= 0) return;
      ctx.font = '700 10px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      const spacing = 'letterSpacing' in ctx ? 1.4 : 0;
      if (spacing) ctx.letterSpacing = `${spacing}px`;
      for (let team = 0; team < 4; team++) {
        const theta = (team * Math.PI) / 2;
        project(view, Math.cos(theta) * (RIM + 0.03), Math.sin(theta) * (RIM + 0.03), (RIM - PITCH) * RAKE + 0.07, A);
        const text = TEAM_NAMES[team].toUpperCase();
        const w = ctx.measureText(text).width + 18;
        const h = 20;
        const x = Math.min(width - w / 2 - 6, Math.max(w / 2 + 6, A.x));
        const y = Math.min(height - RESERVE - h / 2, Math.max(h / 2 + 6, A.y));
        const lit = scene.hover === team;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
        else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = palette.sign;
        ctx.globalAlpha = on * (lit ? 0.92 : 0.78);
        ctx.fill();
        ctx.strokeStyle = palette.teams[team];
        ctx.globalAlpha = on * (lit ? 0.9 : 0.38);
        ctx.stroke();
        ctx.fillStyle = palette.teams[team];
        ctx.globalAlpha = on;
        ctx.fillText(text, x + spacing / 2, y + 0.5);
      }
      if (spacing) ctx.letterSpacing = '0px';
    };

    const drawGlyphs = () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const glyph of scene.glyphs) {
        const t = glyph.age / glyph.life;
        ctx.globalAlpha = Math.min(1, glyph.age / 0.12) * (1 - t) ** 1.3;
        ctx.fillStyle = palette.teams[glyph.team];
        ctx.font = `500 ${glyph.size}px Newsreader, Georgia, serif`;
        ctx.setTransform(dpr, 0, 0, dpr, glyph.x * dpr, glyph.y * dpr);
        ctx.rotate(glyph.spin * glyph.age);
        ctx.fillText(glyph.text, 0, 0);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawQed = (view: View) => {
      if (scene.qed < 0) return;
      const t = scene.qed;
      project(view, 0, -PITCH * 0.7, 0, A);
      ctx.font = '500 16px Newsreader, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.pencil;
      ctx.globalAlpha = Math.min(1, t / 0.25) * (t > 1.4 ? Math.max(0, 1 - (t - 1.4) / 0.8) : 1);
      ctx.fillText('Q.E.D. ∎', A.x, A.y - 6 - t * 10);
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (width < 40 || height < 40) return;
      // A tall stage looks further down into the bowl, so the bowl fills it.
      const steeper = Math.min(0.2, Math.max(0, (height / width - 0.8) * 0.5));
      const view = fitView(width, height, scene.spin + scene.yaw, ELEVATION + steeper + scene.tilt, RESERVE);
      lastView = view;
      const pitchOn = smooth(scene.intro / 0.35);
      const labelsOn = smooth((scene.intro - 0.55) / 0.3);
      drawFloodlights(view);
      drawPitch(view, pitchOn);
      drawFigure(view, pitchOn);
      drawRipples(view);
      drawSeats(view);
      drawLabels(view, labelsOn);
      drawGlyphs();
      drawQed(view);
      ctx.globalAlpha = 1;
    };

    // -------------------------------------------------------------------
    // Loop, sizing and input
    // -------------------------------------------------------------------

    const running = () => !still && !pausedRef.current && visible && !document.hidden && !disposed;

    const frame = (now: number) => {
      frameId = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const started = performance.now();
      update(dt);
      draw();
      adapt(performance.now() - started);
      if (running()) frameId = requestAnimationFrame(frame);
    };

    /** A slow device gets fewer, larger seats rather than a stutter. */
    const adapt = (cost: number) => {
      frameCost = frameCost ? frameCost * 0.95 + cost * 0.05 : cost;
      if (++framesSinceCheck < 90 || scene.intro < 1) return;
      framesSinceCheck = 0;
      if (frameCost > 7 && quality < 2) {
        quality++;
        resize();
      }
    };

    const wake = () => {
      if (frameId || !running()) return;
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const rows = width >= 520 ? 8 : width >= 380 ? 7 : 6;
      const spacing = (width >= 520 ? 0.032 : width >= 380 ? 0.038 : 0.046) * [1, 1.3, 1.7][quality];
      if (`${rows}:${spacing}` !== layoutKey) {
        layoutKey = `${rows}:${spacing}`;
        seats = layoutSeats(rows, spacing);
        teamSeats = [[], [], [], []];
        seats.forEach((seat, index) => teamSeats[seat.team].push(index));
      }
      draw();
    };

    const locate = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (!lastView) return null;
      const world = unproject(lastView, px, py);
      const r = Math.hypot(world.x, world.y);
      if (r <= PITCH) return { kind: 'field' as const, ...world };
      if (r <= RIM + 0.45) {
        const theta = Math.atan2(world.y, world.x);
        return { kind: 'stand' as const, team: teamAt(theta), theta };
      }
      return null;
    };

    const onMove = (event: PointerEvent) => {
      if (still) return;
      const rect = canvas.getBoundingClientRect();
      scene.pointer = { x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: ((event.clientY - rect.top) / rect.height) * 2 - 1, inside: true };
      const hit = locate(event);
      scene.hover = hit?.kind === 'stand' ? hit.team : -1;
      canvas.style.cursor = hit ? 'pointer' : '';
      wake();
    };
    const onLeave = () => {
      scene.pointer = { ...scene.pointer, inside: false };
      scene.hover = -1;
      canvas.style.cursor = '';
    };
    const onDown = (event: PointerEvent) => {
      if (still || pausedRef.current) return;
      const hit = locate(event);
      if (!hit) return;
      if (hit.kind === 'stand') {
        cheer(hit.team, hit.theta);
      } else {
        scene.ripples.push({ x: hit.x, y: hit.y, age: 0 });
        if (scene.ripples.length > 5) scene.ripples.shift();
        project(lastView!, hit.x, hit.y, 0, A);
        for (let i = 0; i < 10; i++) spawnGlyph(A.x, A.y, Math.floor(Math.random() * 4) as Team);
      }
      wake();
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      wake();
    });
    viewObserver.observe(canvas);
    const themeObserver = new MutationObserver(() => {
      paint();
      if (!frameId) draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', wake);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    document.fonts?.ready.then(() => {
      if (!disposed && !frameId) draw();
    });
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      sizeObserver.disconnect();
      viewObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', wake);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      wakeRef.current = () => {};
    };
  }, [still]);

  useEffect(() => {
    wakeRef.current();
  }, [paused]);

  return (
    <div className="al-stage">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="An animated stadium: the four domain stands light up in a wave while a geometric construction is drawn on the field."
      />
      <p className="al-stage-caption" aria-hidden="true">
        <span>On the field</span>
        <AnimatePresence mode="wait" initial={false}>
          <m.strong
            key={figure}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            {FIGURES[figure].name}
          </m.strong>
        </AnimatePresence>
      </p>
      {!still && (
        <div className="al-stage-controls">
          {!paused && <span className="al-stage-hint" aria-hidden="true"><Hand size={14} />Tap a stand</span>}
          <button type="button" className="al-stage-pause" onClick={onTogglePause} aria-pressed={paused} aria-label="Pause the arena animation">
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ArenaStage);
