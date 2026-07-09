/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Percent, Clock, Sparkles, Brain, ArrowRight, Calendar, AlertTriangle, BookOpen, ChevronRight } from 'lucide-react';
import { UserStats, WeeklyChallenge, Contest, AIRecommendation, Topic, Level } from '../types';

interface DashboardProps {
  userStats: UserStats;
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  onNavigateToTab: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
}

export default function Dashboard({
  userStats,
  weeklyChallenges,
  contests,
  onNavigateToTab,
  onJoinChallenge,
  onJoinContest,
}: DashboardProps) {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    // Fetch AI personal recommendations on mount
    const fetchAIRecommendations = async () => {
      setLoadingAI(true);
      try {
        const response = await fetch('/api/recommend', {
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

  // Translate topic identifiers to user-friendly English titles
  const translateTopic = (topic: Topic) => {
    switch (topic) {
      case 'Algebra': return 'Algebra';
      case 'Geometry': return 'Geometry';
      case 'Combinatorics': return 'Combinatorics & Graphs';
      case 'Number Theory': return 'Number Theory';
      default: return topic;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl text-white">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-400/30 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Trophy className="w-3.5 h-3.5" /> Calculix Operating System
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Unlock deep mathematical thinking capabilities
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Welcome to <b>Calculix Hub</b>. Here advanced math learning is not just memorizing formulas — it's about structural analysis, sharpening reasoning, and pushing academic boundaries.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigateToTab('learn')}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-slate-900" /> Start Practicing
            </button>
            <button
              onClick={() => onNavigateToTab('progress')}
              className="bg-slate-800 hover:bg-slate-700/80 text-white font-medium text-sm px-5  py-3 rounded-xl transition-all border border-slate-700/60 cursor-pointer"
            >
              View Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Stats and Progress */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Overview Card */}
        <div className="bg-white border border-slate-100/80 p-5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Proficiency Level</p>
              <h3 className="font-extrabold text-slate-900 text-lg mt-0.5">{userStats.level}</h3>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
              <span>{userStats.points} Points</span>
              <span>Master target: 500</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-slate-900 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (userStats.points / 500) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="bg-white border border-slate-100/80 p-5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Daily Streak</p>
              <h3 className="font-extrabold text-slate-900 text-lg mt-0.5">{userStats.streak} Days</h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${userStats.streak > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
              <Flame className={`w-5 h-5 ${userStats.streak > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            {userStats.streak > 0
              ? '🔥 Keep the streak alive! Maintain daily practice for consistent improvement.'
              : 'Complete at least one problem today to earn the flame badge!'}
          </p>
        </div>

        {/* Accuracy Card */}
        <div className="bg-white border border-slate-100/80 p-5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Accuracy</p>
              <h3 className="font-extrabold text-slate-900 text-lg mt-0.5">{userStats.accuracy}%</h3>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <Percent className="w-5 h-5 text-sky-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
              <span>Completed {userStats.completedCount} problems</span>
              <span>Target accuracy: 80%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-slate-950 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${userStats.accuracy}%` }}
              />
            </div>
          </div>
        </div>

        {/* Time Spent Card */}
        <div className="bg-white border border-slate-100/80 p-5 rounded-2xl shadow-xs realtive overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Time Spent</p>
              <h3 className="font-extrabold text-slate-900 text-lg mt-0.5">{userStats.timeSpent} min</h3>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            🌿 Approximately <b>{Math.max(1, Math.round(userStats.timeSpent / 25))} focused Pomodoro sessions</b> of deep practice.
          </p>
        </div>
      </div>

      {/* Main Container Split: Recommended Tasks (AI) vs Competition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* AI Recommendations - 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" /> Personalized Recommendations (AI)
            </h2>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">EduReach Core Engine</span>
          </div>

          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-100/60 p-6 rounded-2xl shadow-xs space-y-5 relative">
            <div className="absolute right-4 top-4.5 bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20 text-blue-600 block">
              <Sparkles className="w-4 h-4" />
            </div>

            {loadingAI ? (
              <div className="space-y-3 py-4">
                <div className="h-5 bg-blue-200/50 rounded-md w-1/3 animate-pulse" />
                <div className="h-16 bg-blue-100/50 rounded-lg animate-pulse" />
                <div className="h-8 bg-blue-100/50 rounded-lg animate-pulse" />
              </div>
            ) : recommendation ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-md">
                      Focus Topic
                    </span>
                    {recommendation.isFallback && (
                      <span className="inline-flex items-center gap-1 bg-amber-550/10 border border-amber-500/20 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Offline Fallback Engine
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 text-sm italic font-medium leading-relaxed">
                    "{recommendation.recommendation}"
                  </p>
                </div>

                <div className="border-t border-blue-150 pt-4 flex gap-4 items-start">
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs shrink-0 text-center min-w-[100px]">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Target</span>
                    <span className="block text-xs font-extrabold text-blue-800 mt-0.5">
                      {recommendation.suggestedLevel}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-slate-900">Adaptive scientific features:</h4>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      {recommendation.rationale}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                    <button
                    onClick={() => {
                      onNavigateToTab('learn', {
                        topic: recommendation.recommendedTopic,
                        level: recommendation.suggestedLevel,
                      });
                    }}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 group"
                  >
                    🚀 Reinforce topic {translateTopic(recommendation.recommendedTopic)}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                Unable to load AI insights at the moment. Please continue practicing problems.
              </div>
            )}
          </div>

          {/* Quick Learning Stats Panel */}
          <div className="bg-white border border-slate-100/80 p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-800">Practice Pace Stats</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/60">
                <span className="text-[10px] text-slate-400 font-bold block">Total Points</span>
                <span className="text-lg font-extrabold text-slate-900">{userStats.points} pts</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/60">
                <span className="text-[10px] text-slate-400 font-bold block">Correct / Total</span>
                <span className="text-lg font-extrabold text-slate-900">{userStats.completedCount} problems</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/60">
                <span className="text-[10px] text-slate-400 font-bold block">Response Speed</span>
                <span className="text-lg font-extrabold text-slate-900">
                  ~{userStats.completedCount > 0 ? (userStats.timeSpent / userStats.completedCount).toFixed(1) : '0'} min/problem
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/60">
                <span className="text-[10px] text-slate-400 font-bold block">Weekly Target</span>
                <span className="text-lg font-extrabold text-emerald-600">
                  {weeklyChallenges.length > 0
                    ? Math.round((weeklyChallenges.filter(wc => wc.completed).length / weeklyChallenges.length) * 100)
                    : 0}% Completed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Competition & Challenges Panel - 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-800" /> Competitive System (Compete)
            </h2>
            <button
              onClick={() => onNavigateToTab('compete')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              Expand all
            </button>
          </div>

          {/* Active Contests Mini Cards */}
          <div className="space-y-3.5">
            {contests.slice(0, 2).map((cont) => (
              <div
                key={cont.id}
                className="bg-white border border-slate-100/90 rounded-2xl p-4.5 hover:border-slate-300 transition-all shadow-2xs relative flex flex-col justify-between"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      Upcoming Arena
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{cont.title}</h3>
                  </div>
                      <div className="text-xs font-semibold text-slate-500 shrink-0">
                        ⏱️ {cont.duration}
                      </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                  <div className="text-xs text-slate-400 font-medium">
                    Schedule: <span className="text-slate-800 font-semibold">{cont.date}</span>
                  </div>
                  <button
                    onClick={() => onJoinContest(cont.id)}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                      cont.joined
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-slate-900 hover:bg-black text-white hover:shadow-xs active:scale-95'
                    }`}
                  >
                    {cont.joined ? '✓ Registered' : 'Join Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly Challenge Banner */}
          <div className="bg-slate-950 border border-slate-800 text-white rounded-2xl p-5 relative overflow-hidden shadow-md">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase inline-block mb-2">
              Weekly Challenge
            </span>
            {weeklyChallenges[0] && (
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm tracking-wide text-amber-100">
                  {weeklyChallenges[0].title}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {weeklyChallenges[0].description}
                </p>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                  <span className="text-[10px] text-slate-500">
                    Registered: <b>{weeklyChallenges[0].participants} participants</b>
                  </span>
                  <button
                    onClick={() => {
                      onJoinChallenge(weeklyChallenges[0].id);
                      onNavigateToTab('compete');
                    }}
                    className={`text-xs font-bold px-4 py-2 rounded-lg cursor-pointer ${
                      weeklyChallenges[0].completed
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold active:scale-95 transition-all'
                    }`}
                  >
                    {weeklyChallenges[0].completed ? 'Completed' : 'View Challenge'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
