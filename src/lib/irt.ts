/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Computerized Adaptive Testing (CAT) engine built on the 3-Parameter Logistic
 * (3PL) Item Response Theory model.
 *
 * This replaces the earlier 1PL/Rasch stochastic-approximation approach with the
 * estimator used by real standardized adaptive tests:
 *
 *   - 3PL response model with discrimination (a), difficulty (b), guessing (c)
 *   - EAP (Expected A Posteriori) ability estimation via Gauss-Hermite style
 *     quadrature over a normal prior — stable from the very first response and
 *     immune to the divergence that plagues MLE on all-correct/all-wrong patterns
 *   - Maximum Fisher Information item selection (the information-optimal next item)
 *   - Test information -> standard error of measurement (SEM)
 *   - Content-balanced selection across the four mathematical domains
 *   - Variable-length test with an SEM-based stopping rule
 */

export type Domain = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';

/** Competition sources, mirroring the tiering in the blueprint. */
export type ItemSource = 'AMC 8' | 'AMC 10' | 'AIME' | 'USAMO' | 'IMO';

export interface IRTItem {
  id: string;
  domain: Domain;
  source: ItemSource;
  question: string;
  options: string[];
  correctIdx: number;
  /** Discrimination — how sharply the item separates ability near b. Typical 0.5–2.5. */
  a: number;
  /** Difficulty — ability level at the item's inflection point. Typical -3–+3. */
  b: number;
  /** Pseudo-guessing — lower asymptote. ~1/nOptions for multiple choice. */
  c: number;
  hint: string;
  /** Concept tag used for weak-point isolation and remediation dispatch. */
  concept: string;
}

export interface ResponseRecord {
  item: IRTItem;
  correct: boolean;
  /** Seconds spent on the item, used for speed/efficiency analytics. */
  latencySec: number;
}

// --- Quadrature grid over the ability scale -------------------------------

const THETA_MIN = -4;
const THETA_MAX = 4;
const QUAD_POINTS = 81;

const QUAD_NODES: number[] = Array.from(
  { length: QUAD_POINTS },
  (_, i) => THETA_MIN + ((THETA_MAX - THETA_MIN) * i) / (QUAD_POINTS - 1),
);

/** Standard normal prior N(0, 1) over the ability scale. */
const QUAD_PRIOR: number[] = QUAD_NODES.map((t) => Math.exp(-(t * t) / 2));

// --- Core 3PL model -------------------------------------------------------

/** P(correct | theta) under the 3PL model. */
export function probCorrect(theta: number, item: Pick<IRTItem, 'a' | 'b' | 'c'>): number {
  const logistic = 1 / (1 + Math.exp(-1.7 * item.a * (theta - item.b)));
  return item.c + (1 - item.c) * logistic;
}

/**
 * Fisher information for a 3PL item at a given ability.
 * I(theta) = (1.7a)^2 * (1-P)/P * ((P-c)/(1-c))^2
 * Higher information => more precision gained by administering this item.
 */
export function itemInformation(theta: number, item: Pick<IRTItem, 'a' | 'b' | 'c'>): number {
  const p = probCorrect(theta, item);
  if (p <= 0 || p >= 1) return 0;
  const q = 1 - p;
  const num = (p - item.c) / (1 - item.c);
  return Math.pow(1.7 * item.a, 2) * (q / p) * num * num;
}

// --- Ability estimation ---------------------------------------------------

export interface AbilityEstimate {
  theta: number;
  sem: number;
}

/**
 * EAP ability estimate: the mean of the posterior distribution formed by
 * multiplying the normal prior with the likelihood of the observed responses.
 * SEM is the posterior standard deviation.
 */
export function estimateAbility(responses: ResponseRecord[]): AbilityEstimate {
  const posterior = QUAD_NODES.map((theta, i) => {
    let likelihood = QUAD_PRIOR[i];
    for (const r of responses) {
      const p = probCorrect(theta, r.item);
      likelihood *= r.correct ? p : 1 - p;
    }
    return likelihood;
  });

  const total = posterior.reduce((s, v) => s + v, 0);
  if (total <= 0 || !Number.isFinite(total)) return { theta: 0, sem: 1 };

  let mean = 0;
  for (let i = 0; i < QUAD_NODES.length; i++) mean += QUAD_NODES[i] * (posterior[i] / total);

  let variance = 0;
  for (let i = 0; i < QUAD_NODES.length; i++) {
    const d = QUAD_NODES[i] - mean;
    variance += d * d * (posterior[i] / total);
  }

  return { theta: mean, sem: Math.sqrt(Math.max(variance, 1e-6)) };
}

/** Ability restricted to a single domain, for the per-domain skill profile. */
export function estimateDomainAbility(responses: ResponseRecord[], domain: Domain): AbilityEstimate | null {
  const subset = responses.filter((r) => r.item.domain === domain);
  if (subset.length === 0) return null;
  return estimateAbility(subset);
}

// --- Adaptive item selection ---------------------------------------------

/**
 * Picks the next item by Maximum Fisher Information, with content balancing:
 * domains that have been tested least are prioritized so the final profile
 * covers all four areas rather than drilling into whichever domain happens
 * to be most informative.
 */
export function selectNextItem(
  bank: IRTItem[],
  responses: ResponseRecord[],
  theta: number,
): IRTItem | null {
  const usedIds = new Set(responses.map((r) => r.item.id));
  const available = bank.filter((it) => !usedIds.has(it.id));
  if (available.length === 0) return null;

  // Content balancing: find the least-tested domain(s) so far.
  const domainCounts = new Map<Domain, number>();
  for (const r of responses) {
    domainCounts.set(r.item.domain, (domainCounts.get(r.item.domain) || 0) + 1);
  }
  const allDomains: Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
  const minCount = Math.min(...allDomains.map((d) => domainCounts.get(d) || 0));
  const underTested = allDomains.filter((d) => (domainCounts.get(d) || 0) === minCount);

  const pool = available.filter((it) => underTested.includes(it.domain));
  const candidates = pool.length > 0 ? pool : available;

  let best = candidates[0];
  let bestInfo = itemInformation(theta, best);
  for (const item of candidates) {
    const info = itemInformation(theta, item);
    if (info > bestInfo) {
      bestInfo = info;
      best = item;
    }
  }
  return best;
}

// --- Test administration rules -------------------------------------------

export const MIN_ITEMS = 8;
export const MAX_ITEMS = 16;
export const TARGET_SEM = 0.32;

/** Stop once the estimate is precise enough, or the item cap is reached. */
export function shouldStop(responses: ResponseRecord[], sem: number): boolean {
  if (responses.length >= MAX_ITEMS) return true;
  if (responses.length < MIN_ITEMS) return false;
  return sem <= TARGET_SEM;
}

/** Reliability (analogous to Cronbach's alpha) implied by the current SEM. */
export function reliability(sem: number): number {
  return Math.max(0, Math.min(1, 1 - sem * sem));
}

// --- Score reporting ------------------------------------------------------

export type Tier = 'Foundation' | 'Advanced' | 'Olympiad';

/** Maps a latent ability estimate onto the platform's three content tiers. */
export function tierForTheta(theta: number): Tier {
  if (theta >= 1.2) return 'Olympiad';
  if (theta >= -0.4) return 'Advanced';
  return 'Foundation';
}

/**
 * Converts theta to a normalized 0–100 mastery percentage, used to seed the
 * learner's initial skill radar.
 */
export function thetaToMastery(theta: number): number {
  return Math.round(Math.max(0, Math.min(100, ((theta + 3) / 6) * 100)));
}

/** Percentile standing against the assumed N(0,1) population. */
export function thetaToPercentile(theta: number): number {
  // Abramowitz & Stegun normal CDF approximation.
  const z = theta;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  p = z > 0 ? 1 - p : p;
  return Math.round(Math.max(1, Math.min(99, p * 100)));
}

/** The competition tier whose items best match this ability level. */
export function recommendedSource(theta: number): ItemSource {
  if (theta >= 2.0) return 'IMO';
  if (theta >= 1.2) return 'USAMO';
  if (theta >= 0.4) return 'AIME';
  if (theta >= -0.8) return 'AMC 10';
  return 'AMC 8';
}
