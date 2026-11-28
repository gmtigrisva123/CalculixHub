import { describe, expect, it } from 'vitest';
import { UNSTUCK, cardOnTop, cardPose, cardTransform, coverage, pileAt, slotTop, type PileSlot } from './workspacePile';

// Four 680px cards in sticky slots 26px apart, with 120px between slots, on a 900px screen.
const VIEW = 900;
const H = 680;
const GAP = 120;
const START = 5000;
const slots: PileSlot[] = [0, 1, 2, 3].map(i => ({ top: START + i * (H + GAP), height: H, stick: 96 + i * 26, margin: i < 3 ? GAP : 0 }));
/** The pile holds for a moment once the last card has landed (JourneyStack's spacer after the slots). */
const HOLD = 300;
const container = { top: START, height: 4 * H + 3 * GAP + HOLD };
/** The scroll at which card `i` has landed in its slot. */
const landing = (i: number) => slots[i].top - slots[i].stick;

describe('the pile, as a pure function of the scroll', () => {
  it('holds each card at its sticky top, inside the pile', () => {
    expect(slotTop(slots[0], container, START - 2000)).toBe(2000);
    expect(slotTop(slots[0], container, landing(0) + 300)).toBe(96);
    // At the end of the pile every card leaves with it.
    const end = container.top + container.height;
    expect(slotTop(slots[0], container, end)).toBeLessThan(0);
  });

  it('counts the cards lying on each card, rising smoothly as each is dealt', () => {
    const before = pileAt(slots, container, landing(0), VIEW);
    expect(before.covered).toEqual([0, 0, 0, 0]);
    const halfway = pileAt(slots, container, (landing(0) + landing(1)) / 2 + 200, VIEW);
    expect(halfway.covered[0]).toBeGreaterThan(0);
    expect(halfway.covered[0]).toBeLessThan(1);
    const all = pileAt(slots, container, landing(3) + 10, VIEW);
    expect(all.covered.map(k => Math.round(k * 1000) / 1000)).toEqual([3, 2, 1, 0]);
    expect(all.dealt).toEqual([1, 1, 1, 1]);
  });

  it('lets the cards with a margin under them leave first at the end, without uncovering any', () => {
    const end = container.top + container.height - VIEW;
    const state = pileAt(slots, container, end, VIEW);
    // Bounded by its margin box, as a browser bounds a sticky element.
    expect(state.tops[2]).toBe(VIEW - H - GAP);
    // The last card has landed in its slot, and the hold keeps it there to the end.
    expect(state.tops[3]).toBe(slots[3].stick);
    expect(state.covered.map(k => Math.round(k * 1000) / 1000)).toEqual([3, 2, 1, 0]);
  });

  it('rewinds exactly', () => {
    const ys = [landing(0) - 400, landing(1) - 100, landing(2), landing(3) + 50];
    const forward = ys.map(y => pileAt(slots, container, y, VIEW).covered.slice());
    const back = [...ys].reverse().map(y => pileAt(slots, container, y, VIEW).covered.slice()).reverse();
    expect(back).toEqual(forward);
  });

  it('says a card is not covered until the next one reaches its foot', () => {
    const lowerTop = 96;
    expect(coverage(slots[0], lowerTop, slots[1], lowerTop + H + 1)).toBe(0);
    expect(coverage(slots[0], lowerTop, slots[1], slots[1].stick)).toBe(1);
  });

  it('plays the picture of the card on top only', () => {
    expect(cardOnTop(pileAt(slots, container, landing(0), VIEW), slots, VIEW)).toBe(0);
    expect(cardOnTop(pileAt(slots, container, landing(2) + 5, VIEW), slots, VIEW)).toBe(2);
    expect(cardOnTop(pileAt(slots, container, landing(3) + 5, VIEW), slots, VIEW)).toBe(3);
    // Long before the pile, and long after it, no card is on screen.
    expect(cardOnTop(pileAt(slots, container, START - 3000, VIEW), slots, VIEW)).toBe(-1);
    expect(cardOnTop(pileAt(slots, container, START + container.height + 2000, VIEW), slots, VIEW)).toBe(-1);
  });

  it('keeps a plain column flat: nothing covers anything', () => {
    const column = slots.map(slot => ({ ...slot, stick: UNSTUCK }));
    for (const y of [START - 500, START + 900, START + 2400]) {
      expect(pileAt(column, container, y, VIEW).covered).toEqual([0, 0, 0, 0]);
    }
  });
});

describe('a covered card’s pose', () => {
  it('sits flat and square on top, and tips back, sinks and shrinks under each card', () => {
    const top = cardPose(0, 1, 0);
    expect(top).toEqual({ z: 0, tilt: 0, turn: 0, scale: 1, dim: 0, rise: 0 });
    const once = cardPose(1, 1, 0);
    expect(once.tilt).toBe(6);
    expect(once.z).toBe(-40);
    expect(once.scale).toBeCloseTo(0.96);
    const thrice = cardPose(3, 1, 0);
    expect(thrice.tilt).toBe(8);
    expect(thrice.z).toBe(-120);
    expect(thrice.scale).toBeCloseTo(0.88);
    expect(thrice.dim).toBeGreaterThan(once.dim);
  });

  it('arrives a little raised and turned, and squares up as it lands', () => {
    const arriving = cardPose(0, 0, 1);
    expect(arriving.z).toBeGreaterThan(0);
    expect(arriving.turn).not.toBe(0);
    expect(cardTransform(cardPose(0, 1, 2))).toBe('translate3d(0px, 0px, 0.00px) rotateX(0.000deg) rotateZ(0.000deg) scale(1.0000)');
  });
});
