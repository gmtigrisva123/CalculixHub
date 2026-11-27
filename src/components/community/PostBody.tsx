/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The text of a post, clamped until the reader asks for the rest; the cover a
 * solution wears for someone who has not solved the problem; and the card a
 * repost shows for the post it carries.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { SharedPost } from '../../services/database.types';
import { MediaGrid } from './Media';
import RichText from './RichText';
import { KIND_META, authorName, fullTimestamp, parsePost, postAge } from './model';
import { Avatar, useNow } from './ui';

/**
 * Long text is clamped to a few lines until the reader asks for the rest. The clamp is
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
    // formula or a sealed hint: a clamp there leaves stray fragments of it
    // showing under the fade. One that starts near the top is shown whole.
    const measure = () => {
      const top = element.getBoundingClientRect().top;
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 22;
      let limit = lines * lineHeight;
      for (const block of element.querySelectorAll<HTMLElement>('.katex-display, .block, .cm-hint')) {
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
        <RichText text={text} />
      </div>
      {overflowing && !expanded && (
        <button type="button" className="cm-see-more" onClick={() => setExpanded(true)}>
          Read the rest
        </button>
      )}
    </div>
  );
}

/** Short, single-paragraph posts without math are set larger, as a status line. */
export function isLargeText(text: string): boolean {
  return text.length > 0 && text.length <= 85 && !/\n|\$|\\\(|\\\[/.test(text);
}

/**
 * Why a solution is covered: the reader is known not to have solved the
 * problem, or it is not known whether they have (their record is still
 * loading, could not be read, or they are signed out).
 */
export type ShieldReason = 'unsolved' | 'unknown';

/**
 * The cover over a solution. It fails closed: when it is not known whether the
 * reader has solved the problem, the write-up stays covered and says so in
 * neutral words, rather than being shown first and hidden a moment later.
 */
export function Shield({ reason, onSolve, onReveal }: { reason: ShieldReason; onSolve?: () => void; onReveal: () => void }) {
  return (
    <div className="cm-shield">
      <p>
        <strong>{reason === 'unsolved' ? 'You have not solved this one yet.' : 'This is a write-up of a problem.'}</strong> It gives the solution away, and so do its comments.
      </p>
      <div>
        {onSolve && (
          <button type="button" className="cm-button is-primary" onClick={onSolve}>
            Try the problem first
          </button>
        )}
        <button type="button" className="cm-button is-quiet" onClick={onReveal}>
          Show the solution
        </button>
      </div>
    </div>
  );
}

export function SharedEmbed({
  original,
  problemTitle,
  shield = null,
  onSolve,
  onOpen,
  onOpenMedia,
}: {
  /** Null when the original is gone or hidden from this viewer. */
  original: SharedPost | null | undefined;
  problemTitle?: string | null;
  /** Set when the original is a solution this reader should not meet uncovered. */
  shield?: ShieldReason | null;
  onSolve?: () => void;
  onOpen?: (id: string) => void;
  onOpenMedia?: (paths: string[], index: number) => void;
}) {
  const now = useNow();
  const [revealed, setRevealed] = useState(false);

  if (!original) {
    return (
      <div className="cm-shared is-unavailable">
        <EyeOff size={20} aria-hidden="true" />
        <div>
          <strong>This post is no longer available</strong>
          <p>It was deleted, or you cannot see where it was posted.</p>
        </div>
      </div>
    );
  }

  // A repost carries the original as it was written, kind and all.
  const { kind, text } = parsePost(original.body);
  const covered = Boolean(shield) && kind === 'solution' && !revealed;
  const filed = [kind ? KIND_META[kind].label : null, problemTitle].filter(Boolean).join(kind === 'solution' && problemTitle ? ' to ' : kind === 'stuck' && problemTitle ? ' on ' : ' · ');

  const head = (
    <>
      <Avatar author={original.author} size={32} />
      <span className="cm-shared-meta">
        <strong>{authorName(original.author)}</strong>
        <span>
          <time dateTime={original.created_at} title={fullTimestamp(original.created_at)}>
            {postAge(original.created_at, now)}
          </time>
          {filed && <> · {filed}</>}
        </span>
      </span>
    </>
  );

  // The header is the keyboard path to the original; a click anywhere else on
  // the card goes there too, except on a button inside it.
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
      {covered ? (
        <Shield reason={shield!} onSolve={onSolve} onReveal={() => setRevealed(true)} />
      ) : (
        <>
          <ExpandableBody text={text} lines={5} className="cm-shared-body" />
          {(original.images?.length ?? 0) > 0 && (
            <div className="cm-shared-media">
              <MediaGrid
                paths={original.images!}
                label={authorName(original.author)}
                compact
                onOpen={(index) => (onOpenMedia ? onOpenMedia(original.images!, index) : onOpen?.(original.id))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
