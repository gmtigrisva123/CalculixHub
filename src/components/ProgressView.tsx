/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, Clock, Compass, Flame, LineChart, Lock, Printer, Radar as RadarIcon, Target } from 'lucide-react';
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';
import { UserStats, Topic } from '../../shared/types';
import { TOPIC_META, formatMinutes } from '../lib/topics';
import RadarChart from './charts/RadarChart';
import VelocityChart from './charts/VelocityChart';
import ProgressReport from './ProgressReport';
import { PageHead } from './surface';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../services/data/plan';
import '../styles/progress.css';

interface ProgressViewProps {
  userStats: UserStats;
  onSeePlans?: () => void;
}

const SKILL_DESCRIPTIONS: Record<string, string> = {
  Algebra: 'Manipulating algebraic expressions, extremal points, and polynomial equations.',
  Geometry: 'Spatial intuition and planar theorems such as Ptolemy and Brahmagupta.',
  Combinatorics: 'Counting reflexes, stars-and-bars techniques, and graph connectivity.',
  'Number Theory': 'Modular arithmetic, Euler\'s totient function, and prime lemmas.',
};

export default function ProgressView({ userStats, onSeePlans }: ProgressViewProps) {
  const { user, profile } = useAuth();
  const plan = usePlan(user?.id ?? null);
  const canPrint = plan.can('progress-report');
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
  const minutes = Math.round(userStats.timeSpent);
  const perProblem = userStats.completedCount > 0 ? Math.max(1, Math.round(userStats.timeSpent / userStats.completedCount)) : 0;
  const weakest = TOPIC_META[weakestSkill[0]].label;

  return (
    <div className="pr">
      <PageHead
        eyebrow="How it’s going"
        title={<>What you know, <em>and what’s next.</em></>}
        lede={hasLearningEvidence
          ? <>Strongest in <strong>{TOPIC_META[sortedSkills[sortedSkills.length - 1][0]].label}</strong>; the most room to grow is in <strong>{weakest}</strong>. Every figure here comes from your own answers.</>
          : 'Solve a few problems and this page fills in. Every figure here comes from your own answers.'}
        aside={user && (
          <button type="button" className="pr-print" onClick={() => (canPrint ? window.print() : onSeePlans?.())}>
            {canPrint ? <Printer size={16} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />} Print a report {!canPrint && <small>Pro</small>}
          </button>
        )}
      />
      {user && canPrint && <ProgressReport name={profile?.display_name ?? profile?.username ?? 'Learner'} userStats={userStats} />}

      <dl className="pr-figures">
        <div>
          <dt><CheckCircle2 size={15} aria-hidden="true" />Problems solved</dt>
          <dd><AnimatedNumber value={userStats.completedCount} /><em>{userStats.points.toLocaleString()} learning points</em></dd>
        </div>
        <div>
          <dt><Target size={15} aria-hidden="true" />Answer accuracy</dt>
          <dd>{hasLearningEvidence ? <><AnimatedNumber value={Math.round(userStats.accuracy)} /><small>%</small></> : '—'}<em>{hasLearningEvidence ? 'of your answers were right' : 'after your first answer'}</em></dd>
        </div>
        <div>
          <dt><Clock size={15} aria-hidden="true" />Time practising</dt>
          <dd>{minutes > 0 ? formatMinutes(minutes) : '—'}<em>{perProblem > 0 ? `about ${perProblem} min a problem` : 'counted while you solve'}</em></dd>
        </div>
        <div>
          <dt><Flame size={15} aria-hidden="true" />Current streak</dt>
          <dd><AnimatedNumber value={userStats.streak} /><small>day{userStats.streak === 1 ? '' : 's'}</small><em>{userStats.streak > 0 ? 'solve one today to keep it' : 'starts with one problem'}</em></dd>
        </div>
      </dl>

      <div className="pr-grid">
        <section className="pr-card" aria-labelledby="pr-mastery">
          <div className="pr-card-head">
            <span><RadarIcon size={18} strokeWidth={1.85} aria-hidden="true" /></span>
            <div>
              <h2 id="pr-mastery">Mastery by topic</h2>
              <p>The share of your answers in each topic that were right.</p>
            </div>
          </div>

          <div className="pr-radar">
            <RadarChart data={radarData} color="currentColor" />
          </div>

          <ul className="pr-topics">
            {skillEntries.map(([topic, pct], index) => (
              <StaggerItem key={topic} as="li" index={index} inView className={`pr-topic is-${TOPIC_META[topic].short.toLowerCase()}`}>
                <strong><i aria-hidden="true" />{TOPIC_META[topic].label}</strong>
                <p>{SKILL_DESCRIPTIONS[topic]}</p>
                <b><AnimatedNumber value={pct} /><small>%</small></b>
                <SpringBar value={pct} track="pr-track" fill="pr-fill" label={`${TOPIC_META[topic].label} mastery`} />
              </StaggerItem>
            ))}
          </ul>
        </section>

        <div className="pr-side">
          <section className="pr-card" aria-labelledby="pr-focus">
            <div className="pr-card-head is-warm">
              <span><Compass size={18} strokeWidth={1.85} aria-hidden="true" /></span>
              <div>
                <h2 id="pr-focus">Where to focus next</h2>
                <p>The topic with the most room to grow.</p>
              </div>
            </div>

            {hasLearningEvidence ? (
              <>
                <div className="pr-focus is-set">
                  <h3>Explore {weakest}</h3>
                  <p>{weakestSkill[1] === 0
                    ? 'There is no mastery reading here yet. Try a few questions to build a clearer picture.'
                    : <>Your current mastery reading is <strong>{weakestSkill[1]}%</strong>. A few more questions will develop this area.</>}</p>
                </div>
                <ol className="pr-steps">
                  <li><span>Solve five <strong>Foundation</strong> {weakest} problems.</span></li>
                  <li><span>Ask the <strong>tutor</strong> about any formula you had to look up.</span></li>
                  <li><span>Read the worked solution after each attempt, right or wrong.</span></li>
                </ol>
              </>
            ) : (
              <div className="pr-focus"><p>Your focus area appears after you solve a question. There is nothing to measure yet.</p></div>
            )}
          </section>

          <section className="pr-card" aria-labelledby="pr-points">
            <div className="pr-card-head">
              <span><LineChart size={18} strokeWidth={1.85} aria-hidden="true" /></span>
              <div>
                <h2 id="pr-points">Points over time</h2>
                <p>What each day of practice has added.</p>
              </div>
            </div>
            <div className="pr-chart">
              <VelocityChart data={timelineData} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
