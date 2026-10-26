/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Four small proofs, one inside each topic medallion.
 *
 *   Algebra        Gauss's staircase: two copies of 1 + 2 + 3 + 4 fill a 4 × 5
 *                  rectangle, so the sum is 4 · 5 / 2.
 *   Geometry       A triangle that will not sit still, and the incircle that
 *                  stays tangent to all three sides however it moves.
 *   Combinatorics  Lattice paths: every route of four steps right and four up,
 *                  one of the 70 drawn at a time.
 *   Number Theory  The times-table circle: k joined to m·k (mod 48). At m = 2
 *                  the chords envelope a cardioid; as m grows, more cusps.
 *
 * Each is a `Scene` for useCanvasScene, coloured from the tile's own custom
 * properties. Under reduced motion each settles on its most legible frame.
 */

import type { Topic } from '../../../shared/types';
import { clamp01, easeInOut, easeOut, withAlpha, type Scene, type SceneSize } from './useCanvasScene';

interface Ink {
  hue: string;
  line: string;
}

type Painter = (ctx: CanvasRenderingContext2D, size: SceneSize, time: number, ink: Ink) => void;

/** Seconds into each loop that make the clearest still frame. */
const REST: Record<Topic, number> = { Algebra: 3.4, Geometry: 0, Combinatorics: 2.6, 'Number Theory': 0 };

// ---------------------------------------------------------------------------
// Algebra: two staircases make a rectangle
// ---------------------------------------------------------------------------

const STAIR_LOOP = 6.6;

const staircase: Painter = (ctx, { width, height }, time, ink) => {
  const t = time % STAIR_LOOP;
  const rows = 4;
  const cols = 5;
  const pitch = Math.min(width / (cols + 1.2), height / (rows + 1.4));
  const left = (width - pitch * (cols - 1)) / 2;
  const top = (height - pitch * (rows - 1)) / 2;
  const radius = pitch * 0.3;
  const out = t > 5 ? 1 - easeInOut((t - 5) / 0.8) : 1;
  let order = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = left + c * pitch;
      const y = top + r * pitch;
      if (c <= r) {
        // First copy of 1 + 2 + 3 + 4, dot by dot.
        const appear = easeOut((t - 0.15 - order * 0.13) / 0.32);
        order++;
        if (appear <= 0) continue;
        ctx.fillStyle = withAlpha(ink.hue, 0.95 * appear * out);
        ctx.beginPath();
        ctx.arc(x, y, radius * (0.55 + 0.45 * appear), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // The second copy slides in, row by row, to complete the rectangle.
        const arrive = easeOut((t - 1.75 - r * 0.12) / 0.7);
        if (arrive <= 0) continue;
        ctx.strokeStyle = withAlpha(ink.hue, 0.9 * arrive * out);
        ctx.lineWidth = Math.max(1.2, radius * 0.38);
        ctx.beginPath();
        ctx.arc(x + (1 - arrive) * pitch * 1.4, y, radius * 0.78, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // The rectangle's outline confirms the count: 4 × 5 = 2 × (1 + 2 + 3 + 4).
  const frame = easeOut((t - 2.7) / 0.6) * out;
  if (frame > 0) {
    ctx.strokeStyle = withAlpha(ink.line, 0.55 * frame);
    ctx.lineWidth = 1;
    const pad = pitch * 0.5;
    ctx.strokeRect(left - pad, top - pad, pitch * (cols - 1) + pad * 2, pitch * (rows - 1) + pad * 2);
  }
};

// ---------------------------------------------------------------------------
// Geometry: the incircle keeps up
// ---------------------------------------------------------------------------

const incircle: Painter = (ctx, { width, height }, time, ink) => {
  const cx = width / 2;
  const cy = height / 2 + height * 0.03;
  const reach = Math.min(width, height) * 0.4;
  const corners = [0, 1, 2].map((i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const wobble = reach * 0.2;
    return [
      cx + Math.cos(angle) * reach + Math.sin(time * (0.55 + i * 0.17) + i * 2.1) * wobble,
      cy + Math.sin(angle) * reach + Math.cos(time * (0.43 + i * 0.21) + i * 1.3) * wobble,
    ];
  });
  const [A, B, C] = corners;
  const a = Math.hypot(B[0] - C[0], B[1] - C[1]);
  const b = Math.hypot(A[0] - C[0], A[1] - C[1]);
  const c = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const perimeter = a + b + c;
  const ix = (a * A[0] + b * B[0] + c * C[0]) / perimeter;
  const iy = (a * A[1] + b * B[1] + c * C[1]) / perimeter;
  const areaTwice = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]));
  const inradius = areaTwice / perimeter;

  // Bisectors, faint: where the centre comes from.
  ctx.strokeStyle = withAlpha(ink.line, 0.28);
  ctx.lineWidth = 1;
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ix, iy);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(ink.hue, 0.14);
  ctx.strokeStyle = withAlpha(ink.hue, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ix, iy, inradius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = withAlpha(ink.hue, 1);
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.closePath();
  ctx.stroke();

  // The three points of tangency: the foot of the radius on each side.
  ctx.fillStyle = withAlpha(ink.hue, 1);
  for (const [P, Q] of [[A, B], [B, C], [C, A]]) {
    const dx = Q[0] - P[0];
    const dy = Q[1] - P[1];
    const s = ((ix - P[0]) * dx + (iy - P[1]) * dy) / (dx * dx + dy * dy);
    ctx.beginPath();
    ctx.arc(P[0] + dx * s, P[1] + dy * s, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ---------------------------------------------------------------------------
// Combinatorics: one lattice path at a time
// ---------------------------------------------------------------------------

const PATH_LOOP = 3.6;

function routeFor(seed: number): number[] {
  // A deterministic shuffle of four rights (0) and four ups (1), so every loop
  // draws a different route without any state to carry.
  const steps = [0, 0, 0, 0, 1, 1, 1, 1];
  let s = (seed * 2654435761) >>> 0;
  for (let i = steps.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [steps[i], steps[j]] = [steps[j], steps[i]];
  }
  return steps;
}

const latticePaths: Painter = (ctx, { width, height }, time, ink) => {
  const n = 4;
  const pitch = Math.min(width, height) / (n + 1.6);
  const left = (width - pitch * n) / 2;
  const bottom = height - (height - pitch * n) / 2;
  const at = (x: number, y: number): [number, number] => [left + x * pitch, bottom - y * pitch];

  ctx.fillStyle = withAlpha(ink.line, 0.55);
  for (let x = 0; x <= n; x++) {
    for (let y = 0; y <= n; y++) {
      const [px, py] = at(x, y);
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const loop = Math.floor(time / PATH_LOOP);
  const t = time - loop * PATH_LOOP;
  const draw = (route: number[], progress: number, alpha: number, lineWidth: number): [number, number] => {
    let x = 0;
    let y = 0;
    ctx.strokeStyle = withAlpha(ink.hue, alpha);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...at(0, 0));
    const travelled = progress * route.length;
    for (let i = 0; i < route.length && i < travelled; i++) {
      const part = Math.min(1, travelled - i);
      if (route[i] === 0) x += part;
      else y += part;
      ctx.lineTo(...at(x, y));
    }
    ctx.stroke();
    return at(x, y);
  };

  // The two routes before this one linger as ghosts: there are many ways up.
  for (let back = 2; back >= 1; back--) {
    draw(routeFor(loop - back + 1000), 1, 0.12 * (3 - back), 1.4);
  }
  const progress = easeInOut(t / 2.3);
  const fade = t > 3 ? 1 - (t - 3) / 0.6 : 1;
  const head = draw(routeFor(loop + 1000), progress, 0.95 * clamp01(fade), 2.2);
  ctx.fillStyle = withAlpha(ink.hue, clamp01(fade));
  ctx.beginPath();
  ctx.arc(head[0], head[1], 3, 0, Math.PI * 2);
  ctx.fill();
  const [ex, ey] = at(n, n);
  ctx.strokeStyle = withAlpha(ink.hue, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// Number theory: the times-table circle
// ---------------------------------------------------------------------------

const timesTable: Painter = (ctx, { width, height }, time, ink) => {
  const points = 48;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.4;
  // The multiplier glides from 2 to 5 and back, so the figure morphs without a seam.
  const m = 2 + 3 * (0.5 - 0.5 * Math.cos(time * 0.16));

  ctx.strokeStyle = withAlpha(ink.line, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(ink.hue, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < points; k++) {
    const from = Math.PI / 2 + (k / points) * Math.PI * 2;
    const to = Math.PI / 2 + ((m * k) / points) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(from) * r, cy + Math.sin(from) * r);
    ctx.lineTo(cx + Math.cos(to) * r, cy + Math.sin(to) * r);
  }
  ctx.stroke();

  ctx.fillStyle = withAlpha(ink.hue, 0.95);
  for (let k = 0; k < points; k += 4) {
    const angle = Math.PI / 2 + (k / points) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

const PAINTERS: Record<Topic, Painter> = {
  Algebra: staircase,
  Geometry: incircle,
  Combinatorics: latticePaths,
  'Number Theory': timesTable,
};

/** The medallion scene for one topic. `boost` speeds it up while the tile is hovered. */
export function createGlyph(topic: Topic, still: boolean, boost: { current: number }): Scene {
  const ink: Ink = { hue: '#426c7b', line: '#9eaeae' };
  // Each tile starts at a different point in its loop so the row never moves in step.
  let time = still ? REST[topic] : REST[topic] * 0.5;
  let speed = 1;
  const paint = PAINTERS[topic];
  return {
    palette(read) {
      ink.hue = read('--dh-hue', ink.hue);
      ink.line = read('--dh-glyph-line', ink.line);
    },
    rest() {
      time = REST[topic];
    },
    frame(ctx, size, dt) {
      speed += (1 + boost.current * 1.4 - speed) * Math.min(1, dt * 5);
      time += dt * speed;
      ctx.clearRect(0, 0, size.width, size.height);
      paint(ctx, size, time, ink);
    },
  };
}
