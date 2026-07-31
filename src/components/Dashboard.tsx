/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Percent, Clock, Sparkles, Brain, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import { UserStats, WeeklyChallenge, Contest, AIRecommendation, Topic, Level } from '../types';
import { TOPIC_META, getRankForPoints, formatMinutes } from '../lib/topics';
import { getLastNDateKeys } from '../lib/streak';
import { apiUrl } from '../lib/apiBase';

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

  return (
    <div className="space-y-8">
      {/* Welcome Hero */}
      <div className="bg-ink-950 border border-ink-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl text-white bp-corners">
        <div className="absolute inset-0 bp-grid-dark opacity-40 pointer-events-none" />
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-brass-500/10 to-proof-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-brass-500/15 border border-brass-400/30 text-brass-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Trophy className="w-3.5 h-3.5" /> CalculixHub Operating System
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-serif">
            Sharpen how you think, not just what you remember
          </h1>
          <p className="text-stone-400 text-sm leading-relaxed max-w-xl">
            Welcome back to <b>CalculixHub</b>. Every session here is built to strengthen structural reasoning, not rote memorization &mdash; practice that actually moves your ceiling.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigateToTab('learn')}
              className="bg-white hover:bg-stone-100 text-ink-950 font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-ink-950" /> Start practicing
            </button>
            <button
              onClick={() => onNavigateToTab('progress')}
              className="bg-ink-800 hover:bg-ink-700 text-white font-medium text-sm px-5 py-3 rounded-xl transition-all border border-ink-700 cursor-pointer"
            >
              View analytics
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-stone-400 font-medium">Rank tier</p>
              <h3 className="font-extrabold text-stone-900 text-lg mt-0.5">{rank.name}</h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${rank.bg} ${rank.border}`}>
              <Trophy className={`w-5 h-5 ${rank.text}`} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-stone-500 mb-1.5">
              <span>{userStats.points} pts</span>
              <span>{userStats.level} tier</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5">
              <div className="bg-ink-950 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (userStats.points / 500) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-stone-400 font-medium">Daily streak</p>
              <h3 className="font-extrabold text-stone-900 text-lg mt-0.5">{userStats.streak} days</h3>
            </div>
            <div className={`p-2.5 rounded-xl border ${userStats.streak > 0 ? 'bg-orange-50 border-orange-100' : 'bg-stone-50 border-stone-100'}`}>
              <Flame className={`w-5 h-5 ${userStats.streak > 0 ? 'text-orange-500 animate-pulse' : 'text-stone-400'}`} />
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-4 leading-relaxed">
            {userStats.streak > 0
              ? 'Streak is live — keep it going to hold your compounding gains.'
              : 'Solve at least one problem today to light the streak.'}
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-stone-400 font-medium">Accuracy</p>
              <h3 className="font-extrabold text-stone-900 text-lg mt-0.5">{userStats.accuracy}%</h3>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100">
              <Percent className="w-5 h-5 text-sky-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-stone-500 mb-1.5">
              <span>{userStats.completedCount} solved</span>
              <span>Target: 80%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5">
              <div className="bg-ink-950 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${userStats.accuracy}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-stone-400 font-medium">Time invested</p>
              <h3 className="font-extrabold text-stone-900 text-lg mt-0.5">{formatMinutes(userStats.timeSpent)}</h3>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100">
              <Clock className="w-5 h-5 text-proof-500" />
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-4 leading-relaxed">
            Roughly <b>{Math.max(1, Math.round(userStats.timeSpent / 25))} focused Pomodoro sessions</b> so far.
          </p>
        </div>
      </div>

      {/* Streak calendar: which of the last 7 real calendar days had activity */}
      <div className="bg-white border border-stone-200 p-5 md:p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-sm text-stone-800 flex items-center gap-2">
              <Flame className={`w-4.5 h-4.5 ${userStats.streak > 0 ? 'text-orange-500' : 'text-stone-400'}`} /> Streak Calendar
            </h3>
            <p className="text-[11px] text-stone-400 mt-0.5">Lights up on every real day you showed up and practiced.</p>
          </div>
          <span className="text-xs font-extrabold text-stone-900 bg-stone-50 border border-stone-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
            {userStats.streak} {userStats.streak === 1 ? 'day' : 'days'} active
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {getLastNDateKeys(7).map((dateKey) => {
            const isActive = (userStats.learningTimeline || []).some((t) => t.date === dateKey);
            const isToday = dateKey === new Date().toISOString().slice(0, 10);
            const dayLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = new Date(`${dateKey}T00:00:00`).getDate();
            return (
              <div key={dateKey} className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase text-stone-400 tracking-wider">{dayLabel}</span>
                <div
                  className={`w-full aspect-square rounded-xl border flex items-center justify-center transition-all ${
                    isActive ? 'bg-orange-50 border-orange-200' : 'bg-stone-50 border-stone-100'
                  } ${isToday ? 'ring-2 ring-brass-400 ring-offset-1' : ''}`}
                >
                  <Flame className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'text-orange-500' : 'text-stone-300'}`} />
                </div>
                <span className={`text-[9px] font-semibold ${isToday ? 'text-brass-700' : 'text-stone-400'}`}>{dayNum}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-stone-500 mt-5 leading-relaxed border-t border-stone-100 pt-4">
          {userStats.streak > 0
            ? 'Streak is live — keep it going to hold your compounding gains.'
            : 'Solve at least one problem today to light your first flame.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI Recommendation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2 font-serif">
              <Sparkles className="w-5 h-5 text-brass-600 animate-pulse" /> AI Recommendation
            </h2>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">EduReach Core Engine</span>
          </div>

          <div className="bg-gradient-to-br from-brass-50 to-proof-50/40 border border-brass-100 p-6 rounded-2xl shadow-xs space-y-5 relative">
            <div className="absolute right-4 top-4.5 bg-brass-500/10 p-1.5 rounded-lg border border-brass-500/20 text-brass-600 block">
              <Sparkles className="w-4 h-4" />
            </div>

            {loadingAI ? (
              <div className="space-y-3 py-4">
                <div className="h-5 bg-brass-200/50 rounded-md w-1/3 animate-pulse" />
                <div className="h-16 bg-brass-100/50 rounded-lg animate-pulse" />
                <div className="h-8 bg-brass-100/50 rounded-lg animate-pulse" />
              </div>
            ) : recommendation ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block bg-brass-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-md">Focus topic</span>
                    {recommendation.isFallback && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Offline fallback engine
                      </span>
                    )}
                  </div>
                  <p className="text-stone-800 text-sm italic font-medium leading-relaxed">&ldquo;{recommendation.recommendation}&rdquo;</p>
                </div>

                <div className="border-t border-brass-100 pt-4 flex gap-4 items-start">
                  <div className="bg-white p-3 rounded-xl border border-brass-100 shadow-2xs shrink-0 text-center min-w-[100px]">
                    <span className="block text-[9px] text-stone-400 font-bold uppercase">Target tier</span>
                    <span className="block text-xs font-extrabold text-brass-800 mt-0.5">{recommendation.suggestedLevel}</span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-stone-900">Why this fits:</h4>
                    <p className="text-stone-600 text-xs leading-relaxed">{recommendation.rationale}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onNavigateToTab('learn', { topic: recommendation.recommendedTopic, level: recommendation.suggestedLevel })}
                    className="w-full sm:w-auto bg-ink-950 hover:bg-black text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 group"
                  >
                    Reinforce {TOPIC_META[recommendation.recommendedTopic].label}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-stone-500 text-xs">No recommendation available yet &mdash; solve a few more problems.</div>
            )}
          </div>

          <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-stone-800">Practice Pace</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block">Total points</span>
                <span className="text-lg font-extrabold text-stone-900">{userStats.points} pts</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block">Problems solved</span>
                <span className="text-lg font-extrabold text-stone-900">{userStats.completedCount}</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block">Avg. per problem</span>
                <span className="text-lg font-extrabold text-stone-900">
                  ~{userStats.completedCount > 0 ? (userStats.timeSpent / userStats.completedCount).toFixed(1) : '0'} min
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block">Weekly target</span>
                <span className="text-lg font-extrabold text-proof-600">
                  {weeklyChallenges.length > 0 ? Math.round((weeklyChallenges.filter((wc) => wc.completed).length / weeklyChallenges.length) * 100) : 0}% done
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Competition panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2 font-serif">
              <Calendar className="w-5 h-5 text-stone-800" /> Competition System
            </h2>
            <button onClick={() => onNavigateToTab('compete')} className="text-xs text-brass-700 hover:text-brass-800 font-semibold cursor-pointer">
              View all
            </button>
          </div>

          <div className="space-y-3.5">
            {contests.slice(0, 2).map((cont) => (
              <div key={cont.id} className="bg-white border border-stone-200 rounded-2xl p-4.5 hover:border-stone-300 transition-all shadow-2xs flex flex-col justify-between">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      Upcoming arena
                    </span>
                    <h3 className="font-extrabold text-stone-900 text-sm mt-1">{cont.title}</h3>
                  </div>
                  <div className="text-xs font-semibold text-stone-500 shrink-0">{cont.duration}</div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <div className="text-xs text-stone-400 font-medium">
                    Date: <span className="text-stone-800 font-semibold">{cont.date}</span>
                  </div>
                  <button
                    onClick={() => onJoinContest(cont.id)}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                      cont.joined ? 'bg-proof-50 text-proof-700 border border-proof-100' : 'bg-ink-950 hover:bg-black text-white hover:shadow-xs active:scale-95'
                    }`}
                  >
                    {cont.joined ? 'Registered' : 'Join now'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-ink-950 border border-ink-800 text-white rounded-2xl p-5 relative overflow-hidden shadow-md">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-brass-500/10 rounded-full blur-xl pointer-events-none" />
            <span className="bg-brass-500/20 text-brass-300 border border-brass-400/30 text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider uppercase inline-block mb-2">
              Weekly challenge
            </span>
            {weeklyChallenges[0] && (
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm tracking-wide text-brass-100">{weeklyChallenges[0].title}</h4>
                <p className="text-[11px] text-stone-400 leading-relaxed line-clamp-2">{weeklyChallenges[0].description}</p>
                <div className="flex items-center justify-between border-t border-ink-800 pt-3 mt-4">
                  <span className="text-[10px] text-stone-500">
                    Registered: <b>{weeklyChallenges[0].participants}</b>
                  </span>
                  <button
                    onClick={() => { onJoinChallenge(weeklyChallenges[0].id); onNavigateToTab('compete'); }}
                    className={`text-xs font-bold px-4 py-2 rounded-lg cursor-pointer ${
                      weeklyChallenges[0].completed ? 'bg-ink-800 text-stone-400' : 'bg-brass-500 hover:bg-brass-600 text-ink-950 font-extrabold active:scale-95 transition-all'
                    }`}
                  >
                    {weeklyChallenges[0].completed ? 'Completed' : 'View challenge'}
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
