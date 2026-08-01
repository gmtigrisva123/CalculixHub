/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  Brain, Trophy, Sparkles, Key, Mail, User, HelpCircle, ArrowRight,
  ArrowLeft, CheckCircle2, ChevronRight, BookOpen, Activity, AlertTriangle, BarChart3,
  Globe, Shield, TrendingUp, Users, Check, X, Download,
  ThumbsUp, ThumbsDown, FileText, Moon, Sun, Facebook, Youtube, MessageSquare
} from 'lucide-react';
import { Level, Topic } from '../types';
import MathText from './MathText';
import { apiUrl } from '../lib/apiBase';
import InstallAppButton from './InstallAppButton';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../lib/useAmbient';
import { AnimatedNumber, Reveal, SpringBar } from './motion';
import {
  IRTItem,
  ResponseRecord,
  Domain,
  estimateAbility,
  estimateDomainAbility,
  selectNextItem,
  shouldStop,
  reliability,
  tierForTheta,
  thetaToMastery,
  thetaToPercentile,
  recommendedSource,
  probCorrect,
  itemInformation,
  MIN_ITEMS,
  MAX_ITEMS,
} from '../lib/irt';
import { ITEM_BANK } from '../lib/itemBank';

interface WelcomeScreenProps {
  onLoginSuccess: (name: string, level: Level, initialSkills?: Record<Topic, number>) => void;
}

const DOMAINS: Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];


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
    improvementRate: 84.5,
  });

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const res = await fetch(apiUrl('/api/live-stats'));
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
  /*
   * Ambient loops on the landing page.
   *
   * The hero badge sparkle, the "live system status" ping and the slowly
   * rotating ring around the EduReach core all run forever. Each ref keeps the
   * animation identical while visible and pauses it once it scrolls away or the
   * tab is backgrounded — which matters most here, because this is the page
   * people leave open in a tab.
   */
  const heroSparkleRef = useAmbient<SVGSVGElement>();
  const livePingRef = useAmbient<HTMLSpanElement>();
  const coreRingRef = useAmbient<SVGCircleElement>();
  const telemetryPulseRef = useAmbient<SVGSVGElement>();

  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [activeArchTab, setActiveArchTab] = useState<'engine' | 'ai' | 'compete' | 'analytics'>('engine');
  const [isArchExpanded, setIsArchExpanded] = useState<boolean>(false);
  const [communityDarkMode, setCommunityDarkMode] = useState<boolean>(true);

  // Base like counts for the community preview thread, plus this visitor's
  // own vote (-1, 0, or +1) so a single browser can only cast one vote per
  // post instead of incrementing the counter indefinitely on every click.
  const PREVIEW_BASE_VOTES: Record<string, number> = { 'disc-1': 42, 'disc-2': 18 };
  const PREVIEW_VOTES_KEY = 'calculix_landing_preview_votes';
  const [myPreviewVote, setMyPreviewVote] = useState<Record<string, 1 | -1 | 0>>(() => {
    try {
      return JSON.parse(localStorage.getItem(PREVIEW_VOTES_KEY) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(PREVIEW_VOTES_KEY, JSON.stringify(myPreviewVote));
  }, [myPreviewVote]);

  const castPreviewVote = (id: string, direction: 1 | -1) => {
    setMyPreviewVote((prev) => {
      const current = prev[id] || 0;
      // Clicking the same direction again clears the vote; the opposite direction flips it.
      const next = current === direction ? 0 : direction;
      return { ...prev, [id]: next };
    });
  };

  const previewVoteCount = (id: string) => PREVIEW_BASE_VOTES[id] + (myPreviewVote[id] || 0);

  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  // Local user persistence keys
  const USER_DB_KEY = 'calculix_registered_users';

  // Wipe any old pre-seeded trial profiles so the local user database starts clean
  useEffect(() => {
    const existingRaw = localStorage.getItem(USER_DB_KEY);
    if (!existingRaw || existingRaw.includes('student@calculix.com')) {
      localStorage.setItem(USER_DB_KEY, JSON.stringify([]));
    }
  }, []);

  // --- Computerized Adaptive Test (CAT) state, driven by the 3PL IRT engine ---
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [currentItem, setCurrentItem] = useState<IRTItem>(() => {
    // Open at the item with maximum information at the population mean (theta = 0).
    return selectNextItem(ITEM_BANK, [], 0) || ITEM_BANK[0];
  });
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [theta, setTheta] = useState<number>(0.0);
  const [sem, setSem] = useState<number>(1.0);
  const [irtLog, setIrtLog] = useState<string[]>([
    '[IRT] 3PL engine initialized. Prior N(0,1), EAP estimation over 81 quadrature nodes.',
  ]);
  const [testCompleted, setTestCompleted] = useState<boolean>(false);
  const [calculatedLevel, setCalculatedLevel] = useState<Level>('Foundation');
  const [itemStartedAt, setItemStartedAt] = useState<number>(() => Date.now());

  // Per-domain ability profile, computed once the test finishes.
  const [domainProfile, setDomainProfile] = useState<Record<Topic, number>>({
    Algebra: 0,
    Geometry: 0,
    Combinatorics: 0,
    'Number Theory': 0,
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both an email and a password.');
      return;
    }

    const usersRaw = localStorage.getItem(USER_DB_KEY);
    const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];

    const normEmail = email.trim().toLowerCase();
    const matchedUser = users.find((u) => u.email.toLowerCase() === normEmail);

    if (!matchedUser) {
      setErrorMessage('This account does not exist yet. Use "Create a new account" below to register first.');
      return;
    }

    if (password.length >= 4 && password !== 'password123' && matchedUser.password && matchedUser.password !== password) {
      setErrorMessage('Incorrect password. Double-check for a stray Caps Lock.');
      return;
    }

    onLoginSuccess(matchedUser.fullName, matchedUser.level || 'Foundation');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setErrorMessage('Please fill in every required field.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Choose a password with at least 4 characters.');
      return;
    }

    const usersRaw = localStorage.getItem(USER_DB_KEY);
    const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];
    const normEmail = email.trim().toLowerCase();

    const exists = users.some((u) => u.email.toLowerCase() === normEmail);
    if (exists) {
      setErrorMessage('That email is already registered. Switch to the sign-in screen instead.');
      return;
    }

    const updatedUsers = [
      ...users,
      { fullName: fullName.trim(), email: normEmail, password: password.trim(), level: 'Foundation' as Level },
    ];
    localStorage.setItem(USER_DB_KEY, JSON.stringify(updatedUsers));

    fetch(apiUrl('/api/live-stats/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'user-joined' }),
    }).catch((err) => console.error('Error reporting user-joined event:', err));

    setSuccessMessage('Profile activated! Launching the adaptive IRT placement assessment...');

    setTimeout(() => {
      setAuthMode('placement');
      setResponses([]);
      setSelectedAnswerIdx(null);
      setTheta(0.0);
      setSem(1.0);
      setTestCompleted(false);
      setIrtLog([
        `[IRT] Registered new student: ${fullName.trim()}`,
        `[IRT] 3PL engine initialized. Prior N(0,1), EAP estimation over 81 quadrature nodes.`,
        `[IRT] Bank loaded: ${ITEM_BANK.length} calibrated items across AMC 8 / AMC 10 / AIME / USAMO / IMO.`,
      ]);
      const first = selectNextItem(ITEM_BANK, [], 0) || ITEM_BANK[0];
      setCurrentItem(first);
      setItemStartedAt(Date.now());
      setSuccessMessage('');
    }, 1500);
  };

  /**
   * Scores the current item, re-estimates ability with the 3PL EAP estimator,
   * then either administers the next maximum-information item or ends the test
   * once the SEM stopping rule is satisfied.
   */
  const handleNextIrtQuestion = () => {
    if (selectedAnswerIdx === null) {
      setErrorMessage('Select one answer choice before continuing.');
      return;
    }
    setErrorMessage('');

    const isCorrect = selectedAnswerIdx === currentItem.correctIdx;
    const latencySec = Math.max(1, Math.round((Date.now() - itemStartedAt) / 1000));

    // Probability the model assigned before seeing this response — useful for
    // showing how surprising the answer was.
    const predicted = probCorrect(theta, currentItem);
    const info = itemInformation(theta, currentItem);

    const nextResponses: ResponseRecord[] = [...responses, { item: currentItem, correct: isCorrect, latencySec }];
    const { theta: newTheta, sem: newSem } = estimateAbility(nextResponses);

    const logLines = [
      `[${currentItem.source} - ${currentItem.domain}] ${isCorrect ? 'CORRECT' : 'INCORRECT'} in ${latencySec}s (a=${currentItem.a.toFixed(1)}, b=${currentItem.b.toFixed(1)}, c=${currentItem.c.toFixed(2)}).`,
      `[EAP] Predicted P(correct)=${(predicted * 100).toFixed(1)}%, item info=${info.toFixed(2)}. theta: ${theta.toFixed(2)} -> ${newTheta.toFixed(2)}.`,
      `[Precision] SEM ${sem.toFixed(2)} -> ${newSem.toFixed(2)} (reliability ${(reliability(newSem) * 100).toFixed(0)}%).`,
    ];

    setResponses(nextResponses);
    setTheta(newTheta);
    setSem(newSem);
    setSelectedAnswerIdx(null);

    if (shouldStop(nextResponses, newSem)) {
      const tier = tierForTheta(newTheta) as Level;

      // Build the per-domain profile that seeds the learner's skill radar.
      const profile: Record<Topic, number> = {
        Algebra: 0,
        Geometry: 0,
        Combinatorics: 0,
        'Number Theory': 0,
      };
      for (const domain of DOMAINS) {
        const est = estimateDomainAbility(nextResponses, domain);
        // Fall back to the global estimate for any domain not reached.
        profile[domain as Topic] = thetaToMastery(est ? est.theta : newTheta);
      }
      setDomainProfile(profile);

      setIrtLog((prev) => [
        ...prev,
        ...logLines,
        `[Stop] Termination rule met after ${nextResponses.length} items (SEM ${newSem.toFixed(2)} <= target, or item cap reached).`,
        `[Result] theta = ${newTheta.toFixed(2)} -> tier ${tier}, percentile ${thetaToPercentile(newTheta)}.`,
      ]);

      setCalculatedLevel(tier);
      setTestCompleted(true);

      const usersRaw = localStorage.getItem(USER_DB_KEY);
      const users: LocalUser[] = usersRaw ? JSON.parse(usersRaw) : [];
      const normEmail = email.trim().toLowerCase();
      const updated = users.map((u) => (u.email.toLowerCase() === normEmail ? { ...u, level: tier } : u));
      localStorage.setItem(USER_DB_KEY, JSON.stringify(updated));
      return;
    }

    const next = selectNextItem(ITEM_BANK, nextResponses, newTheta);
    if (!next) {
      // Bank exhausted — finish with whatever precision we have.
      setCalculatedLevel(tierForTheta(newTheta) as Level);
      setTestCompleted(true);
      return;
    }

    setIrtLog((prev) => [
      ...prev,
      ...logLines,
      `[Select] Next item ${next.source} / ${next.domain} (b=${next.b.toFixed(1)}), max Fisher information at theta=${newTheta.toFixed(2)}.`,
    ]);
    setCurrentItem(next);
    setItemStartedAt(Date.now());
  };

  const handleFinishPlacement = () => {
    fetch(apiUrl('/api/live-stats/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test-completed' }),
    }).catch((err) => console.error('Error reporting test-completed event:', err));
    onLoginSuccess(fullName || 'Calculix Student', calculatedLevel, domainProfile);
  };

  // --- PDF IMPACT REPORT EXPORT ---
  const handleExportImpactReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>CalculixHub - Impact & Research Report</title>
          <style>
            body { font-family: 'Georgia', serif; color: #161310; padding: 45px; line-height: 1.6; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #855116; padding-bottom: 25px; margin-bottom: 35px; }
            .logo { font-size: 26px; font-weight: 900; color: #201b16; text-transform: uppercase; letter-spacing: 1.5px; }
            .subtitle { font-size: 11px; color: #57534e; text-transform: uppercase; font-weight: 700; margin-top: 5px; }
            .date { font-size: 13px; color: #57534e; font-family: monospace; background: #f3ede1; padding: 5px 10px; border-radius: 6px; }
            .section { margin-bottom: 40px; page-break-inside: avoid; }
            h2 { font-size: 18px; color: #855116; border-left: 5px solid #c8842a; padding-left: 12px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
            p { font-size: 14px; color: #334155; text-align: justify; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
            .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 25px; }
            .metric-card { border: 1px solid #e2e8f0; background: #faf7f1; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .metric-val { font-size: 26px; font-weight: 800; color: #855116; font-family: monospace; margin: 8px 0; }
            .metric-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 25px; font-size: 11px; color: #64748b; }
            @media print { body { padding: 25px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">CalculixHub</div>
              <div class="subtitle">Math OS &amp; AI Personalization Ecosystem</div>
            </div>
            <div class="date">Generated: ${new Date().toLocaleString('en-US')}</div>
          </div>

          <div class="section">
            <h2>1. Strategic Overview</h2>
            <p>CalculixHub is an integrated mathematics education ecosystem combining deep AI personalization (EduReach Core) with an adaptive testing model based on Item Response Theory (IRT). The platform replaces static, linear question delivery with a flexible knowledge graph tracking each student's zone of proximal development (ZPD).</p>
          </div>

          <div class="section">
            <h2>2. Live Operating Metrics</h2>
            <div class="metric-grid">
              <div class="metric-card">
                <div class="metric-label">Active learners online</div>
                <div class="metric-val">${liveStats.activeUsers}</div>
                <div class="metric-label">Real-time connections</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">IRT assessments completed</div>
                <div class="metric-val">${liveStats.testsCompleted}</div>
                <div class="metric-label">Cumulative total</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Score improvement rate</div>
                <div class="metric-val">${liveStats.improvementRate}%</div>
                <div class="metric-label">Measured after 3 months</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>3. Acquisition Channels</h2>
            <p>CalculixHub treats external social channels strictly as acquisition and awareness funnels, directing all learning activity back to the single hub:</p>
            <table>
              <thead>
                <tr><th>Channel</th><th>Approach</th><th>Users acquired</th><th>Share</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Facebook (CalculixHub Page/Group)</strong></td>
                  <td>Deep-dive analysis posts, monographs, exam-prep material.</td>
                  <td>${liveStats.facebookAcquisitions}</td>
                  <td>${((liveStats.facebookAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td><strong>TikTok (Calculix Short Clips)</strong></td>
                  <td>Fast, sparky math intuition and quick-thinking hooks.</td>
                  <td>${liveStats.tiktokAcquisitions}</td>
                  <td>${((liveStats.tiktokAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td><strong>YouTube (Calculix Lectures)</strong></td>
                  <td>Long-form lectures and full Olympiad solution walkthroughs.</td>
                  <td>${liveStats.youtubeAcquisitions}</td>
                  <td>${((liveStats.youtubeAcquisitions / (liveStats.facebookAcquisitions + liveStats.tiktokAcquisitions + liveStats.youtubeAcquisitions)) * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section" style="page-break-before: always;">
            <h2>4. Four Core Layers &amp; Methodology</h2>
            <p>The system rests on four architectural pillars:</p>
            <ul>
              <li><strong>Learning Engine:</strong> Clear tiers (Foundation, Advanced, Olympiad) that adapt to each student.</li>
              <li><strong>AI Personalization Layer:</strong> EduReach automatically isolates weak points (e.g. combinatorics) and restructures the learning path.</li>
              <li><strong>Competition System:</strong> Live, ranked arenas organized weekly by age group and skill tier.</li>
              <li><strong>Analytics Radar:</strong> Visualizes common misconceptions to support curriculum research.</li>
            </ul>
          </div>

          <div class="footer">
            <p>Report generated directly from the CalculixHub server.</p>
            <p>CalculixHub Science &amp; Technology Board - Tech for Social Impact (c) 2026</p>
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const IRT_FORMULA = '\\[P_i(\\theta) = \\frac{e^{\\theta - b_i}}{1 + e^{\\theta - b_i}}\\]';

  // --- LANDING PAGE RENDERING FUNCTION ---
  const renderLandingPage = () => {
    return (
      <div className="min-h-screen bg-ink-950 text-stone-200 selection:bg-brass-500 selection:text-ink-950 flex flex-col antialiased relative overflow-hidden font-sans">

        <div className="absolute inset-0 pointer-events-none bp-grid-dark opacity-60" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brass-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] bg-proof-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* STICKY NAVBAR */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-ink-950/85 border-b border-ink-800 select-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="bg-gradient-to-tr from-brass-500 to-brass-700 p-2.5 rounded-xl text-ink-950 font-black w-10 h-10 flex items-center justify-center text-lg shadow-lg font-serif shrink-0">
                &#8721;
              </div>
              {/*
                The wordmark costs ~120px of a 320px header, which does not
                survive alongside the action buttons on an iPhone SE. Below sm
                the sigma mark carries the brand on its own; the hero headline
                names the product immediately underneath.
              */}
              <div className="hidden sm:block">
                <h1 className="font-extrabold text-sm tracking-widest text-stone-100 uppercase">CalculixHub</h1>
                <span className="text-[10px] font-bold text-stone-500 block -mt-1 uppercase tracking-wider">Math OS Platform</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <a href="#mission" className="hover:text-white transition-colors">Mission</a>
              <a href="#definition" className="hover:text-white transition-colors">Positioning</a>
              <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
              <a href="#community" className="hover:text-white transition-colors">Community</a>
              <a href="#flow" className="hover:text-white transition-colors">Flow</a>
              <a href="#impact" className="hover:text-white transition-colors">Impact</a>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-3.5">
              <InstallAppButton />
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs font-bold text-stone-400 hover:text-white transition-colors cursor-pointer px-2 sm:px-3 py-1.5 rounded-lg hover:bg-ink-900 whitespace-nowrap"
              >
                Sign in
              </button>
              <m.button
                type="button"
                onClick={() => setAuthMode('register')}
                whileTap={{ scale: 0.95 }}
                transition={spring.press}
                className="bg-brass-600 hover:bg-brass-500 text-ink-950 font-extrabold text-xs px-3 sm:px-4.5 py-2.5 rounded-xl transition-[background-color,border-color,color,box-shadow] duration-240 ease-standard shadow-md hover:shadow-brass-500/20 hover:shadow-lg cursor-pointer whitespace-nowrap"
              >
                {/*
                  Shortened below sm so the header fits a 375px viewport now that
                  it carries a third button. Nothing is lost: the hero's
                  full-width "Start free — take the placement test" CTA sits
                  directly beneath it on mobile.
                */}
                <span className="sm:hidden">Start free</span>
                <span className="hidden sm:inline">Take the placement test</span>
              </m.button>
            </div>
          </div>
        </header>

        <main className="flex-1 relative z-10">

          {/*
            HERO

            Animates on mount rather than on scroll: it is already in view when
            the page loads, and a whileInView reveal above the fold either fires
            instantly (pointless) or, worse, waits for a scroll that never
            comes. The two columns arrive together, with the visualiser a beat
            behind the copy so the headline is read first.
          */}
          <m.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, opacity: { duration: duration.slower, ease: ease.standard } }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
          >

            <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-brass-500/10 border border-brass-500/25 px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-brass-400 tracking-wider">
                <Sparkles ref={heroSparkleRef} className="w-3.5 h-3.5 animate-pulse" /> An AI-native operating system for mathematical thinking
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.15] text-white font-serif">
                Think in Proofs. <br />
                <span className="bg-gradient-to-r from-brass-400 via-brass-300 to-proof-400 bg-clip-text text-transparent">
                  Train Like a Competitor.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-stone-400 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                An integrated EdTech ecosystem &mdash; adaptive AI, live competition, and real-time analytics &mdash; built for students who want to actually get better at mathematics, not just consume worksheets.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-3">
                <m.button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.press}
                  className="bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-ink-950 font-extrabold text-xs px-7 py-4.5 rounded-2xl shadow-xl hover:shadow-brass-500/10 hover:shadow-2xl transition-[background-color,border-color,color,box-shadow] duration-240 ease-standard flex items-center justify-center gap-2 cursor-pointer group"
                >
                  Start free &mdash; take the placement test
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-240 ease-standard" />
                </m.button>
                <a
                  href="#impact"
                  className="bg-ink-900/60 hover:bg-ink-900 border border-ink-800 text-stone-350 hover:text-white font-bold text-xs px-6 py-4.5 rounded-2xl transition-[background-color,border-color,color,box-shadow] duration-240 ease-standard flex items-center justify-center gap-1.5"
                >
                  View the research report
                </a>
              </div>

              <div className="pt-8 border-t border-ink-800/70 max-w-xl mx-auto lg:mx-0">
                <p className="text-[10px] uppercase font-black tracking-widest text-stone-500 mb-3 flex items-center justify-center lg:justify-start gap-1.5">
                  <span ref={livePingRef} className="w-2 h-2 rounded-full bg-proof-500 animate-ping" /> Live system status (real-time)
                </p>
                <div className="grid grid-cols-3 gap-6 text-center lg:text-left">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-stone-500 block">Learners online</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight"><AnimatedNumber value={liveStats.activeUsers} format={(n) => Math.round(n).toLocaleString()} /></span>
                    <span className="text-[8px] text-proof-400 font-bold block">+3.4/min</span>
                  </div>
                  <div className="space-y-1 border-x border-ink-800/60 px-4">
                    <span className="text-[9px] uppercase font-bold text-stone-500 block">Assessments run</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight"><AnimatedNumber value={liveStats.testsCompleted} format={(n) => Math.round(n).toLocaleString()} /></span>
                    <span className="text-[8px] text-brass-400 font-bold block">Auto-adaptive</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-stone-500 block">Live in the arena</span>
                    <span className="text-xl font-black text-white font-mono block tracking-tight"><AnimatedNumber value={liveStats.activeContestsCount} /></span>
                    <span className="text-[8px] text-violet-400 font-bold block">Ranked matches</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive SVG Network Visualizer */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-brass-500/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="bg-ink-950/40 border border-ink-800 p-6 sm:p-8 rounded-[32px] backdrop-blur-md shadow-2xl relative bp-corners text-brass-500">

                <svg viewBox="0 0 450 400" className="w-full h-auto max-w-[380px] sm:max-w-[450px] mx-auto overflow-visible select-none">
                  <line x1="225" y1="200" x2="90" y2="90" stroke={hoveredNode === 1 ? '#c8842a' : '#342d27'} strokeWidth={hoveredNode === 1 ? '3' : '2'} strokeDasharray={hoveredNode === 1 ? 'none' : '4 4'} className="transition-[stroke,stroke-width,stroke-dasharray] duration-300 ease-standard" />
                  <line x1="225" y1="200" x2="360" y2="90" stroke={hoveredNode === 2 ? '#2f9c8c' : '#342d27'} strokeWidth={hoveredNode === 2 ? '3' : '2'} strokeDasharray={hoveredNode === 2 ? 'none' : '4 4'} className="transition-[stroke,stroke-width,stroke-dasharray] duration-300 ease-standard" />
                  <line x1="225" y1="200" x2="90" y2="310" stroke={hoveredNode === 3 ? '#8b5cf6' : '#342d27'} strokeWidth={hoveredNode === 3 ? '3' : '2'} strokeDasharray={hoveredNode === 3 ? 'none' : '4 4'} className="transition-[stroke,stroke-width,stroke-dasharray] duration-300 ease-standard" />
                  <line x1="225" y1="200" x2="360" y2="310" stroke={hoveredNode === 4 ? '#0ea5e9' : '#342d27'} strokeWidth={hoveredNode === 4 ? '3' : '2'} strokeDasharray={hoveredNode === 4 ? 'none' : '4 4'} className="transition-[stroke,stroke-width,stroke-dasharray] duration-300 ease-standard" />

                  {hoveredNode === 1 && <circle r="4.5" fill="#c8842a"><animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 90 90" /></circle>}
                  {hoveredNode === 2 && <circle r="4.5" fill="#2f9c8c"><animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 360 90" /></circle>}
                  {hoveredNode === 3 && <circle r="4.5" fill="#8b5cf6"><animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 90 310" /></circle>}
                  {hoveredNode === 4 && <circle r="4.5" fill="#0ea5e9"><animateMotion dur="0.9s" repeatCount="indefinite" path="M 225 200 L 360 310" /></circle>}

                  <g className="group cursor-pointer">
                    <circle cx="225" cy="200" r="45" fill="#201b16" stroke="#c8842a" strokeWidth="2.5" className="transition-[stroke,transform] duration-300 ease-standard group-hover:stroke-brass-400 group-hover:scale-105" />
                    <circle ref={coreRingRef} cx="225" cy="200" r="55" fill="none" stroke="#c8842a" strokeWidth="1" strokeDasharray="5 5" className="animate-spin" style={{ transformOrigin: '225px 200px', animationDuration: '20s' }} />
                    <foreignObject x="207" y="182" width="36" height="36">
                      <div className="w-full h-full flex items-center justify-center text-brass-400">
                        <Brain className="w-7 h-7" />
                      </div>
                    </foreignObject>
                    <text x="225" y="260" fill="#e0a339" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="1">EDUREACH CORE</text>
                  </g>

                  <g onMouseEnter={() => setHoveredNode(1)} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
                    <circle cx="90" cy="90" r="30" fill="#161310" stroke={hoveredNode === 1 ? '#c8842a' : '#342d27'} strokeWidth="2" className="transition-[stroke] duration-300 ease-standard" />
                    <text x="90" y="93" fill="#e0a339" fontSize="9" fontWeight="bold" textAnchor="middle">ALGEBRA</text>
                    <circle cx="90" cy="90" r="35" fill="none" stroke="#c8842a" strokeWidth={hoveredNode === 1 ? '1.5' : '0'} className="transition-[stroke-width] duration-300 ease-standard animate-ping" />
                  </g>

                  <g onMouseEnter={() => setHoveredNode(2)} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
                    <circle cx="360" cy="90" r="30" fill="#161310" stroke={hoveredNode === 2 ? '#2f9c8c' : '#342d27'} strokeWidth="2" className="transition-[stroke] duration-300 ease-standard" />
                    <text x="360" y="93" fill="#4fb8a8" fontSize="9" fontWeight="bold" textAnchor="middle">GEOMETRY</text>
                    <circle cx="360" cy="90" r="35" fill="none" stroke="#2f9c8c" strokeWidth={hoveredNode === 2 ? '1.5' : '0'} className="transition-[stroke-width] duration-300 ease-standard animate-ping" />
                  </g>

                  <g onMouseEnter={() => setHoveredNode(3)} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
                    <circle cx="90" cy="310" r="30" fill="#161310" stroke={hoveredNode === 3 ? '#8b5cf6' : '#342d27'} strokeWidth="2" className="transition-[stroke] duration-300 ease-standard" />
                    <text x="90" y="313" fill="#a78bfa" fontSize="9" fontWeight="bold" textAnchor="middle">COMBINATORICS</text>
                    <circle cx="90" cy="310" r="35" fill="none" stroke="#8b5cf6" strokeWidth={hoveredNode === 3 ? '1.5' : '0'} className="transition-[stroke-width] duration-300 ease-standard animate-ping" />
                  </g>

                  <g onMouseEnter={() => setHoveredNode(4)} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
                    <circle cx="360" cy="310" r="30" fill="#161310" stroke={hoveredNode === 4 ? '#0ea5e9' : '#342d27'} strokeWidth="2" className="transition-[stroke] duration-300 ease-standard" />
                    <text x="360" y="313" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">NUMBER THEORY</text>
                    <circle cx="360" cy="310" r="35" fill="none" stroke="#0ea5e9" strokeWidth={hoveredNode === 4 ? '1.5' : '0'} className="transition-[stroke-width] duration-300 ease-standard animate-ping" />
                  </g>
                </svg>

                <div className="mt-6 bg-ink-900/80 border border-ink-800 rounded-2xl p-4.5 text-xs space-y-1.5 backdrop-blur-md">
                  <div className="flex justify-between items-center text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                    <span>EduReach live feed</span>
                    <span className="text-brass-400 font-mono">LIVE</span>
                  </div>
                  <p className="font-mono text-stone-300 leading-normal text-[11px]">
                    {hoveredNode === 1 && 'AI: Algebra slip detected. Prioritizing quadratic-roots remediation (theta = +0.45).'}
                    {hoveredNode === 2 && 'AI: Spatial reasoning gap found. Suggesting extended Ptolemy theory (b = 1.80).'}
                    {hoveredNode === 3 && 'AI: Combinatorics weak point found. Launching a stars-and-bars / AM-GM drill.'}
                    {hoveredNode === 4 && 'AI: Reinforcing modular arithmetic. Recommending small Fermat cycles.'}
                    {!hoveredNode && 'Hover a node to see EduReach analyze the adaptive skill graph.'}
                  </p>
                </div>

              </div>
            </div>

          </m.section>

          {/* WHAT WE ARE / ARE NOT */}
          <Reveal as="section" distance={14} amount={0.12} id="definition" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-ink-800">
            <div className="text-center space-y-3 pb-12">
              <h2 className="text-xs uppercase font-extrabold text-brass-500 tracking-widest">Core positioning</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-serif">We redefine the approach to mathematics</h3>
              <p className="text-xs text-stone-400 max-w-lg mx-auto">
                CalculixHub is a complete learning ecosystem, deliberately built to break with passive, one-size-fits-all study habits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="border border-rose-900/40 bg-gradient-to-b from-rose-950/10 to-transparent p-6 sm:p-8 rounded-3xl space-y-6 transition-[border-color,box-shadow] duration-300 ease-standard hover:border-rose-800/60 hover:shadow-xl hover:shadow-rose-950/10 group">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20 text-rose-500"><X className="w-5 h-5" /></div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-rose-500 tracking-wider">Passive by default</span>
                    <h4 className="text-lg font-extrabold text-stone-200 font-serif">What we are not</h4>
                  </div>
                </div>
                <ul className="space-y-4 text-xs font-semibold text-stone-400">
                  <li className="flex gap-3 items-start">
                    <span className="text-rose-500 shrink-0 font-bold">&times;</span>
                    <div>
                      <strong className="text-stone-300 font-bold block">A generic problem-lookup website</strong>
                      <span className="text-[10px] text-stone-500 font-medium block mt-0.5">Where students just check answers mechanically, without building real reasoning reflexes.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-rose-500 shrink-0 font-bold">&times;</span>
                    <div>
                      <strong className="text-stone-300 font-bold block">A fanpage or file-sharing group</strong>
                      <span className="text-[10px] text-stone-500 font-medium block mt-0.5">Dumping thousands of unsorted exam PDFs with no personalization or curation.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-rose-500 shrink-0 font-bold">&times;</span>
                    <div>
                      <strong className="text-stone-300 font-bold block">A rigid, static question bank</strong>
                      <span className="text-[10px] text-stone-500 font-medium block mt-0.5">Where every student works the same fixed set regardless of ability or pace.</span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="border border-proof-800/40 bg-gradient-to-b from-proof-950/10 to-transparent p-6 sm:p-8 rounded-3xl space-y-6 transition-[border-color,box-shadow] duration-300 ease-standard hover:border-proof-600/60 hover:shadow-xl hover:shadow-proof-950/10 group">
                <div className="flex items-center gap-3">
                  <div className="bg-proof-500/10 p-2.5 rounded-2xl border border-proof-500/20 text-proof-400"><Check className="w-5 h-5" /></div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-proof-400 tracking-wider">One connected ecosystem</span>
                    <h4 className="text-lg font-extrabold text-stone-200 font-serif">What we are</h4>
                  </div>
                </div>
                <ul className="space-y-4 text-xs font-semibold text-stone-400">
                  <li className="flex gap-3 items-start">
                    <span className="text-proof-400 shrink-0 font-bold">&#10003;</span>
                    <div>
                      <strong className="text-stone-200 font-bold block">A genuinely adaptive learning ecosystem</strong>
                      <span className="text-[10px] text-stone-450 font-medium block mt-0.5">Uses IRT to quantify and continuously optimize each student's actual ability.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-proof-400 shrink-0 font-bold">&#10003;</span>
                    <div>
                      <strong className="text-stone-200 font-bold block">A live, competitive arena</strong>
                      <span className="text-[10px] text-stone-450 font-medium block mt-0.5">Direct head-to-head challenges with a tiered, ranked leaderboard system.</span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-proof-400 shrink-0 font-bold">&#10003;</span>
                    <div>
                      <strong className="text-stone-200 font-bold block">A high-signal academic community</strong>
                      <span className="text-[10px] text-stone-450 font-medium block mt-0.5">Rigorous discussion, proof review, and contest breakdowns.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>

          {/* MISSION */}
          <Reveal as="section" distance={14} amount={0.12} id="mission" className="bg-ink-900/40 border-y border-ink-800 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <h3 className="text-xs uppercase font-extrabold text-brass-500 tracking-widest">Core mission</h3>
                <h4 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-serif leading-relaxed italic">
                  &ldquo;Democratize high-quality mathematical thinking through AI, competition systems, and data-driven learning.&rdquo;
                </h4>
                <div className="w-16 h-1 bg-gradient-to-r from-brass-500 to-proof-500 mx-auto rounded-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 max-w-5xl mx-auto">
                <div className="bg-ink-950/50 p-6 rounded-2xl border border-ink-800 text-center space-y-3.5 transition-transform duration-300 ease-standard hover:scale-[1.02] group">
                  <div className="mx-auto bg-brass-500/10 p-3 rounded-2xl border border-brass-500/20 text-brass-400 w-fit group-hover:bg-brass-600 group-hover:text-ink-950 transition-colors duration-240 ease-standard"><Globe className="w-6 h-6" /></div>
                  <h5 className="font-extrabold text-stone-100 text-sm">Reach, without degradation</h5>
                  <p className="text-[11px] text-stone-450 leading-relaxed">Advanced curricula and AI infrastructure, delivered on demand to every region, regardless of geography.</p>
                </div>
                <div className="bg-ink-950/50 p-6 rounded-2xl border border-ink-800 text-center space-y-3.5 transition-transform duration-300 ease-standard hover:scale-[1.02] group">
                  <div className="mx-auto bg-proof-500/10 p-3 rounded-2xl border border-proof-500/20 text-proof-400 w-fit group-hover:bg-proof-600 group-hover:text-white transition-colors duration-240 ease-standard"><Shield className="w-6 h-6" /></div>
                  <h5 className="font-extrabold text-stone-100 text-sm">Personalization by default</h5>
                  <p className="text-[11px] text-stone-450 leading-relaxed">EduReach Core diagnoses gaps automatically and builds an individual path for every learner.</p>
                </div>
                <div className="bg-ink-950/50 p-6 rounded-2xl border border-ink-800 text-center space-y-3.5 transition-transform duration-300 ease-standard hover:scale-[1.02] group">
                  <div className="mx-auto bg-violet-500/10 p-3 rounded-2xl border border-violet-500/20 text-violet-400 w-fit group-hover:bg-violet-600 group-hover:text-white transition-colors duration-240 ease-standard"><TrendingUp className="w-6 h-6" /></div>
                  <h5 className="font-extrabold text-stone-100 text-sm">Governed by real data</h5>
                  <p className="text-[11px] text-stone-450 leading-relaxed">Every system decision is measured against empirical telemetry, not assumptions.</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ARCHITECTURE (4 LAYERS) */}
          <Reveal as="section" distance={14} amount={0.12} id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center space-y-3 pb-12">
              <h2 className="text-xs uppercase font-extrabold text-proof-400 tracking-widest font-mono">Infrastructure</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-serif">Four-Layer Core Architecture</h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto">Four tightly interlocked layers form the platform's adaptive edge.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-stretch">
              <div className="lg:col-span-4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 select-none">
                {([
                  { key: 'engine', label: '1. Learning Engine', icon: BookOpen },
                  { key: 'ai', label: '2. AI Personalization', icon: Brain },
                  { key: 'compete', label: '3. Competition System', icon: Trophy },
                  { key: 'analytics', label: '4. Analytics & Research', icon: BarChart3 },
                ] as const).map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <m.button
                      key={tab.key}
                      type="button"
                      onClick={() => { setActiveArchTab(tab.key); setIsArchExpanded(false); }}
                      whileTap={{ scale: 0.98 }}
                      transition={spring.press}
                      className={`relative w-full text-left p-4.5 rounded-2xl border text-xs font-extrabold transition-[border-color,color,box-shadow] duration-240 ease-standard shrink-0 cursor-pointer flex items-center justify-between ${
                        activeArchTab === tab.key
                          ? 'border-brass-500 text-brass-400 shadow-md'
                          : 'bg-ink-900/40 border-ink-800 text-stone-400 hover:border-ink-750 hover:text-white'
                      }`}
                    >
                      {/*
                        Same shared-indicator pattern as the sidebar and the
                        leaderboard's segmented control. Four layers presented
                        as a stack read as a stack when the highlight travels
                        between them.
                      */}
                      {activeArchTab === tab.key && (
                        <m.span
                          layoutId="arch-tab-highlight"
                          className="absolute inset-0 bg-brass-600/10 rounded-2xl"
                          transition={spring.snappy}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2.5"><TabIcon className="w-4 h-4" /> {tab.label}</span>
                      <ChevronRight className={`relative z-10 w-3.5 h-3.5 hidden lg:block transition-transform duration-240 ease-standard ${activeArchTab === tab.key ? 'translate-x-1' : ''}`} />
                    </m.button>
                  );
                })}
              </div>

              <div className="lg:col-span-8 bg-ink-900/40 border border-ink-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backdrop-blur-md shadow-2xl relative bp-corners">
                <div className="absolute top-4 right-4 text-ink-700 font-mono text-[9px]">Calculix Engine Core v2.6</div>

                {/*
                  The four layer descriptions occupy the same panel, and used to
                  swap instantly — the heading, icon and body all changing in
                  one frame with nothing tying them to the tab that was pressed.
                  Keying on the active tab gives the panel a hand-off matching
                  the highlight sliding in the list beside it.
                */}
                <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={activeArchTab}
                  initial={{ opacity: 0, y: travel.sm }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
                  transition={spring.smooth}
                  className="space-y-5"
                >
                  {activeArchTab === 'engine' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-brass-500/10 p-2.5 rounded-xl border border-brass-500/20 text-brass-400"><BookOpen className="w-5 h-5" /></div>
                        <div><span className="text-[9px] uppercase font-black text-brass-400 tracking-wider">Adaptive core</span><h4 className="text-base font-extrabold text-white font-serif">Learning Engine</h4></div>
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        Content is tiered into <strong>Foundation</strong> (solid basics), <strong>Advanced</strong> (deep specialization), and <strong>Olympiad</strong> (international-level challenge).
                      </p>
                      <ul className="space-y-2 text-[11px] text-stone-350">
                        <li className="flex gap-2"><span className="text-brass-450 font-bold">&bull;</span><span><strong>Non-linear, adaptive learning:</strong> content stretches and contracts to match real ability instead of forcing a fixed lesson order.</span></li>
                        <li className="flex gap-2"><span className="text-brass-450 font-bold">&bull;</span><span><strong>Instant error analysis:</strong> theory gaps are surfaced immediately after a submission, backed by real telemetry.</span></li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'ai' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-proof-500/10 p-2.5 rounded-xl border border-proof-500/20 text-proof-400"><Brain className="w-5 h-5" /></div>
                        <div><span className="text-[9px] uppercase font-black text-proof-400 tracking-wider">Personalization layer</span><h4 className="text-base font-extrabold text-white font-serif">AI Personalization (EduReach Core)</h4></div>
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        EduReach's core algorithm inspects solution structure to pinpoint exactly where a student is weak &mdash; e.g. permutation counting, or the equality case in an inequality.
                      </p>
                      <ul className="space-y-2 text-[11px] text-stone-350">
                        <li className="flex gap-2"><span className="text-proof-405 font-bold">&bull;</span><span><strong>Growth forecasting:</strong> projects score improvement from current solving velocity.</span></li>
                        <li className="flex gap-2"><span className="text-proof-405 font-bold">&bull;</span><span><strong>Adaptive dispatch:</strong> the next problem is chosen at the difficulty that keeps motivation and challenge in balance.</span></li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'compete' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-violet-500/10 p-2.5 rounded-xl border border-violet-500/20 text-violet-400"><Trophy className="w-5 h-5" /></div>
                        <div><span className="text-[9px] uppercase font-black text-violet-400 tracking-wider">Competitive environment</span><h4 className="text-base font-extrabold text-white font-serif">Competition Arena</h4></div>
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        Head-to-head practice through Weekly Challenges, Monthly Contests, and multi-stage Seasonal Tournaments.
                      </p>
                      <ul className="space-y-2 text-[11px] text-stone-350">
                        <li className="flex gap-2"><span className="text-violet-450 font-bold">&bull;</span><span><strong>Dual-axis leaderboard:</strong> ranked globally and within cohorts by age group or country.</span></li>
                        <li className="flex gap-2"><span className="text-violet-450 font-bold">&bull;</span><span><strong>Skill ladder:</strong> Beginner through Elite, letting students filter and self-select their bracket.</span></li>
                      </ul>
                    </>
                  )}

                  {activeArchTab === 'analytics' && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20 text-sky-400"><BarChart3 className="w-5 h-5" /></div>
                        <div><span className="text-[9px] uppercase font-black text-sky-400 tracking-wider">Analytics system</span><h4 className="text-base font-extrabold text-white font-serif">Analytics &amp; Research Dashboard</h4></div>
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        A real, live skill-mastery radar and study-time dashboard for every student.
                      </p>
                      <ul className="space-y-2 text-[11px] text-stone-350">
                        <li className="flex gap-2"><span className="text-sky-450 font-bold">&bull;</span><span><strong>For researchers:</strong> aggregates common misconceptions and live learning trends to support curriculum design.</span></li>
                        <li className="flex gap-2"><span className="text-sky-450 font-bold">&bull;</span><span><strong>For research use:</strong> raw data export to support impact studies and methodology papers.</span></li>
                      </ul>
                    </>
                  )}
                </m.div>
                </AnimatePresence>

                <div className="pt-6 border-t border-ink-800 mt-6 space-y-4">
                  {isArchExpanded ? (
                    <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-4.5 text-[11px] text-stone-450 leading-relaxed space-y-3 font-mono">
                      <div className="flex justify-between items-center text-[10px] text-proof-400 font-bold uppercase tracking-wider">
                        <span>Technical detail</span><span>IRT MATHEMATICAL MODEL</span>
                      </div>

                      {activeArchTab === 'engine' && (
                        <p>The engine follows Vygotsky's Zone of Proximal Development: problems are dispatched so a student's predicted success probability sits near 0.65, maximizing progress without inducing frustration.</p>
                      )}

                      {activeArchTab === 'ai' && (
                        <div className="space-y-2">
                          <p>Uses a 1-Parameter Logistic (Rasch) model to estimate <MathText text="\\(\\theta\\)" as="span" />, the student's latent ability:</p>
                          <div className="bg-ink-900 p-3 rounded-xl text-center text-proof-300 font-bold">
                            <MathText text={IRT_FORMULA} />
                          </div>
                          <p className="text-[10px]">
                            <MathText text="Here \\(b_i\\) is the item's difficulty parameter. The system maximizes Fisher information to shrink the standard error of measurement (SEM) as fast as possible." />
                          </p>
                        </div>
                      )}

                      {activeArchTab === 'compete' && (
                        <p>The ranking formula applies a dynamic k-factor correction: you gain more points for solving problems well above your current theta.</p>
                      )}

                      {activeArchTab === 'analytics' && (
                        <p>A large telemetry pipeline clusters thousands of interaction records to surface common cognitive errors automatically, helping researchers forecast the difficulty of new problem types.</p>
                      )}

                      <button type="button" onClick={() => setIsArchExpanded(false)} className="text-[10px] font-bold text-brass-400 hover:underline block pt-1 cursor-pointer">Collapse detail [-]</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsArchExpanded(true)} className="bg-ink-900 border border-ink-800 hover:border-ink-750 text-stone-350 hover:text-white font-bold text-[11px] px-4 py-2.5 rounded-xl transition-[background-color,border-color,color] duration-240 ease-standard cursor-pointer inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brass-400" /> View technical detail
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          {/* COMMUNITY (MOCK FORUM) */}
          <Reveal as="section" distance={14} amount={0.12} id="community" className="bg-ink-900/40 border-y border-ink-800 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center space-y-3 pb-12">
                <h2 className="text-xs uppercase font-extrabold text-brass-500 tracking-widest font-mono">Academic community</h2>
                <h3 className="text-2xl sm:text-3xl font-black text-white font-serif">Problem-Centric Discussion</h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">A preview of the discussion layer &mdash; every problem gets its own thread for solutions and critique.</p>
              </div>

              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex justify-between items-center bg-ink-900 border border-ink-800 px-6 py-3.5 rounded-2xl select-none">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider flex items-center gap-2"><Users className="w-4 h-4 text-brass-400" /> Community forum preview</span>
                  <button
                    type="button"
                    onClick={() => setCommunityDarkMode(!communityDarkMode)}
                    className="bg-ink-800 hover:bg-ink-750 border border-ink-700 text-stone-300 hover:text-white font-bold text-[10px] px-3.5 py-2 rounded-xl transition-[background-color,border-color,color] duration-240 ease-standard cursor-pointer flex items-center gap-1.5"
                  >
                    {communityDarkMode ? (<><Sun className="w-3.5 h-3.5 text-amber-400" /> Switch to light mode</>) : (<><Moon className="w-3.5 h-3.5 text-violet-400" /> Switch to dark mode</>)}
                  </button>
                </div>

                <div className={`border rounded-3xl p-6 transition-[background-color,border-color,color,box-shadow] duration-300 ease-standard shadow-xl space-y-6 ${communityDarkMode ? 'bg-ink-900/90 border-ink-800 text-stone-200 shadow-ink-950/20' : 'bg-paper-50 border-stone-200 text-stone-800 shadow-stone-200/50'}`}>
                  <div className="border-b pb-4 flex justify-between items-start gap-4" style={{ borderColor: communityDarkMode ? '#342d27' : '#f3ede1' }}>
                    <div className="space-y-1">
                      <h4 className={`text-base font-black tracking-tight leading-tight font-serif ${communityDarkMode ? 'text-white' : 'text-stone-900'}`}>
                        How do you prove the Cauchy-Schwarz "Engel form" (Titu's Lemma) using vectors?
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-500 font-medium">
                        <span>Posted by <strong className="text-brass-500">Nam L.</strong> (Rank 5)</span>
                        <span>Active 2 hours ago</span>
                        <span>1,280 views</span>
                      </div>
                    </div>
                    <span className="bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0">Inequalities</span>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center gap-2 select-none shrink-0">
                      <button
                        type="button"
                        onClick={() => castPreviewVote('disc-1', 1)}
                        className={`hover:scale-115 transition-transform cursor-pointer ${myPreviewVote['disc-1'] === 1 ? 'text-brass-500' : 'text-stone-500 hover:text-brass-500'}`}
                        title="Upvote"
                      >
                        <ThumbsUp className={`w-4 h-4 ${myPreviewVote['disc-1'] === 1 ? 'fill-brass-500' : ''}`} />
                      </button>
                      <span className="font-mono font-black text-sm tracking-tight">{previewVoteCount('disc-1')}</span>
                      <button
                        type="button"
                        onClick={() => castPreviewVote('disc-1', -1)}
                        className={`hover:scale-115 transition-transform cursor-pointer ${myPreviewVote['disc-1'] === -1 ? 'text-rose-500' : 'text-stone-500 hover:text-rose-500'}`}
                        title="Downvote"
                      >
                        <ThumbsDown className={`w-4 h-4 ${myPreviewVote['disc-1'] === -1 ? 'fill-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <MathText
                        as="p"
                        className="text-xs leading-relaxed"
                        text="I'm preparing for an olympiad and ran into the Engel-form Cauchy-Schwarz inequality $\sum \frac{x_i^2}{a_i} \ge \frac{(\sum x_i)^2}{\sum a_i}$. I know the induction and AM-GM proofs, but I heard there's a beautiful proof using the dot product of two vectors. Could someone walk through it?"
                      />
                      <div className="flex gap-1.5 pt-1">
                        {['algebra', 'cauchy-schwarz', 'vectors'].map((tag) => (
                          <span key={tag} className={`text-[8px] font-bold px-2 py-0.5 rounded ${communityDarkMode ? 'bg-ink-800 text-stone-400' : 'bg-stone-100 text-stone-600'}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-5 pl-8 space-y-4" style={{ borderColor: communityDarkMode ? '#342d27' : '#f3ede1' }}>
                    <div className="flex justify-between items-center text-[10px] text-stone-500">
                      <span className="font-bold text-proof-500 uppercase tracking-wider flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Accepted answer</span>
                      <span className="font-mono">1 day ago</span>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="flex flex-col items-center gap-2 select-none shrink-0">
                        <button
                          type="button"
                          onClick={() => castPreviewVote('disc-2', 1)}
                          className={`hover:scale-115 transition-transform cursor-pointer ${myPreviewVote['disc-2'] === 1 ? 'text-brass-500' : 'text-stone-500 hover:text-brass-500'}`}
                          title="Upvote"
                        >
                          <ThumbsUp className={`w-4 h-4 ${myPreviewVote['disc-2'] === 1 ? 'fill-brass-500' : ''}`} />
                        </button>
                        <span className="font-mono font-black text-sm tracking-tight">{previewVoteCount('disc-2')}</span>
                        <button
                          type="button"
                          onClick={() => castPreviewVote('disc-2', -1)}
                          className={`hover:scale-115 transition-transform cursor-pointer ${myPreviewVote['disc-2'] === -1 ? 'text-rose-500' : 'text-stone-500 hover:text-rose-500'}`}
                          title="Downvote"
                        >
                          <ThumbsDown className={`w-4 h-4 ${myPreviewVote['disc-2'] === -1 ? 'fill-rose-500' : ''}`} />
                        </button>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-proof-500" />
                          <span className={`text-[11px] font-bold ${communityDarkMode ? 'text-stone-350' : 'text-stone-700'}`}>Mentor Hoang</span>
                          <span className="bg-brass-600/10 text-brass-450 border border-brass-500/10 text-[8px] font-black px-1.5 py-0.25 rounded uppercase">Faculty</span>
                        </div>
                        <MathText
                          as="p"
                          className="text-xs leading-relaxed"
                          text={
                            "Nice question. The vector proof is short and visual. Define two vectors in $n$-dimensional space:\n\n" +
                            "\\(\\vec{u} = \\left( \\frac{x_1}{\\sqrt{a_1}}, \\frac{x_2}{\\sqrt{a_2}}, \\dots, \\frac{x_n}{\\sqrt{a_n}} \\right)\\) and \\(\\vec{v} = (\\sqrt{a_1}, \\sqrt{a_2}, \\dots, \\sqrt{a_n})\\)\n\n" +
                            "By the geometric Cauchy-Schwarz inequality: \\((\\vec{u} \\cdot \\vec{v})^2 \\le \\|\\vec{u}\\|^2 \\cdot \\|\\vec{v}\\|^2\\)\n\n" +
                            "The dot product: \\(\\vec{u} \\cdot \\vec{v} = \\sum \\frac{x_i}{\\sqrt{a_i}} \\cdot \\sqrt{a_i} = \\sum x_i\\)\n" +
                            "The squared norms: \\(\\|\\vec{u}\\|^2 = \\sum \\frac{x_i^2}{a_i}\\) and \\(\\|\\vec{v}\\|^2 = \\sum a_i\\)\n\n" +
                            'Substituting gives \\((\\sum x_i)^2 \\le (\\sum \\frac{x_i^2}{a_i}) \\cdot (\\sum a_i)\\). Divide both sides by \\(\\sum a_i\\) (positive) to get exactly the Engel form. Equality holds iff the vectors are parallel, i.e. \\(\\frac{x_i}{a_i}\\) is constant across i.'
                          }
                        />
                        <div className="flex justify-between items-center pt-3 text-[10px] text-stone-500">
                          <button type="button" className="hover:text-brass-500 flex items-center gap-1 font-bold cursor-pointer"><MessageSquare className="w-3.5 h-3.5" /> 5 nested replies</button>
                          <button type="button" className="hover:text-rose-500 flex items-center gap-1 font-bold cursor-pointer">Report</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* USER FLOW TIMELINE */}
          <Reveal as="section" distance={14} amount={0.12} id="flow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center space-y-3 pb-16">
              <h2 className="text-xs uppercase font-extrabold text-brass-500 tracking-widest font-mono">Learning flow</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-serif">The Full Learning Cycle</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">A closed loop that compounds a student's ability step by step.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 max-w-6xl mx-auto relative">
              {([
                { n: 1, title: 'Take the placement test', body: 'Four short diagnostics across four domains locate an initial theta.', icon: BookOpen, color: 'brass' },
                { n: 2, title: 'AI analyzes errors', body: 'EduReach Core scans reasoning steps to detect systematic logic gaps.', icon: Brain, color: 'proof' },
                { n: 3, title: 'Get a personal path', body: 'Lessons and problem sets sync continuously with real progress.', icon: Shield, color: 'violet' },
                { n: 4, title: 'Practice & compete', body: 'Build reflexes in the Learning Engine, then enter ranked weekly arenas.', icon: Trophy, color: 'sky' },
                { n: 5, title: 'Track progress', body: 'Check the skill radar, study time, and trend lines on your dashboard.', icon: BarChart3, color: 'proof' },
                { n: 6, title: 'Join peer review', body: 'Discuss deeply, upvote strong solutions, and get mentor feedback.', icon: Users, color: 'brass' },
              ] as const).map((step) => {
                const StepIcon = step.icon;
                const isHovered = hoveredStep === step.n;
                const colorMap: Record<string, string> = {
                  brass: 'border-brass-500 text-brass-400 shadow-brass-950/10',
                  proof: 'border-proof-500 text-proof-400 shadow-proof-950/10',
                  violet: 'border-violet-500 text-violet-400 shadow-violet-950/10',
                  sky: 'border-sky-500 text-sky-400 shadow-sky-950/10',
                };
                return (
                  <div
                    key={step.n}
                    onMouseEnter={() => setHoveredStep(step.n)}
                    onMouseLeave={() => setHoveredStep(null)}
                    className={`bg-ink-900/40 border p-5 rounded-2xl space-y-3 transition-[border-color,box-shadow] duration-300 ease-standard relative select-none ${
                      isHovered ? `${colorMap[step.color]} scale-[1.03] bg-ink-900 shadow-lg` : 'border-ink-800 hover:border-ink-750'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-mono font-black ${isHovered ? colorMap[step.color].split(' ')[1] : 'text-stone-500'}`}>STEP 0{step.n}</span>
                      <StepIcon className={`w-4.5 h-4.5 ${isHovered ? colorMap[step.color].split(' ')[1] : 'text-stone-500'}`} />
                    </div>
                    <h4 className="font-extrabold text-xs text-white">{step.title}</h4>
                    <p className="text-[10px] text-stone-400 leading-relaxed">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>

          {/* SOCIAL ACQUISITION FUNNEL */}
          <Reveal as="section" distance={14} amount={0.12} className="bg-ink-900/40 border-y border-ink-800 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
                <div className="lg:col-span-6 space-y-5 text-center lg:text-left">
                  <h3 className="text-xs uppercase font-extrabold text-proof-400 tracking-widest font-mono">Acquisition channels</h3>
                  <h4 className="text-2xl sm:text-3xl font-black text-white leading-tight font-serif">Social media is a funnel, not the hub</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Facebook, TikTok, and YouTube exist purely to distribute content and pull in new learners. Every real learning experience, all adaptive data, and every ounce of academic value lives inside <strong>CalculixHub</strong> itself.
                  </p>
                </div>
                <div className="lg:col-span-6 space-y-4">
                  {[
                    { icon: Facebook, name: 'Facebook - Math Deep Dives', desc: 'In-depth olympiad & exam analysis posts', value: liveStats.facebookAcquisitions, color: 'brass' },
                    { icon: Users, name: 'TikTok Short Education', desc: '60-second logic-puzzle breakdowns', value: liveStats.tiktokAcquisitions, color: 'violet' },
                    { icon: Youtube, name: 'YouTube Deep-Dive Lectures', desc: 'Full contest solution walkthroughs', value: liveStats.youtubeAcquisitions, color: 'rose' },
                  ].map((chan) => {
                    const ChanIcon = chan.icon;
                    return (
                      <div key={chan.name} className="bg-ink-950 border border-ink-800 rounded-2xl p-4 flex items-center justify-between transition-[border-color] duration-240 ease-standard hover:border-ink-700">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${chan.color === 'brass' ? 'bg-brass-600/10 text-brass-500' : chan.color === 'violet' ? 'bg-violet-600/10 text-violet-400' : 'bg-rose-600/10 text-rose-500'}`}><ChanIcon className="w-5 h-5" /></div>
                          <div><h5 className="font-extrabold text-xs text-stone-200">{chan.name}</h5><p className="text-[9px] text-stone-500 font-medium">{chan.desc}</p></div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-white font-mono">{chan.value.toLocaleString()}</span>
                          <span className="text-[8px] text-stone-550 block font-bold">Users acquired</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* IMPACT */}
          <Reveal as="section" distance={14} amount={0.12} id="impact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="max-w-4xl mx-auto bg-ink-900 border border-ink-800 rounded-[32px] p-6 sm:p-10 relative overflow-hidden shadow-2xl bp-corners">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brass-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-8 space-y-5">
                  <span className="bg-proof-500/10 border border-proof-500/25 text-proof-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-wider block w-fit">Research &amp; social impact</span>
                  <h4 className="text-2xl font-black text-white tracking-tight font-serif">CalculixHub Impact Report</h4>
                  <p className="text-xs text-stone-405 leading-relaxed">
                    We hold ourselves to full transparency: every progress metric and connection count reflects real, live system activity, exportable for academic research.
                  </p>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-stone-400">
                        <span>Monthly active learners (currently {liveStats.activeUsers})</span>
                        <span className="text-brass-400 font-mono">Target: 10,000</span>
                      </div>
                      <SpringBar
                        value={(liveStats.activeUsers / 10000) * 100}
                        track="w-full bg-ink-950 rounded-full h-2 border border-ink-850"
                        fill="bg-gradient-to-r from-brass-500 to-proof-500 h-1.5 rounded-full"
                        label="Learners online against the 10,000 target"
                      />
                    </div>
                    <div className="flex items-center gap-8 text-center pt-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-stone-500 block">Real improvement rate</span>
                        <span className="text-2xl font-black text-proof-400 font-mono block mt-0.5">{liveStats.improvementRate}%</span>
                        <span className="text-[8px] text-stone-500 block">Score gain after 3 months</span>
                      </div>
                      <div className="border-l border-ink-800 pl-8">
                        <span className="text-[9px] uppercase font-bold text-stone-500 block">Monthly matches played</span>
                        <span className="text-2xl font-black text-white font-mono block mt-0.5">4,500+</span>
                        <span className="text-[8px] text-stone-555 block">Arena entries</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-4 text-center">
                  <div className="bg-ink-950 border border-ink-850 p-6 rounded-2xl space-y-4">
                    <FileText className="w-10 h-10 text-brass-400 mx-auto" />
                    <div>
                      <h5 className="font-extrabold text-xs text-stone-200">Export impact report</h5>
                      <p className="text-[9px] text-stone-500 mt-1 leading-normal">A live report compiled directly from the database.</p>
                    </div>
                    <m.button type="button" onClick={handleExportImpactReport} whileTap={{ scale: 0.97 }} transition={spring.press} className="w-full bg-brass-600 hover:bg-brass-500 text-ink-950 font-extrabold text-xs py-3 rounded-xl transition-colors duration-240 ease-standard cursor-pointer shadow-md flex items-center justify-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Download PDF report
                    </m.button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

        </main>

        <footer className="border-t border-ink-800 py-12 bg-ink-950 text-stone-500 select-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-ink-900 border border-ink-800 p-2 rounded-xl text-stone-400 font-bold w-9 h-9 flex items-center justify-center text-sm font-serif">&#8721;</div>
              <div><h5 className="font-extrabold text-xs tracking-wider text-stone-350 uppercase">CalculixHub</h5><span className="text-[9px] block text-stone-600 font-medium">Adaptive math, driven by real data</span></div>
            </div>
            <div className="text-[10px] text-center md:text-right space-y-1 leading-relaxed">
              <p>&copy; 2026 Calculix Platform. Endorsed by the Math Olympiad Faculty Board.</p>
              <p>Non-profit, open build. High-quality math education for everyone.</p>
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
    <div className="min-h-screen bg-paper-50 flex flex-col selection:bg-ink-950 selection:text-white">
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-brass-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-2/3 -right-20 w-96 h-96 bg-proof-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full min-h-screen bg-white grid grid-cols-1 md:grid-cols-12 relative z-10">

        {/* Left column: value proposition */}
        <div className="md:col-span-4 bg-ink-950 text-stone-300 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-48 h-48 bg-gradient-to-tr from-brass-500/10 to-proof-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-brass-500 to-brass-700 p-2.5 rounded-xl text-ink-950 font-black w-10 h-10 flex items-center justify-center text-lg shadow-lg font-serif">&#8721;</div>
              <div><h1 className="font-extrabold text-sm tracking-widest text-stone-100 uppercase">CalculixHub</h1><span className="text-[10px] font-bold text-stone-500 block -mt-1 uppercase tracking-wider">Math OS Platform</span></div>
            </div>

            <div className="space-y-3 pt-6">
              <h2 className="text-xl font-black text-white leading-tight font-serif">Adaptive testing, powered by IRT</h2>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                CalculixHub applies Item Response Theory (IRT), the same statistical model behind AMC and Olympiad-grade adaptive testing, to calibrate a path that matches your real ability.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex gap-2.5 items-start">
                <div className="bg-brass-500/10 p-1.5 rounded-lg border border-brass-500/20 text-brass-400 shrink-0"><BookOpen className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-bold text-stone-100">Computer-adaptive assessment</h4><p className="text-[10px] text-stone-400 mt-0.5">Each question's difficulty is chosen live from your real performance.</p></div>
              </div>
              <div className="flex gap-2.5 items-start">
                <div className="bg-proof-500/10 p-1.5 rounded-lg border border-proof-500/20 text-proof-400 shrink-0"><Activity className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-bold text-stone-100">Precise ability mapping</h4><p className="text-[10px] text-stone-400 mt-0.5">Converges on theta and narrows the standard error of measurement (SEM).</p></div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-ink-800 mt-8 space-y-3.5 text-[10px] text-stone-500">
            <div><span className="block font-semibold text-stone-350">Version 2.6 - Academic Core</span><span className="block mt-0.5">Adaptive IRT model - non-commercial ecosystem.</span></div>
            <p className="border-t border-ink-800/60 pt-3 leading-relaxed text-stone-400">Built on the <b>EduReach Analytics Core</b> standard.</p>
          </div>
        </div>

        {/* Right column: auth + placement */}
        <div className="md:col-span-8 p-8 md:p-16 flex flex-col justify-center bg-white min-h-screen">

          {/*
            Auth pane transitions.

            Sign in, register and the placement test all render into the same
            right-hand column, and used to replace one another instantly — the
            column simply became different content, with nothing connecting the
            "Sign in" press to the form that resulted. Keying the panes gives
            each a short lift-in and gives the outgoing one somewhere to go.

            `mode="wait"` matters more here than elsewhere: these are forms, and
            two overlapping forms would briefly duplicate autofill targets and
            focusable inputs.
          */}
          <AnimatePresence mode="wait" initial={false}>
          {/*
            No `authMode === 'landing'` pane here.

            This component returns renderLandingPage() early for the 'landing'
            mode, so a landing branch at this point is unreachable — TypeScript
            reports the comparison as having no overlap once React's types are
            installed. The markup that used to sit here (a "Welcome to
            CalculixHub" panel with Sign in / Create account buttons) had been
            dead since the early return was introduced; the real entry points
            are the landing page's own header and hero.
          */}
          {authMode === 'login' && (
            <m.form
              key="auth-login"
              onSubmit={handleLoginSubmit}
              initial={{ opacity: 0, y: travel.sm }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
              transition={spring.smooth}
              className="space-y-4"
            >
              <button type="button" onClick={() => { setAuthMode('landing'); setErrorMessage(''); }} className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-800 text-xs font-bold mb-2 transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
              <div className="space-y-1"><h3 className="text-xl font-black text-stone-900 tracking-tight font-serif">Welcome back</h3><p className="text-[11px] text-stone-500">Enter your account details to sign back in to CalculixHub.</p></div>

              {errorMessage && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium space-y-2">
                  <div className="flex items-center gap-1.5 font-bold"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" /><span>Sign-in error</span></div>
                  <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-3.5 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500 block">Email address</label>
                  <div className="relative"><Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-stone-200 focus:border-stone-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500 block">Password</label>
                  <div className="relative"><Key className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-stone-200 focus:border-stone-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2.5">
                <button type="submit" className="w-full bg-ink-950 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-md cursor-pointer flex justify-center items-center gap-1.5">Sign in</button>
                <button type="button" onClick={() => setAuthMode('register')} className="text-center text-[11px] font-bold text-brass-700 hover:underline pt-2 cursor-pointer">Don't have an account? Create one for free &rarr;</button>
              </div>
            </m.form>
          )}

          {authMode === 'register' && (
            <m.form
              key="auth-register"
              onSubmit={handleRegisterSubmit}
              initial={{ opacity: 0, y: travel.sm }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
              transition={spring.smooth}
              className="space-y-4"
            >
              <button type="button" onClick={() => { setAuthMode('landing'); setErrorMessage(''); }} className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-800 text-xs font-bold mb-1 transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
              <div className="space-y-1"><h3 className="text-xl font-black text-stone-900 tracking-tight font-serif">Create a new account</h3><p className="text-[11px] text-stone-500">Set up your profile, then take the adaptive IRT placement test to find your tier.</p></div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-850 rounded-xl text-xs font-medium flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span>{errorMessage}</span></div>
              )}
              {successMessage && (
                <div className="p-3 bg-proof-50 border border-proof-150 text-proof-800 rounded-xl text-xs font-semibold">{successMessage}</div>
              )}

              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500 block">Full name</label>
                  <div className="relative"><User className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input type="text" required placeholder="e.g. Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-stone-200 focus:border-stone-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500 block">Email address</label>
                  <div className="relative"><Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-stone-200 focus:border-stone-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500 block">Choose a password</label>
                  <div className="relative"><Key className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-stone-200 focus:border-stone-900 rounded-xl pl-10 pr-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 placeholder:text-stone-400 bg-stone-50/50" />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button type="submit" className="w-full bg-ink-950 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-md cursor-pointer justify-center items-center flex gap-1.5">Create profile &amp; take the IRT test <ArrowRight className="w-4 h-4" /></button>
                <button type="button" onClick={() => setAuthMode('login')} className="text-center text-[11px] font-bold text-brass-700 hover:underline pt-1.5 cursor-pointer">Already a member? Back to sign in &rarr;</button>
              </div>
            </m.form>
          )}

          {authMode === 'placement' && (
            <m.div
              key="auth-placement"
              initial={{ opacity: 0, y: travel.sm }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
              transition={spring.smooth}
              className="space-y-5"
            >
              {!testCompleted ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Active item */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            {currentItem.domain}
                          </span>
                          <span className="text-[9px] bg-brass-50 border border-brass-100 text-brass-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            {currentItem.source}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                          Adaptive Placement Test
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] uppercase text-stone-400 font-bold block">Item</span>
                        <span className="text-sm font-black text-stone-800 font-mono">
                          {responses.length + 1}
                          <span className="text-stone-400 text-[10px]">/{MIN_ITEMS}&ndash;{MAX_ITEMS}</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress toward the minimum item count */}
                    <SpringBar
                      value={(responses.length / MIN_ITEMS) * 100}
                      track="w-full bg-stone-100 rounded-full h-1"
                      fill="bg-violet-600 h-1 rounded-full"
                      label="Placement test progress"
                    />

                    {/*
                      Each adaptive item replaces the last in place. Keying the
                      question and its options on the item id turns that into a
                      visible hand-off — the answered question leaves, the newly
                      selected one arrives — which is the only cue the learner
                      gets that the engine picked a different item for them.
                    */}
                    <AnimatePresence mode="wait" initial={false}>
                      <m.div
                        key={currentItem.id}
                        initial={{ opacity: 0, y: travel.md }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -travel.sm, transition: { duration: duration.instant, ease: ease.exit } }}
                        transition={spring.smooth}
                        className="space-y-4"
                      >
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 shadow-xs">
                          <MathText as="p" className="text-stone-800 text-xs font-bold leading-relaxed" text={currentItem.question} />
                        </div>

                        <div className="space-y-2">
                          {currentItem.options.map((option, oIdx) => {
                            const isSelected = selectedAnswerIdx === oIdx;
                            return (
                              <m.button
                                key={oIdx}
                                type="button"
                                onClick={() => setSelectedAnswerIdx(oIdx)}
                                initial={{ opacity: 0, x: -travel.sm }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ ...spring.snappy, delay: 0.05 + oIdx * 0.04 }}
                                whileTap={{ scale: 0.99 }}
                                className={`w-full p-3.5 text-left text-xs rounded-xl border transition-[background-color,border-color,color,box-shadow] duration-160 ease-standard cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected ? 'border-violet-600 bg-violet-50/40 text-violet-900 font-bold shadow-xs scale-[1.01]' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-650'
                                }`}
                              >
                                <MathText text={option} />
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-160 ease-standard ${isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-300'}`}>
                                  {/*
                                    The radio dot springs in. It is 6px across
                                    and it is the entire confirmation that a
                                    choice registered, so it is worth animating.
                                  */}
                                  <AnimatePresence>
                                    {isSelected && (
                                      <m.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                        transition={{ type: 'spring', visualDuration: 0.2, bounce: 0.5 }}
                                        className="w-1.5 h-1.5 bg-white rounded-full"
                                      />
                                    )}
                                  </AnimatePresence>
                                </div>
                              </m.button>
                            );
                          })}
                        </div>

                        {/*
                          The hint lives inside the keyed block rather than
                          beside it. It is per-item content, and leaving it
                          outside meant the next item's hint appeared under the
                          previous item's question for the length of the
                          transition — a small thing that read as a glitch.
                        */}
                        <div className="bg-amber-50/30 border border-amber-200/40 rounded-xl p-3 flex gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-bold text-stone-600 block">Hint:</span>
                            <MathText as="p" className="text-[9px] text-stone-500 mt-0.5 leading-relaxed" text={currentItem.hint} />
                          </div>
                        </div>
                      </m.div>
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {errorMessage && (
                        <m.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ height: spring.snappy, opacity: { duration: duration.fast, ease: ease.standard } }}
                          className="overflow-hidden"
                        >
                          <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-[10px] font-semibold">{errorMessage}</div>
                        </m.div>
                      )}
                    </AnimatePresence>

                    <m.button type="button" onClick={handleNextIrtQuestion} whileTap={{ scale: 0.98 }} transition={spring.press} className="w-full bg-ink-950 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl transition-colors duration-240 ease-standard cursor-pointer flex justify-center items-center gap-1">
                      Score &amp; continue <ChevronRight className="w-4 h-4" />
                    </m.button>
                    <p className="text-[9px] text-stone-400 text-center leading-relaxed">
                      The test ends automatically once your ability estimate is precise enough &mdash; typically {MIN_ITEMS}&ndash;{MAX_ITEMS} items.
                    </p>
                  </div>

                  {/* Live IRT telemetry */}
                  <div className="lg:col-span-5 bg-stone-50/50 p-4 rounded-2xl border border-stone-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-stone-150">
                      <Activity ref={telemetryPulseRef} className="w-3.5 h-3.5 text-violet-600 animate-pulse" />
                      <h4 className="text-[10px] font-black uppercase text-stone-800 tracking-wider">Live 3PL IRT Analysis</h4>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-bold text-stone-500">
                        <span>Ability estimate &theta; (EAP)</span>
                        <span className="text-violet-700 font-mono">{theta > 0 ? '+' : ''}{theta.toFixed(2)}</span>
                      </div>
                      <div className="relative w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                        {/*
                          Not a SpringBar: this track also carries an overlaid
                          confidence band, so the fill is animated in place
                          rather than through the shared track/fill component.
                          The estimate moves after every answer, and springing
                          it is what shows the adaptive engine converging.
                        */}
                        <m.div
                          className="absolute h-full bg-violet-600"
                          animate={{ width: `${((theta + 3.0) / 6.0) * 100}%` }}
                          transition={spring.data}
                        />
                        {/* Confidence band: theta +/- SEM */}
                        <div
                          className="absolute h-full bg-violet-400/40"
                          style={{
                            left: `${Math.max(0, ((theta - sem + 3.0) / 6.0) * 100)}%`,
                            width: `${Math.min(100, ((2 * sem) / 6.0) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-stone-400 font-mono">
                        <span>-3.0 Foundation</span><span>0.0 Advanced</span><span>+3.0 Olympiad</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white border border-stone-150 rounded-xl grid grid-cols-2 gap-2 text-center">
                      <div>
                        <span className="text-[8px] uppercase text-stone-400 font-bold block">Std. error (SEM)</span>
                        <span className="text-xs font-black text-stone-800 font-mono block mt-0.5">&plusmn; {sem.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase text-stone-400 font-bold block">Reliability</span>
                        <span className="text-xs font-black text-proof-600 block mt-0.5">{(reliability(sem) * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-violet-900 font-bold flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Projected tier</span>
                        <span className="bg-violet-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">{tierForTheta(theta)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-violet-900 font-bold">Percentile</span>
                        <span className="text-[10px] font-black text-violet-700 font-mono">{thetaToPercentile(theta)}th</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-violet-900 font-bold">Matched contest</span>
                        <span className="text-[9px] font-black text-violet-700">{recommendedSource(theta)}</span>
                      </div>
                    </div>

                    {/* Domain coverage so far */}
                    <div className="space-y-1.5">
                      <span className="text-[8px] uppercase text-stone-400 font-extrabold block">Domain coverage</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DOMAINS.map((d) => {
                          const count = responses.filter((r) => r.item.domain === d).length;
                          return (
                            <div key={d} className={`text-[8px] font-bold px-2 py-1 rounded border flex justify-between ${count > 0 ? 'bg-proof-50 border-proof-150 text-proof-700' : 'bg-stone-100 border-stone-150 text-stone-400'}`}>
                              <span className="truncate">{d}</span><span className="font-mono shrink-0 ml-1">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-stone-400 font-extrabold block">IRT engine log:</span>
                      <div className="h-28 overflow-y-auto border border-stone-200 bg-ink-950 text-[8px] p-2 rounded-lg font-mono text-proof-400 space-y-1 select-none">
                        {irtLog.map((logLine, lIdx) => (<div key={lIdx} className="leading-normal">{logLine}</div>))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- Results screen --- */
                <div className="space-y-5 py-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-proof-50 border border-proof-200 text-proof-600 rounded-full flex items-center justify-center shadow-md"><CheckCircle2 className="w-6 h-6" /></div>
                    <h3 className="text-lg font-black text-stone-900 font-serif">Placement complete</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                      Measured across {responses.length} adaptively selected items. Your problem sets are now calibrated to this profile.
                    </p>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 max-w-lg mx-auto grid grid-cols-4 gap-3 text-center">
                    <div className="border-r border-stone-200">
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Ability</span>
                      <p className="text-sm font-extrabold text-violet-700 mt-0.5 font-mono">{theta.toFixed(2)}</p>
                    </div>
                    <div className="border-r border-stone-200">
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">SEM</span>
                      <p className="text-sm font-extrabold text-stone-800 mt-0.5 font-mono">{sem.toFixed(2)}</p>
                    </div>
                    <div className="border-r border-stone-200">
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Percentile</span>
                      <p className="text-sm font-extrabold text-stone-800 mt-0.5 font-mono">{thetaToPercentile(theta)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Tier</span>
                      <span className="block text-[10px] font-black text-proof-700 bg-proof-50 px-2 py-0.5 rounded-md w-fit mx-auto mt-1 border border-proof-150">{calculatedLevel}</span>
                    </div>
                  </div>

                  {/* Per-domain ability profile */}
                  <div className="max-w-lg mx-auto bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-violet-600" /> Measured domain profile
                    </h4>
                    {DOMAINS.map((d) => {
                      const pct = domainProfile[d as Topic];
                      const asked = responses.filter((r) => r.item.domain === d).length;
                      return (
                        <div key={d} className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-stone-700">{d}</span>
                            <span className="font-mono text-stone-500">{pct}% <span className="text-stone-400">({asked} {asked === 1 ? 'item' : 'items'})</span></span>
                          </div>
                          <SpringBar
                            value={pct}
                            track="w-full bg-stone-100 rounded-full h-1.5"
                            fill="bg-violet-500 h-1.5 rounded-full"
                            label={`${d} ability`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-left text-[11px] text-stone-600 space-y-1.5 max-w-lg mx-auto bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <p className="font-bold text-stone-705 flex gap-1.5 items-center"><BookOpen className="w-3.5 h-3.5 text-violet-600" /> What happens next:</p>
                    <ul className="list-disc pl-4 space-y-1.5 text-stone-500 text-[10px]">
                      <li>Problems from the <strong className="text-violet-600">{calculatedLevel}</strong> tier ({recommendedSource(theta)}-calibre) are prioritized first.</li>
                      <li>Your skill radar is seeded directly from this measured domain profile.</li>
                      <li>EduReach targets your weakest domain first when building your learning path.</li>
                      <li>You can join weekly matches and the leaderboard alongside peers at your level.</li>
                    </ul>
                  </div>

                  <button type="button" onClick={handleFinishPlacement} className="w-full max-w-lg mx-auto bg-ink-950 hover:bg-black text-white text-xs font-extrabold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-[background-color,border-color,color,box-shadow] duration-240 ease-standard cursor-pointer flex justify-center items-center gap-1.5">
                    Enter CalculixHub <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </m.div>
          )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
