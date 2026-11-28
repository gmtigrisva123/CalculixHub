import { describe, expect, it } from 'vitest';
import { bounce } from './glEngine';

describe('a bead dropped onto the axis', () => {
  it('starts at its height, falls, and comes to rest on the axis', () => {
    expect(bounce(0, 240).y).toBe(240);
    expect(bounce(0.19, 240).y).toBeLessThan(240);
    expect(bounce(3, 240).y).toBe(0);
  });

  it('never passes through the axis, and each bounce is lower than the last', () => {
    let lowest = Infinity;
    const peaks: number[] = [];
    let rising = false;
    let previous = bounce(0, 240).y;
    for (let t = 0.001; t < 2; t += 0.001) {
      const { y } = bounce(t, 240);
      lowest = Math.min(lowest, y);
      if (y < previous && rising) peaks.push(previous);
      rising = y > previous;
      previous = y;
    }
    expect(lowest).toBeGreaterThanOrEqual(-1e-9);
    expect(peaks.length).toBeGreaterThan(0);
    for (let i = 1; i < peaks.length; i += 1) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
  });

  it('squashes on impact, and only then', () => {
    expect(bounce(0.2, 240).squash).toBe(0);
    expect(bounce(0.381, 240).squash).toBeGreaterThan(0.15);
    expect(bounce(3, 240).squash).toBeLessThan(0.01);
  });
});
