import { describe, expect, it } from 'vitest';
import { clampVertex, triangleArea, TRIANGLE } from './triangle';

describe('triangle discovery', () => {
  it('keeps the area constant across the entire permitted drag range', () => {
    const expected = (TRIANGLE.right - TRIANGLE.left) * (TRIANGLE.bottom - TRIANGLE.top) / 2;
    for (let x=TRIANGLE.minX; x<=TRIANGLE.maxX; x+=5) expect(triangleArea(x)).toBe(expected);
  });
  it('keeps the vertex reachable and handles invalid coordinates', () => {
    expect(clampVertex(-500)).toBe(TRIANGLE.minX);
    expect(clampVertex(900)).toBe(TRIANGLE.maxX);
    expect(clampVertex(Number.NaN)).toBe(TRIANGLE.initialX);
  });
});
