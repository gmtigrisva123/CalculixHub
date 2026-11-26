/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { figureFor, hashSeed } from './figure';

const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('a learner’s figure', () => {
  it('is the same curve every time it is asked for', () => {
    const id = '0b8f6a52-3c2d-4e1f-9a7b-1234567890ab';
    expect(figureFor(id)).toEqual(figureFor(id));
    expect(hashSeed('')).toBe(0xab3e7c0b);
    expect(hashSeed('a')).toBe(0x1a80b1b3);
  });

  it('is a closed path drawn inside its box, whatever the id', () => {
    for (let index = 0; index < 600; index++) {
      const { path, ground, ink, name, phrase } = figureFor(`learner-${index}`);
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
      const values = numbers(path);
      expect(values.length).toBeGreaterThanOrEqual(10);
      expect(values.every(Number.isFinite)).toBe(true);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(8);
      expect(Math.max(...values)).toBeLessThanOrEqual(92);
      // Small enough to draw fifty of on one page.
      expect(path.length).toBeLessThan(4000);
      expect(ground).toMatch(/^#[0-9a-f]{6}$/);
      expect(ink).toMatch(/^#[0-9a-f]{6}$/);
      expect(name.length).toBeGreaterThan(0);
      expect(phrase).toMatch(/^(a|the) /);
    }
  });

  it('draws from all four families, so a thread is not all one shape', () => {
    const families = new Set<string>();
    const figures = new Set<string>();
    for (let index = 0; index < 400; index++) {
      const figure = figureFor(`learner-${index}`);
      families.add(figure.name.split(/[ ,{]/)[0]!);
      figures.add(`${figure.name}|${figure.ground}`);
    }
    expect([...families].sort()).toEqual(['Hypotrochoid', 'Lissajous', 'Rose', 'Star']);
    // Shape and ground are drawn independently. A hash whose low bits follow its
    // input would tie the two together and leave a few dozen looks, not hundreds.
    expect(figures.size).toBeGreaterThan(150);
  });
});
