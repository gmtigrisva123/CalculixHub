/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trophy, Calendar, Users, Award, Zap, ChevronRight, Globe, TrendingUp, HelpCircle, Check, Star, Medal } from 'lucide-react';
import { WeeklyChallenge, Contest, LeaderboardEntry, Topic, Level } from '../types';

interface CompeteProps {
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  leaderboard: LeaderboardEntry[];
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
  userPoints: number;
}

export default function Compete({
  weeklyChallenges,
  contests,
  leaderboard,
  onJoinChallenge,
  onJoinContest,
  userPoints,
}: CompeteProps) {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'Global' | 'VietNam'>('Global');
  const [registeredChallengeId, setRegisteredChallengeId] = useState<string | null>(null);

  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (activeLeaderboardTab === 'VietNam') return entry.country === 'Vietnam';
    return true; // Global
  });

  // Inject current user into leaderboard dynamically for custom high-fidelity personalization!
  const userName = sessionStorage.getItem('calculix_user_name') || localStorage.getItem('calculix_user_name') || 'You (Member)';
  const hasUser = filteredLeaderboard.some((e) => e.name === userName);
  const displayLeaderboard = [...filteredLeaderboard];
  if (!hasUser) {
    displayLeaderboard.push({
      rank: displayLeaderboard.length + 1,
      name: userName,
      points: 0,
      country: 'Vietnam',
      age: 16,
      badge: 'Novice ⚔️',
      avatarSeed: 'user',
    });
  }
  // Sort by points desc and re-calculate rank
  displayLeaderboard.sort((a, b) => b.points - a.points);
  displayLeaderboard.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  const handleRegisterChallenge = (id: string) => {
    onJoinChallenge(id);
    setRegisteredChallengeId(id);
    setTimeout(() => setRegisteredChallengeId(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-500" /> Competition System
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Join weekly online sprints or sharpen skills with advanced academic challenges to climb the rankings.
        </p>
      </div>

      {/* Grid: Contests and Leaderboard split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Left Side: Contests & Challenges (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active / upcoming Contests */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-700" /> Upcoming Online Contests
            </h2>

            <div className="space-y-3">
              {contests.map((cont) => (
                <div
                  key={cont.id}
                  className={`bg-white border rounded-2xl p-5 hover:border-slate-350 transition-all ${
                    cont.status === 'past' ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex gap-2 items-center">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          cont.status === 'past'
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                        }`)}>
                          {cont.status === 'past' ? 'Ended' : 'Registration Open'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {cont.problemCount} Problems
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm">{cont.title}</h3>
                    </div>
                    <div className="text-right text-xs shrink-0 font-semibold text-slate-500">
                      ⏱️ {cont.duration}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-50 pt-3">
                    <div className="text-xs text-slate-500 font-medium">
                      Time: <span className="text-slate-900 font-extrabold">{cont.date}</span>
                    </div>

                    <button
                      onClick={() => onJoinContest(cont.id)}
                      disabled={cont.status === 'past'}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                        cont.joined
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : cont.status === 'past'
                          ? 'bg-slate-50 text-slate-300 border border-slate-100 pointer-events-none'
                          : 'bg-slate-900 hover:bg-black text-white hover:shadow-xs active:scale-95'
                      }`}
                    >
                      {cont.joined ? '✓ Registered' : cont.status === 'past' ? 'Ended' : 'Register'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Academic Challenges */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 shrink-0" /> Weekly Academic Challenge
            </h2>

            <div className="space-y-3.5">
              {weeklyChallenges.map((wc) => (
                <div key={wc.id} className="bg-slate-950 border border-slate-850 text-white rounded-3xl p-6 relative overflow-hidden shadow-lg">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="bg-amber-400/15 text-amber-300 border border-amber-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                        This week • Logic challenge
                      </span>
                      <h3 className="font-extrabold text-base text-amber-100 mt-2">{wc.title}</h3>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase">Reward</span>
                      <span className="text-sm font-extrabold text-amber-400">🏆 +{wc.points}</span>
                    </div>
                  </div>

                  <p className="text-slate-400 text-xs leading-relaxed">
                    {wc.description}
                  </p>

                  <div className="mt-5 pt-4.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex gap-4 text-slate-400 font-medium">
                      <span>🔔 Deadline: <b className="text-slate-200">{wc.dueDate}</b></span>
                      <span>👥 <b className="text-slate-200">{wc.participants}</b> participants</span>
                    </div>

                    <button
                      onClick={() => handleRegisterChallenge(wc.id)}
                      className={`font-semibold px-4.5 py-2.5 rounded-xl transition-all h-9 flex items-center justify-center cursor-pointer ${
                        wc.completed
                          ? 'bg-slate-800 text-slate-400 border border-slate-700/50'
                          : 'bg-white hover:bg-slate-100 text-slate-950 font-bold active:scale-95'
                      }`}
                    >
                      {registeredChallengeId === wc.id ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Challenge opened
                        </span>
                      ) : wc.completed ? (
                        '✓ Registered'
                      ) : (
                        'Join Challenge'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: Leaderboard Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-5 shadow-xs h-fit space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Medal className="w-5 h-5 text-amber-500" /> Leaderboard
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Honoring top performers with the highest activity and achievements on the platform.
            </p>
          </div>

          {/* Sub Tab selection */}
          <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-100">
            <button
              onClick={() => setActiveLeaderboardTab('Global')}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeLeaderboardTab === 'Global' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🌐 Global
            </button>
            <button
              onClick={() => setActiveLeaderboardTab('VietNam')}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeLeaderboardTab === 'VietNam' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🇻🇳 Vietnam
            </button>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2 pt-1">
            {displayLeaderboard.map((entry, index) => {
              const isCurrentUser = entry.name === userName;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrentUser
                      ? 'bg-blue-50/50 border-blue-200 shadow-3xs'
                      : 'bg-white hover:bg-slate-50 border-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank design */}
                    <div className="w-6 text-center select-none">
                      {entry.rank === 1 ? (
                        <span className="text-base">🥇</span>
                      ) : entry.rank === 2 ? (
                        <span className="text-base">🥈</span>
                      ) : entry.rank === 3 ? (
                        <span className="text-base">🥉</span>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-400">#{entry.rank}</span>
                      )}
                    </div>

                    {/* Avatar substitute & Name info */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isCurrentUser ? 'text-blue-700' : 'text-slate-900'}`}>
                          {entry.name}
                        </span>
                        {entry.badge && (
                          <span className="bg-slate-900/5 text-slate-600 px-1 py-0.2 rounded-sm text-[8px] font-semibold scale-90 block">
                            {entry.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 items-center text-[9px] text-slate-400 font-medium">
                        <span>{entry.country}</span>
                        <span>•</span>
                        <span>{entry.age} yrs</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-extrabold text-slate-900">{entry.points} pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Leaderboard ranks update instantly when students complete challenges and problems.
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
