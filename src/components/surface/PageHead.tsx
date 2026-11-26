/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

interface PageHeadProps {
  /** The page's one heading. Wrap the phrase that matters in `<em>`: it stays roman and gets a pencil underline. */
  title: ReactNode;
  /** One or two sentences on what the page is for. */
  lede?: ReactNode;
  /** Sits to the right of the heading: a tally, or the page's main action. */
  aside?: ReactNode;
}

/**
 * How a workspace page opens. One component, so that every page says what it
 * is in the same place, in the same voice (styles/page.css). There is no label
 * above the title: the top bar's breadcrumb already says which page this is.
 */
export default function PageHead({ title, lede, aside }: PageHeadProps) {
  return (
    <header className="pg-head">
      <div>
        <h1 className="pg-title">{title}</h1>
        {lede && <p className="pg-lede">{lede}</p>}
      </div>
      {aside && <div className="pg-aside">{aside}</div>}
    </header>
  );
}

/** A small ring and a figure: how much of something is done. */
export function Tally({ done, total, label }: { done: number; total: number; label: string }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const circumference = 2 * Math.PI * 13;
  return (
    <div className="pg-tally">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <circle className="pg-tally-track" cx="17" cy="17" r="13" strokeWidth="4" />
        <circle className="pg-tally-fill" cx="17" cy="17" r="13" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 17 17)"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - share)} />
      </svg>
      <p><strong>{done.toLocaleString()} of {total.toLocaleString()}</strong>{label}</p>
    </div>
  );
}
