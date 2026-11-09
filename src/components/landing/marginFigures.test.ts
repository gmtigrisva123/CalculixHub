import { describe, expect, it } from 'vitest';
import { FIGURE_NAMES, FIGURE_POINTS, figure } from './marginFigures';

describe('margin figures', () => {
  it('builds every figure with the same number of points, so any one can morph into any other', () => {
    for (const name of FIGURE_NAMES) expect(figure(name).length).toBe(FIGURE_POINTS * 3);
  });

  it('fits every figure inside the unit sphere, with no point lost to NaN', () => {
    for (const name of FIGURE_NAMES) {
      const f = figure(name);
      let reach = 0;
      for (let i = 0; i < FIGURE_POINTS; i += 1) {
        const r = Math.hypot(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
        expect(Number.isFinite(r)).toBe(true);
        reach = Math.max(reach, r);
      }
      expect(reach).toBeLessThan(1.05);
      expect(reach).toBeGreaterThan(0.9);
    }
  });

  it('builds a figure once and hands back the same one after', () => {
    expect(figure('torus')).toBe(figure('torus'));
  });
});
