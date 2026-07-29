/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, CheckCircle, Star, LogOut } from 'lucide-react';
import { UserStats, Problem } from '../types';
import { TOPIC_META, getRankForPoints } from '../lib/topics';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
}

export default function Profile({ userStats, completedProblems, problems, onLogout }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const rank = getRankForPoints(userStats.points);
  const displayName = sessionStorage.getItem('calculix_user_name') || localStorage.getItem('calculix_user_name') || 'Calculix Student';

  const badges = [
    { id: 'b1', title: 'Getting Started', desc: 'Joined CalculixHub', unlocked: true, icon: '🌱' },
    { id: 'b2', title: 'Algebra Reflex', desc: 'Reach 50 total points', unlocked: userStats.points >= 50, icon: '📐' },
    { id: 'b3', title: 'Combinatorics Warrior', desc: 'Master discrete math (60%+)', unlocked: userStats.skills.Combinatorics >= 60, icon: '🎲' },
    { id: 'b4', title: 'Leaderboard Breaker', desc: 'Cross 250 cumulative points', unlocked: userStats.points >= 250, icon: '🏆' },
    { id: 'b5', title: 'Unbreakable Streak', desc: 'Hit a 3-day activity streak', unlocked: userStats.streak >= 3, icon: '🔥' },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-100 pb-4">
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2 font-serif">
          <User className="w-7 h-7 text-stone-800" /> Student Profile
        </h1>
        <p className="text-xs text-stone-500 mt-1">Your academic progress, evidence of skill, and earned honors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-ink-950 border border-ink-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl bp-corners">
            <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-violet-500/15 to-brass-500/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
              <div className="w-20 h-20 bg-gradient-to-tr from-violet-500 to-brass-600 rounded-full border-4 border-ink-800 flex items-center justify-center font-black text-2xl text-white shadow-lg font-serif">
                {displayName.substring(0, 1).toUpperCase()}
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl font-extrabold tracking-tight font-serif">{displayName}</h2>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase border ${rank.bg} ${rank.text} ${rank.border}`}>{rank.name}</span>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs pt-1">
                  <span>Level: <strong className="text-brass-400">{userStats.level}</strong></span>
                  <span>Points: <strong className="text-violet-400">{userStats.points}</strong></span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="bg-ink-800 hover:bg-ink-700 border border-ink-700 p-2.5 rounded-xl text-stone-300 hover:text-white transition-all text-xs font-bold cursor-pointer flex gap-1.5"
              >
                <LogOut className="w-4 h-4 shrink-0" /> Log out
              </button>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5">
              <Star className="w-4.5 h-4.5 text-brass-500" /> Achievement Badges
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badges.map((b) => (
                <div key={b.id} className={`border rounded-2xl p-4 flex gap-3 transition-all ${b.unlocked ? 'bg-stone-50/50 border-stone-200' : 'border-stone-100 bg-stone-50/20 opacity-40'}`}>
                  <div className="text-2xl pt-0.5 self-center">{b.icon}</div>
                  <div className="space-y-0.5">
                    <h4 className="font-black text-stone-800 text-xs">{b.title}</h4>
                    <p className="text-[10px] text-stone-500 leading-normal">{b.desc}</p>
                    <span className="inline-block mt-1 text-[8px] uppercase font-bold text-stone-400">{b.unlocked ? 'Unlocked' : 'Locked'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-5 h-fit">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5">
              <CheckCircle className="w-4.5 h-4.5 text-proof-500" /> Solved Problems Notebook
            </h3>
            <p className="text-[10px] text-stone-400">Every problem you've answered correctly.</p>
          </div>

          {solvedQuestions.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs italic">Empty for now &mdash; solve a problem to add it here.</div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {solvedQuestions.map((q) => (
                <div key={q.id} className="p-3 bg-stone-50 rounded-xl border border-stone-150 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="block text-[10px] font-black text-stone-900 tracking-tight truncate">{q.title}</span>
                    <span className="block text-[9px] text-stone-400 font-bold uppercase">{TOPIC_META[q.topic].label}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-proof-600 whitespace-nowrap bg-proof-50 px-2 py-0.5 rounded border border-proof-100">+{q.points}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-stone-50 rounded-xl p-3 text-[10px] text-stone-500 leading-relaxed max-w-full">
            <strong>Tip:</strong> The more you engage in Community critique, the faster you'll spot your own mistakes.
          </div>
        </div>
      </div>
    </div>
  );
}
