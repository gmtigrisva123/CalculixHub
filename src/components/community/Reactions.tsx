/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Margin marks: the tallies beside a post or under a comment, the strip of all
 * seven, and the list of who left which.
 *
 * A tally is a button. Pressing one that is there leaves the same mark, or
 * takes yours back; "Mark" opens the strip, where each of the seven is shown
 * with its name and, as you move across them, what leaving it says. Nothing
 * opens on hover and nothing needs a long press, so the feature is the same
 * with a mouse, a finger and a keyboard.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import type { Reaction, ReactionCounts } from '../../services/database.types';
import { REACTIONS, fetchReactors, type FeedSchema, type Reactor } from '../../services/data/feed';
import { duration, ease } from '../../lib/motion';
import { MarkGlyph } from './Marks';
import { REACTION_META, authorName, compactCount, plural, topReactions, totalReactions } from './model';
import { Avatar, Dialog } from './ui';

const PICK_HINT = 'Pick a mark. Pick yours again to take it back.';

/**
 * The marks something has drawn, and the way to leave one.
 *
 * `variant="post"` stands in the post's margin; `variant="comment"` sits in
 * the line under a comment. `onReact` is called whether or not the reader is
 * signed in: the caller decides what a signed-out press does. With `max`, only
 * the most used marks are listed (the reader's own always among them) and the
 * rest are a count that opens the full list through `onShowAll`.
 */
export function MarkControl({
  counts,
  current,
  onReact,
  variant = 'post',
  max,
  onShowAll,
}: {
  counts: ReactionCounts | undefined;
  current: Reaction | null;
  onReact: (next: Reaction | null) => void;
  variant?: 'post' | 'comment';
  max?: number;
  onShowAll?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hinted, setHinted] = useState<Reaction | null>(null);
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const drawn = topReactions(counts, REACTIONS.length);
  const fits = !max || !onShowAll || drawn.length <= max;
  const shown = fits ? drawn : current && drawn.indexOf(current) >= max ? [...drawn.slice(0, max - 1), current] : drawn.slice(0, max);
  const unlisted = fits ? 0 : drawn.filter((reaction) => !shown.includes(reaction)).reduce((sum, reaction) => sum + (counts?.[reaction] ?? 0), 0);

  // Keep the strip on screen: under a reply deep in a thread, or at a phone's edge.
  useLayoutEffect(() => {
    if (!open || !strip.current) {
      setShift(0);
      return;
    }
    // Measured from the layout box, not getBoundingClientRect(): the strip is
    // mid-way through its entrance when this runs.
    const anchor = strip.current.offsetParent?.getBoundingClientRect().left ?? 0;
    const left = anchor + strip.current.offsetLeft;
    const right = left + strip.current.offsetWidth;
    const margin = 8;
    if (right > window.innerWidth - margin) setShift(window.innerWidth - margin - right);
    else if (left < margin) setShift(margin - left);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHinted(null);
    const frame = requestAnimationFrame(() => {
      const options = strip.current?.querySelectorAll<HTMLElement>('button');
      (strip.current?.querySelector<HTMLElement>('button[aria-pressed="true"]') ?? options?.[0])?.focus();
    });
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) opener.current?.focus();
  };

  const pick = (reaction: Reaction) => {
    close(true);
    onReact(reaction === current ? null : reaction);
  };

  return (
    <div className={`cm-marks is-${variant}`} role="group" aria-label="Marks">
      {shown.map((reaction) => {
        const mine = reaction === current;
        const count = counts?.[reaction] ?? 0;
        return (
          <button
            key={reaction}
            type="button"
            className={`cm-tally cm-tone-${reaction}`}
            aria-pressed={mine}
            aria-label={`${REACTION_META[reaction].label}: ${plural(count, 'reader')}. ${mine ? 'Yours. Press to take it back' : 'Press to leave the same mark'}`}
            title={`${REACTION_META[reaction].label}: ${REACTION_META[reaction].hint}`}
            onClick={() => onReact(mine ? null : reaction)}
          >
            <MarkGlyph reaction={reaction} size={variant === 'post' ? 16 : 14} />
            <span>{compactCount(count)}</span>
          </button>
        );
      })}

      {unlisted > 0 && (
        <button type="button" className="cm-tally-more" onClick={onShowAll} aria-label={`${plural(unlisted, 'more mark')}. See who left which`} title="See every mark">
          +{compactCount(unlisted)}
        </button>
      )}

      <div className="cm-mark-add" ref={wrap}>
        <button
          ref={opener}
          type="button"
          className={variant === 'post' ? 'cm-mark-open' : 'cm-link-button'}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={current ? `Your mark: ${REACTION_META[current].label}. Change it` : 'Leave a mark'}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {variant === 'post' && <MarkGlyph reaction={current ?? 'like'} size={17} className={current ? `cm-tone-${current}` : 'is-idle'} />}
          <span>Mark</span>
        </button>

        <AnimatePresence>
          {open && (
            <m.div
              ref={strip}
              role="toolbar"
              aria-label="The seven marks"
              className="cm-picker"
              style={{ marginLeft: shift }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: duration.fast, ease: ease.standard } }}
              exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
              onKeyDown={(event) => {
                const options = [...(strip.current?.querySelectorAll<HTMLElement>('button') ?? [])];
                const index = options.indexOf(document.activeElement as HTMLElement);
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const step = event.key === 'ArrowRight' ? 1 : -1;
                  options[(index + step + options.length) % options.length]?.focus();
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
                } else if (event.key === 'Escape') {
                  event.stopPropagation();
                  close(true);
                } else if (event.key === 'Tab') {
                  setOpen(false);
                }
              }}
            >
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  className={`cm-picker-option cm-tone-${reaction} ${reaction === current ? 'is-current' : ''}`}
                  aria-label={`${REACTION_META[reaction].label}: ${REACTION_META[reaction].hint}`}
                  aria-pressed={reaction === current}
                  onClick={() => pick(reaction)}
                  onPointerEnter={() => setHinted(reaction)}
                  onFocus={() => setHinted(reaction)}
                >
                  <MarkGlyph reaction={reaction} size={22} />
                  <span className="cm-picker-label">{REACTION_META[reaction].label}</span>
                </button>
              ))}
              <p className="cm-picker-hint" aria-hidden="true">
                {hinted ? REACTION_META[hinted].hint : PICK_HINT}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Everyone who left a mark, listed under the mark they left. */
export function ReactorsDialog({
  target,
  id,
  counts,
  schema,
  onClose,
}: {
  target: 'post' | 'comment';
  id: string;
  counts: ReactionCounts | undefined;
  schema: FeedSchema | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; rows: Reactor[] }>({ loading: true, error: null, rows: [] });

  useEffect(() => {
    let alive = true;
    fetchReactors({ target, id, schema })
      .then((rows) => alive && setState({ loading: false, error: null, rows }))
      .catch((error: unknown) => alive && setState({ loading: false, error: error instanceof Error ? error.message : 'Could not load the marks.', rows: [] }));
    return () => {
      alive = false;
    };
  }, [target, id, schema]);

  // Grouped from the rows themselves once they are in, so the list cannot disagree with its headings.
  const groups = useMemo(() => {
    const tallied: ReactionCounts = {};
    for (const row of state.rows) tallied[row.reaction] = (tallied[row.reaction] ?? 0) + 1;
    const source = state.rows.length > 0 ? tallied : counts;
    return topReactions(source, REACTIONS.length).map((reaction) => ({
      reaction,
      total: source?.[reaction] ?? 0,
      people: state.rows.filter((row) => row.reaction === reaction),
    }));
  }, [state.rows, counts]);

  return (
    <Dialog title={`Marks on this ${target}`} onClose={onClose} size="sm">
      <div className="cm-dialog-body cm-reactor-list">
        {state.loading && <p className="cm-muted" role="status">Loading marks…</p>}
        {state.error && <p role="alert" className="cm-error-text">{state.error}</p>}
        {!state.loading && !state.error && totalReactions(counts) === 0 && state.rows.length === 0 && <p className="cm-muted">No marks yet.</p>}
        {!state.loading &&
          !state.error &&
          groups.map(({ reaction, total, people }) => (
            <section key={reaction} className="cm-reactor-group" aria-label={`${REACTION_META[reaction].label}, ${total}`}>
              <h3 className={`cm-tone-${reaction}`}>
                <MarkGlyph reaction={reaction} size={17} />
                <span>{REACTION_META[reaction].label}</span>
                <small>{compactCount(total)}</small>
              </h3>
              <ul>
                {people.map((row, index) => (
                  <li key={row.user?.id ?? index} className="cm-reactor">
                    <Avatar author={row.user} size={28} />
                    <span className="cm-reactor-name">{authorName(row.user)}</span>
                    <span className="cm-muted cm-reactor-handle">{row.user?.username ? `@${row.user.username}` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </Dialog>
  );
}
