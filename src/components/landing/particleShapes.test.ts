import { describe, expect, it } from 'vitest';
import { figureLayout, GOLDEN_ANGLE, insideFigure, KIND, PROFILE, seedPoint, smoothCurve, type FigureCounts } from './particleShapes';

const COUNTS: FigureCounts = { outline: 300, surface: 1200, hair: 900, features: 80, seeds: 200, rising: 30, dust: 100 };

function total(counts: FigureCounts) {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

describe('landing hero figure', () => {
  it('lays out exactly the particles asked for, every value finite', () => {
    const layout = figureLayout(COUNTS);
    expect(layout.count).toBe(total(COUNTS));
    expect(layout.position.length).toBe(layout.count * 3);
    expect(layout.meta.length).toBe(layout.count * 4);
    expect(layout.position.every(Number.isFinite)).toBe(true);
    expect(layout.meta.every(Number.isFinite)).toBe(true);
  });

  it('gives every part of the figure its particles', () => {
    const layout = figureLayout(COUNTS);
    const seen = new Map<number, number>();
    for (let i = 0; i < layout.count; i += 1) {
      const kind = layout.meta[i * 4 + 3];
      seen.set(kind, (seen.get(kind) ?? 0) + 1);
    }
    expect(seen.get(KIND.outline)).toBe(COUNTS.outline);
    expect(seen.get(KIND.surface)).toBe(COUNTS.surface);
    expect(seen.get(KIND.seed)).toBe(COUNTS.seeds);
    expect(seen.get(KIND.rising)).toBe(COUNTS.rising);
    // Hair strands are trimmed to the hairline, so most of their share, not all, is hair.
    expect(seen.get(KIND.hair)!).toBeGreaterThan(COUNTS.hair * 0.5);
    for (const kind of Object.values(KIND)) expect(seen.get(kind)).toBeGreaterThan(0);
  });

  it('keeps the head inside its silhouette and on its near side', () => {
    const layout = figureLayout(COUNTS);
    const outline = smoothCurve(PROFILE, 5);
    for (let i = 0; i < layout.count; i += 1) {
      if (layout.meta[i * 4 + 3] !== KIND.surface) continue;
      expect(insideFigure(layout.position[i * 3], layout.position[i * 3 + 1], outline)).toBe(true);
      expect(layout.position[i * 3 + 2]).toBeGreaterThanOrEqual(0);
    }
  });

  it('faces the words: the nose is the furthest point forward', () => {
    const forward = Math.min(...PROFILE.map(([x]) => x));
    const nose = PROFILE.find(([x]) => x === forward)!;
    // The nose sits a little below the eyes, roughly halfway down the head.
    expect(nose[1]).toBeGreaterThan(-0.4);
    expect(nose[1]).toBeLessThan(0.3);
  });

  it('grows the seeds by the golden angle, never repeating a direction', () => {
    expect((GOLDEN_ANGLE * 180) / Math.PI).toBeCloseTo(137.508, 2);
    const layout = figureLayout(COUNTS);
    const angles: number[] = [];
    for (let i = 0; i < layout.count; i += 1) {
      if (layout.meta[i * 4 + 3] === KIND.seed) angles.push(layout.position[i * 3 + 1] % (Math.PI * 2));
    }
    const rounded = new Set(angles.map(a => a.toFixed(4)));
    expect(rounded.size).toBe(angles.length);
    // A seed turned by a full circle lands where it started.
    const [x, y, z] = seedPoint(0.3, 1.1, 0);
    const [x2, y2, z2] = seedPoint(0.3, 1.1, Math.PI * 2);
    expect(x2).toBeCloseTo(x, 9);
    expect(y2).toBeCloseTo(y, 9);
    expect(z2).toBeCloseTo(z, 9);
  });
});
