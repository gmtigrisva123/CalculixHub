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
  ThumbsUp, ThumbsDown, FileText, Moon, Sun, Facebook, Youtube, MessageSquare
} from 'lucide-react';
import { Level, Topic } from '../../shared/types';
import MathText from './MathText';
import { useRealtimeSubscription } from '../services/data/realtime';
import { apiUrl } from '../services/apiBase';
import InstallAppButton from './InstallAppButton';
import LandingPage from './landing/LandingPage';
import PlacementExperience from './PlacementExperience';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { AnimatedNumber, Reveal, SpringBar } from './motion';
import {
  IRTItem,
  ResponseRecord,
  Domain,
  estimateAbility,
  estimateDomainAbility,
  selectNextItem,
  evaluatePlacement,
  reliability,
  tierForTheta,
  thetaToMastery,
  thetaToPercentile,
  recommendedSource,
  probCorrect,
  itemInformation,

} from '../domain/irt';
import { ITEM_BANK } from '../domain/itemBank';
import {
  DomainBankProfile,
  bankSummary,
  domainBankProfiles,
  formatDifficulty,
} from '../domain/skillGraph';
import { useAuth } from '../context/AuthContext';
import { initialEmailConfirmation } from '../services/socialAuth';

interface WelcomeScreenProps {
  onLoginSuccess: (name: string, level: Level) => void;
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
  const { signIn, signUp, resendConfirmation, signInWithSocial, authError, requestPasswordReset, completeOnboarding, status: authStatus, hasOnboarded } = useAuth();

  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'verify' | 'placement'>(() => {
    if (initialEmailConfirmation) return 'login';
    return new URLSearchParams(window.location.search).get('auth') === 'signup' ? 'register' : 'landing';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  // Disables the submit button for the duration of the request, so a double
  // click cannot fire two sign-ups for the same address.
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(initialEmailConfirmation ? 'Your email has been confirmed. Sign in to continue.' : '');
  const [socialProvider, setSocialProvider] = useState<'google' | 'facebook' | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);
  useEffect(() => {
    if (authError) { setAuthMode('login'); setErrorMessage(authError); }
    else if (authStatus === 'authenticated' && !hasOnboarded && new URLSearchParams(window.location.search).get('auth') !== 'signup') setAuthMode('placement');
  }, [authError, authStatus, hasOnboarded]);
  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    if (submitting) return;
    setSubmitting(true); setSocialProvider(provider); setErrorMessage(''); setSuccessMessage('');
    const result = await signInWithSocial(provider);
    if (!result.ok) setErrorMessage(result.error ?? 'Could not start sign-in.');
    setSubmitting(false); setSocialProvider(null);
  };

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
    registeredUsers: 0,
    testsCompleted: 0,
    problemsSolved: 0,
  });
  const [statsAvailable, setStatsAvailable] = useState(false);

  const fetchLiveStats=async()=>{
   try{const response=await fetch(apiUrl('/api/live-stats'));if(!response.ok){setStatsAvailable(false);return;}const data=await response.json();setLiveStats({registeredUsers:Number(data.registeredUsers),testsCompleted:Number(data.testsCompleted),problemsSolved:Number(data.problemsSolved)});setStatsAvailable(true);}catch{setStatsAvailable(false);}
  };
  useEffect(()=>{void fetchLiveStats();},[]);
  useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.ranking',onReconnect:fetchLiveStats},()=>void fetchLiveStats());

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
      if (result.needsEmailConfirmation) {
        setConfirmationEmail(email.trim());
        setPassword('');
        setAuthMode('verify');
        return;
      }
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
        `[IRT] Bank loaded: ${ITEM_BANK.length} provisional items across AMC 8 / AMC 10 / AIME / USAMO / IMO.`,
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
      setConfirmationEmail(email.trim());
      setPassword('');
      setResendCountdown(60);
      setAuthMode('verify');
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
        `[IRT] Bank loaded: ${ITEM_BANK.length} provisional items across AMC 8 / AMC 10 / AIME / USAMO / IMO.`,
      ]);
      const first = selectNextItem(ITEM_BANK, [], 0) || ITEM_BANK[0];
      setCurrentItem(first);
      setItemStartedAt(Date.now());
      setSuccessMessage('');
    }, 1500);
  };

  const handleResendConfirmation = async () => {
    if (!confirmationEmail || submitting || resendCountdown > 0) return;
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    const result = await resendConfirmation(confirmationEmail);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not send another confirmation email.');
      return;
    }
    setResendCountdown(60);
    setSuccessMessage('If this address is still waiting for confirmation, a new link is on its way. Already registered? Sign in or reset your password.');
  };

  /**
   * Scores the current item, re-estimates ability with the 3PL EAP estimator,
   * then either administers the next maximum-information item or ends the test
   * once the SEM stopping rule is satisfied.
   */
  const handleNextIrtQuestion = (skip = false) => {
    if (authStatus !== 'authenticated') { setAuthMode('register'); return; }
    if (selectedAnswerIdx === null && !skip) {
      setErrorMessage('Select one answer choice before continuing.');
      return;
    }
    setErrorMessage('');

    const isCorrect = !skip && selectedAnswerIdx === currentItem.correctIdx;
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

    if (evaluatePlacement(nextResponses, ITEM_BANK).stop) {
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
        `[Stop] Termination rule met after ${nextResponses.length} items (SEM ${newSem.toFixed(2)} adaptive evidence threshold met).`,
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
      `[Select] Next item ${next.source} / ${next.domain} (b=${next.b.toFixed(1)}), expected posterior variance reduction at theta=${newTheta.toFixed(2)}.`,
    ]);
    setCurrentItem(next);
    setItemStartedAt(Date.now());
  };

  const handleFinishPlacement = async () => {
    // Persist to Supabase if the user has an active signed-in session
    try {
      const saved = await completeOnboarding({ level: calculatedLevel });
      if (!saved.ok && saved.error !== 'You need to be signed in.' && saved.error !== 'Accounts are unavailable in this build.') {
        console.warn('[CalculixHub] Onboarding save notice:', saved.error);
      }
    } catch (err) {
      console.warn('[CalculixHub] Skipped database save for guest placement:', err);
    }

    // Placement estimates stay inside the assessment flow. The workspace
    // starts with a clean dashboard and only learns from practice activity.
    onLoginSuccess(fullName || 'Calculix Student', calculatedLevel);
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
                <div class="metric-val">${statsAvailable ? liveStats.registeredUsers : 'Unavailable'}</div>
                <div class="metric-label">Arrivals in the last 15 minutes</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">IRT assessments completed</div>
                <div class="metric-val">${statsAvailable ? liveStats.testsCompleted : 'Unavailable'}</div>
                <div class="metric-label">Since this instance started</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Problems graded</div>
                <div class="metric-val">${statsAvailable ? liveStats.problemsSolved : 'Unavailable'}</div>
                <div class="metric-label">Since this instance started</div>
              </div>
            </div>
            <p style="font-size:12px;color:#64748b;margin-top:18px;">These counters are held in the serving instance's memory and reset when it restarts; on a multi-instance deployment each instance counts only its own traffic. They are reported as operational signal, not as audited telemetry. A report with figures suitable for citation requires the database-backed aggregation that is not yet in place.</p>
          </div>

          <div class="section">
            <h2>3. Assessment Bank</h2>
            <p>The adaptive placement test administers provisional items spanning ${bank.conceptCount} tagged concepts across ${bank.domainCount} domains, sourced from ${bank.sources.join(', ')}. Every item carries 3PL parameters (discrimination a, difficulty b, pseudo-guessing c) that the engine selects on. Per-domain coverage:</p>
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
              <li><strong>Learning Engine:</strong> Clear tiers (Foundation, Intermediate, Advanced, Olympiad) that adapt to each student.</li>
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

  if (authMode === 'verify') {
    return <div className="quiet-calculix cq-auth">
      <div className="cq-auth-story">
        <div className="cq-auth-wash" aria-hidden="true" />
        <div className="cq-auth-brand relative flex items-center gap-3">
          <span className="cq-symbol" aria-hidden="true"><Mail className="w-5 h-5" /></span>
          <span className="font-serif text-[19px] text-stone-50">CalculixHub</span>
        </div>
        <div className="cq-auth-story-copy relative max-w-[40ch]">
          <h2 className="type-hero text-[clamp(2rem,3.4vw,2.75rem)] text-stone-50">One quick check, then you're in.</h2>
          <p className="type-lead mt-4.5 text-stone-400">Confirm that this email belongs to you before your first sign in.</p>
        </div>
        <p className="type-eyebrow relative text-stone-500 tracking-[0.16em] text-[11px]">Your next question is waiting.</p>
      </div>
      <div className="cq-auth-form-wrap">
        <div className="cq-auth-form w-full" aria-live="polite">
          <div className="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-line text-accent-text"><Mail size={27} aria-hidden="true" /></div>
          <p className="type-eyebrow text-accent-text">Verify your email</p>
          <h1 className="type-title mt-3 text-[clamp(1.75rem,3vw,2.375rem)] font-normal">Check your inbox</h1>
          <p className="type-body mt-3 text-content-subtle">If this address needs confirmation, look for a link at <strong className="text-content break-all">{confirmationEmail}</strong>. You can return to this browser afterward.</p>
          <div className="mt-7 border-y border-line py-5 text-[13.5px] leading-[1.7] text-content-subtle">
            <p>It may take a minute to arrive. Check your spam folder. If you've used this address before, your account may already be verified. Sign in instead, or use “Forgot?” on the sign-in screen to reset your password.</p>
          </div>
          {errorMessage && <p role="alert" className="mt-5 flex items-start gap-2 text-[13.5px] text-accent-text"><AlertTriangle size={16} className="shrink-0 mt-1" />{errorMessage}</p>}
          {successMessage && <p role="status" className="mt-5 flex items-start gap-2 text-[13.5px] text-proof"><CheckCircle2 size={16} className="shrink-0 mt-1" />{successMessage}</p>}
          <button type="button" className="cx-btn cx-btn-fill cx-btn-block mt-7 py-3.5" onClick={() => void handleResendConfirmation()} disabled={submitting || resendCountdown > 0}>
            {submitting ? 'Sending…' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend confirmation email'}
          </button>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px]">
            <button type="button" className="text-accent-text hover:underline underline-offset-3" onClick={() => { setAuthMode('login'); setErrorMessage(''); setSuccessMessage(''); }}>Back to sign in</button>
            <button type="button" className="text-content-subtle hover:text-content hover:underline underline-offset-3" onClick={() => { setAuthMode('register'); setErrorMessage(''); setSuccessMessage(''); }}>Use a different email</button>
          </div>
        </div>
      </div>
    </div>;
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
  // Placement requires a verified Supabase session, including after session expiry.
  const requiresRegistration = authMode === 'placement' && authStatus !== 'authenticated';
  if (authMode === 'login' || authMode === 'register' || requiresRegistration) {
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
      <div className="quiet-calculix cq-auth">

        {/* The standing panel. Absolute dark, hence `ramp-static`. */}
        <div className="cq-auth-story">
          <div className="cq-auth-wash" aria-hidden="true" />

          <div className="cq-auth-brand relative flex items-center gap-3">
            <span className="cq-symbol" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M30 9C11 2 2 27 18 32c7 3 15-3 15-10M7 23 32 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="31" cy="12" r="3" fill="currentColor"/></svg></span>
            <span className="flex flex-col leading-[1.15]">
              <span className="font-serif text-[19px] text-stone-50">CalculixHub</span>
              <span className="type-eyebrow text-stone-500">A place to think</span>
            </span>
          </div>

          <div className="cq-auth-story-copy relative max-w-[40ch]">
            <h2 className="type-hero text-[clamp(2rem,3.4vw,2.75rem)] text-stone-50">
              Pick up where the estimate left off.
            </h2>
            <p className="type-lead mt-4.5 text-stone-400">
              Your skill map, streak and every graded answer are tied to the account, not the browser.
            </p>
          </div>

          <p className="type-eyebrow relative text-stone-500 tracking-[0.16em] text-[11px]">
            A little room for your next good question.
          </p>
        </div>

        {/* The form. */}
        <div className="cq-auth-form-wrap">
          <AnimatePresence mode="wait" initial={false}>
            <m.form
              key={isLogin ? 'auth-login' : 'auth-register'}
              onSubmit={isLogin ? handleLoginSubmit : handleRegisterSubmit}
              initial={{ opacity: 0, y: travel.sm }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -travel.xs, transition: { duration: duration.instant, ease: ease.exit } }}
              transition={spring.smooth}
              className="cq-auth-form w-full"
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

              <div className="mt-7.5 grid gap-3" aria-label="Social sign-in">
                <button type="button" className="cx-btn cx-btn-secondary cx-btn-block py-3" disabled={submitting || authStatus === 'unavailable'} onClick={() => void handleSocialSignIn('google')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.71 9.4 5.95 12 5.95Z"/></svg>
                  {socialProvider === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>
                <button type="button" className="cx-btn cx-btn-secondary cx-btn-block py-3" disabled={submitting || authStatus === 'unavailable'} onClick={() => void handleSocialSignIn('facebook')}>
                  <Facebook size={20} aria-hidden="true" className="text-[#1877F2]" />
                  {socialProvider === 'facebook' ? 'Opening Facebook…' : 'Continue with Facebook'}
                </button>
                <p className="text-xs text-content-subtle text-center">One secure sign-in for new and returning learners.</p>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-content-subtle"><span className="h-px flex-1 bg-line"/>or use your email<span className="h-px flex-1 bg-line"/></div>
              <div className="space-y-4.5">
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
                    minLength={isLogin ? undefined : 8}
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

  return <PlacementExperience
    theta={theta} sem={sem} responses={responses} log={irtLog}
    item={currentItem} selected={selectedAnswerIdx}
    onSelect={(index) => { setSelectedAnswerIdx(index); setErrorMessage(''); }}
    onNext={() => handleNextIrtQuestion()} onUnsure={() => handleNextIrtQuestion(true)}
    onHome={() => setAuthMode('landing')} error={errorMessage}
    completed={testCompleted} level={calculatedLevel}
    provisional={evaluatePlacement(responses, ITEM_BANK).reason === 'bank-exhausted' || evaluatePlacement(responses, ITEM_BANK).reason === 'limited-information'}
    onFinish={handleFinishPlacement}
  />;
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
