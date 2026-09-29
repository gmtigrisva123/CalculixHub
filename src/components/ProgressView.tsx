/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AreaChart, TrendingUp, AlertTriangle, BookOpen, Clock, Lightbulb, Radar as RadarIcon, Route, Sparkles, Bug, CheckCircle2 } from 'lucide-react';
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';
import { UserStats, Topic } from '../../shared/types';
import { TOPIC_META, formatMinutes } from '../lib/topics';
import { forecastProgress, analyzeErrorPatterns, buildLearningPath, computeMetrics } from '../domain/analytics';
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
  const defaultSkills: Record<Topic, number> = {
    Algebra: 0,
    Geometry: 0,
    Combinatorics: 0,
    'Number Theory': 0,
  };

  const currentSkills: Record<Topic, number> = {
    ...defaultSkills,
    ...(userStats.skills || {}),
  };

  const topicsList: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
  const skillEntries = topicsList.map((t) => [t, Math.max(0, currentSkills[t] ?? 0)] as [Topic, number]);
  const sortedSkills = [...skillEntries].sort((a, b) => a[1] - b[1]);
  const weakestSkill = sortedSkills[0] || ['Algebra', 0];
  const hasLearningEvidence = userStats.completedCount > 0 || (userStats.learningTimeline?.length ?? 0) > 0;

  const radarData = skillEntries.map(([topic, value]) => ({ label: TOPIC_META[topic].short, value }));
  const timelineData = (userStats.learningTimeline || []).map((t) => ({ date: t.date.slice(5), value: t.points }));

  const avgMinutesPerProblem = userStats.completedCount > 0 ? userStats.timeSpent / userStats.completedCount : 0;
  const forecast = forecastProgress(userStats);
  const errorPatterns = analyzeErrorPatterns(userStats);
  const learningPath = buildLearningPath(userStats);
  const metrics = computeMetrics(userStats);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="type-eyebrow text-violet-500 font-mono text-xs uppercase">Psychometrics &amp; Learning Analytics</p>
        <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-violet-500" /> Analytics &amp; Performance Roadmap
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Skill Radar & Domain Meters */}
        <div className="lg:col-span-7 cx-glass-panel p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
              <RadarIcon className="w-5 h-5 text-indigo-500" /> Skill Mastery Radar
            </h2>
            <p className="text-xs text-content-subtle font-mono">Real-time domain ability distribution updated after every problem.</p>
          </div>

          <div className="max-w-sm mx-auto py-2">
            <RadarChart data={radarData} color="#6366f1" />
          </div>

          {/* Domain Breakdown Bars */}
          <div className="space-y-4 pt-4 border-t border-line">
            {skillEntries.map(([skillName, pct], index) => (
              <StaggerItem key={skillName} index={index} inView className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-content block">{TOPIC_META[skillName].label}</span>
                    <span className="text-[11px] text-content-subtle block mt-0.5 font-mono">{SKILL_DESCRIPTIONS[skillName]}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-indigo-500 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                    <AnimatedNumber value={pct} />%
                  </span>
                </div>
                <SpringBar
                  value={pct}
                  track="w-full bg-line h-1.5 rounded-full overflow-hidden"
                  fill="bg-indigo-500 h-1.5 rounded-full"
                  label={`${TOPIC_META[skillName].label} mastery`}
                />
              </StaggerItem>
            ))}
          </div>
        </div>

        {/* Right Column: Weakness Detection & Focus Time */}
        <div className="lg:col-span-5 space-y-6">
          {/* Weakness Alert Card */}
          <div className="cx-glass-panel p-6 space-y-4 border-amber-500/30">
            <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> Where to focus next
            </h2>

            {hasLearningEvidence ? <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wide">Explore {TOPIC_META[weakestSkill[0]].label}</h4>
              <p className="text-xs leading-relaxed font-medium">
                {weakestSkill[1] === 0 ? 'There is no mastery reading here yet. Try a few questions to build a clearer picture.' : <>Your current mastery reading is <strong>{weakestSkill[1]}%</strong>. A few more questions can help you develop this area.</>}
              </p>
            </div> : <div className="p-4 rounded-xl border border-line bg-surface text-content-muted">
              <p className="text-sm leading-relaxed">Your focus area will appear after you solve a question. There is no weakness to measure yet.</p>
            </div>}

            {hasLearningEvidence && <div className="border-t border-line pt-4 space-y-2.5 text-xs text-content-muted">
              <h4 className="font-semibold text-content flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-indigo-500" /> Recommended Action Plan:
              </h4>
              <ul className="space-y-2 list-disc list-inside font-mono">
                <li>Solve 5 <strong>Foundation</strong> level {TOPIC_META[weakestSkill[0]].label} problems.</li>
                <li>Consult the <strong>Socratic AI Tutor</strong> on key formulas.</li>
                <li>Review worked solutions carefully after each attempt.</li>
              </ul>
            </div>}
          </div>

          {/* Practice Velocity Chart */}
          <div className="cx-glass-panel p-6 space-y-4">
            <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
              <AreaChart className="w-5 h-5 text-indigo-500" /> Practice Velocity
            </h2>
            <div className="h-44">
              <VelocityChart data={timelineData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
