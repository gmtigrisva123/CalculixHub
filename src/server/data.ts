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
} from '../types';

export const problems: Problem[] = [
  // --- ALGEBRA ---
  {
    id: 'alg-f01',
    title: 'Quadratic Roots',
    topic: 'Algebra',
    level: 'Foundation',
    question: 'Find the sum of all real roots of: $x^2 - 7x + 12 = 0$. (Enter a number, e.g. 7)',
    type: 'text',
    correctAnswer: '7',
    hint: 'By Vi\u00e8te\'s formulas for $ax^2 + bx + c = 0$, the sum of the roots is $-b/a$.',
    solution: 'The equation $x^2 - 7x + 12 = 0$ factors as $(x-3)(x-4) = 0$. The roots are $x = 3$ and $x = 4$, summing to $3 + 4 = 7$. By Vi\u00e8te, the sum is $-(-7)/1 = 7$.',
    points: 10,
  },
  {
    id: 'alg-a01',
    title: 'Minimum Fraction Value',
    topic: 'Algebra',
    level: 'Advanced',
    question: 'Let $a, b, c$ be positive reals with $a + b + c = 1$. What is the minimum value of $P = \\frac{1}{a} + \\frac{1}{b} + \\frac{1}{c}$?',
    type: 'text',
    correctAnswer: '9',
    hint: 'Use the AM-GM inequality, or the Cauchy-Schwarz (Engel form / Titu\'s Lemma) inequality.',
    solution: 'By the Engel form of Cauchy-Schwarz: $\\frac{1}{a} + \\frac{1}{b} + \\frac{1}{c} \\ge \\frac{(1+1+1)^2}{a+b+c} = \\frac{9}{1} = 9$. Equality holds when $a = b = c = 1/3$.',
    points: 20,
  },
  {
    id: 'alg-o01',
    title: 'Olympiad Functional Equation',
    topic: 'Algebra',
    level: 'Olympiad',
    question: 'Find $f(2026)$ if $f: \\mathbb{R} \\to \\mathbb{R}$ satisfies $f(x + y) + f(x - y) = 2f(x)\\cos(y)$ for all $x, y \\in \\mathbb{R}$, with $f(0) = 0$ and $f(\\pi/2) = 1$. (Answer as a simple trig expression, since the unique well-behaved solution is $f(x) = \\sin(x)$)',
    type: 'text',
    correctAnswer: 'sin(2026)',
    hint: 'Set $x = 0$ to learn about the function\'s parity, then substitute other convenient values.',
    solution: 'This is d\'Alembert\'s functional equation, associated with trigonometric functions. Given $f(0) = 0$ and $f(\\pi/2) = 1$, the unique well-behaved solution is $f(x) = \\sin(x)$. So $f(2026) = \\sin(2026)$.',
    points: 35,
  },
  // --- GEOMETRY ---
  {
    id: 'geo-f01',
    title: 'Right Triangle Area',
    topic: 'Geometry',
    level: 'Foundation',
    question: 'A triangle has side lengths 5, 12, and 13. What is its area?',
    type: 'text',
    correctAnswer: '30',
    hint: 'Check whether this is a right triangle using the converse Pythagorean theorem ($5^2 + 12^2 = 13^2$).',
    solution: 'Since $25 + 144 = 169$, i.e. $5^2 + 12^2 = 13^2$, this is a right triangle with legs 5 and 12. Area $= (5 \\times 12)/2 = 30$.',
    points: 10,
  },
  {
    id: 'geo-a01',
    title: 'Cyclic Quadrilateral Area (Brahmagupta Formula)',
    topic: 'Geometry',
    level: 'Advanced',
    question: 'A cyclic quadrilateral has consecutive sides $a=3, b=4, c=5, d=6$. Find its area (round to two decimal places, using Brahmagupta\'s formula).',
    type: 'text',
    correctAnswer: '18.97',
    hint: 'Use Brahmagupta\'s formula: $S = \\sqrt{(p-a)(p-b)(p-c)(p-d)}$ where $p$ is the semiperimeter.',
    solution: 'The perimeter gives $2p = 3 + 4 + 5 + 6 = 18 \\Rightarrow p = 9$. Area $S = \\sqrt{(9-3)(9-4)(9-5)(9-6)} = \\sqrt{6 \\times 5 \\times 4 \\times 3} = \\sqrt{360} \\approx 18.97$.',
    points: 20,
  },
  {
    id: 'geo-o01',
    title: 'Extended Ptolemy Theorem',
    topic: 'Geometry',
    level: 'Olympiad',
    question: 'Equilateral triangle $ABC$ is inscribed in a circle. Point $M$ lies on minor arc $BC$. If $MB = 5$ and $MC = 8$, what is $MA$?',
    type: 'text',
    correctAnswer: '13',
    hint: 'Apply Ptolemy\'s theorem to cyclic quadrilateral $ABMC$: $MA \\times BC = MB \\times AC + MC \\times AB$.',
    solution: 'Since $ABC$ is equilateral, $AB = BC = CA$. Ptolemy on cyclic quadrilateral $ABMC$ gives $MA \\cdot BC = MB \\cdot CA + MC \\cdot AB$. Since all three sides are equal, dividing through gives $MA = MB + MC = 5 + 8 = 13$.',
    points: 30,
  },
  // --- COMBINATORICS ---
  {
    id: 'comb-f01',
    title: 'The Handshake Problem',
    topic: 'Combinatorics',
    level: 'Foundation',
    question: 'In a room of 10 people, everyone shakes hands with everyone else exactly once. How many handshakes occur in total?',
    type: 'text',
    correctAnswer: '45',
    hint: 'Each handshake corresponds to choosing 2 people out of 10: $C^{2}_{10}$.',
    solution: 'The number of handshakes is $C^2_{10} = \\frac{10 \\times 9}{2} = 45$. Equivalently, each of the 10 people shakes 9 hands, giving $10 \\times 9 = 90$, halved since each handshake is counted twice.',
    points: 10,
  },
  {
    id: 'comb-a01',
    title: 'Conditional Arrangements',
    topic: 'Combinatorics',
    level: 'Advanced',
    question: '5 boys and 3 girls stand in a row. In how many ways can they be arranged so that no two girls stand next to each other?',
    type: 'text',
    correctAnswer: '14400',
    hint: 'Use the stars-and-bars / gap method: arrange the boys first, then place girls into the gaps created.',
    solution: 'Arranging 5 boys: $5! = 120$ ways. This creates 6 gaps (including the ends); choosing 3 of them for the girls in order gives $A^3_6 = 6 \\times 5 \\times 4 = 120$ ways. Total: $120 \\times 120 = 14400$.',
    points: 20,
  },
  {
    id: 'comb-o01',
    title: 'Graph Connectivity Challenge',
    topic: 'Combinatorics',
    level: 'Olympiad',
    question: 'A simple undirected graph has 8 vertices. What is the minimum number of edges that guarantees the graph is connected, regardless of how the edges are arranged?',
    type: 'text',
    correctAnswer: '22',
    hint: 'The graph fails to be connected in the worst case when one vertex is isolated from a fully-connected remaining group. Find the max edge count of that disconnected configuration, then add one.',
    solution: 'In the worst case, 7 vertices are fully connected to each other ($C^2_7 = 21$ edges) while the 8th vertex is isolated. Adding just one more edge (22 total) forces the isolated vertex to connect, guaranteeing connectivity. The answer is 22.',
    points: 35,
  },
  // --- NUMBER THEORY ---
  {
    id: 'num-f01',
    title: 'Modular Congruence of a Power',
    topic: 'Number Theory',
    level: 'Foundation',
    question: 'Find the remainder when $3^{2026}$ is divided by 5. (Think about the cycle of remainders, or Fermat\'s little theorem.)',
    type: 'text',
    correctAnswer: '4',
    hint: 'The powers of 3 mod 5 cycle: $3^1 \\equiv 3$, $3^2 \\equiv 4$, $3^3 \\equiv 2$, $3^4 \\equiv 1 \\pmod 5$.',
    solution: 'By Fermat\'s little theorem, since 5 is prime and $\\gcd(3, 5)=1$, we have $3^4 \\equiv 1 \\pmod 5$. Since $2026 = 506 \\times 4 + 2$, $3^{2026} = (3^4)^{506} \\times 3^2 \\equiv 1^{506} \\times 9 \\equiv 4 \\pmod 5$.',
    points: 10,
  },
  {
    id: 'num-a01',
    title: 'Coprimality and Euler\'s Totient Function',
    topic: 'Number Theory',
    level: 'Advanced',
    question: 'How many positive integers less than 120 are coprime to 120?',
    type: 'text',
    correctAnswer: '32',
    hint: 'Use Euler\'s totient function $\\varphi(n) = n \\prod_{p|n} (1 - \\frac{1}{p})$ over the prime factors of 120.',
    solution: 'Factoring $120 = 2^3 \\times 3 \\times 5$: $\\varphi(120) = 120 \\times (1 - 1/2) \\times (1 - 1/3) \\times (1 - 1/5) = 120 \\times \\frac{1}{2} \\times \\frac{2}{3} \\times \\frac{4}{5} = 32$.',
    points: 20,
  },
  {
    id: 'num-o01',
    title: 'Pythagorean Triples & Bounds',
    topic: 'Number Theory',
    level: 'Olympiad',
    question: 'How many primitive Pythagorean triples $(x, y, z)$ satisfy $x^2 + y^2 = z^2$ with $z \\le 50$ and $x$ even? (e.g. the triple $8, 15, 17$)',
    type: 'text',
    correctAnswer: '7',
    hint: 'Use the primitive triple parametrization $x=2uv, y=u^2-v^2, z=u^2+v^2$ with $u > v > 0$, opposite parity, and $\\gcd(u,v)=1$. Count pairs with $u^2+v^2 \\le 50$.',
    solution: 'We need pairs $(u,v)$ with: $u > v > 0$; $\\gcd(u,v) = 1$; opposite parity; and $u^2 + v^2 \\le 50$.\nEnumerating u:\n- u=2, v=1 -> z=5 (valid)\n- u=3, v=2 -> z=13 (valid)\n- u=4, v=1 -> z=17 (valid); v=3 -> z=25 (valid)\n- u=5, v=2 -> z=29 (valid); v=4 -> z=41 (valid)\n- u=6, v=1 -> z=37 (valid); v=5 -> z=61 (rejected, >50)\n- u=7, v=2 -> z=53 (rejected, >50)\nValid primitive triples: (2,1)->5, (3,2)->13, (4,1)->17, (4,3)->25, (5,2)->29, (5,4)->41, (6,1)->37. Total: 7.',
    points: 35,
  },
];

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
