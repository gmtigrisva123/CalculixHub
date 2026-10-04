/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { LogOut, Trophy, Award, User, ShieldCheck, Calendar, MapPin, Sparkles } from 'lucide-react';
import { UserStats, Problem } from '../../shared/types';
import { getRankForPoints, nextRankFor } from '../lib/topics';
import { spring } from '../lib/motion';
import { AnimatedNumber, StaggerItem } from './motion';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS, getUnlockedAchievementIds } from '../domain/achievements';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
  onTriggerAlert?: (achievement: any) => void;
}

export default function Profile({ userStats, completedProblems, problems, onLogout, onTriggerAlert }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const rank = getRankForPoints(userStats.points);

  const { profile } = useAuth();
  const badges = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: Boolean(profile) && a.condition(userStats, solvedQuestions.length),
  }));

  const displayName = profile?.display_name || profile?.username || 'Calculix Learner';
  const nextTier = nextRankFor(userStats.points);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="type-eyebrow text-indigo-500 font-mono text-xs uppercase">YOUR OWN LEARNING JOURNEY</p>
          <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
            <User className="w-6 h-6 text-indigo-500" /> {displayName}
          </h1>
        </div>

        <m.button
          onClick={onLogout}
          whileTap={{ scale: 0.95 }}
          className="cx-btn cx-btn-secondary px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-line hover:bg-surface-sunken"
        >
          <LogOut className="w-4 h-4 text-rose-500" /> Sign out
        </m.button>
      </div>

      {/* Stats Summary Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        <div className="cx-glass-panel p-5 space-y-2">
          <span className="type-eyebrow text-xs text-content-subtle font-mono uppercase">Rank Tier</span>
          <span className="block cx-stat-value text-3xl text-content">{rank.name}</span>
          <span className="block text-xs font-mono text-content-subtle">
            {nextTier ? `${nextTier.minPoints - userStats.points} pts to ${nextTier.name}` : 'Top Rank Reached'}
          </span>
        </div>

        <div className="cx-glass-panel p-5 space-y-2">
          <span className="type-eyebrow text-xs text-content-subtle font-mono uppercase">Total Points</span>
          <span className="block cx-stat-value text-3xl text-indigo-500">
            <AnimatedNumber value={userStats.points} />
          </span>
          <span className="block text-xs font-mono text-content-subtle">Earned via solves &amp; contests</span>
        </div>

        <div className="cx-glass-panel p-5 space-y-2">
          <span className="type-eyebrow text-xs text-content-subtle font-mono uppercase">Placement Tier</span>
          <span className="block cx-stat-value text-3xl text-content">{userStats.level || 'Unplaced'}</span>
          <span className="block text-xs font-mono text-content-subtle">
            {userStats.level ? 'Set by placement assessment' : 'Placement assessment required'}
          </span>
        </div>

        <div className="cx-glass-panel p-5 space-y-2">
          <span className="type-eyebrow text-xs text-content-subtle font-mono uppercase">Problems Solved</span>
          <span className="block cx-stat-value text-3xl text-emerald-500">
            <AnimatedNumber value={solvedQuestions.length} />
          </span>
          <span className="block text-xs font-mono text-content-subtle">From your saved practice</span>
        </div>
      </section>

      {/* Account Info Details */}
      <section className="cx-glass-panel p-6 space-y-4">
        <h3 className="type-title text-base font-bold text-content flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" /> Account Identity &amp; Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl border border-line bg-surface-sunken/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-content-subtle block">Display Name</span>
            <span className="text-xs font-semibold text-content block">{displayName}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-line bg-surface-sunken/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-content-subtle block">Username</span>
            <span className="text-xs font-semibold text-content block">{profile?.username ? `@${profile.username}` : 'Not set'}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-line bg-surface-sunken/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-content-subtle block">Member Since</span>
            <span className="text-xs font-semibold text-content block">{profile?.created_at ? profile.created_at.slice(0, 10) : 'Not available'}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-line bg-surface-sunken/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-content-subtle block">Country</span>
            <span className="text-xs font-semibold text-content block">{profile?.country ?? 'Not set'}</span>
          </div>
        </div>
      </section>

      {/* Achievements Showcase */}
      <section className="space-y-4">
        <div>
          <h3 className="type-title text-xl font-bold text-content flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" /> Achievement Badges
          </h3>
          <p className="type-caption text-xs text-content-subtle mt-1 font-mono">
            {badges.filter((b) => b.unlocked).length} of {badges.length} unlocked
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((b, index) => (
            <StaggerItem
              key={b.id}
              index={index}
              className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 ${
                b.unlocked
                  ? 'cx-glass-panel border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent shadow-[0_10px_30px_-10px_rgba(245,158,11,0.4)] hover:border-amber-500/70 hover:shadow-[0_14px_38px_-8px_rgba(245,158,11,0.55)]'
                  : 'border-dashed border-line bg-surface-sunken/30 opacity-60'
              }`}
            >
              {b.unlocked && (
                <span
                  className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-50 blur-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.85), transparent 70%)' }}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
                  b.unlocked ? 'border-2 border-amber-400/60 bg-gradient-to-tr from-amber-500/30 to-amber-300/10 shadow-md shadow-amber-500/30' : ''
                }`}
              >
                {b.icon}
              </span>
              <h4 className="relative font-bold text-content text-base mt-3">{b.title}</h4>
              <p className="relative text-xs text-content-muted leading-relaxed mt-1 font-mono">{b.desc}</p>
              <span
                className={`cx-tag relative text-[9px] mt-3 inline-flex items-center gap-1 font-mono font-bold ${
                  b.unlocked ? 'border-amber-500/40 text-amber-600 dark:text-amber-300' : 'cx-tag-neutral'
                }`}
              >
                {b.unlocked && <Sparkles className="h-2.5 w-2.5" />}
                {b.unlocked ? 'Unlocked' : 'Locked'}
              </span>
            </StaggerItem>
          ))}
        </div>
      </section>
    </div>
  );
}
