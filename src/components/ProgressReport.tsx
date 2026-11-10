/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The printable progress report: one page a parent or coach can read without
 * an account.
 *
 * It is rendered straight under <body> and hidden on screen. Printing hides
 * everything else and shows only this sheet (see progress-report.css), so the
 * browser's own "Save as PDF" produces the file and nothing has to be drawn
 * twice. Every figure is the one the Progress page shows.
 */

import { createPortal } from 'react-dom';
import type { Topic, UserStats } from '../../shared/types';
import { RACE_STORAGE, dateKey, daysUntil, parseRaceDay, type RaceDay } from '../domain/raceDay';
import { formatMinutes } from '../lib/topics';
import BrandLogo from './BrandLogo';
import '../styles/progress-report.css';

interface ProgressReportProps {
  name: string;
  userStats: UserStats;
}

const TOPICS: readonly Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
const grouped = (value: number) => Math.round(value).toLocaleString();
const day = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function ProgressReport({ name, userStats }: ProgressReportProps) {
  const skills = TOPICS.map(topic => ({ topic, value: Math.max(0, Math.min(100, Math.round(userStats.skills?.[topic] ?? 0))) }));
  const ranked = [...skills].sort((a, b) => b.value - a.value);
  const timeline = (userStats.learningTimeline ?? []).slice(-14);
  // Points earned on each active day: the timeline holds running totals.
  const gains = timeline.map((entry, index) => ({ date: entry.date, gain: Math.max(0, entry.points - (index === 0 ? (userStats.learningTimeline?.[userStats.learningTimeline.length - timeline.length - 1]?.points ?? 0) : timeline[index - 1].points)), accuracy: entry.accuracy }));
  const peak = Math.max(1, ...gains.map(entry => entry.gain));
  const hasAnswers = userStats.completedCount > 0 || userStats.accuracy > 0;
  let race: RaceDay | null = null;
  try { race = parseRaceDay(localStorage.getItem(RACE_STORAGE)); } catch { /* no date set */ }
  const left = race ? daysUntil(race.date, dateKey(new Date())) : null;

  return createPortal(
    <article className="report-root" aria-hidden="true">
      <header className="report-head">
        <span className="report-brand"><BrandLogo />calculix<span>hub</span></span>
        <span>Progress report · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </header>

      <h1>{name}</h1>
      <p className="report-sub">{userStats.level ? `Practising at ${userStats.level} level` : 'Not yet placed'}{race && left != null && left >= 0 ? ` · ${race.contest} in ${left} ${left === 1 ? 'day' : 'days'}` : ''}</p>

      <dl className="report-figures">
        <div><dt>Points</dt><dd>{grouped(userStats.points)}</dd></div>
        <div><dt>Problems solved</dt><dd>{grouped(userStats.completedCount)}</dd></div>
        <div><dt>Accuracy</dt><dd>{hasAnswers ? `${Math.round(userStats.accuracy)}%` : '—'}</dd></div>
        <div><dt>Current streak</dt><dd>{userStats.streak} {userStats.streak === 1 ? 'day' : 'days'}</dd></div>
        <div><dt>Time practising</dt><dd>{formatMinutes(userStats.timeSpent)}</dd></div>
      </dl>

      <section>
        <h2>Mastery by topic</h2>
        <ul className="report-bars">
          {skills.map(({ topic, value }) => (
            <li key={topic}><span>{topic}</span><span className="report-bar"><i style={{ width: `${value}%` }} /></span><b>{value}%</b></li>
          ))}
        </ul>
        <p className="report-note">
          {ranked[0].value <= 0 ? 'No answers recorded yet, so there is nothing to measure.'
            : ranked[0].value === ranked[3].value ? `Even across all four topics, at ${ranked[0].value}%.`
            : <>Strongest in <b>{ranked[0].topic}</b>. The most room to grow is in <b>{ranked[3].topic}</b>, which is where practice is being steered next.</>}
        </p>
      </section>

      <section>
        <h2>Recent practice</h2>
        {gains.length ? (
          <table className="report-table">
            <thead><tr><th>Day</th><th>Points earned</th><th /><th>Accuracy to date</th></tr></thead>
            <tbody>
              {gains.map(entry => (
                <tr key={entry.date}><td>{day(entry.date)}</td><td>{grouped(entry.gain)}</td><td><span className="report-bar"><i style={{ width: `${entry.gain / peak * 100}%` }} /></span></td><td>{entry.accuracy}%</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="report-note">No practice days recorded yet.</p>}
      </section>

      <footer className="report-foot">
        <span>Mastery is the share of answers in a topic that were correct. Points are awarded once per problem, on the first correct answer.</span>
        <span>calculixhub.com</span>
      </footer>
    </article>,
    document.body,
  );
}
