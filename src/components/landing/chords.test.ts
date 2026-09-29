import { describe, expect, it } from 'vitest';
import { chordEndpoints, CHORD_RADIUS, INITIAL_CHORD_ANGLE } from './chords';
describe('intersecting chord exploration', () => {
  it('preserves the power of the point with endpoints on the circle across the drag range', () => {
    for (let angle = -25; angle <= 155; angle += 0.5) {
      const { c, d, near, far } = chordEndpoints(angle);
      expect(c.x ** 2 + c.y ** 2).toBeCloseTo(CHORD_RADIUS ** 2, 8);
      expect(d.x ** 2 + d.y ** 2).toBeCloseTo(CHORD_RADIUS ** 2, 8);
      expect(near * far).toBeCloseTo(189, 8);
    }
  });
  it('matches the exact initial problem and its three-digit answer', () => {
    const { near, far } = chordEndpoints(INITIAL_CHORD_ANGLE);
    expect(near).toBeCloseTo(7, 10);
    expect(far).toBeCloseTo(27, 10);
    expect(Math.sin(INITIAL_CHORD_ANGLE * Math.PI / 180)).toBeCloseTo(3 / 5, 10);
    expect(8 ** 2 + 6 ** 2 + 9 * 21).toBe(CHORD_RADIUS ** 2);
  });
});
