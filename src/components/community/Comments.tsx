/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The comments under a post, set as notes in its margin rather than as chat
 * bubbles: a name, a time and the words, with the marks the note has drawn on
 * the line beneath it. One level of replies hangs from a straight rule.
 *
 * Also here: editing and removing a comment, image replies, @mentions, the live
 * "is writing a comment" line, the composer, and the credit a question's author
 * gives to the reply that got them unstuck.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowUpDown, Check, ChevronDown, CircleCheck, Copy, ImagePlus, Link2, MoreHorizontal, Pencil, SendHorizontal, Share2, Trash2, Undo2, Users } from 'lucide-react';
import type { AuthorSummary, CommentWithAuthor, PostWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import {
  COMMENT_MAX_LENGTH,
  CREDIT_MARK,
  createComment,
  deleteComment,
  setCommentReaction,
  updateComment,
  useComments,
  type FeedSchema,
} from '../../services/data/feed';
import { MAX_COMMENT_IMAGES } from '../../services/data/media';
import { useTyping } from '../../services/data/live';
import { duration, ease, spring } from '../../lib/motion';
import {
  COMMENT_SORTS,
  authorName,
  compactAge,
  firstName,
  fullTimestamp,
  plural,
  redactSealed,
  shareLink,
  shiftReaction,
  threadComments,
  totalReactions,
  typingSentence,
  type CommentSort,
} from './model';
import { AttachmentTray, MediaGrid, imageFiles, useAttachments } from './Media';
import { useMentions, type MentionPerson } from './Mentions';
import { MarkControl } from './Reactions';
import RichText from './RichText';
import { AutoTextarea, Avatar, ConfirmDialog, Menu, canNativeShare, copyText, nativeShare, useNow, useToast, type MenuEntry } from './ui';

const FIRST_PAGE = 5;
const NEXT_PAGE = 10;
const HIGHLIGHT_MS = 2600;

export interface CommentsProps {
  post: PostWithAuthor;
  viewer: AuthorSummary | null;
  /** The feed's schema, used until the comment query reports its own. */
  schema: FeedSchema | null;
  /** Increments each time the post's Comment button is pressed. */
  focusSignal: number;
  /** A comment to scroll to and highlight, from a shared link. */
  focusCommentId: string | null;
  onOpenReactors: (target: 'comment', id: string, counts: ReactionCounts | undefined) => void;
  /** A comment was added or removed, so the post's comment count moved. */
  onCountChange: () => void;
  /** People worth suggesting for an @mention, beyond those already in the thread. */
  mentionCandidates: MentionPerson[];
  onOpenMedia: (paths: string[], index: number) => void;
  /** The post is an open request for help: ask for hints rather than answers. */
  nudge?: boolean;
  /**
   * The author of a question that has been marked unstuck. The reply that
   * person marked "Helped" is the one that worked: it is shown first, and says so.
   */
  creditFrom?: string | null;
  /** The reader wrote the question this thread answers, so may say which reply got them there. */
  canCredit?: boolean;
  /** The question's author has just credited a reply. */
  onCredited?: () => void;
  /** Open the small profile of whoever wrote a comment. */
  onOpenProfile?: (author: AuthorSummary) => void;
  /** A signed-out reader pressed something that needs an account. */
  onNeedAccount?: (verb: string) => void;
}

/** Enter sends on a keyboard; on a touch screen Enter is a new line and the button sends. */
const enterSends = () => typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches;

export default function Comments({
  post,
  viewer,
  schema: feedSchema,
  focusSignal,
  focusCommentId,
  onOpenReactors,
  onCountChange,
  mentionCandidates,
  onOpenMedia,
  nudge = false,
  creditFrom = null,
  canCredit = false,
  onCredited,
  onOpenProfile,
  onNeedAccount,
}: CommentsProps) {
  const viewerId = viewer?.id ?? null;
  const feed = useComments(post.id, viewerId, creditFrom);
  const schema = feed.schema ?? feedSchema;
  const toast = useToast();
  const typing = useTyping(post.id, viewer);

  const [sort, setSort] = useState<CommentSort>('relevant');
  const [visible, setVisible] = useState(FIRST_PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{ threadId: string; mention: string; key: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Reaction | null>>({});
  const [confirm, setConfirm] = useState<CommentWithAuthor | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const composer = useRef<HTMLTextAreaElement>(null);
  const focusedOnce = useRef<string | null>(null);

  const comments = useMemo(
    () =>
      feed.data.map((comment) => {
        if (!(comment.id in overrides)) return comment;
        const next = overrides[comment.id] ?? null;
        const previous = comment.viewer_reaction ?? null;
        return {
          ...comment,
          viewer_reaction: next,
          reactions: shiftReaction(comment.reactions, previous, next),
          like_count: comment.like_count + (next ? 1 : 0) - (previous ? 1 : 0),
        };
      }),
    [feed.data, overrides],
  );

  // Whatever the order asked for, the reply that got the asker unstuck leads.
  const threads = useMemo(() => {
    const sorted = threadComments(comments, sort);
    const holdsCredit = (thread: (typeof sorted)[number]) => Boolean(thread.comment.credited) || thread.replies.some((reply) => reply.credited);
    return [...sorted.filter(holdsCredit), ...sorted.filter((thread) => !holdsCredit(thread))];
  }, [comments, sort]);

  // The people already in this conversation come first in @mention suggestions.
  const candidates = useMemo(() => {
    const people = new Map<string, MentionPerson>();
    for (const person of [post.author, ...comments.map((comment) => comment.author), ...mentionCandidates]) {
      if (person?.username && !people.has(person.id)) people.set(person.id, person);
    }
    return [...people.values()];
  }, [post.author, comments, mentionCandidates]);

  // Focus the composer when the post's Comment button is pressed again.
  useEffect(() => {
    if (focusSignal > 0) requestAnimationFrame(() => composer.current?.focus({ preventScroll: false }));
  }, [focusSignal]);

  // A shared link to a comment: reveal its thread, scroll to it, flash it once.
  useEffect(() => {
    if (!focusCommentId || feed.loading || focusedOnce.current === focusCommentId) return;
    const target = comments.find((comment) => comment.id === focusCommentId);
    if (!target) return;
    focusedOnce.current = focusCommentId;
    if (target.parent_id) setExpanded((set) => new Set(set).add(target.parent_id!));
    setVisible(Number.MAX_SAFE_INTEGER);
    setHighlight(focusCommentId);
    window.setTimeout(() => document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
  }, [focusCommentId, feed.loading, comments]);

  const react = async (comment: CommentWithAuthor, next: Reaction | null) => {
    if (!viewerId) {
      onNeedAccount?.('leave a mark');
      return;
    }
    if (inFlight.current.has(comment.id)) return;
    inFlight.current.add(comment.id);
    const stored = feed.data.find((row) => row.id === comment.id)?.viewer_reaction ?? null;
    setOverrides((map) => ({ ...map, [comment.id]: next }));
    const result = await setCommentReaction({ commentId: comment.id, userId: viewerId, current: stored, next, schema });
    await feed.reload();
    setOverrides(({ [comment.id]: _settled, ...rest }) => rest);
    inFlight.current.delete(comment.id);
    if (!result.ok) toast(result.error, 'error');
    return result.ok;
  };

  // The credit is nothing more than the asker's own "Helped" mark on the reply.
  const credit = async (comment: CommentWithAuthor) => {
    if (await react(comment, CREDIT_MARK)) onCredited?.();
  };

  const submit = async (body: string, parentId: string | null, images: string[]): Promise<boolean> => {
    if (!viewerId) return false;
    const result = await createComment({ postId: post.id, authorId: viewerId, body, parentId, schema, images });
    if (!result.ok) {
      toast(result.error, 'error');
      return false;
    }
    typing.stop();
    if (parentId) setExpanded((set) => new Set(set).add(parentId));
    await feed.reload();
    onCountChange();
    return true;
  };

  const startReply = (thread: CommentWithAuthor, to: CommentWithAuthor) => {
    const mention = to.author_id !== viewerId && to.author?.username ? `@${to.author.username} ` : '';
    if (schema === 'social') {
      setExpanded((set) => new Set(set).add(thread.id));
      setReplyTo({ threadId: thread.id, mention, key: Date.now() });
    } else if (composer.current) {
      // Without threaded replies, a reply is a top-level comment that names who it answers.
      composer.current.focus();
      composer.current.dispatchEvent(new CustomEvent('cm-prefill', { detail: mention }));
    }
  };

  const remove = async (comment: CommentWithAuthor) => {
    const result = await deleteComment({ commentId: comment.id, schema });
    setConfirm(null);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast('Comment deleted');
    await feed.reload();
    onCountChange();
  };

  const canModerate = schema === 'social' && viewerId === post.author_id;
  const shown = threads.slice(0, visible);
  const hidden = threads.length - shown.length;

  return (
    <m.section
      className="cm-comments"
      aria-label={`Comments on ${authorName(post.author)}’s post`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } }}
    >
      {threads.length > 2 && (
        <div className="cm-comments-toolbar">
          <Menu
            label="Sort comments"
            align="start"
            buttonClassName="cm-sort-button"
            items={(Object.keys(COMMENT_SORTS) as CommentSort[]).map((key) => ({
              key,
              label: COMMENT_SORTS[key].label,
              description: COMMENT_SORTS[key].hint,
              icon: key === sort ? Check : ArrowUpDown,
              onSelect: () => setSort(key),
            }))}
          >
            {COMMENT_SORTS[sort].label} <ChevronDown size={15} aria-hidden="true" />
          </Menu>
        </div>
      )}

      {feed.error && (
        <p role="alert" className="cm-error-text">
          {feed.error}{' '}
          <button type="button" className="cm-link-button" onClick={() => void feed.reload()}>
            Try again
          </button>
        </p>
      )}

      {feed.loading && feed.data.length === 0 ? (
        <div className="cm-comment-skeletons" role="status" aria-label="Loading comments">
          <span />
          <span />
        </div>
      ) : threads.length === 0 && !feed.error ? (
        <p className="cm-comments-empty">No comments yet.</p>
      ) : null}

      <ul className="cm-thread-list">
        <AnimatePresence initial={false}>
          {shown.map(({ comment, replies }) => {
            const open = expanded.has(comment.id) || replies.some((reply) => reply.credited);
            return (
              <m.li
                key={comment.id}
                className="cm-thread"
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
              >
                <CommentItem
                  comment={comment}
                  post={post}
                  viewerId={viewerId}
                  canModerate={canModerate}
                  highlighted={highlight === comment.id}
                  canCredit={canCredit}
                  onCredit={() => void credit(comment)}
                  onReact={(next) => void react(comment, next)}
                  onReply={() => startReply(comment, comment)}
                  onDelete={() => setConfirm(comment)}
                  onSaved={() => void feed.reload()}
                  onOpenReactors={() => onOpenReactors('comment', comment.id, comment.reactions)}
                  onOpenMedia={onOpenMedia}
                  onOpenProfile={onOpenProfile}
                />

                {(replies.length > 0 || replyTo?.threadId === comment.id) && (
                  <ul className="cm-replies" aria-label={`Replies to ${authorName(comment.author)}`}>
                    {replies.length > 0 && !open && (
                      <li>
                        <button type="button" className="cm-view-replies" aria-expanded={false} onClick={() => setExpanded((set) => new Set(set).add(comment.id))}>
                          {plural(replies.length, 'reply', 'replies')}
                        </button>
                      </li>
                    )}
                    {open &&
                      replies.map((reply) => (
                        <li key={reply.id}>
                          <CommentItem
                            comment={reply}
                            post={post}
                            viewerId={viewerId}
                            canModerate={canModerate}
                            highlighted={highlight === reply.id}
                            isReply
                            canCredit={canCredit}
                            onCredit={() => void credit(reply)}
                            onReact={(next) => void react(reply, next)}
                            onReply={() => startReply(comment, reply)}
                            onDelete={() => setConfirm(reply)}
                            onSaved={() => void feed.reload()}
                            onOpenReactors={() => onOpenReactors('comment', reply.id, reply.reactions)}
                            onOpenMedia={onOpenMedia}
                            onOpenProfile={onOpenProfile}
                          />
                        </li>
                      ))}
                    {viewer && replyTo?.threadId === comment.id && (
                      <li>
                        <CommentComposer
                          key={replyTo.key}
                          viewer={viewer}
                          compact
                          autoFocus
                          initial={replyTo.mention}
                          placeholder={`Reply to ${authorName(comment.author)}…`}
                          allowImages={schema === 'social'}
                          candidates={candidates}
                          onTyping={typing.announce}
                          onSubmit={(body, images) => submit(body, comment.id, images)}
                          onCancel={() => setReplyTo(null)}
                        />
                      </li>
                    )}
                  </ul>
                )}
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {hidden > 0 && (
        <button type="button" className="cm-view-more" onClick={() => setVisible((count) => count + NEXT_PAGE)}>
          {plural(Math.min(hidden, NEXT_PAGE), 'more comment')}
        </button>
      )}

      <AnimatePresence>
        {typing.typers.length > 0 && (
          <m.p
            className="cm-typing"
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
          >
            <span className="cm-typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {typingSentence(typing.typers.map((typer) => typer.name))}
          </m.p>
        )}
      </AnimatePresence>

      {viewer ? (
        <CommentComposer
          ref={composer}
          viewer={viewer}
          placeholder={nudge ? 'Give a nudge, not the answer. Hide a giveaway between ||double bars||…' : 'Write a comment…'}
          allowImages={schema === 'social'}
          candidates={candidates}
          onTyping={typing.announce}
          onSubmit={(body, images) => submit(body, null, images)}
        />
      ) : (
        <p className="cm-comments-empty">Sign in to comment.</p>
      )}

      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            key="confirm-comment"
            title="Delete comment?"
            message={
              confirm.author_id === viewerId
                ? 'Your comment and any replies to it will be removed. This cannot be undone.'
                : 'This comment and any replies to it will be removed from your post. This cannot be undone.'
            }
            confirmLabel="Delete"
            onConfirm={() => remove(confirm)}
            onClose={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>
    </m.section>
  );
}

function CommentItem({
  comment,
  post,
  viewerId,
  canModerate,
  highlighted,
  isReply = false,
  canCredit = false,
  onCredit,
  onReact,
  onReply,
  onDelete,
  onSaved,
  onOpenReactors,
  onOpenMedia,
  onOpenProfile,
}: {
  comment: CommentWithAuthor;
  post: PostWithAuthor;
  viewerId: string | null;
  canModerate: boolean;
  highlighted: boolean;
  isReply?: boolean;
  /** The reader asked the question, so may credit a reply for answering it. */
  canCredit?: boolean;
  onCredit?: () => void;
  onReact: (next: Reaction | null) => void;
  onReply: () => void;
  onDelete: () => void;
  onSaved: () => void;
  onOpenReactors: () => void;
  onOpenMedia: (paths: string[], index: number) => void;
  onOpenProfile?: (author: AuthorSummary) => void;
}) {
  const now = useNow();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const own = viewerId === comment.author_id;
  const total = totalReactions(comment.reactions);
  const images = comment.images ?? [];
  const author = comment.author;
  const creditedByViewer = canCredit && comment.viewer_reaction === CREDIT_MARK;

  const save = async () => {
    if (busy) return;
    if (draft.trim() === comment.body.trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const result = await updateComment({ commentId: comment.id, body: draft });
    setBusy(false);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    setEditing(false);
    onSaved();
  };

  const link = () => shareLink(post.id, comment.id);
  const items: MenuEntry[] = [
    ...(canCredit && !own && onCredit
      ? [
          creditedByViewer
            ? { key: 'credit', label: 'Take the credit back', icon: Undo2, onSelect: () => onReact(null) }
            : { key: 'credit', label: 'This got me unstuck', description: 'It is shown first, with your thanks.', icon: CircleCheck, onSelect: onCredit },
          { key: 'sep-credit', separator: true as const },
        ]
      : []),
    ...(own
      ? [
          { key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => { setDraft(comment.body); setEditing(true); } },
          { key: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
          { key: 'sep', separator: true as const },
        ]
      : canModerate
        ? [
            { key: 'remove', label: 'Delete from your post', icon: Trash2, danger: true, onSelect: onDelete },
            { key: 'sep', separator: true as const },
          ]
        : []),
    ...(total > 0 ? [{ key: 'marks', label: 'See who marked this', icon: Users, onSelect: onOpenReactors }] : []),
    {
      key: 'link',
      label: 'Copy link',
      icon: Link2,
      onSelect: async () => toast((await copyText(link())) ? 'Link copied.' : 'Could not copy the link.', 'neutral'),
    },
    {
      key: 'text',
      label: 'Copy text',
      icon: Copy,
      onSelect: async () => toast((await copyText(comment.body)) ? 'Text copied.' : 'Could not copy the text.', 'neutral'),
    },
    ...(canNativeShare()
      ? [
          {
            key: 'share',
            label: 'Share via…',
            icon: Share2,
            onSelect: async () => {
              // What the author sealed stays sealed once it leaves the page.
              const outcome = await nativeShare({ title: `${authorName(author)} on CalculixHub`, text: redactSealed(comment.body).slice(0, 200), url: link() });
              if (outcome === 'failed') toast('Sharing is not available here. Use “Copy link”.', 'error');
            },
          },
        ]
      : []),
  ];

  const face = <Avatar author={author} size={isReply ? 26 : 32} />;

  return (
    <article
      id={`comment-${comment.id}`}
      className={`cm-note ${isReply ? 'is-reply' : ''} ${highlighted ? 'is-highlighted' : ''} ${comment.credited ? 'is-credited' : ''}`}
    >
      {onOpenProfile && author ? (
        <button type="button" className="cm-note-face" onClick={() => onOpenProfile(author)} aria-label={`About ${authorName(author)}`}>
          {face}
        </button>
      ) : (
        <span className="cm-note-face">{face}</span>
      )}
      <div className="cm-note-main">
        {comment.credited && (
          <p className="cm-note-credit">
            <CircleCheck size={14} aria-hidden="true" />
            This got {firstName(post.author)} unstuck
          </p>
        )}
        <header className="cm-note-head">
          {onOpenProfile && author ? (
            <button type="button" className="cm-note-name" onClick={() => onOpenProfile(author)}>
              {authorName(author)}
            </button>
          ) : (
            <strong className="cm-note-name">{authorName(author)}</strong>
          )}
          {comment.author_id === post.author_id && <span className="cm-author-badge">Author</span>}
          <time dateTime={comment.created_at} title={fullTimestamp(comment.created_at)}>
            {compactAge(comment.created_at, now)}
          </time>
          {comment.edited_at && (
            <span className="cm-edited" title={`Edited ${fullTimestamp(comment.edited_at)}`}>
              Edited
            </span>
          )}
          {!editing && (
            <Menu label="Comment options" items={items} buttonClassName="cm-icon-button cm-note-menu">
              <MoreHorizontal size={17} aria-hidden="true" />
            </Menu>
          )}
        </header>

        {editing ? (
          <div className="cm-comment-edit">
            <AutoTextarea
              className="cm-comment-input"
              value={draft}
              maxLength={COMMENT_MAX_LENGTH}
              autoFocus
              aria-label="Edit comment"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setEditing(false);
                } else if (event.key === 'Enter' && !event.shiftKey && enterSends()) {
                  event.preventDefault();
                  void save();
                }
              }}
            />
            <p className="cm-edit-hint">
              {enterSends() ? (
                <>
                  Enter saves · Esc{' '}
                  <button type="button" className="cm-link-button" onClick={() => setEditing(false)}>
                    cancels
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="cm-link-button" onClick={() => void save()} disabled={busy || !draft.trim()}>
                    Save
                  </button>
                  {' · '}
                  <button type="button" className="cm-link-button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          comment.body.trim() && (
            <div className="cm-note-text">
              <RichText text={comment.body} />
            </div>
          )
        )}

        {!editing && images.length > 0 && (
          <div className="cm-comment-media">
            <MediaGrid paths={images} label={authorName(author)} compact onOpen={(index) => onOpenMedia(images, index)} />
          </div>
        )}

        {!editing && (
          <div className="cm-note-actions">
            <MarkControl variant="comment" counts={comment.reactions} current={comment.viewer_reaction ?? null} onReact={onReact} />
            {viewerId && (
              <button type="button" className="cm-link-button" onClick={onReply}>
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

interface ComposerProps {
  viewer: AuthorSummary;
  placeholder: string;
  initial?: string;
  compact?: boolean;
  autoFocus?: boolean;
  allowImages?: boolean;
  candidates: MentionPerson[];
  onTyping?: () => void;
  onSubmit: (body: string, images: string[]) => Promise<boolean>;
  onCancel?: () => void;
}

/** "Write a comment…": a field that grows with its text, Enter to send, one image allowed. */
const CommentComposer = React.forwardRef<HTMLTextAreaElement, ComposerProps>(function CommentComposer(
  { viewer, placeholder, initial = '', compact = false, autoFocus = false, allowImages = false, candidates, onTyping, onSubmit, onCancel },
  forwarded,
) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const attachments = useAttachments(viewer.id, MAX_COMMENT_IMAGES);
  const mentions = useMentions({ value: body, setValue: setBody, field, candidates, selfId: viewer.id, placement: 'above' });

  const setRefs = (element: HTMLTextAreaElement | null) => {
    field.current = element;
    if (typeof forwarded === 'function') forwarded(element);
    else if (forwarded) forwarded.current = element;
  };

  // Put the caret after a prefilled mention, ready to type.
  useEffect(() => {
    if (!autoFocus || !field.current) return;
    const element = field.current;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [autoFocus]);

  // The flat (pre-migration) reply path prefills the main composer.
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const onPrefill = (event: Event) => {
      const mention = (event as CustomEvent<string>).detail;
      if (!mention) return;
      setBody((value) => (value.startsWith(mention) ? value : mention + value));
    };
    element.addEventListener('cm-prefill', onPrefill);
    return () => element.removeEventListener('cm-prefill', onPrefill);
  }, []);

  // A reply box closed with an image still attached should not leave the file behind.
  const discard = useRef(attachments.discard);
  discard.current = attachments.discard;
  useEffect(() => () => discard.current(), []);

  const ready = (body.trim() || attachments.paths.length > 0) && !attachments.uploading;

  const send = async () => {
    if (busy || !ready) return;
    setBusy(true);
    const sent = await onSubmit(body, attachments.paths);
    setBusy(false);
    if (sent) {
      setBody('');
      attachments.reset();
      onCancel?.();
    }
  };

  return (
    <form
      className={`cm-composer ${compact ? 'is-compact' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <Avatar author={viewer} size={compact ? 26 : 32} />
      <div className="cm-composer-body">
        <div className="cm-composer-field">
          <AutoTextarea
            ref={setRefs}
            className="cm-comment-input"
            value={body}
            placeholder={placeholder}
            aria-label={placeholder.replace(/…$/, '')}
            maxLength={COMMENT_MAX_LENGTH}
            maxHeight={200}
            disabled={busy}
            {...mentions.inputProps}
            onChange={(event) => {
              setBody(event.target.value);
              mentions.track(event.target);
              if (event.target.value.trim()) onTyping?.();
            }}
            onPaste={(event) => {
              const files = allowImages ? imageFiles(event.clipboardData?.items) : [];
              if (files.length > 0) {
                event.preventDefault();
                attachments.add(files);
              }
            }}
            onKeyDown={(event) => {
              if (mentions.onKeyDown(event)) return;
              if (event.key === 'Enter' && !event.shiftKey && enterSends()) {
                event.preventDefault();
                void send();
              } else if (event.key === 'Escape' && onCancel) {
                event.stopPropagation();
                onCancel();
              }
            }}
          />
          {allowImages && (
            <>
              <button
                type="button"
                className="cm-composer-tool"
                aria-label="Attach an image"
                title="Attach an image"
                disabled={busy || attachments.full}
                onClick={() => picker.current?.click()}
              >
                <ImagePlus size={18} aria-hidden="true" />
              </button>
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(event) => {
                  attachments.add(imageFiles(event.target.files));
                  event.target.value = '';
                }}
              />
            </>
          )}
          <button type="submit" className="cm-send" aria-label="Send comment" disabled={busy || !ready}>
            <SendHorizontal size={18} aria-hidden="true" />
          </button>
          {mentions.menu}
        </div>
        <AttachmentTray items={attachments.items} onRemove={attachments.remove} compact />
      </div>
      {(body.length > COMMENT_MAX_LENGTH * 0.8 || compact) && (
        <p className="cm-composer-hint">
          {body.length > COMMENT_MAX_LENGTH * 0.8 && <span>{COMMENT_MAX_LENGTH - body.length} characters left</span>}
          {compact && onCancel && (
            <button type="button" className="cm-link-button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </p>
      )}
    </form>
  );
});
