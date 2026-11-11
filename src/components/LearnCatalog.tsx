/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The practice bank: find a question, then open it.
 *
 * One toolbar holds every way of narrowing the list (words, status, topic,
 * level, contest), and says how many questions are left. The list itself is
 * shown a page at a time. The whole bank used to be laid out at once, well over
 * a hundred cards each typesetting its own mathematics, which made the page
 * twelve thousand pixels tall and slow to open; the question a learner wants is
 * almost always in the first screenful once they have filtered.
 */

import { useLayoutEffect, useMemo, type CSSProperties, type RefObject } from 'react';
import { m } from 'motion/react';
import { ArrowRight, Check, Eye, Lock, Search, SearchX, X } from 'lucide-react';
import type { CompetitionLevel, Level, Problem, Topic } from '../../shared/types';
import { COMPETITION_LIST, LEVEL_LIST, TOPIC_LIST, TOPIC_META } from '../lib/topics';
import MathText from './MathText';
import { PageHead, Tally } from './surface';
import '../styles/learn.css';

export type CatalogStatus = 'all' | 'todo' | 'solved';

export interface CatalogView {
  topic: Topic | 'All';
  level: Level | 'All';
  competition: CompetitionLevel | 'All';
  status: CatalogStatus;
  query: string;
  /** How many cards are on screen. */
  shown: number;
}

export const CATALOG_PAGE = 24;
export const INITIAL_VIEW: CatalogView = { topic: 'All', level: 'All', competition: 'All', status: 'all', query: '', shown: CATALOG_PAGE };

type Attempt = { count: number; finished: boolean; forfeited: boolean };

interface LearnCatalogProps {
  problems: Problem[];
  completed: readonly string[];
  attempts: Record<string, Attempt>;
  maxAttempts: number;
  view: CatalogView;
  onView: (next: CatalogView) => void;
  onOpen: (problem: Problem) => void;
  /** The scroll position to return to when the list comes back from an open question. */
  restoreScroll?: RefObject<number>;
}

const STATUSES: readonly { value: CatalogStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'solved', label: 'Solved' },
];

const glide = { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 } as const;

/** Dollar signs and TeX commands out, so "x + 1/x" can be found by typing it. */
const plain = (text: string) => text.replace(/\\[a-zA-Z]+|[$\\{}]/g, ' ').toLowerCase();

export default function LearnCatalog({ problems, completed, attempts, maxAttempts, view, onView, onOpen, restoreScroll }: LearnCatalogProps) {
  useLayoutEffect(() => {
    const y = restoreScroll?.current ?? 0;
    if (y > 0) window.scrollTo({ top: y, behavior: 'instant' });
    // Only on arrival: the list must not jump while it is being filtered.
  }, []);

  const solved = useMemo(() => new Set(completed), [completed]);
  const searchable = useMemo(() => new Map(problems.map(problem => [problem.id, plain(`${problem.title} ${problem.question} ${problem.topic} ${problem.competition ?? ''} ${problem.level}`)])), [problems]);

  const set = (patch: Partial<CatalogView>) => onView({ ...view, shown: CATALOG_PAGE, ...patch });
  const needle = view.query.trim().toLowerCase();

  /** Everything except the topic filter, so each topic chip can say how many it would leave. */
  const beforeTopic = problems.filter(problem =>
    (view.level === 'All' || problem.level === view.level)
    && (view.competition === 'All' || problem.competition === view.competition)
    && (view.status === 'all' || (view.status === 'solved') === solved.has(problem.id))
    && (!needle || searchable.get(problem.id)!.includes(needle)));
  const matches = view.topic === 'All' ? beforeTopic : beforeTopic.filter(problem => problem.topic === view.topic);
  const page = matches.slice(0, view.shown);
  const filtered = view.topic !== 'All' || view.level !== 'All' || view.competition !== 'All' || view.status !== 'all' || needle !== '';
  const reset = () => onView(INITIAL_VIEW);

  return (
    <div className="lr">
      <PageHead
        eyebrow="Practice bank"
        title={<>Find a question <em>worth your time.</em></>}
        lede="Training questions from short answers to proof techniques, written in the style of each contest. They are not official papers; those are in the Exam Archive."
        aside={problems.length > 0 && <Tally done={completed.length} total={problems.length} label="solved so far" />}
      />

      <div className="pg-toolbar lr-toolbar" role="search" aria-label="Narrow the questions">
        <div className="pg-toolbar-row">
          <label className="pg-search">
            <span className="sr-only">Search questions</span>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={view.query} onChange={event => set({ query: event.target.value })} placeholder="Search by title or by what the question says" autoComplete="off" spellCheck={false} />
            {view.query && <button type="button" aria-label="Clear the search" onClick={() => set({ query: '' })}><X size={15} /></button>}
          </label>
          <div className="pg-segment" role="group" aria-label="Show">
            {STATUSES.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={view.status === value} onClick={() => set({ status: value })}>
                {view.status === value && <m.i layoutId="lr-status" transition={glide} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <hr className="pg-toolbar-rule" />

        <div className="pg-toolbar-row" role="group" aria-label="Topic">
          <span className="pg-toolbar-label" aria-hidden="true">Topic</span>
          <div className="pg-chips">
            <button type="button" className="pg-chip" aria-pressed={view.topic === 'All'} onClick={() => set({ topic: 'All' })}>All topics <small>{beforeTopic.length}</small></button>
            {TOPIC_LIST.map(topic => (
              <button key={topic} type="button" className="pg-chip" aria-pressed={view.topic === topic} style={{ '--hue': TOPIC_META[topic].vars['--cx-hue'] } as CSSProperties}
                onClick={() => set({ topic: view.topic === topic ? 'All' : topic })}>
                <i aria-hidden="true" />{TOPIC_META[topic].label} <small>{beforeTopic.filter(problem => problem.topic === topic).length}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="pg-toolbar-row" role="group" aria-label="Level">
          <span className="pg-toolbar-label" aria-hidden="true">Level</span>
          <div className="pg-chips">
            <button type="button" className="pg-chip" aria-pressed={view.level === 'All'} onClick={() => set({ level: 'All' })}>Any level</button>
            {LEVEL_LIST.map((level, index) => (
              <button key={level} type="button" className="pg-chip" aria-pressed={view.level === level} onClick={() => set({ level: view.level === level ? 'All' : level })}>
                <Meter filled={index + 1} />{level}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-toolbar-row" role="group" aria-label="Competition level">
          <span className="pg-toolbar-label" aria-hidden="true">Contest</span>
          <div className="pg-chips">
            <button type="button" className="pg-chip" aria-pressed={view.competition === 'All'} onClick={() => set({ competition: 'All' })}>Any contest</button>
            {COMPETITION_LIST.map(contest => (
              <button key={contest} type="button" className="pg-chip" aria-pressed={view.competition === contest} onClick={() => set({ competition: view.competition === contest ? 'All' : contest })}>{contest}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="lr-status" role="status">
        <p className="pg-count"><strong>{matches.length.toLocaleString()}</strong> {matches.length === 1 ? 'question' : 'questions'}{filtered ? ' match' : ' in the bank'}</p>
        {filtered && <button type="button" className="pg-link" onClick={reset}>Clear filters</button>}
      </div>

      {problems.length > 0 && matches.length === 0 && (
        <div className="pg-empty">
          <span className="pg-empty-mark"><SearchX size={22} strokeWidth={1.8} aria-hidden="true" /></span>
          <h2>Nothing matches that yet.</h2>
          <p>Loosen a filter or two. The bank is still growing, and some combinations of level and contest have no questions so far.</p>
          <button type="button" className="pg-btn" onClick={reset}>Show every question</button>
        </div>
      )}

      {problems.length === 0 && (
        <div className="lr-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="lr-card is-ghost" />)}
        </div>
      )}

      <div className="lr-grid">
        {page.map(problem => {
          const attempt = attempts[problem.id];
          const isSolved = solved.has(problem.id);
          const meta = TOPIC_META[problem.topic];
          const state = problem.proOnly ? 'locked' : isSolved ? 'solved' : attempt?.finished ? 'seen' : attempt?.count ? 'trying' : 'new';
          return (
            <button type="button" key={problem.id} className={`text-left lr-card is-${state}`} style={meta.vars} onClick={() => onOpen(problem)}>
              <span className="lr-card-top">
                <span className="lr-topic"><i aria-hidden="true" />{meta.label}</span>
                <span className="lr-meta">{problem.competition ?? problem.level}</span>
                {state === 'solved' && <span className="lr-state is-solved"><Check size={13} strokeWidth={2.6} aria-hidden="true" />Solved</span>}
                {state === 'seen' && <span className="lr-state"><Eye size={13} aria-hidden="true" />Solution seen</span>}
                {state === 'trying' && <span className="lr-state is-trying">{attempt!.count} of {problem.maxAttempts ?? maxAttempts} tries used</span>}
                {state === 'locked' && <span className="lr-state"><Lock size={12} aria-hidden="true" />Opens with Pro</span>}
              </span>
              <span className="lr-title">{problem.title}</span>
              <span className="lr-excerpt"><MathText text={problem.question} /></span>
              <span className="lr-card-foot">
                <span className="lr-level"><Meter filled={LEVEL_LIST.indexOf(problem.level) + 1} />{problem.level}</span>
                <span className="lr-points">{problem.points} pts</span>
                <span className="lr-go">{state === 'solved' || state === 'seen' ? 'Review' : state === 'trying' ? 'Continue' : 'Solve'}<ArrowRight size={14} aria-hidden="true" /></span>
              </span>
            </button>
          );
        })}
      </div>

      {matches.length > page.length && (
        <div className="lr-more">
          <p className="pg-count">Showing <strong>{page.length}</strong> of <strong>{matches.length}</strong></p>
          <button type="button" className="pg-btn" onClick={() => onView({ ...view, shown: view.shown + CATALOG_PAGE })}>Show {Math.min(CATALOG_PAGE, matches.length - page.length)} more</button>
        </div>
      )}
    </div>
  );
}

/** Four bars, the first `filled` of them inked: Foundation is one, Olympiad four. */
function Meter({ filled }: { filled: number }) {
  return <span className="lr-meter" aria-hidden="true">{[1, 2, 3, 4].map(step => <i key={step} data-on={step <= filled} />)}</span>;
}
