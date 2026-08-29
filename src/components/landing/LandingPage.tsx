/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The landing page.
 *
 * An editorial argument in eight numbered sections, set the way the rest of the
 * product is: flush-left display type over justified columns, structure carried
 * by hairlines, colour applied as stroke. Dark bands mark the three moments the
 * page raises its voice — the hero, the analytics section, and the close.
 *
 * The rule the whole page follows: nothing here is a mock-up of data. The
 * domain tiles, the difficulty ladder and the item counts are read from
 * `ITEM_BANK` through `skillGraph`, the two model plots are drawn by calling
 * `probCorrect` and `itemInformation` — the functions the placement test itself
 * runs on — and the live counters come from the server that is running. A page
 * whose entire pitch is "we measure honestly" cannot open with a picture of
 * measurements that were never taken, and the numbers being small is the point
 * rather than a thing to be hidden.
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  Activity, ArrowRight, BookOpen, LayoutDashboard, MessageSquare,
  Settings, TrendingUp, Trophy, User,
} from 'lucide-react';
import { AnimatedNumber } from '../motion';
import { MAX_ITEMS, MIN_ITEMS, TARGET_SEM } from '../../lib/irt';
import { bankSummary, domainBankProfiles } from '../../lib/skillGraph';
import { TOPIC_META } from '../../lib/topics';
import type { Topic } from '../../types';
import { BankSpread, InformationPlot, ItemCurvesPlot } from './plots';
import InteractiveRiddleStage from './InteractiveRiddleStage';
/*
 * three.js is code-split, and that is not a micro-optimisation.
 *
 * It is ~150KB gzipped and it is used by exactly one element on one page —
 * which a signed-in learner never loads. Imported statically it landed in the
 * main chunk, so every launch of the app, including the iOS build where the
 * bundle ships inside the container, paid for a hero graph it would never
 * render. Behind `lazy()` it becomes its own chunk that is fetched only when
 * this page mounts.
 */
const SkillGraphStage = lazy(() => import('./SkillGraphStage'));

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

const NAV_LINKS = [
  { label: 'Engine', href: '#engine' },
  { label: 'Item bank', href: '#bank' },
  { label: 'Product', href: '#product' },
  { label: 'Research', href: '#research' },
  { label: 'Community', href: '#community' },
  { label: 'Pricing', href: '#pricing' },
];

const BANK = bankSummary();
const DOMAIN_PROFILES = domainBankProfiles();

/** What each domain covers, for the four tiles under section 02. */
const DOMAIN_SCOPE: Record<Topic, string> = {
  Algebra: 'Functional equations, inequalities, polynomial roots',
  Geometry: 'Circles, similarity, coordinate and synthetic proof',
  Combinatorics: 'Counting, bijections, pigeonhole, recursion',
  'Number Theory': 'Modular arithmetic, divisibility, Diophantine forms',
};

const PRODUCT_TILES = [
  { icon: LayoutDashboard, topic: 'Algebra' as Topic, title: 'Dashboard', body: 'Your skill map, your streak, and one clear suggestion for what to do next.' },
  { icon: BookOpen, topic: 'Geometry' as Topic, title: 'Learn', body: 'Practice that adjusts as you go, hints one step at a time, written answers the AI reads.' },
  { icon: Trophy, topic: 'Combinatorics' as Topic, title: 'Compete', body: 'Timed mock contests, a weekly challenge, and a four-way leaderboard.' },
  { icon: TrendingUp, topic: 'Number Theory' as Topic, title: 'Progress', body: 'How far you have come, how fast you are moving, and where you are heading.' },
  { icon: MessageSquare, topic: 'Algebra' as Topic, title: 'Community', body: 'Discussion attached to each problem — students, mentors, moderators.' },
  { icon: User, topic: 'Geometry' as Topic, title: 'Profile', body: 'Your achievements, your level, and where you stand.' },
  { icon: Activity, topic: 'Combinatorics' as Topic, title: 'Research', body: 'The full working behind your score, if you want to check it.' },
  { icon: Settings, topic: 'Number Theory' as Topic, title: 'Settings', body: 'Preferences and session control.' },
];

const COMPARISON = [
  { axis: 'How it adapts', ours: 'Measures your level and how sure it is', heuristic: 'Right, so harder. Wrong, so easier.', static_: "It doesn't" },
  { axis: 'Score reported', ours: 'A score, plus how precise it is', heuristic: 'A score, with no idea how precise', static_: 'Percent correct' },
  { axis: 'Test length', ours: 'Ends as soon as the score is precise', heuristic: 'Fixed, or open-ended', static_: 'Fixed' },
  { axis: 'Skill profile', ours: 'Covers every topic by design', heuristic: 'Drifts into one topic and stays there', static_: 'Whatever the set covers' },
  { axis: 'When data is thin', ours: 'Says so, and labels the confidence', heuristic: 'Shows a number anyway', static_: 'Not applicable' },
];

const FAQ = [
  { q: 'Is this a finished product?', a: 'Not yet. The engine and question bank are real; the leaderboard, contests and discussions are sample data.' },
  { q: 'Do I need an API key?', a: 'No. Without one you get shorter, rule-based feedback instead of written explanations. Everything else works the same.' },
  { q: 'How long is the placement test?', a: `Between ${MIN_ITEMS} and ${MAX_ITEMS} questions. It ends as soon as your score is precise enough.` },
  { q: 'Is my progress saved?', a: 'Yes, once you have an account — every graded answer is tied to it rather than to the browser.' },
  { q: 'Does the demo work everywhere?', a: 'The public demo has no server, so the AI tutor is off there. Everything else runs.' },
  { q: 'Can I run it myself?', a: 'Yes. Node 20 to 22, three commands, no configuration required.' },
];

/**
 * A tracked section kicker: `01 — THE ADAPTIVE ENGINE`.
 *
 * Every section opens with one, and it is the only piece of furniture holding
 * the editorial structure together above a flush-left display line.
 */
function SectionHead({
  index, kicker, title, standfirst, tone = 'light', accent,
}: {
  index: string;
  kicker: string;
  title: string;
  standfirst: string;
  tone?: 'light' | 'dark';
  accent?: string;
}) {
  return (
    <div
      className={`grid items-end gap-8 border-b pb-8.5 lg:[grid-template-columns:minmax(0,0.62fr)_minmax(0,1fr)] ${
        tone === 'dark' ? 'border-[rgba(231,226,217,0.18)]' : 'border-line'
      }`}
    >
      <div>
        <p className="type-eyebrow" style={accent ? { color: accent } : undefined}>
          {index} &mdash; {kicker}
        </p>
        <h2 className={`type-display mt-3.5 ${tone === 'dark' ? 'text-stone-50' : ''}`}>{title}</h2>
      </div>
      {/*
        Justified, because this is the one place the page sets a real column of
        prose and the flush-right edge is what makes it read as a page rather
        than as a caption.
      */}
      <p className={`type-lead text-justify ${tone === 'dark' ? 'text-stone-400' : 'text-content-muted'}`}>
        {standfirst}
      </p>
    </div>
  );
}

/** A live server counter. Zero is a real answer and is shown as one. */
function LiveStat({ label, value, note, tint }: { label: string; value: number; note: string; tint: string }) {
  return (
    <div>
      <span className="type-eyebrow block text-stone-500 tracking-[0.18em]">{label}</span>
      <span className="mt-2.5 block font-serif text-[44px] leading-none text-stone-50 tnum">
        <AnimatedNumber value={value} />
      </span>
      <span className="mt-2 block text-[11px] tracking-[0.08em]" style={{ color: tint }}>{note}</span>
    </div>
  );
}

export default function LandingPage({ liveStats, onSignIn, onRegister }: LandingPageProps) {
  const prefersReduced = useReducedMotion();
  const still = prefersReduced === true;
  const progressRef = useRef<HTMLDivElement>(null);

  /*
   * The scroll hairline across the top.
   *
   * Written straight to `style.width` from a passive scroll listener rather
   * than held in React state: this fires on every frame of every scroll, and a
   * state update per frame would re-render the entire page — eight sections and
   * three SVG plots — to move one element four pixels.
   */
  useEffect(() => {
    const onScroll = () => {
      const bar = progressRef.current;
      if (!bar) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${(max > 0 ? Math.min(1, window.scrollY / max) : 0) * 100}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /*
   * The hovered domain in the bank tiles, which drives the readout beneath
   * them. `null` is the resting state and says so, rather than pretending a
   * domain is selected.
   */
  const [activeDomain, setActiveDomain] = useState<Topic | null>(null);
  const active = activeDomain ? DOMAIN_PROFILES.find((d) => d.domain === activeDomain) ?? null : null;
  /*
   * The hero graph and the §02 tiles drive the same `activeDomain`, but they
   * are two screens apart — so the hero reads it only while it is the thing
   * being pointed at. Without this, hovering a tile far down the page would
   * silently change a panel nobody can see, and scrolling back up would show a
   * selection the reader never made.
   */
  const heroActive = active;

  return (
    <div className="cx-ground min-w-0 overflow-x-hidden font-sans text-content antialiased">
      {/* Scroll progress — a 2px hairline in the four domain hues. */}
      <div className="pointer-events-none fixed top-0 left-0 z-80 h-0.5 w-full">
        <div
          ref={progressRef}
          className="h-full w-0 origin-left"
          style={{ background: 'linear-gradient(90deg,#c8842a,#2f9c8c 38%,#8b5cf6 68%,#0ea5e9)' }}
        />
      </div>

      <header className="sticky top-0 z-70 border-b border-line bg-surface/86 backdrop-blur-[10px]">
        <div className="mx-auto flex h-17 max-w-[73.75rem] items-center justify-between gap-6 px-7">
          <a href="#top" className="flex items-center gap-3 text-content no-underline">
            <span className="cx-mark h-8.5 w-8.5 text-[22px]">&#8721;</span>
            <span className="flex flex-col leading-[1.15]">
              <span className="font-serif text-[19px] tracking-[0.02em]">CalculixHub</span>
              {/*
                The tracked sub-line needs ~10rem to stay on one line, which a
                375px header does not have once the mark and the CTA are placed.
                It is decoration on the brand, so it stands down rather than
                wrapping to two lines and making the bar 20px taller.
              */}
              <span className="type-eyebrow hidden text-content-subtle sm:block">Math OS Platform</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6.5 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="type-eyebrow tracking-[0.14em] text-content-muted no-underline transition-colors duration-160 ease-standard hover:text-accent"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3.5">
            <button
              onClick={onSignIn}
              className="type-eyebrow hidden tracking-[0.1em] text-content-muted transition-colors duration-160 ease-standard hover:text-accent sm:block cursor-pointer"
            >
              Sign in
            </button>
            <button onClick={onRegister} className="cx-btn cx-btn-primary px-4.5 py-2.25 text-[15px]">
              Placement test
            </button>
          </div>
        </div>
      </header>

      {/* ───────────── HERO ───────────── */}
      <section id="top" className="ramp-static cx-band">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(58% 52% at 68% 38%, rgba(200,132,42,.24), transparent 70%),' +
              'radial-gradient(42% 38% at 14% 82%, rgba(47,156,140,.18), transparent 70%),' +
              'radial-gradient(38% 34% at 92% 82%, rgba(139,92,246,.16), transparent 70%),' +
              'radial-gradient(34% 30% at 34% 8%, rgba(14,165,233,.12), transparent 70%)',
          }}
        />

        <div className="relative mx-auto grid max-w-[73.75rem] items-center gap-14 px-7 pt-24 lg:[grid-template-columns:minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <div>
            <p className="cx-pill bg-azure-400/10 border-azure-400/30 text-azure-400">
              <span className="relative inline-block h-2 w-2">
                {!still && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-azure-400 opacity-75" />
                )}
                <span className="absolute inset-0 rounded-full bg-azure-400" />
              </span>
              QUANTUM ADAPTIVE KERNEL V2.0
            </p>

            <h1 className="type-hero mt-6.5 text-stone-50 text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.08] font-serif">
              Master Structural Proofs.
              <br />
              <span className="italic text-azure-400">The Quantum Calculus OS.</span>
            </h1>

            <p className="type-lead mt-6.5 max-w-[52ch] text-stone-300">
              Legacy platforms rely on static question sets. CalculixHub measures your latent mathematical ability via 3PL Item Response Theory and adjusts in real time.
            </p>

            <div className="mt-8.5 flex flex-wrap gap-3.5">
              <m.button
                onClick={onRegister}
                whileTap={{ scale: 0.97 }}
                className="cx-btn cx-btn-fill px-6.5 py-3.5 text-[17px]"
              >
                Take the free placement test <ArrowRight className="h-3.75 w-3.75" />
              </m.button>
              <a href="#engine" className="cx-btn cx-btn-on-dark px-6 py-3.5 text-[17px] no-underline">
                Read the method
              </a>
            </div>

            <div className="type-eyebrow mt-11 flex flex-wrap gap-x-8.5 gap-y-2 border-t border-[rgba(231,226,217,0.16)] pt-6.5 text-[11px] tracking-[0.16em] text-stone-500">
              <span>{BANK.itemCount} calibrated items</span>
              <span>{BANK.domainCount} domains</span>
              <span>{BANK.sources[0]} &rarr; {BANK.sources[BANK.sources.length - 1]}</span>
              <span>MIT licensed</span>
            </div>
          </div>

          {/*
            The centrepiece: the bank as a turnable object.

            Its four nodes are the four domains and they carry the real item
            counts, so hovering one is a query against `domainBankProfiles()`
            rather than a hover state on a decoration — the panel underneath is
            where the answer lands.
          */}
          <div className="min-w-0">
            {/*
              The fallback is a reserved box, not a spinner and not the SVG
              plot. Both of those would settle at a different height and shove
              the readout panel down the moment the chunk arrived; an empty box
              of the graph's exact height means the layout is final before the
              first byte of three.js lands.
            */}
            <Suspense fallback={<div className="h-[clamp(23.75rem,46vw,35rem)] w-full" aria-hidden="true" />}>
              <SkillGraphStage onActiveChange={setActiveDomain} still={still} />
            </Suspense>

            <div className="rounded-card border border-[rgba(231,226,217,0.18)] bg-[rgba(20,17,14,0.6)] px-5 py-4.5 backdrop-blur-[6px]">
              <div className="type-eyebrow mb-2 flex items-baseline justify-between gap-4 text-stone-500 tracking-[0.18em]">
                <span>Adaptive item bank</span>
                <span className="text-azure-400">{BANK.sources.join(' / ')}</span>
              </div>
              <p aria-live="polite" className="min-h-[3.4em] text-[13.5px] leading-[1.65] text-stone-300">
                {heroActive ? (
                  <>
                    <strong
                      className="font-serif text-[16px] font-medium"
                      style={{ color: TOPIC_META[heroActive.domain as Topic].vars['--cx-hue'] }}
                    >
                      {heroActive.domain}
                    </strong>
                    {' — '}
                    {heroActive.itemCount} calibrated items spanning {heroActive.sources[0]} through{' '}
                    {heroActive.sources[heroActive.sources.length - 1]}, across {heroActive.conceptCount} tagged
                    concepts. Mean discrimination {heroActive.meanDiscrimination.toFixed(2)}.
                  </>
                ) : (
                  <>
                    <strong className="font-serif text-[16px] font-medium text-azure-400">Adaptive bank</strong>
                    {' — '}
                    hover a node in the graph. Every figure here is measured from the bank the placement test will
                    administer, not from a visitor who has not yet answered a question.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Live system status */}
        <div className="relative mx-auto max-w-[73.75rem] px-7 pt-18 pb-16">
          <p className="type-eyebrow mb-5 text-stone-500">Live system status</p>
          <div className="grid gap-x-7 gap-y-8 border-t border-[rgba(231,226,217,0.16)] pt-6 sm:grid-cols-3">
            <LiveStat label="Learners active" value={liveStats.activeUsers} note="Last 15 minutes" tint="#4fb8a8" />
            <LiveStat label="Assessments run" value={liveStats.testsCompleted} note="Since restart" tint="#e1ad66" />
            <LiveStat label="Problems graded" value={liveStats.problemsSolved} note="Since restart" tint="#a78bfa" />
          </div>
          <p className="mt-5.5 max-w-[70ch] text-[12px] leading-[1.7] text-stone-500">
            Counted by the server running right now, so they reset on every deploy. A real zero beats a made-up number.
          </p>
        </div>
      </section>

      {/* ───────────── 01 THE ENGINE ───────────── */}
      <section id="engine" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <SectionHead
          index="01"
          kicker="The adaptive engine"
          title="How the test works out your level"
          standfirst="Scoring happens in your browser — no waiting, works offline. Here is what it does while you answer."
          accent="var(--ac)"
        />

        <div className="mt-10">
          <InteractiveRiddleStage onRegister={onRegister} />
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          <article className="cx-card cx-tint-algebra px-7 pt-7 pb-8">
            <p className="type-eyebrow text-amber-600">Response model</p>
            <h3 className="type-title mt-2.5 text-[24px]">Every question is measured first</h3>
            <p className="my-4 border-y border-line-faint py-4 text-[14px] text-content-muted tnum">
              P(&theta;) = c + (1&minus;c) / (1 + e<sup>&minus;1.7a(&theta;&minus;b)</sup>)
            </p>
            <p className="type-body text-justify text-content-muted">
              Each question carries three numbers: how hard it is, how well it separates students, and how easily it is
              guessed. That last one matters — a test that ignores luck will think you are better than you are.
            </p>
          </article>

          <article className="cx-card cx-tint-geometry px-7 pt-7 pb-8">
            <p className="type-eyebrow text-proof">Ability estimation</p>
            <h3 className="type-title mt-2.5 text-[24px]">It never jumps to conclusions</h3>
            <p className="my-4 border-y border-line-faint py-4 text-[13px] tracking-[0.04em] text-content-muted tnum">
              Starts from the average student &middot; 81 checkpoints &middot; range &minus;4 to +4
            </p>
            <p className="type-body text-justify text-content-muted">
              It starts by assuming you are average, then moves from there. Simpler methods break when you get
              everything right or everything wrong — exactly what happens early on. This one holds steady from answer
              one.
            </p>
          </article>

          <article className="cx-card cx-tint-combinatorics px-7 pt-7 pb-8">
            <p className="type-eyebrow text-violet-600">Item selection</p>
            <h3 className="type-title mt-2.5 text-[24px]">It picks the most useful next question</h3>
            <p className="my-4 border-y border-line-faint py-4 text-[14px] text-content-muted tnum">
              I(&theta;) = (1.7a)<sup>2</sup> &middot; (1&minus;P)/P &middot; ((P&minus;c)/(1&minus;c))<sup>2</sup>
            </p>
            <p className="type-body text-justify text-content-muted">
              Each question is the one that tells us most right now. Chasing that alone would trap you in one topic, so
              the least-tested topics go first, and the best question comes from those.
            </p>
          </article>
        </div>

        <div className="mt-18 grid items-start gap-14 lg:grid-cols-2">
          <div>
            <h3 className="type-title text-[26px]">The test stops when it is confident</h3>
            <p className="type-body mt-1.5 mb-5 text-content-muted">
              No fixed length. It runs until the score is precise enough, then stops.
            </p>
            <table className="cx-table">
              <tbody>
                <tr>
                  <td className="tracking-[0.06em]">MIN_ITEMS</td>
                  <td className="text-right text-accent-text tnum">{MIN_ITEMS}</td>
                  <td className="pl-5.5 text-[13.5px] text-content-subtle">Fewest you will get</td>
                </tr>
                <tr>
                  <td className="tracking-[0.06em]">MAX_ITEMS</td>
                  <td className="text-right text-accent-text tnum">{MAX_ITEMS}</td>
                  <td className="pl-5.5 text-[13.5px] text-content-subtle">Most you will get</td>
                </tr>
                <tr>
                  <td className="tracking-[0.06em]">TARGET_SEM</td>
                  <td className="text-right text-accent-text tnum">{TARGET_SEM}</td>
                  <td className="pl-5.5 text-[13.5px] text-content-subtle">Precision needed to stop</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="min-w-0">
            <h3 className="type-title text-[26px]">What one question tells us</h3>
            <p className="type-body mt-1.5 mb-5 text-content-muted">
              Three real items from the bank, drawn by calling the same `probCorrect` the test runs on.
            </p>
            <div className="text-content"><ItemCurvesPlot /></div>
          </div>
        </div>

        <div className="mt-14 min-w-0">
          <h3 className="type-title text-[26px]">Where the bank measures best</h3>
          <p className="type-body mt-1.5 mb-5 max-w-[62ch] text-content-muted">
            Information peaks near &theta; &asymp; b, so a question is most useful when its difficulty sits at your
            current estimate.
          </p>
          <div className="text-content"><InformationPlot /></div>
        </div>
      </section>

      {/* ───────────── 02 THE ITEM BANK ───────────── */}
      <section id="bank" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <SectionHead
          index="02"
          kicker="The item bank"
          title={`${BANK.itemCount} items, every one calibrated`}
          standfirst={`${BANK.itemCount} is small and we say so — enough to run the engine, not a curriculum. Each question is tagged with the exact idea it tests, which is how we know what to send you next.`}
          accent="var(--ac)"
        />

        <div className="mt-13 grid gap-4.5 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
          {DOMAIN_PROFILES.map((profile) => {
            const meta = TOPIC_META[profile.domain as Topic];
            return (
              <button
                key={profile.domain}
                type="button"
                onMouseEnter={() => setActiveDomain(profile.domain as Topic)}
                onFocus={() => setActiveDomain(profile.domain as Topic)}
                onMouseLeave={() => setActiveDomain(null)}
                onBlur={() => setActiveDomain(null)}
                className={`cx-card ${meta.tint} px-6 pt-6.5 pb-7.5 text-left transition-[background-color] duration-240 ease-standard cursor-pointer`}
              >
                <span className="mb-4.5 block h-0.5 w-6.5" style={{ background: meta.vars['--cx-hue'] }} />
                <span className="block font-serif text-[62px] leading-none tnum">{profile.itemCount}</span>
                <span className="type-eyebrow mt-2.5 mb-2 block tracking-[0.18em] text-content">{meta.label}</span>
                <span className="block text-[13.5px] leading-[1.6] text-content-subtle">
                  {DOMAIN_SCOPE[profile.domain as Topic]}
                </span>
              </button>
            );
          })}
        </div>

        {/*
          The readout under the tiles. Its resting state names itself as the
          resting state rather than showing the first domain's numbers, which
          would read as a selection nobody made.
        */}
        <p aria-live="polite" className="type-body mt-6 min-h-[3.4em] max-w-[76ch] text-content-muted">
          {active ? (
            <>
              <span className="font-serif text-[17px]" style={{ color: TOPIC_META[active.domain as Topic].vars['--cx-hue-text'] }}>
                {active.domain}
              </span>
              {' — '}
              {active.itemCount} calibrated items spanning {active.sources[0]} through{' '}
              {active.sources[active.sources.length - 1]}, across {active.conceptCount} tagged concepts. Mean
              discrimination {active.meanDiscrimination.toFixed(2)}.
            </>
          ) : (
            <>
              <span className="font-serif text-[17px] text-accent-text">Adaptive bank</span>
              {' — '}
              hover a domain. Every figure here is measured from the bank the placement test will administer, not from
              a visitor who has not yet answered a question.
            </>
          )}
        </p>

        <div className="mt-16 min-w-0">
          <p className="type-eyebrow mb-5.5 text-content-subtle">Easiest to hardest</p>
          <div className="text-content"><BankSpread /></div>
        </div>
      </section>

      {/* ───────────── 03 THE PRODUCT ───────────── */}
      <section id="product" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <SectionHead
          index="03"
          kicker="The product matrix"
          title="Eight specialized labs, driven by one adaptive kernel"
          standfirst="The placement assessment is only the entryway. Your evaluated ability matrix dynamically orchestrates your study path, contest tier, and targeted concept reinforcement."
          accent="var(--hu-violet-600)"
        />

        {/* Asymmetrical Bento Grid */}
        <div className="mt-13 grid grid-cols-1 md:grid-cols-12 gap-5">
          {PRODUCT_TILES.map((tile, idx) => {
            const Icon = tile.icon;
            const meta = TOPIC_META[tile.topic];
            const spans = [
              'md:col-span-8',
              'md:col-span-4',
              'md:col-span-4',
              'md:col-span-8',
              'md:col-span-6',
              'md:col-span-6',
              'md:col-span-4',
              'md:col-span-8',
            ];
            const spanClass = spans[idx % spans.length];

            return (
              <article
                key={tile.title}
                className={`cx-card-quantum ${spanClass} p-8 flex flex-col justify-between group cursor-pointer hover:-translate-y-1 hover:shadow-2xl`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken border border-line-faint">
                      <Icon className="h-4.5 w-4.5" style={{ color: meta.vars['--cx-hue'] }} />
                    </div>
                    <span className="cx-tag cx-tag-neutral text-[9px] uppercase tracking-widest">{tile.topic}</span>
                  </div>
                  <h3 className="type-title text-[24px] font-medium group-hover:text-accent transition-colors duration-160">
                    {tile.title}
                  </h3>
                  <p className="type-body mt-2.5 leading-[1.65] text-content-muted">{tile.body}</p>
                </div>
                <div className="mt-6 border-t border-line-faint pt-4 flex items-center justify-between">
                  <span className="type-eyebrow text-[10px] text-content-subtle">Explore module</span>
                  <span className="cx-btn-pill-icon">↗</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ───────────── 04 ANALYTICS & AI ───────────── */}
      <section id="research" className="ramp-static cx-band mt-27">
        <div className="cx-band__wash" aria-hidden="true" />
        <div className="relative mx-auto max-w-[73.75rem] px-7 py-24">
          <SectionHead
            index="04"
            kicker="Analytics &amp; AI"
            title="If we do not know yet, we say so"
            standfirst="A trend drawn from two days of data is labelled as exactly that, and anything we cannot measure yet shows as zero. It is the rule the whole analytics side runs on."
            tone="dark"
            accent="#e1ad66"
          />

          <div className="mt-13 grid gap-x-14 sm:grid-cols-2">
            {[
              ['Error classification', 'Wrong and slow usually means you never learned the method. Wrong but mostly right means you know it and slipped in the arithmetic. Different problems, different fixes.'],
              ['Forecasting', 'We project where you are heading and say how confident we are. You are ranked on speed, accuracy, consistency and improvement, and your plan starts with your weakest topic at the level you actually reached there.'],
              ['The AI layer', 'The tutor asks questions instead of handing over answers, and runs entirely on our server.'],
              ['Graceful degradation', 'With the AI off, everything still works — shorter feedback instead of written explanations.'],
            ].map(([title, body], i) => (
              <div key={title} className={i < 2 ? 'border-b border-[rgba(231,226,217,0.12)] pb-6.5' : 'pt-6.5'}>
                <h3 className="type-title text-[23px] text-stone-50">{title}</h3>
                <p className="type-body mt-2 text-justify text-stone-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 05 COMMUNITY ───────────── */}
      <section id="community" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <div className="grid items-start gap-16 lg:[grid-template-columns:minmax(0,1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="type-eyebrow text-proof">05 &mdash; Community</p>
            <h2 className="type-display mt-3.5 text-[clamp(2.125rem,3.4vw,3rem)]">
              You learn a problem by arguing about it
            </h2>
            <p className="type-lead mt-5 text-justify text-content-muted">
              Every discussion sits on the problem it belongs to, so a solution and the argument about it stay together.
            </p>
            <p className="type-lead mt-4.5 text-justify text-content-muted">
              The leaderboard ranks on four things: speed, accuracy, consistency, improvement. Someone who keeps
              improving and someone who was always fast are not the same student.
            </p>
          </div>

          <div className="cx-card cx-tint-geometry">
            <div className="type-eyebrow flex justify-between border-b border-line-faint px-5 py-4 text-content-subtle">
              <span>Thread &middot; AIME 2019 II Problem 9</span>
              <span className="text-accent-text">2 replies</span>
            </div>
            <div className="border-b border-line-faint p-5">
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="font-serif text-[17px]">Mai N.</span>
                <span className="cx-tag cx-tag-accent text-[9px] tracking-[0.16em]">Mentor</span>
              </div>
              <p className="type-caption leading-[1.7] text-content-muted">
                Before counting, ask what the pigeonhole is doing here. If you can name the boxes, the bound writes
                itself.
              </p>
            </div>
            <div className="p-5">
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="font-serif text-[17px]">Tuan P.</span>
                <span className="cx-tag cx-tag-neutral text-[9px] tracking-[0.16em]">Student</span>
              </div>
              <p className="type-caption leading-[1.7] text-content-muted">
                That was the gap — I had the boxes as residues instead of as pairs. Re-ran it and the bound falls out in
                one line.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── 06 POSITIONING ───────────── */}
      <section id="compare" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <p className="type-eyebrow text-sky-700">06 &mdash; Positioning</p>
        <h2 className="type-display mt-3.5 mb-10 max-w-[22ch] text-[clamp(2.125rem,3.4vw,3rem)]">
          How this is different
        </h2>

        {/* The one table wide enough to need its own scroller on a phone. */}
        <div className="overflow-x-auto">
          <table className="cx-table min-w-[44rem]">
            <thead>
              <tr>
                <th className="w-[26%]" />
                <th className="border-b-2 border-b-accent px-5.5 text-[18px] text-accent-text">CalculixHub</th>
                <th className="border-b-2 border-b-proof/50 px-5.5 text-[18px] text-content-muted">Heuristic adaptive apps</th>
                <th className="border-b-2 border-b-violet-500/45 pl-5.5 text-[18px] text-content-muted">Static problem sets</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.axis}>
                  <td className="type-eyebrow py-4 tracking-[0.16em] text-content-subtle">{row.axis}</td>
                  <td className="bg-accent/6 px-5.5 py-4">{row.ours}</td>
                  <td className="px-5.5 py-4 text-content-muted">{row.heuristic}</td>
                  <td className="py-4 pl-5.5 text-content-muted">{row.static_}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────────── 07 ACCESS ───────────── */}
      <section id="pricing" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <div className="flex flex-wrap items-end justify-between gap-10 border-b border-line pb-8.5">
          <div>
            <p className="type-eyebrow text-accent-text">07 &mdash; Access</p>
            <h2 className="type-display mt-3.5 text-[clamp(2.125rem,3.4vw,3rem)]">Free, for now and for everyone</h2>
          </div>
          <p className="type-body max-w-[44ch] text-content-muted">
            Everything works today, free. The two plans beside it are planned, not for sale.
          </p>
        </div>

        <div className="mt-11 grid gap-6 lg:grid-cols-3">
          <div className="cx-card cx-tint-algebra flex flex-col px-7 py-8">
            <p className="type-eyebrow text-accent-text">Available now</p>
            <h3 className="type-title mt-1.5 text-[28px]">Individual</h3>
            <p className="mt-3.5 mb-5.5 font-serif text-[46px] leading-none">Free</p>
            <ul className="mb-7 flex list-none flex-col gap-2.75 p-0 text-[14.5px] leading-[1.6] text-content-muted">
              {['Full adaptive placement test', 'All eight product sections', 'Full working behind every score', 'Run your own copy, open source'].map((item) => (
                <li key={item} className="relative pl-4.5">
                  <span className="absolute left-0 text-accent">&mdash;</span>{item}
                </li>
              ))}
            </ul>
            <button onClick={onRegister} className="cx-btn cx-btn-primary cx-btn-block mt-auto py-3">
              Start the placement test
            </button>
          </div>

          {[
            { tone: 'cx-tint-geometry', kicker: 'text-proof', name: 'Cohort', items: ['Class rosters and shared item banks', 'Teacher view of each student by topic', 'Contest scheduling by tier'] },
            { tone: 'cx-tint-combinatorics', kicker: 'text-violet-600', name: 'Research', items: ['Export every answer for analysis', 'Recalibrate questions on your own data', 'See which mistakes repeat across a class'] },
          ].map((plan) => (
            <div key={plan.name} className={`cx-card ${plan.tone} flex flex-col px-7 py-8`}>
              <p className={`type-eyebrow ${plan.kicker}`}>Planned</p>
              <h3 className="type-title mt-1.5 text-[28px]">{plan.name}</h3>
              <p className="mt-3.5 mb-5.5 font-serif text-[46px] leading-none text-content-subtle">&mdash;</p>
              <ul className="mb-7 flex list-none flex-col gap-2.75 p-0 text-[14.5px] leading-[1.6] text-content-muted">
                {plan.items.map((item) => (
                  <li key={item} className="relative pl-4.5">
                    <span className="absolute left-0 text-content-subtle">&mdash;</span>{item}
                  </li>
                ))}
              </ul>
              {/*
                Not a button. There is nothing to press, and a disabled control
                that looks pressable is a worse answer than a sentence.
              */}
              <span className="cx-btn cx-btn-inert cx-btn-block mt-auto cursor-default py-3">Not open yet</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── 08 QUESTIONS ───────────── */}
      <section id="faq" className="mx-auto max-w-[73.75rem] px-7 pt-27">
        <p className="type-eyebrow text-proof">08 &mdash; Questions</p>
        <h2 className="type-display mt-3.5 mb-11 max-w-[20ch] text-[clamp(2.125rem,3.4vw,3rem)]">
          What you should know before signing up
        </h2>
        <div className="grid gap-x-14 sm:grid-cols-2">
          {FAQ.map((item, i) => (
            <div key={item.q} className={`py-6.5 ${i < 2 ? 'border-t border-line' : 'border-t border-line-faint'}`}>
              <h3 className="type-title text-[21px]">{item.q}</h3>
              <p className="type-caption mt-2 text-justify leading-[1.75] text-content-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── CLOSE ───────────── */}
      <section id="start" className="ramp-static cx-band mt-27">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: 'radial-gradient(50% 70% at 50% 0%, rgba(182,130,53,.16), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[73.75rem] px-7 py-26 text-center">
          <h2 className="type-hero mx-auto text-stone-50">Find out where you actually are.</h2>
          <p className="type-lead mx-auto mt-5.5 mb-9 max-w-[56ch] text-stone-400">
            {MIN_ITEMS} to {MAX_ITEMS} questions. No account needed to see your result.
          </p>
          <m.button
            onClick={onRegister}
            whileTap={{ scale: 0.97 }}
            className="cx-btn cx-btn-fill mx-auto px-8 py-4 text-[18px]"
          >
            Take the free placement test <ArrowRight className="h-4 w-4" />
          </m.button>
        </div>
      </section>

      <footer className="ramp-static border-t border-[rgba(231,226,217,0.14)] bg-ink-950 text-stone-500">
        <div className="mx-auto grid max-w-[73.75rem] gap-12 px-7 pt-16 pb-7 lg:[grid-template-columns:minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="cx-mark h-8.5 w-8.5 text-[22px]">&#8721;</span>
              <span className="font-serif text-[19px] text-stone-300">CalculixHub</span>
            </div>
            <p className="max-w-[36ch] text-[13.5px] leading-[1.75]">
              For students who want to actually get better at mathematics.
            </p>
          </div>

          {[
            { head: 'Platform', links: [['Adaptive engine', '#engine'], ['Item bank', '#bank'], ['Product tour', '#product'], ['Analytics', '#research']] },
            { head: 'Project', links: [['Repository', 'https://github.com/gmtigrisva123/CalculixHub'], ['Status & caveats', '#faq'], ['Roadmap', '#pricing']] },
          ].map((col) => (
            <div key={col.head}>
              <p className="type-eyebrow mb-4 text-stone-600">{col.head}</p>
              <div className="flex flex-col gap-2.5 text-[13.5px]">
                {col.links.map(([label, href]) => (
                  <a key={label} href={href} className="text-stone-500 no-underline transition-colors duration-160 ease-standard hover:text-stone-300">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="type-eyebrow mb-4 text-stone-600">Stack</p>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-stone-600">
              <span>React 19 &middot; Vite 6</span>
              <span>Express 4 &middot; Gemini</span>
              <span>KaTeX &middot; Tailwind 4</span>
              <span>MIT licensed</span>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[73.75rem] flex-wrap justify-between gap-4 border-t border-[rgba(231,226,217,0.1)] px-7 pt-5.5 pb-11 text-[11.5px] tracking-[0.06em] text-stone-600">
          <span>&copy; 2026 The-Calculix. Released under the MIT License.</span>
          <span>Counters are per-instance operational signal, not audited telemetry.</span>
        </div>
      </footer>
    </div>
  );
}
