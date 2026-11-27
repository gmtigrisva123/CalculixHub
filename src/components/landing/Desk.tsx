/**
 * "Your desk": a contest date turned into a timetable, and what else is on it.
 *
 * Contest maths is trained toward a day on the calendar. Give this section
 * that day and the minutes a day you have, and it prints the weeks between now
 * and then: most of them building, the last third sharpening against the
 * clock, the final week easing off. It is the planner the workspace uses
 * (src/domain/raceDay.ts), not a picture of it, so changing the date changes
 * the timetable.
 *
 * The planner puts the weakest topic first. On this page the only evidence of
 * weakness is the sheet at the top, so the timetable reads the visitor's marks
 * from it: miss the geometry problem up there and the first week down here is
 * geometry. With no answers the topics take their usual order.
 */

import { useId, useMemo, useState } from 'react';
import type { Topic } from '../../../shared/types';
import { PHASE_LABEL, dateKey, daysUntil, trainingPlan, type Phase, type PlanWeek } from '../../domain/raceDay';
import { Arrow } from './kit';
import { PAPER_DOMAINS } from './paperBank';
import { useSitting, type Mark } from './sitting';

const MINUTES = [20, 30, 45, 60] as const;
/** As many weeks as the timetable prints in full; a longer plan is shown by its first weeks and its last three. */
const PRINTED = 12;
const OPENING = 6;
const CLOSING = 3;
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const daysFromNow = (days: number) => { const when = new Date(); when.setDate(when.getDate() + days); return dateKey(when); };
const day = (key: string) => DAY.format(new Date(`${key}T12:00:00`));
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Mastery by topic, as far as a few marks can say: a topic answered right
 * stands high, one missed stands low, and one not yet asked sits between.
 */
function skillsFrom(marks: readonly Mark[]): Partial<Record<Topic, number>> {
  const skills: Partial<Record<Topic, number>> = {};
  for (const topic of PAPER_DOMAINS) {
    const seen = marks.filter(mark => mark.item.domain === topic);
    skills[topic] = seen.length ? (seen.filter(mark => mark.correct).length / seen.length) * 100 : 50;
  }
  return skills;
}

const ALSO = [
  { name: 'Scratch paper', text: 'Under every problem. Press S in the workspace and it slides in beside what you are working on.' },
  { name: 'The Arena', text: 'Live, timed contests against other students, and a leaderboard that keeps the score.', href: '/?auth=signup&tab=compete', link: 'See the Arena' },
  { name: 'The tutor', text: 'For when you are stuck. It asks the question that gets you moving; it does not hand over the answer.' },
  { name: 'Full solutions', text: 'Try the problem, take a hint if you need one, then read how it is done. You can come back to any of them.', href: '/?auth=signup&tab=learn', link: 'Open practice' },
  { name: 'Progress reports', text: 'One printable page for a parent or a coach: mastery by topic, and the last two weeks of practice.' },
  { name: 'The community', text: 'Ask in the open, and see how other people got there.', href: '/?auth=signup&tab=community', link: 'Visit the community' },
] as const;

export default function Desk({ onRegister }: { onRegister: () => void }) {
  const id = useId();
  const { marks } = useSitting();
  const today = dateKey(new Date());
  const [date, setDate] = useState(() => daysFromNow(70));
  const [minutes, setMinutes] = useState<number>(30);
  const left = date ? daysUntil(date, today) : 0;
  const missed = marks.some(mark => !mark.correct);
  const weeks = useMemo(
    () => (date && left > 0 ? trainingPlan({ date, today, minutesPerDay: minutes, skills: skillsFrom(marks), contest: 'the contest' }) : []),
    [date, left, today, minutes, marks],
  );
  const phases = (['build', 'sharpen', 'taper'] as Phase[]).map(phase => ({ phase, weeks: weeks.filter(week => week.phase === phase).length })).filter(entry => entry.weeks > 0);
  const printed: (PlanWeek | null)[] = weeks.length <= PRINTED ? weeks : [...weeks.slice(0, OPENING), null, ...weeks.slice(-CLOSING)];

  return (
    <section className="p1-sec p1-desk" id="desk" aria-labelledby="p1-desk-title">
      <div className="p1-wrap p1-desk-grid">
        <div className="p1-desk-plan">
          <h2 id="p1-desk-title" className="p1-title">Name the day. It plans the weeks.</h2>

          <div className="p1-desk-inputs">
            <div className="p1-field">
              <label htmlFor={`${id}-date`}>My contest is on</label>
              <input id={`${id}-date`} className="p1-input" type="date" value={date} min={daysFromNow(1)} max={daysFromNow(730)} onChange={event => setDate(event.target.value)} />
            </div>
            <div className="p1-field">
              <label htmlFor={`${id}-minutes`}>Minutes a day</label>
              <select id={`${id}-minutes`} className="p1-input" value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
                {MINUTES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>

          <p className="p1-desk-count" role="status">
            {left > 0
              ? <><b className="p1-num">{left}</b> {left === 1 ? 'day' : 'days'} to go. {phases.map((entry, index) => `${index ? ', ' : ''}${plural(entry.weeks, 'week')} to ${PHASE_LABEL[entry.phase].toLowerCase()}`).join('')}.</>
              : 'Pick a day ahead of today.'}
          </p>

          {weeks.length > 0 && (
            <>
              <ol className="p1-ribbon" aria-hidden="true">
                {weeks.map(week => <li key={week.index} data-phase={week.phase} style={{ flexGrow: week.days }} />)}
              </ol>
              <table className="p1-table p1-timetable">
                <caption className="sr-only">The weeks between now and the contest</caption>
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    <th scope="col">Begins</th>
                    <th scope="col">Phase</th>
                    <th scope="col">Topic</th>
                    <th scope="col" className="is-num">A day</th>
                  </tr>
                </thead>
                <tbody>
                  {printed.map((week, index) => week ? (
                    <tr key={week.index}>
                      <th scope="row" className="p1-num">{week.index}</th>
                      <td className="p1-num">{day(week.start)}</td>
                      <td><span className="p1-key" data-phase={week.phase} aria-hidden="true" />{PHASE_LABEL[week.phase]}</td>
                      <td>{week.phase === 'build' ? week.focus : week.phase === 'sharpen' ? 'Mixed, timed' : 'Review'}</td>
                      <td className="is-num p1-num">{week.problemsPerDay}</td>
                    </tr>
                  ) : (
                    <tr key={`gap-${index}`} className="is-gap">
                      <td colSpan={5}>{plural(weeks.length - OPENING - CLOSING, 'more week')}, building and then sharpening</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p1-caption">
                Problems a day at about eight minutes each. Building weeks take your weakest topic first:{' '}
                {missed ? 'here, whatever you missed on the sheet at the top of this page.' : 'in the app, the one your own record shows.'}{' '}
                The countdown is free; the week-by-week plan is part of Pro.
              </p>
            </>
          )}

          <button type="button" className="p1-btn" onClick={onRegister}>
            <span>Start my countdown</span>
            <Arrow />
          </button>
        </div>

        <div className="p1-desk-also">
          <h3 className="p1-subtitle">Also on the desk</h3>
          <dl className="p1-also">
            {ALSO.map(entry => (
              <div key={entry.name}>
                <dt>{entry.name}</dt>
                <dd>
                  {entry.text}
                  {'href' in entry && <> <a className="p1-link is-inline" href={entry.href}>{entry.link}</a></>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
