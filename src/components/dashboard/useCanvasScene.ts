/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One frame loop for every drawing on the dashboard.
 *
 * Each living figure -- the hero's drawing machine, the four topic medallions,
 * the visual proof -- is a small `Scene`: it reads its colours from custom
 * properties, sizes itself to its canvas, and draws one frame when asked. This
 * hook owns everything around that:
 *
 *   - a backing store at the device pixel ratio, capped at 2;
 *   - a loop that runs only while the canvas is on screen, the tab is visible
 *     and the viewer has not paused the dashboard;
 *   - a frame-rate ceiling, so small ornaments can settle for 30 fps;
 *   - one still frame, and no loop at all, under prefers-reduced-motion;
 *   - a repaint whenever the theme flips or the webfonts finish loading.
 *
 * Paused or offscreen, a canvas keeps the last frame it drew; nothing blanks.
 */

import { useEffect, useRef, type RefObject } from 'react';

export interface SceneSize {
  width: number;
  height: number;
  dpr: number;
}

export interface Scene {
  /** Re-read colours. Called on mount and whenever the theme flips. */
  palette?(read: (name: string, fallback: string) => string): void;
  /** The canvas changed size. Rebuild anything cached at the old size. */
  resize?(size: SceneSize): void;
  /** Advance by `dt` seconds and draw. `dt` is 0 for a repaint in place. */
  frame(ctx: CanvasRenderingContext2D, size: SceneSize, dt: number): void;
  /** Settle into the frame shown under reduced motion. */
  rest?(): void;
  /** Detach anything the scene attached itself. */
  dispose?(): void;
}

export interface SceneControls {
  /** Draw the current state now, whether or not the loop is running. */
  redraw(): void;
  /** Restart the loop if it is allowed to run. */
  wake(): void;
}

interface Options {
  still: boolean;
  paused: boolean;
  fps?: number;
}

const idle: SceneControls = { redraw() {}, wake() {} };

export function useCanvasScene<S extends Scene>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  create: (canvas: HTMLCanvasElement) => S,
  { still, paused, fps = 60 }: Options,
) {
  const controls = useRef<SceneControls>(idle);
  const sceneRef = useRef<S | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // The factory is read once per mount; a new closure every render must not
  // tear the scene down and rebuild it.
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const scene = createRef.current(canvas);
    sceneRef.current = scene;
    let size: SceneSize = { width: 0, height: 0, dpr: 1 };
    let frameId = 0;
    let last = 0;
    let visible = true;
    let disposed = false;
    const interval = 1000 / fps;

    const read = () => {
      const style = getComputedStyle(canvas);
      scene.palette?.((name, fallback) => style.getPropertyValue(name).trim() || fallback);
    };

    const paint = (dt: number) => {
      if (!size.width || !size.height) return;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      scene.frame(ctx, size, dt);
    };

    const running = () => !still && !pausedRef.current && visible && !document.hidden;

    const loop = (now: number) => {
      frameId = 0;
      if (disposed || !running()) {
        last = 0;
        return;
      }
      frameId = requestAnimationFrame(loop);
      if (last && now - last < interval - 1.5) return;
      // A long gap (a dropped frame, a resumed tab) is one ordinary step, not a jump.
      const dt = last ? Math.min(1 / 20, (now - last) / 1000) : 1 / 60;
      last = now;
      paint(dt);
    };

    const wake = () => {
      if (!frameId && running()) {
        last = 0;
        frameId = requestAnimationFrame(loop);
      }
    };

    const redraw = () => {
      if (still) scene.rest?.();
      paint(0);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width === size.width && height === size.height && dpr === size.dpr) return;
      size = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      scene.resize?.(size);
      redraw();
    };

    read();
    if (still) scene.rest?.();

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        wake();
      },
      { rootMargin: '48px' },
    );
    viewObserver.observe(canvas);
    const themeObserver = new MutationObserver(() => {
      read();
      redraw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', wake);
    document.fonts?.ready.then(() => {
      if (!disposed) redraw();
    });

    resize();
    wake();
    controls.current = { redraw, wake };

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      sizeObserver.disconnect();
      viewObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', wake);
      scene.dispose?.();
      sceneRef.current = null;
      controls.current = idle;
    };
  }, [canvasRef, still, fps]);

  useEffect(() => {
    if (!paused) controls.current.wake();
  }, [paused]);

  return { controls, sceneRef };
}

/** `#rgb` / `#rrggbb` at an alpha; any other colour string passes through unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : '';
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  const n = parseInt(full, 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
