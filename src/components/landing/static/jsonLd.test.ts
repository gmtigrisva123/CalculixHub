import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANS, TEAM_MIN_SEATS } from '../../../../shared/plans';
import { FAQ } from '../copy';
import { DESCRIPTION, landingJsonLd } from './jsonLd';

/**
 * The structured data says what the page says and nothing more: prices from
 * PLANS, answers from copy.ts, and no claim the page cannot stand behind.
 */

type Node = Record<string, unknown>;
interface Offer extends Node {
  name: string;
  price: number;
  priceCurrency: string;
  priceSpecification?: { '@type': string; price: number; priceCurrency: string; billingDuration: string; unitText?: string };
  eligibleQuantity?: { '@type': string; minValue: number };
}

const items = landingJsonLd() as Node[];
const json = JSON.stringify(items);
const ofType = (type: string) => {
  const found = items.filter(item => item['@type'] === type);
  expect(found, `one ${type}`).toHaveLength(1);
  return found[0];
};
const dollarsOf = (cents: number) => cents / 100;

describe('the landing page\'s JSON-LD', () => {
  it('is plain JSON, every item in schema.org\'s context', () => {
    expect(JSON.parse(json)).toEqual(items);
    expect(items.map(item => item['@type'])).toEqual(['Organization', 'WebSite', 'WebApplication', 'FAQPage']);
    for (const item of items) expect(item['@context']).toBe('https://schema.org');
  });

  it('names the organisation and the site', () => {
    expect(ofType('Organization')).toMatchObject({ name: 'CalculixHub', url: 'https://calculixhub.com/', logo: 'https://calculixhub.com/icons/icon-512.png' });
    expect(ofType('WebSite')).toMatchObject({ name: 'CalculixHub', url: 'https://calculixhub.com/' });
  });

  it('describes the app in the words of the page\'s own meta description', () => {
    const app = ofType('WebApplication');
    expect(app).toMatchObject({
      name: 'CalculixHub',
      url: 'https://calculixhub.com/',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, iOS',
      description: DESCRIPTION,
    });
    const page = readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8');
    expect(page.match(/<meta name="description" content="([^"]*)"/)?.[1]).toBe(DESCRIPTION);
  });

  it('offers each plan at exactly the price in PLANS, converted from cents', () => {
    const offers = ofType('WebApplication').offers as Offer[];
    const find = (name: string, period?: string) => offers.filter(offer => offer.name === name && offer.priceSpecification?.billingDuration === period);
    expect(offers).toHaveLength(5);
    for (const offer of offers) expect(offer.priceCurrency).toBe('USD');

    const [free] = find(PLANS.free.name);
    expect(free.price).toBe(dollarsOf(PLANS.free.price.monthly));
    expect(free.price).toBe(0);

    for (const plan of [PLANS.pro, PLANS.team]) {
      for (const [period, cents] of [['P1M', plan.price.monthly], ['P1Y', plan.price.yearly]] as const) {
        const matching = find(plan.name, period);
        expect(matching, `${plan.name} ${period}`).toHaveLength(1);
        const [offer] = matching;
        expect(offer.price).toBe(dollarsOf(cents));
        expect(offer.priceSpecification).toMatchObject({ '@type': 'UnitPriceSpecification', price: dollarsOf(cents), priceCurrency: 'USD', billingDuration: period });
      }
    }
    // Team is per student, from a minimum number of seats; Pro is neither.
    for (const offer of offers.filter(item => item.name === PLANS.team.name)) {
      expect(offer.eligibleQuantity).toEqual({ '@type': 'QuantitativeValue', minValue: TEAM_MIN_SEATS });
      expect(offer.priceSpecification?.unitText).toBe(PLANS.team.unit);
    }
    for (const offer of offers.filter(item => item.name !== PLANS.team.name)) {
      expect(offer.eligibleQuantity).toBeUndefined();
      expect(offer.priceSpecification?.unitText).toBeUndefined();
    }
  });

  it('answers the eight questions of the FAQ, word for word', () => {
    const faq = ofType('FAQPage');
    expect(FAQ.items).toHaveLength(8);
    expect(faq.mainEntity).toEqual(FAQ.items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })));
  });

  it('claims nothing the page cannot stand behind: no ratings, reviews or user counts', () => {
    expect(json).not.toMatch(/"@type":"(AggregateRating|Rating|Review|InteractionCounter)"/);
    expect(json).not.toMatch(/"(aggregateRating|review|reviews|reviewRating|interactionStatistic|userInteractionCount)":/);
  });
});
