/**
 * The thread's stations: where it is in each chapter, and how it travels
 * between them.
 *
 *   hero     the Lorenz butterfly, flowing; it loosens and slows as the sheet
 *            covers it, and its particles are drawn into one thread
 *   idea     that thread, hanging across the screen while the sheet of paper
 *            slides beneath it (words light as it passes them), until the
 *            sheet's foot rule arrives and the thread settles on it
 *   engine   the rule lifts into the engine's belief curve, the real
 *            posterior of a real placement, scrubbed by the scroll
 *
 * Every position is worked out from layout measured when the page changes
 * (stageLayout.ts) and the scroll of this frame, with the same formulas the
 * DOM uses for its own transforms, so the light sits exactly on the page.
 */

import { Matrix4, Vector3 } from 'three';
import { docBox, progressAt, type Box } from './stageLayout';
import { EMPTY_BOX as EMPTY, cameraDistance, follow, place, query, resetSlot, stageRadius, stickyTop } from './threadKit';
import { POLY_SAMPLES, clamp01, curveHeights, lerp, smoothstep } from './threadShapes';
import { SHAPE } from './threadShaders';
import { CHART, ENGINE_UNPINNED_EDGES, REPLAY_START, RUN, replayAt, weightAt } from './engineReplay';
import { TILT, TURN } from './ParticleField';
import type { InkRect, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

export { follow, place, resetSlot, stageRadius, stickyTop } from './threadKit';

// ---------------------------------------------------------------------------
// The hero: the butterfly
// ---------------------------------------------------------------------------

/** The hero stage's transform while the sheet covers it: matches Opening.tsx exactly. */
export function heroRecede(cover: number, still: boolean) {
  return { scale: still ? 1 : lerp(1, 0.9, cover), lift: still ? 0 : -0.04 * cover };
}

export class HeroScene implements ThreadScene {
  id = 'hero';
  private opening = EMPTY;
  private hero = EMPTY;
  private stage = EMPTY;
  private sheet = EMPTY;
  private radius = 14;
  private found = false;
  private yaw = { x: 0, v: 0 };
  private pitch = { x: 0, v: 0 };
  private power = 0;
  private introAt = 0;
  /** Exposed for the paper curl: where the sheet's top edge is. */
  sheetBox = EMPTY;

  measure() {
    const opening = query('.lx-opening');
    const hero = query('.lx-hero');
    const stage = query('.lx-hero-stage');
    const sheet = query('.lx-manifesto');
    this.found = Boolean(opening && hero && stage && sheet);
    if (!this.found) return;
    this.opening = docBox(opening);
    // A sticky element's static place is the top of its container (it is the first child).
    this.hero = { ...docBox(hero), top: this.opening.top };
    this.stage = docBox(stage, hero);
    this.sheet = docBox(sheet);
    this.sheetBox = this.sheet;
    this.radius = stageRadius();
  }

  present() { return this.found; }

  cover(frame: StageFrame) {
    return progressAt(this.sheet, ['start end', 'start start'], frame.y, frame.vh);
  }

  /** The stage on screen this frame, after it recedes. */
  stageRect(frame: StageFrame) {
    const top = stickyTop(this.hero, this.opening, frame.y) + this.stage.top;
    const { scale, lift } = heroRecede(this.cover(frame), frame.still);
    const originX = this.stage.left + this.stage.width / 2;
    const originY = top + this.stage.height * 0.2;
    const x = originX + (this.stage.left - originX) * scale;
    const y = originY + (top - originY) * scale + lift * frame.vh;
    return { x, y, w: this.stage.width * scale, h: this.stage.height * scale, r: this.radius * scale, scale };
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.found) return;
    const rect = this.stageRect(frame);
    // Under the sheet, the stage is paper: only its uncovered part is night.
    const sheetTop = this.sheet.top - frame.y;
    const h = Math.min(rect.h, sheetTop - rect.y);
    if (h > 0) out.push({ x: rect.x, y: rect.y, w: rect.w, h: Math.max(0, h), r: rect.r });
  }

  slot(frame: StageFrame, out: Slot) {
    resetSlot(out);
    if (!this.found) return;
    const cover = this.cover(frame);
    const rect = this.stageRect(frame);
    const wide = this.stage.width >= 960;
    const aspect = this.stage.width / Math.max(1, this.stage.height);
    // The framing ParticleField had: right of the words when wide, above them when narrow.
    let cx = rect.x + rect.w * (wide ? 0.75 : 0.5);
    let cy = rect.y + rect.h * (wide ? 0.48 : 0.5 - (aspect < 0.8 ? 0.27 : 0.2));
    if (!wide && frame.vw <= 760 && frame.vh <= 740) cy -= rect.h * 0.16;
    const share = wide ? 0.77 : 0.78;
    const ppu = ((Math.min(rect.w, rect.h) / 2) * share) / 2.75 / (wide ? 1 : 1.04);
    if (!wide) cx = rect.x + rect.w * 0.5;

    // The camera orbits with the pointer: at most ±5° of yaw and ±3° of pitch, on the follow spring.
    const p = frame.pointer;
    const inside = p.active && p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h && cover < 0.6;
    const targetYaw = inside && !frame.still ? ((p.x - rect.x) / rect.w - 0.5) * 2 * (5 * Math.PI / 180) : 0;
    const targetPitch = inside && !frame.still ? ((p.y - rect.y) / rect.h - 0.5) * 2 * (3 * Math.PI / 180) : 0;
    follow(this.yaw, targetYaw, frame.dt);
    follow(this.pitch, targetPitch, frame.dt);
    this.power += ((inside ? 1 : 0) - this.power) * (1 - Math.exp(-frame.dt * 4));

    if (!this.introAt) this.introAt = frame.now;
    const intro = frame.still ? 1 : clamp01((frame.now - this.introAt) / 2600);
    const sway = frame.still ? 0 : 0.28 * Math.sin(frame.time * 0.09);

    out.shape = SHAPE.lorenz;
    place(out.matrix, frame, cx, cy, ppu, ppu * 1.45, [TILT + this.pitch.x, TURN + sway + this.yaw.x, 0.04]);
    // It loosens and slows as the sheet covers it. The threads are only a few pixels apart, so the
    // loosening starts gently (eased in) or the form would dissolve in the first touch of the wheel.
    out.p[0].set(0.0075 * (1 - 0.7 * cover), cover ** 2.4, intro, 0.01);
    const base = frame.cw < 760 ? 0.03 : 0.024;
    out.look.set(1.9 * base * ppu, (1 - 0.7 * cover) * (1 - 0.5 * cover), 1, 1);
    out.clip.set(rect.x, rect.y, rect.w, rect.h);
    out.shade.set(rect.r, 2, wide ? 0.72 : 0, wide ? 0.7 : 0.9);
    // The sheet in front: everything below its top edge is covered, except what has lifted onto it.
    const sheetTop = this.sheet.top - frame.y;
    if (sheetTop < frame.ch) {
      // The curled lip stands a little proud of the edge; the butterfly is behind that too.
      const lip = (this.sheetEdge(frame)?.curl ?? 0) * 8;
      out.occ[0].set(this.sheet.left, sheetTop - lip, this.sheet.width, frame.ch * 2);
      out.occR.x = this.radius;
    }
    out.flowing = !frame.still;
    out.pointer = frame.still ? 0 : this.power;
    out.pointerRadius = Math.min(rect.w, rect.h) * 0.17;
  }

  /**
   * The sheet's leading edge while it slides over the hero: curled while it
   * moves (more when it moves fast), flat once it has settled at the top.
   */
  sheetEdge(frame: StageFrame) {
    if (!this.found) return null;
    const cover = this.cover(frame);
    if (cover <= 0.001 || cover >= 0.999) return null;
    const motion = frame.still ? 0.6 : 0.55 + 0.45 * Math.min(1, Math.abs(frame.vy) / 1600);
    const curl = smoothstep(0, 0.05, cover) * (1 - smoothstep(0.78, 1, cover)) * motion;
    return { x: this.sheet.left, y: this.sheet.top - frame.y, w: this.sheet.width, r: this.radius, curl };
  }

  /** True while the intro is still assembling or the pointer springs are moving. */
  settling(frame: StageFrame) {
    return (!frame.still && frame.now - this.introAt < 2700) || Math.abs(this.yaw.v) + Math.abs(this.pitch.v) > 1e-4;
  }
}

// ---------------------------------------------------------------------------
// The idea: one line across the sheet
// ---------------------------------------------------------------------------

/** Where the thread hangs while the sheet slides beneath it, as a share of the screen's height. */
export const READING_LINE = 0.8;

export class IdeaScene implements ThreadScene {
  id = 'idea';
  private foot = EMPTY;
  private sub = EMPTY;
  private cta = EMPTY;
  private text = EMPTY;
  /** The centre of each word of the idea, in reading order, for the reading bead. */
  private words: number[] = [];
  private found = false;

  measure() {
    const foot = query('.lx-idea-foot');
    this.found = Boolean(foot);
    if (!foot) return;
    this.foot = docBox(foot);
    this.sub = docBox(query('.lx-idea-sub'));
    this.cta = docBox(query('.lx-idea-cta'));
    const heading = query('.lx-idea');
    this.text = docBox(heading);
    this.words = Array.from(heading?.querySelectorAll<HTMLElement>('.lx-lit') ?? []).map(word => {
      const box = docBox(word);
      return box.left + box.width / 2;
    });
  }

  /**
   * The bead of light that reads along the thread: it rides under the word
   * being lit (the words light by the same progress, in Opening.tsx), and
   * fades once the last one has been read.
   */
  private bead(frame: StageFrame): [number, number] {
    if (!this.words.length) return [0, 0];
    const progress = progressAt(this.text, ['start 0.85', 'end 0.5'], frame.y, frame.vh);
    const at = Math.min(this.words.length - 1, progress * this.words.length);
    const i = Math.floor(at);
    const x = lerp(this.words[i], this.words[Math.min(this.words.length - 1, i + 1)], at - i);
    const strength = smoothstep(0, 0.04, progress) * (1 - smoothstep(0.92, 1, progress));
    return [clamp01((x - this.foot.left) / Math.max(1, this.foot.width)), strength * 2.2];
  }

  present() { return this.found; }

  /** The rule's place on screen, or the reading line while the rule is still below it. */
  lineY(frame: StageFrame) {
    return Math.min(frame.vh * READING_LINE, this.foot.top - frame.y);
  }

  footTop() { return this.foot.top; }

  slot(frame: StageFrame, out: Slot) {
    resetSlot(out);
    if (!this.found) return;
    const y = this.lineY(frame);
    out.shape = SHAPE.line;
    place(out.matrix, frame, this.foot.left + this.foot.width / 2, y);
    // The line holds still (the reading bead needs it to, and a resting line has no reason to move).
    const [bead, strength] = this.bead(frame);
    out.p[0].set(this.foot.width, 1.2, 2.4, 0);
    out.p[1].set(bead, strength, 0, 0);
    out.look.set(2.5, 0.95, 0.13, 0);
    // The words under the rule sit in front of a thread on its way down to the engine.
    const occ = [this.sub, this.cta];
    occ.forEach((box, index) => {
      if (box.width) out.occ[index].set(box.left - 8, box.top - frame.y - 6, box.width + 16, box.height + 12);
    });
    out.occR.set(6, 6, 0, 0);
    out.shade.y = 10;
    // At rest on the rule the line is still: a stage that only drifts a hair would redraw every frame for nothing.
    out.flowing = false;
  }
}

// ---------------------------------------------------------------------------
// The engine: the belief curve
// ---------------------------------------------------------------------------

export interface ChartFrame {
  /** Chart space (viewBox units about the axis centre, y up, z toward the viewer) to world. */
  matrix: Matrix4;
  /** A chart-space point, on screen (CSS px). */
  project(x: number, y: number, z?: number): [number, number];
  /** Pixels per chart unit at the axis, after the stage's scale. */
  unit: number;
  stage: InkRect & { scale: number };
  playhead: number;
  arrival: number;
  /** The pinned stage's top on screen: what the DOM inside it moves with. */
  pinTop: number;
}

/** Where the engine's camera is for a playhead: a slow dolly in with a slight rise, then a tilt down the axis at the verdict. */
export function engineCamera(playhead: number, still: boolean) {
  if (still) return { pitch: 0.12, yaw: 0, zoom: 1 };
  const dolly = smoothstep(0.02, 0.9, playhead);
  const verdict = smoothstep(0.86, 0.97, playhead);
  return { pitch: 0.06 + 0.14 * dolly + 0.3 * verdict, yaw: -0.3 * verdict, zoom: 0.97 + 0.07 * dolly - 0.02 * verdict };
}

const chartPoint = new Vector3();

export class EngineScene implements ThreadScene {
  id = 'engine';
  private section = EMPTY;
  private pin = EMPTY;
  private stage = EMPTY;
  private chart = EMPTY;
  private radius = 14;
  private found = false;
  private heights = new Float32Array(POLY_SAMPLES);
  private data = new Float32Array(POLY_SAMPLES * 4);
  private weights = new Float64Array(RUN.grid.length);
  private matrix = new Matrix4();
  /** Whether the section is pinned (the DOM says so on data-pinned, from the same media query). */
  private pinned = true;
  /** Boxes inside the pin, for the meshes' occluders and the labels. */
  boxes: Record<string, Box> = {};

  measure() {
    const section = query('.lx-engine');
    const pin = query('.lx-engine-pin');
    const stage = query('.lx-engine-stage');
    const chart = query('[data-engine-chart]');
    this.found = Boolean(section && pin && stage && chart);
    if (!this.found) return;
    this.section = docBox(section);
    this.pin = { ...docBox(pin), top: this.section.top };
    this.pinned = section?.dataset.pinned !== 'false';
    this.stage = docBox(stage, pin);
    this.chart = docBox(chart, pin);
    for (const name of ['readouts', 'verdict', 'ticker', 'beats', 'engine-cta']) {
      this.boxes[name] = docBox(query(`.lx-engine-stage .lx-${name}`), pin);
    }
    this.radius = stageRadius();
  }

  present() { return this.found; }

  sectionBox() { return this.section; }

  /** The stage's box inside the pin, before its arrival scale. */
  stageBox() { return this.stage; }

  /** Where the chart is this frame: the pin on screen, the stage's arrival scale, then the camera. */
  chartFrame(frame: StageFrame): ChartFrame {
    const pinTop = this.pinned ? stickyTop(this.pin, this.section, frame.y) : this.pin.top - frame.y;
    const arrival = progressAt(this.section, ['start end', 'start start'], frame.y, frame.vh);
    const playhead = this.pinned
      ? progressAt(this.section, ['start start', 'end end'], frame.y, frame.vh)
      : progressAt({ ...this.chart, top: this.pin.top + this.chart.top }, ENGINE_UNPINNED_EDGES, frame.y, frame.vh);
    const scale = frame.still ? 1 : lerp(0.9, 1, arrival);
    const stageTop = pinTop + this.stage.top;
    const originX = this.stage.left + this.stage.width / 2;
    const k = Math.min(this.chart.width / CHART.W, this.chart.height / CHART.HEIGHT);
    const offX = this.chart.left + (this.chart.width - CHART.W * k) / 2;
    const offY = pinTop + this.chart.top + (this.chart.height - CHART.HEIGHT * k) / 2;
    // The stage scales about its top centre (transform-origin: 50% 0%).
    const sx = originX + (offX + (CHART.W / 2) * k - originX) * scale;
    const sy = stageTop + (offY + CHART.BASE * k - stageTop) * scale;
    const unit = k * scale;
    const camera = engineCamera(playhead, frame.still);
    place(this.matrix, frame, sx, sy, unit * camera.zoom, unit * camera.zoom, [camera.pitch, camera.yaw, 0]);
    const matrix = this.matrix;
    const distance = cameraDistance(frame.ch);
    const project = (x: number, y: number, z = 0): [number, number] => {
      chartPoint.set(x, y, z).applyMatrix4(matrix);
      const f = distance / (distance - chartPoint.z);
      return [frame.cw / 2 + chartPoint.x * f, frame.ch / 2 - chartPoint.y * f];
    };
    return {
      matrix,
      project,
      unit,
      stage: {
        x: originX + (this.stage.left - originX) * scale,
        y: stageTop,
        w: this.stage.width * scale,
        h: this.stage.height * scale,
        r: this.radius,
        scale,
      },
      playhead,
      arrival,
      pinTop,
    };
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.found) return;
    const { stage } = this.chartFrame(frame);
    if (stage.y < frame.ch && stage.y + stage.h > 0) out.push(stage);
  }

  /** The curve's samples for a replay position: the engine's posterior, blended between answers. */
  curve(playhead: number, still: boolean) {
    const state = replayAt(playhead, still);
    for (let i = 0; i < this.weights.length; i += 1) this.weights[i] = weightAt(state, i);
    curveHeights(RUN.grid, this.weights as unknown as number[], RUN.peak, CHART.THETA_MIN, CHART.THETA_MAX, POLY_SAMPLES, this.heights);
    for (let i = 0; i < POLY_SAMPLES; i += 1) this.data[i * 4] = this.heights[i];
    return { state, data: this.data, heights: this.heights };
  }

  /** How far the thread has lifted off the axis into the prior (it rests flat until the pin begins). */
  lift(playhead: number, still: boolean) {
    return still ? 1 : smoothstep(0, REPLAY_START * 0.9, playhead);
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.found) return;
    const chart = this.chartFrame(frame);
    const { data } = this.curve(chart.playhead, frame.still);
    out.shape = SHAPE.curve;
    out.matrix.copy(chart.matrix);
    out.p[0].set(CHART.W - 2 * CHART.PAD, CHART.CURVE_H, this.lift(chart.playhead, frame.still), 1.4);
    out.p[1].set(row, 0, 0, 0);
    out.data = data;
    out.look.set(2.2, 1.2, 0.13, 0);
    out.clip.set(chart.stage.x, chart.stage.y, chart.stage.w, chart.stage.h);
    out.shade.set(chart.stage.r, 10, 0, 0);
    // The stage's words are in front: a thread leaving the chart passes behind the beats, the verdict and the button.
    const { scale } = chart.stage;
    const panels = ['beats', 'engine-cta', 'ticker', ...(replayAt(chart.playhead, frame.still).beat === 3 ? ['verdict'] : [])];
    panels.slice(0, 4).forEach((name, i) => {
      const box = this.boxes[name];
      if (!box?.width) return;
      out.occ[i].set(chart.stage.x + (box.left - this.stage.left) * scale - 8, chart.stage.y + (box.top - this.stage.top) * scale - 8, box.width * scale + 16, box.height * scale + 16);
      out.occR.setComponent(i, 10);
    });
  }
}

// ---------------------------------------------------------------------------
// The legs between them
// ---------------------------------------------------------------------------

export function createLegs(hero: HeroScene, _idea: IdeaScene, engine: EngineScene): Leg[] {
  return [
    {
      to: 'idea',
      // While the sheet covers the hero: its particles are drawn into one thread hanging over the page.
      window: frame => {
        if (!hero.present()) return null;
        const start = hero.sheetBox.top - frame.vh;
        return [start + frame.vh * 0.04, start + frame.vh * 0.62];
      },
      // A long stagger, ordered mostly along the path: the thread is drawn out of the tangle
      // end first, so the butterfly stays itself while it unravels instead of dissolving at once.
      stagger: 2.2,
      orderByU: 0.6,
      swirl: 36,
      lift: 70,
    },
    {
      to: 'engine',
      // While the engine's stage arrives: the rule peels off the sheet and drops onto the stage's axis.
      window: frame => {
        if (!engine.present()) return null;
        const top = engine.sectionBox().top;
        return [top - frame.vh * 0.92, top - frame.vh * 0.04];
      },
      stagger: 0.45,
      orderByU: 0.6,
      swirl: 40,
      lift: 90,
    },
  ];
}
