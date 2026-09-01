/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { m } from 'motion/react';
import { Flame, Trophy, Percent, Clock, Brain, AlertTriangle, ChevronRight, Sparkles, Target } from 'lucide-react';
import { UserStats, WeeklyChallenge, Contest, AIRecommendation, Topic, Level } from '../../shared/types';
import { TOPIC_META, getRankForPoints, formatMinutes } from '../lib/topics';
import { getLastNDateKeys } from '../domain/streak';
import { apiUrl } from '../services/apiBase';
import { duration, ease, spring, staggerDelay } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';
import DailyReflexWidget from './DailyReflexWidget';

interface DashboardProps {
  userStats: UserStats;
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  onNavigateToTab: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
  onRewardPoints?: (pts: number) => void;
}

interface MonthGrid {
  monthIndex: number;
  monthName: string;
  isCurrentMonth: boolean;
  cells: { isEmpty: boolean; dateKey: string; dayNum: number; isToday: boolean }[];
}

function get12MonthsGrid(targetYear?: number): MonthGrid[] {
  const now = new Date();
  const currentYear = targetYear ?? now.getFullYear();
  const months: MonthGrid[] = [];

  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(currentYear, m, 1);
    const dayOfWeek = firstDay.getDay();
    const startOffset = (dayOfWeek === 0 ? 7 : dayOfWeek) - 1;

    const totalDays = new Date(currentYear, m + 1, 0).getDate();
    const todayKey = now.toISOString().slice(0, 10);
    const monthName = firstDay.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const cells: { isEmpty: boolean; dateKey: string; dayNum: number; isToday: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ isEmpty: true, dateKey: `empty-${currentYear}-${m}-${i}`, dayNum: 0, isToday: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(m + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateKey = `${currentYear}-${monthStr}-${dayStr}`;

      cells.push({
        isEmpty: false,
        dateKey,
        dayNum: d,
        isToday: dateKey === todayKey,
      });
    }

    months.push({
      monthIndex: m,
      monthName,
      isCurrentMonth: currentYear === now.getFullYear() && m === now.getMonth(),
      cells,
    });
  }

  return months;
}

export default function Dashboard({
  userStats,
  weeklyChallenges,
  contests,
  onNavigateToTab,
  onJoinChallenge,
  onJoinContest,
  onRewardPoints,
}: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const fetchAIRecommendations = async () => {
      setLoadingAI(true);
      try {
        const response = await fetch(apiUrl('/api/recommend'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: userStats.points,
            completedCount: userStats.completedCount,
            accuracy: userStats.accuracy,
            skills: userStats.skills,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendation(data);
        }
      } catch (err) {
        console.error('Error fetching AI recommendation:', err);
      } finally {
        setLoadingAI(false);
      }
    };

    fetchAIRecommendations();
  }, [userStats.points, userStats.completedCount, userStats.accuracy, userStats.skills]);

  const rank = getRankForPoints(userStats.points);
  const flameRef = useAmbient<SVGSVGElement>();
  const aiSparkleRef = useAmbient<SVGSVGElement>();
  const unmeasured = userStats.completedCount === 0;

  return (
    <div className="space-y-7">
      {/* Hero AI OS Banner */}
      <section className="ramp-static cx-band rounded-2xl px-8 py-10 md:px-11 md:py-11 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="cx-band__wash" aria-hidden="true" />
        
        <div className="relative z-10 max-w-[65ch]">
          <div className="cx-pill bg-white/10 backdrop-blur-md border border-white/20 text-amber-300">
            <Trophy className="w-3.5 h-3.5" /> Calculix AI Operating System
          </div>
          
          <h1 className="type-display mt-5 text-stone-50 font-serif leading-tight">
            {unmeasured
              ? 'Begin your calibrated placement assessment'
              : 'Sharpen structural reasoning & mathematical reflexes'}
          </h1>
          
          <p className="type-lead mt-4 text-stone-300 text-sm md:text-base leading-relaxed">
            {unmeasured
              ? 'Solve 8 to 16 adaptive 3PL IRT items to measure your domain abilities across Algebra, Geometry, Combinatorics, and Number Theory.'
              : 'Targeted adaptive practice engineered to elevate your ability parameter θ toward AMC, AIME, and Olympiad standards.'}
          </p>
          
          <div className="mt-6 flex flex-wrap gap-3.5">
            <m.button
              onClick={() => onNavigateToTab('learn')}
              whileTap={{ scale: 0.96 }}
              transition={spring.press}
              className="cx-btn cx-btn-fill bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 px-6 py-3 rounded-xl font-medium"
            >
              <Brain className="w-4 h-4" /> Start Practising
            </m.button>
            
            <m.button
              onClick={() => onNavigateToTab('progress')}
              whileTap={{ scale: 0.96 }}
              transition={spring.press}
              className="cx-btn cx-btn-on-dark px-6 py-3 rounded-xl font-medium border border-white/20 hover:bg-white/10"
            >
              View Analytics
            </m.button>
          </div>
        </div>
      </section>

      {/* Daily Math Reflex Warm-up Widget */}
      <DailyReflexWidget onRewardXP={onRewardPoints} />

      {/* 4 Core Stat Cards Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        {/* Rank Tier Card */}
        <StaggerItem index={0} className="cx-card-quantum cx-tint-algebra flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-widest text-[10px] uppercase font-semibold">Rank Tier</p>
              <h3 className="cx-figure mt-1 text-2xl font-bold text-content">{rank.name}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs text-content-muted font-mono tnum">
              <span><AnimatedNumber value={userStats.points} /> pts</span>
              <span>{userStats.level || 'Unplaced'}</span>
            </div>
            <SpringBar
              value={(userStats.points / 500) * 100}
              track="w-full h-1.5 bg-line-strong rounded-full overflow-hidden"
              fill="h-1.5 bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full"
              label="Progress toward 500 points"
            />
          </div>
        </StaggerItem>

        {/* Streak Card */}
        <StaggerItem index={1} className="cx-card-quantum cx-tint-algebra flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-widest text-[10px] uppercase font-semibold">Daily Streak</p>
              <h3 className="cx-figure mt-1 text-2xl font-bold text-content">
                <AnimatedNumber value={userStats.streak} /> days
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
              <Flame
                ref={flameRef}
                className={`w-5 h-5 ${userStats.streak > 0 ? 'text-indigo-500 animate-pulse' : 'text-content-subtle'}`}
              />
            </div>
          </div>
          <p className="type-caption mt-4 text-xs leading-relaxed text-content-muted">
            {userStats.streak > 0
              ? 'Streak active! Solve a problem daily to hold momentum.'
              : 'Solve one problem today to light your daily flame.'}
          </p>
        </StaggerItem>

        {/* Accuracy Card */}
        <StaggerItem index={2} className="cx-card-quantum cx-tint-number-theory flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-widest text-[10px] uppercase font-semibold">Accuracy Rate</p>
              <h3 className={`cx-figure mt-1 text-2xl font-bold ${unmeasured ? 'text-content-subtle' : 'text-content'}`}>
                {unmeasured ? 'Not measured' : <><AnimatedNumber value={userStats.accuracy} />%</>}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          {unmeasured ? (
            <p className="type-caption mt-4 text-xs leading-relaxed text-content-muted">Requires at least 1 graded answer.</p>
          ) : (
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs text-content-muted font-mono tnum">
                <span><AnimatedNumber value={userStats.completedCount} /> solved</span>
                <span>Target 80%</span>
              </div>
              <SpringBar
                value={userStats.accuracy}
                track="w-full h-1.5 bg-line-strong rounded-full overflow-hidden"
                fill="h-1.5 bg-cyan-500 rounded-full"
                label="Accuracy percentage"
              />
            </div>
          )}
        </StaggerItem>

        {/* Time Invested Card */}
        <StaggerItem index={3} className="cx-card-quantum cx-tint-geometry flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-widest text-[10px] uppercase font-semibold">Focus Time</p>
              <h3 className="cx-figure mt-1 text-2xl font-bold text-content">{formatMinutes(userStats.timeSpent)}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="type-caption mt-4 text-xs leading-relaxed text-content-muted">
            {unmeasured
              ? 'Calculated from your first problem session.'
              : <>Roughly <span className="font-semibold text-content">{Math.max(1, Math.round(userStats.timeSpent / 25))} focused sessions</span> completed.</>}
          </p>
        </StaggerItem>
      </section>

      {/* 12-Month Swipable Activity Calendar Grid */}
      <section className="cx-glass-panel p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="type-title text-xl font-semibold text-content flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" /> Yearly Activity Heatmap
            </h3>
            <p className="type-caption text-xs text-content-subtle mt-1">
              Tracks your daily website visits &amp; practice. Swipe right to view all 12 months.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Year Selector Tabs */}
            <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-line">
              {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                    yr === selectedYear
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-content-subtle hover:text-content'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            <span className="cx-tag text-xs font-mono font-semibold px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300">
              🔥 {userStats.streak} {userStats.streak === 1 ? 'day' : 'days'} streak
            </span>
          </div>
        </div>

        {/* Horizontal Swipable Track for 12 Months */}
        <div className="overflow-x-auto pb-4 pt-1 flex gap-5 scrollbar-thin scroll-smooth focus:outline-none">
          {get12MonthsGrid(selectedYear).map((monthObj) => (
            <div
              key={monthObj.monthIndex}
              className={`flex-none p-3.5 rounded-2xl border transition-all ${
                monthObj.isCurrentMonth
                  ? 'border-amber-500/40 bg-amber-500/5 shadow-md shadow-amber-500/5'
                  : 'border-line bg-surface-sunken/20'
              }`}
            >
              <div className="flex items-center justify-between border-b border-line pb-2 mb-2 font-mono">
                <span className={`text-xs font-bold ${monthObj.isCurrentMonth ? 'text-amber-500 font-extrabold' : 'text-content'}`}>
                  {monthObj.monthName}
                </span>
                {monthObj.isCurrentMonth && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    Current
                  </span>
                )}
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1.5 text-center mb-1 font-mono text-[9px] font-bold text-content-subtle uppercase">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>

              {/* Micro-sized Square Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthObj.cells.map((day, index) => {
                  if (day.isEmpty) {
                    return <div key={day.dateKey} className="w-6 h-6 sm:w-7 sm:h-7" />;
                  }

                  const isActive = (userStats.learningTimeline || []).some((t) => t.date === day.dateKey);
                  const isToday = day.isToday;

                  return (
                    <m.div
                      key={day.dateKey}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...spring.snappy, delay: staggerDelay(index, 0.008) }}
                      title={`${day.dateKey}: ${isActive ? 'Active (Visited/Practiced)' : 'No activity'}`}
                      className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-md border flex flex-col items-center justify-center transition-all duration-150 cursor-default group ${
                        isActive
                          ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-300 text-stone-950 shadow-xs shadow-amber-500/30 scale-[1.06]'
                          : 'border-line bg-surface-sunken/40 text-content-subtle opacity-35 hover:opacity-80'
                      } ${isToday ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-surface' : ''}`}
                    >
                      <Flame
                        className={`w-3 h-3 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-stone-950 fill-stone-950 animate-pulse' : 'text-content-subtle opacity-30'
                        }`}
                      />
                    </m.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend Footer */}
        <div className="pt-2 border-t border-line flex items-center justify-between text-xs text-content-subtle font-mono flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-amber-400 to-amber-600 inline-block border border-amber-300 shadow-sm" /> Active Visit (Golden Yellow &amp; Flame)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-surface-sunken border border-line inline-block opacity-40" /> Inactive Day
            </span>
          </div>

          <span className="text-[11px] text-content-subtle font-semibold">
            12 Months Swipable Track ({new Date().getFullYear()})
          </span>
        </div>
      </section>

      {/* AI Recommendation & Contests Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Practice Recommendation */}
        <div className="cx-glass-panel p-6.5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="type-title text-xl font-semibold text-content flex items-center gap-2">
              <Sparkles ref={aiSparkleRef} className="w-5 h-5 text-indigo-500" /> AI Practice Coach
            </h3>
            <span className="type-eyebrow text-xs text-content-subtle font-mono">3PL IRT Adaptive Engine</span>
          </div>

          {loadingAI ? (
            <div className="p-6 rounded-xl border border-line bg-surface-sunken/50 animate-pulse space-y-3">
              <div className="h-4 bg-line rounded w-3/4" />
              <div className="h-3 bg-line rounded w-1/2" />
            </div>
          ) : recommendation ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Recommended Focus</span>
                  <span className="cx-tag cx-tag-accent text-[10px]">{recommendation.recommendedTopic}</span>
                </div>
                <h4 className="font-semibold text-content text-base">{recommendation.recommendation}</h4>
                <p className="text-xs text-content-muted leading-relaxed">{recommendation.rationale}</p>
              </div>

              <m.button
                onClick={() =>
                  onNavigateToTab('learn', {
                    topic: recommendation.recommendedTopic,
                    level: recommendation.suggestedLevel,
                  })
                }
                whileTap={{ scale: 0.96 }}
                transition={spring.press}
                className="w-full cx-btn cx-btn-fill py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
              >
                <span>Practice Recommended Set</span>
                <ChevronRight className="w-4 h-4" />
              </m.button>
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-line bg-surface-sunken/40 space-y-3">
              <p className="text-xs text-content-muted leading-relaxed">
                Complete more problems to generate personalized AI recommendations based on your error patterns.
              </p>
              <m.button
                onClick={() => onNavigateToTab('learn')}
                whileTap={{ scale: 0.96 }}
                transition={spring.press}
                className="cx-btn cx-btn-primary px-4 py-2 rounded-lg text-xs"
              >
                Go to Learn Workspace
              </m.button>
            </div>
          )}
        </div>

        {/* Contests & Weekly Challenges Preview */}
        <div className="cx-glass-panel p-6.5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="type-title text-xl font-semibold text-content flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-500" /> Contests &amp; Tournaments
            </h3>
            <m.button
              onClick={() => onNavigateToTab('compete')}
              whileTap={{ scale: 0.95 }}
              className="text-xs text-indigo-500 hover:underline font-semibold"
            >
              View Arena
            </m.button>
          </div>

          <div className="space-y-3">
            {contests.slice(0, 2).map((contest) => (
              <div
                key={contest.id}
                className="p-4 rounded-xl border border-line bg-surface-raised hover:border-indigo-500/40 transition-colors flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {contest.status}
                    </span>
                    <span className="text-xs text-content-subtle font-mono">{contest.duration}</span>
                  </div>
                  <h4 className="font-semibold text-content text-sm">{contest.title}</h4>
                </div>

                <m.button
                  onClick={() => onJoinContest(contest.id)}
                  whileTap={{ scale: 0.95 }}
                  className="cx-btn cx-btn-primary px-3 py-1.5 rounded-lg text-xs shrink-0"
                >
                  Enter
                </m.button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
