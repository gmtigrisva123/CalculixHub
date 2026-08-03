/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AreaChart, TrendingUp, AlertTriangle, BookOpen, Clock, Lightbulb, Radar as RadarIcon, Route, Sparkles, Bug, CheckCircle2 } from 'lucide-react';
// No section-level Reveal here: the radar and velocity charts run their own
// in-view draw, and every list below staggers itself. Wrapping the cards too
// would animate the same content twice on one scroll.
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';
import { UserStats, Topic } from '../types';
import { TOPIC_META, formatMinutes } from '../lib/topics';
import { forecastProgress, analyzeErrorPatterns, buildLearningPath, computeMetrics } from '../lib/analytics';
import RadarChart from './charts/RadarChart';
import VelocityChart from './charts/VelocityChart';

interface ProgressViewProps {
  userStats: UserStats;
}

const SKILL_DESCRIPTIONS: Record<string, string> = {
  Algebra: 'Manipulating algebraic expressions, extremal points, and polynomial equations.',
  Geometry: 'Spatial intuition and planar theorems such as Ptolemy and Brahmagupta.',
  Combinatorics: 'Counting reflexes, stars-and-bars techniques, and graph connectivity.',
  'Number Theory': 'Modular arithmetic, Euler\'s totient function, and prime lemmas.',
};

export default function ProgressView({ userStats }: ProgressViewProps) {
  const skillEntries = Object.entries(userStats.skills) as [Topic, number][];
  const sortedSkills = [...skillEntries].sort((a, b) => a[1] - b[1]);
  const weakestSkill = sortedSkills[0];

  const radarData = skillEntries.map(([topic, value]) => ({ label: TOPIC_META[topic].short, value }));
  const timelineData = (userStats.learningTimeline || []).map((t) => ({ date: t.date.slice(5), value: t.points }));

  const avgMinutesPerProblem = userStats.completedCount > 0 ? userStats.timeSpent / userStats.completedCount : 0;
  const targetMinutesPerProblem = 4;
  const paceRatio = avgMinutesPerProblem > 0 ? Math.min(100, (targetMinutesPerProblem / avgMinutesPerProblem) * 100) : 0;

  const forecast = forecastProgress(userStats);
  const errorPatterns = analyzeErrorPatterns(userStats);
  const learningPath = buildLearningPath(userStats);
  const metrics = computeMetrics(userStats);

  const confidenceStyle: Record<string, string> = {
    none: 'bg-stone-100 text-stone-500 border-stone-200',
    low: 'bg-amber-50 text-amber-700 border-amber-200',
    moderate: 'bg-brass-50 text-brass-700 border-brass-200',
    high: 'bg-proof-50 text-proof-700 border-proof-200',
  };

  const severityStyle: Record<string, string> = {
    critical: 'bg-rose-50 border-rose-200 text-rose-700',
    moderate: 'bg-amber-50 border-amber-200 text-amber-700',
    minor: 'bg-stone-50 border-stone-200 text-stone-600',
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-100 pb-4">
        <h1 className="type-title text-content flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-violet-600" /> Analytics &amp; Research
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          EduReach Core turns every practice session into a live picture of your actual mathematical ability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Skill radar */}
        <div className="lg:col-span-7 bg-surface-raised material-card border border-line rounded-panel p-5 md:p-6 shadow-e1 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <RadarIcon className="w-5 h-5 text-stone-700" /> Skill Mastery Radar
            </h2>
            <p className="text-[11px] text-stone-500 leading-relaxed">Cumulative accuracy by domain, updated after every problem.</p>
          </div>

          <div className="max-w-sm mx-auto">
            <RadarChart data={radarData} color="#c8842a" />
          </div>

          <div className="space-y-4 pt-2 border-t border-stone-100">
            {skillEntries.map(([skillName, pct], index) => (
              <StaggerItem key={skillName} index={index} inView className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-stone-900 block">{TOPIC_META[skillName].label}</span>
                    <span className="text-[10px] text-stone-400 font-medium block mt-0.5">{SKILL_DESCRIPTIONS[skillName]}</span>
                  </div>
                  <span className="font-extrabold text-violet-700 shrink-0 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md">
                    <AnimatedNumber value={pct} />%
                  </span>
                </div>
                <SpringBar
                  value={pct}
                  track="w-full bg-stone-100 rounded-full h-2"
                  fill="bg-violet-600 h-2 rounded-full"
                  label={`${TOPIC_META[skillName].label} mastery`}
                />
              </StaggerItem>
            ))}
          </div>
        </div>

        {/* Weakness + focus time */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface-raised material-card border border-line rounded-panel p-5 md:p-6 shadow-e1 space-y-4">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> Weakness Detection
            </h2>

            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-card flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-amber-900">Focus area: {TOPIC_META[weakestSkill[0]].label}</h4>
                <p className="text-stone-700 text-[11px] leading-relaxed font-semibold">
                  Your accuracy here is currently <b>{weakestSkill[1]}%</b>. This usually points to gaps in discrete counting or modular reasoning.
                </p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="font-extrabold text-xs text-stone-800 flex items-center gap-1">
                <Lightbulb className="w-4 h-4 text-violet-500" /> Suggested plan:
              </h4>
              <ul className="text-xs text-stone-600 space-y-2 list-disc list-inside leading-relaxed font-medium">
                <li>Work through <b>Foundation</b>-tier {TOPIC_META[weakestSkill[0]].label} problems first to lock in the basics.</li>
                <li>Ask the <b>Calculix AI Tutor</b> to walk through classic counting patterns.</li>
                <li>Re-derive the model solution by hand right after a miss, don't just read it.</li>
              </ul>
            </div>
          </div>

          <div className="bg-ink-950 border border-ink-850 text-white rounded-panel p-5 shadow-e1 space-y-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />

            <h3 className="font-bold text-xs uppercase text-stone-400 tracking-wider">Focus time</h3>

            <div className="flex items-center gap-3">
              <div className="bg-ink-800 p-2.5 rounded-control border border-ink-700"><Clock className="w-5 h-5 text-violet-400" /></div>
              <div>
                <span className="block text-lg font-black text-white">{formatMinutes(userStats.timeSpent)} practiced</span>
                <span className="block text-[10px] text-stone-400 font-semibold mt-0.5">
                  {userStats.completedCount > 0 ? `~${avgMinutesPerProblem.toFixed(1)} min per problem` : 'No problems solved yet'}
                </span>
              </div>
            </div>

            {userStats.completedCount > 0 && (
              <div className="pt-1.5 border-t border-ink-850 space-y-1.5">
                <div className="flex justify-between text-[10px] text-stone-400 font-semibold">
                  <span>Pace vs. {targetMinutesPerProblem}-min target</span>
                  <span>{Math.round(paceRatio)}%</span>
                </div>
                <SpringBar
                  value={paceRatio}
                  track="w-full bg-ink-800 rounded-full h-1.5"
                  fill="bg-violet-500 h-1.5 rounded-full"
                  label="Pace against the four-minute target"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Learning timeline */}
      <div className="bg-surface-raised material-card border border-line rounded-panel p-6 shadow-e1 space-y-5 pb-8">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
            <AreaChart className="w-5 h-5 text-stone-700" /> Learning Timeline
          </h2>
          <p className="text-[11px] text-stone-500 leading-relaxed">Cumulative points over your recent practice history.</p>
        </div>

        <VelocityChart data={timelineData} color="#8b5cf6" />
      </div>

      {/* Progress prediction */}
      <div className="bg-surface-raised material-card border border-line rounded-panel p-6 shadow-e1 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brass-600" /> Progress Prediction
            </h2>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              AI-projected improvement trajectory, fitted by least squares over your real practice history.
            </p>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${confidenceStyle[forecast.confidence]}`}>
            {forecast.confidence === 'none' ? 'Insufficient data' : `${forecast.confidence} confidence`}
          </span>
        </div>

        {forecast.confidence === 'none' ? (
          <div className="text-center py-8 bg-stone-50 rounded-card border border-dashed border-stone-200">
            <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
              Practice across at least two separate days and the engine will start projecting your trajectory. It won't guess from a single session.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-stone-50 rounded-control border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block uppercase">Velocity</span>
                <span className="text-lg font-extrabold text-stone-900 font-mono"><AnimatedNumber value={forecast.velocity} /></span>
                <span className="text-[9px] text-stone-400 block">pts / active day</span>
              </div>
              <div className="p-4 bg-stone-50 rounded-control border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block uppercase">In 7 days</span>
                <span className="text-lg font-extrabold text-brass-700 font-mono"><AnimatedNumber value={forecast.projected7d} /></span>
                <span className="text-[9px] text-stone-400 block">projected points</span>
              </div>
              <div className="p-4 bg-stone-50 rounded-control border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block uppercase">In 30 days</span>
                <span className="text-lg font-extrabold text-brass-700 font-mono"><AnimatedNumber value={forecast.projected30d} /></span>
                <span className="text-[9px] text-stone-400 block">projected points</span>
              </div>
              <div className="p-4 bg-stone-50 rounded-control border border-stone-100">
                <span className="text-[10px] text-stone-400 font-bold block uppercase">Mastery @30d</span>
                <span className="text-lg font-extrabold text-proof-600 font-mono"><AnimatedNumber value={forecast.projectedMastery30d} />%</span>
                <span className="text-[9px] text-stone-400 block">projected average</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 border-t border-stone-100 pt-4">
              <TrendingUp className={`w-4 h-4 shrink-0 ${forecast.trend === 'accelerating' ? 'text-proof-600' : forecast.trend === 'slowing' ? 'text-amber-600' : 'text-stone-400'}`} />
              <span>
                Trend is <b className="text-stone-800">{forecast.trend}</b>, based on {forecast.sampleDays} recorded {forecast.sampleDays === 1 ? 'day' : 'days'} of activity.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error pattern analysis */}
      <div className="bg-surface-raised material-card border border-line rounded-panel p-6 shadow-e1 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
            <Bug className="w-5 h-5 text-rose-600" /> Error Analysis
          </h2>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Automatic classification of failure modes &mdash; distinguishing computational slips from genuine conceptual gaps.
          </p>
        </div>

        {errorPatterns.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-proof-50 border border-proof-150 rounded-card">
            <CheckCircle2 className="w-5 h-5 text-proof-600 shrink-0" />
            <p className="text-xs text-proof-800 leading-relaxed">
              No weak domains detected &mdash; every topic is above the 70% mastery threshold. Keep pushing into higher tiers.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {errorPatterns.map((pattern, index) => (
              <StaggerItem key={pattern.topic} index={index} inView className="border border-stone-200 rounded-card p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-stone-900">{TOPIC_META[pattern.topic].label}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${severityStyle[pattern.severity]}`}>
                      {pattern.severity}
                    </span>
                    {pattern.classification !== 'none' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border bg-violet-50 border-violet-200 text-violet-700">
                        {pattern.classification === 'computational' ? 'Computational slip' : 'Conceptual gap'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-stone-500">{pattern.mastery}% mastery</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">{pattern.diagnosis}</p>
                <div className="flex items-start gap-2 bg-stone-50 border border-stone-100 rounded-control p-3">
                  <Lightbulb className="w-3.5 h-3.5 text-brass-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-stone-700 leading-relaxed font-medium">{pattern.remediation}</p>
                </div>
              </StaggerItem>
            ))}
          </div>
        )}
      </div>

      {/* Personalized learning path */}
      <div className="bg-surface-raised material-card border border-line rounded-panel p-6 shadow-e1 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
            <Route className="w-5 h-5 text-violet-600" /> Your Learning Path
          </h2>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            A personalized curriculum ordered by measured weakness, at the tier your mastery supports in each domain.
          </p>
        </div>

        <div className="space-y-3">
          {learningPath.map((step, index) => (
            <StaggerItem
              key={step.topic}
              index={index}
              inView
              className={`rounded-card border p-4 flex gap-4 items-start transition-[background-color,border-color] duration-240 ease-standard ${
                step.status === 'current' ? 'bg-violet-50/50 border-violet-200' : 'bg-surface-raised border-stone-200'
              }`}
            >
              <div
                className={`w-8 h-8 shrink-0 rounded-control flex items-center justify-center font-black text-xs font-mono ${
                  step.status === 'current' ? 'bg-violet-600 text-white' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {step.order}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-stone-900">{TOPIC_META[step.topic].label}</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border bg-stone-50 border-stone-200 text-stone-600">
                    {step.tier}
                  </span>
                  {step.status === 'current' && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-violet-600 text-white">Start here</span>
                  )}
                  {step.status === 'next' && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border bg-brass-50 border-brass-200 text-brass-700">Up next</span>
                  )}
                </div>
                <p className="text-[11px] text-stone-700 font-medium">{step.focus}</p>
                <p className="text-[10px] text-stone-400 leading-relaxed">{step.rationale}</p>
              </div>
            </StaggerItem>
          ))}
        </div>
      </div>

      <div className="bg-surface-raised material-card border border-line rounded-panel p-5 shadow-e1 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
        <p className="text-xs text-stone-500 leading-relaxed">
          All charts on this page are computed live from your actual session data (stored locally in your browser) &mdash; nothing here is a placeholder.
        </p>
      </div>
    </div>
  );
}
