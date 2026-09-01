/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Trophy, Calendar, Zap, Medal, Flag, Users2, Swords, Gauge, Target, Repeat, TrendingUp, ChevronRight } from 'lucide-react';
import { WeeklyChallenge, Contest, LeaderboardEntry, UserStats } from '../../shared/types';
import { RANK_TIERS, getRankForPoints, nextRankFor } from '../lib/topics';
import { computeMetrics } from '../domain/analytics';
import { duration, ease, spring } from '../lib/motion';
import { AnimatedNumber, StaggerItem } from './motion';
import { useAuth } from '../context/AuthContext';

interface CompeteProps {
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  leaderboard: LeaderboardEntry[];
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
  userPoints: number;
  userStats: UserStats;
}

type LeaderboardAxis = 'Global' | 'Country' | 'Cohort';
type RankDimension = 'points' | 'speed' | 'accuracy' | 'consistency' | 'improvement';

export default function Compete({
  weeklyChallenges,
  contests,
  leaderboard,
  onJoinChallenge,
  onJoinContest,
  userPoints,
  userStats,
}: CompeteProps) {
  const [activeAxis, setActiveAxis] = useState<LeaderboardAxis>('Global');
  const [dimension, setDimension] = useState<RankDimension>('points');
  const [registeredChallengeId, setRegisteredChallengeId] = useState<string | null>(null);

  const { profile } = useAuth();
  const userName = profile?.display_name || profile?.username || 'You';
  const userAge = 16;
  const userCountry = 'Vietnam';

  const myMetrics = useMemo(() => computeMetrics(userStats), [userStats]);

  const displayLeaderboard = useMemo(() => {
    let base = [...leaderboard];
    const myRow: Partial<LeaderboardEntry> = {
      points: userPoints,
      speed: myMetrics.speed,
      accuracy: myMetrics.accuracy,
      consistency: myMetrics.consistency,
      improvement: myMetrics.improvement,
    };

    const hasUser = base.some((e) => e.name === userName);
    if (!hasUser) {
      base.push({
        rank: 0,
        name: userName,
        country: userCountry,
        age: userAge,
        avatarSeed: 'user',
        points: userPoints,
        ...myRow,
      } as LeaderboardEntry);
    } else {
      base = base.map((e) => (e.name === userName ? { ...e, ...myRow } : e));
    }

    let scoped = base;
    if (activeAxis === 'Country') scoped = base.filter((e) => e.country === userCountry);
    if (activeAxis === 'Cohort') scoped = base.filter((e) => Math.abs(e.age - userAge) <= 1);

    const valueOf = (e: LeaderboardEntry) => (dimension === 'points' ? e.points : e[dimension] ?? 0);
    scoped.sort((a, b) => valueOf(b) - valueOf(a));
    return scoped.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [leaderboard, userName, userPoints, activeAxis, dimension, myMetrics]);

  const dimensions: { key: RankDimension; label: string; icon: typeof Gauge }[] = [
    { key: 'points', label: 'Points', icon: Trophy },
    { key: 'speed', label: 'Speed', icon: Gauge },
    { key: 'accuracy', label: 'Accuracy', icon: Target },
    { key: 'consistency', label: 'Consistency', icon: Repeat },
    { key: 'improvement', label: 'Improvement', icon: TrendingUp },
  ];

  const rank = getRankForPoints(userPoints);
  const next = nextRankFor(userPoints);

  const handleRegisterChallenge = (id: string) => {
    onJoinChallenge(id);
    setRegisteredChallengeId(id);
    setTimeout(() => setRegisteredChallengeId(null), 3000);
  };

  const axisTabs: { key: LeaderboardAxis; label: string; icon: typeof Flag }[] = [
    { key: 'Global', label: 'Global', icon: Trophy },
    { key: 'Country', label: 'Country', icon: Flag },
    { key: 'Cohort', label: 'Age Group', icon: Users2 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-4 flex items-center justify-between">
        <div>
          <p className="type-eyebrow text-amber-500 font-mono text-xs uppercase">Competition Arena</p>
          <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" /> Contest &amp; Leaderboard
          </h1>
        </div>
        <span className="text-xs font-mono text-content-subtle">{userPoints} Total Points</span>
      </div>

      {/* Skill Ladder Progress */}
      <div className="cx-glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500">
              {rank.name}
            </span>
            <span className="text-xs text-content-subtle font-mono">Current Rank Tier &mdash; {userPoints} pts</span>
          </div>
          {next && (
            <span className="text-xs font-mono text-content-subtle">
              {next.minPoints - userPoints} pts to <span className="font-bold text-indigo-500">{next.name}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {RANK_TIERS.map((tier, index) => {
            const active = tier.name === rank.name;
            const reached = userPoints >= tier.minPoints;
            return (
              <m.div
                key={tier.name}
                title={tier.name}
                className={`h-2.5 rounded-full ${
                  reached ? (active ? 'bg-indigo-500 shadow-md shadow-indigo-500/30' : 'bg-emerald-500') : 'bg-line'
                }`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...spring.smooth, delay: index * 0.06 }}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-4 text-center text-[10px] font-bold font-mono uppercase text-content-subtle">
          {RANK_TIERS.map((t) => (
            <span key={t.name}>{t.name}</span>
          ))}
        </div>
      </div>

      {/* Contests & Leaderboard Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Contests & Challenges */}
        <div className="lg:col-span-6 space-y-6">
          {/* Monthly Contests */}
          <div className="cx-glass-panel p-6 space-y-4">
            <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" /> Monthly Contests
            </h2>

            <div className="space-y-3">
              {contests.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-line rounded-xl text-xs text-content-subtle font-mono">
                  No contests scheduled currently.
                </div>
              ) : (
                contests.map((cont, index) => (
                  <StaggerItem
                    key={cont.id}
                    index={index}
                    className="p-4 rounded-xl border border-line bg-surface-sunken/40 space-y-3 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {cont.status}
                          </span>
                          <span className="text-xs font-mono text-content-subtle">{cont.problemCount} Problems</span>
                        </div>
                        <h3 className="font-semibold text-content text-sm">{cont.title}</h3>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-500">{cont.duration}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line text-xs font-mono">
                      <span className="text-content-subtle">Date: <strong className="text-content">{cont.date}</strong></span>
                      <m.button
                        onClick={() => onJoinContest(cont.id)}
                        disabled={cont.status === 'past'}
                        whileTap={{ scale: 0.95 }}
                        className="cx-btn cx-btn-primary px-3 py-1.5 rounded-lg text-xs"
                      >
                        {cont.status === 'past' ? 'Finished' : 'Register / Enter'}
                      </m.button>
                    </div>
                  </StaggerItem>
                ))
              )}
            </div>
          </div>

          {/* Weekly Sprints */}
          <div className="cx-glass-panel p-6 space-y-4">
            <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Weekly Sprints
            </h2>

            <div className="space-y-3">
              {weeklyChallenges.map((chal, index) => (
                <div key={chal.id} className="p-4 rounded-xl border border-line bg-surface-sunken/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="cx-tag cx-tag-accent text-[10px]">Due {chal.dueDate}</span>
                    <span className="text-xs font-mono text-amber-500 font-bold">+{chal.points} Pts</span>
                  </div>
                  <h3 className="font-semibold text-content text-sm">{chal.title}</h3>
                  <p className="text-xs text-content-muted leading-relaxed">{chal.description}</p>
                  <div className="pt-2 flex justify-end">
                    <m.button
                      onClick={() => handleRegisterChallenge(chal.id)}
                      whileTap={{ scale: 0.95 }}
                      className="cx-btn cx-btn-fill px-4 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {registeredChallengeId === chal.id ? 'Joined!' : 'Join Challenge'}
                    </m.button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Ranked Leaderboard */}
        <div className="lg:col-span-6 space-y-6">
          <div className="cx-glass-panel p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Live Leaderboard
              </h2>

              {/* Axis Tabs */}
              <div className="flex gap-1 p-1 bg-surface-sunken rounded-lg border border-line">
                {axisTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeAxis === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveAxis(tab.key)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-content-subtle hover:text-content'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metric Dimensions */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dimensions.map((dim) => {
                const Icon = dim.icon;
                const isActive = dimension === dim.key;
                return (
                  <button
                    key={dim.key}
                    onClick={() => setDimension(dim.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border shrink-0 transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                        : 'border-line bg-surface-sunken/40 text-content-subtle hover:border-line-strong'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{dim.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Leaderboard Table */}
            <div className="space-y-2">
              {displayLeaderboard.map((entry) => {
                const isMe = entry.name === userName;
                const valueDisplay = dimension === 'points' ? `${entry.points} pts` : `${entry[dimension] ?? 0}`;

                return (
                  <div
                    key={entry.name}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                      isMe
                        ? 'border-indigo-500/60 bg-indigo-500/10 font-bold'
                        : 'border-line bg-surface-sunken/30 hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-mono font-bold text-sm text-content-subtle">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <div>
                        <h4 className="font-semibold text-content text-sm flex items-center gap-1.5">
                          <span>{entry.name}</span>
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500 text-white font-mono uppercase">You</span>}
                        </h4>
                        <span className="text-[11px] font-mono text-content-subtle">{entry.country} &bull; Age {entry.age}</span>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-sm text-indigo-500 tnum">{valueDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
