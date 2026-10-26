/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Everything the dashboard draws, read off the learner's own statistics.
 *
 * Pure functions over the props the dashboard already receives. Nothing here
 * fetches, stores or invents a number: the weekly figures use exactly the
 * arithmetic the dashboard has always used, and every other series is the
 * learning timeline itself, re-shaped for a chart.
 */

import type { Topic, UserStats } from '../../../shared/types';

type Timeline = UserStats['learningTimeline'];

/** Short keys the stylesheet uses to colour each domain. */
export const TOPIC_KEY: Record<Topic, 'alg' | 'geo' | 'com' | 'num'> = {
  Algebra: 'alg',
  Geometry: 'geo',
  Combinatorics: 'com',
  'Number Theory': 'num',
};

export interface DayPoints {
  date: string;
  points: number;
}

/**
 * Points earned on each of the given days.
 *
 * The timeline lists active days only, with a running total, so a day's points
 * are its total less the previous active day's. Unchanged from the original
 * dashboard: the chart may look different, but it reports the same numbers.
 */
export function dailyPoints(timeline: Timeline, days: string[]): DayPoints[] {
  return days.map((date) => {
    const index = timeline.findIndex((item) => item.date === date);
    const points = index < 0 ? 0 : Math.max(0, timeline[index].points - (index > 0 ? timeline[index - 1].points : 0));
    return { date, points };
  });
}

export const weekTotal = (daily: DayPoints[]) => daily.reduce((sum, day) => sum + day.points, 0);

/** Whether each day had any activity. A day is in the timeline only if the learner answered something on it. */
export function activeDays(timeline: Timeline, days: string[]): boolean[] {
  const seen = new Set(timeline.map((item) => item.date));
  return days.map((date) => seen.has(date));
}

/** The running points total, oldest active day first, for the points sparkline. */
export function pointsCurve(timeline: Timeline, limit = 60): DayPoints[] {
  return [...timeline]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((item) => ({ date: item.date, points: Math.max(0, item.points) }));
}

/**
 * A round top for the weekly chart's axis.
 *
 * Never below 25, the scale the dashboard has always kept so that a first
 * handful of points does not fill the whole chart.
 */
export function niceCeiling(max: number): number {
  if (!(max > 25)) return 25;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    if (step * magnitude >= max) return step * magnitude;
  }
  return 10 * magnitude;
}

/** The day's best bar, or -1 when the week is still empty. Ties go to the latest day. */
export function bestDay(daily: DayPoints[]): number {
  let best = -1;
  daily.forEach((day, index) => {
    if (day.points > 0 && (best < 0 || day.points >= daily[best].points)) best = index;
  });
  return best;
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const clampPercent = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0);

/** Decimal places a stored figure carries: accuracy keeps one, mastery up to two. */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const text = String(value);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : Math.min(2, text.length - dot - 1);
}

/**
 * Formats an in-flight count-up the way the settled figure reads, so the last
 * frame of the animation is exactly the number the dashboard always showed.
 */
export function formatLike(value: number, target: number): string {
  const places = decimalsOf(target);
  return places ? value.toFixed(places) : String(Math.round(value));
}

/** How many of a fixed row of dots a solved count fills, and what spills past it. */
export function solvedDots(count: number, capacity: number) {
  const solved = Math.max(0, Math.floor(count));
  return { filled: Math.min(solved, capacity), overflow: Math.max(0, solved - capacity) };
}

export interface Spark {
  line: string;
  area: string;
  end: { x: number; y: number } | null;
}

/**
 * SVG paths for a sparkline that rises from a baseline.
 *
 * Fewer than two points cannot make a line; the caller shows a resting
 * baseline instead of a fabricated curve.
 */
export function sparkPaths(values: number[], width: number, height: number, inset = 4): Spark {
  if (values.length < 2) return { line: '', area: '', end: null };
  const top = Math.max(...values);
  const span = top > 0 ? top : 1;
  const step = (width - inset * 2) / (values.length - 1);
  const points = values.map((value, index) => ({
    x: inset + index * step,
    y: height - inset - (value / span) * (height - inset * 2),
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(2)} ${height} L${points[0].x.toFixed(2)} ${height} Z`;
  return { line, area, end: last };
}
