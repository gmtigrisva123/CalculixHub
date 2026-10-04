/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The text of a post, clamped with "See more", and the card a share shows for
 * the post it shares.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { SharedPost } from '../../services/database.types';
import MathText from '../MathText';
import { authorName, fullTimestamp, postAge } from './model';
import { Avatar, useNow } from './ui';

/**
 * Long text is clamped to a few lines with a "See more" toggle. The clamp is
 * measured after layout rather than guessed from a character count, because a
 * line of KaTeX can be taller than five lines of prose.
 */
export function ExpandableBody({
  text,
  lines = 6,
  large = false,
  className = '',
}: {
  text: string;
  lines?: number;
  large?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [cut, setCut] = useState<number | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = body.current;
    if (!element || expanded) return;

    // Cut at `lines` lines of text, but never through the middle of a display
    // formula: a clamp there leaves stray fragments of it showing under the
    // fade. A formula that starts near the top is shown whole instead.
    const measure = () => {
      const top = element.getBoundingClientRect().top;
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 22;
      let limit = lines * lineHeight;
      for (const block of element.querySelectorAll<HTMLElement>('.katex-display, .block')) {
        const rect = block.getBoundingClientRect();
        const start = rect.top - top;
        const end = start + rect.height;
        if (start < limit && end > limit) {
          limit = start < lineHeight * 2 ? end : start;
          break;
        }
      }
      setCut(Math.ceil(limit));
      setOverflowing(element.scrollHeight > limit + 2);
    };

    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [text, expanded, lines]);

  if (!text.trim()) return null;

  return (
    <div className={className}>
      <div
        ref={body}
        className={`cm-body ${large ? 'is-large' : ''} ${expanded ? '' : 'is-clamped'} ${overflowing && !expanded ? 'is-overflowing' : ''}`}
        style={expanded ? undefined : ({ '--cm-lines': lines, maxHeight: cut ?? undefined } as React.CSSProperties)}
      >
        <MathText text={text} />
      </div>
      {overflowing && !expanded && (
        <button type="button" className="cm-see-more" onClick={() => setExpanded(true)}>
          See more
        </button>
      )}
    </div>
  );
}

/** Short, single-paragraph posts without math are set larger, as a status line. */
export function isLargeText(text: string): boolean {
  return text.length > 0 && text.length <= 85 && !/\n|\$|\\\(|\\\[/.test(text);
}

export function SharedEmbed({
  original,
  problemTitle,
  onOpen,
}: {
  /** Null when the original is gone or hidden from this viewer. */
  original: SharedPost | null | undefined;
  problemTitle?: string | null;
  onOpen?: (id: string) => void;
}) {
  const now = useNow();

  if (!original) {
    return (
      <div className="cm-shared is-unavailable">
        <EyeOff size={20} aria-hidden="true" />
        <div>
          <strong>This content isn&rsquo;t available right now</strong>
          <p>The original post was deleted, or it was shared somewhere you can&rsquo;t see.</p>
        </div>
      </div>
    );
  }

  const head = (
    <>
      <Avatar author={original.author} size={32} />
      <span className="cm-shared-meta">
        <strong>{authorName(original.author)}</strong>
        <span>
          <time dateTime={original.created_at} title={fullTimestamp(original.created_at)}>
            {postAge(original.created_at, now)}
          </time>
          {problemTitle && <> · {problemTitle}</>}
        </span>
      </span>
    </>
  );

  // The header is the keyboard path to the original; a click anywhere else on
  // the card goes there too, except on the card's own "See more".
  return (
    <div
      className={`cm-shared ${onOpen ? 'is-interactive' : ''}`}
      onClick={(event) => {
        // Selecting text to copy it is not a request to navigate.
        if (!onOpen || (event.target as HTMLElement).closest('button') || window.getSelection()?.toString()) return;
        onOpen(original.id);
      }}
    >
      {onOpen ? (
        <button type="button" className="cm-shared-head" onClick={() => onOpen(original.id)} aria-label={`Open the original post by ${authorName(original.author)}`}>
          {head}
        </button>
      ) : (
        <div className="cm-shared-head">{head}</div>
      )}
      <ExpandableBody text={original.body} lines={5} className="cm-shared-body" />
    </div>
  );
}
