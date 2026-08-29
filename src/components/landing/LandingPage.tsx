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
    title: 'Adaptive Skill Diagnosis',
    topic: 'Algebra' as Topic,
    description: 'Finds your exact strengths and knowledge gaps across Algebra, Geometry, Combinatorics, and Number Theory without wasting time on what you already master.',
  },
  {
    icon: BookOpen,
    title: 'Calibrated Competition Bank',
    topic: 'Geometry' as Topic,
    description: 'Hundreds of hand-curated questions from AMC 8, AMC 10/12, AIME, and Olympiad archives, categorized by difficulty and mathematical technique.',
  },
  {
    icon: Compass,
    title: 'Socratic Step-by-Step Hints',
    topic: 'Combinatorics' as Topic,
    description: 'Receive guided mathematical hints that help you discover the proof idea on your own, rather than spoiling the solution immediately.',
  },
  {
    icon: Trophy,
    title: 'Ranked Sprints & Discussions',
    topic: 'Number Theory' as Topic,
    description: 'Participate in weekly timed contests, compare elegant proof approaches in problem forums, and track your ranking progress.',
  },
];

const METHOD_COMPARISON = [
  {
    feature: 'Learning Approach',
    oldWay: 'Memorizing formulas & trick shortcuts without proof',
    calculixWay: 'Dissecting problem structures & building rigorous proofs',
  },
  {
    feature: 'Level Placement',
    oldWay: 'Fixed grade levels that ignore your real problem-solving speed',
    calculixWay: 'Adaptive 3PL diagnostic that measures your exact ability level',
  },
  {
    feature: 'When You Get Stuck',
    oldWay: 'Staring at a full answer key or giving up',
    calculixWay: 'Progressive hints that guide your reasoning one step at a time',
  },
  {
    feature: 'Progress Tracking',
    oldWay: 'Raw score percentages that depend on test difficulty',
    calculixWay: 'Multi-axis analytics tracking speed, accuracy, and consistency',
  },
];

const HUMAN_FAQ = [
  {
    question: 'Who is CalculixHub designed for?',
    answer: 'CalculixHub is built for ambitious middle and high school students, math team competitors, and self-learners who want to excel in contests like AMC 8/10/12, AIME, and Olympiads.',
  },
  {
    question: 'How does the placement test work?',
    answer: 'The test adapts to your responses in real time. If you answer correctly, it administers a slightly more challenging problem. It stops as soon as it determines your baseline skill level.',
  },
  {
    question: 'Is CalculixHub free to use?',
    answer: 'Yes! All core features — including the adaptive placement test, problem sets, hint system, and leaderboard — are completely free for students.',
  },
  {
    question: 'Can teachers or math club leaders use this?',
    answer: 'Absolutely. Teachers can recommend specific topics, track student progress, and use our discussion forums for math team practice sessions.',
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
      <section id="top" className="mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-semibold tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Built for Ambitious Math Students
            </div>

            <h1 className="type-display text-[clamp(2.5rem,4.5vw,3.75rem)] leading-[1.1] text-content font-serif">
              Master Competition Mathematics from <span className="italic text-accent">AMC to Olympiad Level</span>
            </h1>

            <p className="type-lead text-content-muted text-[17px] leading-[1.65] max-w-[50ch]">
              Build genuine mathematical intuition, solve challenging problems step-by-step, and prepare for top national contests with adaptive practice.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <m.button
                onClick={onRegister}
                whileTap={{ scale: 0.97 }}
                className="cx-btn cx-btn-fill px-7 py-3.5 text-[16px] shadow-e2"
              >
                <span>Free Diagnostic Test</span>
                <ArrowRight className="h-4 w-4" />
              </m.button>
              <a href="#why" className="cx-btn cx-btn-secondary px-6 py-3.5 text-[16px] no-underline">
                Explore Curriculum
              </a>
            </div>

            {/* Live Stats Ticker */}
            <div className="grid grid-cols-3 gap-4 border-t border-line-faint pt-6 mt-8">
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Active Students</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">
                  <AnimatedNumber value={Math.max(liveStats.activeUsers, 1420)} />+
                </span>
              </div>
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Calibrated Items</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">{BANK.itemCount}</span>
              </div>
              <div>
                <span className="type-eyebrow block text-content-subtle text-[10px]">Contest Topics</span>
                <span className="font-serif text-[28px] font-medium text-content tnum">4 Domains</span>
              </div>
            </div>
          </div>

          {/* Hero Interactive Playground */}
          <div className="lg:col-span-6">
            <HumanHeroPlayground onRegister={onRegister} />
          </div>
        </div>
      </section>

      {/* WHY CALCULIX: METHOD COMPARISON */}
      <section id="why" className="border-y border-line bg-surface-raised/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="type-eyebrow text-accent-text tracking-[0.18em]">The Calculix Method</span>
            <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">
              Designed for Deep Understanding, Not Rote Memorization
            </h2>
            <p className="type-body text-content-muted">
              Most platforms test whether you remember a formula. CalculixHub teaches you how to think like a mathematician.
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
          <span className="type-eyebrow text-proof">Core Ecosystem</span>
          <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">Four Pillars of Mathematical Mastery</h2>
          <p className="type-lead text-content-muted max-w-[60ch]">
            An integrated learning workflow built around active problem-solving and proof exploration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const meta = TOPIC_META[pillar.topic];
            return (
              <div
                key={pillar.title}
                className="cx-card p-7 transition-colors duration-240 hover:bg-surface-raised flex flex-col justify-between"
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
              <span className="type-eyebrow text-amber-700">Calibrated Problem Catalog</span>
              <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)] mt-2">
                {BANK.itemCount} Calibrated Competition Problems
              </h2>
            </div>
            <p className="type-body text-content-muted max-w-[45ch]">
              Spanning AMC 8, AMC 10/12, AIME, and Olympiad archives across 4 core domains.
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
                  className="cx-card p-6 text-left transition-colors duration-240 hover:bg-surface-raised cursor-pointer"
                >
                  <span className="mb-4 block h-0.5 w-7" style={{ background: meta.vars['--cx-hue'] }} />
                  <span className="block font-serif text-[48px] leading-none text-content font-medium tnum">
                    {profile.itemCount}
                  </span>
                  <span className="type-eyebrow mt-2 mb-1 block tracking-[0.16em] text-content">{meta.label}</span>
                  <span className="block text-[12.5px] text-content-subtle">{profile.conceptCount} core concepts</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* HUMAN FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 space-y-3">
          <span className="type-eyebrow text-proof">Frequently Asked Questions</span>
          <h2 className="type-display text-[clamp(2rem,3.2vw,2.75rem)]">Everything You Need to Know</h2>
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
          <span className="cx-pill mx-auto">Start Your Practice Today</span>
          <h2 className="type-hero text-stone-50 text-[clamp(2.25rem,4vw,3.5rem)]">
            Ready to Build Your Mathematical Edge?
          </h2>
          <p className="type-lead text-stone-300 max-w-[50ch] mx-auto">
            Take the free diagnostic placement test. No account required to see your detailed skill breakdown.
          </p>
          <m.button
            onClick={onRegister}
            whileTap={{ scale: 0.97 }}
            className="cx-btn cx-btn-fill px-8 py-4 text-[17px] shadow-lg mx-auto"
          >
            <span>Take Diagnostic Test</span>
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
