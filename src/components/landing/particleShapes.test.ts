import { describe, expect, it } from 'vitest';
import {
  MODULAR_CHORDS, MODULAR_RADIUS, MOBIUS, geodesicForm, icosahedronEdges, icosahedronVertices, mobiusLayout,
  mobiusPoint, modularForm, modularPoint, saddleForm, tesseractEdges, tesseractForm, tesseractVertices, worldForms,
} from './particleShapes';

const COUNT = 4321;

function finite(values: Float32Array) {
  return values.every(Number.isFinite);
}

describe('landing particle forms', () => {
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

  it('builds the icosahedron and the 4-cube with their true edge counts', () => {
    expect(icosahedronVertices()).toHaveLength(12);
    expect(icosahedronEdges()).toHaveLength(30);
    expect(tesseractVertices()).toHaveLength(16);
    const edges = tesseractEdges();
    expect(edges).toHaveLength(32);
    // Every edge of Q4 joins two subsets of {1,2,3,4} that differ by one element.
    for (const [a, b] of edges) expect((a ^ b).toString(2).replace(/0/g, '')).toBe('1');
  });

  it('fills every world form completely, with finite points inside the stage', () => {
    for (const form of worldForms(COUNT)) {
      expect(form.points).toHaveLength(COUNT * 4);
      expect(form.sizes).toHaveLength(COUNT);
      expect(finite(form.points)).toBe(true);
      expect(finite(form.sizes)).toBe(true);
      for (let i = 0; i < COUNT; i += 1) {
        const x = form.points[i * 4];
        const y = form.points[i * 4 + 1];
        const z = form.points[i * 4 + 2];
        const w = form.points[i * 4 + 3];
        expect(Math.hypot(x, y, z, w)).toBeLessThan(2.6);
        expect(form.sizes[i]).toBeGreaterThan(0);
        expect(form.tones[i]).toBeGreaterThanOrEqual(0);
        expect(form.tones[i]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('puts the saddle on z = Re((x + iy)^3)', () => {
    const form = saddleForm(900);
    for (let i = 0; i < 900; i += 1) {
      const x = form.points[i * 4] / 2.15;
      const z = form.points[i * 4 + 2] / 2.15;
      const height = form.points[i * 4 + 1] / 1.05;
      expect(height).toBeCloseTo(x * x * x - 3 * x * z * z, 5);
    }
  });

  it('keeps the geodesic sphere on its sphere and the 4-cube on its edges', () => {
    const sphere = geodesicForm(2000);
    for (let i = 0; i < 2000; i += 1) {
      const r = Math.hypot(sphere.points[i * 4], sphere.points[i * 4 + 1], sphere.points[i * 4 + 2]);
      expect(r).toBeGreaterThan(1.9);
      expect(r).toBeLessThan(2.2);
    }
    const cube = tesseractForm(2000);
    for (let i = 0; i < 2000; i += 1) {
      // On an edge of the 4-cube at most one coordinate is strictly between the corners.
      const inner = [0, 1, 2, 3].filter(axis => Math.abs(Math.abs(cube.points[i * 4 + axis]) - 0.92) > 0.05).length;
      expect(inner).toBeLessThanOrEqual(1);
    }
  });

  it('draws the times table: chord k runs from k to m·k around the circle', () => {
    const k = 37;
    const [x0, , z0] = modularPoint(k, 0, 2);
    const [x1, , z1] = modularPoint(k, 1, 2);
    expect(Math.atan2(z0, x0)).toBeCloseTo(Math.atan2(Math.sin((2 * Math.PI * k) / MODULAR_CHORDS), Math.cos((2 * Math.PI * k) / MODULAR_CHORDS)), 9);
    expect(Math.atan2(z1, x1)).toBeCloseTo(Math.atan2(Math.sin((2 * Math.PI * 2 * k) / MODULAR_CHORDS), Math.cos((2 * Math.PI * 2 * k) / MODULAR_CHORDS)), 9);
    // Both ends sit on the circle; reducing m·k mod n changes nothing.
    expect(Math.hypot(x0, z0)).toBeCloseTo(MODULAR_RADIUS, 9);
    expect(Math.hypot(x1, z1)).toBeCloseTo(MODULAR_RADIUS, 9);
    const [xw, , zw] = modularPoint(200, 1, 2);
    const [xr, , zr] = modularPoint((200 * 2) % MODULAR_CHORDS, 0, 2);
    expect(xw).toBeCloseTo(xr, 9);
    expect(zw).toBeCloseTo(zr, 9);

    const form = modularForm(3000);
    for (let i = 0; i < 3000; i += 1) {
      const chord = form.points[i * 4] * MODULAR_CHORDS;
      expect(Math.abs(chord - Math.round(chord))).toBeLessThan(1e-3);
      expect(form.points[i * 4 + 1]).toBeGreaterThanOrEqual(0);
      expect(form.points[i * 4 + 1]).toBeLessThanOrEqual(1);
    }
  });
});
