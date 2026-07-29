/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Trophy, Calendar, Zap, HelpCircle, Check, Medal, Flag, Users2, Swords, Gauge, Target, Repeat, TrendingUp } from 'lucide-react';
import { WeeklyChallenge, Contest, LeaderboardEntry, UserStats } from '../types';
import { RANK_TIERS, getRankForPoints, nextRankFor } from '../lib/topics';
import { computeMetrics } from '../lib/analytics';

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

  const userName = sessionStorage.getItem('calculix_user_name') || localStorage.getItem('calculix_user_name') || 'You';
  const userAge = 16;
  const userCountry = 'Vietnam';

  // The current learner's own four-axis metrics, computed from real activity.
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

  const dimensions: { key: RankDimension; label: string; icon: typeof Gauge; unit: string }[] = [
    { key: 'points', label: 'Points', icon: Trophy, unit: 'pts' },
    { key: 'speed', label: 'Speed', icon: Gauge, unit: '' },
    { key: 'accuracy', label: 'Accuracy', icon: Target, unit: '' },
    { key: 'consistency', label: 'Consistency', icon: Repeat, unit: '' },
    { key: 'improvement', label: 'Improvement', icon: TrendingUp, unit: '' },
  ];
  const activeDimension = dimensions.find((d) => d.key === dimension)!;

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
    { key: 'Cohort', label: 'Age group', icon: Users2 },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-100 pb-4">
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2 font-serif">
          <Trophy className="w-7 h-7 text-brass-600" /> Competition System
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Join live weekly sprints, sit monthly timed contests, and climb the ranked ladder from Beginner to Elite.
        </p>
      </div>

      {/* Skill ladder progress */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${rank.bg} ${rank.text} ${rank.border}`}>{rank.name}</span>
            <span className="text-xs text-stone-500">Your current skill tier &mdash; {userPoints} pts</span>
          </div>
          {next && <span className="text-[11px] text-stone-400 font-medium">{next.minPoints - userPoints} pts to {next.name}</span>}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {RANK_TIERS.map((tier) => {
            const active = tier.name === rank.name;
            const reached = userPoints >= tier.minPoints;
            return (
              <div key={tier.name} className={`h-2 rounded-full ${reached ? (active ? 'bg-brass-600' : 'bg-proof-500') : 'bg-stone-150'}`} title={tier.name} />
            );
          })}
        </div>
        <div className="grid grid-cols-4 text-center text-[9px] font-bold uppercase text-stone-400">
          {RANK_TIERS.map((t) => <span key={t.name}>{t.name}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        <div className="lg:col-span-7 space-y-6">

          {/* Monthly Contests */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-stone-700" /> Monthly Contests
            </h2>

            <div className="space-y-3">
              {contests.length === 0 && (
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">No contests scheduled right now.</div>
              )}
              {contests.map((cont) => (
                <div key={cont.id} className={`bg-white border rounded-2xl p-5 hover:border-stone-300 transition-all ${cont.status === 'past' ? 'opacity-70' : ''}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex gap-2 items-center">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          cont.status === 'past' ? 'bg-stone-100 text-stone-500 border border-stone-200' : 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                        }`}>
                          {cont.status === 'past' ? 'Finished' : 'Open for registration'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">{cont.problemCount} problems</span>
                      </div>
                      <h3 className="font-extrabold text-stone-800 text-sm">{cont.title}</h3>
                    </div>
                    <div className="text-right text-xs shrink-0 font-semibold text-stone-500">{cont.duration}</div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100 pt-3">
                    <div className="text-xs text-stone-500 font-medium">
                      Date: <span className="text-stone-900 font-extrabold">{cont.date}</span>
                    </div>
                    <button
                      onClick={() => onJoinContest(cont.id)}
                      disabled={cont.status === 'past'}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        cont.joined ? 'bg-proof-50 text-proof-700 border border-proof-100'
                        : cont.status === 'past' ? 'bg-stone-50 text-stone-300 border border-stone-100 pointer-events-none'
                        : 'bg-ink-950 hover:bg-black text-white hover:shadow-xs active:scale-95'
                      }`}
                    >
                      {cont.joined ? 'Registered' : cont.status === 'past' ? 'Ended' : 'Register'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Challenges */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Zap className="w-5 h-5 text-brass-600 shrink-0" /> Weekly Challenges
            </h2>

            <div className="space-y-3.5">
              {weeklyChallenges.length === 0 && (
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">No active weekly challenge right now.</div>
              )}
              {weeklyChallenges.map((wc) => (
                <div key={wc.id} className="bg-ink-950 border border-ink-850 text-white rounded-3xl p-6 relative overflow-hidden shadow-lg">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-brass-500/10 to-proof-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="bg-brass-400/15 text-brass-300 border border-brass-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">This week</span>
                      <h3 className="font-extrabold text-base text-brass-100 mt-2">{wc.title}</h3>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="block text-[9px] text-stone-400 font-bold uppercase">Reward</span>
                      <span className="text-sm font-extrabold text-brass-400">+{wc.points}</span>
                    </div>
                  </div>

                  <p className="text-stone-400 text-xs leading-relaxed">{wc.description}</p>

                  <div className="mt-5 pt-4.5 border-t border-ink-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex gap-4 text-stone-400 font-medium">
                      <span>Due: <b className="text-stone-200">{wc.dueDate}</b></span>
                      <span><b className="text-stone-200">{wc.participants}</b> participating</span>
                    </div>
                    <button
                      onClick={() => handleRegisterChallenge(wc.id)}
                      className={`font-semibold px-4.5 py-2.5 rounded-xl transition-all h-9 flex items-center justify-center cursor-pointer ${
                        wc.completed ? 'bg-ink-800 text-stone-400 border border-ink-700' : 'bg-white hover:bg-stone-100 text-ink-950 font-bold active:scale-95'
                      }`}
                    >
                      {registeredChallengeId === wc.id ? (
                        <span className="flex items-center gap-1 text-proof-600"><Check className="w-3.5 h-3.5" /> Joined</span>
                      ) : wc.completed ? ('Registered') : ('Join challenge')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Tournament preview */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Swords className="w-5 h-5 text-violet-600" /> Seasonal Tournament
              <span className="text-[9px] font-bold uppercase bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md tracking-wider">Preview</span>
            </h2>
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <p className="text-xs text-stone-500 mb-4">A multi-stage championship league &mdash; qualifiers, brackets, and live finals. Full scheduling is coming soon.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Qualifiers', 'Round of 16', 'Semifinal', 'Final'].map((stage, idx) => (
                  <div key={stage} className={`rounded-xl border p-3 text-center ${idx === 0 ? 'bg-violet-50 border-violet-200' : 'bg-stone-50 border-stone-150'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-wider block ${idx === 0 ? 'text-violet-700' : 'text-stone-400'}`}>Stage {idx + 1}</span>
                    <span className={`text-xs font-bold block mt-1 ${idx === 0 ? 'text-violet-900' : 'text-stone-600'}`}>{stage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Leaderboard */}
        <div className="lg:col-span-5 bg-white border border-stone-100 rounded-3xl p-5 shadow-xs h-fit space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-stone-900 flex items-center gap-2 font-serif">
              <Medal className="w-5 h-5 text-brass-600" /> Leaderboard
            </h2>
            <p className="text-[11px] text-stone-500 leading-relaxed">Ranked in real time as students complete challenges and contests.</p>
          </div>

          {/* Cohort axis */}
          <div className="bg-stone-50 p-1 rounded-xl flex border border-stone-100">
            {axisTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveAxis(tab.key)}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeAxis === tab.key ? 'bg-white text-stone-950 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Ranking dimension */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">Rank by</span>
            <div className="flex flex-wrap gap-1.5">
              {dimensions.map((d) => {
                const DimIcon = d.icon;
                return (
                  <button
                    key={d.key}
                    onClick={() => setDimension(d.key)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                      dimension === d.key
                        ? 'bg-ink-950 border-ink-950 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <DimIcon className="w-3 h-3" /> {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* The learner's own four-axis profile */}
          <div className="bg-stone-50 border border-stone-150 rounded-xl p-3 space-y-2">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">Your performance profile</span>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Speed', value: myMetrics.speed },
                { label: 'Accuracy', value: myMetrics.accuracy },
                { label: 'Consist.', value: myMetrics.consistency },
                { label: 'Improve', value: myMetrics.improvement },
              ].map((m) => (
                <div key={m.label}>
                  <span className="text-sm font-black text-stone-900 font-mono block">{m.value}</span>
                  <span className="text-[8px] uppercase font-bold text-stone-400">{m.label}</span>
                </div>
              ))}
            </div>
            {userStats.completedCount === 0 && (
              <p className="text-[9px] text-stone-400 leading-relaxed pt-1 border-t border-stone-200">
                Solve problems across several days to populate these axes.
              </p>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {displayLeaderboard.length === 0 && (
              <div className="text-center py-6 text-stone-400 text-xs">No entries in this view yet.</div>
            )}
            {displayLeaderboard.map((entry) => {
              const isCurrentUser = entry.name === userName;
              const entryRank = getRankForPoints(entry.points);
              return (
                <div
                  key={`${entry.name}-${entry.rank}`}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrentUser ? 'bg-brass-50/60 border-brass-200' : 'bg-white hover:bg-stone-50 border-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-center select-none">
                      {entry.rank === 1 ? <span className="text-base">🥇</span>
                        : entry.rank === 2 ? <span className="text-base">🥈</span>
                        : entry.rank === 3 ? <span className="text-base">🥉</span>
                        : <span className="text-xs font-extrabold text-stone-400">#{entry.rank}</span>}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isCurrentUser ? 'text-brass-700' : 'text-stone-900'}`}>{entry.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${entryRank.bg} ${entryRank.text}`}>{entryRank.name}</span>
                      </div>
                      <div className="flex gap-2 items-center text-[9px] text-stone-400 font-medium">
                        <span>{entry.country}</span><span>&bull;</span><span>{entry.age} yo</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-stone-900 font-mono">
                      {dimension === 'points' ? `${entry.points} pts` : (entry[dimension] ?? 0)}
                    </span>
                    {dimension !== 'points' && (
                      <span className="text-[8px] uppercase font-bold text-stone-400 block">{activeDimension.label}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-stone-50 rounded-xl p-3 text-[10px] text-stone-500 flex items-start gap-1.5 leading-relaxed">
            <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <span>Rankings update instantly as students finish challenges and problems.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
