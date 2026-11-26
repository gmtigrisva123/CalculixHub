/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { circleSlug } from './circles';

// The check constraint on communities.slug, as the migration writes it.
const VALID = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

describe('the address of a circle', () => {
  it('is its name in lower case with hyphens for everything else', () => {
    expect(circleSlug('Geometry Circle')).toBe('geometry-circle');
    expect(circleSlug('  AMC 10 — the crew!! ')).toBe('amc-10-the-crew');
    expect(circleSlug('Đại số & Hình học')).toBe('dai-so-hinh-hoc');
  });

  it('falls back when a name has nothing a slug can hold', () => {
    expect(circleSlug('数学')).toBe('circle');
    expect(circleSlug('a')).toBe('circle');
    expect(circleSlug('!!!')).toBe('circle');
  });

  it('always satisfies the database, with or without a suffix', () => {
    const names = ['Geometry Circle', 'x'.repeat(80), 'a-very-long-name-that-ends-exactly-on-a-hyphen- and more', '数学', 'Số học 2026', 'ab'];
    for (const name of names) {
      for (const suffix of ['', 'k3f9']) {
        const slug = circleSlug(name, suffix);
        expect(slug).toMatch(VALID);
        expect(slug.length).toBeGreaterThanOrEqual(2);
        expect(slug.length).toBeLessThanOrEqual(40);
        if (suffix) expect(slug.endsWith(`-${suffix}`)).toBe(true);
      }
    }
  });
});
