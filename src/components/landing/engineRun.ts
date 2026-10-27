/**
 * One adaptive placement, run by the real engine against the real item bank,
 * for the landing page to replay as the reader scrolls.
 *
 * Nothing in the "Watch it find your level" section is animated by hand. A
 * simulated learner of known ability answers whatever `selectNextItem` hands
 * them, correct with exactly the probability the 3PL model gives; the estimate,
 * the margin of error and the stopping decision are the engine's own, and the
 * curve on screen is `posteriorCurve` at each step. If the item bank or the
 * selection rule changes, the story on the landing page changes with it.
 *
 * The run is computed once, at import, and is deterministic: a seeded
 * generator decides each answer, so every visitor watches the same placement.
 */

import { ITEM_BANK } from '../../domain/itemBank';
import {
  estimateAbility,
  evaluatePlacement,
  posteriorCurve,
  probCorrect,
  recommendedSource,
  selectNextItem,
  TARGET_SEM,
  tierForTheta,
  type IRTItem,
  type ItemSource,
  type PlacementDecision,
  type ResponseRecord,
  type Tier,
} from '../../domain/irt';
import { mulberry32 } from './particleShapes';

export interface EngineStep {
  /** The item answered to reach this step; null for the prior. */
  item: IRTItem | null;
  correct: boolean | null;
  theta: number;
  sem: number;
  /** Posterior weights on the engine's quadrature grid. */
  weights: number[];
  tier: Tier;
}

export interface EngineRun {
  learnerTheta: number;
  /** The quadrature nodes the weights are given on. */
  grid: number[];
  /** steps[0] is the prior; steps[k] follows the k-th answer. */
  steps: EngineStep[];
  decision: PlacementDecision;
  tier: Tier;
  source: ItemSource;
  /** The tallest posterior weight across the run, so the chart keeps one vertical scale. */
  peak: number;
}

/**
 * The learner the landing page follows. Chosen so the replay shows both kinds
 * of evidence — right answers that lift the estimate and misses that pull it
 * back — and ends the way most placements should, on precision.
 */
export const SIMULATED_LEARNER = { theta: 1.1, seed: 5, maxItems: 18 } as const;

export function simulatePlacement(
  learner: { theta: number; seed: number; maxItems: number } = SIMULATED_LEARNER,
  bank: IRTItem[] = ITEM_BANK,
): EngineRun {
  const random = mulberry32(learner.seed);
  const responses: ResponseRecord[] = [];
  const snapshot = (item: IRTItem | null, correct: boolean | null): EngineStep => {
    const { theta, sem } = estimateAbility(responses);
    return { item, correct, theta, sem, weights: posteriorCurve(responses).weight, tier: tierForTheta(theta) };
  };

  const steps: EngineStep[] = [snapshot(null, null)];
  let decision = evaluatePlacement(responses, bank);
  while (!decision.stop && responses.length < learner.maxItems) {
    const item = selectNextItem(bank, responses, steps[steps.length - 1].theta);
    if (!item) break;
    const correct = random() < probCorrect(learner.theta, item);
    responses.push({ item, correct, latencySec: 0 });
    steps.push(snapshot(item, correct));
    decision = evaluatePlacement(responses, bank);
  }

  const last = steps[steps.length - 1];
  return {
    learnerTheta: learner.theta,
    grid: posteriorCurve([]).theta,
    steps,
    decision,
    tier: last.tier,
    source: recommendedSource(last.theta),
    peak: Math.max(...steps.flatMap(step => step.weights)),
  };
}

export const ENGINE_RUN: EngineRun = simulatePlacement();

/** Provisional tier boundaries on the ability scale, as `tierForTheta` draws them. */
export const TIER_BANDS: readonly { tier: Tier; from: number; to: number }[] = [
  { tier: 'Foundation', from: -4, to: -0.8 },
  { tier: 'Intermediate', from: -0.8, to: 0.4 },
  { tier: 'Advanced', from: 0.4, to: 1.2 },
  { tier: 'Olympiad', from: 1.2, to: 4 },
];

/**
 * How sure the engine is after a step, from 0 at the prior to 1 when it is sure
 * enough to stop, for the page's "How sure" meter. This run stops on precision,
 * so the meter is the margin of error closing from the prior's towards the
 * stopping target; the final step of a finished run always reads as full.
 */
export function certainty(run: EngineRun, index: number): number {
  if (index === run.steps.length - 1 && run.decision.stop) return 1;
  const prior = run.steps[0].sem;
  return Math.max(0, Math.min(1, (prior - run.steps[index].sem) / (prior - TARGET_SEM)));
}
