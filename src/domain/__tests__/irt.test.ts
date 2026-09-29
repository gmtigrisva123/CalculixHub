import { describe, expect, it } from 'vitest';
import { estimateAbility, evaluatePlacement, selectNextItem, tierForTheta, recommendedSource, type ResponseRecord, type IRTItem } from '../irt';
import { ITEM_BANK } from '../itemBank';

describe('adaptive placement', () => {
  it.each([true, false])('terminates an extreme response path without repeating items (%s)', correct => {
    const responses: ResponseRecord[] = [];
    let decision = evaluatePlacement(responses, ITEM_BANK);
    while (!decision.stop) {
      const item = selectNextItem(ITEM_BANK, responses, estimateAbility(responses).theta);
      expect(item).not.toBeNull();
      expect(responses.some(r => r.item.id === item!.id)).toBe(false);
      responses.push({ item: item!, correct, latencySec: 10 });
      decision = evaluatePlacement(responses, ITEM_BANK);
    }
    expect(responses.length).toBeLessThan(ITEM_BANK.length);
    expect(Number.isFinite(estimateAbility(responses).theta)).toBe(true);
    for (const domain of new Set(ITEM_BANK.map(item => item.domain))) {
      expect(responses.filter(r => r.item.domain === domain).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('does not terminate simply because sixteen answers have been submitted', () => {
    const bank: IRTItem[] = Array.from({ length: 80 }, (_, i) => ({ ...ITEM_BANK[0], id: `boundary-${i}`, domain: ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'][i % 4] as IRTItem['domain'], a: 0.5, b: -0.4, c: 0 }));
    const responses = bank.slice(0, 16).map((item, i) => ({ item, correct: i % 2 === 0, latencySec: 10 }));
    expect(evaluatePlacement(responses, bank).stop).toBe(false);
  });
  it('keeps a finite posterior for long response histories', () => {
    const responses = Array.from({ length: 2000 }, (_, i) => ({ item: ITEM_BANK[i % ITEM_BANK.length], correct: i % 2 === 0, latencySec: 10 }));
    const estimate = estimateAbility(responses);
    expect(Number.isFinite(estimate.theta)).toBe(true);
    expect(estimate.sem).toBeGreaterThan(0);
    expect(estimate.sem).toBeLessThan(1);
  });
  it('reports bank exhaustion honestly', () => {
    const responses = ITEM_BANK.map(item => ({ item, correct: true, latencySec: 10 }));
    expect(evaluatePlacement(responses, ITEM_BANK).reason).toBe('bank-exhausted');
  });
});


describe('placement path classification', () => {
  it.each([
    [-0.81, 'Foundation', 'AMC 8'],
    [-0.8, 'Intermediate', 'AMC 10'],
    [0, 'Intermediate', 'AMC 10'],
    [0.39, 'Intermediate', 'AMC 10'],
    [0.4, 'Advanced', 'AIME'],
    [1.19, 'Advanced', 'AIME'],
    [1.2, 'Olympiad', 'USAMO'],
    [2, 'Olympiad', 'IMO'],
  ] as const)('classifies theta %s consistently with its matched contest', (theta, tier, source) => {
    expect(tierForTheta(theta)).toBe(tier);
    expect(recommendedSource(theta)).toBe(source);
  });
});
