/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The feed's side column: problem threads, the most active contributors, and
 * a reminder of how to write math.
 */

import React, { useMemo, useState } from 'react';
import { Award, Hash, Layers, Search, Sigma } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import type { AuthorSummary } from '../../services/database.types';
import { authorName, disambiguateTitles, plural } from './model';
import { Avatar } from './ui';

/**
 * Every problem, searchable, with the busiest threads first. Used as the side
 * card on wide screens and inside a dialog on phones.
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
  const matching = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return problems
      .filter((problem) => !needle || problem.title.toLocaleLowerCase().includes(needle))
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.title.localeCompare(b.title));
  }, [problems, counts, query]);

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
      <ul className="cm-problem-list">
        {!query && (
          <li>
            <button type="button" className="cm-problem-row" aria-pressed={selected === 'All'} onClick={() => onSelect('All')}>
              <span className="cm-problem-icon">
                <Layers size={16} aria-hidden="true" />
              </span>
              <span className="cm-problem-name">All threads</span>
            </button>
          </li>
        )}
        {matching.map((problem) => (
          <li key={problem.id}>
            <button type="button" className="cm-problem-row" aria-pressed={selected === problem.id} onClick={() => onSelect(problem.id)}>
              <span className="cm-problem-icon">
                <Hash size={16} aria-hidden="true" />
              </span>
              <span className="cm-problem-name">{titles.get(problem.id) ?? problem.title}</span>
              {(counts.get(problem.id) ?? 0) > 0 && <span className="cm-problem-count">{counts.get(problem.id)}</span>}
            </button>
          </li>
        ))}
      </ul>
      {query && matching.length === 0 && <p className="cm-muted cm-problem-empty">No problem matches “{query}”.</p>}
    </div>
  );
}

export function TopContributors({ people }: { people: Array<{ author: AuthorSummary | null; id: string; count: number }> }) {
  return (
    <section className="cm-card cm-side-card" aria-labelledby="cm-contributors">
      <h3 id="cm-contributors">
        <Award size={18} aria-hidden="true" /> Top contributors
      </h3>
      {people.length === 0 ? (
        <p className="cm-muted">Contributors appear here once people start posting.</p>
      ) : (
        <ol className="cm-contributors">
          {people.map(({ id, author, count }, index) => (
            <li key={id}>
              <span className={`cm-rank is-${index + 1}`}>{index + 1}</span>
              <Avatar author={author} size={36} />
              <span className="cm-contributor-name">
                <strong>{authorName(author)}</strong>
                <small>{plural(count, 'post')}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function FormattingTips() {
  return (
    <section className="cm-card cm-side-card" aria-labelledby="cm-tips">
      <h3 id="cm-tips">
        <Sigma size={18} aria-hidden="true" /> Writing math
      </h3>
      <dl className="cm-tips">
        <div>
          <dt>Inline</dt>
          <dd>
            <code>$x^2 + y^2$</code>
          </dd>
        </div>
        <div>
          <dt>Display</dt>
          <dd>
            <code>{'$$\\frac{a}{b}$$'}</code>
          </dd>
        </div>
        <div>
          <dt>Emphasis</dt>
          <dd>
            <code>**bold**</code> <code>*italic*</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
