import { describe, expect, it } from 'vitest';
import { MOBIUS, mobiusLayout, mobiusPoint } from './particleShapes';

function finite(values: Float32Array) {
  return values.every(Number.isFinite);
}

describe('landing hero form', () => {
  it('closes the Möbius strip after two laps, flipping sides after one', () => {
    const [x, y, z] = mobiusPoint(0.7, 0.4);
    const [x4, y4, z4] = mobiusPoint(0.7 + 4 * Math.PI, 0.4);
    expect(x4).toBeCloseTo(x, 9);
    expect(y4).toBeCloseTo(y, 9);
    expect(z4).toBeCloseTo(z, 9);
    // One lap later the same point is the one across the strip: there is only one side.
    const [x2, y2, z2] = mobiusPoint(0.7 + 2 * Math.PI, 0.4);
    const [xs, ys, zs] = mobiusPoint(0.7, -0.4);
    expect(x2).toBeCloseTo(xs, 9);
    expect(y2).toBeCloseTo(ys, 9);
    expect(z2).toBeCloseTo(zs, 9);
  });

  it('lays rails symmetrically across the strip so the flow has no seam', () => {
    const layout = mobiusLayout(8, 50, 20);
    expect(layout.count).toBe(8 * 50 + 20);
    expect(finite(layout.params)).toBe(true);
    const offsets = new Set<number>();
    for (let i = 0; i < 8 * 50; i += 1) offsets.add(Math.round(layout.params[i * 4 + 1] * 20) / 20);
    for (const s of offsets) expect(offsets.has(Math.round(-s * 20) / 20) || Math.abs(s) < 0.05).toBe(true);
    for (let i = 0; i < 8 * 50; i += 1) expect(Math.abs(layout.params[i * 4 + 1])).toBeLessThanOrEqual(MOBIUS.halfWidth + 0.01);
    // Dust is flagged by a negative seed.
    for (let i = 8 * 50; i < layout.count; i += 1) expect(layout.params[i * 4 + 3]).toBeLessThan(0);
  });
});
