/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * These assert the properties the landing page depends on, not a snapshot of
 * today's bank: the counts move every time an item is added, and a test that
 * pins them would fail on content work rather than on a defect.
 */

import { describe, expect, it } from 'vitest';
import type { IRTItem } from '../irt';
import { ITEM_BANK } from '../itemBank';
import { bankSummary, domainBankProfile, domainBankProfiles, formatDifficulty } from '../skillGraph';

function item(overrides: Partial<IRTItem>): IRTItem {
  return {
    id: 'test-1',
    domain: 'Algebra',
    source: 'AMC 8',
    question: 'q',
    options: ['a', 'b', 'c', 'd'],
    correctIdx: 0,
    a: 1,
    b: 0,
    c: 0.25,
    hint: 'h',
    concept: 'Concept',
    ...overrides,
  };
}

describe('domainBankProfile', () => {
  it('measures the difficulty span from the items themselves', () => {
    const profile = domainBankProfile('Algebra', [
      item({ id: '1', b: -1.5 }),
      item({ id: '2', b: 2.4, concept: 'Hardest thing' }),
      item({ id: '3', b: 0.3 }),
    ]);

    expect(profile).not.toBeNull();
    expect(profile!.itemCount).toBe(3);
    expect(profile!.easiestB).toBe(-1.5);
    expect(profile!.hardestB).toBe(2.4);
    // The concept reported is the one carried by the hardest item, which is
    // what "where this domain tops out" means to a reader.
    expect(profile!.hardestConcept).toBe('Hardest thing');
  });

  it('averages discrimination across the domain', () => {
    const profile = domainBankProfile('Geometry', [
      item({ id: '1', domain: 'Geometry', a: 1.0 }),
      item({ id: '2', domain: 'Geometry', a: 2.0 }),
    ]);

    expect(profile!.meanDiscrimination).toBeCloseTo(1.5, 10);
  });

  it('ignores items belonging to other domains', () => {
    const profile = domainBankProfile('Combinatorics', [
      item({ id: '1', domain: 'Algebra', b: 9 }),
      item({ id: '2', domain: 'Combinatorics', b: 1 }),
    ]);

    expect(profile!.itemCount).toBe(1);
    expect(profile!.hardestB).toBe(1);
  });

  it('orders sources as a difficulty ladder, not by insertion', () => {
    const profile = domainBankProfile('Algebra', [
      item({ id: '1', source: 'IMO' }),
      item({ id: '2', source: 'AMC 8' }),
      item({ id: '3', source: 'AIME' }),
      item({ id: '4', source: 'AMC 8' }),
    ]);

    expect(profile!.sources).toEqual(['AMC 8', 'AIME', 'IMO']);
  });

  it('returns null for a domain with no items, rather than a zeroed range', () => {
    // A `0 … 0` difficulty span would be a measurement the bank never made.
    expect(domainBankProfile('Number Theory', [item({ domain: 'Algebra' })])).toBeNull();
  });
});

describe('domainBankProfiles', () => {
  it('covers every domain in the shipped bank', () => {
    const profiles = domainBankProfiles();

    expect(profiles.map((profile) => profile.domain)).toEqual([
      'Algebra',
      'Geometry',
      'Combinatorics',
      'Number Theory',
    ]);
    // The hero graph draws one node per profile and quotes its item count, so
    // the parts must sum to the whole for the page to be self-consistent.
    expect(profiles.reduce((total, profile) => total + profile.itemCount, 0)).toBe(ITEM_BANK.length);
  });

  it('reports a real, non-degenerate difficulty span for every domain', () => {
    for (const profile of domainBankProfiles()) {
      expect(profile.itemCount).toBeGreaterThan(0);
      expect(profile.hardestB).toBeGreaterThan(profile.easiestB);
      expect(profile.hardestConcept.length).toBeGreaterThan(0);
    }
  });
});

describe('bankSummary', () => {
  it('counts distinct domains, concepts and sources', () => {
    const summary = bankSummary([
      item({ id: '1', domain: 'Algebra', concept: 'X', source: 'AIME' }),
      item({ id: '2', domain: 'Algebra', concept: 'X', source: 'AMC 8' }),
      item({ id: '3', domain: 'Geometry', concept: 'Y', source: 'AIME' }),
    ]);

    expect(summary).toEqual({
      itemCount: 3,
      domainCount: 2,
      conceptCount: 2,
      sources: ['AMC 8', 'AIME'],
    });
  });

  it('describes the shipped bank', () => {
    const summary = bankSummary();

    expect(summary.itemCount).toBe(ITEM_BANK.length);
    expect(summary.domainCount).toBe(4);
    expect(summary.conceptCount).toBeGreaterThan(0);
    expect(summary.sources.length).toBeGreaterThan(0);
  });
});

describe('formatDifficulty', () => {
  it('always carries a sign, because b is a two-sided scale', () => {
    expect(formatDifficulty(2.14)).toBe('+2.1');
    expect(formatDifficulty(-1.84)).toBe('−1.8');
    expect(formatDifficulty(0)).toBe('+0.0');
  });
});
