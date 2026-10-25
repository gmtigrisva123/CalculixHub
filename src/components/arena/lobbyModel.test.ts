import { describe, expect, it } from 'vitest';
import type { Arena } from '../../../shared/arena';
import { crestFor, CREST_HUES, formatCountdown, matchStatus, splitCountdown, spotlightMatch, windowProgress } from './lobbyModel';
import { circleIntersections, circumcenter, FIGURES, figureLength, fitView, project, teamAt, unproject } from './stadium';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-25T12:00:00.000Z');

const arena = (id: string, startOffset: number, endOffset: number, status: Arena['status'] = 'published'): Arena => ({
  id,
  title: id,
  description: '',
  starts_at: new Date(NOW + startOffset).toISOString(),
  ends_at: new Date(NOW + endOffset).toISOString(),
  duration_minutes: 30,
  status,
  question_count: 6,
});

describe('matchStatus', () => {
  it('reads the window the way the board always has', () => {
    expect(matchStatus(arena('a', HOUR, 2 * HOUR), NOW)).toBe('Upcoming');
    expect(matchStatus(arena('a', -HOUR, HOUR), NOW)).toBe('Live now');
    expect(matchStatus(arena('a', -2 * HOUR, -HOUR), NOW)).toBe('Finished');
  });

  it('treats the opening instant as live and the closing instant as finished', () => {
    expect(matchStatus(arena('a', 0, HOUR), NOW)).toBe('Live now');
    expect(matchStatus(arena('a', -HOUR, 0), NOW)).toBe('Finished');
  });

  it('lets an administrator close a match early', () => {
    expect(matchStatus(arena('a', -HOUR, HOUR, 'closed'), NOW)).toBe('Finished');
  });
});

describe('spotlightMatch', () => {
  it('prefers the live match that closes soonest', () => {
    const rows = [arena('later', -HOUR, 3 * HOUR), arena('next', HOUR, 2 * HOUR), arena('sooner', -HOUR, HOUR)];
    expect(spotlightMatch(rows, NOW)).toMatchObject({ arena: { id: 'sooner' }, status: 'Live now', target: NOW + HOUR });
  });

  it('falls back to the next match to open', () => {
    const rows = [arena('done', -3 * HOUR, -HOUR), arena('far', 5 * HOUR, 6 * HOUR), arena('near', 2 * HOUR, 3 * HOUR)];
    expect(spotlightMatch(rows, NOW)).toMatchObject({ arena: { id: 'near' }, status: 'Upcoming', target: NOW + 2 * HOUR });
  });

  it('has nothing to say when every match is over', () => {
    expect(spotlightMatch([arena('done', -3 * HOUR, -HOUR)], NOW)).toBeNull();
    expect(spotlightMatch([], NOW)).toBeNull();
  });
});

describe('countdowns', () => {
  it('splits and pads the remaining time', () => {
    expect(splitCountdown(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(formatCountdown(90_061_000)).toBe('1d 01:01:01');
    expect(formatCountdown(61_000)).toBe('00:01:01');
  });

  it('rounds partial seconds up and never runs below zero', () => {
    expect(formatCountdown(1_500)).toBe('00:00:02');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5_000)).toBe('00:00:00');
  });

  it('measures progress through a window, clamped', () => {
    expect(windowProgress(arena('a', -HOUR, HOUR), NOW)).toBeCloseTo(0.5);
    expect(windowProgress(arena('a', HOUR, 2 * HOUR), NOW)).toBe(0);
    expect(windowProgress(arena('a', -2 * HOUR, -HOUR), NOW)).toBe(1);
    expect(windowProgress(arena('a', 0, 0), NOW)).toBe(0);
  });
});

describe('crestFor', () => {
  it('gives a match the same crest every time', () => {
    expect(crestFor('a1f3c9e2')).toEqual(crestFor('a1f3c9e2'));
  });

  it('draws inside its 100 × 100 box in one of the domain hues', () => {
    for (const id of ['a', 'b7d2e4f1', 'c9e1a3b5-0000-4000-8000-000000000003', 'arena-42', 'zz']) {
      const crest = crestFor(id);
      expect(CREST_HUES).toContain(crest.hue);
      expect(crest.path.startsWith('M')).toBe(true);
      const numbers = crest.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(9.9);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(90.1);
    }
  });

  it('varies between matches', () => {
    const paths = new Set(Array.from({ length: 24 }, (_, i) => crestFor(`arena-${i}`).path));
    expect(paths.size).toBeGreaterThan(12);
  });
});

describe('stadium geometry', () => {
  it('finds where two circles cross', () => {
    const [p, q] = circleIntersections([0, 0], 1, [1, 0], 1)!;
    expect(p[0]).toBeCloseTo(0.5);
    expect(q[0]).toBeCloseTo(0.5);
    expect(Math.abs(p[1])).toBeCloseTo(Math.sqrt(3) / 2);
    expect(p[1]).toBeCloseTo(-q[1]);
    expect(circleIntersections([0, 0], 1, [3, 0], 1)).toBeNull();
  });

  it('puts the circumcentre equidistant from all three points', () => {
    const a = [-0.25, 0.1] as const;
    const b = [0.21, 0.15] as const;
    const c = [0.05, -0.19] as const;
    const o = circumcenter(a, b, c);
    const r = Math.hypot(a[0] - o[0], a[1] - o[1]);
    expect(Math.hypot(b[0] - o[0], b[1] - o[1])).toBeCloseTo(r);
    expect(Math.hypot(c[0] - o[0], c[1] - o[1])).toBeCloseTo(r);
  });

  it('assigns every direction to one of four stands', () => {
    expect(teamAt(0)).toBe(0);
    expect(teamAt(Math.PI / 2)).toBe(1);
    expect(teamAt(Math.PI)).toBe(2);
    expect(teamAt(-Math.PI / 2)).toBe(3);
  });

  it('round-trips a point on the field through the camera', () => {
    const view = fitView(600, 460, 0.7, 0.66, 46);
    const screen = project(view, 0.21, -0.33, 0, { x: 0, y: 0, k: 1 });
    const back = unproject(view, screen.x, screen.y);
    expect(back.x).toBeCloseTo(0.21, 3);
    expect(back.y).toBeCloseTo(-0.33, 3);
  });

  it('keeps every construction short enough to watch', () => {
    for (const figure of FIGURES) {
      expect(figure.steps.length).toBeGreaterThan(0);
      expect(figureLength(figure)).toBeGreaterThan(2);
      expect(figureLength(figure)).toBeLessThan(7);
    }
  });
});
