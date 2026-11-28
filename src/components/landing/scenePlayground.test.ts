import { describe, expect, it } from 'vitest';
import { CIRCLE_ARRIVES_AT, FIGURE, FIGURE_R, HANDOVER_EDGE, circleInBox, tiltPoint } from './chords';
import { CREST_U, HANDOVER_SECONDS, glide, handoverAt } from './scenePlayground';
import { parseEdge, scrollAt } from './stageLayout';

describe('the chord figure, as the stage finds it', () => {
  it('finds the circle where the SVG draws it, in a box of the figure’s own shape', () => {
    const circle = circleInBox({ left: 0, top: 0, width: FIGURE.W, height: FIGURE.H });
    expect(circle).toEqual({ x: 300, y: 190, r: FIGURE_R });
    expect(FIGURE_R).toBe(136);
  });

  it('scales the viewBox to fit and centres it, as preserveAspectRatio meet does', () => {
    // Twice as wide as the figure needs: scaled by the height, centred across.
    const wide = circleInBox({ left: 100, top: 50, width: 1200 * 2, height: 390 * 2 });
    expect(wide.r).toBeCloseTo(272);
    expect(wide.x).toBeCloseTo(100 + 2400 / 2);
    expect(wide.y).toBeCloseTo(50 + 380);
    // Too tall: scaled by the width, centred down.
    const tall = circleInBox({ left: 0, top: 0, width: 600, height: 790 });
    expect(tall.r).toBeCloseTo(136);
    expect(tall.y).toBeCloseTo(200 + 190);
  });

  it('starts the figure drawing at the very scroll the thread closes into the circle', () => {
    const box = { left: 0, top: 4000, width: 600, height: 390 };
    const { target, viewport } = parseEdge(HANDOVER_EDGE);
    expect(viewport).toBe(CIRCLE_ARRIVES_AT);
    // The DOM's edge and the stage's sum agree to well under a pixel.
    expect(scrollAt(box, HANDOVER_EDGE, 900)).toBeCloseTo(circleInBox(box).y - CIRCLE_ARRIVES_AT * 900, 2);
    expect(target).toBeCloseTo(190 / 390, 4);
  });
});

describe('the card’s tilt, as the stage follows it', () => {
  it('leaves every point where it was with no tilt', () => {
    expect(tiltPoint(120, -80, 0, 0, 1600)).toEqual([120, -80]);
  });

  it('turns the side under the pointer away, as CSS rotateY and rotateX do', () => {
    const turn = 4 * Math.PI / 180;
    // rotateY(+): the right edge goes back, so it draws a little nearer the centre; the left comes forward.
    const [right] = tiltPoint(600, 0, 0, turn, 1600);
    const [left] = tiltPoint(-600, 0, 0, turn, 1600);
    expect(right).toBeLessThan(600);
    expect(-left).toBeGreaterThan(600);
    // rotateX(+): the top goes back and the bottom comes forward (the Star Wars crawl).
    const [, top] = tiltPoint(0, -300, turn, 0, 1600);
    const [, bottom] = tiltPoint(0, 300, turn, 0, 1600);
    expect(-top).toBeLessThan(300);
    expect(bottom).toBeGreaterThan(300);
  });

  it('moves the circle by a few pixels at the most the card tilts: enough that the light must follow it', () => {
    const turn = 4 * Math.PI / 180;
    const [x, y] = tiltPoint(320, 40, -turn, turn, 1600);
    const shift = Math.hypot(x - 320, y - 40);
    expect(shift).toBeGreaterThan(2);
    expect(shift).toBeLessThan(10);
  });
});

describe('the handover from light to ink', () => {
  it('sends the curve’s crest to the top of the circle: the estimate the engine settled on', () => {
    // The replay ends near theta 1.1 on a -3.4 to 3.4 axis.
    expect(CREST_U).toBeGreaterThan(0.6);
    expect(CREST_U).toBeLessThan(0.72);
  });

  it('eases on the page’s GLIDE curve, from nothing to all of it', () => {
    expect(glide(0)).toBe(0);
    expect(glide(1)).toBe(1);
    expect(glide(0.5)).toBeGreaterThan(0.85);
    let last = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const value = glide(t);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it('holds the light until the stroke starts, and lets go of it as the stroke is drawn', () => {
    expect(handoverAt(-1)).toBe(0);
    expect(handoverAt(0)).toBe(0);
    expect(handoverAt(HANDOVER_SECONDS * 0.5)).toBeGreaterThan(0.5);
    expect(handoverAt(HANDOVER_SECONDS + 0.2)).toBe(1);
  });
});
