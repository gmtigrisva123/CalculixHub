import { describe, expect, it } from 'vitest';
import { parseEdge, progressAt, scrollAt } from './stageLayout';
import { stickyTop } from './threadScenes';
import { ANSWERS, REPLAY_SPAN, REPLAY_START, replayAt } from './engineReplay';

// A section 2,000px tall starting 3,000px down the page, on an 800px screen.
const box = { top: 3000, left: 0, width: 1200, height: 2000 };
const VIEW = 800;

describe('scroll progress, the way the page and the stage both read it', () => {
  it('reads edge words the way Motion does', () => {
    expect(parseEdge('start end')).toEqual({ target: 0, viewport: 1 });
    expect(parseEdge('end 0.5')).toEqual({ target: 1, viewport: 0.5 });
    expect(parseEdge('center')).toEqual({ target: 0.5, viewport: 0.5 });
  });

  it('finds the scroll position where a target edge meets a viewport edge', () => {
    expect(scrollAt(box, 'start end', VIEW)).toBe(2200);
    expect(scrollAt(box, 'start start', VIEW)).toBe(3000);
    expect(scrollAt(box, 'end end', VIEW)).toBe(4200);
  });

  it('is a pure, clamped function of the scroll, so scrolling back rewinds it exactly', () => {
    const edges = ['start end', 'start start'] as const;
    expect(progressAt(box, edges, 0, VIEW)).toBe(0);
    expect(progressAt(box, edges, 2600, VIEW)).toBeCloseTo(0.5);
    expect(progressAt(box, edges, 9000, VIEW)).toBe(1);
    const forward = [2300, 2500, 2900].map(y => progressAt(box, edges, y, VIEW));
    const back = [2900, 2500, 2300].map(y => progressAt(box, edges, y, VIEW)).reverse();
    expect(back).toEqual(forward);
  });
});

describe('a pinned element on screen', () => {
  const container = { top: 1000, left: 0, width: 1200, height: 3000 };
  const pin = { top: 1000, left: 0, width: 1200, height: 800 };
  it('scrolls in, holds at the top for the length of its container, then leaves with it', () => {
    expect(stickyTop(pin, container, 0)).toBe(1000);
    expect(stickyTop(pin, container, 1000)).toBe(0);
    expect(stickyTop(pin, container, 2500)).toBe(0);
    expect(stickyTop(pin, container, 3200)).toBe(0);
    expect(stickyTop(pin, container, 3500)).toBe(-300);
  });
});

describe('the engine replay', () => {
  it('holds the open start, steps through every answer, and holds the verdict', () => {
    expect(replayAt(0, false).answered).toBe(0);
    expect(replayAt(REPLAY_START, false).k).toBe(0);
    expect(replayAt(REPLAY_START + REPLAY_SPAN, false).k).toBe(ANSWERS);
    expect(replayAt(1, false).beat).toBe(3);
    let last = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const state = replayAt(p, false);
      expect(state.answered).toBeGreaterThanOrEqual(last);
      last = state.answered;
      expect(state.sure).toBeGreaterThanOrEqual(0);
      expect(state.sure).toBeLessThanOrEqual(1);
    }
    expect(last).toBe(ANSWERS);
  });

  it('under reduced motion shows each state rather than the blend between two', () => {
    for (let p = 0; p <= 1; p += 0.013) expect([0, 1]).toContain(replayAt(p, true).t);
  });
});
