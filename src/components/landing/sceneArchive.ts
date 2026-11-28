/**
 * The staircase: four exam stacks climbing in difficulty; the thread runs along the stair edges.
 *
 * The stacks themselves are CSS 3D in the chapter (ArchiveLadder.tsx), so the
 * problems on their sheets stay DOM text. What the stage adds is the thread:
 * it comes down out of the chalk dust as the staircase pins, and lies along
 * the stairs' edges, in along the floor, up each stack's front edge and along
 * its top, and on to the right at the top of the climb. The edges are found by
 * replaying the chapter's own CSS 3D transforms (archiveStairs.ts) from the
 * measured layout and this frame's scroll, so the light stays on the paper's
 * edges while the stacks travel and the camera climbs. Where a top sheet has
 * lifted, the thread passes behind it, so it never crosses a problem.
 *
 * Without the pin (a phone, a short screen, reduced motion) the stacks stand
 * in a flat list and the thread follows their top edges there instead: up a
 * row as stairs, or down a column as a switchback through the gutters.
 */

import { docBox, type Box } from './stageLayout';
import {
  clipToView, flatEdges, measureStairs, resampleInto, sheetLift, sheetRect, stairEdges, stairsCamera, stairsFocus, stairsProgress, trackPose,
  type Rect, type ScreenPoint, type StairsCamera, type StairsMeasure,
} from './archiveStairs';
import { EMPTY_BOX, place, query, resetSlot, stickyTop } from './threadKit';
import { POLY_SAMPLES } from './threadShapes';
import { SHAPE } from './threadShaders';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** How far out from a list's boxes the thread turns, in px (into the page's gutter). */
const GUTTER = 11;
/** How far past the screen's edges the thread is kept, in px, so it runs off the screen rather than ending at its edge. */
const VIEW_MARGIN = 60;

export class ArchiveScene implements ThreadScene {
  id = 'archive';
  private found = false;
  private mode: 'track' | 'list' = 'list';
  private runway: Box = EMPTY_BOX;
  private pin: Box = EMPTY_BOX;
  private stairs: StairsMeasure | null = null;
  private camera: StairsCamera = stairsCamera(1, 1);
  /** In the list: each stack's front, and each problem sheet, in document px. */
  private boxes: Box[] = [];
  private sheets: Box[] = [];
  /** The heading and the bands above the stairs: the thread comes down past them as it arrives, and passes behind them. */
  private heading: Box = EMPTY_BOX;
  private bands: Box = EMPTY_BOX;
  private data = new Float32Array(POLY_SAMPLES * 4);
  private rect: Rect = { left: 0, top: 0, width: 0, height: 0 };

  measure() {
    const runway = query('.lx-stairs');
    const pin = query('.lx-stairs-pin');
    this.found = Boolean(runway && pin);
    if (!runway || !pin) return;
    this.mode = runway.dataset.mode === 'track' ? 'track' : 'list';
    this.runway = docBox(runway);
    this.heading = docBox(query('.lx-archive .lx-section-head'));
    this.bands = docBox(query('.lx-archive .lx-marquee'));
    if (this.mode === 'track') {
      // The pin is sticky: its static place is the top of its runway (it is the first child).
      this.pin = { ...docBox(pin), top: this.runway.top };
      this.stairs = measureStairs(pin);
      if (this.stairs) this.camera = stairsCamera(this.stairs.view.width, this.stairs.view.height);
      this.boxes = [];
      this.sheets = [];
    } else {
      this.stairs = null;
      this.boxes = Array.from(runway.querySelectorAll<HTMLElement>('.lx-ream-box')).map(box => docBox(box));
      this.sheets = Array.from(runway.querySelectorAll<HTMLElement>('[data-stack-sheet]')).map(sheet => docBox(sheet));
    }
  }

  present() {
    return this.found && (this.mode === 'track' ? this.stairs !== null : this.boxes.length > 0);
  }

  /** The stretch of scroll over which the thread arrives: it settles on the stairs as the stage pins. */
  arrival(frame: StageFrame): [number, number] | null {
    if (!this.present()) return null;
    if (this.mode === 'track') return [this.runway.top - frame.vh * 0.9, this.runway.top + frame.vh * 0.02];
    // In the list the first stack's top edge is in light by the time it is three quarters of the way up the screen.
    const first = this.boxes[0];
    return [first.top - frame.vh * 1.3, first.top - frame.vh * 0.72];
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.present()) return;
    let points: ScreenPoint[];
    let occluders = 0;
    const occlude = (rect: Rect, pad: number) => {
      if (occluders >= 4 || rect.width <= 0 || rect.top > frame.ch || rect.top + rect.height < 0) return;
      out.occ[occluders].set(rect.left - pad, rect.top - pad, rect.width + pad * 2, rect.height + pad * 2);
      out.occR.setComponent(occluders, 4);
      occluders += 1;
    };
    // Off screen they are skipped, which leaves the slots to the lifted sheets once the stage is pinned.
    for (const box of [this.heading, this.bands]) {
      if (!box.width) continue;
      this.rect.left = box.left;
      this.rect.top = box.top - frame.y;
      this.rect.width = box.width;
      this.rect.height = box.height;
      occlude(this.rect, 4);
    }

    if (this.mode === 'track' && this.stairs) {
      const m = this.stairs;
      const top = stickyTop(this.pin, this.runway, frame.y);
      const left = this.pin.left;
      const progress = stairsProgress(this.runway, m.pin.height, frame.y);
      const focus = stairsFocus(progress);
      const offset = trackPose(m, progress);
      points = stairEdges(m, this.camera, offset);
      for (const point of points) { point[0] += left; point[1] += top; }
      // The lifted sheets stand in front of the thread: it passes behind them, never across a problem.
      for (let i = 0; i < m.stacks.length; i += 1) {
        const lift = sheetLift(focus, i);
        if (lift < 0.04) continue;
        const rect = sheetRect(m, this.camera, offset, i, lift);
        this.rect.left = rect.left + left;
        this.rect.top = rect.top + top;
        this.rect.width = rect.width;
        this.rect.height = rect.height;
        occlude(this.rect, 6);
      }
    } else {
      const onScreen = this.boxes.map(box => ({ left: box.left, top: box.top - frame.y, width: box.width, height: box.height }));
      points = flatEdges(onScreen, GUTTER);
      for (const sheet of this.sheets) {
        this.rect.left = sheet.left;
        this.rect.top = sheet.top - frame.y;
        this.rect.width = sheet.width;
        this.rect.height = sheet.height;
        occlude(this.rect, 8);
      }
    }

    // Only the stairs on screen (and a margin) are handed on, so the line stays dense however long the climb.
    const seen = clipToView(points, -VIEW_MARGIN, -VIEW_MARGIN, frame.cw + VIEW_MARGIN, frame.ch + VIEW_MARGIN);
    // Shape space is the screen itself, about its centre with y up: the shape is placed at the centre, unscaled.
    for (const point of seen) { point[0] -= frame.cw / 2; point[1] = frame.ch / 2 - point[1]; }
    resampleInto(seen, this.data);
    out.shape = SHAPE.poly;
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    out.p[0].set(row, 0.42, frame.still ? 0 : 0.0035, 1);
    out.data = this.data;
    out.look.set(2.6, 0.95, 0.16, 0);
    out.shade.y = 7;
    out.flowing = !frame.still;
  }
}

/** How the thread arrives in this scene from wherever it was: gathered up out of the dust into the stair line, left to right. */
export function archiveLeg(self: ArchiveScene): Leg | null {
  return {
    to: 'archive',
    window: frame => self.arrival(frame),
    stagger: 0.55,
    orderByU: 0.85,
    swirl: 46,
    lift: 60,
  };
}

/** What this scene draws besides the thread: nothing; the stacks are the chapter's own CSS 3D. */
export function createArchiveExtras(_self: ArchiveScene, _style: CSSStyleDeclaration, _still: boolean): Extra[] {
  return [];
}
