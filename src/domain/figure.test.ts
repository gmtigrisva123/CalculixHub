/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { figureFor, hashSeed } from './figure';

type Point = [number, number];

const points = (path: string): Point[] => {
  const values = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out: Point[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) out.push([values[index]!, values[index + 1]!]);
  return out;
};

const uuid = (index: number) => {
  const hex = (hashSeed(`uuid-${index}`).toString(16) + hashSeed(`more-${index}`).toString(16) + hashSeed(`rest-${index}`).toString(16) + hashSeed(`tail-${index}`).toString(16)).padEnd(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

describe('a learner’s figure', () => {
  it('is the same curve every time it is asked for, however many others were drawn since', () => {
    const id = '0b8f6a52-3c2d-4e1f-9a7b-1234567890ab';
    const first = figureFor(id);
    for (let index = 0; index < 500; index++) figureFor(`someone-else-${index}`);

    expect(figureFor(id)).toEqual(first);
    expect(hashSeed('')).toBe(0xab3e7c0b);
    expect(hashSeed('a')).toBe(0x1a80b1b3);
  });

  it('is a closed path of numbers drawn inside its box, whatever the id', () => {
    const seeds = ['', 'a', 'x'.repeat(500), '🙂 learner', ...Array.from({ length: 1500 }, (_, index) => uuid(index))];
    for (const seed of seeds) {
      const { path, ground, ink, name, phrase } = figureFor(seed);
      // Nothing but coordinates can reach the `d` attribute.
      expect(path).toMatch(/^M\d+\.\d \d+\.\d(L\d+\.\d \d+\.\d)+Z$/);
      const values = points(path).flat();
      expect(Math.min(...values)).toBeGreaterThanOrEqual(8);
      expect(Math.max(...values)).toBeLessThanOrEqual(92);
      // Small enough to draw fifty of on one page.
      expect(path.length).toBeLessThan(3200);
      expect(ground).toMatch(/^#[0-9a-f]{6}$/);
      expect(ink).toMatch(/^#[0-9a-f]{6}$/);
      expect(name.length).toBeGreaterThan(0);
      expect(phrase).toMatch(/^(a|the) /);
    }
  });

  it('draws every curve as a curve, and every star with all its points', () => {
    const byName = new Map<string, Point[]>();
    for (let index = 0; index < 4000; index++) {
      const figure = figureFor(uuid(index));
      byName.set(figure.name, points(figure.path));
    }

    for (const [name, path] of byName) {
      const star = /^Star polygon \{(\d+)\/(\d+)\}$/.exec(name);
      if (star) {
        expect(path).toHaveLength(Number(star[1]));
        expect(new Set(path.map(([x, y]) => `${x},${y}`)).size).toBe(Number(star[1]));
        continue;
      }
      // No flat sides: a rose drawn from too few points is a polygon.
      let longest = 0;
      for (let index = 0; index < path.length; index++) {
        const [ax, ay] = path[index]!;
        const [bx, by] = path[(index + 1) % path.length]!;
        longest = Math.max(longest, Math.hypot(ax - bx, ay - by));
      }
      expect(longest, name).toBeLessThan(6.5);
      // Not drawn out and back along one arc.
      if (name.startsWith('Lissajous')) expect(new Set(path.map(([x, y]) => `${x},${y}`)).size, name).toBeGreaterThan(path.length * 0.95);
    }
  });

  it('draws from all four families and all eight grounds, independently', () => {
    const families = new Map<string, number>();
    const grounds = new Map<string, number>();
    const looks = new Set<string>();
    const total = 4000;
    for (let index = 0; index < total; index++) {
      const figure = figureFor(uuid(index));
      const family = figure.name.split(/[ ,{]/)[0]!;
      families.set(family, (families.get(family) ?? 0) + 1);
      grounds.set(figure.ground, (grounds.get(figure.ground) ?? 0) + 1);
      looks.add(`${figure.name}|${figure.ground}`);
    }

    expect([...families.keys()].sort()).toEqual(['Hypotrochoid', 'Lissajous', 'Rose', 'Star']);
    expect(grounds.size).toBe(8);
    for (const count of families.values()) expect(count / (total / 4)).toBeGreaterThan(0.8);
    for (const count of grounds.values()) expect(count / (total / 8)).toBeGreaterThan(0.75);
    // A hash whose low bits follow its input ties shape to ground and leaves a
    // few dozen looks. Drawn independently there are well over two hundred.
    expect(looks.size).toBeGreaterThan(200);
  });
});
