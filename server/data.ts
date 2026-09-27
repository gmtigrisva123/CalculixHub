/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The seeded content bank.
 *
 * Extracted verbatim from `server.ts`, where 220 lines of fixture data sat
 * between the route definitions and made the security-relevant code hard to
 * find. Separating data from behaviour is the precondition for reviewing
 * either: a reviewer auditing the request pipeline should not have to scroll
 * past the Pythagorean triples to reach it.
 *
 * This is fixture data, not a database. It is immutable, identical in every
 * instance, and replaced wholesale when the Supabase integration lands.
 */

import type {
  CommunityDiscussion,
  Contest,
  LeaderboardEntry,
  Problem,
  WeeklyChallenge,
} from '../shared/types';
import { buildGeneratedProblems } from './generatedProblems';
import { problemScore } from '../shared/problemScore';

export const problems: Problem[] = [
  // --- ALGEBRA ---
  {
    id: 'alg-f01',
    title: 'The Hidden Pair',
    topic: 'Algebra',
    level: 'Foundation',
    question: 'A positive real $x$ satisfies $x+1/x=3$. Find $x^2+1/x^2$.',
    type: 'text',
    correctAnswer: '7',
    hint: 'Square the given reciprocal sum and subtract the middle term.',
    solution: 'Squaring gives $x^2+2+x^{-2}=9$, so $x^2+x^{-2}=7$.',
    points: 17,
    competition: 'AMC',
    answerMode: 'choice',
    maxAttempts: 3,
    estimatedSteps: 2,
    abstraction: 1,
  },
  {
    id: 'alg-a01',
    title: 'A Recurrence in Disguise',
    topic: 'Algebra',
    level: 'Advanced',
    question: 'Let $r$ and $s$ be the roots of $t^2 - 7t + 1 = 0$. Find the remainder when $r^6 + s^6$ is divided by $1000$.',
    type: 'text',
    correctAnswer: '682',
    hint: 'If $S_n=r^n+s^n$, use $r+s=7$, $rs=1$, and the recurrence $S_n=7S_{n-1}-S_{n-2}$.',
    solution: 'Set $S_n=r^n+s^n$. Since each root satisfies $t^2=7t-1$, we have $S_n=7S_{n-1}-S_{n-2}$ with $S_0=2$ and $S_1=7$. This gives $S_2=47$, $S_3=322$, $S_4=2207$, $S_5=15127$, and $S_6=103682$. Therefore the requested remainder is $682$.',
    points: 27,
    competition: 'AIME',
    answerMode: 'numeric-grid',
    answerDigits: 3,
    maxAttempts: 3,
    estimatedSteps: 4,
    abstraction: 3,
  },
  {
    id: 'alg-o01',
    title: 'Power Sums Without Solving',
    topic: 'Algebra',
    level: 'Olympiad',
    question: 'A positive real number $x$ satisfies $x + \\frac{1}{x} = 3$. Find the last three digits of $\\left(x^5 + \\frac{1}{x^5}\\right)^2$.' ,
    type: 'text',
    correctAnswer: '129',
    hint: 'Let $T_n=x^n+x^{-n}$. The relation $x+x^{-1}=3$ gives $T_n=3T_{n-1}-T_{n-2}$.',
    solution: 'With $T_0=2$ and $T_1=3$, the recurrence $T_n=3T_{n-1}-T_{n-2}$ gives $T_2=7$, $T_3=18$, $T_4=47$, and $T_5=123$. Thus $T_5^2=123^2=15129$, whose last three digits are $129$.',
    points: 74,
    competition: 'USAMO',
    answerMode: 'proof',
    proOnly: true,
    maxAttempts: 3,
    estimatedSteps: 5,
    abstraction: 5,
  },
  // --- GEOMETRY ---
  {
    id: 'geo-f01',
    title: 'Heron in One Move',
    topic: 'Geometry',
    level: 'Foundation',
    question: 'A triangle has side lengths $13$, $14$, and $15$. If $K$ is its area and $r$ is its inradius, find $K+r^2$.',
    type: 'text',
    correctAnswer: '100',
    hint: 'Use Heron\'s formula with semiperimeter $21$, then use $r=K/s$.',
    solution: 'The semiperimeter is $s=21$. Heron\'s formula gives $K=\\sqrt{21\\cdot8\\cdot7\\cdot6}=84$. Therefore $r=K/s=84/21=4$, and $K+r^2=84+16=100$.',
    points: 19,
    competition: 'AMC',
    answerMode: 'choice',
    maxAttempts: 3,
    estimatedSteps: 3,
    abstraction: 2,
    figure: { kind: 'triangle', labels: ['13', '14', '15'], values: [13, 14, 15] },
  },
  {
    id: 'geo-a01',
    title: 'A Cyclic Quadrilateral',
    topic: 'Geometry',
    level: 'Advanced',
    question: 'A cyclic quadrilateral has consecutive side lengths $4$, $5$, $6$, and $7$. Find the square of its area.',
    type: 'text',
    correctAnswer: '840',
    hint: 'Apply Brahmagupta\'s formula with semiperimeter $s=11$, and leave the answer squared.',
    solution: 'The semiperimeter is $s=(4+5+6+7)/2=11$. Brahmagupta\'s formula gives $K^2=(11-4)(11-5)(11-6)(11-7)=7\\cdot6\\cdot5\\cdot4=840$.',
    points: 31,
    competition: 'AIME',
    answerMode: 'numeric-grid',
    answerDigits: 3,
    maxAttempts: 3,
    estimatedSteps: 3,
    abstraction: 3,
    figure: { kind: 'quadrilateral', labels: ['4', '5', '6', '7'], values: [4, 5, 6, 7] },
  },
  {
    id: 'geo-o01',
    title: 'The Distance Between Centers',
    topic: 'Geometry',
    level: 'Olympiad',
    question: 'A triangle has side lengths $10$, $17$, and $21$. Let $O$ and $I$ be its circumcenter and incenter. Write $OI^2$ in lowest terms, and enter the remainder when its numerator is divided by $1000$.',
    type: 'text',
    correctAnswer: '465',
    hint: 'Heron gives the area and $r$; then use $R=abc/(4K)$ and Euler\'s formula $OI^2=R(R-2r)$.',
    solution: 'Here $s=24$ and $K=\\sqrt{24\\cdot14\\cdot7\\cdot3}=84$. Thus $r=K/s=7/2$ and $R=10\\cdot17\\cdot21/(4\\cdot84)=85/8$. Euler\'s formula gives $OI^2=(85/8)(85/8-7)=2465/64$. The numerator\'s remainder modulo $1000$ is $465$.',
    points: 79,
    competition: 'USAMO',
    answerMode: 'proof',
    proOnly: true,
    maxAttempts: 3,
    estimatedSteps: 5,
    abstraction: 5,
    figure: { kind: 'triangle', labels: ['10', '17', '21'], values: [10, 17, 21], construction: 'centers' },
  },
  // --- COMBINATORICS ---
  {
    id: 'comb-f01',
    title: 'Digit Sets and Permutations',
    topic: 'Combinatorics',
    level: 'Foundation',
    question: 'How many four-digit positive integers have four distinct digits and a digit sum divisible by $9$?',
    type: 'text',
    correctAnswer: '516',
    hint: 'First choose the four-digit set. A set containing $0$ has only $4!-3!$ valid arrangements; a set without $0$ has $4!$.',
    solution: 'The generating polynomial $\\prod_{d=0}^{9}(1+t z^d)$ shows that $24$ four-digit sets have digit sum $0$ modulo $9$: $14$ contain no zero and $10$ contain zero. The first type contributes $14\\cdot4!=336$ numbers; the second contributes $10\\cdot(4!-3!)=180$. The total is $336+180=516$.',
    points: 21,
    competition: 'AMC',
    answerMode: 'choice',
    maxAttempts: 3,
    estimatedSteps: 5,
    abstraction: 4,
  },
  {
    id: 'comb-a01',
    title: 'Two Forbidden Adjacencies',
    topic: 'Combinatorics',
    level: 'Advanced',
    question: 'Eight distinct people sit around a circular table. Two particular people refuse to sit next to each other, and a disjoint particular pair also refuses to sit next to each other. How many seating arrangements are possible?',
    type: 'text',
    correctAnswer: '2640',
    hint: 'Use inclusion-exclusion. A specified adjacent pair becomes one circular block, with two possible internal orders.',
    solution: 'There are $7!=5040$ unrestricted circular arrangements. For one forbidden pair, the block count is $2\\cdot6!=1440$. For both pairs adjacent, treat both as blocks: $2^2\\cdot5!=480$. Therefore the valid count is $5040-2(1440)+480=2640$.',
    points: 35,
    competition: 'AIME',
    answerMode: 'numeric-grid',
    answerDigits: 4,
    maxAttempts: 3,
    estimatedSteps: 4,
    abstraction: 3,
  },
  {
    id: 'comb-o01',
    title: 'A Constrained Lattice Walk',
    topic: 'Combinatorics',
    level: 'Olympiad',
    question: 'A path from $(0,0)$ to $(10,10)$ uses only steps east and north, never goes above the line $y=x$, and does not pass through $(5,5)$. What is the remainder when the number of such paths is divided by $1000$?',
    type: 'text',
    correctAnswer: '32',
    hint: 'The paths staying below the diagonal are counted by Catalan numbers. Subtract the paths that pass through $(5,5)$.',
    solution: 'The total number of paths never above $y=x$ is the Catalan number $C_{10}=\\frac{1}{11}\\binom{20}{10}=16796$. Paths through $(5,5)$ split into two independently constrained halves, giving $C_5^2=42^2=1764$. Thus there are $16796-1764=15032$ paths, whose remainder modulo $1000$ is $32$.',
    points: 83,
    competition: 'IMO',
    answerMode: 'proof',
    proOnly: true,
    maxAttempts: 3,
    estimatedSteps: 6,
    abstraction: 5,
  },
  // --- NUMBER THEORY ---
  {
    id: 'num-f01',
    title: 'A Long Power, Reduced',
    topic: 'Number Theory',
    level: 'Foundation',
    question: 'Find the remainder when $7^{2026}$ is divided by $1000$.',
    type: 'text',
    correctAnswer: '649',
    hint: 'The Carmichael period of units modulo $1000$ divides $100$. Reduce the exponent, then use repeated squaring.',
    solution: 'Since $7^{100}\\equiv1\\pmod{1000}$, reduce $2026$ to $26$. Repeated squaring gives $7^{16}\\equiv601$, $7^8\\equiv801$, and $7^2=49\\pmod{1000}$. Therefore $7^{26}\\equiv601\\cdot801\\cdot49\\equiv649\\pmod{1000}$.',
    points: 23,
    competition: 'AMC',
    answerMode: 'choice',
    maxAttempts: 3,
    estimatedSteps: 4,
    abstraction: 3,
  },
  {
    id: 'num-a01',
    title: 'A Periodic Congruence',
    topic: 'Number Theory',
    level: 'Advanced',
    question: 'How many integers $n$ with $1\\le n\\le1000$ satisfy $n\\equiv2^n\\pmod 7$?',
    type: 'text',
    correctAnswer: '142',
    hint: 'The condition depends only on $n$ modulo $7$ and the period $3$ of $2^n$ modulo $7$.',
    solution: 'The condition repeats every $\\operatorname{lcm}(7,3)=21$. Testing one period gives the valid residues $n\\equiv11,15,16\\pmod{21}$. There are $47$ complete periods through $987$, contributing $47\\cdot3=141$, and the remaining numbers through $1000$ include $n=998\\equiv11\\pmod{21}$. Hence the answer is $142$.',
    points: 37,
    competition: 'AIME',
    answerMode: 'numeric-grid',
    answerDigits: 3,
    maxAttempts: 3,
    estimatedSteps: 4,
    abstraction: 4,
  },
  {
    id: 'num-o01',
    title: 'A Modular Power Sum',
    topic: 'Number Theory',
    level: 'Olympiad',
    question: 'Let $S=\\sum_{k=1}^{2026}k^{2026}$. Find the remainder when $S$ is divided by $1000$.',
    type: 'text',
    correctAnswer: '101',
    hint: 'Work modulo $8$ and $125$. The terms repeat modulo $125$, and the full block of $125$ residues has sum $0$ for this exponent.',
    solution: 'Modulo $8$, every even term vanishes and every odd term is $1$, so $S\\equiv1013\\equiv5\\pmod8$. Modulo $125$, a full block of $125$ consecutive residues sums to $0$ because multiples of 5 contribute zero, while the units form a cyclic group and $2026\\equiv26\\pmod{100}$. Sixteen full blocks vanish, and repeated squaring on the remaining residues $1$ through $26$ gives $S\\equiv101\\pmod{125}$. Since $101\\equiv5\\pmod8$, the Chinese remainder theorem gives $S\\equiv101\\pmod{1000}$.',
    points: 137,
    competition: 'IMO',
    answerMode: 'proof',
    proOnly: true,
    maxAttempts: 3,
    estimatedSteps: 6,
    abstraction: 5,
  },
];

// Keep the original curated problems stable, then add the contest-balanced
// bank. The generated bank contributes 112 items (4 contests × 4 topics × 7
// variants) without changing any existing problem identifiers.
problems.push(...buildGeneratedProblems());
for (const item of problems) {
  // Legacy Olympiad items request a numerical answer, so retain numeric access.
  if (!item.id.startsWith('gen-') && item.proOnly) {
    item.competition = 'AIME';
    item.answerMode = 'numeric-grid';
    item.answerDigits = Math.max(3, item.correctAnswer.length);
    item.proOnly = false;
  }
  item.maxAttempts = 3;
  if (item.answerMode === 'choice' && !item.options) {
    const value = Number(item.correctAnswer);
    item.options = [-3, -1, 0, 2, 5].map(offset => String(value + offset));
  }
  item.points = problemScore(item);
}

/**
 * The leaderboard is no longer a fixture.
 *
 * It used to be eight invented people -- "Minh Anh", "Wei Zhang" and others --
 * with invented points, ages and countries, served as though they were users.
 * Ranking is now computed by `public.leaderboard_view` from real attempts, so
 * an empty platform shows an empty leaderboard, which is the honest rendering.
 */
export const initialLeaderboard: LeaderboardEntry[] = [];

export const initialWeeklyChallenges: WeeklyChallenge[] = [
  {
    id: 'wc-01',
    title: 'Combinatorics Sprint: Counting Without Overcounting',
    description: 'Five short problems on stars-and-bars, inclusion-exclusion, and circular permutations. Built to sharpen your counting reflexes in under 20 minutes.',
    dueDate: 'Sunday, 11:59 PM',
    points: 60,
    // Real participation requires a challenge_completions table; until that
    // exists this is zero rather than an invented number.
    participants: 0,
    completed: false,
  },
];

export const initialContests: Contest[] = [
  {
    id: 'contest-01',
    title: 'CalculixHub Monthly Open - August',
    date: 'Aug 3, 2026',
    duration: '90 min',
    problemCount: 8,
    status: 'upcoming',
  },
  {
    id: 'contest-02',
    title: 'CalculixHub Monthly Open - July',
    date: 'Jul 6, 2026',
    duration: '90 min',
    problemCount: 8,
    status: 'past',
  },
];

/**
 * Discussions come from `public.posts`, written by real people.
 *
 * The two seeded threads that used to live here were attributed to invented
 * users ("Nam L.", "Mentor Hoang") and presented as community activity.
 */
export const initialDiscussions: CommunityDiscussion[] = [];

/**
 * Index by identifier, built once.
 *
 * The previous `problems.find(p => p.id === id)` per request was linear in the
 * bank size. Irrelevant at 12 items and quietly quadratic once the bank reaches
 * the several hundred a production CAT needs, on a path that an unauthenticated
 * caller can drive.
 */
const problemsById = new Map(problems.map((problem) => [problem.id, problem]));

/** Look up a problem by identifier, or `undefined` if the bank has no such item. */
export function findProblem(id: string): Problem | undefined {
  return problemsById.get(id);
}
