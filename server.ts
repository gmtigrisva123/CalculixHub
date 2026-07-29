/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Problem, LeaderboardEntry, WeeklyChallenge, Contest, CommunityDiscussion } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || '8000') || 8000;

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Graceful handler for Gemini errors to activate high-fidelity offline system
function handleGeminiError(context: string, error: any) {
  const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
  const isQuotaExceeded = errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit') || error?.status === 'RESOURCE_EXHAUSTED' || error?.status === 429;
  if (isQuotaExceeded) {
    console.warn(`[Calculix Offline Engine] Gemini Quota Exceeded during ${context}. Activating local high-fidelity math fallback.`);
  } else {
    console.warn(`[Calculix Offline Engine] Gemini API issue during ${context}. Activating fallback: ${errMsg}`);
  }
}

// Global server-side databases (mock)
const problems: Problem[] = [
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

const initialLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: 'Minh Anh', points: 890, country: 'Vietnam', age: 17, avatarSeed: 'minh', speed: 88, accuracy: 94, consistency: 91, improvement: 72 },
  { rank: 2, name: 'Wei Zhang', points: 845, country: 'China', age: 16, avatarSeed: 'wei', speed: 95, accuracy: 89, consistency: 84, improvement: 68 },
  { rank: 3, name: 'Priya Sharma', points: 810, country: 'India', age: 17, avatarSeed: 'priya', speed: 79, accuracy: 96, consistency: 88, improvement: 81 },
  { rank: 4, name: 'Hoang Nam', points: 720, country: 'Vietnam', age: 15, avatarSeed: 'nam', speed: 82, accuracy: 85, consistency: 76, improvement: 90 },
  { rank: 5, name: 'Aiden Cole', points: 650, country: 'USA', age: 16, avatarSeed: 'aiden', speed: 91, accuracy: 78, consistency: 69, improvement: 74 },
  { rank: 6, name: 'Thu Trang', points: 540, country: 'Vietnam', age: 14, avatarSeed: 'trang', speed: 68, accuracy: 88, consistency: 94, improvement: 86 },
  { rank: 7, name: 'Yuki Tanaka', points: 480, country: 'Japan', age: 16, avatarSeed: 'yuki', speed: 86, accuracy: 81, consistency: 72, improvement: 63 },
  { rank: 8, name: 'Duc Anh', points: 310, country: 'Vietnam', age: 17, avatarSeed: 'duc', speed: 74, accuracy: 76, consistency: 65, improvement: 79 },
];

const initialWeeklyChallenges: WeeklyChallenge[] = [
  {
    id: 'wc-01',
    title: 'Combinatorics Sprint: Counting Without Overcounting',
    description: 'Five short problems on stars-and-bars, inclusion-exclusion, and circular permutations. Built to sharpen your counting reflexes in under 20 minutes.',
    dueDate: 'Sunday, 11:59 PM',
    points: 60,
    participants: 214,
    completed: false,
  },
];

const initialContests: Contest[] = [
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

const initialDiscussions: CommunityDiscussion[] = [
  {
    id: 'disc-1',
    problemId: 'comb-f01',
    problemTitle: 'The Handshake Problem',
    user: 'Nam L.',
    role: 'Student',
    content: 'The $C^2_{10}$ explanation is really clean and intuitive. If you\'re new to this, drawing 10 dots and connecting the lines by hand also gets you to 45 edges!',
    timestamp: '2 hours ago',
    likes: 12,
    replies: 2,
    avatarSeed: 'triet',
  },
  {
    id: 'disc-2',
    problemId: 'alg-a01',
    problemTitle: 'Minimum Fraction Value',
    user: 'Mentor Hoang',
    role: 'Mentor',
    content: 'Important note for anyone prepping for a selective exam: when using Cauchy-Schwarz or AM-GM in fraction form, the EQUALITY CONDITION is essential. Don\'t just pick a convenient point without checking it satisfies $a+b+c=1$.',
    timestamp: '1 day ago',
    likes: 34,
    replies: 5,
    avatarSeed: 'hoang',
  },
];

// --- REAL-TIME LIVE STATISTICS STATE & SIMULATOR ---
const liveStats = {
  activeUsers: 0,
  testsCompleted: 0,
  activeContestsCount: 0,
  facebookAcquisitions: 0,
  tiktokAcquisitions: 0,
  youtubeAcquisitions: 0,
  improvementRate: 0
};

// Background simulation disabled to keep stats clean without demo data
/*
setInterval(() => {
  // Active users hover and fluctuate between 1,200 and 1,800
  const userDelta = Math.floor(Math.random() * 7) - 3; // -3 to +3
  liveStats.activeUsers = Math.max(1200, Math.min(1800, liveStats.activeUsers + userDelta));

  // Small increments to simulate real-time social channel acquisitions
  if (Math.random() > 0.75) liveStats.facebookAcquisitions += 1;
  if (Math.random() > 0.8) liveStats.tiktokAcquisitions += 1;
  if (Math.random() > 0.85) liveStats.youtubeAcquisitions += 1;

  // Occasional completed tests (representing other users completing their IRT test)
  if (Math.random() > 0.92) liveStats.testsCompleted += 1;
}, 4000);
*/

// --- API ENDPOINTS ---

// Get real-time live statistics
app.get('/api/live-stats', (req, res) => {
  res.json(liveStats);
});

// Post live user activity events
app.post('/api/live-stats/event', (req, res) => {
  const { event } = req.body;
  if (event === 'test-completed') {
    liveStats.testsCompleted += 1;
    liveStats.activeUsers = Math.min(1800, liveStats.activeUsers + 1);
  } else if (event === 'problem-solved') {
    // Solve event reflects on active users engagement
    if (Math.random() > 0.5) {
      liveStats.improvementRate = Math.min(99.9, +(liveStats.improvementRate + 0.01).toFixed(2));
    }
  } else if (event === 'user-joined') {
    liveStats.activeUsers = Math.min(1800, liveStats.activeUsers + 1);
  }
  res.json({ success: true, liveStats });
});

// Get all problems
app.get('/api/problems', (req, res) => {
  res.json(problems);
});

// AI Personalization Layer: Recommend adaptive tasks based on student metrics
app.post('/api/recommend', async (req, res) => {
  const { points, completedCount, accuracy, skills } = req.body;

  // Find user weaknesses or top opportunities
  const skillValues = Object.entries(skills || {}) as [string, number][];
  skillValues.sort((a, b) => a[1] - b[1]); // Sort lowest to highest
  const weakestTopic = skillValues[0] ? skillValues[0][0] : 'Combinatorics';
  const weakestValue = skillValues[0] ? skillValues[0][1] : 40;

  // Determine target level
  let targetLevel: 'Foundation' | 'Advanced' | 'Olympiad' = 'Foundation';
  if (points > 300) targetLevel = 'Olympiad';
  else if (points > 100) targetLevel = 'Advanced';

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `You are "EduReach Core", the AI personalization engine inside the CalculixHub advanced math platform.
Your task is to produce a UNIQUE, PERSONALIZED learning analysis for a student based on their current stats:
- Cumulative points: ${points}
- Problems completed: ${completedCount}
- Average accuracy: ${accuracy}%
- Current skill map:
  + Algebra: ${skills?.Algebra ?? 50}%
  + Geometry: ${skills?.Geometry ?? 50}%
  + Combinatorics: ${skills?.Combinatorics ?? 50}%
  + Number Theory: ${skills?.['Number Theory'] ?? 50}%

Based on this data:
1. Identify the student's weakest area (currently: ${weakestTopic} at ${weakestValue}%).
2. Suggest a direction and motivate the learner in an inspiring but rigorous, expert academic tone.
3. Output pure JSON only (no markdown \`\`\`json fences). Structure:
{
  "recommendation": "An inspiring, sharp analysis of strengths, weaknesses, and trends",
  "recommendedTopic": "${weakestTopic}",
  "suggestedLevel": "${targetLevel}",
  "rationale": "A clear scientific rationale for why improving this skill now unlocks the next score tier"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING },
              recommendedTopic: { type: Type.STRING },
              suggestedLevel: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
            required: ['recommendation', 'recommendedTopic', 'suggestedLevel', 'rationale'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      parsed.isFallback = false;
      return res.json(parsed);
    } catch (e: any) {
      handleGeminiError('Recommendation Generation', e);
      // Fallback below
    }
  }

  // High-fidelity fallback recommendations when API Key is missing or errored
  const genericRecommendations: Record<string, any> = {
    'Combinatorics': {
      recommendation: `Your skill map shows solid algebraic reasoning, but Combinatorics (${weakestValue}%) is your main bottleneck right now. Shoring up stars-and-bars technique and permutation cycles will unlock more points.`,
      recommendedTopic: 'Combinatorics',
      suggestedLevel: targetLevel,
      rationale: 'Stronger discrete-structure thinking is exactly what unlocks the hardest questions on AMC and Olympiad exams.',
    },
    'Geometry': {
      recommendation: `You have strong algebraic intuition, but Geometry (${weakestValue}%) is currently your blind spot. Drawing helper lines and applying Ptolemy/Brahmagupta flexibly hasn't become a reflex yet.`,
      recommendedTopic: 'Geometry',
      suggestedLevel: targetLevel,
      rationale: 'A 15% improvement in geometry would meaningfully raise your overall training ceiling.',
    },
    'Algebra': {
      recommendation: `Algebra (${weakestValue}%) is your main challenge at the current tier. Functional-equation and inequality problems haven't found their equality case reflex yet.`,
      recommendedTopic: 'Algebra',
      suggestedLevel: targetLevel,
      rationale: 'Mastering equivalent algebraic manipulation and factoring pays off across every other topic.',
    },
    'Number Theory': {
      recommendation: `Modular arithmetic patterns and prime properties in Number Theory (${weakestValue}%) are holding back your overall results.`,
      recommendedTopic: 'Number Theory',
      suggestedLevel: targetLevel,
      rationale: 'Locking in Euler\'s totient function and the Chinese Remainder Theorem unlocks a lot of integer-based reasoning.',
    },
  };

  const defaultRec = genericRecommendations[weakestTopic] || genericRecommendations['Combinatorics'];
  res.json({
    ...defaultRec,
    isFallback: true
  });
});

// API endpoint: Smart Feedback for solutions & formulas submitted by student
app.post('/api/evaluate', async (req, res) => {
  const { problemId, userAnswer } = req.body;

  const problem = problems.find((p) => p.id === problemId);
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found.' });
  }

  const cleanAnswer = userAnswer?.trim().toLowerCase();
  const cleanCorrect = problem.correctAnswer.trim().toLowerCase();
  const isCorrect = cleanAnswer === cleanCorrect;

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `You are an outstanding math professor and AI teaching assistant at CalculixHub.
Evaluate a student's answer to the following problem:
- Title: "${problem.title}"
- Topic: ${problem.topic}
- Level: ${problem.level}
- Question: "${problem.question}"
- Model solution: "${problem.solution}"
- Student's submitted answer: "${userAnswer}"
- Automatic grading result: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (expected answer: "${problem.correctAnswer}")

Analyze this thoughtfully, at a high academic level:
1. If CORRECT: briefly praise the approach, point out the elegance of the technique used (e.g. Viète's formulas, Brahmagupta), and encourage extending the idea further.
2. If INCORRECT: gently diagnose where the student likely went wrong (e.g. a miscounted permutation, a missed equality case, an arithmetic slip in an exponent...) and give an open hint (don't just solve it) so they can self-correct.
3. Output pure JSON (no markdown \`\`\`json fences):
{
  "correct": ${isCorrect},
  "explanation": "A detailed, high-quality academic comment on the student's answer.",
  "guidance": "A hint or next challenge to build error-resistant thinking habits."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correct: { type: Type.BOOLEAN },
              explanation: { type: Type.STRING },
              guidance: { type: Type.STRING },
            },
            required: ['correct', 'explanation', 'guidance'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return res.json(parsed);
    } catch (e: any) {
      handleGeminiError('Result Evaluation', e);
    }
  }

  // High-fidelity fallback smart feedback
  let explanation = '';
  let guidance = '';

  if (isCorrect) {
    explanation = `Correct! You reasoned through the logical structure of this ${problem.topic} problem cleanly.`;
    guidance = `Keep pushing: try the next ${problem.level === 'Foundation' ? 'Advanced' : 'Olympiad'} tier now!`;
  } else {
    explanation = `Not quite - "${userAnswer}" isn't correct. You likely slipped somewhere in the intermediate steps, or the hint's technique hasn't clicked yet.`;
    guidance = `Hint: ${problem.hint} Try re-deriving it carefully, step by step.`;
  }

  res.json({
    correct: isCorrect,
    explanation,
    guidance,
  });
});

// API endpoint: Ask the Math Tutor Chatbot
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `You are the "Calculix AI Tutor" - a legendary, deeply knowledgeable, warm but rigorous math teacher who always uses the Socratic method to build understanding, instead of just handing out answers.
You're chatting with a high school student who's serious about training high-quality mathematical thinking.
Communicate in clear, natural English with strong academic substance but an approachable tone. Use LaTeX for math notation where helpful (e.g. $x^2$, $\\frac{a}{b}$).

The student's latest message: "${message}"

Reply concisely, with precision, and stay focused on deep, guided practice.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });

      return res.json({ reply: response.text || "I'm having trouble with that one right now, try asking again!" });
    } catch (e: any) {
      handleGeminiError('Tutor Chat', e);
    }
  }

  // Fallback Tutor answers
  let reply = `Hi! I'm the Calculix AI Tutor, here to help you uncover the beauty of mathematics.
The live AI connection is temporarily down, but here are a few pointers:
- Master **Algebra** by drilling symmetric expressions until they're second nature.
- For **Geometry**, drawing an auxiliary line is almost always the key to an otherwise-hidden angle.
- Got a specific question about the handshake problem or the Cauchy-Schwarz inequality?`;

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('handshake')) {
    reply = `Let's break down the Handshake Problem. With $n$ people, the first shakes hands with $n-1$ others, the second with $n-2$ remaining (having already shaken with the first), and so on.
The general formula is $S = \\frac{n(n-1)}{2}$. For $n=10$: $\\frac{10 \\times 9}{2} = 45$. That's the elegance of combinatorics!`;
  } else if (normalizedMessage.includes('cauchy') || normalizedMessage.includes('am-gm') || normalizedMessage.includes('inequality')) {
    reply = `Great question! The AM-GM inequality for positive reals $x_1, x_2, \\dots, x_n$ states:
$\\frac{x_1 + x_2 + \\dots + x_n}{n} \\ge \\sqrt[n]{x_1 x_2 \\dots x_n}$
Equality holds exactly when all the terms are equal. In the classic minimization $P = 1/a + 1/b + 1/c$ with $a+b+c=1$, equality at $a=b=c=1/3$ gives the minimum value of 9 - a beautifully symmetric result!`;
  }

  res.json({ reply });
});

// Express route for user metadata & details
app.get('/api/statistics-seed', (req, res) => {
  res.json({
    leaderboard: initialLeaderboard,
    weeklyChallenges: initialWeeklyChallenges,
    contests: initialContests,
    discussions: initialDiscussions,
  });
});

// Configure Vite middleware in development or static hosting in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Calculix Hub] Server running at http://localhost:${PORT}`);
  });
}

startServer();
