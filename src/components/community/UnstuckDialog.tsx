/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Which reply got you there?" The question a learner is asked when they mark
 * their own question as unstuck.
 *
 * The answer is stored as nothing more than the asker's own "Helped" mark on
 * that comment, so it needs no table of its own. The thread then leads with
 * the reply that worked, and its writer is credited by name: a record of what a
 * good nudge looks like, written by the person it helped.
 */

import React, { useEffect, useState } from 'react';
import type { CommentWithAuthor, PostWithAuthor } from '../../services/database.types';
import { fetchTopLevelComments } from '../../services/data/feed';
import MathText from '../MathText';
import { authorName, compactAge, redactSealed } from './model';
import { Avatar, Dialog, useNow } from './ui';

const NOBODY = '';

export default function UnstuckDialog({
  post,
  onConfirm,
  onClose,
}: {
  post: PostWithAuthor;
  /** Resolve the question, crediting this comment or nobody. Resolves once it is stored. */
  onConfirm: (commentId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const now = useNow();
  const [replies, setReplies] = useState<CommentWithAuthor[] | null>(null);
  const [choice, setChoice] = useState(NOBODY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchTopLevelComments(post.id)
      // Your own comments on your own question are not what got you unstuck.
      .then((rows) => alive && setReplies(rows.filter((row) => row.author_id !== post.author_id)))
      // The list is a courtesy: if it cannot be read, the question can still be closed.
      .catch(() => alive && setReplies([]));
    return () => {
      alive = false;
    };
  }, [post.id, post.author_id]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm(choice || null);
    setBusy(false);
  };

  return (
    <Dialog title="Mark as unstuck" onClose={onClose} size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <div className="cm-dialog-body">
          {replies === null ? (
            <p className="cm-muted" role="status">
              Loading the replies…
            </p>
          ) : (
            <fieldset className="cm-credit">
              <legend>{replies.length > 0 ? 'Which reply got you there?' : 'Nobody else has replied yet.'}</legend>
              {replies.length > 0 && <p className="cm-muted">It is shown first in the thread, with your thanks.</p>}
              {replies.map((reply) => (
                <label key={reply.id} className="cm-credit-row">
                  <input type="radio" name="credit" value={reply.id} checked={choice === reply.id} onChange={() => setChoice(reply.id)} />
                  <Avatar author={reply.author} size={28} />
                  <span className="cm-credit-text">
                    <strong>
                      {authorName(reply.author)} <small>{compactAge(reply.created_at, now)}</small>
                    </strong>
                    {/* Whatever the writer sealed stays sealed in this list too. */}
                    <MathText as="span" className="cm-credit-quote" text={redactSealed(reply.body).replace(/\s+/g, ' ').slice(0, 220)} />
                  </span>
                </label>
              ))}
              <label className="cm-credit-row">
                <input type="radio" name="credit" value={NOBODY} checked={choice === NOBODY} onChange={() => setChoice(NOBODY)} data-autofocus />
                <span className="cm-credit-text">
                  <strong>{replies.length > 0 ? 'Nobody in particular' : 'I worked it out myself'}</strong>
                </span>
              </label>
            </fieldset>
          )}
        </div>
        <footer className="cm-dialog-footer">
          <button type="button" className="cm-button is-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="cm-button is-primary" disabled={busy || replies === null}>
            {busy ? 'Saving…' : 'Mark as unstuck'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
