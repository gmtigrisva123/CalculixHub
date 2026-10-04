/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reactions: the icons, the picker that opens from a Like button, and the
 * dialog that lists who reacted.
 *
 * The picker opens on hover with a mouse, on a long press with a finger, and
 * with the arrow keys from a focused Like button. A plain click or tap always
 * stays the quick path: like, or take back whatever reaction you left.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Heart, ThumbsUp } from 'lucide-react';
import type { Reaction, ReactionCounts } from '../../services/database.types';
import { REACTIONS, fetchReactors, type FeedSchema, type Reactor } from '../../services/data/feed';
import { duration, ease, spring } from '../../lib/motion';
import { REACTION_META, authorName, compactCount, topReactions, totalReactions } from './model';
import { Avatar, Dialog } from './ui';

/** The round badge used in summaries: Like and Love as glyphs, the rest as emoji. */
export function ReactionIcon({ reaction, size = 18 }: { reaction: Reaction; size?: number }) {
  const style = { width: size, height: size } as React.CSSProperties;
  if (reaction === 'like') {
    return (
      <span className="cm-reaction-icon is-like" style={style} aria-hidden="true">
        <ThumbsUp size={Math.round(size * 0.56)} fill="currentColor" strokeWidth={1.5} />
      </span>
    );
  }
  if (reaction === 'love') {
    return (
      <span className="cm-reaction-icon is-love" style={style} aria-hidden="true">
        <Heart size={Math.round(size * 0.56)} fill="currentColor" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span className="cm-reaction-icon is-emoji" style={{ ...style, fontSize: Math.round(size * 0.86) }} aria-hidden="true">
      {REACTION_META[reaction].emoji}
    </span>
  );
}

export function ReactionStack({ counts, size = 18 }: { counts: ReactionCounts | undefined; size?: number }) {
  const top = topReactions(counts);
  if (top.length === 0) return null;
  return (
    <span className="cm-reaction-stack">
      {top.map((reaction) => (
        <ReactionIcon key={reaction} reaction={reaction} size={size} />
      ))}
    </span>
  );
}

const OPEN_DELAY = 450;
const CLOSE_DELAY = 300;
const LONG_PRESS = 420;

/**
 * A Like control with the reaction picker attached.
 *
 * `variant="post"` is the full-width action-bar button; `variant="comment"` is
 * the small text link under a comment.
 */
export function ReactButton({
  current,
  onReact,
  disabled = false,
  variant = 'post',
}: {
  current: Reaction | null;
  onReact: (next: Reaction | null) => void;
  disabled?: boolean;
  variant?: 'post' | 'comment';
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const picker = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const [shift, setShift] = useState(0);

  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);

  // Keep the picker on screen: a Like link deep in a reply thread sits far
  // enough right that a 300px picker would run off a phone's edge.
  useLayoutEffect(() => {
    if (!open || !picker.current) {
      setShift(0);
      return;
    }
    // Measured from the layout box, not getBoundingClientRect(): the picker is
    // mid-way through its entrance scale when this runs.
    const anchor = picker.current.offsetParent?.getBoundingClientRect().left ?? 0;
    const left = anchor + picker.current.offsetLeft;
    const right = left + picker.current.offsetWidth;
    const margin = 8;
    if (right > window.innerWidth - margin) setShift(window.innerWidth - margin - right);
    else if (left < margin) setShift(margin - left);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!picker.current?.parentElement?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const pick = (reaction: Reaction) => {
    clear();
    setOpen(false);
    onReact(reaction === current ? null : reaction);
  };

  const label = current ? REACTION_META[current].label : 'Like';

  return (
    <div
      className={`cm-react ${variant === 'comment' ? 'is-comment' : 'is-post'}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse' || disabled) return;
        clear();
        timer.current = window.setTimeout(() => setOpen(true), open ? 0 : OPEN_DELAY);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        clear();
        timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
      }}
    >
      <button
        ref={button}
        type="button"
        disabled={disabled}
        className={variant === 'comment' ? `cm-link-button cm-tone-${current ?? 'none'}` : `cm-action cm-tone-${current ?? 'none'}`}
        aria-pressed={Boolean(current)}
        aria-label={current ? `${label} — remove reaction` : 'Like'}
        aria-haspopup="true"
        aria-expanded={open}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' || disabled) return;
          suppressClick.current = false;
          clear();
          timer.current = window.setTimeout(() => {
            suppressClick.current = true;
            setOpen(true);
            navigator.vibrate?.(8);
          }, LONG_PRESS);
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== 'mouse') clear();
        }}
        onPointerCancel={clear}
        onContextMenu={(event) => {
          if (suppressClick.current || open) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => picker.current?.querySelector<HTMLElement>('button')?.focus());
          }
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          clear();
          setOpen(false);
          onReact(current ? null : 'like');
        }}
      >
        {variant === 'post' &&
          (current && current !== 'like' ? (
            <span className="cm-action-emoji" aria-hidden="true">
              {REACTION_META[current].emoji}
            </span>
          ) : (
            <ThumbsUp size={19} aria-hidden="true" fill={current === 'like' ? 'currentColor' : 'none'} />
          ))}
        <span>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            ref={picker}
            role="toolbar"
            aria-label="Reactions"
            className="cm-picker"
            style={{ marginLeft: shift }}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: 4, scale: 0.96, transition: { duration: duration.fast, ease: ease.exit } }}
            onKeyDown={(event) => {
              const buttons = [...(picker.current?.querySelectorAll<HTMLElement>('button') ?? [])];
              const index = buttons.indexOf(document.activeElement as HTMLElement);
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const step = event.key === 'ArrowRight' ? 1 : -1;
                buttons[(index + step + buttons.length) % buttons.length]?.focus();
              } else if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
                button.current?.focus();
              }
            }}
          >
            {REACTIONS.map((reaction, index) => (
              <m.button
                key={reaction}
                type="button"
                className={`cm-picker-option ${reaction === current ? 'is-current' : ''}`}
                aria-label={REACTION_META[reaction].label}
                aria-pressed={reaction === current}
                onClick={() => pick(reaction)}
                initial={{ opacity: 0, y: 10, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.press, delay: index * 0.025 } }}
                whileHover={{ scale: 1.32, y: -6 }}
                whileFocus={{ scale: 1.32, y: -6 }}
                whileTap={{ scale: 1.1 }}
              >
                <span aria-hidden="true">{REACTION_META[reaction].emoji}</span>
                <span className="cm-picker-label" aria-hidden="true">
                  {REACTION_META[reaction].label}
                </span>
              </m.button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Everyone who reacted, with a tab per reaction. */
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
  const [tab, setTab] = useState<Reaction | 'all'>('all');
  const [state, setState] = useState<{ loading: boolean; error: string | null; rows: Reactor[] }>({ loading: true, error: null, rows: [] });

  useEffect(() => {
    let alive = true;
    fetchReactors({ target, id, schema })
      .then((rows) => alive && setState({ loading: false, error: null, rows }))
      .catch((error: unknown) => alive && setState({ loading: false, error: error instanceof Error ? error.message : 'Could not load reactions.', rows: [] }));
    return () => {
      alive = false;
    };
  }, [target, id, schema]);

  const tabs = useMemo(() => topReactions(counts, REACTIONS.length), [counts]);
  const visible = tab === 'all' ? state.rows : state.rows.filter((row) => row.reaction === tab);

  return (
    <Dialog title="Reactions" onClose={onClose} size="sm">
      <div className="cm-tabs" role="tablist" aria-label="Filter reactions">
        <button type="button" role="tab" aria-selected={tab === 'all'} className="cm-tab" onClick={() => setTab('all')}>
          All {compactCount(totalReactions(counts))}
        </button>
        {tabs.map((reaction) => (
          <button
            key={reaction}
            type="button"
            role="tab"
            aria-selected={tab === reaction}
            aria-label={`${REACTION_META[reaction].label}: ${counts?.[reaction] ?? 0}`}
            className="cm-tab"
            onClick={() => setTab(reaction)}
          >
            <ReactionIcon reaction={reaction} size={18} /> {compactCount(counts?.[reaction] ?? 0)}
          </button>
        ))}
      </div>
      <div className="cm-dialog-body cm-reactor-list" role="tabpanel">
        {state.loading && <p className="cm-muted" role="status">Loading reactions…</p>}
        {state.error && <p role="alert" className="cm-error-text">{state.error}</p>}
        {!state.loading && !state.error && visible.length === 0 && <p className="cm-muted">No reactions yet.</p>}
        <ul>
          {visible.map((row, index) => (
            <li key={`${row.user?.id ?? index}-${row.reaction}`} className="cm-reactor">
              <span className="cm-reactor-avatar">
                <Avatar author={row.user} size={40} />
                <span className="cm-reactor-badge">
                  <ReactionIcon reaction={row.reaction} size={18} />
                </span>
              </span>
              <span className="cm-reactor-name">{authorName(row.user)}</span>
              <span className="cm-muted cm-reactor-handle">{row.user?.username ? `@${row.user.username}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
