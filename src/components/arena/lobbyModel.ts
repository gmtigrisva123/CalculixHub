/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Presentation helpers for the Arena lobby.
 *
 * Everything here is derived from the match board the server already sent and
 * the clock the lobby already keeps. Nothing is fetched, stored or invented,
 * so the lobby can count down, point at what is next and give each match a
 * crest without touching a single row.
 */

import type { Arena } from '../../../shared/arena';

export type MatchStatus = 'Live now' | 'Upcoming' | 'Finished';

/**
 * The board's status rule: closed, or past its end, is finished; not yet
 * started is upcoming; anything between is live.
 */
export const matchStatus = (arena: Arena, now: number): MatchStatus =>
  arena.status === 'closed' || now >= Date.parse(arena.ends_at) ? 'Finished' : now < Date.parse(arena.starts_at) ? 'Upcoming' : 'Live now';

export interface Spotlight {
  arena: Arena;
  status: Exclude<MatchStatus, 'Finished'>;
  /** When the countdown ends: closing time for a live match, opening time otherwise. */
  target: number;
}

/** What the lobby should point at: the live match closing soonest, else the next to open. */
export function spotlightMatch(arenas: readonly Arena[], now: number): Spotlight | null {
  let live: Spotlight | null = null;
  let next: Spotlight | null = null;
  for (const arena of arenas) {
    const status = matchStatus(arena, now);
    if (status === 'Live now') {
      const target = Date.parse(arena.ends_at);
      if (!live || target < live.target) live = { arena, status, target };
    } else if (status === 'Upcoming') {
      const target = Date.parse(arena.starts_at);
      if (!next || target < next.target) next = { arena, status, target };
    }
  }
  return live ?? next;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Whole seconds remaining, rounded up so the clock reads 00:00:01 until it is really over. */
export function splitCountdown(ms: number): Countdown {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "2d 04:12:09", or "04:12:09" inside a day. */
export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = splitCountdown(ms);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days ? `${days}d ${clock}` : clock;
}

/** How far through its window a match is, from 0 to 1. */
export function windowProgress(arena: Arena, now: number): number {
  const start = Date.parse(arena.starts_at);
  const end = Date.parse(arena.ends_at);
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** The DOM id of a match's ticket, so the lobby can scroll to it. */
export const ticketId = (arenaId: string) => `arena-ticket-${arenaId}`;

/** FNV-1a: small and stable, which is all a crest needs. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export const CREST_HUES = ['alg', 'geo', 'com', 'num'] as const;

export interface Crest {
  /** An SVG path in a 100 × 100 box. */
  path: string;
  hue: (typeof CREST_HUES)[number];
}

/**
 * A curve of the match's own -- a rose, a spirograph or a Lissajous figure --
 * picked from its id, so a match wears the same crest on every visit.
 */
export function crestFor(id: string): Crest {
  const seed = hash(id);
  const variant = seed >>> 8;
  const points: [number, number][] = [];
  const plot = (turns: number, perTurn: number, at: (t: number) => [number, number]) => {
    const samples = Math.ceil(turns * perTurn);
    for (let i = 0; i <= samples; i++) points.push(at((i / samples) * turns * Math.PI * 2));
  };

  if (seed % 3 === 0) {
    // Rose r = cos(kθ) with k = n/d. It closes after π·d when n·d is odd, 2π·d otherwise.
    const roses: [number, number][] = [[2, 1], [3, 1], [4, 1], [5, 1], [3, 2], [5, 2], [7, 2], [5, 3], [7, 3]];
    const [n, d] = roses[variant % roses.length];
    plot(((n * d) % 2 ? 0.5 : 1) * d, 220, (t) => {
      const r = Math.cos((n / d) * t);
      return [r * Math.cos(t), r * Math.sin(t)];
    });
  } else if (seed % 3 === 1) {
    // Hypotrochoid: a pen at `pen × r` from the centre of a circle of radius r = p/q rolling inside the unit circle.
    const gears: [number, number, number][] = [[3, 8, 0.9], [2, 5, 0.8], [3, 7, 1], [2, 7, 0.75], [4, 9, 0.85], [3, 10, 0.95]];
    const [p, q, pen] = gears[variant % gears.length];
    const r = p / q;
    const reach = 1 - r + pen * r;
    plot(p, 170, (t) => [
      ((1 - r) * Math.cos(t) + pen * r * Math.cos(((1 - r) / r) * t)) / reach,
      ((1 - r) * Math.sin(t) - pen * r * Math.sin(((1 - r) / r) * t)) / reach,
    ]);
  } else {
    // Lissajous figure.
    const ratios: [number, number][] = [[3, 2], [5, 4], [3, 4], [1, 2], [5, 6], [4, 5]];
    const [a, b] = ratios[variant % ratios.length];
    const phase = variant % 2 ? Math.PI / 2 : Math.PI / 4;
    plot(1, 360, (t) => [Math.sin(a * t + phase), Math.sin(b * t)]);
  }

  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${(50 + x * 40).toFixed(1)} ${(50 + y * 40).toFixed(1)}`).join('');
  return { path, hue: CREST_HUES[(seed >>> 4) % CREST_HUES.length] };
}
