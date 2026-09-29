import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Flame, RefreshCw, Search, Sparkles, Trophy } from 'lucide-react';
import type { LeaderboardRow } from '../services/database.types';
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

const nameOf = (row: LeaderboardRow) => row.display_name?.trim() || row.username;
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase();

export default function Leaderboard({ rows, loading, error, onRefresh, currentUserId, currentRank, currentPoints, currentSolved, onPractice }: Props) {
  const [scope, setScope] = useState<'ten' | 'fifty'>('fifty');
  const [query, setQuery] = useState('');
  const ownRow = useRef<HTMLLIElement>(null);
  const ownCard = useRef<HTMLElement>(null);
  const me = rows.find(row => row.user_id === currentUserId);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return rows.slice(0, scope === 'ten' ? 10 : 50).filter(row => !term || `${row.display_name} ${row.username}`.toLocaleLowerCase().includes(term));
  }, [rows, scope, query]);
  const leaders = rows.slice(0, 3);
  const myRank = me?.rank ?? (currentRank > 0 ? currentRank : null);
  const myPoints = me?.points ?? currentPoints;
  const mySolved = me?.problems_solved ?? currentSolved;
  const findMe = () => {
    if (me && me.rank <= (scope === 'ten' ? 10 : 50)) {
      setQuery('');
      requestAnimationFrame(() => ownRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } else {
      ownCard.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return <div className="leaderboard-page">
    <header className="lb-intro">
      <div><p className="lb-eyebrow"><span /> THE LEARNING LEDGER</p><h1>Every good idea<br /><em>moves you forward.</em></h1><p>Real learners, real work. Your place here grows one solved problem at a time.</p></div>
      <div className="lb-intro-aside"><div className="lb-orbit" aria-hidden="true"><span>∑</span><i /><i /><i /></div><p>POINTS EARNED THROUGH PRACTICE</p></div>
    </header>

    <div className="lb-meta"><span><span className="lb-live-dot" /> Live standings</span><span>Global · All time · Top {scope === 'ten' ? '10' : '50'}</span></div>

    {error && <div className="lb-error" role="alert"><span>{error}</span><button onClick={() => void onRefresh()}>Try again <RefreshCw size={15} /></button></div>}
    {loading && rows.length === 0 ? <div className="lb-loading" role="status">Opening the standings…</div> : rows.length === 0 ? <section className="lb-empty"><Sparkles size={28} strokeWidth={1.4} /><span>THE FIRST PAGE IS BLANK</span><h2>There’s room for your name.</h2><p>Standings appear after real learners submit practice answers. Placement alone does not earn points.</p><button onClick={onPractice}>{currentUserId ? 'Choose a question' : 'Sign in to begin'} <ArrowUpRight size={17} /></button></section> : <>
      <section className="lb-leaders" aria-labelledby="lb-leaders-title">
        <div className="lb-section-heading"><div><p>AT THE FRONT</p><h2 id="lb-leaders-title">The leading minds</h2></div><span>{leaders.length} {leaders.length === 1 ? 'learner' : 'learners'} in focus</span></div>
        <div className={`lb-leader-grid lb-count-${leaders.length}`}>{leaders.map((row, index) => <article key={row.user_id} className={`lb-leader lb-leader-${index + 1}${row.user_id === currentUserId ? ' is-you' : ''}`}>
          <div className="lb-leader-top"><span className="lb-place">{String(row.rank).padStart(2, '0')}</span><span>{index === 0 ? <Trophy size={20} strokeWidth={1.4} /> : <span className="lb-leader-rule" />}</span></div>
          <div className="lb-portrait" aria-hidden="true">{initialsOf(nameOf(row))}</div>
          <div className="lb-leader-name"><h3>{nameOf(row)}</h3>{row.user_id === currentUserId && <span>YOU</span>}</div>
          <p>@{row.username}</p>
          <div className="lb-leader-score"><strong>{row.points.toLocaleString()}</strong><span>learning points</span></div>
          <div className="lb-leader-foot"><span>{row.problems_solved} solved</span><span>{row.level}</span></div>
        </article>)}</div>
      </section>

      <div className="lb-lower">
        <section className="lb-standings" aria-labelledby="lb-standings-title">
          <div className="lb-section-heading"><div><p>THE FULL PICTURE</p><h2 id="lb-standings-title">Standings</h2></div><button className="lb-refresh" onClick={() => void onRefresh()} disabled={loading} aria-label="Refresh leaderboard"><RefreshCw size={17} className={loading ? 'is-loading' : ''} /></button></div>
          <div className="lb-toolbar"><div className="lb-scope" role="group" aria-label="Leaderboard range"><button aria-pressed={scope === 'ten'} onClick={() => setScope('ten')}>Top 10</button><button aria-pressed={scope === 'fifty'} onClick={() => setScope('fifty')}>Top 50</button></div><label className="lb-search"><Search size={17} /><span className="sr-only">Search learners in this range</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search top ${scope === 'ten' ? '10' : '50'}`} /></label></div>
          <div className="lb-column-head"><span>PLACE / LEARNER</span><span>SOLVED</span><span>POINTS</span></div>
          {visible.length ? <ol className="lb-list">{visible.map(row => <li ref={row.user_id === currentUserId ? ownRow : undefined} key={row.user_id} className={row.user_id === currentUserId ? 'is-you' : ''}>
            <span className="lb-row-person"><span className="lb-row-rank">{String(row.rank).padStart(2, '0')}</span><span className="lb-row-avatar" aria-hidden="true">{initialsOf(nameOf(row))}</span><span className="lb-row-identity"><strong>{nameOf(row)} {row.user_id === currentUserId && <small>YOU</small>}</strong><em>@{row.username}</em></span></span>
            <span className="lb-row-solved"><Check size={15} /> {row.problems_solved}</span><strong className="lb-row-points">{row.points.toLocaleString()} <small>pts</small></strong>
          </li>)}</ol> : <p className="lb-no-results">No learner matches that search in the selected range.</p>}
          <p className="lb-method">Global rank is based on saved learning points, then problems solved. Accuracy and streak are shown as context, not as extra points.</p>
        </section>
        <aside className="lb-aside">
          <section className="lb-your-place" ref={ownCard} aria-labelledby="lb-your-title"><p>YOUR PLACE</p><h2 id="lb-your-title">{currentUserId ? (myRank ? `#${myRank}` : 'A place to begin') : 'Join the page'}</h2><span>{currentUserId ? (myRank ? 'Your global standing' : 'Your first saved answer starts your rank.') : 'Sign in to save a place on the board.'}</span><div className="lb-your-numbers"><div><strong>{currentUserId ? myPoints.toLocaleString() : '—'}</strong><small>points</small></div><div><strong>{currentUserId ? mySolved : '—'}</strong><small>solved</small></div></div>{me && <p className="lb-your-streak"><Flame size={16} /> {me.current_streak} {me.current_streak === 1 ? 'day' : 'days'} in a row{me.accuracy_pct == null ? '' : ` · ${me.accuracy_pct}% accuracy`}</p>}<button onClick={onPractice}>{currentUserId ? 'Back to practice' : 'Sign in or create account'} <ArrowRight size={17} /></button></section>
          <div className="lb-explainer"><span>HOW THE ORDER WORKS</span><p>Only saved practice contributes. The board starts empty, updates from real submissions, and never counts a placement test as points.</p><button onClick={findMe} disabled={!currentUserId || !myRank}>Find my place <ArrowUpRight size={15} /></button></div>
        </aside>
      </div>
    </>}
  </div>;
}
