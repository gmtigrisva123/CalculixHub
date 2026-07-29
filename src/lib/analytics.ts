/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserStats, Topic } from '../types';

/**
 * Learner analytics: progress forecasting, error-pattern analysis, and the
 * multi-dimensional performance metrics used by the ranking system.
 *
 * Everything here is derived from real recorded activity — when there isn't
 * enough history to support a claim, the functions say so rather than
 * fabricating a trend.
 */

// --- Progress prediction --------------------------------------------------

export interface ProgressForecast {
  /** Points per active day, fitted by least squares over the timeline. */
  velocity: number;
  /** Projected point totals at +7 / +30 days. */
  projected7d: number;
  projected30d: number;
  /** Projected mastery percentage at +30 days, capped at 100. */
  projectedMastery30d: number;
  /** How much history backs this forecast. */
  confidence: 'none' | 'low' | 'moderate' | 'high';
  /** Days of recorded activity the forecast is based on. */
  sampleDays: number;
  trend: 'accelerating' | 'steady' | 'slowing' | 'unknown';
}

/**
 * Least-squares linear fit over the learning timeline to project the learner's
 * improvement trajectory. Confidence scales with how many days of real data
 * are available — a two-point line is reported as low confidence, not as fact.
 */
export function forecastProgress(stats: UserStats): ProgressForecast {
  const timeline = stats.learningTimeline || [];
  const n = timeline.length;

  if (n < 2) {
    return {
      velocity: 0,
      projected7d: stats.points,
      projected30d: stats.points,
      projectedMastery30d: averageMastery(stats),
      confidence: 'none',
      sampleDays: n,
      trend: 'unknown',
    };
  }

  // Regress points against day index.
  const xs = timeline.map((_, i) => i);
  const ys = timeline.map((t) => t.points);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const velocity = Math.max(0, slope);

  // Compare the recent half's slope against the earlier half to detect
  // acceleration or slow-down.
  let trend: ProgressForecast['trend'] = 'unknown';
  if (n >= 4) {
    const mid = Math.floor(n / 2);
    const earlyRate = (ys[mid] - ys[0]) / Math.max(1, mid);
    const lateRate = (ys[n - 1] - ys[mid]) / Math.max(1, n - 1 - mid);
    if (lateRate > earlyRate * 1.15) trend = 'accelerating';
    else if (lateRate < earlyRate * 0.85) trend = 'slowing';
    else trend = 'steady';
  }

  const confidence: ProgressForecast['confidence'] =
    n >= 10 ? 'high' : n >= 5 ? 'moderate' : 'low';

  const currentMastery = averageMastery(stats);
  // Mastery gains compound more slowly than points; damp the projection.
  const masteryGain = Math.min(30, (velocity / 10) * 30 * 0.6);

  return {
    velocity: Math.round(velocity * 10) / 10,
    projected7d: Math.round(stats.points + velocity * 7),
    projected30d: Math.round(stats.points + velocity * 30),
    projectedMastery30d: Math.min(100, Math.round(currentMastery + masteryGain)),
    confidence,
    sampleDays: n,
    trend,
  };
}

export function averageMastery(stats: UserStats): number {
  const values = Object.values(stats.skills);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// --- Error pattern analysis ----------------------------------------------

export type ErrorClass = 'conceptual' | 'computational' | 'none';

export interface ErrorPattern {
  topic: Topic;
  /** Mastery percentage in this domain. */
  mastery: number;
  classification: ErrorClass;
  /** Human-readable diagnosis of the likely failure mode. */
  diagnosis: string;
  /** Concrete remediation step. */
  remediation: string;
  severity: 'critical' | 'moderate' | 'minor';
}

/**
 * Distinguishes conceptual gaps from computational slips using the combination
 * of domain mastery and overall accuracy, following the blueprint's error
 * pattern analysis brief.
 *
 * Low mastery + low accuracy  -> conceptual gap (the method itself is missing)
 * Low mastery + high accuracy -> computational slips (method is known, execution fails)
 */
export function analyzeErrorPatterns(stats: UserStats): ErrorPattern[] {
  const entries = Object.entries(stats.skills) as [Topic, number][];

  return entries
    .filter(([, mastery]) => mastery < 70)
    .map(([topic, mastery]) => {
      const severity: ErrorPattern['severity'] =
        mastery < 30 ? 'critical' : mastery < 55 ? 'moderate' : 'minor';

      // With no attempts recorded yet there is nothing to diagnose.
      if (stats.completedCount === 0) {
        return {
          topic,
          mastery,
          classification: 'none' as ErrorClass,
          diagnosis: 'No attempts recorded yet in this domain.',
          remediation: `Solve a few Foundation-tier ${topic} problems so the engine can profile your reasoning.`,
          severity,
        };
      }

      const classification: ErrorClass = stats.accuracy >= 70 ? 'computational' : 'conceptual';

      const diagnosis =
        classification === 'computational'
          ? `Your overall accuracy is ${stats.accuracy}%, so the method is largely there — losses in ${topic} look like execution slips: sign errors, dropped cases, or arithmetic under time pressure.`
          : `Mastery in ${topic} sits at ${mastery}% alongside ${stats.accuracy}% overall accuracy, which points to a genuine conceptual gap rather than careless mistakes.`;

      const remediation =
        classification === 'computational'
          ? `Re-derive each ${topic} solution by hand immediately after a miss, and write out every intermediate step instead of doing them mentally.`
          : `Work ${topic} problems one tier below your current level until the underlying technique is automatic, then step back up.`;

      return { topic, mastery, classification, diagnosis, remediation, severity };
    })
    .sort((a, b) => a.mastery - b.mastery);
}

// --- Multi-dimensional performance metrics -------------------------------

export interface PerformanceMetrics {
  /** 0–100, faster solving scores higher. */
  speed: number;
  /** 0–100, straight accuracy. */
  accuracy: number;
  /** 0–100, how evenly effort is distributed across active days. */
  consistency: number;
  /** 0–100, rate of measured improvement. */
  improvement: number;
  /** Mean of the four axes. */
  overall: number;
}

const TARGET_MIN_PER_PROBLEM = 4;

/**
 * Computes the four ranking axes from real activity. Each returns 0 when there
 * isn't enough data to measure it, rather than a flattering default.
 */
export function computeMetrics(stats: UserStats): PerformanceMetrics {
  // Speed: how the learner's pace compares against the target minutes/problem.
  const avgMin = stats.completedCount > 0 ? stats.timeSpent / stats.completedCount : 0;
  const speed =
    stats.completedCount === 0 || avgMin <= 0
      ? 0
      : Math.round(Math.max(0, Math.min(100, (TARGET_MIN_PER_PROBLEM / avgMin) * 100)));

  const accuracy = stats.completedCount === 0 ? 0 : Math.round(stats.accuracy);

  // Consistency: inverse coefficient of variation of daily point gains.
  const timeline = stats.learningTimeline || [];
  let consistency = 0;
  if (timeline.length >= 2) {
    const gains: number[] = [];
    for (let i = 1; i < timeline.length; i++) {
      gains.push(Math.max(0, timeline[i].points - timeline[i - 1].points));
    }
    const mean = gains.reduce((s, v) => s + v, 0) / gains.length;
    if (mean > 0) {
      const variance = gains.reduce((s, v) => s + (v - mean) ** 2, 0) / gains.length;
      const cv = Math.sqrt(variance) / mean;
      consistency = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
    }
  }

  // Improvement: measured growth across the recorded timeline.
  let improvement = 0;
  if (timeline.length >= 2) {
    const first = timeline[0].points;
    const last = timeline[timeline.length - 1].points;
    const growth = last - first;
    improvement = Math.round(Math.max(0, Math.min(100, (growth / Math.max(50, first + 50)) * 100)));
  }

  const overall = Math.round((speed + accuracy + consistency + improvement) / 4);

  return { speed, accuracy, consistency, improvement, overall };
}

// --- Personalized learning path ------------------------------------------

export interface PathStep {
  order: number;
  topic: Topic;
  tier: 'Foundation' | 'Advanced' | 'Olympiad';
  focus: string;
  rationale: string;
  status: 'current' | 'next' | 'queued';
}

/**
 * Builds a personalized learning path (PLP): weakest domains first, at the
 * content tier appropriate to the learner's demonstrated mastery in each.
 */
export function buildLearningPath(stats: UserStats): PathStep[] {
  const entries = (Object.entries(stats.skills) as [Topic, number][]).sort((a, b) => a[1] - b[1]);

  const tierFor = (mastery: number): PathStep['tier'] =>
    mastery >= 70 ? 'Olympiad' : mastery >= 40 ? 'Advanced' : 'Foundation';

  const focusFor: Record<Topic, string> = {
    Algebra: 'Symmetric expressions, inequalities, and equality cases',
    Geometry: 'Auxiliary constructions and cyclic quadrilateral techniques',
    Combinatorics: 'Bijections, stars-and-bars, and double counting',
    'Number Theory': 'Modular arithmetic, totients, and order arguments',
  };

  return entries.map(([topic, mastery], idx) => ({
    order: idx + 1,
    topic,
    tier: tierFor(mastery),
    focus: focusFor[topic],
    rationale:
      idx === 0
        ? `Lowest measured mastery (${mastery}%) — the highest-leverage place to spend your next sessions.`
        : `Mastery ${mastery}%. Queued after stronger-priority gaps are closed.`,
    status: idx === 0 ? 'current' : idx === 1 ? 'next' : 'queued',
  }));
}
