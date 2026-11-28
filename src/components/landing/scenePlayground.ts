/**
 * "Two chords. One hidden radius." — the thread's station in the chord problem.
 *
 * The engine's chapter ends on a narrow belief curve, its crest standing over
 * the level it found. When the engine lets go of the page, that crest is
 * carried down onto the paper and bent round into a circle: the circle of the
 * chord problem, drawn in light exactly where the SVG figure's circle is about
 * to be. The thread is there first. Then the figure draws itself in (circle,
 * chords, points) and the light hands over to it: it fades as the ink stroke
 * runs round, down to a faint residual glow, so the thread is still there to
 * shatter into chalk dust when the reader moves on to the topics.
 *
 * The figure itself stays SVG, because it is a control: C can be dragged, the
 * chord turned with a slider or the keyboard. Everything the stage does here
 * follows the DOM, never the other way round:
 *
 *   - The circle is found from a measured wrapper whose box is the SVG's own
 *     box (an SVG element has no offsetTop), the way the browser fits the
 *     viewBox into it.
 *   - The card arrives and tilts toward the pointer on springs integrated by
 *     the page clock (useStageSpring), published by name, so the light reads
 *     the very rise and tilt the card is drawn with this frame and stays on
 *     the stroke while the card moves.
 *   - The handover starts when the figure says it has started to draw
 *     ('chord-draw' on the thread bus), and a figure that was drawn before the
 *     stage arrived says so with `data-drawn`.
 *   - While C is being dragged ('chord-drag') the residual glow comes up a
 *     little: the one thing that refuses to move is the circle.
 */

import { Group } from 'three';
import { docBox, readStageValue, scrollAt, type Box } from './stageLayout';
import { EMPTY_BOX as EMPTY, query, resetSlot } from './threadKit';
import { SHAPE } from './threadShaders';
import { clamp01, lerp } from './threadShapes';
import { ANSWERS, CHART, RUN } from './engineReplay';
import { onThread } from './threadBus';
import { wake } from './pageClock';
import { CARD, CIRCLE_ARRIVES_AT, PLAY_KEYS, circleInBox, tiltPoint } from './chords';
import type { Extra, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

const DEG = Math.PI / 180;

/**
 * Where along the engine's curve its crest stands once the placement is
 * done, as a share of the curve's length (the curve spans THETA_MIN to
 * THETA_MAX): the particle there is the one that goes to the top of the
 * circle, so the peak is seen to bend round into it.
 */
export const CREST_U = (() => {
  const weights = RUN.steps[ANSWERS].weights;
  let best = 0;
  for (let i = 1; i < weights.length; i += 1) if (weights[i] > weights[best]) best = i;
  return clamp01((RUN.grid[best] - CHART.THETA_MIN) / (CHART.THETA_MAX - CHART.THETA_MIN));
})();

/** How long the light takes to hand over to the ink: the figure's circle draws in 1.4 s. */
export const HANDOVER_SECONDS = 1.4;

/** The page's GLIDE curve, cubic-bezier(0.16, 1, 0.3, 1), as a function of time: what the SVG stroke draws on. */
export function glide(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Solve x(s) = t for the bezier's parameter, then read y(s).
  const bez = (s: number, p1: number, p2: number) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (bez(mid, 0.16, 0.3) < t) lo = mid;
    else hi = mid;
  }
  return bez((lo + hi) / 2, 1, 1);
}

/** How far the handover has gone (0 the thread alone, 1 a residual glow under the ink) at `seconds` after the draw began. */
export function handoverAt(seconds: number): number {
  if (seconds < 0) return 0;
  // The light lets go a touch behind the stroke, so the two are seen together for a moment.
  return glide(clamp01((seconds - 0.08) / HANDOVER_SECONDS));
}

/**
 * The light while the thread holds the circle alone, and what it keeps once
 * the ink has it. Over paper a particle is luminous ink: a firm core in the
 * page's blue and a cool aura round it. Large, soft points make that a line
 * of ink about as wide as the SVG's stroke with light bleeding from it. The
 * residual is held tight on the stroke and faint, so what shows is mostly
 * the thread's two crests travelling slowly round under the ink.
 */
const FULL = { size: 4.4, alpha: 0.95, share: 0.13, thickness: 2.2 };
const RESIDUAL = { size: 3.6, alpha: 0.15, share: 0.06, thickness: 1.3 };

export class PlaygroundScene implements ThreadScene {
  id = 'playground';
  private found = false;
  private engine: Box | null = null;
  private figure = EMPTY;
  private card = EMPTY;
  /**
   * In front of the thread on its way in and out: the lead, the problem, the
   * figure's bar and its foot (the last three ride on the card). The heading
   * needs no guard: it stands above the canvas (landing-playground.css), so
   * the curve is seen to pass behind its letters as it falls.
   */
  private guards: { box: Box; onCard: boolean }[] = [];
  /** When the figure began to draw itself (performance.now); 0 if it was drawn before the stage could see it; -1 not yet. */
  drawnAt = -1;
  /** C is being dragged. */
  dragging = false;
  private glowLevel = 0;
  private lastNow = 0;

  measure() {
    const figure = query('[data-chord-figure]');
    const card = query('[data-chord-card]');
    this.found = Boolean(figure && card);
    if (!figure || !card) return;
    this.figure = docBox(figure);
    this.card = docBox(card);
    const engine = query('#engine');
    this.engine = engine ? docBox(engine) : null;
    const guard = (selector: string, onCard: boolean) => {
      const element = query(selector);
      return element ? [{ box: docBox(element), onCard }] : [];
    };
    // The figure's foot: the slider, the readout and the note under it, as one block.
    const control = query('.lx-chord-control');
    const note = query('.lx-chord-note');
    const foot = control && note ? (() => {
      const top = docBox(control);
      const bottom = docBox(note);
      return [{ box: { left: top.left, top: top.top, width: Math.max(top.width, bottom.width), height: bottom.top + bottom.height - top.top }, onCard: true }];
    })() : [];
    this.guards = [
      ...guard('.lx-play .lx-section-head .lx-lead', false),
      ...guard('.lx-play-problem', true),
      ...guard('.lx-figure-bar', true),
      ...foot,
    ];
    if (this.drawnAt < 0 && figure.hasAttribute('data-drawn')) this.drawnAt = 0;
  }

  present() { return this.found; }

  /** The scroll position at which the thread has closed into the circle and the figure begins to draw. */
  arrivedAt(vh: number) {
    return circleInBox(this.figure).y - CIRCLE_ARRIVES_AT * vh;
  }

  /** The stretch of scroll over which the thread travels here: from the moment the engine lets go of the page. */
  arrival(frame: StageFrame): [number, number] {
    const end = this.arrivedAt(frame.vh);
    const released = this.engine ? scrollAt(this.engine, 'end end', frame.vh) : end - frame.vh * 1.4;
    return [Math.min(released, end - frame.vh * 0.3), end];
  }

  /** How far the card still has to rise this frame (px), as the DOM draws it. */
  private rise(frame: StageFrame) {
    if (frame.still) return 0;
    return (1 - (readStageValue(PLAY_KEYS.arrive) ?? 1)) * CARD.RISE;
  }

  /**
   * The circle on screen this frame: its centre, its radius, and how the
   * card's tilt maps the circle's own x and y onto the screen (two columns
   * of a 2D map, CSS px, y down). The tilt is at most 4°, so a circle stays
   * a near-perfect ellipse and this first-order map holds it to a fraction
   * of a pixel.
   */
  circle(frame: StageFrame) {
    const rise = this.rise(frame);
    const rx = frame.still ? 0 : (readStageValue(PLAY_KEYS.tiltX) ?? 0) * DEG;
    const ry = frame.still ? 0 : (readStageValue(PLAY_KEYS.tiltY) ?? 0) * DEG;
    const { x, y, r } = circleInBox(this.figure);
    const ox = this.card.left + this.card.width / 2;
    const oy = this.card.top + this.card.height / 2;
    const dx = x - ox;
    const dy = y - oy;
    const at = (px: number, py: number) => tiltPoint(px, py, rx, ry, CARD.PERSPECTIVE);
    const [cx, cy] = at(dx, dy);
    const [rightX, rightY] = at(dx + r, dy);
    const [leftX, leftY] = at(dx - r, dy);
    const [downX, downY] = at(dx, dy + r);
    const [upX, upY] = at(dx, dy - r);
    return {
      x: ox + cx,
      y: oy - frame.y + rise + cy,
      r,
      a: [(rightX - leftX) / (2 * r), (rightY - leftY) / (2 * r)] as const,
      b: [(downX - upX) / (2 * r), (downY - upY) / (2 * r)] as const,
      rise,
    };
  }

  /** 0 while the thread holds the circle alone, 1 once the ink has it. */
  handover(frame: StageFrame) {
    if (this.drawnAt < 0) return 0;
    if (frame.still || this.drawnAt === 0) return 1;
    return handoverAt((frame.now - this.drawnAt) / 1000);
  }

  slot(frame: StageFrame, out: Slot) {
    resetSlot(out);
    if (!this.found) return;
    const circle = this.circle(frame);
    out.shape = SHAPE.circle;
    // The circle's local x and y (y up) onto the screen through the tilt's map, then into world space (y up).
    const [ax, ay] = circle.a;
    const [bx, by] = circle.b;
    out.matrix.set(
      ax, -bx, 0, circle.x - frame.cw / 2,
      -ay, by, 0, frame.ch / 2 - circle.y,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );

    // The glow comes up while C is dragged, and eases back when it is let go.
    const dt = this.lastNow ? Math.min(0.05, (frame.now - this.lastNow) / 1000) : 0;
    this.lastNow = frame.now;
    const want = this.dragging ? 1 : 0;
    this.glowLevel = frame.still ? want : this.glowLevel + (want - this.glowLevel) * (1 - Math.exp(-dt * (want ? 7 : 3.2)));
    if (Math.abs(this.glowLevel - want) < 0.002) this.glowLevel = want;
    const glow = this.glowLevel * this.handover(frame);

    const fade = this.handover(frame);
    // The crest of the engine's curve goes to the top of the circle.
    out.p[0].set(circle.r, CREST_U, lerp(FULL.thickness, RESIDUAL.thickness, fade), 0);
    out.look.set(
      lerp(FULL.size, RESIDUAL.size, fade) + glow * 0.6,
      lerp(FULL.alpha, RESIDUAL.alpha, fade) + glow * 0.42,
      lerp(FULL.share, RESIDUAL.share, fade) + glow * 0.03,
      0,
    );

    // What the thread passes behind on its way in, and must never cover: the words, and the card's other column.
    this.guards.slice(0, 4).forEach(({ box, onCard }, index) => {
      const lift = onCard ? circle.rise : 0;
      out.occ[index].set(box.left - 10, box.top - frame.y + lift - 8, box.width + 20, box.height + 16);
    });
    out.occR.set(10, 10, 12, 6);
    out.shade.y = 12;
    // The glow's two crests keep travelling slowly round the circle: the thread is still here, alive, under
    // the ink. Held still, they would sit as two smudges on the stroke, so with reduced motion the glow goes.
    if (frame.still) out.look.y *= 1 - fade;
    out.flowing = !frame.still;
  }
}

/** The thread arrives from the engine: the narrowed curve leaves the stage, falls onto the paper and closes into the circle. */
export function playgroundLeg(self: PlaygroundScene): Leg {
  return {
    to: 'playground',
    window: frame => (self.present() ? self.arrival(frame) : null),
    // Nearly together, so the curve keeps its shape as it falls and is seen to bend round; a little in
    // order along the thread, so the circle closes from the curve's tail, over its crest, and round.
    stagger: 0.3,
    orderByU: 0.9,
    swirl: 30,
    lift: 150,
  };
}

/** Nothing to draw besides the thread; this listens for the figure's moments and wakes the stage for them. */
export function createPlaygroundExtras(self: PlaygroundScene, _style: CSSStyleDeclaration, still: boolean): Extra[] {
  // With nothing moving on its own (reduced motion) a woken stage would not draw, so a moment asks for a frame.
  let redraw = 0;
  const stop = onThread(event => {
    if (event.type === 'chord-draw') {
      if (self.drawnAt < 0) self.drawnAt = still ? 0 : performance.now();
    } else if (event.type === 'chord-drag') {
      self.dragging = event.active;
    } else {
      return;
    }
    redraw = 2;
    wake();
  });
  return [{
    object: new Group(),
    update: () => {
      if (redraw <= 0) return false;
      redraw -= 1;
      return true;
    },
    dispose: stop,
  }];
}
