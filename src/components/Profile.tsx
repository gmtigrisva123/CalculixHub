/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Camera, Check, Crown, Dices, Flame, Lock, LogOut, MapPin, PencilLine, Ruler, Share2, Sprout, Trophy, Users, Zap, type LucideIcon } from 'lucide-react';
import { UserStats, Problem, Topic } from '../../shared/types';
import { RANK_TIERS, TOPIC_LIST, formatMinutes, getRankForPoints, nextRankFor } from '../lib/topics';
import { AnimatedNumber } from './motion';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS } from '../domain/achievements';
import { ACCEPTED_IMAGE_TYPES } from '../services/data/media';
import { clearAvatar, saveAvatar, type AvatarResult } from '../services/data/avatar';
import { updateProfile } from '../services/data/account';
import UserAvatar from './UserAvatar';
import ShareCard from './ShareCard';
import { usePlan } from '../services/data/plan';
import '../styles/profile.css';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
  onTriggerAlert?: (achievement: any) => void;
  onSeePlans?: () => void;
  /** Opens Learn, on one topic when given. */
  onPractise?: (topic?: Topic) => void;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const DAY = 86_400_000;
const grouped = (value: number) => Math.round(value).toLocaleString();
const plural = (count: number, word: string) => `${grouped(count)} ${word}${count === 1 ? '' : 's'}`;
const dayOf = (date: string) => Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);
const formatDay = (time: number, withYear = true) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' });

/* --------------------------------------------------------------------------
 * Cumulative points over active days
 * ------------------------------------------------------------------------ */

const niceStep = (max: number) => {
  const raw = Math.max(max, 1) / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find(unit => unit * power >= raw) ?? 10) * power;
};

function PointsCurve({ timeline }: { timeline: UserStats['learningTimeline'] }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const days = timeline.map(day => ({ ...day, time: dayOf(day.date) })).filter(day => Number.isFinite(day.time));
  if (!days.length) return <div className="pf-curve-frame pf-curve-empty" ref={frame}>
    <svg viewBox="0 0 240 90" aria-hidden="true"><path d="M8,82 H60 V64 H112 V44 H164 V26 H232" /></svg>
    <p>Your curve starts with your first saved answer.</p>
  </div>;

  const height = 230, top = 18, bottom = 30, left = 46, right = 14;
  const step = niceStep(Math.max(...days.map(day => day.points)));
  const ceiling = Math.max(step, Math.ceil(Math.max(...days.map(day => day.points)) / step) * step);
  const ticks = Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) => index * step);
  const first = days[0].time, last = days[days.length - 1].time;
  const span = Math.max(last - first, 86_400_000);
  const start = last === first ? first - span / 2 : first;
  const x = (time: number) => left + (time - start) / span * Math.max(width - left - right, 1);
  const y = (points: number) => top + (1 - points / ceiling) * (height - top - bottom);
  const base = y(0);
  /* A staircase, not a slope: the total holds flat between active days. */
  const line = days.reduce((path, day, index) => index === 0 ? `M${x(day.time).toFixed(1)},${y(day.points).toFixed(1)}` : `${path} H${x(day.time).toFixed(1)} V${y(day.points).toFixed(1)}`, '');
  const area = `${line} V${base} H${x(days[0].time).toFixed(1)} Z`;
  const shown = active == null ? null : days[active];
  const latest = days[days.length - 1];

  const pick = (clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const at = clientX - box.left;
    let nearest = 0;
    days.forEach((day, index) => { if (Math.abs(x(day.time) - at) < Math.abs(x(days[nearest].time) - at)) nearest = index; });
    setActive(nearest);
  };
  const nudge = (delta: number) => setActive(current => Math.min(days.length - 1, Math.max(0, (current ?? days.length - 1) + delta)));

  return <div className="pf-curve-frame" ref={frame}>
    {width > 0 && <svg className="pf-curve" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0}
      aria-label={`Cumulative points: ${grouped(latest.points)} across ${days.length} active ${days.length === 1 ? 'day' : 'days'}, from ${formatDay(first)} to ${formatDay(last)}. Use the arrow keys to read each day.`}
      onPointerMove={event => pick(event.clientX)} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
      onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); nudge(1); } }}>
      <defs><linearGradient id="pf-curve-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="pf-stop-top" /><stop offset="1" className="pf-stop-bottom" /></linearGradient></defs>
      {ticks.map(tick => <g key={tick} className="pf-curve-tick"><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text x={left - 10} y={y(tick) + 4}>{grouped(tick)}</text></g>)}
      <path className="pf-curve-area" d={area} />
      <path className="pf-curve-line" d={line} pathLength={1} />
      <text className="pf-curve-date" x={x(first)} y={height - 8} textAnchor={last === first ? 'middle' : 'start'}>{formatDay(first)}</text>
      {last !== first && <text className="pf-curve-date" x={x(last)} y={height - 8} textAnchor="end">{formatDay(last)}</text>}
      {shown && <line className="pf-curve-cross" x1={x(shown.time)} x2={x(shown.time)} y1={top} y2={base} />}
      <circle className="pf-curve-dot" cx={x((shown ?? latest).time)} cy={y((shown ?? latest).points)} r={5} />
    </svg>}
    {shown && width > 0 && <div className={`pf-curve-tip${x(shown.time) > width * 0.66 ? ' is-left' : ''}`} style={{ left: x(shown.time) }} aria-live="polite">
      <span>{formatDay(shown.time)}</span>
      <strong>{grouped(shown.points)} <small>pts</small></strong>
      <em>{shown.accuracy}% accuracy so far</em>
    </div>}
  </div>;
}

/* --------------------------------------------------------------------------
 * Changing the profile photo
 * ------------------------------------------------------------------------ */

/* Upload, remove or cancel, stacked the way a phone's own photo menu is. */
function PhotoDialog({ open, onClose, userId, current, onSaved }: { open: boolean; onClose: () => void; userId: string; current: string | null; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      setError(null);
      node.showModal();
    } else if (!open && node.open) node.close();
  }, [open]);

  const run = async (kind: 'upload' | 'remove', task: () => Promise<AvatarResult>) => {
    setBusy(kind);
    setError(null);
    const result = await task();
    if (result.ok) await onSaved();
    setBusy(null);
    if (result.ok) onClose();
    else setError(result.error);
  };
  const dismiss = () => { if (!busy) onClose(); };

  return <dialog ref={dialog} className="pf-photo-dialog" aria-labelledby="pf-photo-title" aria-busy={Boolean(busy)}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === dialog.current) dismiss(); }}>
    <div className="pf-photo-head">
      <span className={`pf-photo-preview${busy ? ' is-busy' : ''}`}><UserAvatar src={current} /></span>
      <h2 id="pf-photo-title">Profile photo</h2>
      <p>{current ? 'Shown on your profile, the leaderboard and in Community.' : 'Without a photo, everyone sees the default silhouette.'}</p>
      {error && <p className="pf-photo-error" role="alert">{error}</p>}
    </div>
    <input ref={picker} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} hidden
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run('upload', () => saveAvatar(userId, file, current)); }} />
    <div className="pf-photo-actions">
      <button type="button" className="is-primary" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>{busy === 'upload' ? 'Uploading…' : current ? 'Upload a new photo' : 'Upload a photo'}</button>
      {current && <button type="button" className="is-danger" disabled={Boolean(busy)} onClick={() => void run('remove', () => clearAvatar(userId, current))}>{busy === 'remove' ? 'Removing…' : 'Remove current photo'}</button>}
      <button type="button" disabled={Boolean(busy)} onClick={onClose}>Cancel</button>
    </div>
  </dialog>;
}

/* --------------------------------------------------------------------------
 * Editing what other learners see
 * ------------------------------------------------------------------------ */

function EditDialog({ open, onClose, onChangePhoto, onSaved }: { open: boolean; onClose: () => void; onChangePhoto: () => void; onSaved: () => Promise<void> }) {
  const { profile } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [edit, setEdit] = useState({ displayName: '', bio: '', country: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      setEdit({ displayName: profile?.display_name ?? '', bio: profile?.bio ?? '', country: profile?.country ?? '' });
      setError(null);
      node.showModal();
    } else if (!open && node.open) node.close();
  }, [open]);

  if (!profile) return null;
  const dirty = edit.displayName !== (profile.display_name ?? '') || edit.bio !== (profile.bio ?? '') || edit.country !== (profile.country ?? '');
  const dismiss = () => { if (!busy) onClose(); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) { onClose(); return; }
    setBusy(true);
    setError(null);
    const result = await updateProfile(profile.id, edit);
    if (result.ok) await onSaved();
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return <dialog ref={dialog} className="pf-edit" aria-labelledby="pf-edit-title" aria-busy={busy}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === dialog.current) dismiss(); }}>
    <form onSubmit={save}>
      <header>
        <h2 id="pf-edit-title">Edit profile</h2>
        <p>This is what other learners see on the leaderboard and in Community.</p>
      </header>
      <div className="pf-edit-photo">
        <span><UserAvatar src={profile.avatar_url} /></span>
        <div><b>@{profile.username}</b><button type="button" onClick={onChangePhoto}>{profile.avatar_url ? 'Change photo' : 'Add a photo'}</button></div>
      </div>
      <label className="pf-field"><span>Name</span><input value={edit.displayName} maxLength={60} autoComplete="name" onChange={event => setEdit({ ...edit, displayName: event.target.value })} /></label>
      <label className="pf-field"><span>Country <small>optional</small></span><input value={edit.country} maxLength={56} autoComplete="country-name" onChange={event => setEdit({ ...edit, country: event.target.value })} /></label>
      <label className="pf-field"><span>Bio <small>{280 - edit.bio.length} left</small></span><textarea value={edit.bio} maxLength={280} rows={3} placeholder="What are you working toward?" onChange={event => setEdit({ ...edit, bio: event.target.value })} /></label>
      {error && <p className="pf-edit-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="pf-btn" onClick={dismiss} disabled={busy}>Cancel</button>
        <button type="submit" className="pf-btn is-primary" disabled={busy || !edit.displayName.trim()}>{busy ? 'Saving…' : 'Save changes'}</button>
      </footer>
    </form>
  </dialog>;
}

/* --------------------------------------------------------------------------
 * What the timeline says, worked out once
 * ------------------------------------------------------------------------ */

interface Rhythm {
  /** Points gained per day, keyed by day number since the epoch. A day present with 0 was practised without scoring. */
  gains: Map<number, number>;
  best: { key: number; gain: number } | null;
  longestRun: number;
  /** 0 is Sunday. Null until there are at least three active days to judge by. */
  favourite: number | null;
  /** Active days on each weekday, Sunday first. */
  weekdays: number[];
}

function readRhythm(timeline: UserStats['learningTimeline']): Rhythm {
  const gains = new Map<number, number>();
  let previous = 0;
  [...timeline].map(day => ({ ...day, time: dayOf(day.date) })).filter(day => Number.isFinite(day.time)).sort((a, b) => a.time - b.time).forEach(day => {
    const key = Math.floor(day.time / DAY);
    gains.set(key, (gains.get(key) ?? 0) + Math.max(day.points - previous, 0));
    previous = day.points;
  });
  const keys = [...gains.keys()].sort((a, b) => a - b);
  let best: Rhythm['best'] = null, longestRun = 0, run = 0;
  const weekdays = Array<number>(7).fill(0);
  keys.forEach((key, index) => {
    const gain = gains.get(key)!;
    if (gain > 0 && (!best || gain > best.gain)) best = { key, gain };
    run = index > 0 && keys[index - 1] === key - 1 ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
    weekdays[new Date(key * DAY).getUTCDay()] += 1;
  });
  const top = Math.max(...weekdays);
  return { gains, best, longestRun, weekdays, favourite: keys.length >= 3 && weekdays.filter(count => count === top).length === 1 ? weekdays.indexOf(top) : null };
}

/* --------------------------------------------------------------------------
 * Activity: one square per day, like a contribution graph
 * ------------------------------------------------------------------------ */

const WEEKS = 34;

function ActivityGrid({ gains, streak }: { gains: Map<number, number>; streak: number }) {
  const today = Math.floor(Date.now() / DAY);
  const weekday = new Date(today * DAY).getUTCDay();
  const first = today - weekday - (WEEKS - 1) * 7;
  const peak = Math.max(1, ...gains.values());
  const level = (key: number) => {
    const gain = gains.get(key);
    return gain === undefined ? 0 : gain <= 0 ? 1 : Math.min(4, Math.ceil(gain / peak * 4));
  };
  const months: { label: string; column: number }[] = [];
  for (let week = 0; week < WEEKS; week++) {
    const date = new Date((first + week * 7) * DAY);
    const label = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
    if (!months.length || months[months.length - 1].label !== label) months.push({ label, column: week });
  }
  const activeDays = [...gains.keys()].filter(key => key >= first).length;
  const describe = (key: number) => {
    const gain = gains.get(key);
    return gain === undefined ? 'No practice' : gain > 0 ? `+${grouped(gain)} pts` : 'Practised, no points';
  };

  // The day under the pointer, and where its square sits inside the card.
  const frame = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ key: number; x: number; y: number } | null>(null);
  const point = (event: React.PointerEvent | React.FocusEvent) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
    const box = frame.current?.getBoundingClientRect();
    if (!cell || !box) return;
    const at = cell.getBoundingClientRect();
    setTip({ key: Number(cell.dataset.key), x: at.left + at.width / 2 - box.left, y: at.top - box.top });
  };

  // On a narrow screen the grid scrolls; open it on this week, not on six months ago.
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const node = scroller.current; if (node) node.scrollLeft = node.scrollWidth; }, []);

  return <div className="pf-activity" ref={frame}>
    <div className="pf-activity-scroll" ref={scroller} onScroll={() => setTip(null)}>
      <div className="pf-activity-grid" style={{ '--weeks': WEEKS } as Vars} role="img" aria-label={`${plural(activeDays, 'active day')} in the last ${WEEKS} weeks`}>
        <div className="pf-activity-months" aria-hidden="true">{months.map(month => <span key={month.column} style={{ gridColumn: month.column + 1 }}>{month.label}</span>)}</div>
        <div className="pf-activity-days" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
        <div className="pf-activity-cells" onPointerOver={point} onPointerLeave={() => setTip(null)}>
          {Array.from({ length: WEEKS * 7 }, (_, index) => {
            const key = first + Math.floor(index / 7) * 7 + (index % 7);
            return <i key={index} className={key > today ? 'is-future' : key === today ? 'is-today' : undefined} data-level={level(key)} data-key={key > today ? undefined : key} style={{ '--c': Math.floor(index / 7) } as Vars} />;
          })}
        </div>
      </div>
    </div>
    {tip && <div className={`pf-day-tip${tip.x < 90 ? ' is-right' : tip.x > (frame.current?.clientWidth ?? 0) - 90 ? ' is-left' : ''}`} style={{ left: tip.x, top: tip.y }} role="status">
      <span>{new Date(tip.key * DAY).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span><b>{describe(tip.key)}</b>
    </div>}
    <div className="pf-activity-foot">
      <span><b>{plural(activeDays, 'active day')}</b> in {WEEKS} weeks{streak > 0 && <> · on a <b>{streak}-day</b> streak</>}</span>
      <span className="pf-legend" aria-hidden="true">Less{[0, 1, 2, 3, 4].map(n => <i key={n} data-level={n} />)}More</span>
    </div>
  </div>;
}

/* --------------------------------------------------------------------------
 * Topics, as plain bars
 * ------------------------------------------------------------------------ */

const TOPIC_HUE: Record<Topic, string> = { Algebra: '#c8842a', Geometry: '#209d8c', Combinatorics: '#8b5cf6', 'Number Theory': '#0484c0' };
const standing = (value: number) => value <= 0 ? 'Not started' : value < 35 ? 'Finding your feet' : value < 70 ? 'Getting solid' : 'Strong';

/* Four topics, four corners. The shape is the profile at a glance; the rows below carry the numbers. */
const CORNER: Record<Topic, readonly [x: number, y: number, short: string]> = { Algebra: [0, -1, 'ALG'], Geometry: [1, 0, 'GEO'], Combinatorics: [0, 1, 'COM'], 'Number Theory': [-1, 0, 'NT'] };

function TopicShape({ skills, hot, onHot }: { skills: UserStats['skills']; hot: Topic | null; onHot: (topic: Topic | null) => void }) {
  const reach = 74, centre = 100;
  const at = (topic: Topic, share: number) => [centre + CORNER[topic][0] * reach * share, centre + CORNER[topic][1] * reach * share] as const;
  const ring = (share: number) => TOPIC_LIST.map(topic => at(topic, share).join(',')).join(' ');
  const shape = TOPIC_LIST.map(topic => at(topic, Math.max(skills[topic] ?? 0, 4) / 100).join(',')).join(' ');
  return <svg className="pf-shape" viewBox="0 0 200 200" role="img" aria-label={`Mastery by topic: ${TOPIC_LIST.map(topic => `${topic} ${Math.round(skills[topic] ?? 0)}%`).join(', ')}`}>
    {[.25, .5, .75, 1].map(share => <polygon key={share} className="pf-shape-ring" points={ring(share)} />)}
    {TOPIC_LIST.map(topic => <line key={topic} className={`pf-shape-axis${hot === topic ? ' is-hot' : ''}`} x1={centre} y1={centre} x2={at(topic, 1)[0]} y2={at(topic, 1)[1]} style={{ '--hue': TOPIC_HUE[topic] } as Vars} />)}
    <polygon className="pf-shape-area" points={shape} />
    {TOPIC_LIST.map(topic => {
      const [x, y] = at(topic, Math.max(skills[topic] ?? 0, 4) / 100), [lx, ly] = at(topic, 1.2);
      return <g key={topic} className={`pf-shape-corner${hot === topic ? ' is-hot' : ''}`} style={{ '--hue': TOPIC_HUE[topic] } as Vars} onPointerEnter={() => onHot(topic)} onPointerLeave={() => onHot(null)}>
        <circle className="pf-shape-hit" cx={x} cy={y} r={16} />
        <circle className="pf-shape-dot" cx={x} cy={y} r={4.5} />
        <text x={lx} y={ly + 3.5} textAnchor="middle">{CORNER[topic][2]}</text>
      </g>;
    })}
  </svg>;
}

function TopicBars({ skills, solved, onPractise }: { skills: UserStats['skills']; solved: Record<Topic, number>; onPractise?: (topic: Topic) => void }) {
  const [hot, setHot] = useState<Topic | null>(null);
  return <>
    <TopicShape skills={skills} hot={hot} onHot={setHot} />
    <ul className="pf-topics">{TOPIC_LIST.map(topic => {
      const value = Math.round(skills[topic] ?? 0);
      return <li key={topic} className={hot === topic ? 'is-hot' : undefined} style={{ '--hue': TOPIC_HUE[topic], '--v': `${value}%` } as Vars}>
        <button type="button" onClick={() => onPractise?.(topic)} onPointerEnter={() => setHot(topic)} onPointerLeave={() => setHot(null)} onFocus={() => setHot(topic)} onBlur={() => setHot(null)} aria-label={`Practise ${topic}: ${value}% mastery, ${standing(value).toLowerCase()}`}>
          <span className="pf-topic-name"><i aria-hidden="true" />{topic}</span>
          <span className="pf-topic-value">{value}<small>%</small></span>
          <span className="pf-topic-track" aria-hidden="true"><span /></span>
          <span className="pf-topic-note">{standing(value)}{solved[topic] > 0 && <> · {solved[topic]} solved</>}</span>
          <span className="pf-topic-go" aria-hidden="true">Practise<ArrowRight size={13} /></span>
        </button>
      </li>;
    })}</ul>
  </>;
}

/* --------------------------------------------------------------------------
 * A small drawing beside each of the five figures
 * ------------------------------------------------------------------------ */

function Spark({ timeline }: { timeline: UserStats['learningTimeline'] }) {
  const days = timeline.map(day => ({ time: dayOf(day.date), points: day.points })).filter(day => Number.isFinite(day.time)).sort((a, b) => a.time - b.time).slice(-24);
  if (days.length < 2) return null;
  const low = days[0].points, span = Math.max(days[days.length - 1].points - low, 1);
  const path = days.map((day, index) => `${index ? 'L' : 'M'}${(index / (days.length - 1) * 60 + 2).toFixed(1)},${(22 - (day.points - low) / span * 18).toFixed(1)}`).join(' ');
  return <svg className="pf-mini" viewBox="0 0 64 26" aria-hidden="true"><path className="pf-mini-line" d={path} pathLength={1} /></svg>;
}

function Dial({ share }: { share: number }) {
  return <svg className="pf-mini is-dial" viewBox="0 0 30 30" aria-hidden="true" style={{ '--p': share } as Vars}>
    <circle cx="15" cy="15" r="12" /><circle cx="15" cy="15" r="12" pathLength={1} />
  </svg>;
}

/* --------------------------------------------------------------------------
 * The page
 * ------------------------------------------------------------------------ */

const BADGE_ICON: Record<string, LucideIcon> = { b1: Sprout, b2: Ruler, b3: Dices, b4: Trophy, b5: Flame, b6: Zap, b7: Crown };
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

export default function Profile({ userStats, completedProblems, problems, onLogout, onSeePlans, onPractise }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const solvedCount = solvedQuestions.length;
  const rank = getRankForPoints(userStats.points);
  const nextTier = nextRankFor(userStats.points);
  const tierIndex = RANK_TIERS.findIndex(tier => tier.name === rank.name);
  const tierProgress = nextTier ? Math.min(1, (userStats.points - rank.minPoints) / (nextTier.minPoints - rank.minPoints)) : 1;
  // How far along the whole ladder: each tier is one equal step, however many points it spans.
  const ladder = (tierIndex + (nextTier ? tierProgress : 0)) / (RANK_TIERS.length - 1);

  const { profile, refreshProfile } = useAuth();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const plan = usePlan(profile?.id ?? null);

  const rhythm = useMemo(() => readRhythm(userStats.learningTimeline), [userStats.learningTimeline]);
  const solvedByTopic = useMemo(() => {
    const count = { Algebra: 0, Geometry: 0, Combinatorics: 0, 'Number Theory': 0 } as Record<Topic, number>;
    solvedQuestions.forEach(problem => { count[problem.topic] += 1; });
    return count;
  }, [problems, completedProblems]);

  const badges = ACHIEVEMENTS.map(badge => {
    const unlocked = Boolean(profile) && badge.condition(userStats, solvedCount);
    const progress = badge.progress?.(userStats, solvedCount) ?? null;
    return { ...badge, unlocked, progress, share: unlocked ? 1 : progress ? Math.min(progress.now / progress.goal, .99) : 0 };
  });
  const unlockedCount = badges.filter(badge => badge.unlocked).length;
  const nearest = badges.filter(badge => !badge.unlocked && badge.progress).sort((a, b) => b.share - a.share)[0] ?? null;

  const displayName = profile?.display_name || profile?.username || 'Guest learner';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
  const hasAnswers = userStats.completedCount > 0 || userStats.accuracy > 0;
  const activeDays = rhythm.gains.size;

  const topics = TOPIC_LIST.map(topic => ({ topic, value: Math.round(userStats.skills[topic] ?? 0) }));
  const started = topics.some(entry => entry.value > 0);
  const weakest = [...topics].sort((a, b) => a.value - b.value)[0];
  const strongest = [...topics].sort((a, b) => b.value - a.value)[0];

  // What is still missing from the public profile, in the order worth filling in.
  const missing = profile ? [!profile.avatar_url && 'a photo', !profile.bio && 'a short bio', !profile.country && 'your country'].filter(Boolean) as string[] : [];

  // Monday first, for the two small charts that read as a week.
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(day => rhythm.weekdays[day]);
  const busiest = Math.max(1, ...byWeekday);
  const todayKey = Math.floor(Date.now() / DAY);
  const lastWeek = Array.from({ length: 7 }, (_, index) => rhythm.gains.has(todayKey - 6 + index));

  const NearestIcon = nearest ? BADGE_ICON[nearest.id] ?? Trophy : Trophy;

  return (
    <div className="profile-page">
      <section className="pf-hero" aria-labelledby="pf-name">
        <div className="pf-hero-main">
          <div className="pf-face-wrap" style={{ '--p': tierProgress } as Vars}>
            <svg className="pf-face-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57" /><circle cx="60" cy="60" r="57" pathLength={1} /></svg>
            {profile
              ? <button type="button" className="pf-face is-editable" onClick={() => setPhotoOpen(true)} aria-label="Change profile photo"><UserAvatar src={profile.avatar_url} /><span className="pf-face-badge" aria-hidden="true"><Camera size={14} strokeWidth={2.2} /></span></button>
              : <div className="pf-face"><UserAvatar src={null} /></div>}
          </div>

          <div className="pf-identity">
            <p className="pf-eyebrow">{profile ? <>{profile.username ? `@${profile.username}` : 'No username yet'}</> : 'Guest session'}</p>
            <h1 id="pf-name">{displayName}</h1>
            <p className="pf-chips">
              <span className="pf-chip is-tier"><Trophy size={12} aria-hidden="true" />{rank.name}</span>
              <span className="pf-chip">{userStats.level || 'Not placed yet'}</span>
              {userStats.rank > 0 && <span className="pf-chip">#{grouped(userStats.rank)} worldwide</span>}
            </p>
            {profile?.bio
              ? <p className="pf-bio">{profile.bio}</p>
              : <p className="pf-bio is-empty">{profile ? 'No bio yet. Say what you are working toward.' : 'You’re looking around as a guest, so nothing here is saved yet.'}</p>}
            <ul className="pf-facts">
              {profile?.country && <li><MapPin size={14} aria-hidden="true" />{profile.country}</li>}
              {memberSince && <li><CalendarDays size={14} aria-hidden="true" />Joined {memberSince}</li>}
              {profile && <li><Users size={14} aria-hidden="true" /><b>{grouped(profile.follower_count)}</b> {profile.follower_count === 1 ? 'follower' : 'followers'} · <b>{grouped(profile.following_count)}</b> following</li>}
            </ul>
            <div className="pf-actions">
              {profile ? <>
                <button type="button" className="pf-btn is-light" onClick={() => setEditOpen(true)}><PencilLine size={15} aria-hidden="true" />Edit profile</button>
                <button type="button" className="pf-btn is-glass" onClick={() => setShareOpen(true)}><Share2 size={15} aria-hidden="true" />Share card</button>
                <button type="button" className="pf-btn is-ghost" onClick={onLogout}><LogOut size={15} aria-hidden="true" />Sign out</button>
              </> : <>
                <a className="pf-btn is-light" href="/?auth=signup">Create a free account<ArrowUpRight size={15} aria-hidden="true" /></a>
                <button type="button" className="pf-btn is-ghost" onClick={onLogout}><LogOut size={15} aria-hidden="true" />Leave</button>
              </>}
            </div>
          </div>
        </div>

        <aside className="pf-ladder" aria-labelledby="pf-ladder-title">
          <p className="pf-ladder-kicker" id="pf-ladder-title">Rank</p>
          <p className="pf-ladder-name">{rank.name}</p>
          <p className="pf-ladder-next">{nextTier ? <><b>{grouped(nextTier.minPoints - userStats.points)}</b> points to {nextTier.name}</> : 'The top of the ladder.'}</p>
          <ol className="pf-rungs" style={{ '--p': ladder } as Vars}>
            {RANK_TIERS.map((tier, index) => <li key={tier.name} className={index < tierIndex ? 'is-done' : index === tierIndex ? 'is-current' : undefined} aria-current={index === tierIndex ? 'step' : undefined}>
              <i aria-hidden="true">{index < tierIndex && <Check size={10} strokeWidth={3.2} />}</i><span>{tier.name}</span><small>{grouped(tier.minPoints)}</small>
            </li>)}
          </ol>
        </aside>

        <dl className="pf-stats">
          <div><dt>Points</dt><dd><AnimatedNumber value={userStats.points} format={grouped} /></dd><Spark timeline={userStats.learningTimeline} /></div>
          <div><dt>Solved</dt><dd><AnimatedNumber value={solvedCount} /></dd>
            {solvedCount > 0 && <span className="pf-mini is-split" aria-hidden="true">{TOPIC_LIST.map(topic => solvedByTopic[topic] > 0 && <i key={topic} style={{ flexGrow: solvedByTopic[topic], background: TOPIC_HUE[topic] }} />)}</span>}</div>
          <div><dt>Accuracy</dt><dd>{hasAnswers ? <span><AnimatedNumber value={userStats.accuracy} /><small>%</small></span> : <span className="is-none">—</span>}</dd>{hasAnswers && <Dial share={userStats.accuracy / 100} />}</div>
          <div><dt>Streak</dt><dd><AnimatedNumber value={userStats.streak} /><small>{userStats.streak === 1 ? 'day' : 'days'}</small></dd>
            <span className="pf-mini is-week" aria-hidden="true">{lastWeek.map((on, index) => <i key={index} className={on ? 'is-on' : undefined} />)}</span></div>
          <div><dt>Active days</dt><dd><AnimatedNumber value={activeDays} /></dd>
            {activeDays > 0 && <span className="pf-mini is-bars" aria-hidden="true">{byWeekday.map((count, index) => <i key={index} style={{ height: `${Math.max(count / busiest, .12) * 100}%` }} />)}</span>}</div>
        </dl>
      </section>

      {missing.length > 0 && (
        <button type="button" className="pf-nudge" onClick={() => setEditOpen(true)}>
          <span className="pf-nudge-meter" aria-hidden="true">{[0, 1, 2].map(n => <i key={n} className={n < 3 - missing.length ? 'is-on' : undefined} />)}</span>
          <span>Your profile is missing <b>{missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`}</b>. People follow learners they can recognise.</span>
          <span className="pf-nudge-go">Finish it<ArrowRight size={14} aria-hidden="true" /></span>
        </button>
      )}

      <section className="pf-next" aria-labelledby="pf-next-title">
        <h2 id="pf-next-title" className="pf-section-title">Within reach</h2>
        <div className="pf-next-grid">
          <article className="pf-goal">
            <span className="pf-goal-icon" aria-hidden="true"><NearestIcon size={18} /></span>
            <div>
              <p className="pf-goal-kicker">Closest badge</p>
              {nearest
                ? <><h3>{nearest.title}</h3><p>{grouped(Math.min(nearest.progress!.now, nearest.progress!.goal))} of {grouped(nearest.progress!.goal)}{nearest.progress!.unit.startsWith('%') ? '' : ' '}{nearest.progress!.unit}</p>
                    <span className="pf-meter" style={{ '--p': nearest.share } as Vars} aria-hidden="true"><span /></span></>
                : <><h3>{profile ? 'All of them, earned' : 'Badges need an account'}</h3><p>{profile ? 'Nothing left to unlock. For now.' : 'Create one and your first badge is waiting.'}</p></>}
            </div>
          </article>

          <button type="button" className="pf-goal is-action" onClick={() => onPractise?.(started ? weakest.topic : undefined)} style={{ '--hue': started ? TOPIC_HUE[weakest.topic] : undefined } as Vars}>
            <span className="pf-goal-icon is-topic" aria-hidden="true"><i /></span>
            <div>
              <p className="pf-goal-kicker">{started ? 'Where the next points are' : 'A first topic'}</p>
              <h3>{started ? weakest.topic : 'Pick any one to begin'}</h3>
              <p>{started ? weakest.topic === strongest.topic ? `Level at ${weakest.value}% across all four.` : `At ${weakest.value}%, against ${strongest.value}% in ${strongest.topic}.` : 'Your topics fill in as you solve.'}</p>
            </div>
            <ArrowRight className="pf-goal-arrow" size={17} aria-hidden="true" />
          </button>

          <button type="button" className="pf-goal is-action" onClick={() => onPractise?.()}>
            <span className="pf-goal-icon" aria-hidden="true"><Flame size={18} /></span>
            <div>
              <p className="pf-goal-kicker">Streak</p>
              <h3>{userStats.streak > 0 ? `${userStats.streak} ${userStats.streak === 1 ? 'day' : 'days'} and counting` : 'Start one today'}</h3>
              <p>{userStats.streak > 0 ? 'One solved problem today keeps it going.' : 'One solved problem is all it takes.'}</p>
            </div>
            <ArrowRight className="pf-goal-arrow" size={17} aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="pf-columns">
        <div className="pf-main">
          <section className="pf-card" aria-labelledby="pf-activity-title">
            <header className="pf-card-head"><h2 id="pf-activity-title">Activity</h2><span className="pf-muted">Last {WEEKS} weeks</span></header>
            <ActivityGrid gains={rhythm.gains} streak={userStats.streak} />
          </section>

          <section className="pf-card" aria-labelledby="pf-growth-title">
            <header className="pf-card-head"><h2 id="pf-growth-title">Points over time</h2><span className="pf-muted">{activeDays ? plural(activeDays, 'active day') : 'No answers yet'}</span></header>
            <PointsCurve timeline={userStats.learningTimeline} />
          </section>
        </div>

        <aside className="pf-side">
          <section className="pf-card" aria-labelledby="pf-topics-title">
            <header className="pf-card-head"><h2 id="pf-topics-title">Topics</h2><span className="pf-muted">Mastery</span></header>
            <TopicBars skills={userStats.skills} solved={solvedByTopic} onPractise={onPractise} />
          </section>

          <section className="pf-card" aria-labelledby="pf-records-title">
            <header className="pf-card-head"><h2 id="pf-records-title">Records</h2></header>
            <dl className="pf-records">
              <div><dt>Best day</dt><dd>{rhythm.best ? <>+{grouped(rhythm.best.gain)} pts<small>{formatDay(rhythm.best.key * DAY, false)}</small></> : <span className="is-none">—</span>}</dd></div>
              <div><dt>Longest run</dt><dd>{rhythm.longestRun > 0 ? plural(rhythm.longestRun, 'day') : <span className="is-none">—</span>}</dd></div>
              <div><dt>Usual day</dt><dd>{rhythm.favourite != null ? WEEKDAYS[rhythm.favourite] : <span className="is-none">—</span>}</dd></div>
              <div><dt>Time practising</dt><dd>{userStats.timeSpent > 0 ? formatMinutes(Math.round(userStats.timeSpent)) : <span className="is-none">—</span>}</dd></div>
            </dl>
            {activeDays === 0
              ? <p className="pf-records-note">These fill in from your first saved answer.</p>
              : <div className="pf-week" role="img" aria-label={`Active days by weekday: ${byWeekday.map((count, index) => `${WEEKDAYS[(index + 1) % 7].slice(0, -1)} ${count}`).join(', ')}`}>
                  {byWeekday.map((count, index) => (
                    <div key={index} className={rhythm.favourite === (index + 1) % 7 ? 'is-top' : undefined}>
                      <b>{count}</b><i style={{ '--h': Math.max(count / busiest, .06) } as Vars} /><small>{WEEKDAYS[(index + 1) % 7].slice(0, 1)}</small>
                    </div>
                  ))}
                </div>}
          </section>
        </aside>
      </div>

      <section className="pf-card pf-medals" aria-labelledby="pf-medals-title">
        <header className="pf-card-head">
          <h2 id="pf-medals-title">Badges</h2>
          <span className="pf-muted"><b>{unlockedCount}</b> of {badges.length} earned</span>
        </header>
        <ul className="pf-medal-grid">
          {badges.map(badge => {
            const Icon = BADGE_ICON[badge.id] ?? Trophy;
            return (
              <li key={badge.id} className={`pf-medal${badge.unlocked ? ' is-unlocked' : ''}`}>
                <span className="pf-coin-wrap" aria-hidden="true" style={{ '--p': badge.share } as Vars}>
                  {!badge.unlocked && badge.progress && <svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="27" /><circle cx="29" cy="29" r="27" pathLength={1} /></svg>}
                  <span className="pf-coin"><Icon size={20} strokeWidth={1.8} />{!badge.unlocked && <span className="pf-coin-lock"><Lock size={10} strokeWidth={2.4} /></span>}</span>
                </span>
                <div>
                  <h3>{badge.title}</h3>
                  <p>{badge.desc}</p>
                  {badge.unlocked
                    ? <span className="pf-medal-state"><Check size={12} strokeWidth={3} aria-hidden="true" />Earned</span>
                    : badge.progress && <span className="pf-medal-progress">{grouped(Math.min(badge.progress.now, badge.progress.goal))} of {grouped(badge.progress.goal)}{badge.progress.unit.startsWith('%') ? '' : ' '}{badge.progress.unit}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {profile && <ShareCard open={shareOpen} onClose={() => setShareOpen(false)} allDesigns={plan.can('share-designs')} onSeePlans={() => { setShareOpen(false); onSeePlans?.(); }}
        data={{ name: displayName, handle: profile.username, tier: rank.name, level: userStats.level ?? null, points: userStats.points, solved: solvedCount, streak: userStats.streak, accuracy: hasAnswers ? userStats.accuracy : null, skills: userStats.skills }} />}
      {profile && <EditDialog open={editOpen} onClose={() => setEditOpen(false)} onChangePhoto={() => { setEditOpen(false); setPhotoOpen(true); }} onSaved={refreshProfile} />}
      {profile && <PhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} userId={profile.id} current={profile.avatar_url} onSaved={refreshProfile} />}
    </div>
  );
}
