import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random';

const draw = (seed: number, count: number) => {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => random());
};

describe('the seeded generator', () => {
  it('draws exactly what it drew before it moved here', () => {
    // Recorded from the original in src/components/landing/particleShapes.ts. The
    // placement replay (seed 5) depends on this sequence, so it must not change.
    expect(draw(5, 4)).toEqual([0.6897749109193683, 0.7727432732935995, 0.21976301027461886, 0.6231788222212344]);
    expect(draw(11, 4)).toEqual([0.5115870486479253, 0.5299464082345366, 0.6081185641232878, 0.5901576359756291]);
  });

  it('repeats itself for the same seed and differs between seeds', () => {
    expect(draw(42, 64)).toEqual(draw(42, 64));
    expect(draw(42, 64)).not.toEqual(draw(43, 64));
  });

  it('stays in [0, 1)', () => {
    for (const value of draw(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
