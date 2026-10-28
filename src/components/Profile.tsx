/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { Lock, LogOut, Sparkles } from 'lucide-react';
import { UserStats, Problem, Topic } from '../../shared/types';
import { RANK_TIERS, getRankForPoints, nextRankFor } from '../lib/topics';
import { AnimatedNumber, StaggerItem } from './motion';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS } from '../domain/achievements';
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
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase();
const dayOf = (date: string) => Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);
const formatDay = (time: number, withYear = true) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' });

/* --------------------------------------------------------------------------
 * The skill rose: a Nightingale diagram with the learner at its origin
 * ------------------------------------------------------------------------ */

/* Each topic owns a quadrant on the diagonal, pointing at the corner its label sits in. */
const PETALS: Array<{ topic: Topic; angle: number; corner: string }> = [
  { topic: 'Algebra', angle: -135, corner: 'tl' },
  { topic: 'Geometry', angle: -45, corner: 'tr' },
  { topic: 'Combinatorics', angle: 45, corner: 'br' },
  { topic: 'Number Theory', angle: 135, corner: 'bl' },
];
const CENTRE = 200, INNER = 60, OUTER = 146, HALF_SPAN = 39;
const radiusFor = (mastery: number) => INNER + (OUTER - INNER) * Math.min(Math.max(mastery, 0), 100) / 100;
const polar = (radius: number, degrees: number) => {
  const angle = degrees * Math.PI / 180;
  return `${(CENTRE + radius * Math.cos(angle)).toFixed(2)},${(CENTRE + radius * Math.sin(angle)).toFixed(2)}`;
};
const sector = (inner: number, outer: number, from: number, to: number) =>
  `M${polar(outer, from)} A${outer},${outer} 0 0 1 ${polar(outer, to)} L${polar(inner, to)} A${inner},${inner} 0 0 0 ${polar(inner, from)} Z`;
const arc = (radius: number, from: number, to: number) => `M${polar(radius, from)} A${radius},${radius} 0 0 1 ${polar(radius, to)}`;

function SkillRose({ skills, face }: { skills: UserStats['skills']; face: React.ReactNode }) {
  const ranked = PETALS.map(({ topic }) => ({ topic, value: skills[topic] ?? 0 })).sort((a, b) => b.value - a.value);
  const strongest = ranked[0], weakest = ranked[ranked.length - 1];
  const summary = strongest.value <= 0 ? 'Solve a few problems and your topics will take shape here.'
    : strongest.value === weakest.value ? `Even across all four topics at ${Math.round(strongest.value)}%.`
    : <>Strongest in <b>{strongest.topic}</b>. {weakest.topic} has the most room to grow.</>;

  return <figure className="pf-rose">
    <div className="pf-rose-plot">
      <svg viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <pattern id="pf-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" /></pattern>
          <radialGradient id="pf-petal-fill" cx={CENTRE} cy={CENTRE} r={OUTER} gradientUnits="userSpaceOnUse"><stop offset=".4" stopColor="#e6bd73" stopOpacity=".05" /><stop offset="1" stopColor="#e6bd73" stopOpacity=".4" /></radialGradient>
        </defs>
        <g className="pf-rose-grid">
          {[25, 50, 75, 100].map(mark => <circle key={mark} cx={CENTRE} cy={CENTRE} r={radiusFor(mark)} />)}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => <path key={angle} d={`M${polar(INNER, angle)} L${polar(OUTER + 14, angle)}`} />)}
        </g>
        {[25, 50, 75, 100].map(mark => <text key={mark} className="pf-rose-tick" x={CENTRE + 5} y={CENTRE - radiusFor(mark) - 4}>{mark}</text>)}
        {PETALS.map(({ topic, angle }) => <path key={topic} className="pf-petal-track" d={sector(INNER, OUTER, angle - HALF_SPAN, angle + HALF_SPAN)} />)}
        {PETALS.map(({ topic, angle }, index) => {
          const value = skills[topic] ?? 0;
          if (value <= 0) return null;
          const reach = radiusFor(value);
          return <g key={topic} className="pf-petal" style={{ '--i': index } as Vars}>
            <path className="pf-petal-fill" d={sector(INNER, reach, angle - HALF_SPAN, angle + HALF_SPAN)} />
            <path className="pf-petal-hatch" d={sector(INNER, reach, angle - HALF_SPAN, angle + HALF_SPAN)} />
            <path className="pf-petal-cap" d={arc(reach, angle - HALF_SPAN, angle + HALF_SPAN)} />
          </g>;
        })}
      </svg>
      <div className="pf-rose-face">{face}</div>
      {PETALS.map(({ topic, corner }) => <p key={topic} className={`pf-rose-label is-${corner}`}><span>{topic}</span><strong>{Math.round(skills[topic] ?? 0)}<small>%</small></strong></p>)}
    </div>
    <figcaption>{summary}</figcaption>
  </figure>;
}

/* --------------------------------------------------------------------------
 * The tier ladder
 * ------------------------------------------------------------------------ */

/*
 * Four equal stages, each read linearly between its own thresholds. Elite has
 * no ceiling, so for drawing it runs to half again its threshold.
 */
function ladderPosition(points: number) {
  const edges = [...RANK_TIERS.map(tier => tier.minPoints), RANK_TIERS[RANK_TIERS.length - 1].minPoints * 1.5];
  const stage = Math.max(0, RANK_TIERS.findIndex((_, index) => points < edges[index + 1]));
  const last = RANK_TIERS.length - 1;
  const index = points >= edges[last + 1] ? last : stage;
  return (index + Math.min((points - edges[index]) / (edges[index + 1] - edges[index]), 1)) / RANK_TIERS.length;
}

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
 * The page
 * ------------------------------------------------------------------------ */

export default function Profile({ userStats, completedProblems, problems, onLogout }: ProfileProps) {
  const solvedQuestions = problems.filter((p) => completedProblems.includes(p.id));
  const rank = getRankForPoints(userStats.points);
  const nextTier = nextRankFor(userStats.points);

  const { profile } = useAuth();
  const [photoBroken, setPhotoBroken] = useState(false);
  const badges = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: Boolean(profile) && a.condition(userStats, solvedQuestions.length),
  }));
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const displayName = profile?.display_name || profile?.username || 'Calculix Learner';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const hasAnswers = userStats.completedCount > 0 || userStats.accuracy > 0;
  const face = profile?.avatar_url && !photoBroken
    ? <img src={profile.avatar_url} alt="" onError={() => setPhotoBroken(true)} />
    : <span>{initialsOf(displayName) || 'C'}</span>;

  return (
    <div className="profile-page">
      <header className="pf-hero">
        <div className="pf-hero-top">
          <p className="pf-eyebrow"><span aria-hidden="true" />Your own learning journey</p>
          <m.button onClick={onLogout} whileTap={{ scale: 0.95 }} className="pf-signout"><LogOut size={15} aria-hidden="true" /> Sign out</m.button>
        </div>

        <div className="pf-hero-body">
          <div className="pf-identity">
            <h1>{displayName}</h1>
            <p className="pf-handle">
              {profile?.username ? <span>@{profile.username}</span> : <span>No username yet</span>}
              <span className="pf-level">{userStats.level || 'Unplaced'}</span>
            </p>
            {profile?.bio && <p className="pf-bio">{profile.bio}</p>}
            <ul className="pf-facts">
              {memberSince && <li>Member since {memberSince}</li>}
              {profile?.country && <li>{profile.country}</li>}
              {profile && <li><b>{grouped(profile.follower_count)}</b> {profile.follower_count === 1 ? 'follower' : 'followers'} · <b>{grouped(profile.following_count)}</b> following</li>}
            </ul>

            <div className="pf-ladder" style={{ '--p': ladderPosition(userStats.points) } as Vars}>
              <div className="pf-ladder-head">
                <p><span className="pf-kicker">Rank tier</span><strong>{rank.name}</strong></p>
                <span>{nextTier ? `${grouped(nextTier.minPoints - userStats.points)} pts to ${nextTier.name}` : 'Top tier reached'}</span>
              </div>
              <div className="pf-ladder-track" aria-hidden="true"><span className="pf-ladder-fill" /><span className="pf-ladder-marker"><b>{grouped(userStats.points)}</b></span></div>
              <ol className="pf-ladder-stops">{RANK_TIERS.map(tier => <li key={tier.name} className={tier.name === rank.name ? 'is-current' : userStats.points >= tier.minPoints ? 'is-passed' : undefined}>
                <span>{tier.name}</span><small>{grouped(tier.minPoints)}</small>
              </li>)}</ol>
            </div>
          </div>

          <SkillRose skills={userStats.skills} face={face} />
        </div>
      </header>

      <dl className="pf-readouts">
        <div><dt>Total points</dt><dd className="is-accent"><AnimatedNumber value={userStats.points} format={grouped} /></dd><p>Earned via solves &amp; contests</p></div>
        <div><dt>Problems solved</dt><dd><AnimatedNumber value={solvedQuestions.length} /></dd><p>From your saved practice</p></div>
        <div><dt>Accuracy</dt><dd>{hasAnswers ? <span><AnimatedNumber value={userStats.accuracy} />%</span> : '—'}</dd><p>Across every saved answer</p></div>
        <div><dt>Streak</dt><dd><AnimatedNumber value={userStats.streak} /><small>{userStats.streak === 1 ? 'day' : 'days'}</small></dd><p>Active days in a row</p></div>
        <div><dt>Global rank</dt><dd>{userStats.rank > 0 ? <>#{grouped(userStats.rank)}</> : '—'}</dd><p>{userStats.rank > 0 ? 'On the leaderboard' : 'Starts with your first answer'}</p></div>
        <div><dt>Placement tier</dt><dd className="is-word">{userStats.level || 'Unplaced'}</dd><p>{userStats.level ? 'Set by placement assessment' : 'Placement assessment required'}</p></div>
      </dl>

      <div className="pf-split">
        <section className="pf-card pf-growth" aria-labelledby="pf-growth-title">
          <div className="pf-card-head">
            <div><p className="pf-kicker">{userStats.learningTimeline.length ? `Cumulative · ${userStats.learningTimeline.length} active ${userStats.learningTimeline.length === 1 ? 'day' : 'days'}` : 'Cumulative points'}</p><h2 id="pf-growth-title">Points, added up</h2></div>
            <span className="pf-integral" aria-hidden="true">∫</span>
          </div>
          <PointsCurve timeline={userStats.learningTimeline} />
        </section>

        <section className="pf-card pf-account" aria-labelledby="pf-account-title">
          <div className="pf-card-head"><div><p className="pf-kicker">Account</p><h2 id="pf-account-title">Identity &amp; details</h2></div></div>
          <dl className="pf-ledger">
            <div><dt>Display name</dt><dd>{displayName}</dd></div>
            <div><dt>Username</dt><dd>{profile?.username ? `@${profile.username}` : 'Not set'}</dd></div>
            <div><dt>Member since</dt><dd>{memberSince ?? 'Not available'}</dd></div>
            <div><dt>Country</dt><dd>{profile?.country ?? 'Not set'}</dd></div>
          </dl>
        </section>
      </div>

      <section className="pf-medals" aria-labelledby="pf-medals-title">
        <div className="pf-medals-head">
          <div><p className="pf-kicker">Achievement badges</p><h2 id="pf-medals-title">Medals earned along the way</h2></div>
          <div className="pf-medal-count">
            <span><b>{unlockedCount}</b> of {badges.length} unlocked</span>
            <ol aria-hidden="true">{badges.map(b => <li key={b.id} className={b.unlocked ? 'is-on' : undefined} />)}</ol>
          </div>
        </div>
        <div className="pf-medal-grid">
          {badges.map((b, index) => (
            <StaggerItem key={b.id} index={index} inView className={`pf-medal${b.unlocked ? ' is-unlocked' : ''}`}>
              <span className="pf-coin" aria-hidden="true"><span className="pf-coin-face">{b.icon}</span></span>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
              <span className="pf-medal-state">{b.unlocked ? <><Sparkles size={11} aria-hidden="true" /> Unlocked</> : <><Lock size={11} aria-hidden="true" /> Locked</>}</span>
            </StaggerItem>
          ))}
        </div>
      </section>
    </div>
  );
}
