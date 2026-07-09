/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, Award, Shield, CheckCircle, Clock, Calendar, HelpCircle, Star, Sparkles, LogOut } from 'lucide-react';
import { UserStats, Problem } from '../types';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
}

export default function Profile({ userStats, completedProblems, problems, onLogout }: ProfileProps) {
  
  const getSubTopicTrans = (key: string) => {
    switch (key) {
      case 'Algebra': return 'Algebra';
      case 'Geometry': return 'Geometry';
      case 'Combinatorics': return 'Combinatorics & Graphs';
      case 'Number Theory': return 'Number Theory';
      default: return key;
    }
  };

  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));

  // Dynamic achievement badges based on progress points & solved counts
  const badges = [
    { id: 'b1', title: 'Getting Started', desc: 'Joined Calculix Hub', unlocked: true, icon: '🌱' },
    { id: 'b2', title: 'Viète Honoree', desc: 'Reach 50 Algebra points', unlocked: userStats.points >= 50, icon: '📐' },
    { id: 'b3', title: 'Combinatorics Champ', desc: 'Master discrete subtopic', unlocked: userStats.skills.Combinatorics >= 60, icon: '🎲' },
    { id: 'b4', title: 'Gold Breaker', desc: 'Cross 250 cumulative points', unlocked: userStats.points >= 250, icon: '🏆' },
    { id: 'b5', title: 'Consistent Thinker', desc: '3-day activity streak', unlocked: userStats.streak >= 3, icon: '🔥' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Title */}
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <User className="w-7 h-7 text-slate-800" /> Student Profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your learning progress, evidence of practice, and earned honors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Left: General Identity & Badges Achievements (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Identity card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/15 to-blue-500/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-full border-4 border-slate-800 flex items-center justify-center font-black text-2xl text-white shadow-lg">
                HS
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl font-extrabold tracking-tight">Math Student</h2>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase">
                    ID: CLX-998
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Active member since: <strong className="text-slate-200">22 June, 2026</strong>
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs pt-1">
                  <span>Level: <strong className="text-amber-400">{userStats.level}</strong></span>
                  <span>Country: <strong className="text-indigo-400">Vietnam</strong></span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 p-2.5 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer flex gap-1.5"
              >
                <LogOut className="w-4 h-4 shrink-0" /> Log out
              </button>
            </div>
          </div>

          {/* Gamification Achievements and Badges */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <Star className="w-4.5 h-4.5 text-yellow-500" /> Badges
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className={`border rounded-2xl p-4 flex gap-3 transition-all ${
                    b.unlocked
                      ? 'bg-slate-50/50 border-slate-200/80'
                      : 'border-slate-100 bg-slate-50/20 opacity-40'
                  }`}
                >
                  <div className="text-2xl pt-0.5 self-center">{b.icon}</div>
                  <div className="space-y-0.5">
                    <h4 className="font-black text-slate-800 text-xs">{b.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-normal">{b.desc}</p>
                    <span className="inline-block mt-1 text-[8px] uppercase font-bold text-slate-400">
                      {b.unlocked ? '✓ Unlocked' : 'Locked'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right: Solved Problem list details (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-5 h-fit">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-500" /> Solved Solutions
            </h3>
            <p className="text-[10px] text-slate-400">List of problems you've solved correctly.</p>
          </div>

          {solvedQuestions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              Notebook is empty. Submit correct answers to save notable solutions here.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {solvedQuestions.map((q) => (
                <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-3 font-serif">
                  <div className="space-y-0.5 min-w-0">
                    <span className="block text-[10px] font-black font-sans text-slate-900 tracking-tight truncate">{q.title}</span>
                    <span className="block text-[9px] font-sans text-slate-400 font-bold uppercase">{getSubTopicTrans(q.topic)}</span>
                  </div>
                  <span className="text-[10px] font-extrabold font-sans text-emerald-600 whitespace-nowrap bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    +{q.points} Points
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed max-w-full">
            💡 <strong>Performance boost:</strong> Participating in critical discussions on Community significantly improves your error-detection skills.
          </div>
        </div>

      </div>

    </div>
  );
}
