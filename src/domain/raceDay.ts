/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Race day: the date a learner is training for, and the plan that leads to it.
 *
 * The learner names the contest and gives the date themselves. Contest dates
 * move from year to year and differ by region, so none are baked in here; a
 * countdown to a date this file guessed would be worse than no countdown.
 *
 * The plan is the shape a coach would sketch on a whiteboard. Most of the time
 * goes to building, weighted toward the topics the learner is weakest in. The
 * stretch before the contest is mixed, timed work. The final week eases off,
 * and the day before is rest. It is arithmetic on the learner's own numbers
 * (days left, minutes a day, mastery by topic), not a prediction.
 */

import type { Topic } from '../../shared/types';

export const RACE_STORAGE = 'calculix_race_day_v1';

export const CONTESTS = ['AMC 8', 'AMC 10', 'AMC 12', 'AIME', 'USAJMO', 'USAMO', 'IMO', 'Another contest'] as const;
export type ContestName = (typeof CONTESTS)[number];

export interface RaceDay {
  contest: ContestName;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
}

export type Phase = 'build' | 'sharpen' | 'taper';

export interface PlanWeek {
  /** 1-based. */
  index: number;
  /** First day of the week, YYYY-MM-DD. */
  start: string;
  days: number;
  phase: Phase;
  focus: Topic;
  /** A second topic kept warm alongside the focus. */
  support: Topic;
  problemsPerDay: number;
  note: string;
}

const TOPICS: readonly Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
const DAY = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC for a calendar date, so day arithmetic never crosses a daylight-saving change. */
const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const dateKey = (when: Date): string =>
  `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
const addDays = (date: string, days: number) => new Date(stamp(date) + days * DAY).toISOString().slice(0, 10);

/** Whole days from `today` to the contest. 0 on the day, negative once it has passed. */
export const daysUntil = (date: string, today: string): number => Math.round((stamp(date) - stamp(today)) / DAY);

export function parseRaceDay(raw: string | null): RaceDay | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RaceDay>;
    if (typeof value.date !== 'string' || !DATE.test(value.date) || Number.isNaN(stamp(value.date))) return null;
    if (!CONTESTS.includes(value.contest as ContestName)) return null;
    return { contest: value.contest as ContestName, date: value.date };
  } catch {
    return null;
  }
}

/** About eight minutes a problem, which is contest pace with time to check. */
export const problemsFor = (minutesPerDay: number): number => Math.max(1, Math.round(minutesPerDay / 8));

/**
 * Topics in the order they need attention: weakest first. Ties keep the
 * conventional order, so two learners with no history get the same plan.
 */
export function attentionOrder(skills: Partial<Record<Topic, number>>): Topic[] {
  return [...TOPICS].sort((a, b) => (skills[a] ?? 0) - (skills[b] ?? 0) || TOPICS.indexOf(a) - TOPICS.indexOf(b));
}

const NOTES: Record<Phase, (focus: Topic, contest: string) => string> = {
  build: focus => `Untimed. Stay with ${focus} until the methods feel like yours.`,
  sharpen: (_focus, contest) => `Mixed sets against the clock, the way ${contest} will ask them.`,
  taper: () => 'Lighter days. Review what you got wrong, sleep well, and rest the day before.',
};

/**
 * The weeks from today to the contest.
 *
 * The last week is always the taper. Of the rest, roughly the final third is
 * sharpening and everything before it is building. Building weeks cycle
 * through the topics weakest-first, with the two weakest visited twice as
 * often; sharpening weeks rotate evenly, because by then the aim is range.
 */
export function trainingPlan(input: { date: string; today: string; minutesPerDay: number; skills: Partial<Record<Topic, number>>; contest?: string }): PlanWeek[] {
  const total = daysUntil(input.date, input.today);
  if (total <= 0) return [];

  const order = attentionOrder(input.skills);
  // Weakest and second-weakest appear twice per cycle of six.
  const buildCycle: Topic[] = [order[0], order[1], order[2], order[0], order[1], order[3]];
  const perDay = problemsFor(input.minutesPerDay);
  const count = Math.ceil(total / 7);
  const sharpenWeeks = count <= 2 ? 0 : Math.max(1, Math.round((count - 1) / 3));
  const buildWeeks = Math.max(0, count - 1 - sharpenWeeks);

  return Array.from({ length: count }, (_, week) => {
    const phase: Phase = week === count - 1 ? 'taper' : week < buildWeeks ? 'build' : 'sharpen';
    const focus = phase === 'build' ? buildCycle[week % buildCycle.length] : order[(week - buildWeeks) % order.length];
    const support = order.find(topic => topic !== focus) ?? order[0];
    return {
      index: week + 1,
      start: addDays(input.today, week * 7),
      days: Math.min(7, total - week * 7),
      phase,
      focus,
      support,
      problemsPerDay: phase === 'taper' ? Math.max(1, Math.round(perDay / 2)) : phase === 'sharpen' ? perDay + 1 : perDay,
      note: NOTES[phase](focus, input.contest ?? 'the contest'),
    };
  });
}

export const PHASE_LABEL: Record<Phase, string> = { build: 'Build', sharpen: 'Sharpen', taper: 'Taper' };
