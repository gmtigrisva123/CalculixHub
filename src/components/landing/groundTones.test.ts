import { describe, expect, it } from 'vitest';
import { toneAt } from './GroundTones';

// A chapter 1,000px tall starting 3,000px down the page, on an 800px screen.
const band = { top: 3000, bottom: 4000 };
const VIEW = 800;
const at = (y: number) => toneAt(band, y, VIEW);

describe('ground tones', () => {
  it('is absent until the chapter reaches the foot of the screen, and after it has left the top', () => {
    expect(at(0)).toBe(0);
    expect(at(2200)).toBe(0); // its top edge is exactly at the foot of the screen
    expect(at(4000)).toBe(0); // its bottom edge is exactly at the top
    expect(at(9000)).toBe(0);
  });

  it('fades in over the first fifth of the passage, holds, and fades out over the last fifth', () => {
    // The passage is 1,800px of scroll: 2,200 to 4,000.
    expect(at(2380)).toBeCloseTo(0.5);
    expect(at(2560)).toBeCloseTo(1);
    expect(at(3100)).toBe(1);
    expect(at(3640)).toBeCloseTo(1);
    expect(at(3820)).toBeCloseTo(0.5);
  });

  it('never leaves the range 0 to 1', () => {
    for (let y = 0; y < 6000; y += 37) {
      expect(at(y)).toBeGreaterThanOrEqual(0);
      expect(at(y)).toBeLessThanOrEqual(1);
    }
  });

  it('cross-fades with the chapter that follows: one is leaving as the next arrives', () => {
    const next = { top: 4000, bottom: 5200 };
    // While this chapter's last fifth scrolls out, the next one is already on its way in.
    const y = 3820;
    expect(at(y)).toBeGreaterThan(0);
    expect(toneAt(next, y, VIEW)).toBeGreaterThan(0);
  });

  it('treats a chapter that is not on the page as absent', () => {
    expect(toneAt(null, 1234, VIEW)).toBe(0);
  });
});
