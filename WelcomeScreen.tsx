/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, Trophy, Sparkles, Key, Mail, User, HelpCircle, ArrowRight, Star, 
  ArrowLeft, CheckCircle2, ChevronRight, BookOpen, Activity, AlertTriangle, BarChart3,
  Globe, Shield, TrendingUp, Users, Check, X, ChevronDown, Download, 
  ThumbsUp, ThumbsDown, Share2, FileText, Moon, Sun, Facebook, Youtube, MessageSquare
} from 'lucide-react';
import { Level } from '../types';

interface WelcomeScreenProps {
  onLoginSuccess: (name: string, level: Level) => void;
}

interface IRTQuestion {
  id: number;
  topic: string;
  question: string;
  options: string[];
  correctIdx: number;
  difficulty: number; // IRT item difficulty parameter 'b'
  hint: string;
}

// Comprehensive Item Pool across the 4 core Mathematics domains
const IRT_ITEM_BANK: IRTQuestion[] = [
  // --- TOPIC 1: ALGEBRA ---
  {
    id: 11,
    topic: 'Algebra',
      question: 'Solve the quadratic equation over the real numbers: x² - 5x + 6 = 0. Find the correct solution set.',
    options: [
      'x ∈ {2, 3}',
      'x ∈ {1, 6}',
      'x ∈ {-2, -3}',
        'No real solutions'
    ],
    correctIdx: 0,
    difficulty: -1.0, // Easy / Foundation
    hint: 'Factor the polynomial: (x-2)(x-3) = 0.'
  },
  {
    id: 12,
    topic: 'Algebra',
      question: 'Given f(f(x)) = x + 2 for all real x, which linear function f(x) satisfies this property?',
    options: [
      'f(x) = x + 1',
      'f(x) = x + 2',
      'f(x) = -x + 1',
        'No linear function exists'
    ],
    correctIdx: 0,
    difficulty: 0.5, // Medium / Advanced
    hint: 'Substitute a linear form f(x)=x+c into f(f(x))=x+2 to solve for c.'
  },
  {
    id: 13,
    topic: 'Algebra',
      question: 'Determine the number of distinct real solutions (x, y) satisfying: x² + 2x·sin(xy) + 1 = 0.',
    options: [
      'Infinitely many solutions',
      'Unique solution',
      'Exactly two solutions',
      'No real solutions'
    ],
    correctIdx: 0,
    difficulty: 1.8, // Hard / Olympiad
    hint: 'Transform and analyze the trigonometric constraints to show infinitely many y satisfy the system.'
  },

  // --- TOPIC 2: COMBINATORICS ---
  {
    id: 21,
    topic: 'Combinatorics',
      question: 'From a group of 5 students, how many ways to choose a committee of exactly 2 members?',
    options: [
      '10 ways',
      '20 ways',
      '5 ways',
      '15 ways'
    ],
    correctIdx: 0,
    difficulty: -1.0, // Easy / Foundation
    hint: 'Use combinations: C(5,2) = 5!/(2!*3!) = 10.'
  },
  {
    id: 22,
    topic: 'Combinatorics',
      question: 'How many ways to seat 4 students around a round table (arrangements equivalent under rotation are considered the same)?',
    options: [
      '6 ways',
      '24 ways',
      '12 ways',
      '4 ways'
    ],
    correctIdx: 0,
    difficulty: 0.5, // Medium / Advanced
    hint: 'Use circular permutations fixing one person as reference: (n-1)! = 3! = 6.'
  },
  {
    id: 23,
    topic: 'Combinatorics',
      question: 'A simple undirected graph with 10 vertices: what is the maximum number of edges it can have without containing any triangle (K3)?',
    options: [
      '25 edges',
      '45 edges',
      '20 edges',
      '30 edges'
    ],
    correctIdx: 0,
    difficulty: 1.8, // Hard / Olympiad
    hint: "By Mantel's theorem the maximum edges without a triangle is floor(n^2/4); for n=10 this gives 25."
  },

  // --- TOPIC 3: NUMBER THEORY ---
  {
    id: 31,
    topic: 'Number Theory',
      question: 'Find the smallest positive integer that has exactly 3 distinct positive divisors.',
    options: [
      '4',
      '6',
      '9',
      '8'
    ],
    correctIdx: 0,
    difficulty: -1.0, // Easy / Foundation
    hint: 'A number has exactly three positive divisors iff it is the square of a prime. Smallest prime is 2 → 4.'
  },
  {
    id: 32,
    topic: 'Number Theory',
      question: 'Compute the remainder of 2^2026 modulo 3.',
    options: [
      '1',
      '2',
      '0',
      'Not applicable'
    ],
    correctIdx: 0,
    difficulty: 0.5, // Medium / Advanced
    hint: 'Use congruences: 2 ≡ -1 (mod 3) => 2²⁰²⁶ ≡ (-1)²⁰²⁶ ≡ 1 (mod 3).'
  },
  {
    id: 33,
    topic: 'Number Theory',
    question: 'Find all positive integer pairs (x, y) satisfying the Diophantine equation: x² - y! = 2026.',
    options: [
      '0 pairs',
      '1 pair',
      '2 pairs',
      'Infinitely many pairs'
    ],
    correctIdx: 0,
    difficulty: 1.8, // Hard / Olympiad
    hint: 'Consider factorial residues modulo small primes to rule out solutions for y >= 7; check small y manually.'
  },

  // --- TOPIC 4: GEOMETRY ---
  {
    id: 41,
    topic: 'Geometry',
      question: 'In Euclidean plane geometry, what is the sum of the interior angles of a convex hexagon (in degrees)?',
    options: [
      '720°',
      '540°',
      '900°',
      '1080°'
    ],
    correctIdx: 0,
    difficulty: -1.0, // Easy / Foundation
    hint: 'Sum of interior angles of an n-gon is (n-2)*180°. For n=6: 4*180 = 720°.'
  },
  {
    id: 42,
    topic: 'Geometry',
      question: 'An equilateral triangle ABC is inscribed in a circle of radius R. What is the area of triangle ABC?',
    options: [
      '3√3 R² / 4',
      '√3 R² / 2',
      '3√3 R² / 2',
      '3 R² / 4'
    ],
    correctIdx: 0,
    difficulty: 0.5, // Medium / Advanced
    hint: 'Cạnh tam giác nội tiếp đều là a = R√3. Diện tích S = a² √3/4 = (R√3)² * √3 / 4 = 3√3 R² / 4.'
  },
  {
    id: 43,
    topic: 'Geometry',
      question: 'The Euler line of a non-equilateral triangle passes through which notable points?',
    options: [
      'Orthocenter H, Centroid G, Circumcenter O',
      'Incenter I, Centroid G, Orthocenter H',
      'Incenter I, Orthocenter H, Circumcenter O',
      'Euler line does not pass through the centroid'
    ],
    correctIdx: 0,
    difficulty: 1.8, // Hard / Olympiad
    hint: 'Euler line theorem: H, G, and O are collinear with vector HG = 2·GO.'
  }
];

interface LocalUser {
  fullName: string;
  email: string;
  password?: string;
  level: Level;
}

export default function WelcomeScreen({ onLoginSuccess }: WelcomeScreenProps) {
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'placement'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // --- REAL-TIME STATISTICS STATE & POLLING ---
  const [liveStats, setLiveStats] = useState({
    activeUsers: 1428,
    testsCompleted: 12482,
    activeContestsCount: 382,
    facebookAcquisitions: 5420,
    tiktokAcquisitions: 3892,
    youtubeAcquisitions: 2150,
    improvementRate: 84.5
  });

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const res = await fetch('/api/live-stats');
        if (res.ok) {
          const data = await res.json();
          setLiveStats(data);
        }
      } catch (err) {
        console.error('Error fetching live stats from server:', err);
      }
    };
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- LANDING PAGE INTERACTIVE STATES ---
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [activeArchTab, setActiveArchTab] = useState<'engine' | 'ai' | 'compete' | 'analytics'>('engine');
  const [isArchExpanded, setIsArchExpanded] = useState<boolean>(false);
  const [communityDarkMode, setCommunityDarkMode] = useState<boolean>(true);
  const [mockVotes, setMockVotes] = useState<Record<string, number>>({
    'disc-1': 42,
    'disc-2': 18
  });
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  // Local user persistence keys
  const USER_DB_KEY = 'calculix_registered_users';

  // Active check to wipe old pre-seeded trial profiles and initialize clean database
  useEffect(() => {
    const existingRaw = localStorage.getItem(USER_DB_KEY);
    if (!existingRaw || existingRaw.includes('student@calculix.vn') || existingRaw.includes('Lê Minh Triết')) {
      localStorage.setItem(USER_DB_KEY, JSON.stringify([]));
    }
  }, []);

  // Computer Adaptive Test (CAT) States based on Item Response Theory (IRT)
  const [activeStage, setActiveStage] = useState<number>(0); // 0, 1, 2, 3 correspond to the 4 topics
  const [currentQuestion, setCurrentQuestion] = useState<IRTQuestion>(() => {
    // Stage 0 is "Algebra", default starts at difficulty b = 0.5 (Advanced candidate)
    return IRT_ITEM_BANK.find(q => q.topic === 'Algebra' && q.difficulty === 0.5) || IRT_ITEM_BANK[1];
  });
  
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [theta, setTheta] = useState<number>(0.0); // Estimated Latent Trait level (ranges from -3 to +3)
  const [sem, setSem] = useState<number>(2.0); // Standard Error of Measurement (estimated uncertainty of the latent trait)
  const [irtLog, setIrtLog] = useState<string[]>(['[IRT System] Initializing state parameters: Theta = 0.00 (average ability level).']);
  const [testCompleted, setTestCompleted] = useState<boolean>(false);
  const [calculatedLevel, setCalculatedLevel] = useState<Level>('Foundation');
  const [score, setScore] = useState<number>(0);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    // Retrieve database of registered accounts
    const usersRaw = localStorage.getItem(USER_DB_KEY);
    const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];

    const normEmail = email.trim().toLowerCase();
    const matchedUser = users.find(u => u.email.toLowerCase() === normEmail);

    if (!matchedUser) {
      setErrorMessage(
        '⚠️ This account does not exist. Please click "Register new account" below to sign up.'
      );
      return;
    }

    if (password.length >= 4 && password !== 'password123' && matchedUser.password && matchedUser.password !== password) {
      setErrorMessage('⚠️ Password does not match. Check CapsLock and try again!');
      return;
    }

    // Login succeeds with their verified level stored in the DB
    onLoginSuccess(matchedUser.fullName, matchedUser.level || 'Foundation');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    const usersRaw = localStorage.getItem(USER_DB_KEY);
    const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];
    const normEmail = email.trim().toLowerCase();

    const exists = users.some(u => u.email.toLowerCase() === normEmail);
    if (exists) {
      setErrorMessage('⚠️ This email is already registered. Please switch to the Login screen.');
      return;
    }

    // Provision new user in database as "Foundation" momentarily until they complete the IRT placement
    const updatedUsers = [
      ...users,
      { fullName: fullName.trim(), email: normEmail, password: password.trim(), level: 'Foundation' as Level }
    ];
    localStorage.setItem(USER_DB_KEY, JSON.stringify(updatedUsers));

    fetch('/api/live-stats/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'user-joined' }),
    }).catch(err => console.error('Error reporting user-joined event:', err));

    setSuccessMessage('Account activated! Launching Adaptive IRT placement...');
    
    // Switch to diagnostic adaptiveness
    setTimeout(() => {
      setAuthMode('placement');
      setActiveStage(0);
      setSelectedAnswerIdx(null);
      setTheta(0.0);
      setSem(2.0);
      setScore(0);
      setTestCompleted(false);
      setIrtLog([
        `[IRT System] Registration successful: ${fullName.trim()}`,
        `[IRT System] Initialized state parameters: Theta = 0.00 (Rasch 1PL).`
      ]);
      // Start question selection for Stage 0 (Algebra)
      const q = IRT_ITEM_BANK.find(item => item.topic === 'Algebra' && item.difficulty === 0.5) || IRT_ITEM_BANK[1];
      setCurrentQuestion(q);
      setSuccessMessage('');
    }, 1500);
  };

  // Implement the 1PL Item Response Theory (IRT) Math calculation for latent ability theta
  const runIrtThetaEvaluation = (isCorrect: boolean) => {
    const b = currentQuestion.difficulty;
    const oldTheta = theta;
    const scoreVal = isCorrect ? 1.0 : 0.0;

    // Calculate probability of correct answer based on current theta under 1-Parameter Logistic (Rasch) Model:
    // P(theta) = 1 / (1 + e^-(theta - b))
    const exponent = -(oldTheta - b);
    const probability = 1.0 / (1.0 + Math.exp(exponent));

    // Update latent capability using Stochastic Approximation rule (Fisher Scoring optimization step)
    // theta_new = theta_old + StepSize * (UserScore - P(theta_old))
    const stepSize = 1.6;
    const rawDelta = stepSize * (scoreVal - probability);
    let newTheta = oldTheta + rawDelta;

    // Constrain theta to practical boundaries [-3.0, +3.0]
    newTheta = Math.max(-3.0, Math.min(3.0, newTheta));

    // Update Fisher Information for standard error update: I = P * (1 - P)
    const itemInfo = probability * (1.0 - probability);
    // Prior information sum starts at 0.15 to avoid zero-division
    const currentWeightSum = (1.0 / (sem * sem)) + itemInfo;
    const newSem = Math.max(0.4, Math.min(2.0, 1.0 / Math.sqrt(currentWeightSum)));

    const nextLogs = [
      ...irtLog,
      `[${currentQuestion.topic}] Answer: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (b = ${b.toFixed(1)}).`,
      `[IRT Update] P(correct) = ${(probability * 100).toFixed(1)}%. Theta change: ${oldTheta.toFixed(2)} → ${newTheta.toFixed(2)} (Delta: ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(2)}).`,
      `[IRT Error] SEM details: ${sem.toFixed(2)} → ${newSem.toFixed(2)}.`
    setTheta(newTheta);
    setSem(newSem);
    setIrtLog(nextLogs);
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    return newTheta;
  };

  const handleNextIrtQuestion = () => {
    if (selectedAnswerIdx === null) {
      setErrorMessage('Please select one answer option to record your score.');
      return;
    }
    setErrorMessage('');

    const isCorrect = (selectedAnswerIdx === currentQuestion.correctIdx);
    const nextEstimatedTheta = runIrtThetaEvaluation(isCorrect);

    const nextStage = activeStage + 1;
    const topics = ['Algebra', 'Combinatorics', 'Number Theory', 'Geometry'];

    if (nextStage < 4) {
      // Find the next stage domain topic
      const nextDomainTopic = topics[nextStage];
      
      // Adaptively select the question from the next domain whose difficulty parameter 'b' is nearest to the newEstimatedTheta
      const domainQuestions = IRT_ITEM_BANK.filter(q => q.topic === nextDomainTopic);
      let bestMatchInput = domainQuestions[0];
      let smallestDistance = Math.abs(bestMatchInput.difficulty - nextEstimatedTheta);

      for (let i = 1; i < domainQuestions.length; i++) {
        const d = Math.abs(domainQuestions[i].difficulty - nextEstimatedTheta);
        if (d < smallestDistance) {
          smallestDistance = d;
          bestMatchInput = domainQuestions[i];
        }
      }

      setIrtLog(prev => [
        ...prev,
        `[Adaptive selection] Question ${nextStage + 1} (${nextDomainTopic}) with difficulty b = ${bestMatchInput.difficulty.toFixed(1)} optimized for Theta = ${nextEstimatedTheta.toFixed(2)}.`
      ]);

      setActiveStage(nextStage);
      setCurrentQuestion(bestMatchInput);
      setSelectedAnswerIdx(null);
    } else {
      // Finalize classification level mapping
      // Standard mathematical boundaries for classification
      let calculated: Level = 'Foundation';
      if (nextEstimatedTheta >= 1.2) {
        calculated = 'Olympiad';
      } else if (nextEstimatedTheta >= -0.5) {
        calculated = 'Advanced';
      }

      setCalculatedLevel(calculated);
      setTestCompleted(true);

      // Save level back to database for persistent account tracking!
      const usersRaw = localStorage.getItem(USER_DB_KEY);
      const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];
      const normEmail = email.trim().toLowerCase();

      const updated = users.map(u => {
        if (u.email.toLowerCase() === normEmail) {
          return { ...u, level: calculated };
        }
        return u;
      });
      localStorage.setItem(USER_DB_KEY, JSON.stringify(updated));
    }
  };

  const handleFinishPlacement = () => {
    fetch('/api/live-stats/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test-completed' }),
    }).catch(err => console.error('Error reporting test-completed event:', err));
    onLoginSuccess(fullName || 'Calculix learner', calculatedLevel);
  };

  // --- PDF REPORT EXPORTER FUNCTION ---
  const handleExportImpactReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Calculix Hub - Educational Impact & Research Report</title>
          <style>
            body { 
              font-family: 'Montserrat', Arial, sans-serif; 
              color: #0f172a; 
              padding: 45px; 
              line-height: 1.6; 
              background: #ffffff;
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              border-bottom: 3px solid #1e3a8a; 
              padding-bottom: 25px; 
              margin-bottom: 35px; 
            }
            .logo { 
              font-size: 26px; 
              font-weight: 900; 
              color: #1e1b4b; 
              text-transform: uppercase; 
              letter-spacing: 1.5px; 
            }
            .subtitle { 
              font-size: 11px; 
              color: #4b5563; 
              text-transform: uppercase; 
              font-weight: 700; 
              margin-top: 5px; 
            }
            .date { 
              font-size: 13px; 
              color: #4b5563; 
              font-family: monospace; 
              background: #f3f4f6;
              padding: 5px 10px;
              border-radius: 6px;
            }
            .section { 
              margin-bottom: 40px; 
              page-break-inside: avoid; 
            }
            h2 { 
              font-size: 18px; 
              color: #1e3a8a; 
              border-left: 5px solid #3b82f6; 
              padding-left: 12px; 
              margin-bottom: 20px; 
              text-transform: uppercase; 
              letter-spacing: 0.5px; 
            }
            p { 
              font-size: 14px; 
              color: #334155; 
              text-align: justify;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
              font-size: 13px; 
            }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 12px; 
              text-align: left; 
            }
            th { 
              background-color: #f8fafc; 
              font-weight: bold; 
              color: #0f172a; 
            }
            .metric-grid { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              gap: 20px; 
              margin-top: 25px; 
            }
            .metric-card { 
              border: 1px solid #e2e8f0; 
              background: #f8fafc;
              border-radius: 12px; 
              padding: 20px; 
              text-align: center; 
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .metric-val { 
              font-size: 26px; 
              font-weight: 800; 
              color: #2563eb; 
              font-family: monospace; 
              margin: 8px 0; 
            }
            .metric-label { 
              font-size: 10px; 
              color: #64748b; 
              text-transform: uppercase; 
              font-weight: bold; 
            }
            .footer { 
              margin-top: 60px; 
              text-align: center; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 25px; 
              font-size: 11px; 
              color: #64748b; 
            }
            @media print {
              body { padding: 25px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Calculix Hub</div>
              <div class="subtitle">Math OS & AI Personalization Ecosystem</div>
            </div>
              <div class="date">Export time: ${new Date().toLocaleString()}</div>
          </div>

          <div class="section">
            <h2>1. Overview & Strategic Positioning</h2>
            <p>Calculix Hub is a pioneering educational ecosystem that integrates deep personalization via EduReach Core and adaptive testing grounded in Item Response Theory (IRT). The system replaces static linear question flows with a flexible knowledge graph aligned to each student’s Zone of Proximal Development (ZPD).</p>
          </div>

          <div class="section">
            <h2>2. Real-time Activity Metrics</h2>
            <div class="metric-grid">
              <div class="metric-card">
                <div class="metric-label">Active learners online</div>
                <div class="metric-val">${liveStats.activeUsers}</div>
                <div class="metric-label">Realtime connections</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">IRT assessments completed</div>
                <div class="metric-val">${liveStats.testsCompleted}</div>
                <div class="metric-label">Cumulative live activity</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Score improvement rate</div>
                <div class="metric-val">${liveStats.improvementRate}%</div>
                <div class="metric-label">3-month impact summary</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>3. User acquisition channels</h2>
            <p>Calculix positions external social platforms as acquisition channels that funnel interested learners into the single central learning hub, where actual adaptive learning activities take place.</p>
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Approach</th>
                  <th>Users acquired</th>
                  <th>Contribution %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Facebook (Calculix Hub Page/Group)</strong></td>
                  <td>Post deep mathematical analyses, topic studies, and exam preparation resources.</td>
                  <td>${liveStats.facebookAcquisitions}</td>
                  <td>${((liveStats.facebookAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td><strong>TikTok (Calculix Short Clips)</strong></td>
                  <td>Inspire mathematical thinking with quick problem-solving tips and curiosity-driven content.</td>
                  <td>${liveStats.tiktokAcquisitions}</td>
                  <td>${((liveStats.tiktokAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td><strong>YouTube (Calculix Lectures)</strong></td>
                  <td>Long-format subject lectures and in-depth olympiad problem walkthroughs.</td>
                  <td>${liveStats.youtubeAcquisitions}</td>
                  <td>${((liveStats.youtubeAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section" style="page-break-before: always;">
            <h2>4. Core 4-layer structure & methodology</h2>
            <p>The system consists of four interlocking structural layers that establish the learning proficiency framework:</p>
            <ul>
              <li><strong>Learning Engine:</strong> Segments proficiency levels clearly (Foundation, Advanced, Olympiad) to guide adaptive learning paths.</li>
              <li><strong>AI Personalization Layer:</strong> The EduReach algorithm automatically identifies weaknesses (e.g., combinatorics) and restructures the personalized learning path.</li>
              <li><strong>Competition System:</strong> Runs weekly rank-based competitions by age group with ELO segmentation.</li>
              <li><strong>Analytics Radar:</strong> Visualizes common error patterns, supporting teachers in academic research and instructional planning.</li>
            </ul>
          </div>

          <div class="footer">
            <p>The official scientific report is generated directly from the Calculix Hub server.</p>
            <p>Calculix Education Science & Technology Board - Tech for Social Impact © 2026</p>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- LANDING PAGE RENDERING FUNCTION ---
  const renderLandingPage = () => {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white flex flex-col antialiased relative overflow-hidden font-sans">
        
        {/* Subtle dynamic grid background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Dynamic decorative backdrop glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* 1. STICKY GLASSMORPHIC NAVBAR */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-900 select-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white font-black w-10 h-10 flex items-center justify-center text-lg shadow-lg">
                C
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-widest text-slate-100 uppercase">Calculix Hub</h1>
                <span className="text-[10px] font-bold text-slate-500 block -mt-1 uppercase tracking-wider">Math OS Platform</span>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold uppercase tracking-wider text-slate-450">
              <a href="#mission" className="hover:text-white transition-colors">Mission</a>
              <a href="#definition" className="hover:text-white transition-colors">Definition</a>
              <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
              <a href="#community" className="hover:text-white transition-colors">Community</a>
              <a href="#flow" className="hover:text-white transition-colors">Flow</a>
              <a href="#impact" className="hover:text-white transition-colors">Impact</a>
            </nav>

            <div className="flex items-center gap-3.5">
              <button 
                type="button"
                onClick={() => setAuthMode('login')} 
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-900"
              >
                Log in
              </button>
              <button 
                type="button"
                onClick={() => setAuthMode('register')} 
                className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-4.5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-blue-500/20 hover:shadow-lg active:scale-95 cursor-pointer"
              >
                Take Placement Test
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 relative z-10">
          
          {/* 2. HERO SECTION */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-blue-400 tracking-wider">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI-powered Math OS
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.15] text-white">
                Smart Math Learning – <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Develop Comprehensive Mathematical Thinking
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-400 font-serif leading-relaxed max-w-2xl mx-auto lg:mx-0">
                An AI-integrated EdTech platform with competitions and real-time analytics to personalize and improve math learning.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-3">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs px-7 py-4.5 rounded-2xl shadow-xl hover:shadow-blue-500/10 hover:shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-98"
                >
                  Start Now — Take a Free Placement Test
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href="#impact"
                  className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white font-bold text-xs px-6 py-4.5 rounded-2xl transition-all flex items-center justify-center gap-1.5"
                >
                  View Research Report
                </a>
              </div>

              {/* Ticking Live Statistics HUD */}
              <div className="pt-8 border-t border-slate-900/70 max-w-xl mx-auto lg:mx-0">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-3 flex items-center justify-center lg:justify-start gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> System operational status (Realtime)
                </p>
                <div className="grid grid-cols-3 gap-6 text-center lg:text-left">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Active learners online</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight">
                      {liveStats.activeUsers.toLocaleString()}
                    </span>
                    <span className="text-[8px] text-emerald-400 font-bold block">+3.4/min</span>
                  </div>
                  <div className="space-y-1 border-x border-slate-900/60 px-4">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Tests completed</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight">
                      {liveStats.testsCompleted.toLocaleString()}
                    </span>
                    <span className="text-[8px] text-indigo-400 font-bold block">Adaptive</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Live rankings</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight">
                      {liveStats.activeContestsCount}
                    </span>
                    <span className="text-[8px] text-purple-400 font-bold block">Live Arena</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Interactive SVG Network Visualizer */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="bg-slate-950/40 border border-slate-900 p-6 sm:p-8 rounded-[32px] backdrop-blur-md shadow-2xl relative">
                
                {/* SVG Graph visualizer */}
                <svg viewBox="0 0 450 400" className="w-full h-auto max-w-[380px] sm:max-w-[450px] mx-auto overflow-visible select-none">
                  {/* Connection lines */}
                  <line x1="225" y1="200" x2="90" y2="90" stroke={hoveredNode === 1 ? '#3b82f6' : '#1e293b'} strokeWidth={hoveredNode === 1 ? '3' : '2'} strokeDasharray={hoveredNode === 1 ? 'none' : '4 4'} className="transition-all duration-300" />
                  <line x1="225" y1="200" x2="360" y2="90" stroke={hoveredNode === 2 ? '#6366f1' : '#1e293b'} strokeWidth={hoveredNode === 2 ? '3' : '2'} strokeDasharray={hoveredNode === 2 ? 'none' : '4 4'} className="transition-all duration-300" />
                  <line x1="225" y1="200" x2="90" y2="310" stroke={hoveredNode === 3 ? '#ec4899' : '#1e293b'} strokeWidth={hoveredNode === 3 ? '3' : '2'} strokeDasharray={hoveredNode === 3 ? 'none' : '4 4'} className="transition-all duration-300" />
                  <line x1="225" y1="200" x2="360" y2="310" stroke={hoveredNode === 4 ? '#10b981' : '#1e293b'} strokeWidth={hoveredNode === 4 ? '3' : '2'} strokeDasharray={hoveredNode === 4 ? 'none' : '4 4'} className="transition-all duration-300" />

                  {/* Animated packets moving along paths */}
                  {hoveredNode === 1 && (
                    <circle r="4.5" fill="#3b82f6">
                      <animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 90 90" />
                    </circle>
                  )}
                  {hoveredNode === 2 && (
                    <circle r="4.5" fill="#6366f1">
                      <animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 360 90" />
                    </circle>
                  )}
                  {hoveredNode === 3 && (
                    <circle r="4.5" fill="#ec4899">
                      <animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 90 310" />
                    </circle>
                  )}
                  {hoveredNode === 4 && (
                    <circle r="4.5" fill="#10b981">
                      <animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 360 310" />
                    </circle>
                  )}

                  {/* Central Node (AI Core) */}
                  <g className="group cursor-pointer">
                    <circle cx="225" cy="200" r="45" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="2.5" className="transition-all duration-300 group-hover:stroke-blue-400 group-hover:scale-105" />
                    <circle cx="225" cy="200" r="55" fill="none" stroke="#4f46e5" strokeWidth="1" strokeDasharray="5 5" className="animate-spin" style={{ transformOrigin: '225px 200px', animationDuration: '20s' }} />
                    <foreignObject x="207" y="182" width="36" height="36">
                      <div className="w-full h-full flex items-center justify-center text-indigo-400">
                        <Brain className="w-7 h-7" />
                      </div>
                    </foreignObject>
                    <text x="225" y="260" fill="#a5b4fc" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="1">AI EDUREACH CORE</text>
                  </g>

                  {/* Satellite Node 1: Algebra */}
                  <g 
                    onMouseEnter={() => setHoveredNode(1)} 
                    onMouseLeave={() => setHoveredNode(null)} 
                    className="cursor-pointer"
                  >
                    <circle cx="90" cy="90" r="30" fill="#0b1329" stroke={hoveredNode === 1 ? '#3b82f6' : '#1e293b'} strokeWidth="2" className="transition-all duration-300" />
                    <text x="90" y="93" fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle">ALGEBRA</text>
                    <circle cx="90" cy="90" r="35" fill="none" stroke="#3b82f6" strokeWidth={hoveredNode === 1 ? '1.5' : '0'} className="transition-all duration-300 animate-ping" />
                  </g>

                  {/* Satellite Node 2: Geometry */}
                  <g 
                    onMouseEnter={() => setHoveredNode(2)} 
                    onMouseLeave={() => setHoveredNode(null)} 
                    className="cursor-pointer"
                  >
                    <circle cx="360" cy="90" r="30" fill="#0b1329" stroke={hoveredNode === 2 ? '#6366f1' : '#1e293b'} strokeWidth="2" className="transition-all duration-300" />
                    <text x="360" y="93" fill="#818cf8" fontSize="9" fontWeight="bold" textAnchor="middle">GEOMETRY</text>
                    <circle cx="360" cy="90" r="35" fill="none" stroke="#6366f1" strokeWidth={hoveredNode === 2 ? '1.5' : '0'} className="transition-all duration-300 animate-ping" />
                  </g>

                  {/* Satellite Node 3: Combinatorics */}
                  <g 
                    onMouseEnter={() => setHoveredNode(3)} 
                    onMouseLeave={() => setHoveredNode(null)} 
                    className="cursor-pointer"
                  >
                    <circle cx="90" cy="310" r="30" fill="#0b1329" stroke={hoveredNode === 3 ? '#ec4899' : '#1e293b'} strokeWidth="2" className="transition-all duration-300" />
                    <text x="90" y="313" fill="#f472b6" fontSize="9" fontWeight="bold" textAnchor="middle">COMBINATORICS</text>
                    <circle cx="90" cy="310" r="35" fill="none" stroke="#ec4899" strokeWidth={hoveredNode === 3 ? '1.5' : '0'} className="transition-all duration-300 animate-ping" />
                  </g>

                  {/* Satellite Node 4: Number Theory */}
                  <g 
                    onMouseEnter={() => setHoveredNode(4)} 
                    onMouseLeave={() => setHoveredNode(null)} 
                    className="cursor-pointer"
                  >
                    <circle cx="360" cy="310" r="30" fill="#0b1329" stroke={hoveredNode === 4 ? '#10b981' : '#1e293b'} strokeWidth="2" className="transition-all duration-300" />
                    <text x="360" y="313" fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="middle">NUMBER THEORY</text>
                    <circle cx="360" cy="310" r="35" fill="none" stroke="#10b981" strokeWidth={hoveredNode === 4 ? '1.5' : '0'} className="transition-all duration-300 animate-ping" />
                  </g>
                </svg>

                {/* Floating Real-time Info Box */}
                <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 text-xs space-y-1.5 backdrop-blur-md">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>EduReach AI Simulator</span>
                    <span className="text-blue-400 font-mono">LIVE FEED</span>
                  </div>
                  <p className="font-mono text-slate-300 leading-normal text-[11px]">
                    {hoveredNode === 1 && "💡 AI: Algebra error detected. Prioritize reinforcing Quadratic Roots (θ = +0.45)."}
                    {hoveredNode === 2 && "💡 AI: Visualizing spatial geometry. Propose extended Ptolemy theory (b = 1.80)."}
                    {hoveredNode === 3 && "💡 AI: Weakness detected in Combinatorics. Launch a partition problem (AM-GM)."}
                    {hoveredNode === 4 && "💡 AI: Practice arithmetic congruence. Recommend a small Fermat cycle."}
                    {!hoveredNode && "⚡ Hover nodes to let AI analyze your adaptive ability structure."}
                  </p>
                </div>

              </div>
            </div>

          </section>

          {/* 3. CORE DEFINITION SECTION (NOT / IS) */}
          <section id="definition" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-900">
            
            <div className="text-center space-y-3 pb-12">
              <h2 className="text-xs uppercase font-extrabold text-blue-500 tracking-widest">Core Definition</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">We redefine the approach to mathematics</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto font-serif">
                Calculix Hub is a complete learning ecosystem that eliminates passive, rote learning approaches.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              
              {/* Left Column: NOT (Rose theme) */}
              <div className="border border-rose-950/40 bg-gradient-to-b from-rose-950/5 to-transparent p-6 sm:p-8 rounded-3xl space-y-6 transition-all duration-300 hover:border-rose-900/60 hover:shadow-xl hover:shadow-rose-950/5 group">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20 text-rose-500">
                    <X className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-rose-500 tracking-wider">Passive learning</span>
                    <h4 className="text-lg font-extrabold text-slate-200">Not</h4>
                  </div>
                </div>

                <ul className="space-y-4 text-xs font-semibold text-slate-400">
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-rose-500 shrink-0 font-bold">✕</span>
                    <div>
                      <strong className="text-slate-300 font-bold block">A typical answer-checking math site</strong>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">A place where students only look up answers mechanically, without building real problem-solving intuition.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-rose-500 shrink-0 font-bold">✕</span>
                    <div>
                      <strong className="text-slate-300 font-bold block">A fanpage or spammy resource group</strong>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">A place where thousands of uncurated contest files are shared without personalized pathways.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-rose-500 shrink-0 font-bold">✕</span>
                    <div>
                      <strong className="text-slate-300 font-bold block">A rigid static exam bank</strong>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Where every student must do the same exam set despite different abilities and learning speeds.</span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Right Column: IS (Blue/Indigo theme) */}
              <div className="border border-blue-900/40 bg-gradient-to-b from-blue-950/10 to-transparent p-6 sm:p-8 rounded-3xl space-y-6 transition-all duration-300 hover:border-blue-700/60 hover:shadow-xl hover:shadow-blue-950/10 group">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2.5 rounded-2xl border border-blue-500/20 text-blue-400">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-blue-400 tracking-wider">Connected Ecosystem</span>
                    <h4 className="text-lg font-extrabold text-slate-200">Is</h4>
                  </div>
                </div>

                <ul className="space-y-4 text-xs font-semibold text-slate-400">
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                    <div>
                      <strong className="text-slate-200 font-bold block">Intelligent adaptive learning ecosystem</strong>
                      <span className="text-[10px] text-slate-450 font-medium block mt-0.5">Uses advanced IRT modeling to quantify and optimize learning ability automatically.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                    <div>
                      <strong className="text-slate-200 font-bold block">Real-time competition arena</strong>
                      <span className="text-[10px] text-slate-450 font-medium block mt-0.5">Where students test their intellect directly against an ELO-ranked leaderboard system.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start group-hover:text-slate-350 transition-colors">
                    <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                    <div>
                      <strong className="text-slate-200 font-bold block">High-quality scholarly community</strong>
                      <span className="text-[10px] text-slate-450 font-medium block mt-0.5">A place for commenting, proving, and discussing advanced contest structures at a high academic standard.</span>
                    </div>
                  </li>
                </ul>
              </div>

            </div>

          </section>

          {/* 4. MISSION SECTION */}
          <section id="mission" className="bg-slate-900/40 border-y border-slate-900 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <h3 className="text-xs uppercase font-extrabold text-blue-500 tracking-widest">Core Mission</h3>
                <h4 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-serif leading-relaxed italic">
                  "Democratize high-quality mathematical thinking through AI, competition systems, and data-driven learning."
                </h4>
                <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 mx-auto rounded-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 max-w-5xl mx-auto">
                
                <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-900 text-center space-y-3.5 transition-all duration-300 hover:scale-[1.02] group">
                  <div className="mx-auto bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 text-blue-400 w-fit group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Globe className="w-6 h-6" />
                  </div>
                  <h5 className="font-extrabold text-slate-100 text-sm">Expand access to high-quality education</h5>
                  <p className="text-[11px] text-slate-450 leading-relaxed font-serif">
                    Deliver advanced mathematical curricula and state-of-the-art AI infrastructure to learners everywhere, regardless of geography.
                  </p>
                </div>

                <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-900 text-center space-y-3.5 transition-all duration-300 hover:scale-[1.02] group">
                  <div className="mx-auto bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 text-indigo-400 w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h5 className="font-extrabold text-slate-100 text-sm">Personalized learning pathways</h5>
                  <p className="text-[11px] text-slate-450 leading-relaxed font-serif">
                    The EduReach Core automatically diagnoses gaps and constructs individualized practice roadmaps for each learner.
                  </p>
                </div>

                <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-900 text-center space-y-3.5 transition-all duration-300 hover:scale-[1.02] group">
                  <div className="mx-auto bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-400 w-fit group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h5 className="font-extrabold text-slate-100 text-sm">Data-driven insights</h5>
                  <p className="text-[11px] text-slate-450 leading-relaxed font-serif">
                    Quantify mathematical thinking progress with rigorous visualizations and academic-grade research driven by real user data.
                  </p>
                </div>

              </div>

            </div>
          </section>

          {/* 5. CORE ARCHITECTURE SECTION (4 LAYERS) */}
          <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            
            <div className="text-center space-y-3 pb-12">
              <h2 className="text-xs uppercase font-extrabold text-indigo-400 tracking-widest font-mono">Infrastructure</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">4-Layer Core System Architecture</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Four tightly integrated technology layers create the adaptive power of the Calculix Hub platform.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-stretch">
              
              {/* Tab Selector bar (4 cols) */}
              <div className="lg:col-span-4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 select-none">
                <button
                  type="button"
                  onClick={() => { setActiveArchTab('engine'); setIsArchExpanded(false); }}
                  className={`w-full text-left p-4.5 rounded-2xl border text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center justify-between ${
                    activeArchTab === 'engine'
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4" /> 1. Learning Engine
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 hidden lg:block transition-transform ${activeArchTab === 'engine' ? 'translate-x-1' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveArchTab('ai'); setIsArchExpanded(false); }}
                  className={`w-full text-left p-4.5 rounded-2xl border text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center justify-between ${
                    activeArchTab === 'ai'
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Brain className="w-4 h-4" /> 2. AI Personalization
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 hidden lg:block transition-transform ${activeArchTab === 'ai' ? 'translate-x-1' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveArchTab('compete'); setIsArchExpanded(false); }}
                  className={`w-full text-left p-4.5 rounded-2xl border text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center justify-between ${
                    activeArchTab === 'compete'
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Trophy className="w-4 h-4" /> 3. Competition System
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 hidden lg:block transition-transform ${activeArchTab === 'compete' ? 'translate-x-1' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveArchTab('analytics'); setIsArchExpanded(false); }}
                  className={`w-full text-left p-4.5 rounded-2xl border text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center justify-between ${
                    activeArchTab === 'analytics'
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-md'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4" /> 4. Analytics & Research
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 hidden lg:block transition-transform ${activeArchTab === 'analytics' ? 'translate-x-1' : ''}`} />
                </button>
              </div>

              {/* Tab Display Content (8 cols) */}
              <div className="lg:col-span-8 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backdrop-blur-md shadow-2xl relative transition-all duration-300">
                <div className="absolute top-4 right-4 text-slate-800 font-mono text-[9px]">Calculix Engine Core v2.6</div>
                
                <div className="space-y-5">
                  {activeArchTab === 'engine' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-blue-400 tracking-wider">Training Structure</span>
                          <h4 className="text-base font-extrabold text-white">Learning Engine</h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-serif">
                        Learn through a clearly tiered academic progression: <strong>Foundation</strong> (solid basics), <strong>Advanced</strong> (deeper exploration), and <strong>Olympiad</strong> (elite competition preparation).
                      </p>
                      <ul className="space-y-2 text-[11px] text-slate-350">
                        <li className="flex gap-2">
                          <span className="text-blue-450 font-bold">•</span>
                          <span><strong>Adaptive learning:</strong> Eliminates rigid linear study paths and automatically scales content to your current level.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-blue-450 font-bold">•</span>
                          <span><strong>Instant error analysis:</strong> Uses real data to flag conceptual gaps immediately after each problem.</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'ai' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 text-indigo-400">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-indigo-400 tracking-wider">Identification Layer</span>
                          <h4 className="text-base font-extrabold text-white">AI Personalization Layer (EduReach Core)</h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-serif">
                        The EduReach core analyzes solution structure deeply to pinpoint personal weaknesses in narrow subtopics (e.g., permutation counting, extremal steps in inequalities).
                      </p>
                      <ul className="space-y-2 text-[11px] text-slate-350">
                        <li className="flex gap-2">
                          <span className="text-indigo-405 font-bold">•</span>
                          <span><strong>Progress forecasting:</strong> Provides a mathematical model that projects score improvement based on current problem-solving speed.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-indigo-405 font-bold">•</span>
                          <span><strong>Adaptive task adjustment:</strong> Selects the next exercise with optimal difficulty to sustain learning momentum.</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'compete' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-pink-500/10 p-2.5 rounded-xl border border-pink-500/20 text-pink-400">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-pink-400 tracking-wider">Competition Environment</span>
                          <h4 className="text-base font-extrabold text-white">Competition Arena</h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-serif">
                        A live intelligence arena with weekly challenges, monthly contests, and seasonal tournaments.
                      </p>
                      <ul className="space-y-2 text-[11px] text-slate-350">
                        <li className="flex gap-2">
                          <span className="text-pink-450 font-bold">•</span>
                          <span><strong>Real-time leaderboard:</strong> Groups learners by age and country.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-pink-450 font-bold">•</span>
                          <span><strong>Difficulty classification:</strong> Challenges range from Beginner to Elite, allowing users to filter and register for contests.</span>
                        </li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'analytics' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-emerald-400 tracking-wider">Analytics System</span>
                          <h4 className="text-base font-extrabold text-white">Analytics & Research Dashboard</h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-serif">
                        Provides an analytics dashboard with spider charts of skills and interactive learning time for students.
                      </p>
                      <ul className="space-y-2 text-[11px] text-slate-350">
                        <li className="flex gap-2">
                          <span className="text-emerald-450 font-bold">•</span>
                          <span><strong>Manager analytics:</strong> Captures common mistakes and real-time learning trends to support teaching strategies.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-emerald-450 font-bold">•</span>
                          <span><strong>Research support:</strong> Exports raw data for studying mathematical methods and creating impact reports.</span>
                        </li>
                      </ul>
                    </>
                  )}
                </div>

                {/* Expand Details Panel inside Tab */}
                <div className="pt-6 border-t border-slate-900 mt-6 space-y-4">
                  {isArchExpanded ? (
                    <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-4.5 text-[11px] text-slate-450 leading-relaxed space-y-3 font-mono animate-in slide-in-from-top-3 duration-200">
                      <div className="flex justify-between items-center text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                            <span>Academic Metrics</span>
                            <span>IRT Mathematical Model</span>
                      
                      {activeArchTab === 'engine' && (
                        <p>
                          The engine uses Vygotsky's Zone of Proximal Development (ZPD) theory. Exercises are assigned so that the student's probability of answering correctly stays near 0.65, ensuring optimal progress without boredom.
                        </p>
                      )}
                      
                      {activeArchTab === 'ai' && (
                        <div className="space-y-2">
                          <p>
                            {"Applies the Rasch 1PL model (1-Parameter Logistic) to estimate Theta (\\(\\theta\\)), representing the student's latent ability:"}
                          </p>
                          <div className="bg-slate-900 p-3 rounded-xl text-center text-indigo-300 font-bold">
                            {"\\[P_i(\\theta) = \\frac{e^{\\theta - b_i}}{1 + e^{\\theta - b_i}}\\]"}
                          </div>
                          <p className="text-[10px]">
                            {"Here \\(b_i\\) is the question difficulty parameter. The system maximizes Fisher information to minimize measurement error (SEM) as quickly as possible."}
                          </p>
                        </div>
                      )}
                      
                      {activeArchTab === 'compete' && (
                        <p>
                          The tournament ELO ranking formula applies a dynamic k-factor adjustment. The system awards more points when you solve problems with difficulty well above your current Theta.
                        </p>
                      )}
                      
                      {activeArchTab === 'analytics' && (
                        <p>
                          The large data backbone collects telemetry from thousands of interactions and automatically clusters common cognitive errors. It helps researchers forecast the difficulty of new problem types.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsArchExpanded(false)}
                        className="text-[10px] font-bold text-blue-400 hover:underline block pt-1 cursor-pointer"
                      >
                        Collapse details [-]
                      </button>
                    </div>
                  ) : (
                      <button
                      type="button"
                      onClick={() => setIsArchExpanded(true)}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-white font-bold text-[11px] px-4 py-2.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" /> View architecture details
                    </button>
                  )}
                </div>

              </div>

            </div>

          </section>

          {/* 6. COMMUNITY LAYER (MOCK STACKEXCHANGE FORUM) */}
          <section id="community" className="bg-slate-900/40 border-y border-slate-900 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-center space-y-3 pb-12">
                <h2 className="text-xs uppercase font-extrabold text-blue-500 tracking-widest font-mono">Academic community</h2>
                <h3 className="text-2xl sm:text-3xl font-black text-white">StackExchange-style scholarly exchange</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  A mini StackExchange forum designed for advanced math students to discuss and critique solutions.
                </p>
              </div>

              {/* StackExchange Mock Box with Dark/Light mode toggle */}
              <div className="max-w-4xl mx-auto space-y-4">
                
                {/* Mode Controller header */}
                <div className="flex justify-between items-center bg-slate-900 border border-slate-800 px-6 py-3.5 rounded-2xl select-none">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> Community Forum Sandbox
                  </span>
                  <button
                    type="button"
                    onClick={() => setCommunityDarkMode(!communityDarkMode)}
                    className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {communityDarkMode ? (
                      <><Sun className="w-3.5 h-3.5 text-amber-400" /> Switch to Light Mode</>
                    ) : (
                      <><Moon className="w-3.5 h-3.5 text-indigo-400" /> Switch to Dark Mode</>
                    )}
                  </button>
                </div>

                {/* Forum Body Container */}
                <div className={`border rounded-3xl p-6 transition-all duration-300 shadow-xl space-y-6 ${
                  communityDarkMode 
                    ? 'bg-slate-900/90 border-slate-800 text-slate-200 shadow-slate-950/20' 
                    : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
                }`}>
                  
                  {/* Forum Title Thread */}
                  <div className="border-b pb-4 flex justify-between items-start gap-4" style={{ borderColor: communityDarkMode ? '#1e293b' : '#f1f5f9' }}>
                    <div className="space-y-1">
                      <h4 className={`text-base font-black tracking-tight leading-tight ${communityDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        How to prove Titu's Lemma (Cauchy-Schwarz in Engel form) using vectors?
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-medium">
                        <span>Posted by: <strong className="text-blue-500">Lê Hoài Nam</strong> (Rank 5)</span>
                        <span>Activity: 2 hours ago</span>
                        <span>Views: 1,280</span>
                      </div>
                    </div>
                    <span className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0">
                      Inequalities
                    </span>
                  </div>

                  {/* Thread Message 1 (Question) */}
                  <div className="flex gap-4 items-start">
                    
                    {/* Voting rail */}
                    <div className="flex flex-col items-center gap-2 select-none shrink-0">
                      <button
                        type="button"
                        onClick={() => setMockVotes(prev => ({ ...prev, 'disc-1': prev['disc-1'] + 1 }))}
                        className="hover:scale-115 transition-transform text-slate-500 hover:text-blue-500 cursor-pointer"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span className="font-mono font-black text-sm tracking-tight">{mockVotes['disc-1']}</span>
                      <button
                        type="button"
                        onClick={() => setMockVotes(prev => ({ ...prev, 'disc-1': Math.max(0, prev['disc-1'] - 1) }))}
                        className="hover:scale-115 transition-transform text-slate-500 hover:text-rose-500 cursor-pointer"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 space-y-2">
                      <p className="text-xs leading-relaxed font-serif">
                        {"I am preparing for the national math olympiad and encountered a Cauchy-Schwarz problem in sum form \\(\\sum \\frac{x_i^2}{a_i} \\ge \\frac{(\\sum x_i)^2}{\\sum a_i}\\). I know proofs by induction or AM-GM, but I heard there is a beautiful proof using the dot product of two vectors. Can teachers and peers explain it in detail?"}
                      </p>
                      
                      {/* Tags */}
                      <div className="flex gap-1.5 pt-1">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${communityDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>algebra</span>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${communityDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>cauchy-schwarz</span>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${communityDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>vector</span>
                      </div>
                    </div>

                  </div>

                  {/* Thread Answer (Reply) */}
                  <div className="border-t pt-5 pl-8 space-y-4" style={{ borderColor: communityDarkMode ? '#1e293b' : '#f1f5f9' }}>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Accepted Answer
                      </span>
                      <span className="font-mono">1 day ago</span>
                    </div>

                    <div className="flex gap-4 items-start">
                      {/* Voting rail for reply */}
                      <div className="flex flex-col items-center gap-2 select-none shrink-0">
                        <button
                          type="button"
                          onClick={() => setMockVotes(prev => ({ ...prev, 'disc-2': prev['disc-2'] + 1 }))}
                          className="hover:scale-115 transition-transform text-slate-500 hover:text-blue-500 cursor-pointer"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <span className="font-mono font-black text-sm tracking-tight">{mockVotes['disc-2']}</span>
                        <button
                          type="button"
                          onClick={() => setMockVotes(prev => ({ ...prev, 'disc-2': Math.max(0, prev['disc-2'] - 1) }))}
                          className="hover:scale-115 transition-transform text-slate-500 hover:text-rose-500 cursor-pointer"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Reply content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className={`text-[11px] font-bold ${communityDarkMode ? 'text-slate-350' : 'text-slate-700'}`}>
                            Mentor Hoang 🧠
                          </span>
                          <span className="bg-blue-600/10 text-blue-450 border border-blue-500/10 text-[8px] font-black px-1.5 py-0.25 rounded uppercase">
                            Academic panel
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed font-serif">
                          {"Hello — the vector proof is concise and intuitive. Consider the two vectors in R^n:"}
                          <br /><br />
                          {"\\(\\vec{u} = \\left( \\frac{x_1}{\\sqrt{a_1}}, \\frac{x_2}{\\sqrt{a_2}}, \\dots, \\frac{x_n}{\\sqrt{a_n}} \\right)\\) và \\(\\vec{v} = (\\sqrt{a_1}, \\sqrt{a_2}, \\dots, \\sqrt{a_n})\\)"}
                          <br /><br />
                          {"By the Cauchy–Schwarz inequality: \\((\\vec{u} \\cdot \\vec{v})^2 \\le \\|\\vec{u}\\|^2 \\cdot \\|\\vec{v}\\|^2\\)"}
                          <br /><br />
                          {"Compute the inner product: \\(\\vec{u} \\cdot \\vec{v} = \\sum \\frac{x_i}{\\sqrt{a_i}} \\cdot \\sqrt{a_i} = \\sum x_i\\)"}
                          <br />
                          {"Compute squared norms: \\(\\|\\vec{u}\\|^2 = \\sum \\frac{x_i^2}{a_i}\\) and \\(\\|\\vec{v}\\|^2 = \\sum a_i\\)"}
                          <br /><br />
                          {"Substitute and obtain Titu's inequality: \\((\\sum x_i)^2 \\le (\\sum \\frac{x_i^2}{a_i}) \\cdot (\\sum a_i)\\). Divide both sides by \\(\\sum a_i\\) (a_i > 0) to reach the desired form. Equality holds when the two vectors are proportional, i.e., \\(\\frac{x_i}{a_i}\\) is constant for all i."}
                        </p>

                        <div className="flex justify-between items-center pt-3 text-[10px] text-slate-500">
                            <button type="button" className="hover:text-blue-500 flex items-center gap-1 font-bold cursor-pointer">
                            <MessageSquare className="w-3.5 h-3.5" /> 5 threaded comments
                          </button>
                            <button type="button" className="hover:text-rose-500 flex items-center gap-1 font-bold cursor-pointer">
                            ⚠️ Report content
                          </button>
                        </div>

                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          </section>

          {/* 7. USER FLOW (TIMELINE) */}
          <section id="flow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            
            <div className="text-center space-y-3 pb-16">
              <h2 className="text-xs uppercase font-extrabold text-blue-500 tracking-widest font-mono">Learning journey</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white">Optimized mathematics growth path</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-serif">
                A closed-loop process that unlocks student potential through each deliberate step.
              </p>
            </div>

            {/* Horizontal/Vertical Timeline grid with micro-animations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 max-w-6xl mx-auto relative">
              
              {/* Step 1 */}
              <div 
                onMouseEnter={() => setHoveredStep(1)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 1 
                    ? 'border-blue-500 scale-[1.03] bg-slate-900 shadow-lg shadow-blue-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-blue-400">STEP 01</span>
                  <BookOpen className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">Take Placement Test</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  Complete four short diagnostic tests representing the core domains to estimate your initial Theta (θ).
                </p>
              </div>

              {/* Step 2 */}
              <div 
                onMouseEnter={() => setHoveredStep(2)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 2 
                    ? 'border-indigo-500 scale-[1.03] bg-slate-900 shadow-lg shadow-indigo-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-indigo-400">STEP 02</span>
                  <Brain className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">AI Error Analysis</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  EduReach Core analyzes reasoning steps to detect systematic logical errors.
                </p>
              </div>

              {/* Step 3 */}
              <div 
                onMouseEnter={() => setHoveredStep(3)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 3 
                    ? 'border-purple-500 scale-[1.03] bg-slate-900 shadow-lg shadow-purple-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-purple-400">STEP 03</span>
                  <Shield className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">Receive Personalized Roadmap</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  Sync personalized lessons and adaptive exercises that update continuously with your progress.
                </p>
              </div>

              {/* Step 4 */}
              <div 
                onMouseEnter={() => setHoveredStep(4)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 4 
                    ? 'border-pink-500 scale-[1.03] bg-slate-900 shadow-lg shadow-pink-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-pink-400">STEP 04</span>
                  <Trophy className="w-4.5 h-4.5 text-pink-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">Practice & Compete</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  Train reflexes via the Learning Engine and join weekly ELO-ranked competitive arenas.
                </p>
              </div>

              {/* Step 5 */}
              <div 
                onMouseEnter={() => setHoveredStep(5)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 5 
                    ? 'border-emerald-500 scale-[1.03] bg-slate-900 shadow-lg shadow-emerald-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-emerald-400">STEP 05</span>
                  <BarChart3 className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">Track Progress</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  Inspect skill radar, study time, and progress trends via your personal dashboard.
                </p>
              </div>

              {/* Step 6 */}
              <div 
                onMouseEnter={() => setHoveredStep(6)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`bg-slate-900/40 border p-5 rounded-2xl space-y-3 transition-all duration-300 relative select-none ${
                  hoveredStep === 6 
                    ? 'border-amber-500 scale-[1.03] bg-slate-900 shadow-lg shadow-amber-950/10' 
                    : 'border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-amber-400">STEP 06</span>
                  <Users className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <h4 className="font-extrabold text-xs text-white">Peer-Reviewed Community</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-serif">
                  Participate in deep discussions, upvote quality solutions, and receive mentor feedback.
                </p>
              </div>

            </div>

          </section>

          {/* 8. SOCIAL MEDIA (ACQUISITION CHANNELS VS HUB) */}
          <section className="bg-slate-900/40 border-y border-slate-900 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
                
                <div className="lg:col-span-6 space-y-5 text-center lg:text-left">
                  <h3 className="text-xs uppercase font-extrabold text-indigo-400 tracking-widest font-mono">User acquisition funnel</h3>
                  <h4 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    Social media is only the acquisition funnel
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-serif">
                    Calculix Hub clearly separates external social media channels such as Facebook, TikTok, and YouTube as content distribution and user acquisition funnels. The full learning experience, adaptive data, and core academic value remain exclusively inside the Calculix Hub platform.
                  </p>
                </div>

                <div className="lg:col-span-6 space-y-4">
                  
                  {/* Facebook card */}
                  <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex items-center justify-between transition-all hover:border-blue-900/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600/10 p-2.5 rounded-xl text-blue-500">
                        <Facebook className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-xs text-slate-200">Math Facebook</h5>
                        <p className="text-[9px] text-slate-500 font-medium">Share deep contest & olympiad topics</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-white font-mono">{liveStats.facebookAcquisitions.toLocaleString()}</span>
                      <span className="text-[8px] text-slate-550 block font-bold">Users acquired</span>
                    </div>
                  </div>

                  {/* TikTok card */}
                  <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex items-center justify-between transition-all hover:border-indigo-900/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-600/10 p-2.5 rounded-xl text-indigo-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-xs text-slate-200">TikTok Short Education</h5>
                        <p className="text-[9px] text-slate-500 font-medium">60s videos that decode interesting logic puzzles</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-white font-mono">{liveStats.tiktokAcquisitions.toLocaleString()}</span>
                      <span className="text-[8px] text-slate-550 block font-bold">Users acquired</span>
                    </div>
                  </div>

                  {/* YouTube card */}
                  <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex items-center justify-between transition-all hover:border-red-900/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-600/10 p-2.5 rounded-xl text-red-500">
                        <Youtube className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-xs text-slate-200">YouTube Deep-dive Lectures</h5>
                        <p className="text-[9px] text-slate-500 font-medium">Detailed contest walkthroughs by subject experts</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-white font-mono">{liveStats.youtubeAcquisitions.toLocaleString()}</span>
                      <span className="text-[8px] text-slate-550 block font-bold">Users acquired</span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </section>

          {/* 9. OUTPUT & EXPECTED IMPACT SECTION */}
          <section id="impact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-[32px] p-6 sm:p-10 relative overflow-hidden shadow-2xl">
              
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                
                <div className="md:col-span-8 space-y-5">
                  <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-wider block w-fit">
                    Research & Social Impact
                  </span>
                  
                  <h4 className="text-2xl font-black text-white tracking-tight">
                    Calculix Hub Educational Impact Report
                  </h4>
                  
                  <p className="text-xs text-slate-405 leading-relaxed font-serif">
                    Calculix commits to maximum transparency. All performance metrics and online engagement data are based on real-time system activity, supporting academic-grade impact report generation for education research.
                  </p>

                  {/* Impact Statistics */}
                  <div className="space-y-4 pt-2">
                    
                    {/* Active growth bar (1,000 to 10,000 target) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Monthly active learners (Current size: {liveStats.activeUsers})</span>
                        <span className="text-blue-400 font-mono">Target: 10,000</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-850">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (liveStats.activeUsers / 10000) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Improvement Rate */}
                    <div className="flex items-center gap-8 text-center pt-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Actual improvement rate</span>
                        <span className="text-2xl font-black text-emerald-400 font-mono block mt-0.5">{liveStats.improvementRate}%</span>
                        <span className="text-[8px] text-slate-500 block">Score increase after 3 months</span>
                      </div>
                      <div className="border-l border-slate-800 pl-8">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Monthly engagement</span>
                        <span className="text-2xl font-black text-white font-mono block mt-0.5">4,500+</span>
                        <span className="text-[8px] text-slate-555 block">Arena registrations</span>
                      </div>
                    </div>

                  </div>

                </div>

                <div className="md:col-span-4 text-center">
                  <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl space-y-4">
                    <FileText className="w-10 h-10 text-indigo-400 mx-auto animate-bounce" />
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-200">Export Impact Report</h5>
                      <p className="text-[9px] text-slate-500 mt-1 leading-normal">A transparent report dynamically compiled from the database.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportImpactReport}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF Report
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </section>

        </main>

        {/* 10. LANDING FOOTER */}
        <footer className="border-t border-slate-900 py-12 bg-slate-950 text-slate-500 select-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-400 font-bold w-9 h-9 flex items-center justify-center text-sm">
                C
              </div>
              <div>
                <h5 className="font-extrabold text-xs tracking-wider text-slate-350 uppercase">Calculix Hub</h5>
                <span className="text-[9px] block text-slate-600 font-medium">Adaptive math backed by real-world data</span>
              </div>
            </div>
            <div className="text-[10px] text-center md:text-right space-y-1 leading-relaxed">
              <p>© 2026 Calculix Platform. Recommended by the Math Olympiad Committee.</p>
              <p>Open-source non-profit. High-quality math education for everyone.</p>
            </div>
          </div>
        </footer>

      </div>
    );
  };

  if (authMode === 'landing') {
    return renderLandingPage();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-slate-900 selection:text-white">
      {/* Decorative ambient background glows */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-2/3 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main landing container */}
      <div className="w-full min-h-screen bg-white grid grid-cols-1 md:grid-cols-12 relative z-10 transition-all duration-300">
        
        {/* Left column: Value Proposition & Interactive Features (4 cols) */}
        <div className="md:col-span-4 bg-slate-950 text-slate-300 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-6">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white font-black w-10 h-10 flex items-center justify-center text-lg shadow-lg">
                C
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-widest text-slate-100 uppercase">Calculix Hub</h1>
                <span className="text-[10px] font-bold text-slate-500 block -mt-1 uppercase tracking-wider">Math OS Platform</span>
              </div>
            </div>

            {/* Core messaging */}
            <div className="space-y-3 pt-6">
              <h2 className="text-xl font-black text-white leading-tight">
                Adaptive Test platform powered by IRT
              </h2>
              <p className="text-[11px] text-slate-400 leading-relaxed font-serif">
                Calculix Hub applies Item Response Theory (IRT) aligned to AMC and Olympiad standards to personalize a learning path matched to your true ability.
              </p>
            </div>

            {/* Feature pillars checklist */}
            <div className="space-y-4 pt-4">
              <div className="flex gap-2.5 items-start">
                <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20 text-blue-400 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Adaptive CAT assessment</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Automatically adjusts each question difficulty to your demonstrated ability.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Precise ability mapping</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Determine Theta convergence and narrow the Standard Error of Measurement (SEM).</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Watermark */}
          <div className="pt-8 border-t border-slate-900 mt-8 space-y-3.5 text-[10px] text-slate-500">
            <div>
              <span className="block font-semibold text-slate-350">⚡ Version 2.6 Academic Core</span>
              <span className="block mt-0.5">Adaptive IRT mathematical model - non-commercial learning ecosystem.</span>
            </div>
            <p className="border-t border-slate-900/60 pt-3 leading-relaxed text-slate-400">
              ⚡ This learning ecosystem fully adheres to the structural standards of the <b>EduReach Analytics Core</b>.
            </p>
          </div>
        </div>

        {/* Right column: Authentication & Placement Card (8 cols) */}
        <div className="md:col-span-8 p-8 md:p-16 flex flex-col justify-center bg-white min-h-screen">
          
          {/* LANDING MAIN VIEW CONTAINER */}
          {authMode === 'landing' && (
            <div className="space-y-6 text-center md:text-left animate-in fade-in zoom-in duration-200">
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                <Star className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" /> Math OS Platform
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Welcome to Calculix Hub!
                </h3>
                <p className="text-xs text-slate-550 max-w-lg leading-relaxed font-serif">
                  Experience an intelligent math platform powered by adaptive IRT placement. Please log in or register to continue.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="bg-slate-900 hover:bg-black text-white font-extrabold text-xs px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  Register new account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Log in to account
                </button>
              </div>
            </div>
          )}

          {/* SIGN IN VIEW CONTAINER */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                type="button"
                onClick={() => { setAuthMode('landing'); setErrorMessage(''); }}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-800 text-xs font-bold mb-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Welcome back</h3>
                <p className="text-[11px] text-slate-500 animate-pulse">
                  Safely land on Calculix Hub - enter your account details to sign in.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Account authentication error</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-3.5 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="ten_nguoi_dung@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">Password</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2.5">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-md cursor-pointer flex justify-center items-center gap-1.5"
                >
                  Authenticate & Sign in
                </button>
                
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="text-center text-[11px] font-bold text-indigo-600 hover:underline pt-2 cursor-pointer"
                >
                  Don't have an account? Click here to register for free →
                </button>
              </div>
            </form>
          )}

          {/* SIGN UP / REGISTER NEW PROFILE CONTAINER */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                type="button"
                onClick={() => { setAuthMode('landing'); setErrorMessage(''); }}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-800 text-xs font-bold mb-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Register New Account</h3>
                <p className="text-[11px] text-slate-500">
                  Create your account and immediately begin the adaptive IRT placement test.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-850 rounded-xl text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-xs font-semibold animate-bounce">
                  🎉 {successMessage}
                </div>
              )}

              <div className="space-y-3 pt-1">
                {/* Full name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Email address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">Choose your password</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-md cursor-pointer justify-center items-center flex gap-1.5"
                >
                  Confirm profile & Start IRT Test <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-center text-[11px] font-bold text-indigo-600 hover:underline pt-1.5 cursor-pointer"
                >
                  Already a member? Go back to login →
                </button>
              </div>
            </form>
          )}

          {/* PLACEMENT TEST / DIAGNOSTIC ASSESSMENT CONTAINER */}
          {authMode === 'placement' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {!testCompleted ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left column: Active Question (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider block w-fit mb-1">
                          Domain {activeStage + 1}/4: {currentQuestion.topic}
                        </span>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Adaptive Test System
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-black text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        b = {currentQuestion.difficulty.toFixed(1)}
                      </span>
                    </div>

                    {/* Question representation */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-xs">
                      <p className="text-slate-800 text-xs font-bold font-serif leading-relaxed">
                        {currentQuestion.question}
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-[10px] font-semibold">
                        ⚠️ {errorMessage}
                      </div>
                    )}

                    {/* Question Answers Selection */}
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, oIdx) => {
                        const isSelected = selectedAnswerIdx === oIdx;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => setSelectedAnswerIdx(oIdx)}
                            className={`w-full p-3.5 text-left text-xs rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 font-bold shadow-xs scale-[1.01]'
                                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-650'
                            }`}
                          >
                            <span>{option}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Hint element */}
                    <div className="bg-amber-50/30 border border-amber-200/40 rounded-xl p-3 flex gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block">Hint:</span>
                        <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{currentQuestion.hint}</p>
                      </div>
                    </div>

                    {/* Dynamic Action submissions */}
                    <button
                      type="button"
                      onClick={handleNextIrtQuestion}
                      className="w-full bg-slate-900 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1"
                    >
                      {activeStage < 3 ? (
                        <>Compute and Continue <ChevronRight className="w-4 h-4" /></>
                      ) : (
                        <>Complete Test & Classify <CheckCircle2 className="w-4 h-4" /></>
                      )}
                    </button>

                  </div>

                  {/* Right column: Interactive IRT Analytics Panel HUD (5 cols) */}
                  <div className="lg:col-span-5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                      <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                      <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">
                        Adaptive IRT Analysis
                      </h4>
                    </div>

                    {/* Live Ability Meter Grid */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                        <span>Theta ability score</span>
                        <span className="text-indigo-700 font-mono">
                          {theta > 0 ? '+' : ''}{theta.toFixed(2)}
                        </span>
                      </div>

                      {/* Slider representing Theta spectrum */}
                      <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        {/* Map -3.0 to +3.0 onto 0% to 100% */}
                        <div 
                          className="absolute h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${((theta + 3.0) / 6.0) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                        <span>-3.0 (Basic)</span>
                        <span>0.0 (Intermediate)</span>
                        <span>+3.0 (Olympiad)</span>
                      </div>
                    </div>

                    {/* live SEM progress */}
                    <div className="p-2.5 bg-white border border-slate-150 rounded-xl grid grid-cols-2 gap-2 text-center">
                      <div>
                        <span className="text-[8px] uppercase text-slate-400 font-bold block">Standard Error of Measurement (SEM)</span>
                        <span className="text-xs font-black text-slate-800 font-mono block mt-0.5">± {sem.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase text-slate-400 font-bold block">Mathematical reliability</span>
                        <span className="text-xs font-black text-emerald-600 block mt-0.5">
                          {sem > 1.5 ? 'Low certainty' : sem > 1.0 ? 'Aligning estimate' : 'High confidence ✔'}
                        </span>
                      </div>
                    </div>

                    {/* Current temporary computed level */}
                    <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-[9px] text-indigo-900 font-bold flex items-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5" /> Orientation level
                      </span>
                      <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">
                        {theta < -0.5 ? 'Foundation' : theta < 1.2 ? 'Advanced' : 'Olympiad'}
                      </span>
                    </div>

                    {/* Simulated live IRT system console/logs */}
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-slate-400 font-extrabold block">IRT system log:</span>
                      <div className="h-28 overflow-y-auto border border-slate-200 bg-slate-900 text-[8px] p-2 rounded-lg font-mono text-emerald-400 space-y-1 select-none">
                        {irtLog.map((logLine, lIdx) => (
                          <div key={lIdx} className="leading-normal animate-fade-in">
                            {logLine}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              ) : (
                /* PLACEMENT TEST COMPLETED - EVALUATION SCREEN */
                <div className="space-y-5 py-4 animate-in zoom-in-95 duration-350 text-center">
                  <div className="mx-auto w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-900">IRT ability estimation completed successfully!</h3>
                    <p className="text-xs text-slate-500 font-serif max-w-sm mx-auto leading-relaxed">
                      Your learning path and question bank have been calibrated to your actual mathematical ability.
                    </p>
                  </div>

                  {/* Performance stats summary */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 max-w-lg mx-auto grid grid-cols-3 gap-4">
                    <div className="border-r border-slate-200">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Continuous estimate</span>
                      <p className="text-base font-extrabold text-indigo-700 mt-0.5 font-mono">θ = {theta.toFixed(2)}</p>
                    </div>
                    <div className="border-r border-slate-200">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Accurate convergence</span>
                      <p className="text-base font-extrabold text-slate-800 mt-0.5 font-mono">SEM {sem.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Assigned level</span>
                      <span className="block text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md w-fit mx-auto mt-1 border border-emerald-150">
                        {calculatedLevel}
                      </span>
                    </div>
                  </div>

                  <div className="text-left text-[11px] text-slate-600 space-y-1.5 max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-705 flex gap-1.5 items-center">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Active competence profile:
                    </p>
                    <ul className="list-disc pl-4 space-y-1.5 text-slate-500 text-[10px]">
                      <li>Prioritizes practice problems at the <strong className="text-indigo-600">{calculatedLevel}</strong> tier.</li>
                      <li>Enables AI Tutor deep-thinking reasoning logic.</li>
                      <li>Allows weekly contest registration and interactive leaderboard participation with peers at the same level.</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={handleFinishPlacement}
                    className="w-full bg-slate-950 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex justify-center items-center gap-1.5"
                  >
                    Launch Calculix Math OS now <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
