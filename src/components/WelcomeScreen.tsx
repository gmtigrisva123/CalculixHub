/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  Brain, Trophy, Sparkles, Key, Mail, User, HelpCircle, ArrowRight,
  ArrowLeft, CheckCircle2, ChevronRight, BookOpen, Activity, AlertTriangle, BarChart3,
  Globe, Shield, TrendingUp, Users, Check, X, Download,
  ThumbsUp, ThumbsDown, FileText, Moon, Sun, Facebook, Youtube, MessageSquare, Compass
} from 'lucide-react';
import { Level, Topic } from '../types';
import MathText from './MathText';
import { apiUrl } from '../lib/apiBase';
import InstallAppButton from './InstallAppButton';
import LandingPage from './landing/LandingPage';
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
import {
  DomainBankProfile,
  bankSummary,
  domainBankProfiles,
  formatDifficulty,
} from '../lib/skillGraph';
import { useAuth } from '../context/AuthContext';

interface WelcomeScreenProps {
  onLoginSuccess: (name: string, level: Level, initialSkills?: Record<Topic, number>) => void;
}

const DOMAINS: Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

/** Counted from the real bank, so the figure on the panel cannot drift from it. */
const BANK = bankSummary();

/**
 * Geometry of the hero skill graph.
 *
 * Every node is drawn by one code path from these constants, because the
 * hand-placed version drifted in three ways that were visible on hover:
 *
 *   1. **The pulse rings scaled from the wrong point.** `animate-ping` is a
 *      CSS transform, and an SVG element's `transform-box` defaults to
 *      `view-box` — so all four rings expanded away from the viewBox's
 *      top-left corner, each in a different direction and by a distance
 *      proportional to how far from that corner it sat. `Number Theory`'s ring
 *      flew off-screen entirely. Every transformed node part now declares
 *      `transform-box: fill-box`, which puts the origin at the element's own
 *      centre.
 *   2. **The hover targets were different sizes.** The label lived inside the
 *      hit region, so `NUMBER THEORY` (79px) and `COMBINATORICS` (77px) had a
 *      target a third wider than `ALGEBRA` (42px) — and both overflowed the
 *      60px circle they were drawn inside. Labels now sit below the circle and
 *      a single invisible rect of identical size takes every pointer event.
 *   3. **The links ran centre to centre**, relying on the node and core fills
 *      painted on top to hide the overlap, which left the visible gap at each
 *      end depending on paint order rather than on a stated distance.
 */
const GRAPH = {
  cx: 225,
  cy: 200,
  coreRadius: 45,
  coreRingRadius: 55,
  nodeRadius: 34,
  /** Link endpoints, as distances from the core centre and from the node centre. */
  linkStart: 63,
  linkEnd: 42,
  /** One hover/focus target for all four nodes, whatever the label's width. */
  hitWidth: 122,
  hitHeight: 118,
  hitTopOffset: -44,
} as const;

interface GraphNode {
  domain: Domain;
  x: number;
  y: number;
  /** Stroke for the node ring, its link and its travelling pulse. */
  stroke: string;
  /** Lighter tint of the same hue, for text on the dark panel. */
  text: string;
}

/**
 * The four positions are mirror images of each other about the core at
 * (225, 200) — offset by exactly ±133 and ±102 — so all four links come out
 * the same length. Nudging one node's coordinate to "look right" is what
 * breaks that, and it is not visible in the markup unless the symmetry is
 * stated somewhere. It is stated here.
 */
/*
 * These four have to be literals — they are SVG paint attributes, not classes —
 * but they are not free choices: they are the `-500`/`-400` steps of the same
 * four ramps `TOPIC_META` assigns in src/lib/topics.tsx. A learner who sees
 * Combinatorics in amber on the dashboard should not meet it in violet here.
 * Change one, change the other.
 */
const GRAPH_NODES: readonly GraphNode[] = [
  { domain: 'Algebra', x: 92, y: 98, stroke: '#7f5af0', text: '#9b83fb' },
  { domain: 'Geometry', x: 358, y: 98, stroke: '#22c55e', text: '#4ade80' },
  { domain: 'Combinatorics', x: 92, y: 302, stroke: '#f98807', text: '#ffa920' },
  { domain: 'Number Theory', x: 358, y: 302, stroke: '#0ea2dc', text: '#3cbef2' },
];

/**
 * Where a node's link starts and stops.
 *
 * Trimmed along the centre-to-centre direction, so the gap at the core end and
 * the gap at the node end are the same stated distance for all four — no part
 * of the line is hidden under a fill.
 */
function linkGeometry(node: GraphNode) {
  const dx = node.x - GRAPH.cx;
  const dy = node.y - GRAPH.cy;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  return {
    x1: GRAPH.cx + ux * GRAPH.linkStart,
    y1: GRAPH.cy + uy * GRAPH.linkStart,
    x2: node.x - ux * GRAPH.linkEnd,
    y2: node.y - uy * GRAPH.linkEnd,
  };
}

/** Scale/rotate an SVG part about its own centre instead of the viewBox corner. */
const SELF_ORIGIN: React.CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };


export default function WelcomeScreen({ onLoginSuccess }: WelcomeScreenProps) {
  const { signIn, signUp, requestPasswordReset, completeOnboarding, status: authStatus, hasOnboarded } = useAuth();

  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'placement'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  // Disables the submit button for the duration of the request, so a double
  // click cannot fire two sign-ups for the same address.
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // --- REAL-TIME STATISTICS STATE & POLLING ---
  /*
   * Seeded at zero, which is the truth before the first response arrives.
   *
   * These used to open at 1,428 learners and 12,482 assessments — numbers with
   * no source, shown to every visitor for the ~200ms before the fetch resolved
   * and permanently to anyone whose fetch failed. A counter that starts at a
   * flattering guess is not a counter.
   *
   * Only the three fields the server can actually source are held here. It also
   * returns `activeContestsCount`, `improvementRate` and the three acquisition
   * totals, all hard-coded to 0 with no measurement behind them; dropping them
   * from this state is the client-side half of deleting them outright.
   */
  const [liveStats, setLiveStats] = useState({
    activeUsers: 0,
    testsCompleted: 0,
    problemsSolved: 0,
  });

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const res = await fetch(apiUrl('/api/live-stats'));
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          // Read the three fields by name and keep the previous value for
          // anything the server omits or sends as a non-number. These are
          // rendered with `.toLocaleString()`, so a missing field would not
          // degrade a number -- it would throw and take the landing page down.
          // Naming them also stops unsourced fields the endpoint still returns
          // from re-entering state through a blanket spread.
          const numeric = (key: string, fallback: number) =>
            typeof data[key] === 'number' && Number.isFinite(data[key]) ? (data[key] as number) : fallback;

          setLiveStats((previous) => ({
            activeUsers: numeric('activeUsers', previous.activeUsers),
            testsCompleted: numeric('testsCompleted', previous.testsCompleted),
            problemsSolved: numeric('problemsSolved', previous.problemsSolved),
          }));
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

  /*
   * The skill graph, and the bank it reads from.
   *
   * `activeDomain` is keyed by domain rather than by a 1-4 index, so a node and
   * its link, pulse, label and feed line cannot end up describing different
   * domains. It is set by hover *and* by keyboard focus: the panel below is the
   * only place this content exists, and hover alone would hide it from anyone
   * not using a mouse.
   *
   * `bankProfiles` / `bank` are derived from `ITEM_BANK`, which is a module
   * constant, so this is a pure re-derivation on render rather than state that
   * could fall out of date.
   */
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null);
  const bankProfiles = domainBankProfiles();
  const bank = bankSummary();
  const activeProfile: DomainBankProfile | null =
    bankProfiles.find((profile) => profile.domain === activeDomain) ?? null;
  // SMIL keeps running regardless of the CSS reduced-motion rules, so the
  // travelling pulse has to be withheld rather than styled away.
  const prefersReducedMotion = useReducedMotion();

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

  // Accounts live in Postgres. The browser holds only a signed session token,
  // which the server verifies on every request -- nothing here is a user store.
  //
  // One-time cleanup of the previous localStorage "user database", which held
  // plaintext passwords. Left behind it would be a standing exposure on every
  // shared device that ever ran the old build.
  useEffect(() => {
    localStorage.removeItem('calculix_registered_users');
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both an email and a password.');
      return;
    }

    setSubmitting(true);
    // Verified by Supabase against an Argon2id digest it never exposes. The
    // previous implementation compared a plaintext password held in
    // localStorage, and accepted any password at all when the stored one was
    // missing.
    const result = await signIn({ email, password });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not sign you in.');
      return;
    }

    setSuccessMessage('Welcome back! Resuming your placement test...');
    
    setTimeout(() => {
      setAuthMode('placement');
      setResponses([]);
      setSelectedAnswerIdx(null);
      setTheta(0.0);
      setSem(1.0);
      setTestCompleted(false);
      setIrtLog([
        '[IRT] Resuming placement assessment for authenticated user.',
        '[IRT] 3PL engine initialized. Prior N(0,1), EAP estimation over 81 quadrature nodes.',
        `[IRT] Bank loaded: ${ITEM_BANK.length} calibrated items across AMC 8 / AMC 10 / AIME / USAMO / IMO.`,
      ]);
      const first = selectNextItem(ITEM_BANK, [], 0) || ITEM_BANK[0];
      setCurrentItem(first);
      setItemStartedAt(Date.now());
      setSuccessMessage('');
    }, 1500);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address first, then choose "Forgot password".');
      return;
    }

    setErrorMessage('');
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);

    // Reported the same way whether or not the address exists, so this form
    // cannot be used to discover which emails are registered.
    setSuccessMessage('If that address has an account, a reset link is on its way.');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password || !fullName.trim()) {
      setErrorMessage('Please fill in every required field.');
      return;
    }

    // Derived from the display name when the learner has not chosen one. The
    // database sanitises and de-duplicates it regardless of what arrives.
    const handle = (username.trim() || fullName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).slice(0, 24);

    setSubmitting(true);
    const result = await signUp({ email, password, username: handle, displayName: fullName });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not create your account.');
      return;
    }

    if (result.needsEmailConfirmation) {
      setSuccessMessage('Account created. Check your email to confirm the address, then sign in.');
      setAuthMode('login');
      return;
    }

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

      // The measured tier is written to the learner's profile by
      // `handleFinishPlacement`, which also stamps `onboarded_at` so placement
      // is never shown twice -- server-side, so clearing storage cannot replay it.
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

  const handleFinishPlacement = async () => {
    // Persisted to the profile: the tier, and `onboarded_at`. Because that
    // stamp lives in the database rather than in browser storage, placement is
    // not repeated on a new device and cannot be replayed by clearing storage.
    const saved = await completeOnboarding({ level: calculatedLevel, skills: domainProfile });
    if (!saved.ok) {
      setErrorMessage(saved.error ?? 'Could not save your placement. Try again.');
      return;
    }

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
            body { font-family: 'Georgia', serif; color: #0d1117; padding: 45px; line-height: 1.6; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 25px; margin-bottom: 35px; }
            .logo { font-size: 26px; font-weight: 900; color: #161b22; text-transform: uppercase; letter-spacing: 1.5px; }
            .subtitle { font-size: 11px; color: #4a5567; text-transform: uppercase; font-weight: 700; margin-top: 5px; }
            .date { font-size: 13px; color: #4a5567; font-family: monospace; background: #eef1f5; padding: 5px 10px; border-radius: 6px; }
            .section { margin-bottom: 40px; page-break-inside: avoid; }
            h2 { font-size: 18px; color: #1d4ed8; border-left: 5px solid #3b82f6; padding-left: 12px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
            p { font-size: 14px; color: #334155; text-align: justify; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
            .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 25px; }
            .metric-card { border: 1px solid #e2e8f0; background: #f6f8fa; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .metric-val { font-size: 26px; font-weight: 800; color: #1d4ed8; font-family: monospace; margin: 8px 0; }
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
                <div class="metric-label">Learners active</div>
                <div class="metric-val">${liveStats.activeUsers}</div>
                <div class="metric-label">Arrivals in the last 15 minutes</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">IRT assessments completed</div>
                <div class="metric-val">${liveStats.testsCompleted}</div>
                <div class="metric-label">Since this instance started</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Problems graded</div>
                <div class="metric-val">${liveStats.problemsSolved}</div>
                <div class="metric-label">Since this instance started</div>
              </div>
            </div>
            <p style="font-size:12px;color:#64748b;margin-top:18px;">These counters are held in the serving instance's memory and reset when it restarts; on a multi-instance deployment each instance counts only its own traffic. They are reported as operational signal, not as audited telemetry. A report with figures suitable for citation requires the database-backed aggregation that is not yet in place.</p>
          </div>

          <div class="section">
            <h2>3. Assessment Bank</h2>
            <p>The adaptive placement test administers ${bank.itemCount} calibrated items spanning ${bank.conceptCount} tagged concepts across ${bank.domainCount} domains, sourced from ${bank.sources.join(', ')}. Every item carries 3PL parameters (discrimination a, difficulty b, pseudo-guessing c) that the engine selects on. Per-domain coverage:</p>
            <table>
              <thead>
                <tr><th>Domain</th><th>Items</th><th>Concepts</th><th>Difficulty range (b)</th><th>Mean discrimination (a)</th></tr>
              </thead>
              <tbody>
                ${bankProfiles
                  .map(
                    (profile) => `<tr>
                  <td><strong>${profile.domain}</strong></td>
                  <td>${profile.itemCount}</td>
                  <td>${profile.conceptCount}</td>
                  <td>${formatDifficulty(profile.easiestB)} to ${formatDifficulty(profile.hardestB)}</td>
                  <td>${profile.meanDiscrimination.toFixed(2)}</td>
                </tr>`,
                  )
                  .join('')}
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
            <p>Compiled in the browser from the shipped item bank and the counters returned by /api/live-stats at the time shown above.</p>
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
  /*
   * The landing page lives in its own component.
   *
   * It used to be ~970 lines of JSX inside this function, sharing a scope with
   * the auth state machine and the placement test for no reason other than
   * history — the landing reads none of that state. Moving it out means the
   * marketing surface can be redesigned without a diff that also touches the
   * sign-in form, which is the part that must not break.
   */
  const renderLandingPage = () => (
    <LandingPage
      liveStats={liveStats}
      onSignIn={() => { setAuthMode('login'); setErrorMessage(''); }}
      onRegister={() => { setAuthMode('register'); setErrorMessage(''); }}
    />
  );

  if (authMode === 'landing') {
    return renderLandingPage();
  }

  /*
   * Sign in and sign up.
   *
   * These return before the shell below, which now only carries the placement
   * test.
   *
   * The split is the design's: a standing dark panel that states what an
   * account is *for*, beside a form on paper. It is the same pairing the
   * landing page closes on, so pressing "Sign in" there lands somewhere that
   * looks like where it came from — and it puts the form itself on the light
   * ground, which is where a form belongs. The placement test that follows
   * keeps the same treatment on purpose: it runs for ten minutes, and reading
   * dense mathematical notation on near-black for that long is worse.
   */
  if (authMode === 'login' || authMode === 'register') {
    const isLogin = authMode === 'login';
    const canSubmit = email.trim().length > 0 && password.length > 0 && (isLogin || fullName.trim().length > 0);

    return (
      /*
       * A two-column split that collapses on its own.
       *
       * `auto-fit` with a 26rem minimum rather than a `md:` breakpoint: the
       * left column is a standing panel of prose and the right is a form, and
       * the point at which they stop fitting side by side is a function of how
       * much room *they* need, not of which device class the viewport falls
       * into. Below ~52rem the track count drops to one and the panel stacks
       * above the form, which is the correct order to read them in.
       */
      <div className="min-h-screen grid [grid-template-columns:repeat(auto-fit,minmax(26rem,1fr))] bg-surface text-content font-sans antialiased">

        {/* The standing panel. Absolute dark, hence `ramp-static`. */}
        <div className="ramp-static cx-band flex flex-col justify-between gap-16 px-8 py-12 sm:px-13 sm:py-14">
          <div className="cx-band__wash" aria-hidden="true" />

          <div className="relative flex items-center gap-3">
            <span className="cx-mark">&#8721;</span>
            <span className="flex flex-col leading-[1.15]">
              <span className="font-serif text-[19px] text-stone-50">CalculixHub</span>
              <span className="type-eyebrow text-stone-500">Math OS Platform</span>
            </span>
          </div>

          <div className="relative max-w-[40ch]">
            <h2 className="type-hero text-[clamp(2rem,3.4vw,2.75rem)] text-stone-50">
              Pick up where the estimate left off.
            </h2>
            <p className="type-lead mt-4.5 text-stone-400">
              Your skill map, streak and every graded answer are tied to the account, not the browser.
            </p>
          </div>

          <p className="type-eyebrow relative text-stone-500 tracking-[0.16em] text-[11px]">
            {BANK.itemCount} calibrated items · {BANK.domainCount} domains · MIT licensed
          </p>
        </div>

        {/* The form. */}
        <div className="flex items-center justify-center px-6 py-14 sm:px-11 sm:py-14">
          <AnimatePresence mode="wait" initial={false}>
            <m.form
              key={isLogin ? 'auth-login' : 'auth-register'}
              onSubmit={isLogin ? handleLoginSubmit : handleRegisterSubmit}
              initial={{ opacity: 0, y: travel.sm }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
              transition={spring.smooth}
              className="w-full max-w-100"
            >
              <p className="type-eyebrow text-accent-text">{isLogin ? 'Sign in' : 'Create account'}</p>
              <h1 className="type-title mt-3 text-[clamp(1.75rem,3vw,2.375rem)] font-normal">
                {isLogin ? 'Welcome back' : 'Start measuring'}
              </h1>
              <p className="type-body mt-2.5 text-content-subtle">
                {isLogin
                  ? 'Sign in to keep your streak, skill map and contest history.'
                  : 'One account, and the placement test result stays with you.'}
              </p>

              <div className="mt-7.5 space-y-4.5">
                {!isLogin && (
                  <div>
                    <label className="cx-label" htmlFor="auth-name">Display name</label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Mai Nguyen"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="cx-input"
                    />
                  </div>
                )}

                <div>
                  <label className="cx-label" htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cx-input"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <label className="cx-label mb-0" htmlFor="auth-password">Password</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[12px] text-accent-text hover:underline underline-offset-3 cursor-pointer"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cx-input mt-2.25"
                  />
                </div>
              </div>

              {/*
                Status lines are a rule and a sentence, not a filled alert box.
                Colour is carried by the icon and the text; a tinted panel here
                would be the loudest thing on a page whose whole argument is
                that structure comes from hairlines.
              */}
              <AnimatePresence mode="popLayout" initial={false}>
                {errorMessage && (
                  <m.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ height: spring.snappy, opacity: { duration: duration.fast, ease: ease.standard } }}
                    className="overflow-hidden"
                  >
                    <p role="alert" className="mt-4.5 flex items-start gap-2 text-[13.5px] leading-[1.6] text-accent-text">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-1" /> {errorMessage}
                    </p>
                  </m.div>
                )}
                {successMessage && (
                  <m.div
                    key="success"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ height: spring.snappy, opacity: { duration: duration.fast, ease: ease.standard } }}
                    className="overflow-hidden"
                  >
                    <p role="status" className="mt-4.5 flex items-start gap-2 text-[13.5px] leading-[1.6] text-proof">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-1" /> {successMessage}
                    </p>
                  </m.div>
                )}
              </AnimatePresence>

              {/*
                The submit button is the only filled control on the page, and it
                only fills once the form could actually be sent. Before that it
                is an outline: the shape is there, the invitation is not.
              */}
              <button
                type="submit"
                disabled={submitting}
                className={`cx-btn cx-btn-block mt-6 py-3.5 text-[17px] ${canSubmit ? 'cx-btn-fill' : 'cx-btn-inert'}`}
              >
                {submitting ? 'Working…' : isLogin ? 'Sign in' : 'Create account'}
              </button>

              <div className="flex items-center gap-3.5 my-6.5">
                <span className="h-px flex-1 bg-line" />
                <span className="type-eyebrow text-content-subtle tracking-[0.18em]">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <button
                type="button"
                onClick={() => setAuthMode('placement')}
                className="cx-btn cx-btn-secondary cx-btn-block py-3.25"
              >
                <Compass className="w-3.75 h-3.75" /> Continue as guest
              </button>

              <p className="type-body mt-6.5 text-content-subtle">
                {isLogin ? 'No account yet?' : 'Already registered?'}
                <button
                  type="button"
                  onClick={() => { setAuthMode(isLogin ? 'register' : 'login'); setErrorMessage(''); setSuccessMessage(''); }}
                  className="font-serif text-[16px] text-accent pl-1 hover:underline underline-offset-3 cursor-pointer"
                >
                  {isLogin ? 'Create one' : 'Sign in'}
                </button>
              </p>

              <button
                type="button"
                onClick={() => { setAuthMode('landing'); setErrorMessage(''); setSuccessMessage(''); }}
                className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] text-content-subtle hover:text-content transition-colors duration-160 ease-standard cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to the landing page
              </button>
            </m.form>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col selection:bg-ink-950 selection:text-white">
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-azure-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-2/3 -right-20 w-96 h-96 bg-proof-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full min-h-screen bg-surface-raised grid grid-cols-1 md:grid-cols-12 relative z-10">

        {/* Left column: value proposition */}
        <div className="ramp-static md:col-span-4 bg-ink-950 text-stone-300 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-48 h-48 bg-azure-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-azure-500 to-azure-700 p-2.5 rounded-control text-white font-bold w-10 h-10 flex items-center justify-center text-lg shadow-e3 font-serif">&#8721;</div>
              <div><h1 className="font-semibold text-[15px] tracking-tight text-white leading-tight">CalculixHub</h1><span className="text-[12px] text-stone-450 block leading-tight">Math OS platform</span></div>
            </div>

            <div className="space-y-3 pt-6">
              <h2 className="type-heading text-white">Adaptive testing, powered by IRT</h2>
              <p className="text-[12px] text-stone-400 leading-relaxed">
                CalculixHub applies Item Response Theory (IRT), the same statistical model behind AMC and Olympiad-grade adaptive testing, to calibrate a path that matches your real ability.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex gap-2.5 items-start">
                <div className="bg-azure-500/10 p-1.5 rounded-lg border border-azure-500/20 text-azure-400 shrink-0"><BookOpen className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-bold text-stone-100">Computer-adaptive assessment</h4><p className="text-[11px] text-stone-400 mt-0.5">Each question's difficulty is chosen live from your real performance.</p></div>
              </div>
              <div className="flex gap-2.5 items-start">
                <div className="bg-proof-500/10 p-1.5 rounded-lg border border-proof-500/20 text-proof-400 shrink-0"><Activity className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-bold text-stone-100">Precise ability mapping</h4><p className="text-[11px] text-stone-400 mt-0.5">Converges on theta and narrows the standard error of measurement (SEM).</p></div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-ink-800 mt-8 space-y-3.5 text-[11px] text-stone-500">
            <div><span className="block font-semibold text-stone-350">Version 2.6 - Academic Core</span><span className="block mt-0.5">Adaptive IRT model - non-commercial ecosystem.</span></div>
            <p className="border-t border-ink-800/60 pt-3 leading-relaxed text-stone-400">Built on the <b>EduReach Analytics Core</b> standard.</p>
          </div>
        </div>

        {/* Right column: auth + placement */}
        <div className="md:col-span-8 p-8 md:p-16 flex flex-col justify-center bg-surface-raised min-h-screen">

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
                          <span className="text-[11px] bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            {currentItem.domain}
                          </span>
                          <span className="text-[11px] bg-azure-50 border border-azure-100 text-azure-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            {currentItem.source}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          Adaptive Placement Test
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] uppercase text-stone-400 font-bold block">Item</span>
                        <span className="text-sm font-bold text-stone-800 font-mono">
                          {responses.length + 1}
                          <span className="text-stone-400 text-[11px]">/{MIN_ITEMS}&ndash;{MAX_ITEMS}</span>
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
                        <div className="p-4 bg-stone-50 rounded-card border border-stone-100 shadow-e1">
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
                                className={`w-full p-3.5 text-left text-xs rounded-control border transition-[background-color,border-color,color,box-shadow] duration-160 ease-standard cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected ? 'border-violet-600 bg-violet-50/40 text-violet-900 font-bold shadow-e1 scale-[1.01]' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-650'
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
                                        className="w-1.5 h-1.5 bg-surface-raised rounded-full"
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
                        <div className="bg-amber-50/30 border border-amber-200/40 rounded-control p-3 flex gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[11px] font-bold text-stone-600 block">Hint:</span>
                            <MathText as="p" className="text-[11px] text-stone-500 mt-0.5 leading-relaxed" text={currentItem.hint} />
                          </div>
                        </div>
                      </m.div>
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {errorMessage && (
                        <m.div
                          initial={{ opacity: 0, height: 0, scale: 0.95, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, height: 'auto', scale: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, height: 0, scale: 0.95, filter: 'blur(4px)' }}
                          transition={{ height: spring.snappy, opacity: { duration: duration.fast, ease: ease.standard }, scale: { duration: duration.fast, ease: ease.standard }, filter: { duration: duration.fast, ease: ease.standard } }}
                          className="overflow-hidden"
                        >
                          <div className="mb-4 flex items-start gap-2 rounded-control border border-rose-200 bg-rose-100 p-3 shadow-sm">
                            <AlertTriangle className="w-[16px] h-[16px] text-rose-600 shrink-0 mt-[1px]" strokeWidth={2.5} />
                            <div className="text-[12.5px] font-medium leading-[1.4] text-rose-900">{errorMessage}</div>
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>

                    <m.button type="button" onClick={handleNextIrtQuestion} whileTap={{ scale: 0.98 }} transition={spring.press} className="w-full material-accent text-sm py-3.5 rounded-control cursor-pointer flex justify-center items-center gap-1 font-serif">
                      Score &amp; continue <ChevronRight className="w-4 h-4" />
                    </m.button>
                    <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                      The test ends automatically once your ability estimate is precise enough &mdash; typically {MIN_ITEMS}&ndash;{MAX_ITEMS} items.
                    </p>
                  </div>

                  {/* Live IRT telemetry */}
                  <div className="lg:col-span-5 bg-stone-50/50 p-4 rounded-card border border-stone-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-stone-150">
                      <Activity ref={telemetryPulseRef} className="w-3.5 h-3.5 text-violet-600 animate-pulse" />
                      <h4 className="text-[11px] font-bold uppercase text-stone-800 tracking-wider">Live 3PL IRT Analysis</h4>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold text-stone-500">
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
                      <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                        <span>-3.0 Foundation</span><span>0.0 Advanced</span><span>+3.0 Olympiad</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface-raised border border-stone-150 rounded-control grid grid-cols-2 gap-2 text-center">
                      <div>
                        <span className="text-[10px] uppercase text-stone-400 font-bold block">Std. error (SEM)</span>
                        <span className="text-xs font-bold text-stone-800 font-mono block mt-0.5">&plusmn; {sem.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-stone-400 font-bold block">Reliability</span>
                        <span className="text-xs font-bold text-proof-600 block mt-0.5">{(reliability(sem) * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-violet-50/50 border border-violet-100 rounded-control space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-violet-900 font-bold flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Projected tier</span>
                        <span className="bg-violet-600 text-white text-[11px] font-bold px-2 py-0.5 rounded uppercase">{tierForTheta(theta)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-violet-900 font-bold">Percentile</span>
                        <span className="text-[11px] font-bold text-violet-700 font-mono">{thetaToPercentile(theta)}th</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-violet-900 font-bold">Matched contest</span>
                        <span className="text-[11px] font-bold text-violet-700">{recommendedSource(theta)}</span>
                      </div>
                    </div>

                    {/* Domain coverage so far */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase text-stone-400 font-semibold block">Domain coverage</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DOMAINS.map((d) => {
                          const count = responses.filter((r) => r.item.domain === d).length;
                          return (
                            <div key={d} className={`text-[10px] font-bold px-2 py-1 rounded border flex justify-between ${count > 0 ? 'bg-proof-50 border-proof-150 text-proof-700' : 'bg-stone-100 border-stone-150 text-stone-400'}`}>
                              <span className="truncate">{d}</span><span className="font-mono shrink-0 ml-1">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-stone-400 font-semibold block">IRT engine log:</span>
                      <div className="h-28 overflow-y-auto border border-stone-200 bg-ink-950 text-[10px] p-2 rounded-lg font-mono text-proof-400 space-y-1 select-none">
                        {irtLog.map((logLine, lIdx) => (<div key={lIdx} className="leading-normal">{logLine}</div>))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- Results screen --- */
                <div className="space-y-5 py-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-proof-50 border border-proof-200 text-proof-600 rounded-full flex items-center justify-center shadow-e2"><CheckCircle2 className="w-6 h-6" /></div>
                    <h3 className="type-heading text-stone-900">Placement complete</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                      Measured across {responses.length} adaptively selected items. Your problem sets are now calibrated to this profile.
                    </p>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-card border border-stone-100 max-w-lg mx-auto grid grid-cols-4 gap-3 text-center">
                    <div className="border-r border-stone-200">
                      <span className="text-[11px] uppercase font-bold text-stone-400 block">Ability</span>
                      <p className="text-sm font-semibold text-violet-700 mt-0.5 font-mono">{theta.toFixed(2)}</p>
                    </div>
                    <div className="border-r border-stone-200">
                      <span className="text-[11px] uppercase font-bold text-stone-400 block">SEM</span>
                      <p className="text-sm font-semibold text-stone-800 mt-0.5 font-mono">{sem.toFixed(2)}</p>
                    </div>
                    <div className="border-r border-stone-200">
                      <span className="text-[11px] uppercase font-bold text-stone-400 block">Percentile</span>
                      <p className="text-sm font-semibold text-stone-800 mt-0.5 font-mono">{thetaToPercentile(theta)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-stone-400 block">Tier</span>
                      <span className="block text-[11px] font-bold text-proof-700 bg-proof-50 px-2 py-0.5 rounded-md w-fit mx-auto mt-1 border border-proof-150">{calculatedLevel}</span>
                    </div>
                  </div>

                  {/* Per-domain ability profile */}
                  <div className="max-w-lg mx-auto bg-surface-raised material-card border border-line rounded-card p-4 space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-violet-600" /> Measured domain profile
                    </h4>
                    {DOMAINS.map((d) => {
                      const pct = domainProfile[d as Topic];
                      const asked = responses.filter((r) => r.item.domain === d).length;
                      return (
                        <div key={d} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
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

                  <div className="text-left text-[12px] text-stone-600 space-y-1.5 max-w-lg mx-auto bg-stone-50 p-4 rounded-control border border-stone-100">
                    <p className="font-bold text-stone-705 flex gap-1.5 items-center"><BookOpen className="w-3.5 h-3.5 text-violet-600" /> What happens next:</p>
                    <ul className="list-disc pl-4 space-y-1.5 text-stone-500 text-[11px]">
                      <li>Problems from the <strong className="text-violet-600">{calculatedLevel}</strong> tier ({recommendedSource(theta)}-calibre) are prioritized first.</li>
                      <li>Your skill radar is seeded directly from this measured domain profile.</li>
                      <li>EduReach targets your weakest domain first when building your learning path.</li>
                      <li>You can join weekly matches and the leaderboard alongside peers at your level.</li>
                    </ul>
                  </div>

                  <button type="button" onClick={handleFinishPlacement} className="w-full max-w-lg mx-auto material-accent text-sm py-3.5 rounded-control cursor-pointer flex justify-center items-center gap-1.5 font-serif">
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

/*
 * A labelled input with a leading glyph.
 *
 * The three fields on the auth screens differ only in label, icon and the
 * control itself, and they had been three copies of the same twelve-line block.
 * Copies drift: the sign-up email field and the sign-in email field had already
 * picked up different focus borders before this was pulled out.
 */
function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-white/55">{label}</span>
      <span className="relative mt-1.5 block">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
        {children}
      </span>
    </label>
  );
}
