/**
 * The landing page's structured data (SPEC §15.4), in schema.org's vocabulary.
 *
 * Written into the head of dist/index.html at build time, as JSON-LD data
 * blocks (scripts/landing-static-plugin.mjs), from the same sources as the page
 * itself: the offers from shared/plans.ts and the FAQ from copy.ts, so the data
 * cannot quote a price or an answer the page does not. Nothing in it is a claim
 * the page cannot stand behind: no ratings, no reviews, no user counts.
 *
 * Google has shown FAQ rich results only for well-known government and health
 * sites since August 2023, so the FAQPage is semantic data with no rich result
 * expected (§18 Q8).
 */

import { PLANS, PLAN_ORDER, TEAM_MIN_SEATS, type BillingCycle, type Plan } from '../../../../shared/plans';
import { FAQ } from '../copy';

const CONTEXT = 'https://schema.org';
const NAME = 'CalculixHub';
const ORIGIN = 'https://calculixhub.com/';
const LOGO = `${ORIGIN}icons/icon-512.png`;
const CURRENCY = 'USD';

/** The page's meta description, word for word as index.html writes it. */
export const DESCRIPTION = 'Stay with the question. Contest math from AMC to IMO, with problems picked to fit your level and talked through one step at a time.';

const ORGANIZATION_ID = `${ORIGIN}#organization`;

/** ISO 8601: what one payment buys. */
const PERIOD: Record<BillingCycle, string> = { monthly: 'P1M', yearly: 'P1Y' };

/** PLANS keeps whole US cents; schema.org's prices are in the currency's units. */
const amount = (cents: number) => cents / 100;

/** One offer per way a plan can be paid for: Free once, a paid plan monthly and yearly. */
function offers(plan: Plan): object[] {
  if (plan.price.monthly === 0) {
    return [{ '@type': 'Offer', name: plan.name, price: amount(plan.price.monthly), priceCurrency: CURRENCY }];
  }
  return (['monthly', 'yearly'] as const).map(cycle => ({
    '@type': 'Offer',
    name: plan.name,
    price: amount(plan.price[cycle]),
    priceCurrency: CURRENCY,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: amount(plan.price[cycle]),
      priceCurrency: CURRENCY,
      billingDuration: PERIOD[cycle],
      // Team is priced for each student ("per student"); the other plans for one account.
      ...(plan.unit ? { unitText: plan.unit } : {}),
    },
    // Team is sold from a minimum number of seats.
    ...(plan.unit ? { eligibleQuantity: { '@type': 'QuantitativeValue', minValue: TEAM_MIN_SEATS } } : {}),
  }));
}

export function landingJsonLd(): object[] {
  return [
    {
      '@context': CONTEXT,
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: NAME,
      url: ORIGIN,
      logo: LOGO,
    },
    {
      '@context': CONTEXT,
      '@type': 'WebSite',
      name: NAME,
      url: ORIGIN,
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@context': CONTEXT,
      '@type': 'WebApplication',
      name: NAME,
      url: ORIGIN,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, iOS',
      description: DESCRIPTION,
      publisher: { '@id': ORGANIZATION_ID },
      offers: PLAN_ORDER.flatMap(id => offers(PLANS[id])),
    },
    {
      '@context': CONTEXT,
      '@type': 'FAQPage',
      mainEntity: FAQ.items.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
