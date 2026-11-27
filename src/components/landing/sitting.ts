/**
 * The sitting: one visitor, working through the paper on the front page.
 *
 * Nothing here is a demonstration of the placement engine; it is the engine.
 * Each answer is handed to the same functions the real placement uses
 * (src/domain/irt.ts): the estimate, its margin of error, the choice of the
 * next problem and the decision to stop are all theirs. What this file adds is
 * the bookkeeping a page needs: what is on the sheet, what has been marked,
 * and what the engine believed before and after each mark.
 *
 * A sitting lives in this module's memory and nowhere else. It is not written
 * to storage and not sent anywhere: it is gone when the tab closes, and the
 * placement a learner takes after signing up starts from nothing. Keeping it
 * outside React is only so that it survives a trip to the sign-in form and
 * back, and so the sheet, the figure and the slip at the foot of the page all
 * read the same one.
 */

import { useSyncExternalStore } from 'react';
import {
  estimateAbility,
  evaluatePlacement,
  posteriorCurve,
  selectNextItem,
  tierForTheta,
  type PlacementDecision,
  type ResponseRecord,
  type Tier,
} from '../../domain/irt';
import { TIER_BANDS } from './levels';
import { PAPER_BANK, type PaperItem } from './paperBank';

/** What the engine believes at one moment. */
export interface Belief {
  theta: number;
  /** The margin of error: the posterior's standard deviation. */
  sem: number;
  tier: Tier;
  /** Posterior weights on the engine's quadrature grid; they add up to 1. */
  weights: number[];
  /** The posterior's mass in each level, in the order of TIER_BANDS. */
  shares: number[];
}

/** One problem, answered and marked. */
export interface Mark {
  item: PaperItem;
  /** The option chosen, or null for "I don't know yet". */
  choice: number | null;
  correct: boolean;
  seconds: number;
  before: Belief;
  after: Belief;
}

export interface Sitting {
  marks: Mark[];
  /** The problem on the sheet: waiting for an answer, or just marked. Null once the paper is closed. */
  item: PaperItem | null;
  /**
   * open    a problem is waiting for an answer
   * marked  it has been answered; the sheet shows the mark until the visitor moves on
   * closed  the engine has stopped, or the paper has no more to ask
   */
  status: 'open' | 'marked' | 'closed';
  belief: Belief;
  decision: PlacementDecision;
  /** What the engine will ask next, if anything. Known as soon as an answer is marked. */
  upNext: PaperItem | null;
}

/** The engine's quadrature grid, for anything that draws a belief. */
export const GRID: readonly number[] = posteriorCurve([]).theta;

const responsesOf = (marks: readonly Mark[]): ResponseRecord[] =>
  marks.map(mark => ({ item: mark.item, correct: mark.correct, latencySec: mark.seconds }));

/** The posterior's mass inside each level. */
export function tierShares(weights: readonly number[]): number[] {
  const shares = TIER_BANDS.map(() => 0);
  weights.forEach((weight, index) => {
    const tier = tierForTheta(GRID[index]);
    shares[TIER_BANDS.findIndex(band => band.tier === tier)] += weight;
  });
  return shares;
}

export function beliefAfter(responses: ResponseRecord[]): Belief {
  const { theta, sem } = estimateAbility(responses);
  const weights = posteriorCurve(responses).weight;
  return { theta, sem, tier: tierForTheta(theta), weights, shares: tierShares(weights) };
}

export function openSitting(bank: PaperItem[] = PAPER_BANK): Sitting {
  const belief = beliefAfter([]);
  return {
    marks: [],
    item: selectNextItem(bank, [], belief.theta) as PaperItem | null,
    status: 'open',
    belief,
    decision: evaluatePlacement([], bank),
    upNext: null,
  };
}

/** Mark the problem on the sheet. `choice` is an option index, or null for "I don't know yet", which the engine reads as a miss. */
export function markAnswer(sitting: Sitting, choice: number | null, seconds = 0, bank: PaperItem[] = PAPER_BANK): Sitting {
  const { item } = sitting;
  if (sitting.status !== 'open' || !item) return sitting;
  const correct = choice !== null && choice === item.correctIdx;
  const before = sitting.belief;
  const responses = [...responsesOf(sitting.marks), { item, correct, latencySec: seconds }];
  const after = beliefAfter(responses);
  const decision = evaluatePlacement(responses, bank);
  return {
    marks: [...sitting.marks, { item, choice, correct, seconds, before, after }],
    item,
    status: 'marked',
    belief: after,
    decision,
    upNext: decision.stop ? null : (selectNextItem(bank, responses, after.theta) as PaperItem | null),
  };
}

/** Turn to the next problem, or close the paper if the engine has stopped. */
export function turnOver(sitting: Sitting): Sitting {
  if (sitting.status !== 'marked') return sitting;
  if (!sitting.upNext) return { ...sitting, item: null, status: 'closed' };
  return { ...sitting, item: sitting.upNext, status: 'open', upNext: null };
}

/**
 * What a mark did to the estimate, for the line the page writes under the
 * problem. The page reports what happened, not what ought to have: a right
 * answer the engine saw coming barely moves it, and a miss on a problem that
 * was out of reach barely moves it either.
 */
export type Remark = 'right-moves' | 'right-holds' | 'miss-moves' | 'miss-holds' | 'blank';

/** A shift smaller than this is one the eye can hardly find on the figure. */
const HOLDS = 0.15;

export function remarkOn(mark: Mark): Remark {
  if (mark.choice === null) return 'blank';
  const holds = Math.abs(mark.after.theta - mark.before.theta) < HOLDS;
  return `${mark.correct ? 'right' : 'miss'}-${holds ? 'holds' : 'moves'}`;
}

/** Whether the next problem is pitched above or below the one just marked. */
export function pitchOfNext(sitting: Sitting): 'harder' | 'easier' | 'level' | null {
  const last = sitting.marks[sitting.marks.length - 1];
  if (!last || !sitting.upNext) return null;
  const step = sitting.upNext.b - last.item.b;
  return step > 0.25 ? 'harder' : step < -0.25 ? 'easier' : 'level';
}

// ---------------------------------------------------------------------------
// The one sitting this page load holds
// ---------------------------------------------------------------------------

let current: Sitting = openSitting();
let shownAt = now();
const listeners = new Set<() => void>();

function now(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

function publish(next: Sitting): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export const sitting = {
  get: (): Sitting => current,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** The clock for the problem on the sheet starts when the sheet is first shown, not when the code loads. */
  shown(): void {
    if (current.status === 'open' && current.marks.length === 0) shownAt = now();
  },
  answer(choice: number | null): void {
    // An hour is a tab left open, not a problem worked on.
    const seconds = Math.min(3600, Math.max(0, Math.round((now() - shownAt) / 1000)));
    publish(markAnswer(current, choice, seconds));
  },
  next(): void {
    publish(turnOver(current));
    shownAt = now();
  },
  restart(): void {
    publish(openSitting());
    shownAt = now();
  },
};

export function useSitting(): Sitting {
  return useSyncExternalStore(sitting.subscribe, sitting.get, sitting.get);
}
