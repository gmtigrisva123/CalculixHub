/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { LogOut } from 'lucide-react';
import { UserStats, Problem } from '../../shared/types';
import { TOPIC_META, getRankForPoints, nextRankFor } from '../lib/topics';
import { spring } from '../lib/motion';
import { AnimatedNumber, StaggerItem } from './motion';
import { useAuth } from '../context/AuthContext';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
}

export default function Profile({ userStats, completedProblems, problems, onLogout }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const rank = getRankForPoints(userStats.points);
  /*
   * The learner's name comes from their profile row.
   *
   * It used to be read from `calculix_user_name` in session or local storage.
   * Nothing has written that key since accounts moved into Postgres -- it is
   * only read, here and in Compete, and deleted on sign-out -- so the lookup
   * always missed and every signed-in learner saw the placeholder instead of
   * their own name. The profile has carried the real value the whole time;
   * App.tsx was already reading it correctly for the sidebar.
   */
  const { profile } = useAuth();
  const displayName = profile?.display_name || profile?.username || 'Calculix Student';

  /*
   * The account rows are read-only.
   *
   * The design puts a Change / Edit / Update control on each of these. They are
   * omitted rather than rendered inert: a button that looks live and does
   * nothing is worse than no button, and none of these flows exists yet —
   * email and password changes go through Supabase and have not been built.
   */
  const accountRows = [
    { label: 'Display name', value: displayName },
    { label: 'Username', value: profile?.username ? `@${profile.username}` : 'Not set' },
    { label: 'Member since', value: profile?.created_at ? profile.created_at.slice(0, 10) : 'Unknown' },
    { label: 'Country', value: profile?.country ?? 'Not set' },
  ];

  const badges = [
    { id: 'b1', title: 'Getting Started', desc: 'Joined CalculixHub', unlocked: true, icon: '🌱' },
    { id: 'b2', title: 'Algebra Reflex', desc: 'Reach 50 total points', unlocked: userStats.points >= 50, icon: '📐' },
    { id: 'b3', title: 'Combinatorics Warrior', desc: 'Master discrete math (60%+)', unlocked: userStats.skills.Combinatorics >= 60, icon: '🎲' },
    { id: 'b4', title: 'Leaderboard Breaker', desc: 'Cross 250 cumulative points', unlocked: userStats.points >= 250, icon: '🏆' },
    { id: 'b5', title: 'Unbreakable Streak', desc: 'Hit a 3-day activity streak', unlocked: userStats.streak >= 3, icon: '🔥' },
  ];

  const nextTier = nextRankFor(userStats.points);

  return (
    <div className="space-y-8.5">
      {/*
        The summary band.

        Four figures on one hairline rule, closed top and bottom — the design's
        answer to a row of stat cards, with the cards removed. It replaces a
        dark hero panel carrying an avatar disc, a name and two figures: that
        block spent a third of the screen restating the sidebar, and the numbers
        a learner comes to this page for were below it.
      */}
      <section className="cx-band-stats">
        <div>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Rank tier</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block">{rank.name}</span>
          <span className="mt-2 block text-[13px] text-content-subtle">
            {nextTier
              ? `${nextTier.minPoints - userStats.points} points to ${nextTier.name}`
              : 'Top of the ladder'}
          </span>
        </div>
        <div>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Points</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block">
            <AnimatedNumber value={userStats.points} />
          </span>
          <span className="mt-2 block text-[13px] text-content-subtle">Earned from solves and contests</span>
        </div>
        <div>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Tier</span>
          <span className={`cx-figure cx-figure-lg mt-2.5 block ${userStats.level ? '' : 'text-content-subtle'}`}>
            {userStats.level || 'Unknown'}
          </span>
          <span className="mt-2 block text-[13px] text-content-subtle">
            {userStats.level ? 'Set by the placement test' : 'Needs the placement test'}
          </span>
        </div>
        <div>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Problems solved</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block">
            <AnimatedNumber value={solvedQuestions.length} />
          </span>
          <span className="mt-2 block text-[13px] text-content-subtle">Across four domains</span>
        </div>
      </section>

      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="type-body text-content-subtle">
          Signed in as <span className="font-serif text-[19px] text-content">{displayName}</span>
        </p>
        <m.button
          onClick={onLogout}
          whileTap={{ scale: 0.95 }}
          transition={spring.press}
          className="cx-btn cx-btn-secondary px-4.5 py-2.25 text-[15px]"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" /> Log out
        </m.button>
      </div>

      {/*
        Achievements.

        All of them are visible from the start with the unlock condition written
        underneath, which is the design's rule and the more useful one: a wall
        of six greyed mysteries tells a learner nothing, while six stated
        conditions is a list of things to go and do. Locked is a dashed outline;
        unlocked fills in the border and lights the mark.
      */}
      <section>
        <h3 className="type-title text-[26px]">Achievements</h3>
        <p className="type-caption mt-1.5 text-content-subtle">
          All {badges.length} are visible from the start, with what unlocks them written underneath.
        </p>

        <div className="mt-5.5 grid [grid-template-columns:repeat(auto-fit,minmax(15.625rem,1fr))] gap-4">
          {badges.map((b, index) => (
            <StaggerItem
              key={b.id}
              index={index}
              inView
              className={`p-5.5 transition-[border-color,opacity] duration-340 ease-standard ${
                b.unlocked ? 'cx-card cx-tint-accent' : 'cx-card-pending'
              }`}
            >
              <span className={`block text-[20px] leading-none ${b.unlocked ? '' : 'opacity-45 grayscale'}`}>{b.icon}</span>
              <h4 className={`type-title mt-3.5 text-[21px] ${b.unlocked ? '' : 'text-content-muted'}`}>{b.title}</h4>
              <p className="type-caption mt-1.5 leading-[1.7] text-content-subtle">{b.desc}</p>
              <span className={`cx-tag mt-3.5 inline-flex text-[10px] tracking-[0.16em] ${b.unlocked ? 'cx-tag-accent' : 'cx-tag-neutral'}`}>
                {b.unlocked ? 'Unlocked' : 'Locked'}
              </span>
            </StaggerItem>
          ))}
        </div>
      </section>

      <section className="grid [grid-template-columns:repeat(auto-fit,minmax(21.25rem,1fr))] items-start gap-8.5">
        <div>
          <h3 className="type-title text-[26px]">Solve history</h3>
          <p className="type-caption mt-1.5 mb-5.5 text-content-subtle">Every problem you have answered correctly.</p>

          {solvedQuestions.length === 0 ? (
            <div className="cx-card-pending px-7.5 py-11 text-center">
              <p className="font-serif text-[22px] text-content-muted">Nothing solved yet</p>
              <p className="type-caption mx-auto mt-2 max-w-[42ch] leading-[1.7] text-content-subtle">
                Every problem you finish is listed here with the domain it belonged to and what it was worth.
              </p>
            </div>
          ) : (
            <div className="max-h-100 overflow-y-auto border-t border-line">
              {solvedQuestions.map((q, index) => {
                const topic = TOPIC_META[q.topic];
                return (
                  <StaggerItem
                    key={q.id}
                    index={index}
                    className="flex items-center justify-between gap-4 border-b border-line-faint py-3.5"
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-serif text-[17px]">{q.title}</span>
                      <span className="cx-tag mt-1.5 inline-flex" style={topic.vars}>{topic.label}</span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[12.5px] text-proof tnum">+{q.points}</span>
                  </StaggerItem>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="type-title text-[26px]">Account</h3>
          <p className="type-caption mt-1.5 mb-5.5 text-content-subtle">What this profile is tied to.</p>

          <div className="cx-card">
            {accountRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4.5 border-b border-line-faint px-5.5 py-4.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <span className="block text-[15px]">{row.label}</span>
                  <span className="block truncate text-[13px] text-content-subtle">{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="type-caption mt-4.5 leading-[1.75] text-content-subtle">
            <span className="italic">Tip:</span> the more you engage in Community critique, the faster you spot your own mistakes.
          </p>
        </div>
      </section>
    </div>
  );
}
