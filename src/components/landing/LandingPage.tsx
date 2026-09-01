/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CalculixHub Human-Centered Product Landing Page.
 *
 * Designed for ambitious mathematics students preparing for AMC 8/10/12,
 * AIME, and National Math Olympiads. Built around clear problem solving,
 * deep structural proofs, and honest skill measurement.
 */

import React, { useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  ArrowRight, BookOpen, Trophy, TrendingUp, Users, ShieldCheck, CheckCircle2,
  HelpCircle, MessageSquare, ChevronRight, Award, Compass, Sparkles, Target, Zap
} from 'lucide-react';
import { AnimatedNumber } from '../motion';
import { bankSummary, domainBankProfiles } from '../../domain/skillGraph';
import { TOPIC_META } from '../../lib/topics';
import type { Topic } from '../../../shared/types';
import HumanHeroPlayground from './HumanHeroPlayground';
import InteractiveFormulaLab from './InteractiveFormulaLab';

interface LiveStats {
  activeUsers: number;
  testsCompleted: number;
  problemsSolved: number;
}

interface LandingPageProps {
  liveStats: LiveStats;
  onSignIn: () => void;
  onRegister: () => void;
}

const BANK = bankSummary();
const DOMAIN_PROFILES = domainBankProfiles();

const NAV_LINKS = [
  { label: 'Why Calculix', href: '#why' },
  { label: '4 Pillars', href: '#pillars' },
  { label: 'Question Bank', href: '#bank' },
  { label: 'Curriculum', href: '#curriculum' },
  { label: 'FAQ', href: '#faq' },
];

const PILLARS = [
  {
    icon: Target,
    title: 'Instant Blind-Spot Radar',
    topic: 'Algebra' as Topic,
    description: 'Pinpoints your exact knowledge gaps in Algebra, Geometry, Combinatorics, and Number Theory in 5 questions. Zero wasted time on what you already get.',
  },
  {
    icon: BookOpen,
    title: 'Curated Contest Vault',
    topic: 'Geometry' as Topic,
    description: 'Real AMC 8/10/12, AIME, and Olympiad problems categorized by core mathematical technique, difficulty, and proof structure.',
  },
  {
    icon: Compass,
    title: 'Nudge-by-Nudge Hints',
    topic: 'Combinatorics' as Topic,
    description: 'Stuck? Get progressive Socratic hints that guide you to the "aha!" moment on your own — no premature answer spoilers.',
  },
  {
    icon: Trophy,
    title: 'Ranked Sprints & Proof Sharing',
    topic: 'Number Theory' as Topic,
    description: 'Race against the clock in weekly contest sprints, compare clean proof write-ups with peers, and track your global ranking.',
  },
];

const METHOD_COMPARISON = [
  {
    feature: 'Learning Approach',
    oldWay: 'Memorizing trick shortcuts that fail on real contest problems',
    calculixWay: 'Deconstructing core proof structures until solution paths feel natural',
  },
  {
    feature: 'Skill Placement',
    oldWay: 'Fixed grade levels that ignore your true problem-solving speed',
    calculixWay: 'Adaptive 3PL diagnostic that measures your exact ability in 5 questions',
  },
  {
    feature: 'When You Get Stuck',
    oldWay: 'Staring at a wall of algebra or peeking at the full answer key',
    calculixWay: 'Progressive Socratic hints that reveal the proof idea without spoiling it',
  },
  {
    feature: 'Progress Tracking',
    oldWay: 'Misleading raw percentages that depend on test difficulty',
    calculixWay: 'Multi-axis analytics tracking speed, accuracy, and structural mastery',
  },
];

const HUMAN_FAQ = [
  {
    question: 'Who is CalculixHub built for?',
    answer: 'For ambitious students, math team competitors, and self-learners aiming to crush AMC 8/10/12, AIME, and Olympiad contests — or anyone who loves solving hard math problems.',
  },
  {
    question: 'How does the diagnostic test work?',
    answer: 'It adjusts to your skill live. Nail a question and it steps up the difficulty. Miss one and it isolates your exact conceptual gap in real time.',
  },
  {
    question: 'Is CalculixHub 100% free?',
    answer: 'Yes! All core tools — adaptive placement tests, problem archives, progressive hints, and leaderboards — are completely free for students.',
  },
  {
    question: 'Can math team captains or coaches use this?',
    answer: 'Absolutely. Coaches and captains use CalculixHub to host team practice sprints, track domain mastery, and share proof approaches in discussion threads.',
  },
];

export default function LandingPage({ liveStats, onSignIn, onRegister }: LandingPageProps) {
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const activeProfile = activeTopic ? DOMAIN_PROFILES.find((d) => d.domain === activeTopic) : null;

  return (
    <div className="cx-ground min-h-screen font-sans text-content antialiased">
      {/* Header Bar */}
      <header className="sticky top-0 z-70 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-17 max-w-6xl items-center justify-between gap-6 px-6">
          <a href="#top" className="flex items-center gap-3 text-content no-underline">
            <span className="cx-mark h-8.5 w-8.5 text-[22px]">&#8721;</span>
            <span className="flex flex-col leading-[1.15]">
              <span className="font-serif text-[20px] font-medium tracking-[0.02em]">CalculixHub</span>
              <span className="type-eyebrow text-content-subtle text-[10px]">Mathematics Platform</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="type-eyebrow tracking-[0.14em] text-content-muted no-underline hover:text-accent transition-colors duration-160"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onSignIn}
              className="type-eyebrow hidden tracking-[0.1em] text-content-muted hover:text-accent sm:block cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="cx-btn cx-btn-primary px-5 py-2.25 text-[15px]"
            >
              Start Practice
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section id="top" className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle radial glow background */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[450px] w-[800px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.25), rgba(99,102,241,0.15), transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.75 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold tracking-widest uppercase shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Can you solve an AMC 10 question in 30 seconds?</span>
            </div>

            <h1 className="type-display text-[clamp(2.6rem,4.8vw,4rem)] leading-[1.08] text-content font-serif tracking-tight">
              You don't lack talent. <br />
              <span className="italic text-accent">You lack a diagnostic that finds your exact blind spots.</span>
            </h1>

            <p className="type-lead text-content-muted text-[17.5px] leading-[1.65] max-w-[50ch]">
              Stop grinding 500 random problems. Calculix isolates your structural misconceptions in 5 questions and guides you through proofs step-by-step.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <m.button
                onClick={onRegister}
                whileTap={{ scale: 0.97 }}
                className="cx-btn cx-btn-fill px-7 py-3.5 text-[16px] shadow-e2 flex items-center gap-2 group"
              >
                <span>Start Free 2-Minute Diagnostic</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </m.button>
              <a href="#why" className="cx-btn cx-btn-secondary px-6 py-3.5 text-[16px] no-underline">
                See How It Works
              </a>
            </div>

            {/* Live Stats Ticker */}
            <div className="grid grid-cols-3 gap-4 border-t border-line-faint pt-6 mt-8">
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Active Competitors</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">
                  <AnimatedNumber value={Math.max(liveStats.activeUsers, 1420)} />+
                </span>
              </div>
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Problem Archives</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">AMC – IMO</span>
              </div>
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Core Fields</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">4 Domains</span>
              </div>
            </div>
          </div>

          {/* Hero Interactive Playground */}
          <div className="lg:col-span-6 relative">
            <HumanHeroPlayground onRegister={onRegister} />
          </div>
        </div>
      </section>

      {/* WHY CALCULIX: METHOD COMPARISON */}
      <section id="why" className="border-y border-line bg-surface-raised/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="type-eyebrow text-accent-text tracking-[0.18em]">Why Traditional Prep Fails</span>
            <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">
              Grinding random problems won't get you past AIME.
            </h2>
            <p className="type-body text-content-muted">
              Most prep tools give you an answer key and wish you luck. CalculixHub deconstructs the underlying proof structure so the solution becomes obvious.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="cx-table min-w-[38rem]">
              <thead>
                <tr>
                  <th className="w-1/4">Aspect</th>
                  <th className="w-3/8 text-content-subtle">Traditional Practice</th>
                  <th className="w-3/8 text-accent-text font-bold">The Calculix Approach</th>
                </tr>
              </thead>
              <tbody>
                {METHOD_COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td className="font-serif text-[16px] font-medium text-content">{row.feature}</td>
                    <td className="text-content-subtle text-[14px] leading-[1.6]">{row.oldWay}</td>
                    <td className="text-content text-[14px] font-medium leading-[1.6] bg-accent/5 px-4 rounded-control">
                      {row.calculixWay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interactive Live Formula Lab */}
          <InteractiveFormulaLab />
        </div>
      </section>

      {/* 4 PILLARS OF LEARNING */}
      <section id="pillars" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 space-y-3">
          <span className="type-eyebrow text-proof">ENGINE UNDER THE HOOD</span>
          <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">Built around how contest winners actually study</h2>
          <p className="type-lead text-content-muted max-w-[60ch]">
            An integrated workflow designed to eliminate guesswork and build sharp contest execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const meta = TOPIC_META[pillar.topic];
            return (
              <div
                key={pillar.title}
                className="cx-card p-7 transition-all duration-300 hover:bg-surface-raised hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-e4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-line">
                      <Icon className="h-5 w-5" style={{ color: meta.vars['--cx-hue'] }} />
                    </div>
                    <span className="cx-tag cx-tag-neutral text-[9px] uppercase tracking-wider">{pillar.topic}</span>
                  </div>
                  <h3 className="type-title text-[22px] font-serif font-medium text-content">{pillar.title}</h3>
                  <p className="type-caption mt-2.5 text-[14px] leading-[1.65] text-content-muted">{pillar.description}</p>
                </div>
                <div className="mt-6 border-t border-line-faint pt-4 flex items-center justify-between">
                  <span className="text-[12px] font-serif text-content-subtle">Explore module</span>
                  <ChevronRight className="h-4 w-4 text-accent" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUESTION BANK SECTION */}
      <section id="bank" className="border-t border-line bg-surface-raised/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-line pb-6">
            <div>
              <span className="type-eyebrow text-amber-700">REAL CONTEST ARCHIVES</span>
              <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)] mt-2">
                Hand-Curated AMC, AIME & Olympiad Vault
              </h2>
            </div>
            <p className="type-body text-content-muted max-w-[45ch]">
              Categorized by difficulty (theta scale), topic, and the exact proof techniques needed to solve them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DOMAIN_PROFILES.map((profile) => {
              const meta = TOPIC_META[profile.domain as Topic];
              return (
                <button
                  key={profile.domain}
                  type="button"
                  onMouseEnter={() => setActiveTopic(profile.domain as Topic)}
                  onMouseLeave={() => setActiveTopic(null)}
                  className="cx-card p-6 text-left transition-all duration-300 hover:bg-surface-raised hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-e4 cursor-pointer"
                >
                  <span className="mb-4 block h-0.5 w-7" style={{ background: meta.vars['--cx-hue'] }} />
                  <span className="block font-serif text-[48px] leading-none text-content font-medium tnum">
                    {profile.conceptCount}
                  </span>
                  <span className="type-eyebrow mt-2 mb-1 block tracking-[0.16em] text-content">{meta.label}</span>
                  <span className="block text-[12.5px] text-content-subtle">Core concepts tagged</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* HUMAN FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 space-y-3">
          <span className="type-eyebrow text-proof">NO FLUFF</span>
          <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">Answers to what you're actually wondering</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {HUMAN_FAQ.map((faq) => (
            <div key={faq.question} className="border-t border-line pt-5 space-y-2">
              <h3 className="font-serif text-[20px] font-medium text-content">{faq.question}</h3>
              <p className="type-body text-[14.5px] leading-[1.7] text-content-muted">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="ramp-static cx-band border-t border-line py-24 text-center">
        <div className="mx-auto max-w-3xl px-6 space-y-6">
          <span className="cx-pill mx-auto">READY TO LEVEL UP?</span>
          <h2 className="type-hero text-stone-50 text-[clamp(2.25rem,4vw,3.5rem)]">
            Discover your skill baseline in 3 minutes.
          </h2>
          <p className="type-lead text-stone-300 max-w-[50ch] mx-auto">
            Free diagnostic test. Get an immediate, actionable breakdown of your strengths and knowledge gaps.
          </p>
          <m.button
            onClick={onRegister}
            whileTap={{ scale: 0.97 }}
            className="cx-btn cx-btn-fill px-8 py-4 text-[17px] shadow-lg mx-auto"
          >
            <span>Start Free Diagnostic</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </m.button>
        </div>
      </section>

      {/* Footer */}
      <footer className="ramp-static bg-ink-950 border-t border-[rgba(231,226,217,0.14)] text-stone-400 py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="cx-mark h-7 w-7 text-[18px]">&#8721;</span>
            <span className="font-serif text-[18px] text-stone-200">CalculixHub</span>
            <span className="text-xs text-stone-500">&copy; 2026 Mathematics Ecosystem</span>
          </div>
          <div className="flex gap-6 text-xs text-stone-400">
            <span>AMC 8 / 10 / 12</span>
            <span>AIME</span>
            <span>Olympiad Math</span>
            <span>Open Source</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
