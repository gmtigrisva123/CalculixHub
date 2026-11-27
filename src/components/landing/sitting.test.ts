import { describe, expect, it } from 'vitest';
import { estimateAbility, evaluatePlacement, selectNextItem, tierForTheta, type ResponseRecord } from '../../domain/irt';
import { AXIS, BAND_SHARES, TIER_BANDS, along } from './levels';
import { PAPER_BANK, type PaperItem } from './paperBank';
import { GRID, markAnswer, openSitting, pitchOfNext, remarkOn, tierShares, turnOver, type Sitting } from './sitting';

/** Sit the paper, answering each problem as `answers` decides, until it closes or `limit` marks are made. */
function sit(answers: (item: PaperItem, index: number) => number | null, limit = 99): Sitting {
  let state = openSitting();
  while (state.status !== 'closed' && state.marks.length < limit) {
    state = markAnswer(state, answers(state.item!, state.marks.length));
    if (state.marks.length < limit) state = turnOver(state);
  }
  return state;
}
const right = (item: PaperItem) => item.correctIdx;
const wrong = (item: PaperItem) => (item.correctIdx + 1) % item.options.length;

describe('the level bands', () => {
  it('are the engine’s own tiers, at every point of the scale', () => {
    for (const theta of GRID) {
      const band = TIER_BANDS.find(entry => theta >= entry.from && theta < entry.to) ?? TIER_BANDS[TIER_BANDS.length - 1];
      expect(band.tier, String(theta)).toBe(tierForTheta(theta));
    }
    for (let index = 1; index < TIER_BANDS.length; index += 1) expect(TIER_BANDS[index].from).toBe(TIER_BANDS[index - 1].to);
  });

  it('share out the drawn axis completely', () => {
    expect(along(AXIS.min)).toBe(0);
    expect(along(AXIS.max)).toBe(1);
    expect(BAND_SHARES.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
  });
});

describe('a sitting of the landing page’s paper', () => {
  it('opens on the prior, with a problem on the sheet and nothing marked', () => {
    const state = openSitting();
    expect(state.status).toBe('open');
    expect(state.marks).toEqual([]);
    expect(state.item).toBe(selectNextItem(PAPER_BANK, [], 0));
    expect(state.belief.theta).toBeCloseTo(0, 6);
    expect(state.belief.sem).toBeGreaterThan(0.95);
    expect(state.belief.weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 9);
    expect(state.belief.shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 9);
  });

  it('agrees with the engine after every answer', () => {
    let state = openSitting();
    const responses: ResponseRecord[] = [];
    for (let turn = 0; turn < 6; turn += 1) {
      const item = state.item!;
      const choice = turn % 2 ? wrong(item) : right(item);
      state = markAnswer(state, choice, 12);
      responses.push({ item, correct: choice === item.correctIdx, latencySec: 12 });
      const estimate = estimateAbility(responses);
      expect(state.belief.theta).toBeCloseTo(estimate.theta, 9);
      expect(state.belief.sem).toBeCloseTo(estimate.sem, 9);
      expect(state.belief.tier).toBe(tierForTheta(estimate.theta));
      expect(state.decision).toEqual(evaluatePlacement(responses, PAPER_BANK));
      expect(state.upNext).toBe(state.decision.stop ? null : selectNextItem(PAPER_BANK, responses, estimate.theta));
      // What it believed before this answer is what it believed after the last.
      const mark = state.marks[turn];
      expect(mark.after).toBe(state.belief);
      if (turn > 0) expect(mark.before).toBe(state.marks[turn - 1].after);
      state = turnOver(state);
    }
  });

  it('asks a harder problem after a right answer and an easier one after a miss', () => {
    const up = turnOver(markAnswer(openSitting(), right(openSitting().item!)));
    const down = turnOver(markAnswer(openSitting(), wrong(openSitting().item!)));
    expect(up.item!.b).toBeGreaterThan(down.item!.b);
    expect(up.belief.theta).toBeGreaterThan(0);
    expect(down.belief.theta).toBeLessThan(0);
    // Each answer narrows the margin of error.
    expect(up.belief.sem).toBeLessThan(openSitting().belief.sem);
    expect(down.belief.sem).toBeLessThan(openSitting().belief.sem);
  });

  it('reads "I don’t know yet" as a miss', () => {
    const blank = markAnswer(openSitting(), null);
    const miss = markAnswer(openSitting(), wrong(openSitting().item!));
    expect(blank.marks[0].correct).toBe(false);
    expect(blank.belief.theta).toBeCloseTo(miss.belief.theta, 12);
    expect(remarkOn(blank.marks[0])).toBe('blank');
  });

  it('never asks a problem twice, and visits all four topics before returning to one', () => {
    const state = sit((item, index) => (index % 3 === 0 ? wrong(item) : right(item)));
    const ids = state.marks.map(mark => mark.item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(state.marks.slice(0, 4).map(mark => mark.item.domain)).size).toBe(4);
  });

  it('closes when the engine stops, and not before it has seen each topic twice', () => {
    for (const answers of [right, wrong, (item: PaperItem, index: number) => (index % 2 ? right(item) : wrong(item))]) {
      const state = sit(answers);
      expect(state.status).toBe('closed');
      expect(state.item).toBeNull();
      expect(state.decision.stop).toBe(true);
      expect(state.marks.length).toBeGreaterThanOrEqual(8);
      expect(state.marks.length).toBeLessThanOrEqual(PAPER_BANK.length);
    }
  });

  it('places a strong sitting above a weak one', () => {
    const strong = sit(right);
    const weak = sit(wrong);
    expect(strong.belief.theta).toBeGreaterThan(1);
    expect(weak.belief.theta).toBeLessThan(-1);
    expect(weak.belief.tier).toBe('Foundation');
    expect(weak.belief.shares[0]).toBeGreaterThan(0.95);
  });

  it('ignores an answer when no problem is waiting for one', () => {
    const marked = markAnswer(openSitting(), 0);
    expect(markAnswer(marked, 1)).toBe(marked);
    const open = openSitting();
    expect(turnOver(open)).toBe(open);
  });

  it('describes each mark by what it did to the estimate', () => {
    // The first answer always moves the estimate: there is nothing yet to hold it.
    const first = openSitting().item!;
    expect(remarkOn(markAnswer(openSitting(), right(first)).marks[0])).toBe('right-moves');
    expect(remarkOn(markAnswer(openSitting(), wrong(first)).marks[0])).toBe('miss-moves');
    // Deep into a strong sitting, one more right answer on an easy problem changes almost nothing.
    const strong = sit(right, 7);
    const last = strong.marks[strong.marks.length - 1];
    expect(Math.abs(last.after.theta - last.before.theta)).toBeLessThan(0.15);
    expect(remarkOn(last)).toBe('right-holds');
    const weak = sit(wrong, 7);
    expect(remarkOn(weak.marks[weak.marks.length - 1])).toBe('miss-holds');
  });

  it('says whether the next problem is pitched above or below the last', () => {
    const up = markAnswer(openSitting(), right(openSitting().item!));
    const down = markAnswer(openSitting(), wrong(openSitting().item!));
    expect(pitchOfNext(openSitting())).toBeNull();
    expect(pitchOfNext(up)).not.toBe('easier');
    expect(pitchOfNext(down)).toBe('easier');
  });

  it('measures each level’s share of a belief', () => {
    const flat = GRID.map(() => 1 / GRID.length);
    const shares = tierShares(flat);
    expect(shares).toHaveLength(TIER_BANDS.length);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
    // On a flat belief the widest band holds the most.
    expect(shares[0]).toBeGreaterThan(shares[2]);
  });
});
