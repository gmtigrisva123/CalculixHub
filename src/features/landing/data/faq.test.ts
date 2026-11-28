import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLANS, dollars } from '../../../../shared/plans';
import { FAQS } from './faq';

const PRICE_QUESTION = 'What does Pro add, and what does it cost?';

describe('the landing page FAQ', () => {
  afterEach(() => {
    vi.doUnmock('../../../../shared/plans');
    vi.resetModules();
  });

  it('holds the eight approved questions, each once', () => {
    expect(FAQS).toHaveLength(8);
    expect(new Set(FAQS.map(([question]) => question)).size).toBe(8);
    for (const [question, answer] of FAQS) {
      expect(question.trim()).not.toBe('');
      expect(answer.trim()).not.toBe('');
    }
  });

  it('quotes the Pro price from PLANS', () => {
    const answer = FAQS.find(([question]) => question === PRICE_QUESTION)?.[1];
    expect(answer).toContain(`${dollars(PLANS.pro.price.monthly)} a month`);
    expect(answer).toContain(`${dollars(PLANS.pro.price.yearly)} a year`);
  });

  it('follows PLANS when the price changes, rather than holding a copy of it', async () => {
    vi.resetModules();
    vi.doMock('../../../../shared/plans', async importOriginal => {
      const actual = await importOriginal<typeof import('../../../../shared/plans')>();
      return { ...actual, PLANS: { ...actual.PLANS, pro: { ...actual.PLANS.pro, price: { monthly: 1234, yearly: 9900 } } } };
    });
    const { FAQS: repriced } = await import('./faq');
    const answer = repriced.find(([question]) => question === PRICE_QUESTION)?.[1];
    expect(answer).toContain(`${dollars(1234)} a month`);
    expect(answer).toContain(`${dollars(9900)} a year`);
  });
});
