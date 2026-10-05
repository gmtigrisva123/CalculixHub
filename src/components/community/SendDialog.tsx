/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Send in Messages": share a post privately, as a link in a direct
 * conversation, with an optional note. Uses the existing messaging tables, so
 * the recipient finds it in their Inbox like any other message.
 */

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Search, Send } from 'lucide-react';
import type { AuthorSummary, PostWithAuthor, SharedPost } from '../../services/database.types';
import { sendDirectMessage } from '../../services/data/messaging';
import { searchProfiles } from '../../services/data/people';
import type { MentionPerson } from './Mentions';
import { authorName, shareLink } from './model';
import { SharedEmbed } from './PostBody';
import { AutoTextarea, Avatar, Dialog, useToast } from './ui';

type SendState = 'sending' | 'sent' | 'failed';

export default function SendDialog({
  post,
  original,
  viewer,
  suggestions,
  problemTitle,
  onClose,
}: {
  post: PostWithAuthor;
  /** What the recipient will see previewed: the original of a share. */
  original: SharedPost;
  viewer: AuthorSummary;
  suggestions: MentionPerson[];
  problemTitle: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [states, setStates] = useState<Record<string, SendState>>({});

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchProfiles(term, 12)
        .then((found) => alive && setResults(found))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const people = (query.trim().length >= 2 ? results : suggestions).filter((person) => person.id !== viewer.id).slice(0, 12);

  const send = async (person: MentionPerson) => {
    setStates((map) => ({ ...map, [person.id]: 'sending' }));
    const body = `${note.trim() || 'Take a look at this discussion on CalculixHub:'}\n${shareLink(post.id)}`;
    const result = await sendDirectMessage({ targetId: person.id, senderId: viewer.id, body });
    setStates((map) => ({ ...map, [person.id]: result.ok ? 'sent' : 'failed' }));
    if (result.ok) toast(`Sent to ${authorName(person)}`);
    else toast(result.error, 'error');
  };

  const sentCount = Object.values(states).filter((state) => state === 'sent').length;

  return (
    <Dialog title="Send in Messages" onClose={onClose} size="md">
      <div className="cm-dialog-body cm-send-dialog">
        <SharedEmbed original={original} problemTitle={problemTitle} />
        <AutoTextarea
          className="cm-send-note"
          value={note}
          maxLength={500}
          maxHeight={140}
          placeholder="Add a note (optional)…"
          aria-label="Note to send with the post"
          onChange={(event) => setNote(event.target.value)}
        />
        <label className="cm-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Find a learner</span>
          <input data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learners by name or @username" />
          {searching && <Loader2 size={16} className="cm-spin" aria-hidden="true" />}
        </label>
        <p className="cm-send-heading">{query.trim().length >= 2 ? 'Results' : 'Suggested'}</p>
        {people.length === 0 ? (
          <p className="cm-muted cm-send-empty">{query.trim().length >= 2 ? (searching ? 'Searching…' : 'Nobody matches that name.') : 'Search for someone to send this to.'}</p>
        ) : (
          <ul className="cm-send-list">
            {people.map((person) => {
              const state = states[person.id];
              return (
                <li key={person.id}>
                  <Avatar author={person} size={40} />
                  <span className="cm-send-name">
                    <strong>{authorName(person)}</strong>
                    <small>@{person.username}</small>
                  </span>
                  <button
                    type="button"
                    className={`cm-button ${state === 'sent' ? 'is-quiet' : 'is-primary'}`}
                    disabled={state === 'sending' || state === 'sent'}
                    onClick={() => void send(person)}
                    aria-label={state === 'sent' ? `Sent to ${authorName(person)}` : `Send to ${authorName(person)}`}
                  >
                    {state === 'sending' ? (
                      <Loader2 size={16} className="cm-spin" aria-hidden="true" />
                    ) : state === 'sent' ? (
                      <>
                        <Check size={16} aria-hidden="true" /> Sent
                      </>
                    ) : (
                      <>
                        <Send size={15} aria-hidden="true" /> {state === 'failed' ? 'Retry' : 'Send'}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <footer className="cm-dialog-footer">
        <button type="button" className="cm-button is-quiet" onClick={onClose}>
          {sentCount > 0 ? 'Done' : 'Cancel'}
        </button>
      </footer>
    </Dialog>
  );
}
