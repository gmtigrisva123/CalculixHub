import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spring } from 'motion';
import { describe, expect, it } from 'vitest';
import { FONT_PATIENCE, STATS_APPEAR, mayCount, resumePoint } from './entrance';
import { SPRING } from './kit';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const css = read('src/styles/landing-entrance.css');

describe('the takeover of the static first frame', () => {
  it('resumes the entrance from the cue and the loops from the first frame', () => {
    expect(resumePoint(2400, 400, 100)).toEqual({ elapsed: 2000, since: 2300 });
  });

  it('starts from zero when the page was never cued or painted', () => {
    expect(resumePoint(2400, null, null)).toEqual({ elapsed: 0, since: 0 });
  });

  it('never resumes from a point in the future', () => {
    // A takeover that lands in the same millisecond as the cue, or a clock read a little early.
    expect(resumePoint(400, 420, 410)).toEqual({ elapsed: 0, since: 0 });
  });

  it('lets the figures count only while they have not appeared yet', () => {
    const appear = STATS_APPEAR * 1000;
    expect(mayCount(1000, null)).toBe(true);
    expect(mayCount(1000, 1000)).toBe(true);
    expect(mayCount(1000 + appear - 51, 1000)).toBe(true);
    expect(mayCount(1000 + appear - 50, 1000)).toBe(false);
    expect(mayCount(1000 + appear + 2000, 1000)).toBe(false);
  });
});

describe('the CSS entrance agrees with the code', () => {
  it('shows the figures when the count-ups expect them', () => {
    const rule = css.match(/\.lx-in-stat\s*\{\s*--d:\s*calc\(([\d.]+)s/);
    expect(rule, 'landing-entrance.css sets the figures\' delay').not.toBeNull();
    expect(Number(rule![1])).toBe(STATS_APPEAR);
  });

  it('waits for the display face exactly as long as the boot script does', () => {
    expect(read('index.html')).toContain(`setTimeout(cue, ${FONT_PATIENCE})`);
  });

  it('rises on motion\'s own arrive spring', () => {
    const { visualDuration, bounce } = SPRING.arrive as { visualDuration: number; bounce: number };
    const generator = spring({ keyframes: [0, 1], visualDuration, bounce });
    let duration = generator.calculatedDuration ?? 0;
    if (!duration) while (!generator.next(duration).done && duration < 5000) duration += 10;

    const time = css.match(/--lx-arrive-time:\s*([\d.]+)s/);
    expect(time, 'landing-entrance.css sets --lx-arrive-time').not.toBeNull();
    expect(Math.abs(Number(time![1]) * 1000 - duration)).toBeLessThanOrEqual(10);

    const curve = css.match(/--lx-arrive:\s*linear\(([^)]*)\)/);
    expect(curve, 'landing-entrance.css samples the spring into linear()').not.toBeNull();
    const points = curve![1].split(',').map(Number);
    expect(points[0]).toBe(0);
    expect(points[points.length - 1]).toBe(1);
    const steps = points.length - 1;
    points.slice(1, -1).forEach((value, index) => {
      const sampled = generator.next((duration * (index + 1)) / steps).value as number;
      expect(Math.abs(value - sampled), `point ${index + 1} of ${steps}`).toBeLessThanOrEqual(0.002);
    });
  });
});
