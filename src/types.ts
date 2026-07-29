/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';
export type Level = 'Foundation' | 'Advanced' | 'Olympiad';

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
}

export interface UserStats {
  level: string;
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
  correct: boolean;
  explanation: string;
  guidance: string;
}
