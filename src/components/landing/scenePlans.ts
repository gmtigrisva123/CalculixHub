/**
 * Three sheets: the thread runs round the Pro card's edge, inside the hero's
 * tube of light.
 *
 * The cards are the chapter's own DOM (PlansSection.tsx), and Pro's edge is
 * already the pearl tube there, a turning gradient seen through a ring. Here
 * the thread comes down from the desk and settles just inside that edge, then
 * keeps flowing round it, a few sparks travelling the tube: the same light that
 * began the page as the butterfly, now framing the plan made for the season.
 *
 * Pro is raised toward the reader in CSS 3D (translateZ under the grid's
 * perspective), so the edge on screen is the card's layout box scaled about
 * the perspective origin: worked out here from the layout, never read back
 * while the page scrolls.
 */

import { docBox, progressAt, type Box } from './stageLayout';
import { EMPTY_BOX, place, query, resetSlot } from './threadKit';
import { POLY_SAMPLES, resampleByLength, roundRectPoints } from './threadShapes';
import { SHAPE } from './threadShaders';
import { PLANS_RAISE, PLANS_SETTLE_EDGES, PLANS_STACKED, plansTilt, raisedPoint } from './plansStage';
import type { Extra, InkRect, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** How far inside the card's edge the thread runs (px): just inside the ring of light. */
const INSET = 4.5;

export class PlansScene implements ThreadScene {
  id = 'plans';
  private found = false;
  /** The Pro card as laid out, the plane it lies on (whose centre is the perspective origin), and its radius. */
  card: Box = EMPTY_BOX;
  private plane: Box = EMPTY_BOX;
  private stacked = false;
  private radius = 14;
  /** The loop round the edge in the card's own px about its centre (y down), evenly spaced. */
  private loop = new Float32Array(POLY_SAMPLES * 4);
  private samples = new Float32Array(POLY_SAMPLES * 4);
  private corners: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]];

  measure() {
    const card = query('[data-plan-featured]');
    const plane = query('.lx-plan-stage');
    this.found = Boolean(card && plane);
    if (!card || !plane) return;
    this.card = docBox(card);
    this.plane = docBox(plane);
    this.stacked = window.matchMedia(`(max-width: ${PLANS_STACKED}px)`).matches;
    this.radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 14;
    const width = this.card.width - INSET * 2;
    const height = this.card.height - INSET * 2;
    // Start at the top centre and go round clockwise; flipped to y down.
    this.loop = resampleByLength(roundRectPoints(width, height, Math.max(0, this.radius - INSET), 12).map(([x, y]) => [x, -y, 0]));
  }

  present() { return this.found && this.card.width > 0; }

  /** A point of Pro (px from its centre, y down) on screen this frame. */
  private onScreen(frame: StageFrame, x: number, y: number): [number, number] {
    const settle = frame.still ? 1 : progressAt(this.plane, PLANS_SETTLE_EDGES, frame.y, frame.vh);
    const tilt = plansTilt(settle, this.stacked);
    const centre: [number, number] = [this.plane.left + this.plane.width / 2, this.plane.top + this.plane.height / 2];
    const card: [number, number] = [this.card.left + this.card.width / 2, this.card.top + this.card.height / 2];
    const [px, py] = raisedPoint(centre, card, tilt, this.stacked ? 0 : PLANS_RAISE, x, y);
    return [px, py - frame.y];
  }

  /** The raised card's box on screen this frame (its corners' bounds: it is a trapezium while the plane is tipped). */
  cardOnScreen(frame: StageFrame): InkRect {
    const w = this.card.width / 2;
    const h = this.card.height / 2;
    [[-w, -h], [w, -h], [w, h], [-w, h]].forEach(([x, y], i) => { this.corners[i] = this.onScreen(frame, x, y); });
    const xs = this.corners.map(point => point[0]);
    const ys = this.corners.map(point => point[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const scale = (Math.max(...xs) - left) / this.card.width;
    return { x: left, y: top, w: Math.max(...xs) - left, h: Math.max(...ys) - top, r: this.radius * scale };
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.present()) return;
    const card = this.cardOnScreen(frame);
    if (card.y < frame.ch && card.y + card.h > 0) out.push(card);
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.present()) return;
    const card = this.cardOnScreen(frame);
    for (let i = 0; i < POLY_SAMPLES; i += 1) {
      const [x, y] = this.onScreen(frame, this.loop[i * 4], this.loop[i * 4 + 1]);
      this.samples[i * 4] = x - frame.cw / 2;
      this.samples[i * 4 + 1] = frame.ch / 2 - y;
      this.samples[i * 4 + 2] = 0;
      this.samples[i * 4 + 3] = this.loop[i * 4 + 3];
    }
    out.shape = SHAPE.poly;
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    // Sparks travelling the tube: a slow flow round the loop, thin.
    out.p[0].set(row, 0.05, frame.still ? 0 : 0.012, 1);
    out.data = this.samples;
    out.look.set(1.8, 1.05, 0.07, 0);
    // Only on the card: the thread never strays over the cream either side of it.
    out.clip.set(card.x, card.y, card.w, card.h);
    out.shade.set(card.r, 6, 0, 0);
    out.flowing = !frame.still && card.y < frame.ch && card.y + card.h > 0;
  }
}

/** The thread comes down from the desk to Pro's edge as the cards rise into view. */
export function plansLeg(self: PlansScene): Leg | null {
  return {
    to: 'plans',
    window: frame => {
      if (!self.present()) return null;
      const top = self.card.top;
      return [top - frame.vh * 1.15, top - frame.vh * 0.42];
    },
    stagger: 0.8,
    orderByU: 0.9,
    swirl: 30,
    lift: 60,
  };
}

/** Nothing besides the thread: the tube itself is the card's own CSS. */
export function createPlansExtras(_self: PlansScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}

