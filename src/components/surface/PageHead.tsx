/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties, ReactNode } from 'react';

interface PageHeadProps {
  /** What kind of page this is. Kept for the record; the top bar names the page, so it is not shown. */
  eyebrow?: string;
  /** The page's one heading. Wrap the phrase that matters in `<em>`: it is set bold and upright. */
  title: ReactNode;
  /** One or two sentences on what the page is for. */
  lede?: ReactNode;
  /** Sits to the right of the heading: a tally, or the page's main action. */
  aside?: ReactNode;
}

/**
 * How a workspace page opens. One component, so that every page says what it
 * is in the same place, in the same voice (styles/page.css).
 */
export default function PageHead({ eyebrow, title, lede, aside }: PageHeadProps) {
  return (
    <header className="pg-head">
      <div>
        {eyebrow && <p className="pg-eyebrow">{eyebrow}</p>}
        <h1 className="pg-title">{title}</h1>
        {lede && <p className="pg-lede">{lede}</p>}
      </div>
      {aside && <div className="pg-aside">{aside}</div>}
    </header>
  );
}

/** A figure and a line: how much of something is done. */
export function Tally({ done, total, label }: { done: number; total: number; label: string }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="pg-tally">
      <p><strong>{done.toLocaleString()} of {total.toLocaleString()}</strong>{label}</p>
      <span className="ui-meter" style={{ '--value': Math.round(share * 100) } as CSSProperties} aria-hidden="true" />
    </div>
  );
}
