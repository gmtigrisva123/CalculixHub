/**
 * The pile: four cards dealt onto a pile; the thread waits in the margin.
 *
 * The cards are the chapter's own CSS 3D (JourneyStack.tsx). Beside them the
 * thread lies as a faint vertical rule, the line down the margin of a sheet of
 * working: it comes down off the archive's stairs as the pile arrives, holds
 * beside the pile while the cards are dealt, and leaves with the pile's foot,
 * on toward the desk. It is drawn as ink on the sage paper, never across a
 * card or a heading: the cards and the title are in front of it, so the
 * thread passes behind them as it arrives.
 */

import { docBox, type Box } from './stageLayout';
import { clipToView, resampleInto, type ScreenPoint } from './archiveStairs';
import { measurePile, pileAt, type PileBox, type PileSlot, type PileState } from './workspacePile';
import { EMPTY_BOX, place, query, resetSlot } from './threadKit';
import { POLY_SAMPLES } from './threadShapes';
import { SHAPE } from './threadShaders';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** A hand-ruled line is never quite straight: the rule's sideways wander along its length, in px. */
const WANDER = [0, 0.7, -0.45, 0.35, -0.6, 0.3, -0.2, 0];
/** How far the rule starts above the pile's first card, in px. */
const HEAD = 30;

export class WorkspaceScene implements ThreadScene {
  id = 'workspace';
  private found = false;
  private heading: Box = EMPTY_BOX;
  private ruleX = 0;
  private cards: Box = EMPTY_BOX;
  private pile: { container: PileBox; slots: PileSlot[] } | null = null;
  private state: PileState = { tops: [], covered: [], dealt: [] };
  private points: ScreenPoint[] = WANDER.map(() => [0, 0, 0]);
  private data = new Float32Array(POLY_SAMPLES * 4);

  measure() {
    const section = query('#workspace');
    const stack = query('[data-pile]');
    const rule = query('.lx-pile-rule');
    const card = query('[data-pile-card]');
    this.found = Boolean(section && stack && rule && card);
    if (!section || !stack || !rule || !card) return;
    this.pile = measurePile(stack, element => docBox(element).top, section.dataset.mode === 'pile');
    this.heading = docBox(query('#lx-journey-title'));
    // The light lies exactly where the ink rule stands for a page without the stage.
    const ruleBox = docBox(rule);
    this.ruleX = ruleBox.left + ruleBox.width / 2;
    this.cards = docBox(card);
  }

  present() { return this.found && this.pile !== null; }

  /** The stretch of scroll over which the thread arrives: it is in the margin as the first card comes up the screen. */
  arrival(frame: StageFrame): [number, number] | null {
    if (!this.present() || !this.pile) return null;
    const top = this.pile.container.top;
    return [top - frame.vh * 1.0, top - frame.vh * 0.32];
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.present() || !this.pile) return;
    const { container, slots } = this.pile;
    const state = pileAt(slots, container, frame.y, frame.vh, this.state);
    // From just above the first card (which holds while the pile is pinned) to the pile's foot, or past the screen's.
    const top = state.tops[0] - HEAD;
    const bottom = Math.min(container.top + container.height - frame.y, frame.ch + 80);
    const last = WANDER.length - 1;
    WANDER.forEach((wander, i) => {
      const point = this.points[i];
      point[0] = this.ruleX + wander;
      point[1] = top + ((bottom - top) * i) / last;
      point[2] = 0;
    });
    const seen = clipToView(this.points, -40, -40, frame.cw + 40, frame.ch + 40);
    for (const point of seen) { point[0] -= frame.cw / 2; point[1] = frame.ch / 2 - point[1]; }
    resampleInto(seen, this.data);

    out.shape = SHAPE.poly;
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    // The ink drifts slowly down the margin.
    out.p[0].set(row, 0.34, frame.still ? 0 : 0.0022, 1);
    out.data = this.data;
    // Faint: a rule in the margin, not a line to read.
    out.look.set(2.3, 0.62, 0.11, 0);
    // The pile and the title stand in front of it.
    let lowest = -Infinity;
    let highest = Infinity;
    slots.forEach((slot, i) => {
      highest = Math.min(highest, state.tops[i]);
      lowest = Math.max(lowest, state.tops[i] + slot.height);
    });
    // The covered cards' tops lean back above the pile's first card: their fan is in front too.
    out.occ[0].set(this.cards.left - 6, highest - 48, this.cards.width + 12, lowest - highest + 56);
    if (this.heading.width) out.occ[1].set(this.heading.left - 10, this.heading.top - frame.y - 8, this.heading.width + 20, this.heading.height + 16);
    out.occR.set(14, 6, 0, 0);
    out.shade.y = 7;
    out.flowing = !frame.still;
  }
}

/** How the thread arrives in this scene from wherever it was: down into the margin, top first. */
export function workspaceLeg(self: WorkspaceScene): Leg | null {
  return {
    to: 'workspace',
    window: frame => self.arrival(frame),
    stagger: 0.5,
    orderByU: 0.7,
    swirl: 40,
    lift: 50,
  };
}

/** What this scene draws besides the thread: nothing; the pile is the chapter's own CSS 3D. */
export function createWorkspaceExtras(_self: WorkspaceScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
