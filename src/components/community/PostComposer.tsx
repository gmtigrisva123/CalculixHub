/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The post dialog: choose what kind of post it is, where it is filed, write it,
 * and see the math as it will render. Also used to edit a post and to repost
 * one with a line of your own above it.
 */

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Bold, BookOpen, EyeClosed, Hash, ImagePlus, ListTree, Sigma, SquareSigma, Users } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import type { AuthorSummary, SharedPost } from '../../services/database.types';
import type { Circle } from '../../services/data/circles';
import { POST_MAX_LENGTH, type MutationResult } from '../../services/data/feed';
import { MAX_POST_IMAGES } from '../../services/data/media';
import { duration, ease } from '../../lib/motion';
import { AttachmentTray, imageFiles, useAttachments } from './Media';
import { useMentions, type MentionPerson } from './Mentions';
import { KIND_META, POST_KINDS, SUGGESTED_TAGS, authorName, composePost, disambiguateTitles, extractTags, insideMath, parsePost, type PostKind } from './model';
import { SharedEmbed } from './PostBody';
import { KIND_ICON } from './PostCard';
import RichText, { TagActionContext } from './RichText';
import { AutoTextarea, Avatar, Dialog, insertAtCaret } from './ui';

/** The keyboard shortcut, named for the keyboard in front of the learner. Nothing on touch. */
function submitHint(action: string): string {
  if (typeof window === 'undefined' || window.matchMedia?.('(pointer: coarse)').matches) return '';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return `${mac ? '⌘' : 'Ctrl'} + Enter to ${action.toLocaleLowerCase()}`;
}

export type ComposerMode = 'create' | 'edit' | 'share';

const TITLES: Record<ComposerMode, string> = {
  create: 'New post',
  edit: 'Edit post',
  share: 'Repost with a note',
};

/**
 * Arrow keys move along a row of keys, so the row is one stop on the way from
 * the text to the Post button instead of sixteen.
 */
function rove(event: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const keys = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const index = keys.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
  keys[next]?.focus();
}

/**
 * What the palette inserts. Each is LaTeX as a contest write-up uses it, with
 * the part to overwrite left selected. `face` is what the key shows; `base` is
 * what a power or subscript hangs on when it starts a formula of its own.
 */
const SYMBOLS: ReadonlyArray<{ face: string; label: string; before: string; after?: string; hole?: string; base?: string }> = [
  { face: 'a/b', label: 'Fraction', before: '\\frac{', after: '}{b}', hole: 'a' },
  { face: 'xⁿ', label: 'Power', before: '^{', after: '}', hole: 'n', base: 'x' },
  { face: 'xₙ', label: 'Subscript', before: '_{', after: '}', hole: 'n', base: 'x' },
  { face: '√', label: 'Square root', before: '\\sqrt{', after: '}', hole: 'x' },
  { face: 'Σ', label: 'Sum', before: '\\sum_{k=1}^{n} ', hole: 'a_k' },
  { face: '(ⁿₖ)', label: 'Binomial coefficient', before: '\\binom{', after: '}{k}', hole: 'n' },
  { face: '≤', label: 'Less than or equal', before: '\\le ' },
  { face: '≥', label: 'Greater than or equal', before: '\\ge ' },
  { face: '≠', label: 'Not equal', before: '\\ne ' },
  { face: '≡', label: 'Congruent modulo', before: '\\equiv ', after: ' \\pmod{n}', hole: 'a' },
  { face: '∣', label: 'Divides', before: '\\mid ' },
  { face: '∠', label: 'Angle', before: '\\angle ', hole: 'ABC' },
  { face: '△', label: 'Triangle', before: '\\triangle ', hole: 'ABC' },
  { face: '⇒', label: 'Implies', before: '\\implies ' },
  { face: '∈', label: 'Element of', before: '\\in ' },
  { face: 'π', label: 'Pi', before: '\\pi ' },
];

const SUBMIT: Record<ComposerMode, [idle: string, busy: string]> = {
  create: ['Post', 'Posting…'],
  edit: ['Save', 'Saving…'],
  share: ['Repost', 'Reposting…'],
};

export default function PostComposer({
  mode,
  author,
  problems,
  initialBody = '',
  initialProblemId = null,
  initialKind = null,
  shared = null,
  sharing = false,
  placeholder,
  initialPreview = false,
  initialImages = [],
  allowImages = false,
  mentionCandidates = [],
  circles = [],
  initialCircleId = null,
  onSubmit,
  onClose,
}: {
  mode: ComposerMode;
  author: AuthorSummary | null;
  problems: Problem[];
  initialBody?: string;
  initialProblemId?: string | null;
  /** The kind a new post starts as. A post being edited keeps the kind it has. */
  initialKind?: PostKind | null;
  /** The post being shared, or the original a share being edited points at. */
  shared?: SharedPost | null;
  /** Whether the post is a share: true when sharing, and when editing a share. */
  sharing?: boolean;
  placeholder?: string;
  /** Open with the rendered preview showing, for a post that is mostly math. */
  initialPreview?: boolean;
  /** The images of a post being edited. */
  initialImages?: string[];
  /** Whether the database can store images yet. */
  allowImages?: boolean;
  mentionCandidates?: MentionPerson[];
  /** The circles the author belongs to, for a new post. A post cannot change circle afterwards. */
  circles?: Circle[];
  initialCircleId?: string | null;
  onSubmit: (body: string, problemId: string | null, images: string[], circleId: string | null) => Promise<MutationResult>;
  onClose: () => void;
}) {
  const isShare = mode === 'share' || sharing;
  // The kind is stored as the tag the post opens with; here it is a control of
  // its own. A repost has no kind: its words are a note on someone else's post.
  const initial = useMemo(() => (isShare ? { kind: null, resolved: false, text: initialBody } : parsePost(initialBody)), [initialBody, isShare]);
  const startKind = mode === 'edit' ? initial.kind : initialKind;
  const [body, setBody] = useState(initial.text);
  const [chosenKind, setKind] = useState<PostKind | null>(startKind);
  const [problemId, setProblemId] = useState<string>(initialProblemId ?? '');
  const [circleId, setCircleId] = useState<string>(initialCircleId && circles.some((circle) => circle.id === initialCircleId) ? initialCircleId : '');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [preview, setPreview] = useState(initialPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const attachments = useAttachments(author?.id ?? null, MAX_POST_IMAGES, initialImages);
  const mentions = useMentions({ value: body, setValue: setBody, field, candidates: mentionCandidates, selfId: author?.id ?? null });

  const problemTitles = useMemo(() => disambiguateTitles(problems), [problems]);
  const sortedProblems = useMemo(
    () => [...problems].sort((a, b) => (problemTitles.get(a.id) ?? a.title).localeCompare(problemTitles.get(b.id) ?? b.title)),
    [problems, problemTitles],
  );
  const imagesChanged = attachments.items.length !== initialImages.length || attachments.paths.some((path, index) => path !== initialImages[index]);
  // A kind tag typed or pasted as the first line counts when nothing is chosen above it.
  const typed = useMemo(() => (isShare ? { kind: null, resolved: false, text: body } : parsePost(body)), [body, isShare]);
  const kind = chosenKind ?? typed.kind;
  const dirty = body !== initial.text || kind !== startKind || problemId !== (initialProblemId ?? '') || imagesChanged;
  const empty = !typed.text.trim() && !isShare && attachments.paths.length === 0;
  // An unstuck post stays unstuck through an edit, unless it stops being a "stuck" post.
  const stored = isShare ? body : composePost(body, kind, (initial.resolved || typed.resolved) && kind === 'stuck');
  const remaining = POST_MAX_LENGTH - stored.length;
  const usedTags = useMemo(() => new Set(extractTags(body, true)), [body]);
  const offeredTags = SUGGESTED_TAGS.filter((tag) => !usedTags.has(tag));

  const close = () => {
    attachments.discard();
    onClose();
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty && (body.trim() || attachments.items.length > 0)) setDiscarding(true);
    else close();
  };

  const submit = async () => {
    if (busy || empty || remaining < 0 || attachments.uploading) return;
    setBusy(true);
    setError('');
    const result = await onSubmit(stored, problemId || null, attachments.paths, mode === 'create' ? circleId || null : null);
    setBusy(false);
    if (result.ok) {
      attachments.reset();
      onClose();
    } else setError(result.error);
  };

  const attach = (files: File[]) => {
    if (allowImages && files.length > 0) attachments.add(files);
  };

  const wrap = (before: string, after: string, placeholderText: string) => {
    const { next, caret } = insertAtCaret(field.current, body, before, after, placeholderText);
    setBody(next);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(caret[0], caret[1]);
    });
  };

  /** A symbol from the palette: bare inside a formula, wrapped in `$…$` outside one. */
  const symbol = (before: string, after = '', hole = '', base = '') => {
    const inMath = insideMath(body, field.current?.selectionStart ?? body.length);
    wrap(inMath ? before : `$${base}${before}`, inMath ? after : `${after}$`, hole);
  };

  const addTag = (tag: string) => {
    setBody((current) => `${current.replace(/\s+$/, '')}${current.trim() ? ' ' : ''}#${tag} `);
    requestAnimationFrame(() => field.current?.focus());
  };

  const title = mode === 'create' && kind ? KIND_META[kind].action : TITLES[mode];

  return (
    <Dialog title={title} onClose={discarding ? () => setDiscarding(false) : requestClose} size="md" className="cm-composer-dialog">
      <div
        className={`cm-dialog-body ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          if (!allowImages || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (!allowImages) return;
          event.preventDefault();
          setDragging(false);
          attach(imageFiles(event.dataTransfer.files));
        }}
      >
        {dragging && (
          <div className="cm-drop-hint" aria-hidden="true">
            <ImagePlus size={28} /> Drop images to attach
          </div>
        )}
        <div className="cm-composer-author">
          <Avatar author={author} size={42} />
          <div>
            <strong>{authorName(author)}</strong>
            <div className="cm-filing-selects">
              <label className="cm-problem-select">
                <BookOpen size={14} aria-hidden="true" />
                <span className="sr-only">Problem this post is about</span>
                <select value={problemId} onChange={(event) => setProblemId(event.target.value)}>
                  <option value="">No particular problem</option>
                  {sortedProblems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problemTitles.get(problem.id) ?? problem.title}
                    </option>
                  ))}
                </select>
              </label>
              {mode === 'create' && circles.length > 0 && (
                <label className="cm-problem-select">
                  <Users size={14} aria-hidden="true" />
                  <span className="sr-only">Where this post is filed</span>
                  <select value={circleId} onChange={(event) => setCircleId(event.target.value)}>
                    <option value="">Everyone</option>
                    {circles.map((circle) => (
                      <option key={circle.id} value={circle.id}>
                        {circle.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>

        {!isShare && (
          <fieldset className="cm-kinds">
            <legend className="sr-only">What kind of post is this?</legend>
            {POST_KINDS.map((option) => {
              const Icon = KIND_ICON[option];
              return (
                <button key={option} type="button" className={`cm-kind-option is-${option}`} aria-pressed={kind === option} onClick={() => setKind(chosenKind === option ? null : option)}>
                  <Icon size={16} aria-hidden="true" />
                  {KIND_META[option].label}
                </button>
              );
            })}
            <p className="cm-kinds-blurb">{kind ? KIND_META[kind].blurb : 'Pick a kind so the right people find it, or leave it open.'}</p>
          </fieldset>
        )}

        <div className="cm-composer-text-wrap">
        <AutoTextarea
          ref={field}
          data-autofocus
          className="cm-composer-text"
          value={body}
          placeholder={isShare ? 'Add a line about why this is worth reading…' : kind ? KIND_META[kind].prompt : placeholder ?? 'Share an approach, a question or something you noticed.'}
          aria-label={title}
          maxHeight={360}
          {...mentions.inputProps}
          onChange={(event) => {
            setBody(event.target.value);
            mentions.track(event.target);
          }}
          onPaste={(event) => {
            const files = allowImages ? imageFiles(event.clipboardData?.items) : [];
            if (files.length > 0) {
              event.preventDefault();
              attach(files);
            }
          }}
          onKeyDown={(event) => {
            if (mentions.onKeyDown(event)) return;
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {mentions.menu}
        </div>

        <AttachmentTray items={attachments.items} onRemove={attachments.remove} />

        <AnimatePresence initial={false}>
          {preview && body.trim() && (
            <m.div
              className="cm-preview"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.standard } }}
              exit={{ opacity: 0, height: 0, transition: { duration: duration.fast, ease: ease.exit } }}
            >
              <span className="cm-preview-label">How it will read</span>
              {/* Tags are not buttons here: pressing one would filter the feed behind the dialog. */}
              <TagActionContext.Provider value={null}>
                <div className="cm-body">
                  <RichText text={typed.text} />
                </div>
              </TagActionContext.Provider>
            </m.div>
          )}
        </AnimatePresence>

        {isShare && <SharedEmbed original={shared} problemTitle={problems.find((problem) => problem.id === shared?.problem_id)?.title} />}

        <div className="cm-palette" role="toolbar" aria-label="Insert a symbol" onKeyDown={rove}>
          {SYMBOLS.map((entry, index) => (
            <button
              key={entry.label}
              type="button"
              className="cm-key-cap"
              title={entry.label}
              aria-label={entry.label}
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => symbol(entry.before, entry.after, entry.hole, entry.base)}
            >
              {entry.face}
            </button>
          ))}
        </div>

        <div className="cm-toolbox" role="group" aria-label="Formatting">
          <div>
            {allowImages && (
              <>
                <button
                  type="button"
                  className="cm-tool"
                  title={attachments.full ? `Up to ${MAX_POST_IMAGES} images` : 'Or paste or drop an image'}
                  disabled={attachments.full}
                  onClick={() => picker.current?.click()}
                >
                  <ImagePlus size={17} aria-hidden="true" /> Image
                </button>
                <input
                  ref={picker}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(event) => {
                    attach(imageFiles(event.target.files));
                    event.target.value = '';
                  }}
                />
              </>
            )}
            <button type="button" className="cm-tool" title="Inline math  $x^2$" onClick={() => wrap('$', '$', 'x^2')}>
              <Sigma size={17} aria-hidden="true" /> Math
            </button>
            <button type="button" className="cm-tool" title="A formula on its own line  $$…$$" onClick={() => wrap('\n$$', '$$\n', '\\frac{a}{b}')}>
              <SquareSigma size={17} aria-hidden="true" /> Display
            </button>
            <button type="button" className="cm-tool" title="A hint readers open when they want it. Several make a ladder." onClick={() => wrap('\n[hint]\n', '\n[/hint]\n', 'The key idea goes here.')}>
              <ListTree size={17} aria-hidden="true" /> Sealed hint
            </button>
            <button type="button" className="cm-tool" title="Hide a few words until they are tapped  ||like this||" onClick={() => wrap('||', '||', 'the answer')}>
              <EyeClosed size={17} aria-hidden="true" /> Hide
            </button>
            <button type="button" className="cm-tool" title="Bold  **text**" onClick={() => wrap('**', '**', 'bold')}>
              <Bold size={17} aria-hidden="true" /> Bold
            </button>
            {!isShare && (
              <button
                type="button"
                className={`cm-tool ${tagsOpen ? 'is-active' : ''}`}
                aria-expanded={tagsOpen}
                aria-controls="cm-tag-offer"
                title="Name the technique, so the post is found by it"
                onClick={() => setTagsOpen((value) => !value)}
              >
                <Hash size={17} aria-hidden="true" /> Technique
              </button>
            )}
          </div>
        </div>

        {!isShare && tagsOpen && (
          <div className="cm-tag-offer" id="cm-tag-offer" role="group" aria-label="Technique tags">
            {offeredTags.map((tag) => (
              <button key={tag} type="button" className="cm-tag is-chip" onClick={() => addTag(tag)}>
                #{tag}
              </button>
            ))}
            {offeredTags.length === 0 && <span className="cm-muted">Every suggested technique is already on this post.</span>}
          </div>
        )}

        {error && (
          <p role="alert" className="cm-error-text">
            {error}
          </p>
        )}
      </div>

      <footer className="cm-dialog-footer is-composer">
        <span className={`cm-counter ${remaining < 0 ? 'is-over' : remaining < 300 ? 'is-near' : ''}`} aria-live="polite">
          {remaining < 300 ? `${remaining} characters left` : submitHint(SUBMIT[mode][0])}
        </span>
        <button type="button" className="cm-button is-quiet" aria-pressed={preview} disabled={!typed.text.trim()} onClick={() => setPreview((value) => !value)}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
        <button
          type="button"
          className="cm-button is-primary"
          onClick={() => void submit()}
          disabled={busy || empty || remaining < 0 || attachments.uploading || (mode === 'edit' && !dirty)}
        >
          {busy ? SUBMIT[mode][1] : attachments.uploading ? 'Uploading images…' : SUBMIT[mode][0]}
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
              <p>{mode === 'edit' ? 'Your edits will not be saved.' : 'What you have written will be lost.'}</p>
              <div className="cm-discard-actions">
                <button type="button" className="cm-button is-quiet" onClick={() => setDiscarding(false)} autoFocus>
                  Keep editing
                </button>
                <button type="button" className="cm-button is-danger" onClick={close}>
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
