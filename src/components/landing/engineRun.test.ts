import { describe, expect, it } from 'vitest';
import { ITEM_BANK } from '../../domain/itemBank';
import { estimateAbility, evaluatePlacement, TARGET_SEM, type ResponseRecord } from '../../domain/irt';
import { ENGINE_RUN, SIMULATED_LEARNER, TIER_BANDS, simulatePlacement } from './engineRun';

describe('the landing page placement replay', () => {
  it('is deterministic, so every visitor watches the same placement', () => {
    const again = simulatePlacement();
    expect(again.steps.map(step => [step.item?.id ?? null, step.correct])).toEqual(ENGINE_RUN.steps.map(step => [step.item?.id ?? null, step.correct]));
  });

  it('starts from the prior and asks no item twice', () => {
    expect(ENGINE_RUN.steps[0].item).toBeNull();
    expect(ENGINE_RUN.steps[0].theta).toBeCloseTo(0, 6);
    expect(ENGINE_RUN.steps[0].sem).toBeGreaterThan(0.95);
    const ids = ENGINE_RUN.steps.slice(1).map(step => step.item!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('agrees with the engine at every step', () => {
    const responses: ResponseRecord[] = [];
    for (const step of ENGINE_RUN.steps.slice(1)) {
      responses.push({ item: step.item!, correct: step.correct!, latencySec: 0 });
      const estimate = estimateAbility(responses);
      expect(step.theta).toBeCloseTo(estimate.theta, 9);
      expect(step.sem).toBeCloseTo(estimate.sem, 9);
    }
    expect(evaluatePlacement(responses, ITEM_BANK)).toEqual(ENGINE_RUN.decision);
  });

  it('tells a story with both kinds of evidence and ends on precision', () => {
    const answers = ENGINE_RUN.steps.slice(1).map(step => step.correct);
    expect(answers).toContain(true);
    expect(answers).toContain(false);
    expect(ENGINE_RUN.decision.stop).toBe(true);
    expect(ENGINE_RUN.decision.reason).toBe('precision');
    const last = ENGINE_RUN.steps[ENGINE_RUN.steps.length - 1];
    expect(last.sem).toBeLessThanOrEqual(TARGET_SEM);
    expect(ENGINE_RUN.steps.length - 1).toBeLessThanOrEqual(SIMULATED_LEARNER.maxItems);
    // The estimate lands within two margins of error of the learner's true ability.
    expect(Math.abs(last.theta - SIMULATED_LEARNER.theta)).toBeLessThan(2 * last.sem);
  });

  it('narrows its margin of error from the prior to the stopping target', () => {
    const margins = ENGINE_RUN.steps.map(step => step.sem);
    expect(margins[margins.length - 1]).toBeLessThan(margins[0] / 2);
    // Every step is filed under the level the engine's own rule gives its estimate.
    for (const step of ENGINE_RUN.steps) {
      const band = TIER_BANDS.find(entry => step.theta >= entry.from && step.theta < entry.to);
      expect(band?.tier).toBe(step.tier);
    }
  });
});
