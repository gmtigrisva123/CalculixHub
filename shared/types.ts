/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';
export type Level = 'Foundation' | 'Advanced' | 'Olympiad';
export type CompetitionLevel = 'AMC' | 'AIME' | 'USAMO' | 'IMO';
export type AnswerMode = 'choice' | 'numeric-grid' | 'proof';

export interface GeometryFigure {
  kind: 'triangle' | 'circle' | 'quadrilateral' | 'coordinate-grid' | 'regular-polygon';
  labels?: string[];
  values?: number[];
  construction?: 'median' | 'bisector' | 'centers' | 'ceva' | 'euler-line' | 'diagonals';
  illustrative?: boolean;
}

export interface Problem {
  id: string;
  title: string;
  topic: Topic;
  level: Level;
  question: string;
  type: 'multiple-choice' | 'text';
  options?: string[];
  correctAnswer: string;
  hint: string;
  solution: string;
  points: number;
  /** Competition band used for filtering and transparent score calibration. */
  competition?: CompetitionLevel;
  /** Numeric AIME-style responses use one digit column per required digit. */
  answerMode?: AnswerMode;
  answerDigits?: number;
  /** Proof and extended-response items are staged for the future Pro tier. */
  proOnly?: boolean;
  /** Maximum submissions before the worked solution is revealed. */
  maxAttempts?: number;
  /** A precise, code-rendered figure for geometry items. */
  figure?: GeometryFigure;
  /** Explainable difficulty dimensions used by the score calibration rubric. */
  estimatedSteps?: number;
  abstraction?: number;
}

export interface UserStats {
  /**
   * Tier label, absent until a learner is placed.
   *
   * Optional because that is what the code actually does: both initialisers —
   * the first-run default and the post-logout reset — omit it, and it is only
   * populated once the adaptive placement test resolves a tier (or a returning
   * user's saved stats are rehydrated). Call sites already reflect this, most
   * guarding with `|| 'Foundation'`.
   */
  level?: string;
  rank: number;
  points: number;
  streak: number;
  completedCount: number;
  accuracy: number;
  timeSpent: number; // in minutes
  skills: {
    Algebra: number;
    Geometry: number;
    Combinatorics: number;
    'Number Theory': number;
  };
  weaknesses: string[];
  learningTimeline: { date: string; points: number; accuracy: number }[];
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  participants: number;
  completed: boolean;
}

export interface Contest {
  id: string;
  title: string;
  date: string;
  duration: string;
  problemCount: number;
  status: 'upcoming' | 'ongoing' | 'past';
  joined?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  country: string;
  age: number;
  badge?: string;
  avatarSeed?: string;
  /** Multi-dimensional ranking axes, each 0-100. */
  speed?: number;
  accuracy?: number;
  consistency?: number;
  improvement?: number;
}

export interface CommunityDiscussion {
  id: string;
  problemId: string;
  problemTitle: string;
  user: string;
  role: 'Student' | 'Mentor' | 'Admin';
  content: string;
  timestamp: string;
  likes: number;
  replies: number;
  avatarSeed?: string;
}

export interface AIRecommendation {
  recommendation: string;
  recommendedTopic: Topic;
  suggestedLevel: Level;
  rationale: string;
  isFallback?: boolean;
}

export interface SmartFeedback {
    pointsAwarded?: number;
    correct: boolean;
    explanation: string;
    guidance: string;
    attemptsUsed?: number;
    finished?: boolean;
    forfeited?: boolean;
}
