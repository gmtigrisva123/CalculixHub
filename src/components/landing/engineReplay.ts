/**
 * The engine replay as a pure function of the playhead.
 *
 * "Watch it find your level" is drawn twice: in the DOM (the readouts, the
 * four beats, the ticker, the SVG chart a machine without WebGL sees) and on
 * the WebGL stage (the ribbon, the glass tier slabs, the beads). Both read
 * their state from here, from the same scroll progress, so the meter, the
 * marker and the 3D curve cannot disagree about which answer the replay is on.
 *
 * Nothing in it is invented: the curve at each step is the engine's own
 * posterior (engineRun.ts runs the real placement against the real item bank),
 * interpolated between one answer and the next.
 */

import { ENGINE_RUN, TIER_BANDS, certainty, type EngineStep } from './engineRun';

export const RUN = ENGINE_RUN;
export const ANSWERS = RUN.steps.length - 1;
export const SURE = RUN.steps.map((_, index) => certainty(RUN, index));

/** Chart geometry, in the SVG chart's viewBox units (the 3D stage maps the same box). */
export const CHART = {
  W: 800,
  PAD: 26,
  BASE: 318,
  CURVE_H: 236,
  RUG: 380,
  RUG_STEP: 16,
  HEIGHT: 440,
  THETA_MIN: -3.4,
  THETA_MAX: 3.4,
} as const;

export const chartX = (theta: number) => CHART.PAD + ((theta - CHART.THETA_MIN) / (CHART.THETA_MAX - CHART.THETA_MIN)) * (CHART.W - 2 * CHART.PAD);

/** Where on the playhead the replay starts and ends: a short hold at either end. */
export const REPLAY_START = 0.07;
export const REPLAY_SPAN = 0.8;

/** Answers at similar difficulty stack upwards instead of overlapping. */
export const RUG_LEVEL = RUN.steps.slice(1).map((step, index, all) =>
  all.slice(0, index).filter(previous => Math.abs(previous.item!.b - step.item!.b) < 0.14).length);

export const DOMAIN_INDEX: Record<string, number> = { Algebra: 0, Geometry: 1, Combinatorics: 2, 'Number Theory': 3 };

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Which beat of the story a replay position belongs to. */
export function beatAt(k: number): number {
  if (k < 0.6) return 0;
  if (k < 5.6) return 1;
  if (k < ANSWERS - 0.4) return 2;
  return 3;
}

export interface ReplayState {
  /** Continuous position through the answers, 0 to ANSWERS. */
  k: number;
  from: EngineStep;
  to: EngineStep;
  fromIndex: number;
  /** Blend from `from` to `to`, eased (or stepped, under reduced motion). */
  t: number;
  theta: number;
  sem: number;
  sure: number;
  tierIndex: number;
  answered: number;
  beat: number;
}

/** The replay at a playhead position (0–1 through the pinned section). */
export function replayAt(progress: number, stepwise: boolean): ReplayState {
  const k = Math.max(0, Math.min(ANSWERS, ((progress - REPLAY_START) / REPLAY_SPAN) * ANSWERS));
  const fromIndex = Math.min(ANSWERS, Math.floor(k));
  const toIndex = Math.min(ANSWERS, fromIndex + 1);
  const raw = k - fromIndex;
  const t = stepwise ? Math.round(raw) : smooth(Math.max(0, Math.min(1, (raw - 0.12) / 0.76)));
  const from = RUN.steps[fromIndex];
  const to = RUN.steps[toIndex];
  const mix = (p: number, q: number) => p + (q - p) * t;
  const theta = mix(from.theta, to.theta);
  const tier = TIER_BANDS.findIndex(band => theta >= band.from && theta < band.to);
  return {
    k,
    from,
    to,
    fromIndex,
    t,
    theta,
    sem: mix(from.sem, to.sem),
    sure: mix(SURE[fromIndex], SURE[toIndex]),
    tierIndex: tier === -1 ? 1 : tier,
    answered: Math.min(ANSWERS, Math.floor(k + 0.88)),
    beat: beatAt(k),
  };
}

/** The posterior weight at grid node `index`, blended for a replay state. */
export function weightAt(state: ReplayState, index: number): number {
  return state.from.weights[index] + (state.to.weights[index] - state.from.weights[index]) * state.t;
}

/** The curve's height (in weight units) at the estimate, for the marker's top. */
export function heightAtEstimate(state: ReplayState): number {
  const position = (state.theta - RUN.grid[0]) / (RUN.grid[1] - RUN.grid[0]);
  const lower = Math.max(0, Math.min(RUN.grid.length - 2, Math.floor(position)));
  const blend = position - lower;
  const at = (step: EngineStep) => step.weights[lower] * (1 - blend) + step.weights[lower + 1] * blend;
  return at(state.from) + (at(state.to) - at(state.from)) * state.t;
}
