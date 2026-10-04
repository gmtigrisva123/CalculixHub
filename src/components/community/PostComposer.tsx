/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The "Create post" dialog, also used to edit a post and to share one with
 * your own words on top.
 */

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Bold, Code2, Eye, EyeOff, Hash, Sigma, SquareSigma } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import type { AuthorSummary, SharedPost } from '../../services/database.types';
import { POST_MAX_LENGTH, type MutationResult } from '../../services/data/feed';
import MathText from '../MathText';
import { duration, ease } from '../../lib/motion';
import { authorName, firstName } from './model';
import { SharedEmbed, isLargeText } from './PostBody';
import { AutoTextarea, Avatar, Dialog, insertAtCaret } from './ui';

/** The keyboard shortcut, named for the keyboard in front of the learner. Nothing on touch. */
function submitHint(action: string): string {
  if (typeof window === 'undefined' || window.matchMedia?.('(pointer: coarse)').matches) return '';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return `${mac ? '⌘' : 'Ctrl'} + Enter to ${action.toLocaleLowerCase()}`;
}

export type ComposerMode = 'create' | 'edit' | 'share';

const TITLES: Record<ComposerMode, string> = {
  create: 'Create post',
  edit: 'Edit post',
  share: 'Share post',
};

const SUBMIT: Record<ComposerMode, [idle: string, busy: string]> = {
  create: ['Post', 'Posting…'],
  edit: ['Save', 'Saving…'],
  share: ['Share now', 'Sharing…'],
};

export default function PostComposer({
  mode,
  author,
  problems,
  initialBody = '',
  initialProblemId = null,
  shared = null,
  sharing = false,
  placeholder,
  initialPreview = false,
  onSubmit,
  onClose,
}: {
  mode: ComposerMode;
  author: AuthorSummary | null;
  problems: Problem[];
  initialBody?: string;
  initialProblemId?: string | null;
  /** The post being shared, or the original a share being edited points at. */
  shared?: SharedPost | null;
  /** Whether the post is a share: true when sharing, and when editing a share. */
  sharing?: boolean;
  placeholder?: string;
  /** Open with the rendered preview showing, for a post that is mostly math. */
  initialPreview?: boolean;
  onSubmit: (body: string, problemId: string | null) => Promise<MutationResult>;
  onClose: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [problemId, setProblemId] = useState<string>(initialProblemId ?? '');
  const [preview, setPreview] = useState(initialPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const sortedProblems = useMemo(() => [...problems].sort((a, b) => a.title.localeCompare(b.title)), [problems]);
  const dirty = body !== initialBody || problemId !== (initialProblemId ?? '');
  const isShare = mode === 'share' || sharing;
  const empty = !body.trim() && !isShare;
  const remaining = POST_MAX_LENGTH - body.length;
  const hasMarkup = /\$|\\\(|\\\[|\*\*|`|\\begin/.test(body);

  const requestClose = () => {
    if (busy) return;
    if (dirty && body.trim()) setDiscarding(true);
    else onClose();
  };

  const submit = async () => {
    if (busy || empty || remaining < 0) return;
    setBusy(true);
    setError('');
    const result = await onSubmit(body, problemId || null);
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  const wrap = (before: string, after: string, placeholderText: string) => {
    const { next, caret } = insertAtCaret(field.current, body, before, after, placeholderText);
    setBody(next);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(caret[0], caret[1]);
    });
  };

  return (
    <Dialog title={TITLES[mode]} onClose={discarding ? () => setDiscarding(false) : requestClose} size="md" className="cm-composer-dialog">
      <div className="cm-dialog-body">
        <div className="cm-composer-author">
          <Avatar author={author} size={42} />
          <div>
            <strong>{authorName(author)}</strong>
            <label className="cm-problem-select">
              <Hash size={14} aria-hidden="true" />
              <span className="sr-only">Problem this post is about</span>
              <select value={problemId} onChange={(event) => setProblemId(event.target.value)}>
                <option value="">Open conversation</option>
                {sortedProblems.map((problem) => (
                  <option key={problem.id} value={problem.id}>
                    {problem.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <AutoTextarea
          ref={field}
          data-autofocus
          className={`cm-composer-text ${isLargeText(body) || !body ? 'is-large' : ''}`}
          value={body}
          placeholder={placeholder ?? (isShare ? 'Say something about this…' : `What’s on your mind, ${firstName(author)}?`)}
          aria-label={TITLES[mode]}
          maxHeight={360}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <AnimatePresence initial={false}>
          {preview && body.trim() && (
            <m.div
              className="cm-preview"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.standard } }}
              exit={{ opacity: 0, height: 0, transition: { duration: duration.fast, ease: ease.exit } }}
            >
              <span className="cm-preview-label">Preview</span>
              <div className="cm-body">
                <MathText text={body} />
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {isShare && <SharedEmbed original={shared} problemTitle={problems.find((problem) => problem.id === shared?.problem_id)?.title} />}

        <div className="cm-toolbox" role="toolbar" aria-label="Formatting">
          <span className="cm-toolbox-label">Add to your post</span>
          <div>
            <button type="button" className="cm-icon-button" title="Inline math  $x^2$" aria-label="Insert inline math" onClick={() => wrap('$', '$', 'x^2')}>
              <Sigma size={19} aria-hidden="true" />
            </button>
            <button type="button" className="cm-icon-button" title="Display math  $$…$$" aria-label="Insert display math" onClick={() => wrap('\n$$', '$$\n', '\\frac{a}{b}')}>
              <SquareSigma size={19} aria-hidden="true" />
            </button>
            <button type="button" className="cm-icon-button" title="Bold  **text**" aria-label="Bold" onClick={() => wrap('**', '**', 'bold')}>
              <Bold size={19} aria-hidden="true" />
            </button>
            <button type="button" className="cm-icon-button" title="Code  `code`" aria-label="Code" onClick={() => wrap('`', '`', 'code')}>
              <Code2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`cm-icon-button ${preview ? 'is-active' : ''}`}
              aria-pressed={preview}
              aria-label={preview ? 'Hide preview' : 'Show preview'}
              title={hasMarkup ? 'Preview how your math renders' : 'Preview'}
              onClick={() => setPreview((value) => !value)}
            >
              {preview ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="cm-error-text">
            {error}
          </p>
        )}
      </div>

      <footer className="cm-dialog-footer is-stacked">
        <span className={`cm-counter ${remaining < 0 ? 'is-over' : remaining < 300 ? 'is-near' : ''}`} aria-live="polite">
          {remaining < 300 ? `${remaining} characters left` : submitHint(SUBMIT[mode][0])}
        </span>
        <button type="button" className="cm-button is-primary is-wide" onClick={() => void submit()} disabled={busy || empty || remaining < 0 || (mode === 'edit' && !dirty)}>
          {busy ? SUBMIT[mode][1] : SUBMIT[mode][0]}
        </button>
      </footer>

      <AnimatePresence>
        {discarding && (
          <m.div
            className="cm-discard"
            role="alertdialog"
            aria-label="Discard changes?"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div>
              <strong>{mode === 'edit' ? 'Discard changes?' : 'Discard post?'}</strong>
              <p>{mode === 'edit' ? 'Your edits won’t be saved.' : 'What you’ve written will be lost.'}</p>
              <div className="cm-discard-actions">
                <button type="button" className="cm-button is-quiet" onClick={() => setDiscarding(false)} autoFocus>
                  Keep editing
                </button>
                <button type="button" className="cm-button is-danger" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
