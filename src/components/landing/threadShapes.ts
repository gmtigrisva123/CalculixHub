/**
 * The shapes the thread of light takes, as plain numbers.
 *
 * The landing page is one thread drawn through every scene: the Lorenz
 * butterfly, a line, the engine's belief curve, a circle, chalk dust, a
 * staircase, a pencil line. On the GPU each particle knows only how far along
 * the thread it is (u, from 0 to 1) and asks the current shape where that is.
 * Shapes made of straight and curved pieces are handed to the GPU already
 * resampled by arc length, so `u` means the same distance along every one of
 * them and a morph from one to the next moves each particle to the same share
 * of the way along the new shape.
 *
 * Everything here is pure: no WebGL, no DOM. It is tested on its own, and the
 * 2D fallback draws from the same numbers the shader does.
 */

export type Point = readonly [number, number, number];

/** How many samples a polyline is resampled to before it is uploaded. */
export const POLY_SAMPLES = 256;

/**
 * A polyline resampled to `count` points evenly spaced along its length.
 * Returns x, y, z and the fraction of the length reached, per sample.
 */
export function resampleByLength(points: readonly Point[], count = POLY_SAMPLES): Float32Array {
  const out = new Float32Array(count * 4);
  if (points.length === 0) return out;
  if (points.length === 1) {
    for (let i = 0; i < count; i += 1) out.set([...points[0], i / Math.max(1, count - 1)], i * 4);
    return out;
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
  }
  const total = lengths[lengths.length - 1] || 1;
  let segment = 1;
  for (let i = 0; i < count; i += 1) {
    const at = (i / (count - 1)) * total;
    while (segment < points.length - 1 && lengths[segment] < at) segment += 1;
    const span = lengths[segment] - lengths[segment - 1] || 1;
    const f = Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span));
    const a = points[segment - 1];
    const b = points[segment];
    out[i * 4] = a[0] + (b[0] - a[0]) * f;
    out[i * 4 + 1] = a[1] + (b[1] - a[1]) * f;
    out[i * 4 + 2] = a[2] + (b[2] - a[2]) * f;
    out[i * 4 + 3] = at / total;
  }
  return out;
}

/** The total length of a polyline. */
export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  }
  return total;
}

/** The perimeter of a rounded rectangle centred on the origin, clockwise from the middle of its top edge. */
export function roundRectPoints(width: number, height: number, radius: number, perCorner = 10): Point[] {
  const w = width / 2;
  const h = height / 2;
  const r = Math.max(0, Math.min(radius, w, h));
  const points: Point[] = [[0, h, 0]];
  const corner = (cx: number, cy: number, from: number) => {
    for (let k = 0; k <= perCorner; k += 1) {
      const angle = from - (k / perCorner) * (Math.PI / 2);
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 0]);
    }
  };
  corner(w - r, h - r, Math.PI / 2);
  corner(w - r, -h + r, 0);
  corner(-w + r, -h + r, -Math.PI / 2);
  corner(-w + r, h - r, Math.PI);
  points.push([0, h, 0]);
  return points;
}

// ---------------------------------------------------------------------------
// SVG path data (M, L, H, V, C, S, Z; absolute and relative)
// ---------------------------------------------------------------------------

/**
 * Sample an SVG path into points, `steps` per curve. Enough of the grammar for
 * the page's own hand-written paths; arcs and quadratics are not used.
 */
export function svgPathPoints(d: string, steps = 16): Point[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let i = 0;
  let command = 'M';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let control: [number, number] | null = null;
  const number = () => Number(tokens[i++]);
  const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    for (let k = 1; k <= steps; k += 1) {
      const t = k / steps;
      const m = 1 - t;
      points.push([
        m * m * m * x + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * ex,
        m * m * m * y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * ey,
        0,
      ]);
    }
    control = [x2, y2];
    x = ex;
    y = ey;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    switch (command.toUpperCase()) {
      case 'M': {
        x = ox + number();
        y = oy + number();
        startX = x;
        startY = y;
        points.push([x, y, 0]);
        control = null;
        command = relative ? 'l' : 'L';
        break;
      }
      case 'L': {
        x = ox + number();
        y = oy + number();
        points.push([x, y, 0]);
        control = null;
        break;
      }
      case 'H': { x = (relative ? x : 0) + number(); points.push([x, y, 0]); control = null; break; }
      case 'V': { y = (relative ? y : 0) + number(); points.push([x, y, 0]); control = null; break; }
      case 'C': {
        const x1 = ox + number(); const y1 = oy + number();
        const x2 = ox + number(); const y2 = oy + number();
        const ex = ox + number(); const ey = oy + number();
        cubic(x1, y1, x2, y2, ex, ey);
        break;
      }
      case 'S': {
        const x1 = control ? 2 * x - control[0] : x;
        const y1 = control ? 2 * y - control[1] : y;
        const x2 = ox + number(); const y2 = oy + number();
        const ex = ox + number(); const ey = oy + number();
        cubic(x1, y1, x2, y2, ex, ey);
        break;
      }
      case 'Z': {
        x = startX;
        y = startY;
        points.push([x, y, 0]);
        control = null;
        break;
      }
      default:
        i += 1;
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// The engine's belief curve
// ---------------------------------------------------------------------------

/**
 * The posterior weights on the engine's grid, as `count` heights from 0 to 1
 * evenly spaced across [thetaMin, thetaMax], interpolated between grid nodes
 * and scaled by the run's tallest weight (so one vertical scale serves the
 * whole replay).
 */
export function curveHeights(grid: readonly number[], weights: readonly number[], peak: number, thetaMin: number, thetaMax: number, count: number, out = new Float32Array(count)): Float32Array {
  const step = grid[1] - grid[0];
  for (let i = 0; i < count; i += 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * i) / (count - 1);
    const position = (theta - grid[0]) / step;
    const lower = Math.max(0, Math.min(grid.length - 2, Math.floor(position)));
    const f = Math.min(1, Math.max(0, position - lower));
    out[i] = (weights[lower] * (1 - f) + weights[lower + 1] * f) / (peak || 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Colour: the page's tokens are OKLCH; WebGL wants sRGB
// ---------------------------------------------------------------------------

export interface Oklch { l: number; c: number; h: number; alpha: number }

/** Parse `oklch(96.9% 0.011 84)` or `oklch(0.85 0.095 208 / 0.16)`. */
export function parseOklch(text: string): Oklch | null {
  const match = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)/i.exec(text);
  if (!match) return null;
  const l = Number(match[1]) / (match[2] ? 100 : 1);
  const alpha = match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1);
  return { l, c: Number(match[3]), h: Number(match[4]), alpha };
}

const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** OKLCH to gamma-encoded sRGB, each channel clamped to [0, 1]. */
export function oklchToSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const clamp = (v: number) => Math.min(1, Math.max(0, gamma(v)));
  return [clamp(r), clamp(g), clamp(bl)];
}

/** Any CSS colour the page uses for its tokens (oklch or hex) as sRGB 0–1, or the fallback. */
export function cssColorToSrgb(text: string, fallback: [number, number, number]): [number, number, number] {
  const trimmed = text.trim();
  const oklch = parseOklch(trimmed);
  if (oklch) return oklchToSrgb(oklch);
  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Easing and springs that are functions of a playhead, so they scrub
// ---------------------------------------------------------------------------

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const smoothstep = (a: number, b: number, value: number) => {
  const t = clamp01((value - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The step response of a damped spring at time `t` (seconds), from 0 to 1 with
 * its overshoot: for things that must land with a bounce whatever drives
 * their clock, including the scroll.
 */
export function springStep(t: number, stiffness = 170, damping = 26, mass = 0.5): number {
  if (t <= 0) return 0;
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-omega * t) * (1 + omega * t);
}
