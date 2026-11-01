/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { CalendarDays, Camera, Check, Flame, Lock, LogOut, MapPin, Target, Trophy, Users } from 'lucide-react';
import { UserStats, Problem, Topic } from '../../shared/types';
import { RANK_TIERS, TOPIC_LIST, getRankForPoints, nextRankFor } from '../lib/topics';
import { AnimatedNumber, StaggerItem } from './motion';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS } from '../domain/achievements';
import { ACCEPTED_IMAGE_TYPES } from '../services/data/media';
import { clearAvatar, saveAvatar, type AvatarResult } from '../services/data/avatar';
import UserAvatar from './UserAvatar';
import '../styles/profile.css';

interface ProfileProps {
  userStats: UserStats;
  completedProblems: string[];
  problems: Problem[];
  onLogout: () => void;
  onTriggerAlert?: (achievement: any) => void;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const grouped = (value: number) => Math.round(value).toLocaleString();
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

/* Upload, remove or cancel, stacked the way Instagram's own photo menu is. */
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
 * Activity: one square per day, like a contribution graph
 * ------------------------------------------------------------------------ */

const WEEKS = 22;
const DAY = 86_400_000;

function ActivityGrid({ timeline, streak }: { timeline: UserStats['learningTimeline']; streak: number }) {
  const gains = new Map<number, number>();
  let previous = 0;
  [...timeline].map(day => ({ ...day, time: dayOf(day.date) })).filter(day => Number.isFinite(day.time)).sort((a, b) => a.time - b.time).forEach(day => {
    const key = Math.floor(day.time / DAY);
    gains.set(key, (gains.get(key) ?? 0) + Math.max(day.points - previous, 0));
    previous = day.points;
  });
  const today = Math.floor(Date.now() / DAY);
  const weekday = new Date(today * DAY).getUTCDay();
  const first = today - weekday - (WEEKS - 1) * 7;
  const peak = Math.max(1, ...gains.values());
  const level = (gain: number) => gain <= 0 ? 0 : Math.min(4, Math.ceil(gain / peak * 4));
  const months: { label: string; column: number }[] = [];
  for (let week = 0; week < WEEKS; week++) {
    const date = new Date((first + week * 7) * DAY);
    const label = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
    if (!months.length || months[months.length - 1].label !== label) months.push({ label, column: week });
  }
  const activeDays = [...gains.entries()].filter(([key, gain]) => key >= first && gain > 0).length;

  return <div className="pf-activity">
    <div className="pf-activity-scroll">
      <div className="pf-activity-grid" style={{ '--weeks': WEEKS } as Vars} role="img" aria-label={`${activeDays} active days in the last ${WEEKS} weeks`}>
        <div className="pf-activity-months" aria-hidden="true">{months.map(month => <span key={month.column} style={{ gridColumn: month.column + 1 }}>{month.label}</span>)}</div>
        <div className="pf-activity-days" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
        <div className="pf-activity-cells">
          {Array.from({ length: WEEKS * 7 }, (_, index) => {
            const key = first + Math.floor(index / 7) * 7 + (index % 7);
            const gain = gains.get(key) ?? 0;
            return <i key={index} className={key > today ? 'is-future' : undefined} data-level={level(gain)} title={key > today ? undefined : `${formatDay(key * DAY)} · ${gain ? `+${grouped(gain)} pts` : 'no practice'}`} />;
          })}
        </div>
      </div>
    </div>
    <div className="pf-activity-foot">
      <span><b>{activeDays}</b> active {activeDays === 1 ? 'day' : 'days'} · <b>{streak}</b>-day streak right now</span>
      <span className="pf-legend" aria-hidden="true">Less{[0, 1, 2, 3, 4].map(n => <i key={n} data-level={n} />)}More</span>
    </div>
  </div>;
}

/* --------------------------------------------------------------------------
 * Topics, as plain bars
 * ------------------------------------------------------------------------ */

const TOPIC_HUE: Record<Topic, string> = { Algebra: '#c8842a', Geometry: '#2f9c8c', Combinatorics: '#8b5cf6', 'Number Theory': '#0ea5e9' };

function TopicBars({ skills }: { skills: UserStats['skills'] }) {
  const ranked = TOPIC_LIST.map(topic => ({ topic, value: Math.round(skills[topic] ?? 0) }));
  const sorted = [...ranked].sort((a, b) => b.value - a.value);
  const note = sorted[0].value <= 0 ? 'Solve a few problems and your topics will fill in.'
    : sorted[0].value === sorted[3].value ? `Even across the board at ${sorted[0].value}%.`
    : <>You’re strongest in <b>{sorted[0].topic}</b>. <b>{sorted[3].topic}</b> is where the next points are.</>;
  return <>
    <ul className="pf-topics">{ranked.map(({ topic, value }) => <li key={topic} style={{ '--hue': TOPIC_HUE[topic], '--v': `${value}%` } as Vars}>
      <span className="pf-topic-name"><i aria-hidden="true" />{topic}</span>
      <span className="pf-topic-value">{value}%</span>
      <span className="pf-topic-track" aria-hidden="true"><span /></span>
    </li>)}</ul>
    <p className="pf-note">{note}</p>
  </>;
}

/* --------------------------------------------------------------------------
 * The page
 * ------------------------------------------------------------------------ */

export default function Profile({ userStats, completedProblems, problems, onLogout }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const rank = getRankForPoints(userStats.points);
  const nextTier = nextRankFor(userStats.points);
  const tierIndex = RANK_TIERS.findIndex(tier => tier.name === rank.name);
  const tierProgress = nextTier ? Math.min(1, (userStats.points - rank.minPoints) / (nextTier.minPoints - rank.minPoints)) : 1;

  const { profile, refreshProfile } = useAuth();
  const [photoOpen, setPhotoOpen] = useState(false);
  const badges = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: Boolean(profile) && a.condition(userStats, solvedQuestions.length),
  }));
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const displayName = profile?.display_name || profile?.username || 'Calculix Learner';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;
  const hasAnswers = userStats.completedCount > 0 || userStats.accuracy > 0;
  const activeDays = userStats.learningTimeline.length;

  return (
    <div className="profile-page">
      <section className="pf-card pf-header" aria-labelledby="pf-name">
        <div className="pf-cover" aria-hidden="true">
          <span className="pf-blob is-a" /><span className="pf-blob is-b" /><span className="pf-blob is-c" /><span className="pf-blob is-d" />
          <svg className="pf-contours" viewBox="0 0 800 200" preserveAspectRatio="none">
            {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M-20 ${150 - i * 14} C 140 ${110 - i * 18}, 260 ${190 - i * 9}, 420 ${120 - i * 13} S 690 ${70 - i * 6}, 820 ${118 - i * 15}`} />)}
          </svg>
        </div>

        <div className="pf-header-body">
          <div className="pf-face-wrap">
            {profile
              ? <button type="button" className="pf-face is-editable" onClick={() => setPhotoOpen(true)} aria-label="Change profile photo"><UserAvatar src={profile.avatar_url} /><span className="pf-face-badge" aria-hidden="true"><Camera size={15} strokeWidth={2.2} /></span></button>
              : <div className="pf-face"><UserAvatar src={null} /></div>}
          </div>

          <div className="pf-header-main">
            <div className="pf-name-row">
              <div className="pf-identity">
                <h1 id="pf-name">{displayName}</h1>
                <p className="pf-handle">{profile?.username ? `@${profile.username}` : 'No username yet'}<span className="pf-chip is-level">{userStats.level || 'Unplaced'}</span><span className="pf-chip is-tier"><Trophy size={12} aria-hidden="true" />{rank.name}</span></p>
              </div>
              <div className="pf-header-actions">
                {profile && <button type="button" className="pf-btn" onClick={() => setPhotoOpen(true)}><Camera size={15} aria-hidden="true" />{profile.avatar_url ? 'Change photo' : 'Add photo'}</button>}
                <m.button onClick={onLogout} whileTap={{ scale: 0.96 }} className="pf-btn is-quiet"><LogOut size={15} aria-hidden="true" />Sign out</m.button>
              </div>
            </div>
            {profile?.bio && <p className="pf-bio">{profile.bio}</p>}
            <ul className="pf-facts">
              {profile?.country && <li><MapPin size={14} aria-hidden="true" />{profile.country}</li>}
              {memberSince && <li><CalendarDays size={14} aria-hidden="true" />Joined {memberSince}</li>}
              {profile && <li><Users size={14} aria-hidden="true" /><b>{grouped(profile.follower_count)}</b> {profile.follower_count === 1 ? 'follower' : 'followers'} · <b>{grouped(profile.following_count)}</b> following</li>}
            </ul>
          </div>
        </div>

        <dl className="pf-stats">
          <div><dt>Points</dt><dd><AnimatedNumber value={userStats.points} format={grouped} /></dd></div>
          <div><dt>Solved</dt><dd><AnimatedNumber value={solvedQuestions.length} /></dd></div>
          <div><dt>Accuracy</dt><dd>{hasAnswers ? <span><AnimatedNumber value={userStats.accuracy} /><small>%</small></span> : '—'}</dd></div>
          <div><dt>Streak</dt><dd><AnimatedNumber value={userStats.streak} /><small>{userStats.streak === 1 ? 'day' : 'days'}</small></dd></div>
          <div><dt>Global rank</dt><dd>{userStats.rank > 0 ? <>#{grouped(userStats.rank)}</> : '—'}</dd></div>
        </dl>
      </section>

      <div className="pf-columns">
        <div className="pf-main">
          <section className="pf-card" aria-labelledby="pf-activity-title">
            <header className="pf-card-head"><h2 id="pf-activity-title"><Flame size={17} aria-hidden="true" />Activity</h2><span className="pf-muted">Last {WEEKS} weeks</span></header>
            <ActivityGrid timeline={userStats.learningTimeline} streak={userStats.streak} />
          </section>

          <section className="pf-card pf-growth" aria-labelledby="pf-growth-title">
            <header className="pf-card-head"><h2 id="pf-growth-title"><Target size={17} aria-hidden="true" />Points over time</h2><span className="pf-muted">{activeDays ? `${activeDays} active ${activeDays === 1 ? 'day' : 'days'}` : 'No answers yet'}</span></header>
            <PointsCurve timeline={userStats.learningTimeline} />
          </section>
        </div>

        <aside className="pf-side">
          <section className="pf-card pf-rank" aria-labelledby="pf-rank-title">
            <header className="pf-card-head"><h2 id="pf-rank-title"><Trophy size={17} aria-hidden="true" />Rank</h2><span className="pf-muted">{grouped(userStats.points)} pts</span></header>
            <p className="pf-rank-name">{rank.name}</p>
            <p className="pf-muted">{nextTier ? <>{grouped(nextTier.minPoints - userStats.points)} points until <b>{nextTier.name}</b></> : 'You’ve reached the top tier.'}</p>
            <div className="pf-rank-bar" style={{ '--p': tierProgress } as Vars} aria-hidden="true"><span /></div>
            <ol className="pf-rank-steps">{RANK_TIERS.map((tier, index) => <li key={tier.name} className={index < tierIndex ? 'is-done' : index === tierIndex ? 'is-current' : undefined}>
              <i aria-hidden="true">{index < tierIndex ? <Check size={11} strokeWidth={3} /> : null}</i><span>{tier.name}</span><small>{grouped(tier.minPoints)}</small>
            </li>)}</ol>
          </section>

          <section className="pf-card" aria-labelledby="pf-topics-title">
            <header className="pf-card-head"><h2 id="pf-topics-title">Topics</h2><span className="pf-muted">Mastery</span></header>
            <TopicBars skills={userStats.skills} />
          </section>
        </aside>
      </div>

      <section className="pf-card pf-medals" aria-labelledby="pf-medals-title">
        <header className="pf-card-head">
          <h2 id="pf-medals-title">Badges</h2>
          <span className="pf-medal-count"><b>{unlockedCount}</b>/{badges.length}<span className="pf-medal-meter" aria-hidden="true"><span style={{ width: `${unlockedCount / Math.max(badges.length, 1) * 100}%` }} /></span></span>
        </header>
        <div className="pf-medal-grid">
          {badges.map((b, index) => (
            <StaggerItem key={b.id} index={index} inView className={`pf-medal${b.unlocked ? ' is-unlocked' : ''}`}>
              <span className="pf-coin" aria-hidden="true">{b.icon}{!b.unlocked && <span className="pf-coin-lock"><Lock size={11} /></span>}</span>
              <div><h3>{b.title}</h3><p>{b.desc}</p></div>
            </StaggerItem>
          ))}
        </div>
      </section>

      {profile && <PhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} userId={profile.id} current={profile.avatar_url} onSaved={refreshProfile} />}
    </div>
  );
}
