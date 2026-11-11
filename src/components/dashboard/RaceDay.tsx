/**
 * Race day: a countdown to the learner's own contest, and the plan that gets
 * them there.
 *
 * Until a date is set this is one quiet line asking for it. Once it is, the
 * card shows the days left, every week from now to the contest as a track of
 * segments coloured by phase, and what this week asks for. Opening the plan
 * lists each week; that list is the part Pro pays for, and the card says so
 * rather than hiding it.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowUpRight, CalendarDays, ChevronDown, Flag, Lock, Pencil } from 'lucide-react';
import type { Level, Topic, UserStats } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../services/data/plan';
import { CONTESTS, PHASE_LABEL, RACE_STORAGE, dateKey, daysUntil, parseRaceDay, trainingPlan, type ContestName, type RaceDay as RaceDayValue } from '../../domain/raceDay';
import '../../styles/race-day.css';

interface RaceDayProps {
  skills: UserStats['skills'];
  minutesPerDay: number;
  navigate: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
  still: boolean;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const readStored = (): RaceDayValue | null => {
  try { return parseRaceDay(localStorage.getItem(RACE_STORAGE)); } catch { return null; }
};
const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function RaceDay({ skills, minutesPerDay, navigate, still }: RaceDayProps) {
  const { user } = useAuth();
  const plan = usePlan(user?.id ?? null);
  const [race, setRace] = useState<RaceDayValue | null>(readStored);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ contest: ContestName; date: string }>({ contest: 'AMC 10', date: '' });

  const today = dateKey(new Date());
  const left = race ? daysUntil(race.date, today) : 0;
  const weeks = useMemo(
    () => (race ? trainingPlan({ date: race.date, today, minutesPerDay, skills, contest: race.contest }) : []),
    [race, today, minutesPerDay, skills],
  );
  const thisWeek = weeks[0];

  useEffect(() => { if (race) setDraft(race); }, [race]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.date || daysUntil(draft.date, today) < 0) return;
    const next = { contest: draft.contest, date: draft.date };
    try { localStorage.setItem(RACE_STORAGE, JSON.stringify(next)); } catch { /* kept for this visit only */ }
    setRace(next);
    setEditing(false);
  };
  const clear = () => {
    try { localStorage.removeItem(RACE_STORAGE); } catch { /* nothing stored */ }
    setRace(null);
    setEditing(false);
    setOpen(false);
  };

  const form = (
    <form className="rd-form" onSubmit={save}>
      <label><span>Contest</span>
        <select value={draft.contest} onChange={event => setDraft({ ...draft, contest: event.target.value as ContestName })}>
          {CONTESTS.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label><span>Date</span>
        <input type="date" required min={today} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} />
      </label>
      <div className="rd-form-actions">
        <button type="submit" className="rd-btn is-solid" disabled={!draft.date}>{race ? 'Update' : 'Start the countdown'}</button>
        {race && <button type="button" className="rd-btn" onClick={clear}>Remove</button>}
        {(race || editing) && <button type="button" className="rd-btn" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );

  if (!race) {
    return (
      <section className="dh-card rd rd-empty" aria-labelledby="rd-title">
        <span className="rd-flag" aria-hidden="true"><Flag size={18} /></span>
        <div className="rd-empty-copy">
          <h2 id="rd-title">Training for a date?</h2>
          <p>Tell us the contest and the day. You’ll get a countdown and a plan that leads up to it.</p>
        </div>
        {editing ? form : <button type="button" className="rd-btn is-solid" onClick={() => setEditing(true)}><CalendarDays size={15} /> Set my contest day</button>}
      </section>
    );
  }

  const past = left < 0;
  const full = plan.can('training-plan');

  return (
    <section className="dh-card rd" aria-labelledby="rd-title">
      <div className="rd-count" aria-hidden={past}>
        {past
          ? <><strong>—</strong><span>that day has passed</span></>
          : left === 0
            ? <><strong className="is-word">Today</strong><span>go and enjoy it</span></>
            : <><strong>{left}</strong><span>{left === 1 ? 'day' : 'days'} to go</span></>}
      </div>

      <div className="rd-body">
        <header className="rd-head">
          <div>
            <p className="rd-kicker"><Flag size={13} aria-hidden="true" /> Race day</p>
            <h2 id="rd-title">{race.contest}<span> · {longDate(race.date)}</span></h2>
          </div>
          <button type="button" className="rd-icon" onClick={() => setEditing(value => !value)} aria-expanded={editing} aria-label="Change your contest day"><Pencil size={15} /></button>
        </header>

        {editing ? form : past ? (
          <p className="rd-note">How did it go? Set your next one whenever you’re ready.</p>
        ) : thisWeek ? (
          <>
            <ol className="rd-track" aria-label={`${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'} to the contest`}>
              {weeks.map(week => (
                <li key={week.index} className={`is-${week.phase}${week.index === 1 ? ' is-now' : ''}`} style={{ '--span': week.days, '--i': week.index } as Vars} title={`Week ${week.index}: ${PHASE_LABEL[week.phase]}, ${week.focus}`}>
                  <span className="rd-sr">Week {week.index}, {PHASE_LABEL[week.phase]}, {week.focus}</span>
                </li>
              ))}
            </ol>
            <p className="rd-legend" aria-hidden="true"><i className="is-build" />Build<i className="is-sharpen" />Sharpen<i className="is-taper" />Taper</p>

            <div className="rd-week">
              <div>
                <p className="rd-week-label">This week · {PHASE_LABEL[thisWeek.phase]}</p>
                <p className="rd-week-focus">{thisWeek.phase === 'taper' ? <><b>Light review</b>, mostly {thisWeek.focus}.</> : <><b>{thisWeek.focus}</b>, with {thisWeek.support} kept warm.</>} <b>{thisWeek.problemsPerDay}</b> {thisWeek.problemsPerDay === 1 ? 'problem' : 'problems'} a day.</p>
                <p className="rd-note">{thisWeek.note}</p>
              </div>
              <button type="button" className="rd-btn is-solid" onClick={() => navigate('learn', { topic: thisWeek.focus })}>Today’s {thisWeek.focus} <ArrowUpRight size={15} /></button>
            </div>

            {weeks.length > 1 && (
              <button type="button" className="rd-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
                {open ? 'Hide the plan' : `See all ${weeks.length} weeks`} <ChevronDown size={15} className={open ? 'is-open' : undefined} />
              </button>
            )}
            <AnimatePresence initial={false}>
              {open && (
                <m.div className="rd-plan" initial={still ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={still ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                  <ol>
                    {(full ? weeks : weeks.slice(0, 2)).map(week => (
                      <li key={week.index} className={`is-${week.phase}`}>
                        <span className="rd-plan-when"><b>Week {week.index}</b>{shortDate(week.start)}</span>
                        <span className="rd-plan-phase">{PHASE_LABEL[week.phase]}</span>
                        <span className="rd-plan-what">{week.phase === 'taper' ? <><b>Light review</b> and rest</> : <><b>{week.focus}</b> + {week.support}</>} · {week.problemsPerDay} a day</span>
                      </li>
                    ))}
                  </ol>
                  {!full && (
                    <p className="rd-locked"><Lock size={14} aria-hidden="true" /><span>The remaining {weeks.length - 2} {weeks.length - 2 === 1 ? 'week is' : 'weeks are'} part of Pro.</span><button type="button" onClick={() => navigate('plan')}>See Pro <ArrowUpRight size={13} /></button></p>
                  )}
                  {full && plan.preview && plan.plan === 'free' && <p className="rd-preview">The full plan is a Pro feature, open to everyone during the preview.</p>}
                </m.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="rd-note">It’s today. Read every question twice, and trust the work you’ve put in.</p>
        )}
      </div>
    </section>
  );
}
