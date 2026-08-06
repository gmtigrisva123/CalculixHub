/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Facts about the calibrated item bank, grouped by domain.
 *
 * The landing page's skill graph used to narrate invented telemetry — a fixed
 * string per node quoting an ability estimate ("theta = +0.45") for a visitor
 * who has not answered a single question, and a difficulty ("b = 1.80") that
 * matched no item in the bank. Nothing on that panel could be traced back to
 * anything the platform actually holds.
 *
 * Everything here is derived from `ITEM_BANK` at call time, so the numbers the
 * page shows are the numbers the placement test will administer. Add an item
 * and the graph updates; there is no second copy to keep in sync.
 *
 * These are properties of the *bank*, not of a learner. A visitor's ability is
 * unknown until they take the test, and this module deliberately offers no way
 * to imply otherwise.
 */

import { ITEM_BANK } from './itemBank';
import type { Domain, IRTItem, ItemSource } from './irt';

/** Presentation order for the four domains, mirrored by the hero graph. */
export const DOMAIN_ORDER: readonly Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

/**
 * Competition sources from least to most demanding.
 *
 * Sorting by this rather than by first appearance keeps "AMC 8 -> IMO" reading
 * as a difficulty ladder no matter what order items were added to the bank in.
 */
const SOURCE_ORDER: readonly ItemSource[] = ['AMC 8', 'AMC 10', 'AIME', 'USAMO', 'IMO'];

/** What the bank contains for one domain. Every field is measured, none assumed. */
export interface DomainBankProfile {
  domain: Domain;
  /** Calibrated items available to the adaptive test for this domain. */
  itemCount: number;
  /** Difficulty span on the theta scale: the lowest and highest `b` present. */
  easiestB: number;
  hardestB: number;
  /** Mean discrimination (`a`) — how sharply these items separate ability. */
  meanDiscrimination: number;
  /** Distinct sources, ordered by the ladder above. */
  sources: ItemSource[];
  /** Distinct `concept` tags, which is what remediation dispatches on. */
  conceptCount: number;
  /** The concept carried by the hardest item, i.e. where the domain tops out. */
  hardestConcept: string;
}

/**
 * Profile for one domain, or `null` when the bank holds no items for it.
 *
 * Null rather than a zeroed record on purpose: a caller that renders a
 * difficulty range of `0 … 0` is publishing a measurement that was never taken.
 * Absent data has to stay visibly absent.
 */
export function domainBankProfile(domain: Domain, items: readonly IRTItem[] = ITEM_BANK): DomainBankProfile | null {
  const owned = items.filter((item) => item.domain === domain);
  if (owned.length === 0) return null;

  let easiestB = owned[0]!.b;
  let hardestB = owned[0]!.b;
  let hardestConcept = owned[0]!.concept;
  let discriminationTotal = 0;
  const sources = new Set<ItemSource>();
  const concepts = new Set<string>();

  for (const item of owned) {
    if (item.b < easiestB) easiestB = item.b;
    if (item.b > hardestB) {
      hardestB = item.b;
      hardestConcept = item.concept;
    }
    discriminationTotal += item.a;
    sources.add(item.source);
    concepts.add(item.concept);
  }

  return {
    domain,
    itemCount: owned.length,
    easiestB,
    hardestB,
    meanDiscrimination: discriminationTotal / owned.length,
    sources: SOURCE_ORDER.filter((source) => sources.has(source)),
    conceptCount: concepts.size,
    hardestConcept,
  };
}

/** Every domain that has items, in `DOMAIN_ORDER`. */
export function domainBankProfiles(items: readonly IRTItem[] = ITEM_BANK): DomainBankProfile[] {
  return DOMAIN_ORDER
    .map((domain) => domainBankProfile(domain, items))
    .filter((profile): profile is DomainBankProfile => profile !== null);
}

/** Bank-wide totals, for the figures the landing page quotes outside the graph. */
export interface BankSummary {
  itemCount: number;
  domainCount: number;
  conceptCount: number;
  sources: ItemSource[];
}

export function bankSummary(items: readonly IRTItem[] = ITEM_BANK): BankSummary {
  const domains = new Set<Domain>();
  const concepts = new Set<string>();
  const sources = new Set<ItemSource>();

  for (const item of items) {
    domains.add(item.domain);
    concepts.add(item.concept);
    sources.add(item.source);
  }

  return {
    itemCount: items.length,
    domainCount: domains.size,
    conceptCount: concepts.size,
    sources: SOURCE_ORDER.filter((source) => sources.has(source)),
  };
}

/**
 * Signed difficulty, e.g. `+2.1` / `-1.8`.
 *
 * The sign is always shown because `b` is a two-sided scale centred on the
 * population mean; "2.1" and "-2.1" describe opposite ends of the bank, and an
 * unsigned label loses exactly the half of the information that matters.
 */
export function formatDifficulty(b: number): string {
  return `${b >= 0 ? '+' : '−'}${Math.abs(b).toFixed(1)}`;
}
