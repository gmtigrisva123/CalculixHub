/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @mention suggestions for a text box.
 *
 * Typing `@` opens a list: people already in the conversation first, then
 * anyone whose name matches once two letters are typed. Arrow keys move,
 * Enter or Tab picks, Escape dismisses. The database turns a finished
 * `@username` into a notification; this only helps spell it.
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import type { AuthorSummary } from '../../services/database.types';
import { searchProfiles } from '../../services/data/people';
import { duration, ease, spring } from '../../lib/motion';
import { activeMention, authorName, completeMention } from './model';
import { Avatar } from './ui';

const LIMIT = 6;
const SEARCH_DELAY_MS = 180;

export type MentionPerson = Pick<AuthorSummary, 'id' | 'username' | 'display_name' | 'avatar_url'>;
type Person = MentionPerson;

function matches(person: Person, query: string): boolean {
  const needle = query.toLocaleLowerCase();
  return person.username.toLocaleLowerCase().startsWith(needle) || person.display_name.toLocaleLowerCase().split(/\s+/).some((part) => part.startsWith(needle));
}

/**
 * Wire mention suggestions to a controlled textarea. Spread `inputProps` onto
 * the textarea, call `onKeyDown` first in its key handler (it returns true when
 * it consumed the key), and render `menu` inside a positioned wrapper.
 */
export function useMentions({
  value,
  setValue,
  field,
  candidates,
  selfId,
  placement = 'below',
}: {
  value: string;
  setValue: (next: string) => void;
  field: React.RefObject<HTMLTextAreaElement | null>;
  candidates: Person[];
  selfId: string | null;
  placement?: 'above' | 'below';
}) {
  const [caret, setCaret] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [remote, setRemote] = useState<Person[]>([]);
  const [index, setIndex] = useState(0);
  const listId = useId();

  const active = activeMention(value, caret);
  const query = active?.query ?? '';
  const open = Boolean(active) && dismissedAt !== active?.start;

  useEffect(() => {
    if (!open || query.length < 2) {
      setRemote([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      searchProfiles(query, LIMIT)
        .then((found) => alive && setRemote(found))
        .catch(() => alive && setRemote([]));
    }, SEARCH_DELAY_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const results = useMemo(() => {
    if (!open) return [];
    const seen = new Set<string>(selfId ? [selfId] : []);
    const list: Person[] = [];
    for (const person of [...candidates.filter((entry) => matches(entry, query)), ...remote]) {
      if (!person.username || seen.has(person.id)) continue;
      seen.add(person.id);
      list.push(person);
      if (list.length === LIMIT) break;
    }
    return list;
  }, [open, candidates, remote, query, selfId]);

  useEffect(() => setIndex(0), [query, results.length]);

  const syncCaret = () => setCaret(field.current?.selectionStart ?? value.length);

  const pick = (person: Person) => {
    const { next, caret: position } = completeMention(value, field.current?.selectionStart ?? caret, person.username);
    setValue(next);
    setCaret(position);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(position, position);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open || results.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setIndex((current) => (current + step + results.length) % results.length);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(results[index] ?? results[0]!);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDismissedAt(active?.start ?? null);
      return true;
    }
    return false;
  };

  const showing = open && results.length > 0;
  const optionId = (position: number) => `${listId}-option-${position}`;

  const menu = (
    <AnimatePresence>
      {showing && (
        <m.ul
          id={listId}
          role="listbox"
          aria-label="People to mention"
          className={`cm-mentions is-${placement}`}
          initial={{ opacity: 0, y: placement === 'above' ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
          exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
          // Keep focus in the text box while a suggestion is clicked.
          onMouseDown={(event) => event.preventDefault()}
        >
          {results.map((person, position) => (
            <li
              key={person.id}
              id={optionId(position)}
              role="option"
              aria-selected={position === index}
              className={`cm-mention-option ${position === index ? 'is-active' : ''}`}
              onMouseEnter={() => setIndex(position)}
              onClick={() => pick(person)}
            >
              <Avatar author={person} size={28} />
              <span>
                <strong>{authorName(person)}</strong>
                <small>@{person.username}</small>
              </span>
            </li>
          ))}
        </m.ul>
      )}
    </AnimatePresence>
  );

  return {
    menu,
    onKeyDown,
    inputProps: {
      onSelect: syncCaret,
      onKeyUp: syncCaret,
      onClick: syncCaret,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': showing,
      'aria-controls': showing ? listId : undefined,
      'aria-activedescendant': showing ? optionId(index) : undefined,
    },
    /** Call from onChange with the new value, so the caret is known before the next render. */
    track: (element: HTMLTextAreaElement) => setCaret(element.selectionStart ?? element.value.length),
  };
}
