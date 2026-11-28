import { describe, expect, it } from 'vitest';
import {
  POLY_SAMPLES, clamp01, cssColorToSrgb, curveHeights, oklchToSrgb, parseOklch, polylineLength, resampleByLength,
  roundRectPoints, smoothstep, springStep, svgPathPoints, type Point,
} from './threadShapes';
import { ENGINE_RUN } from './engineRun';

describe('thread shapes', () => {
  it('resamples a polyline evenly by length, ending exactly at its last point', () => {
    const points: Point[] = [[0, 0, 0], [100, 0, 0], [100, 300, 0]];
    const samples = resampleByLength(points, 9);
    expect(samples.length).toBe(9 * 4);
    // 400 long in all: the samples are 50 apart, so sample 2 is at the corner.
    expect(samples[2 * 4]).toBeCloseTo(100);
    expect(samples[2 * 4 + 1]).toBeCloseTo(0);
    expect(samples[8 * 4]).toBeCloseTo(100);
    expect(samples[8 * 4 + 1]).toBeCloseTo(300);
    for (let i = 0; i < 9; i += 1) expect(samples[i * 4 + 3]).toBeCloseTo(i / 8);
  });

  it('measures a polyline and walks a rounded rectangle back to where it started', () => {
    expect(polylineLength([[0, 0, 0], [3, 4, 0]])).toBe(5);
    const loop = roundRectPoints(200, 100, 20);
    expect(loop[0]).toEqual(loop[loop.length - 1]);
    for (const [x, y] of loop) {
      expect(Math.abs(x)).toBeLessThanOrEqual(100 + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(50 + 1e-9);
    }
    // A square's perimeter less the four corners' straight bits, plus a circle.
    expect(polylineLength(loop)).toBeCloseTo(2 * (160 + 60) + 2 * Math.PI * 20, 0);
  });

  it('samples the hand-drawn SVG paths the page uses, smooth joins included', () => {
    const points = svgPathPoints('M0 0C10 0 20 10 30 10S50 20 60 20L60 40', 8);
    expect(points[0]).toEqual([0, 0, 0]);
    expect(points[8][0]).toBeCloseTo(30);
    expect(points[8][1]).toBeCloseTo(10);
    expect(points[16][0]).toBeCloseTo(60);
    expect(points[points.length - 1]).toEqual([60, 40, 0]);
    expect(points.every(point => point.every(Number.isFinite))).toBe(true);
  });

  it('reads the engine curve at any resolution, scaled to the run’s tallest weight', () => {
    const heights = curveHeights(ENGINE_RUN.grid, ENGINE_RUN.steps[ENGINE_RUN.steps.length - 1].weights, ENGINE_RUN.peak, -3.4, 3.4, POLY_SAMPLES);
    expect(heights.length).toBe(POLY_SAMPLES);
    let top = 0;
    let at = 0;
    heights.forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1 + 1e-6);
      if (value > top) { top = value; at = index; }
    });
    // The finished run peaks near its final estimate.
    const theta = -3.4 + (6.8 * at) / (POLY_SAMPLES - 1);
    expect(Math.abs(theta - ENGINE_RUN.steps[ENGINE_RUN.steps.length - 1].theta)).toBeLessThan(0.15);
  });
});

describe('colour for the stage', () => {
  it('parses the page’s OKLCH tokens, with and without alpha', () => {
    const paper = parseOklch('oklch(96.9% 0.011 84)')!;
    expect(paper.l).toBeCloseTo(0.969, 9);
    expect([paper.c, paper.h, paper.alpha]).toEqual([0.011, 84, 1]);
    const glow = parseOklch('oklch(85% 0.095 208 / 0.16)')!;
    expect(glow.l).toBeCloseTo(0.85, 9);
    expect([glow.c, glow.h, glow.alpha]).toEqual([0.095, 208, 0.16]);
    expect(parseOklch('#fff')).toBeNull();
  });

  it('converts OKLCH to the sRGB a browser would paint', () => {
    const white = oklchToSrgb({ l: 1, c: 0, h: 0, alpha: 1 });
    white.forEach(channel => expect(channel).toBeCloseTo(1, 3));
    const black = oklchToSrgb({ l: 0, c: 0, h: 0, alpha: 1 });
    black.forEach(channel => expect(channel).toBeCloseTo(0, 3));
    // The page's paper is a warm off-white: red a touch above blue.
    const [r, g, b] = oklchToSrgb(parseOklch('oklch(96.9% 0.011 84)')!);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(0.93);
  });

  it('accepts hex tokens and falls back for anything else', () => {
    expect(cssColorToSrgb('#ff8000', [0, 0, 0])).toEqual([1, 128 / 255, 0]);
    expect(cssColorToSrgb('rebeccapurple', [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('scrubbable easing', () => {
  it('clamps and eases between edges', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
    expect(smoothstep(0, 10, -1)).toBe(0);
  });

  it('springs from 0 past 1 and settles there, as a pure function of time', () => {
    expect(springStep(0)).toBe(0);
    let peak = 0;
    for (let t = 0; t < 1; t += 0.01) peak = Math.max(peak, springStep(t, 170, 12, 0.5));
    expect(peak).toBeGreaterThan(1);
    expect(springStep(3)).toBeCloseTo(1, 3);
  });
});
