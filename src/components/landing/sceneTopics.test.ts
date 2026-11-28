import { describe, expect, it } from 'vitest';
import { ExtrudeGeometry, ShapeUtils } from 'three';
import {
  glyphShapes, proudScale, puffEnvelope, ringDrawn, ringReaches, roomEntrance, shudder, swirlEnvelope, swirlPour,
} from './sceneTopics';
import { TOPIC_ROOMS, ringPath } from './topicRooms';

describe('the chalk glyphs', () => {
  it('draws each room’s symbol as a closed outline of sensible size', () => {
    for (const room of TOPIC_ROOMS) {
      const shapes = glyphShapes(room.symbol);
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        const points = shape.getPoints(12);
        expect(points.length).toBeGreaterThan(2);
        for (const point of points) {
          expect(point.x).toBeGreaterThanOrEqual(-0.01);
          expect(point.x).toBeLessThanOrEqual(1.2);
          expect(point.y).toBeGreaterThanOrEqual(-0.01);
          expect(point.y).toBeLessThanOrEqual(1.01);
        }
        expect(Math.abs(ShapeUtils.area(points))).toBeGreaterThan(0.01);
      }
    }
  });

  it('builds each glyph the way its symbol is made: a triangle with its middle cut out, a bar and a dot, three bars', () => {
    expect(glyphShapes('△')[0].holes).toHaveLength(1);
    expect(glyphShapes('!')).toHaveLength(2);
    expect(glyphShapes('≡')).toHaveLength(3);
    expect(glyphShapes('∑')).toHaveLength(1);
  });

  it('extrudes into bevelled solids', () => {
    const geometry = new ExtrudeGeometry(glyphShapes('∑'), { depth: 0.24, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.04, bevelSegments: 4 });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z - box.min.z).toBeCloseTo(0.24 + 0.11, 2);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(100);
    geometry.dispose();
  });
});

describe('the ring a room draws round its symbol', () => {
  it('runs a touch past where it began, a little wider than tall', () => {
    const points = ringPath(96);
    expect(points).toHaveLength(96);
    const [sx, sy] = points[0];
    const [ex, ey] = points[95];
    // It ends near its start but not on it: the join overlaps, as a ring drawn by hand does.
    expect(Math.hypot(ex - sx, ey - sy)).toBeGreaterThan(0.05);
    expect(Math.hypot(ex - sx, ey - sy)).toBeLessThan(0.8);
    const width = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    const height = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));
    expect(width).toBeGreaterThan(height);
  });

  it('is drawn on a curve that can be turned back into time', () => {
    expect(ringDrawn(0)).toBe(0);
    expect(ringDrawn(0.95)).toBe(1);
    for (const share of [0.1, 0.4, 0.8, 0.95]) expect(ringDrawn(ringReaches(share))).toBeCloseTo(share, 3);
  });
});

describe('a room’s answers, in time', () => {
  it('shudders and is still again within a second and a half', () => {
    expect(shudder(0)).toBe(0);
    let biggest = 0;
    for (let t = 0; t < 1.4; t += 0.01) biggest = Math.max(biggest, Math.abs(shudder(t)));
    expect(biggest).toBeGreaterThan(0.15);
    expect(biggest).toBeLessThanOrEqual(0.32);
    expect(Math.abs(shudder(1.2))).toBeLessThan(0.01);
    expect(shudder(2)).toBe(0);
  });

  it('puffs quickly and lets the dust fall back', () => {
    expect(puffEnvelope(0)).toBe(0);
    expect(puffEnvelope(0.08)).toBeGreaterThan(0.95);
    expect(puffEnvelope(1.5)).toBeLessThan(0.1);
    expect(puffEnvelope(3)).toBe(0);
  });

  it('swirls at the glyph, pours into the slip, then lets go', () => {
    expect(swirlEnvelope(0)).toBe(0);
    expect(swirlEnvelope(1)).toBe(1);
    expect(swirlEnvelope(3.5)).toBe(0);
    expect(swirlPour(0.5)).toBe(0);
    expect(swirlPour(2)).toBe(1);
  });

  it('lifts the glyph a moment and sets it back', () => {
    expect(proudScale(0)).toBe(1);
    expect(Math.max(...[0.1, 0.2, 0.3].map(proudScale))).toBeGreaterThan(1.03);
    expect(proudScale(2)).toBe(1);
  });

  it('brings a glyph in with its card: faded in, risen into place', () => {
    expect(roomEntrance(-1)).toEqual({ presence: 0, rise: 44 });
    expect(roomEntrance(0).rise).toBeCloseTo(44);
    const settled = roomEntrance(2);
    expect(settled.presence).toBe(1);
    expect(Math.abs(settled.rise)).toBeLessThan(1);
  });
});
