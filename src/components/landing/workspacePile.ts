/**
 * The workspace's pile of cards, as numbers.
 *
 * Each card sits in a sticky slot a little lower than the one before, so
 * scrolling deals the cards onto a pile. How far each one has been dealt, and
 * how many cards now lie on it, follow from the scroll position and the slots'
 * places alone, so the pile is a pure function of the scroll: it rewinds
 * exactly, lands correctly after a refresh mid-page, and the chapter
 * (JourneyStack.tsx) and the stage (sceneWorkspace.ts) read the same numbers.
 *
 * A covered card tips back like paper under paper: its top edge leans away
 * from you about its bottom edge (rotateX 6 to 8 degrees), it sinks 40px
 * further back for every card on it, gets 4% smaller per card, and a dim layer
 * rises over it.
 */

import { clamp01 } from './threadShapes';

/** One sticky slot: its static top in the document, its height, its CSS `top` (px) and its bottom margin. */
export interface PileSlot { top: number; height: number; stick: number; margin?: number }
/** The element the slots are sticky in: its top, and the height of its content box. */
export interface PileBox { top: number; height: number }

/**
 * Where a slot's card is on screen at scroll `y`: sticky at `stick`, and held
 * inside its container with its margin box, which is how a browser bounds a
 * sticky element. So near the end of the pile the cards with a margin under
 * them start to leave a little before the last one does.
 */
export function slotTop(slot: PileSlot, container: PileBox, y: number): number {
  return Math.min(Math.max(slot.top - y, slot.stick), container.top + container.height - slot.height - (slot.margin ?? 0) - y);
}

/** The same, without the container's bound: where the card would be if the pile went on. */
const freeTop = (slot: PileSlot, y: number) => Math.max(slot.top - y, slot.stick);

/**
 * How far the card above has come down onto the card below: 0 while it has
 * not reached the lower card's foot, 1 once it has landed in its own slot.
 */
export function coverage(lower: PileSlot, lowerTop: number, upper: PileSlot, upperTop: number): number {
  const landed = lower.stick + lower.height - upper.stick;
  if (landed <= 0) return upperTop <= lowerTop + lower.height ? 1 : 0;
  return clamp01((lowerTop + lower.height - upperTop) / landed);
}

export interface PileState {
  /** Each card's top on screen. */
  tops: number[];
  /** How many cards lie on each card (fractional while one is being dealt). */
  covered: number[];
  /** How far each card has been dealt: 0 entering, 1 landed on the pile. */
  dealt: number[];
}

/** The whole pile at scroll `y` on a screen `viewport` px tall. Writes into `out` so a frame allocates nothing. */
export function pileAt(slots: readonly PileSlot[], container: PileBox, y: number, viewport: number, out: PileState = { tops: [], covered: [], dealt: [] }): PileState {
  const n = slots.length;
  out.tops.length = n;
  out.covered.length = n;
  out.dealt.length = n;
  for (let i = 0; i < n; i += 1) {
    out.tops[i] = slotTop(slots[i], container, y);
    out.covered[i] = 0;
  }
  // How covered a card is follows the scroll alone, not the pile's end: as the pile leaves, nothing uncovers.
  for (let i = 0; i < n; i += 1) {
    const lower = freeTop(slots[i], y);
    for (let j = i + 1; j < n; j += 1) out.covered[i] += coverage(slots[i], lower, slots[j], freeTop(slots[j], y));
    // The first card is dealt as it rises from the foot of the screen to its place; every other as it lands on the one before.
    out.dealt[i] = i === 0
      ? clamp01((viewport - lower) / Math.max(1, viewport - slots[0].stick))
      : coverage(slots[i - 1], freeTop(slots[i - 1], y), slots[i], lower);
  }
  return out;
}

/**
 * Which card is on top, the one whose small picture may play: the card no
 * other has half covered, while it is on screen. -1 when none is.
 */
export function cardOnTop(state: PileState, slots: readonly PileSlot[], viewport: number): number {
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const top = state.tops[i];
    const seen = Math.min(viewport, top + slots[i].height) - Math.max(0, top);
    if (state.covered[i] < 0.5 && seen > Math.min(slots[i].height, viewport) * 0.45) return i;
  }
  return -1;
}

export interface CardPose {
  /** px toward the viewer (negative: back into the pile). */
  z: number;
  /** degrees the top edge leans away from the viewer. */
  tilt: number;
  /** degrees of turn in the card's own plane, while it is being dealt. */
  turn: number;
  scale: number;
  /** The dim layer: how opaque, and how far it has risen up the card (0 to 1). */
  dim: number;
  rise: number;
}

/** How a card sits for how covered it is and how far it has been dealt. */
export function cardPose(covered: number, dealt: number, index: number): CardPose {
  const k = Math.max(0, covered);
  const arriving = 1 - clamp01(dealt);
  return {
    // A card arrives a touch raised and settles flat as it lands.
    z: -40 * k + 18 * arriving,
    tilt: k <= 1 ? 6 * k : Math.min(8, 6 + (k - 1)),
    // Dealt cards come in at a slight angle, alternately, and square up on landing.
    turn: (index % 2 ? 1.4 : -1.4) * arriving || 0,
    scale: 1 - 0.04 * k,
    dim: Math.min(0.5, 0.17 * k),
    rise: clamp01(k),
  };
}

/** The card's CSS transform for a pose (its transform origin is its bottom centre). */
export function cardTransform(pose: CardPose): string {
  return `translate3d(0px, 0px, ${pose.z.toFixed(2)}px) rotateX(${pose.tilt.toFixed(3)}deg) rotateZ(${pose.turn.toFixed(3)}deg) scale(${pose.scale.toFixed(4)})`;
}

/** A slot that is never sticky (the phone's plain column): it scrolls with the page. */
export const UNSTUCK = -1e9;

/**
 * Read the pile's slots from the DOM. Call from a measure callback, never
 * while scrolling. `sticky` says whether the slots are pinned (the pile) or
 * a plain column.
 */
export function measurePile(stack: HTMLElement | null, docTop: (element: HTMLElement) => number, sticky: boolean): { container: PileBox; slots: PileSlot[] } | null {
  if (!stack) return null;
  const elements = Array.from(stack.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-pile-slot'));
  if (!elements.length) return null;
  const box = getComputedStyle(stack);
  const padTop = Number.parseFloat(box.paddingTop) || 0;
  const padBottom = Number.parseFloat(box.paddingBottom) || 0;
  // The slots are bounded by the container's content box.
  const container = { top: docTop(stack) + padTop, height: stack.offsetHeight - padTop - padBottom };
  // A stuck slot's own offset can report where it is stuck, so the static places are walked from the top of the pile.
  let top = container.top;
  const slots = elements.map(element => {
    const style = getComputedStyle(element);
    const margin = Number.parseFloat(style.marginBottom) || 0;
    const slot = { top, height: element.offsetHeight, stick: sticky ? Number.parseFloat(style.top) || 0 : UNSTUCK, margin };
    top += element.offsetHeight + margin;
    return slot;
  });
  return { container, slots };
}
