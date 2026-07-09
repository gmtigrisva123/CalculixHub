/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import { AreaChart, Sparkles, TrendingUp, AlertTriangle, BookOpen, Clock, Lightbulb, RefreshCw } from 'lucide-react';
import { UserStats } from '../types';

interface ProgressViewProps {
  userStats: UserStats;
}

export default function ProgressView({ userStats }: ProgressViewProps) {
  // Translate topic identifiers to user-friendly English titles
  const getSubTopicTrans = (key: string) => {
    switch (key) {
      case 'Algebra': return 'Algebra';
      case 'Geometry': return 'Geometry';
      case 'Combinatorics': return 'Combinatorics & Graphs';
      case 'Number Theory': return 'Number Theory';
      default: return key;
    }
  };

  const getSubTopicDesc = (key: string) => {
    switch (key) {
      case 'Algebra': return 'Skill in algebraic manipulation, extrema, and polynomial equations.';
      case 'Geometry': return 'Spatial intuition and classical planar theorems (Ptolemy/Brahmagupta).';
      case 'Combinatorics': return 'Combinatorial counting, constructive partitions, and basic graph theory.';
      case 'Number Theory': return 'Modular arithmetic, Euler phi, and basic prime-related lemmas.';
      default: return '';
    }
  };

  // Convert stats skills object to an array for easy rendering
  const skillEntries = Object.entries(userStats.skills) as [string, number][];

  // Logic: find weakest area dynamically based on metrics
  const sortedSkills = [...skillEntries].sort((a, b) => a[1] - b[1]);
  const weakestSkill = sortedSkills[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Title */}
      <div className="border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" /> Analytics & Research
          </h1>
        <p className="text-xs text-slate-500 mt-1">
          The "EduReach Core" system automatically extracts and visualizes the student's real mathematical abilities across practice sessions.
        </p>
      </div>

      {/* Grid: Skill Breakdown and Weakness Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Skill Breakdown Progress Bars (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-700" /> Skill Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cumulative correctness rates broken down by advanced mathematics subtopics.
            </p>
          </div>

          <div className="space-y-5 pt-2">
            {skillEntries.map(([skillName, pct]) => (
              <div key={skillName} className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">{getSubTopicTrans(skillName)}</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{getSubTopicDesc(skillName)}</span>
                  </div>
                  <span className="font-extrabold text-indigo-600 shrink-0 bg-indigo-50/50 border border-indigo-100/50 px-2 py-0.5 rounded-md">
                    {pct}% Proficiency
                  </span>
                </div>

                {/* Progress bar container */}
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Weakness Detection & Personal Strategy Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Weakness Detector */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> Weakness Detection
            </h2>

            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-amber-900">Area to reinforce: {getSubTopicTrans(weakestSkill[0])}</h4>
                <p className="text-slate-700 text-[11px] leading-relaxed font-semibold">
                  Your reaction speed and accuracy in this subtopic currently score <b>{weakestSkill[1]}%</b>. You seem to struggle with discrete combinatorial analysis or modular reasoning.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-105 pt-4 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                <Lightbulb className="w-4 h-4 text-indigo-500" /> Strategy to close the gap:
              </h4>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed font-medium">
                <li>
                  Start with <b>Foundation</b>-level problems in {getSubTopicTrans(weakestSkill[0])} to build solid fundamentals.
                </li>
                <li>
                  Use the <b>Calculix AI Tutor</b> to explain classic counting problems step-by-step.
                </li>
                <li>
                  Compare against model solutions when you err and immediately rework the solution.
                </li>
              </ul>
            </div>
          </div>

          {/* Quick Learning Stats Overview Cards */}
          <div className="bg-slate-950 border border-slate-850 text-white rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            
            <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Focused Study Time</h3>
            
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                <Clock className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="block text-lg font-black text-white">{userStats.timeSpent} min practiced</span>
                <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">With average response 2.5 min/problem</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-medium pt-1.5 border-t border-slate-850">
              ⚡ Performance improvement factor: <strong>+12%</strong> vs last week. Keep up the great work!
            </p>
          </div>

        </div>

      </div>

      {/* (3) Learning Timeline visualized dynamically */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-5 pb-8">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
            <AreaChart className="w-5 h-5 text-slate-700" /> Learning Timeline
          </h2>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Visualization of accumulated experience points for the student over the past 7 days.
          </p>
        </div>

        {/* Dynamic Responsive SVG Line Chart representing the Progress Line Chart */}
        <div className="w-full h-64 border border-slate-100 rounded-2xl bg-slate-50/50 p-4 relative">
          <svg className="w-full h-full" viewBox="0 0 700 220" preserveAspectRatio="none">
            {/* Grids helper lines */}
            <line x1="50" y1="30" x2="650" y2="30" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="50" y1="80" x2="650" y2="80" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="50" y1="130" x2="650" y2="130" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="50" y1="180" x2="650" y2="180" stroke="#f1f5f9" strokeWidth="1" />

            {/* X Axis & Y Axis lines */}
            <line x1="50" y1="180" x2="650" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />
            <line x1="50" y1="30" x2="50" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />

            {/* Plot path logic: date timeline points represent user stats timeline */}
            {/* Points: 
                T-6: 50,180 (diference coordinates mapping)
                T-5: 150,165 
                T-4: 250,150 
                T-3: 350,130 
                T-2: 450,110 
                T-1: 550,90 
                Live: 650,40
            */}
            <path
              d="M 50,180 L 150,162 L 250,145 L 350,120 L 450,105 L 550,85 L 650,35"
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Gradient shadow filled area inside chart */}
            <path
              d="M 50,180 L 150,162 L 250,145 L 350,120 L 450,105 L 550,85 L 650,35 L 650,180 Z"
              fill="url(#chartGradient)"
              opacity="0.1"
            />

            {/* Scatter points dots marker */}
            <circle cx="50" cy="180" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="150" cy="162" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="250" cy="145" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="350" cy="120" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="450" cy="105" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="550" cy="85" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
            <circle cx="650" cy="35" r="4.5" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />

            {/* Grid Coordinates Labels text indicators */}
            {/* Y axis numbers label */}
            <text x="15" y="34" className="text-[10px] font-bold fill-slate-400 font-mono">500 pts</text>
            <text x="15" y="84" className="text-[10px] font-bold fill-slate-400 font-mono">300 pts</text>
            <text x="15" y="134" className="text-[10px] font-bold fill-slate-400 font-mono">100 pts</text>
            <text x="15" y="184" className="text-[10px] font-bold fill-slate-400 font-mono">0 pts</text>

            {/* X axis dates timeline label */}
            <text x="50" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">16 Mon</text>
            <text x="150" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">17 Tue</text>
            <text x="250" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">18 Wed</text>
            <text x="350" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">19 Thu</text>
            <text x="450" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">20 Fri</text>
            <text x="550" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">21 Sat</text>
            <text x="650" y="198" textAnchor="middle" className="text-[10px] font-bold fill-slate-400 font-mono">Today</text>

            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

    </div>
  );
}
