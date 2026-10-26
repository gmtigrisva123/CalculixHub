import { describe, expect, it } from 'vitest';
import {
  activeDays,
  bestDay,
  clampPercent,
  dailyPoints,
  formatLike,
  greeting,
  niceCeiling,
  pointsCurve,
  solvedDots,
  sparkPaths,
  weekTotal,
} from './dashboardModel';
import { buildMachine, dft, FIGURES, gcd, koch, resample, starPolygon, tipAt, type Point } from './fourier';

const days = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];
const timeline = [
  { date: '2026-10-12', points: 40, accuracy: 50 },
  { date: '2026-10-21', points: 55, accuracy: 60 },
  { date: '2026-10-23', points: 90, accuracy: 62.5 },
  { date: '2026-10-26', points: 100, accuracy: 64.3 },
];

/** The weekly arithmetic exactly as the previous dashboard wrote it inline. */
function legacyDaily(rows: typeof timeline, keys: string[]) {
  return keys.map((date) => {
    const index = rows.findIndex((item) => item.date === date);
    const points = index < 0 ? 0 : Math.max(0, rows[index].points - (index > 0 ? rows[index - 1].points : 0));
    return { date, points };
  });
}

describe('dailyPoints', () => {
  it('reports the same numbers as the previous dashboard', () => {
    expect(dailyPoints(timeline, days)).toEqual(legacyDaily(timeline, days));
    expect(dailyPoints(timeline, days).map((day) => day.points)).toEqual([0, 15, 0, 35, 0, 0, 10]);
    expect(weekTotal(dailyPoints(timeline, days))).toBe(60);
  });

  it('reads an empty timeline as an empty week', () => {
    expect(weekTotal(dailyPoints([], days))).toBe(0);
    expect(bestDay(dailyPoints([], days))).toBe(-1);
  });

  it('never reports a negative day', () => {
    const dip = [{ date: '2026-10-25', points: 30, accuracy: 0 }, { date: '2026-10-26', points: 20, accuracy: 0 }];
    expect(dailyPoints(dip, days).at(-1)?.points).toBe(0);
  });
});

describe('week helpers', () => {
  it('marks the days that had any activity', () => {
    expect(activeDays(timeline, days)).toEqual([false, true, false, true, false, false, true]);
  });

  it('picks the best day, latest on a tie', () => {
    expect(bestDay(dailyPoints(timeline, days))).toBe(3);
    expect(bestDay([{ date: 'a', points: 5 }, { date: 'b', points: 5 }])).toBe(1);
  });

  it('keeps the chart scale at 25 or more, on round numbers', () => {
    expect(niceCeiling(0)).toBe(25);
    expect(niceCeiling(12)).toBe(25);
    expect(niceCeiling(30)).toBe(30);
    expect(niceCeiling(35)).toBe(40);
    expect(niceCeiling(120)).toBe(150);
    expect(niceCeiling(990)).toBe(1000);
  });

  it('orders the points curve oldest first', () => {
    expect(pointsCurve([...timeline].reverse()).map((day) => day.points)).toEqual([40, 55, 90, 100]);
    expect(pointsCurve(timeline, 2)).toEqual([
      { date: '2026-10-23', points: 90 },
      { date: '2026-10-26', points: 100 },
    ]);
  });
});

describe('figures', () => {
  it('formats a count-up the way the figure is stored', () => {
    expect(formatLike(41.26, 83.3)).toBe('41.3');
    expect(formatLike(79.6, 80)).toBe('80');
    expect(formatLike(66.67, 66.67)).toBe(`${66.67}`);
    expect(formatLike(83.3, 83.3)).toBe(`${83.3}`);
    expect(formatLike(12.5, 12.5)).toBe(`${12.5}`);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it('fills dots up to capacity and counts the rest', () => {
    expect(solvedDots(7, 36)).toEqual({ filled: 7, overflow: 0 });
    expect(solvedDots(50, 36)).toEqual({ filled: 36, overflow: 14 });
  });

  it('greets by the hour', () => {
    expect(greeting(3)).toBe('Up late');
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(14)).toBe('Good afternoon');
    expect(greeting(21)).toBe('Good evening');
  });

  it('draws no curve from a single point', () => {
    expect(sparkPaths([12], 100, 40).end).toBeNull();
    const spark = sparkPaths([0, 10, 20], 100, 40);
    expect(spark.end).toEqual({ x: 96, y: 4 });
    expect(spark.area.endsWith('Z')).toBe(true);
  });
});

const area = (points: Point[]) =>
  points.reduce((sum, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return sum + (x * ny - nx * y) / 2;
  }, 0);

describe('the drawing machine', () => {
  it('rebuilds a curve exactly from all of its circles', () => {
    const points = resample(starPolygon(7, 3), 64);
    const terms = dft(points);
    const zero = terms.find((term) => term.k === 0)!;
    const rest = terms.filter((term) => term.k !== 0);
    points.forEach((point, i) => {
      const [x, y] = tipAt(rest, [zero.re, zero.im], i / points.length);
      expect(x).toBeCloseTo(point[0], 9);
      expect(y).toBeCloseTo(point[1], 9);
    });
  });

  it('spaces samples evenly along the outline', () => {
    const even = resample([[0, 0], [3, 0], [3, 1], [0, 1]], 8);
    const gaps = even.map(([x, y], i) => {
      const [nx, ny] = even[(i + 1) % even.length];
      return Math.hypot(nx - x, ny - y);
    });
    gaps.forEach((gap) => expect(gap).toBeCloseTo(1, 9));
  });

  it('grows the snowflake outwards, to 192 sides', () => {
    expect(koch(3)).toHaveLength(192);
    expect(Math.abs(area(koch(3)))).toBeGreaterThan(Math.abs(area(koch(0))));
  });

  it('closes the heptagram in one pass because 7 and 3 are coprime', () => {
    expect(gcd(7, 3)).toBe(1);
    expect(new Set(starPolygon(7, 3).map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)).size).toBe(7);
  });

  it('fits every figure inside the unit circle, centred, with 64 circles', () => {
    for (const figure of FIGURES) {
      const machine = buildMachine(figure.outline());
      expect(machine.terms).toHaveLength(64);
      const reach = Math.max(...machine.path.map(([x, y]) => Math.hypot(x, y)));
      expect(reach).toBeCloseTo(1, 6);
      const radii = machine.terms.map((term) => term.radius);
      expect(radii).toEqual([...radii].sort((a, b) => b - a));
    }
  });

  it('keeps the kept circles close to the true outline', () => {
    const outline = FIGURES[0].outline();
    const machine = buildMachine(outline);
    const centred = resample(outline, 720).map(([x, y]) => [x * machine.scale, y * machine.scale]);
    const worst = Math.max(
      ...machine.path.map(([x, y]) => Math.min(...centred.map(([cx, cy]) => Math.hypot(cx - x, cy - y)))),
    );
    expect(worst).toBeLessThan(0.02);
  });
});
