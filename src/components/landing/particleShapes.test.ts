import { describe, expect, it } from 'vitest';
import { flowLayout, lorenzPath, pathPoint } from './particleShapes';

describe('landing hero form', () => {
  it('traces the Lorenz attractor inside a bounded stage', () => {
    const path = lorenzPath(4000);
    expect(path.samples.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < path.length; i += 1) {
      expect(Math.abs(path.samples[i * 4])).toBeLessThan(2.2);
      expect(Math.abs(path.samples[i * 4 + 1])).toBeLessThan(2.4);
      expect(Math.abs(path.samples[i * 4 + 2])).toBeLessThan(2.6);
      expect(path.samples[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(path.samples[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('visits both wings, crossing between them again and again', () => {
    const path = lorenzPath(4000);
    let crossings = 0;
    for (let i = 1; i < path.length; i += 1) {
      if (Math.sign(path.samples[i * 4]) !== Math.sign(path.samples[(i - 1) * 4])) crossings += 1;
    }
    expect(crossings).toBeGreaterThan(5);
  });

  it('is deterministic, and interpolates between its samples', () => {
    const a = lorenzPath(500);
    const b = lorenzPath(500);
    expect(Array.from(a.samples)).toEqual(Array.from(b.samples));
    const [x] = pathPoint(a, 10.5);
    expect(x).toBeCloseTo((a.samples[40] + a.samples[44]) / 2, 6);
  });

  it('lays threads along the path and flags dust with a negative seed', () => {
    const layout = flowLayout(300, 40);
    expect(layout.count).toBe(340);
    expect(layout.params.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < 300; i += 1) {
      expect(layout.params[i * 4]).toBeGreaterThanOrEqual(0);
      expect(layout.params[i * 4]).toBeLessThan(1);
      expect(layout.params[i * 4 + 3]).toBeGreaterThan(0);
      const length = Math.hypot(layout.offsets[i * 3], layout.offsets[i * 3 + 1], layout.offsets[i * 3 + 2]);
      expect(length).toBeCloseTo(1, 5);
    }
    for (let i = 300; i < layout.count; i += 1) expect(layout.params[i * 4 + 3]).toBeLessThan(0);
  });
});
