/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The feed's side column: problem threads, the techniques in play, the people
 * whose posts are helping, and a key to how writing here works. Each piece is
 * also shown in the Browse sheet on narrower screens, so each takes a prefix
 * for its ids.
 */

import React, { useMemo, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import type { AuthorSummary, Reaction } from '../../services/database.types';
import { REACTIONS } from '../../services/data/feed';
import { MarkGlyph } from './Marks';
import { REACTION_META, authorName, disambiguateTitles, plural, type Helper } from './model';
import { Avatar } from './ui';

const THREADS_SHOWN = 8;

/**
 * The problems people are writing about, busiest first, and a search over the
 * whole bank for the rest. A problem nobody has posted on is not a thread, so
 * it is found by name rather than listed.
 */
export function ProblemFilter({
  problems,
  counts,
  selected,
  onSelect,
  autoFocus = false,
}: {
  problems: Problem[];
  counts: Map<string, number>;
  selected: string;
  onSelect: (problemId: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const titles = useMemo(() => disambiguateTitles(problems), [problems]);
  const needle = query.trim().toLocaleLowerCase();
  const matching = useMemo(() => {
    const byActivity = (a: Problem, b: Problem) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.title.localeCompare(b.title);
    if (needle) return problems.filter((problem) => problem.title.toLocaleLowerCase().includes(needle)).sort(byActivity).slice(0, 40);
    const active = problems.filter((problem) => (counts.get(problem.id) ?? 0) > 0).sort(byActivity).slice(0, THREADS_SHOWN);
    // The thread being read stays listed, even when it has no posts yet.
    const chosen = selected !== 'All' && !active.some((problem) => problem.id === selected) ? problems.find((problem) => problem.id === selected) : undefined;
    return chosen ? [chosen, ...active] : active;
  }, [problems, counts, needle, selected]);

  return (
    <div className="cm-problem-filter">
      <label className="cm-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Find a problem</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search problems"
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
        />
      </label>
      {matching.length > 0 && (
        <ul className="cm-problem-list">
          {matching.map((problem) => (
            <li key={problem.id}>
              <button type="button" className="cm-problem-row" aria-pressed={selected === problem.id} onClick={() => onSelect(selected === problem.id ? 'All' : problem.id)}>
                <span className="cm-problem-name">{titles.get(problem.id) ?? problem.title}</span>
                {(counts.get(problem.id) ?? 0) > 0 && <span className="cm-problem-count">{counts.get(problem.id)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {needle ? (
        matching.length === 0 && <p className="cm-muted cm-problem-empty">No problem matches “{query.trim()}”.</p>
      ) : (
        <p className="cm-muted cm-problem-empty">
          {matching.length === 0 ? 'No problem has a thread yet. ' : ''}Search to open a thread on any of the {problems.length} problems.
        </p>
      )}
    </div>
  );
}

/** The technique tags on the posts in view, most used first. Choosing one narrows the feed to it. */
export function Techniques({
  tags,
  selected,
  onSelect,
  idPrefix = 'cm-side',
}: {
  tags: Array<{ tag: string; count: number }>;
  selected: string | null;
  onSelect: (tag: string | null) => void;
  /** The list is on the page twice (side column and Browse sheet); each needs ids of its own. */
  idPrefix?: string;
}) {
  // A chosen tag stays listed even when the narrowed feed no longer counts the others.
  const shown = selected && !tags.some((entry) => entry.tag === selected) ? [{ tag: selected, count: 0 }, ...tags] : tags;
  return (
    <section className="cm-side-card" aria-labelledby={`${idPrefix}-techniques`}>
      <h3 id={`${idPrefix}-techniques`}>Techniques in play</h3>
      {shown.length === 0 ? (
        <p className="cm-muted">
          Add a tag such as <code>#invariant</code> to a post and it is collected here.
        </p>
      ) : (
        <ul className="cm-tag-cloud">
          {shown.map(({ tag, count }) => (
            <li key={tag}>
              <button type="button" className="cm-tag is-chip" aria-pressed={selected === tag} onClick={() => onSelect(selected === tag ? null : tag)}>
                #{tag}
                {count > 0 && <small>{count}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The people whose posts in view readers found helpful, each a press away from being followed. */
export function Helpers({
  people,
  viewerId,
  following,
  onToggleFollow,
  onOpen,
  idPrefix = 'cm-side',
}: {
  people: Array<Helper<AuthorSummary>>;
  viewerId: string | null;
  following: ReadonlySet<string>;
  onToggleFollow: (id: string) => void;
  onOpen: (author: AuthorSummary) => void;
  idPrefix?: string;
}) {
  return (
    <section className="cm-side-card" aria-labelledby={`${idPrefix}-helpers`}>
      <h3 id={`${idPrefix}-helpers`}>Helping lately</h3>
      {people.length === 0 ? (
        <p className="cm-muted">Whoever writes the posts readers mark as helpful is listed here.</p>
      ) : (
        <ol className="cm-helpers">
          {people.map(({ id, author, posts, marks }) => {
            const followed = following.has(id);
            return (
              <li key={id}>
                <button type="button" className="cm-helper" onClick={() => author && onOpen(author)} disabled={!author}>
                  <Avatar author={author} size={36} />
                  <span className="cm-helper-name">
                    <strong>{authorName(author)}</strong>
                    <small>
                      {plural(marks, 'mark')} on {plural(posts, 'post')}
                    </small>
                  </span>
                </button>
                {viewerId && viewerId !== id && (
                  <button
                    type="button"
                    className={`cm-follow ${followed ? 'is-on' : ''}`}
                    aria-pressed={followed}
                    aria-label={followed ? `Following ${authorName(author)}. Unfollow` : `Follow ${authorName(author)}`}
                    onClick={() => onToggleFollow(id)}
                  >
                    {followed ? <Check size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
                    <span>{followed ? 'Following' : 'Follow'}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const SYNTAX: Array<{ what: string; how: string }> = [
  { what: 'Inline math', how: '$x^2 + y^2$' },
  { what: 'Display math', how: '$$\\frac{a}{b}$$' },
  { what: 'Sealed hint', how: '[hint] … [/hint]' },
  { what: 'Hidden words', how: '||the answer||' },
  { what: 'Technique', how: '#pigeonhole' },
  { what: 'Note on a line', how: '> the line' },
  { what: 'Emphasis', how: '**bold**  *italic*' },
];

/** What the seven marks mean, and how to write math, hints and tags. */
export function MarginKey({ compact = false, idPrefix = 'cm-side' }: { compact?: boolean; idPrefix?: string }) {
  return (
    <section className={compact ? 'cm-key' : 'cm-side-card cm-key'} aria-labelledby={`${idPrefix}-key`}>
      <h3 id={`${idPrefix}-key`}>Marks in the margin</h3>
      <p className="cm-muted cm-key-lede">Readers mark a post the way they would pencil a proof. Select any line of a post to leave a note on it.</p>
      <ul className="cm-key-marks">
        {REACTIONS.map((reaction: Reaction) => (
          <li key={reaction} className={`cm-tone-${reaction}`}>
            <MarkGlyph reaction={reaction} size={17} />
            <span>
              <strong>{REACTION_META[reaction].label}</strong>
              <small>{REACTION_META[reaction].hint}</small>
            </span>
          </li>
        ))}
      </ul>
      <h4>Writing a post</h4>
      <dl className="cm-tips">
        {SYNTAX.map(({ what, how }) => (
          <div key={what}>
            <dt>{what}</dt>
            <dd>
              <code>{how}</code>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
