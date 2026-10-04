/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The comment section under a post: comment bubbles, one level of threaded
 * replies, reactions, inline editing and removal, image replies, @mentions,
 * a live "is writing a comment" line, and the composer.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowUpDown, Check, ChevronDown, Copy, ImagePlus, Link2, MoreHorizontal, Pencil, SendHorizontal, Share2, Trash2 } from 'lucide-react';
import type { AuthorSummary, CommentWithAuthor, PostWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import {
  COMMENT_MAX_LENGTH,
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
  compactCount,
  fullTimestamp,
  shareLink,
  shiftReaction,
  threadComments,
  totalReactions,
  typingSentence,
  type CommentSort,
} from './model';
import { AttachmentTray, MediaGrid, imageFiles, useAttachments } from './Media';
import { useMentions, type MentionPerson } from './Mentions';
import { ReactButton, ReactionStack } from './Reactions';
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
}: CommentsProps) {
  const viewerId = viewer?.id ?? null;
  const feed = useComments(post.id, viewerId);
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

  const threads = useMemo(() => threadComments(comments, sort), [comments, sort]);

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
    if (!viewerId || inFlight.current.has(comment.id)) return;
    inFlight.current.add(comment.id);
    const stored = feed.data.find((row) => row.id === comment.id)?.viewer_reaction ?? null;
    setOverrides((map) => ({ ...map, [comment.id]: next }));
    const result = await setCommentReaction({ commentId: comment.id, userId: viewerId, current: stored, next, schema });
    await feed.reload();
    setOverrides(({ [comment.id]: _settled, ...rest }) => rest);
    inFlight.current.delete(comment.id);
    if (!result.ok) toast(result.error, 'error');
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
      {threads.length > 1 && (
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
            {COMMENT_SORTS[sort].label} <ChevronDown size={16} aria-hidden="true" />
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
        <p className="cm-comments-empty">No comments yet. {viewerId ? 'Start the conversation.' : ''}</p>
      ) : null}

      <ul className="cm-thread-list">
        <AnimatePresence initial={false}>
          {shown.map(({ comment, replies }) => {
            const open = expanded.has(comment.id);
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
                  hasThread={replies.length > 0 || replyTo?.threadId === comment.id}
                  onReact={(next) => void react(comment, next)}
                  onReply={() => startReply(comment, comment)}
                  onDelete={() => setConfirm(comment)}
                  onSaved={() => void feed.reload()}
                  onOpenReactors={() => onOpenReactors('comment', comment.id, comment.reactions)}
                  onOpenMedia={onOpenMedia}
                />

                {(replies.length > 0 || replyTo?.threadId === comment.id) && (
                  <ul className="cm-replies" aria-label={`Replies to ${authorName(comment.author)}`}>
                    {replies.length > 0 && !open && (
                      <li>
                        <button type="button" className="cm-view-replies" onClick={() => setExpanded((set) => new Set(set).add(comment.id))}>
                          <Avatar author={replies[replies.length - 1]!.author} size={22} />
                          View {replies.length === 1 ? '1 reply' : `all ${replies.length} replies`}
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
                            onReact={(next) => void react(reply, next)}
                            onReply={() => startReply(comment, reply)}
                            onDelete={() => setConfirm(reply)}
                            onSaved={() => void feed.reload()}
                            onOpenReactors={() => onOpenReactors('comment', reply.id, reply.reactions)}
                            onOpenMedia={onOpenMedia}
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
          View {hidden === 1 ? '1 more comment' : `${Math.min(hidden, NEXT_PAGE)} more comments`}
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
          placeholder={threads.length === 0 ? 'Be the first to comment…' : 'Write a comment…'}
          allowImages={schema === 'social'}
          candidates={candidates}
          onTyping={typing.announce}
          onSubmit={(body, images) => submit(body, null, images)}
        />
      ) : (
        <p className="cm-comments-empty">Sign in to join the conversation.</p>
      )}

      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            key="confirm-comment"
            title="Delete comment?"
            message={
              confirm.author_id === viewerId
                ? 'Your comment and any replies to it will be removed. This can’t be undone.'
                : 'This comment and any replies to it will be removed from your post. This can’t be undone.'
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
  hasThread = false,
  onReact,
  onReply,
  onDelete,
  onSaved,
  onOpenReactors,
  onOpenMedia,
}: {
  comment: CommentWithAuthor;
  post: PostWithAuthor;
  viewerId: string | null;
  canModerate: boolean;
  highlighted: boolean;
  isReply?: boolean;
  hasThread?: boolean;
  onReact: (next: Reaction | null) => void;
  onReply: () => void;
  onDelete: () => void;
  onSaved: () => void;
  onOpenReactors: () => void;
  onOpenMedia: (paths: string[], index: number) => void;
}) {
  const now = useNow();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const own = viewerId === comment.author_id;
  const total = totalReactions(comment.reactions);
  const images = comment.images ?? [];

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
    {
      key: 'link',
      label: 'Copy link to comment',
      icon: Link2,
      onSelect: async () => toast((await copyText(link())) ? 'Link copied to clipboard' : 'Could not copy the link', 'neutral'),
    },
    {
      key: 'text',
      label: 'Copy text',
      icon: Copy,
      onSelect: async () => toast((await copyText(comment.body)) ? 'Comment text copied' : 'Could not copy the text', 'neutral'),
    },
    ...(canNativeShare()
      ? [
          {
            key: 'share',
            label: 'Share via…',
            icon: Share2,
            onSelect: async () => {
              const outcome = await nativeShare({ title: `${authorName(comment.author)} on CalculixHub`, text: comment.body.slice(0, 200), url: link() });
              if (outcome === 'failed') toast('Sharing is not available here. Try “Copy link”.', 'error');
            },
          },
        ]
      : []),
  ];

  return (
    <article id={`comment-${comment.id}`} className={`cm-comment ${isReply ? 'is-reply' : ''} ${hasThread ? 'has-thread' : ''} ${highlighted ? 'is-highlighted' : ''}`}>
      <Avatar author={comment.author} size={isReply ? 28 : 34} />
      <div className="cm-comment-main">
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
                  Press Enter to save · Esc to{' '}
                  <button type="button" className="cm-link-button" onClick={() => setEditing(false)}>
                    cancel
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
          <div className="cm-comment-row">
            <div className={`cm-bubble ${total > 0 ? 'has-reactions' : ''}`}>
              <strong className="cm-bubble-name">{authorName(comment.author)}</strong>
              {comment.author_id === post.author_id && <span className="cm-author-badge">Author</span>}
              {comment.body.trim() && (
                <div className="cm-bubble-text">
                  <RichText text={comment.body} />
                </div>
              )}
              {total > 0 && (
                <button type="button" className="cm-bubble-reactions" onClick={onOpenReactors} aria-label={`${total} reactions. See who reacted`}>
                  <ReactionStack counts={comment.reactions} size={16} />
                  {total > 1 && <span>{compactCount(total)}</span>}
                </button>
              )}
            </div>
            <Menu label="Comment options" items={items} buttonClassName="cm-icon-button cm-comment-menu">
              <MoreHorizontal size={18} aria-hidden="true" />
            </Menu>
          </div>
        )}

        {!editing && images.length > 0 && (
          <div className="cm-comment-media">
            <MediaGrid paths={images} label={authorName(comment.author)} compact onOpen={(index) => onOpenMedia(images, index)} />
          </div>
        )}

        {!editing && (
          <div className="cm-comment-actions">
            <time dateTime={comment.created_at} title={fullTimestamp(comment.created_at)}>
              {compactAge(comment.created_at, now)}
            </time>
            {viewerId && <ReactButton variant="comment" current={comment.viewer_reaction ?? null} onReact={onReact} />}
            {viewerId && (
              <button type="button" className="cm-link-button" onClick={onReply}>
                Reply
              </button>
            )}
            {comment.edited_at && (
              <span className="cm-edited" title={`Edited ${fullTimestamp(comment.edited_at)}`}>
                Edited
              </span>
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

/** "Write a comment…": a pill that grows with its text, Enter to send, one image allowed. */
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
      <Avatar author={viewer} size={compact ? 28 : 34} />
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
