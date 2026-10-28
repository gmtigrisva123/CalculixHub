import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { m } from 'motion/react';
import { ArrowRight, ArrowUpRight, Check, Flame, LocateFixed, RefreshCw, Search, Sparkles, Trophy } from 'lucide-react';
import type { LeaderboardRow } from '../services/database.types';
import { spring, staggerDelay } from '../lib/motion';
import UserAvatar from './UserAvatar';
import '../styles/leaderboard.css';

interface Props {
  rows: LeaderboardRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  currentUserId: string | null;
  currentRank: number;
  currentPoints: number;
  currentSolved: number;
  onPractice: () => void;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const nameOf = (row: LeaderboardRow) => row.display_name?.trim() || row.username;
const ordinalOf = (n: number) => {
  const suffix = ['th', 'st', 'nd', 'rd'], tail = n % 100;
  return n + (suffix[(tail - 20) % 10] || suffix[tail] || suffix[0]);
};

const METALS = ['gold', 'silver', 'bronze'] as const;
/* The tallest column fills this share of the plot; the rest is headroom for its medallion. */
const HEADROOM = 0.78;

function Avatar({ row, className }: { row: LeaderboardRow; className: string }) {
  return <span className={`lb-avatar ${className}`} aria-hidden="true"><UserAvatar src={row.avatar_url} /></span>;
}

/*
 * A smooth curve through the medallion centres, as cubic Béziers. It leaves and
 * rejoins the axis flat, so the podium reads as a bell rather than a zig-zag,
 * and its control points never dip below the axis.
 */
function curveThrough(points: Array<[number, number]>, floor: number) {
  const at = (x: number, y: number) => `${x.toFixed(1)},${Math.min(y, floor).toFixed(1)}`;
  return points.reduce((path, [x, y], i) => {
    if (i === 0) return `M${at(x, y)}`;
    const [px, py] = points[i - 1];
    const [ppx, ppy] = points[i - 2] ?? [px, py];
    const [nx, ny] = points[i + 1] ?? [x, y];
    const c1 = i === 1 ? at(px + (x - px) / 2, py) : at(px + (x - ppx) / 6, py + (y - ppy) / 6);
    const c2 = i === points.length - 1 ? at(x - (x - px) / 2, y) : at(x - (nx - px) / 6, y - (ny - py) / 6);
    return `${path} C${c1} ${c2} ${at(x, y)}`;
  }, '');
}

function Podium({ leaders, currentUserId }: { leaders: LeaderboardRow[]; currentUserId: string | null }) {
  const plot = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = plot.current;
    if (!node) return;
    const measure = () => setBox({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const top = Math.max(leaders[0].points, 1);
  /* With three on the board the leader stands in the middle, second to the left, third to the right. */
  const slots = leaders.length === 3 ? [1, 0, 2] : leaders.map((_, index) => index);
  const heightOf = (row: LeaderboardRow) => Math.max(row.points / top, 0.14) * HEADROOM;
  const { width: w, height: h } = box;
  const line = curveThrough([[0, h], ...slots.map((index, slot): [number, number] => [w * (slot + 0.5) / slots.length, h * (1 - heightOf(leaders[index]))]), [w, h]], h);

  return <div className={`lb-podium lb-podium-${slots.length}`} style={{ '--n': slots.length } as Vars}>
    <div className="lb-plot" ref={plot} aria-hidden="true">
      {[1, 0.5, 0].map(at => <span key={at} className="lb-guide" style={{ '--at': at * HEADROOM } as Vars}><span>{Math.round(top * at).toLocaleString()}</span></span>)}
      {w > 0 && <svg className="lb-curve" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        <defs><linearGradient id="lb-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6bd73" stopOpacity=".3" /><stop offset="1" stopColor="#e6bd73" stopOpacity="0" /></linearGradient></defs>
        <path className="lb-curve-area" d={`${line} L${w},${h} L0,${h} Z`} />
        <path className="lb-curve-line" d={line} pathLength={1} />
      </svg>}
    </div>
    <ol className="lb-columns">{leaders.map((row, index) => {
      const you = row.user_id === currentUserId;
      return <li key={row.user_id} className={`lb-column lb-${METALS[index]}${you ? ' is-you' : ''}`} style={{ '--share': heightOf(row), '--i': index, order: slots.indexOf(index) } as Vars}>
        <div className="lb-stage" aria-hidden="true">
          {index === 0 && <span className="lb-rays" />}
          <span className="lb-bar" />
          <span className="lb-medallion"><Avatar row={row} className="lb-medallion-face" /><span className="lb-medal-rank">{index === 0 ? <Trophy size={12} strokeWidth={2.4} /> : row.rank}</span></span>
        </div>
        <div className="lb-caption">
          <span className="lb-place">{ordinalOf(row.rank)}</span>
          <h3><span>{nameOf(row)}</span>{you && <small className="lb-you-tag">You</small>}</h3>
          <p className="lb-handle">@{row.username}</p>
          <p className="lb-caption-points"><strong>{row.points.toLocaleString()}</strong> pts</p>
          <p className="lb-caption-meta">{row.problems_solved} solved<span className="lb-caption-level"> · {row.level}</span></p>
        </div>
      </li>;
    })}</ol>
  </div>;
}

/* Three empty columns under a dashed curve: the shape of the board before anyone is on it. */
function GhostPodium({ loading }: { loading: boolean }) {
  const shares = [0.6, 0.86, 0.42].map(share => share * HEADROOM);
  const line = curveThrough([[0, 100], ...shares.map((share, slot): [number, number] => [50 + slot * 100, 100 * (1 - share)]), [300, 100]], 100);
  return <div className={`lb-podium lb-ghost${loading ? ' is-loading' : ''}`} style={{ '--n': 3 } as Vars} aria-hidden="true">
    <div className="lb-plot"><svg className="lb-curve" viewBox="0 0 300 100" preserveAspectRatio="none"><path className="lb-ghost-line" d={line} vectorEffect="non-scaling-stroke" /></svg></div>
    <ol className="lb-columns">{shares.map((share, slot) => <li key={slot} className="lb-column" style={{ '--share': share, '--i': slot } as Vars}>
      <div className="lb-stage"><span className="lb-bar" /><span className="lb-medallion" /></div>
      <div className="lb-caption"><span className="lb-ghost-text" /><span className="lb-ghost-text is-short" /></div>
    </li>)}</ol>
  </div>;
}

export default function Leaderboard({ rows, loading, error, onRefresh, currentUserId, currentRank, currentPoints, currentSolved, onPractice }: Props) {
  const [scope, setScope] = useState<'ten' | 'fifty'>('fifty');
  const [query, setQuery] = useState('');
  const ownRow = useRef<HTMLLIElement>(null);
  const ownCard = useRef<HTMLElement>(null);
  const limit = scope === 'ten' ? 10 : 50;
  const me = rows.find(row => row.user_id === currentUserId);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return rows.slice(0, limit).filter(row => !term || `${row.display_name} ${row.username}`.toLocaleLowerCase().includes(term));
  }, [rows, limit, query]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ points: sum.points + row.points, solved: sum.solved + row.problems_solved }), { points: 0, solved: 0 }), [rows]);
  const leaders = rows.slice(0, 3);
  const top = Math.max(rows[0]?.points ?? 0, 1);
  const myRank = me?.rank ?? (currentRank > 0 ? currentRank : null);
  const myPoints = me?.points ?? currentPoints;
  const mySolved = me?.problems_solved ?? currentSolved;
  /* The learner directly ahead: the lowest-placed row that still has more points. */
  const ahead = currentUserId && myRank ? [...rows].reverse().find(row => row.user_id !== currentUserId && row.points > myPoints) : undefined;
  const standing = !currentUserId ? 'Sign in to save a place on the board.'
    : !myRank ? 'Your first saved answer starts your rank.'
    : ahead ? <><strong>{(ahead.points - myPoints).toLocaleString()} pts</strong> behind {nameOf(ahead)} at #{ahead.rank}</>
    : 'You lead the board.';

  const findMe = () => {
    if (!me) return;
    setQuery('');
    if (me.rank > limit) setScope('fifty');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = ownRow.current;
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row?.animate([{ boxShadow: '0 0 0 0 rgba(79,184,168,.55)' }, { boxShadow: '0 0 0 10px rgba(79,184,168,0)' }], { duration: 1100, delay: 350, iterations: 2, easing: 'ease-out' });
    }));
  };

  return <div className="leaderboard-page">
    <header className="lb-hero">
      <div className="lb-hero-copy">
        <p className="lb-eyebrow"><span className="lb-pulse" aria-hidden="true" />Live standings · Global · All time</p>
        <h1>Every solved problem <em>raises the curve.</em></h1>
        <p className="lb-lede">Learners ranked by the points their saved practice earns. The board moves as new answers come in.</p>
        {rows.length > 0 && <dl className="lb-ledger">
          <div><dt>Learners ranked</dt><dd>{rows.length}</dd></div>
          <div><dt>Points earned</dt><dd>{totals.points.toLocaleString()}</dd></div>
          <div><dt>Problems solved</dt><dd>{totals.solved.toLocaleString()}</dd></div>
        </dl>}
      </div>
      <div className="lb-hero-plot">{leaders.length ? <Podium leaders={leaders} currentUserId={currentUserId} /> : <GhostPodium loading={loading} />}</div>
    </header>

    {error && <div className="lb-error" role="alert"><span>{error}</span><button onClick={() => void onRefresh()}>Try again <RefreshCw size={15} /></button></div>}

    {loading && rows.length === 0 ? <div className="lb-loading" role="status">
      {Array.from({ length: 6 }, (_, index) => <span key={index} className="lb-skeleton" style={{ '--i': index } as Vars} />)}
      <p>Opening the standings…</p>
    </div> : rows.length === 0 ? <section className="lb-empty">
      <span className="lb-empty-mark" aria-hidden="true"><Sparkles size={22} strokeWidth={1.6} /></span>
      <p className="lb-kicker">The first page is blank</p>
      <h2>There’s room for your name.</h2>
      <p>Standings appear after real learners submit practice answers. Placement alone does not earn points.</p>
      <button onClick={onPractice}>{currentUserId ? 'Choose a question' : 'Sign in to begin'} <ArrowUpRight size={17} /></button>
    </section> : <div className="lb-lower">
      <section className="lb-standings" aria-labelledby="lb-standings-title">
        <div className="lb-standings-head">
          <div><p className="lb-kicker">Top {limit} · by learning points</p><h2 id="lb-standings-title">Standings</h2></div>
          <button className="lb-refresh" onClick={() => void onRefresh()} disabled={loading} aria-label="Refresh leaderboard"><RefreshCw size={16} className={loading ? 'is-loading' : ''} /></button>
        </div>
        <div className="lb-toolbar">
          <div className="lb-scope" role="group" aria-label="Leaderboard range">
            {(['ten', 'fifty'] as const).map(value => <button key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>
              {scope === value && <m.span layoutId="lb-scope-pill" className="lb-scope-pill" transition={spring.snappy} />}
              <span>Top {value === 'ten' ? 10 : 50}</span>
            </button>)}
          </div>
          <label className="lb-search"><Search size={16} aria-hidden="true" /><span className="lb-sr">Search learners in this range</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search top ${limit}`} /></label>
        </div>
        <div className="lb-column-head"><span>Place</span><span>Learner</span><span>Solved</span><span>Points</span></div>
        {visible.length ? <ol className="lb-list">{visible.map((row, index) => {
          const you = row.user_id === currentUserId;
          const metal = row.rank <= 3 ? METALS[row.rank - 1] : null;
          const delay = staggerDelay(index, 0.03, 0.45);
          return <m.li ref={you ? ownRow : undefined} key={row.user_id} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay, layout: spring.smooth }} className={`lb-row${metal ? ` lb-${metal}` : ''}${you ? ' is-you' : ''}`} style={{ '--share': Math.min(row.points / top, 1) } as Vars}>
            <span className="lb-row-rank">{row.rank}</span>
            <span className="lb-row-person"><Avatar row={row} className="lb-row-avatar" /><span className="lb-row-identity"><strong><span>{nameOf(row)}</span>{you && <small className="lb-you-tag">You</small>}</strong><em>@{row.username} · {row.level}</em></span></span>
            <span className="lb-row-solved"><Check size={14} strokeWidth={2.4} aria-hidden="true" />{row.problems_solved}</span>
            <strong className="lb-row-points">{row.points.toLocaleString()}<small> pts</small></strong>
            <span className="lb-row-measure" aria-hidden="true" />
          </m.li>;
        })}</ol> : <p className="lb-no-results">No learner matches that search in the selected range.</p>}
        <p className="lb-method">Global rank is based on saved learning points, then problems solved. Accuracy and streak are shown as context, not as extra points. The line under each learner is drawn to scale against the leader.</p>
      </section>

      <aside className="lb-aside">
        <section className="lb-you" ref={ownCard} aria-labelledby="lb-your-title">
          <div className="lb-you-head"><p className="lb-kicker">Your place</p>{me && me.current_streak > 0 && <span className="lb-you-streak"><Flame size={14} aria-hidden="true" />{me.current_streak} {me.current_streak === 1 ? 'day' : 'days'} in a row</span>}</div>
          <h2 id="lb-your-title" className={`lb-you-rank${currentUserId && myRank ? '' : ' is-text'}`}>{currentUserId ? (myRank ? <><span>#</span>{myRank}</> : 'A place to begin') : 'Join the board'}</h2>
          <p className="lb-you-note">{standing}</p>
          <dl className="lb-you-numbers">
            <div><dt>Points</dt><dd>{currentUserId ? myPoints.toLocaleString() : '—'}</dd></div>
            <div><dt>Solved</dt><dd>{currentUserId ? mySolved : '—'}</dd></div>
            <div><dt>Accuracy</dt><dd>{me?.accuracy_pct == null ? '—' : `${me.accuracy_pct}%`}</dd></div>
          </dl>
          <figure className="lb-field">
            <figcaption><span>The field</span><span>Each dot is one learner in the top {rows.length}</span></figcaption>
            <div className="lb-field-track" aria-hidden="true">
              {rows.map(row => row.user_id === currentUserId ? null : <i key={row.user_id} style={{ '--x': Math.min(row.points / top, 1), '--y': row.rank % 4 } as Vars} />)}
              {currentUserId && myPoints > 0 && <span className={`lb-field-you${myPoints / top > 0.75 ? ' is-flipped' : ''}`} style={{ '--x': Math.min(myPoints / top, 1) } as Vars}><b>You</b></span>}
            </div>
            <div className="lb-field-scale" aria-hidden="true"><span>0</span><span>{top.toLocaleString()} pts</span></div>
          </figure>
          <button className="lb-you-cta" onClick={onPractice}><span>{currentUserId ? 'Back to practice' : 'Sign in or create account'}</span><ArrowRight size={17} /></button>
          {currentUserId && <button className="lb-you-find" onClick={findMe} disabled={!me}><LocateFixed size={15} aria-hidden="true" /> Find my place</button>}
        </section>
        <div className="lb-rule"><p className="lb-kicker">How the order works</p><p>Only saved practice contributes. The board starts empty, updates from real submissions, and never counts a placement test as points.</p></div>
      </aside>
    </div>}
  </div>;
}
