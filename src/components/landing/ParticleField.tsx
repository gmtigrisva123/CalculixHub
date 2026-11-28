/**
 * Mathematics as light: the tuning of the landing page's particles, and the
 * butterfly drawn in 2D for a machine that cannot run the live stage.
 *
 * The live thread of light (threadEngine.ts) grew out of this file. What it
 * learned here still governs it, and lives here still:
 *
 *   - the particles are stored in shuffled order, so any prefix of them is an
 *     even sample of the form and the stage can draw fewer by drawing less;
 *   - small screens and low-core devices draw fewer, slightly larger ones;
 *   - the loop watches its own frame time and steps down through QUALITY
 *     (fewer particles, a lower pixel ratio) when a device cannot keep up;
 *   - a software rasteriser — SwiftShader, llvmpipe — never gets the live
 *     stage at all: it would spend seconds per frame on thousands of glowing
 *     points. Such a machine, or one without WebGL, gets the same form drawn
 *     once in 2D (`ParticleFallback`), from the same angle.
 */

import { useEffect, useRef } from 'react';
import type { WebGLRenderer } from 'three';
import { lorenzPath, mulberry32, pathPoint } from './particleShapes';

const TAU = Math.PI * 2;

/** Samples along the Lorenz path drawn by the 2D fallback. */
const PATH_LENGTH = 16384;

/** Small screens and low-core devices draw fewer, slightly larger particles. */
export function deviceTier(width: number): 'low' | 'high' {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return width < 760 || cores <= 4 ? 'low' : 'high';
}

/** A renderer that rasterises on the CPU, where thousands of glowing points cost seconds a frame. */
export function isSoftwareRenderer(renderer: WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** Fisher–Yates over records of `size` floats, applying one permutation to every array given. */
export function shuffleRecords(count: number, rng: () => number, arrays: { data: Float32Array; size: number }[]): void {
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    for (const { data, size } of arrays) {
      for (let k = 0; k < size; k += 1) {
        const a = i * size + k;
        const b = j * size + k;
        const swap = data[a];
        data[a] = data[b];
        data[b] = swap;
      }
    }
  }
}

/** Threads along the path and loose dust, on a capable device and a modest one. */
export const COUNTS = { high: { threads: 46000, dust: 1800 }, low: { threads: 20000, dust: 700 } } as const;

/** The form's resting tilt towards the viewer and turn about its height, in radians: the wings open, never edge-on. */
export const TILT = 0.22;
export const TURN = 0.36;

/** Quality steps the loop can fall back through: share of particles drawn, pixel-ratio ceiling, point size. */
export const QUALITY = [
  { share: 1, ratio: 2, size: 1 },
  { share: 0.6, ratio: 1.25, size: 1.12 },
  { share: 0.36, ratio: 1, size: 1.3 },
] as const;

/**
 * Without a usable WebGL: the butterfly in a 2D canvas, painted once and
 * again only when the stage is resized.
 */
export default function ParticleFallback({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    const style = getComputedStyle(host);
    const paint = () => drawFallback(canvas, host, style);
    paint();
    const resizeObserver = new ResizeObserver(paint);
    resizeObserver.observe(host);
    return () => {
      resizeObserver.disconnect();
      canvas.remove();
    };
  }, []);
  return <div ref={hostRef} className={className} aria-hidden="true" />;
}

/** The same form, drawn in 2D from the same angle. */
export function drawFallback(canvas: HTMLCanvasElement, host: HTMLElement, style: CSSStyleDeclaration): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = host.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const wide = rect.width >= 960;
  // The same framing as the live stage: right of the words when wide, above them when narrow.
  const cx = canvas.width * (wide ? 0.75 : 0.5);
  const cy = canvas.height * (wide ? 0.5 : 0.3);
  const scale = Math.min(canvas.width, canvas.height) / (wide ? 6.4 : 7.4);
  const [cosY, sinY] = [Math.cos(TURN), Math.sin(TURN)];
  const [cosX, sinX] = [Math.cos(TILT), Math.sin(TILT)];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  const cool = style.getPropertyValue('--lx-pf-cool').trim() || '#6fcde4';
  const warm = style.getPropertyValue('--lx-pf-warm').trim() || '#dcefe9';
  const edge = style.getPropertyValue('--lx-pf-edge').trim() || '#ffc56e';
  const path = lorenzPath(PATH_LENGTH);
  const rng = mulberry32(5);
  for (let k = 0; k < 9000; k += 1) {
    const [x0, y0, z0, fast] = pathPoint(path, rng() * (path.length - 1));
    // Turn about the vertical, then tip towards the viewer, as the live stage does.
    const x = x0 * cosY + z0 * sinY;
    const z1 = -x0 * sinY + z0 * cosY;
    const y = y0 * cosX - z1 * sinX;
    const z = y0 * sinX + z1 * cosX;
    const depth = 7 / (7 - z);
    context.globalAlpha = 0.3 + 0.3 * fast;
    context.fillStyle = fast > 0.7 ? edge : x0 > 0 ? warm : cool;
    context.beginPath();
    context.arc(cx + x * scale * depth, cy - y * scale * depth, ratio * 0.8, 0, TAU);
    context.fill();
  }
}
