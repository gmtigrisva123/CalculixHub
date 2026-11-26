/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One post in the feed: who wrote it and what kind of post it is, the text,
 * a shared original, the marks it has drawn, the mark / comment / share bar,
 * and -- when opened -- its comments.
 */

import {
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  Copy,
  Flag,
  LifeBuoy,
  Lightbulb,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  PenLine,
  Repeat2,
  RotateCcw,
  ScrollText,
  Send,
  Share2,
  SquarePen,
  Trash2,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { AuthorSummary, PostWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import type { FeedSchema } from '../../services/data/feed';
import type { PresentPerson } from '../../services/data/live';
import Comments from './Comments';
import { MediaGrid } from './Media';
import type { MentionPerson } from './Mentions';
import { ExpandableBody, SharedEmbed, isLargeText } from './PostBody';
import { ReactButton, ReactionStack } from './Reactions';
import { KIND_META, authorName, firstName, fullTimestamp, parsePost, plural, postAge, totalReactions, type PostKind } from './model';
import { Avatar, Menu, canNativeShare, useNow, type MenuEntry } from './ui';

export interface PostActions {
  react: (post: PostWithAuthor, next: Reaction | null) => void;
  edit: (post: PostWithAuthor) => void;
  remove: (post: PostWithAuthor) => void;
  toggleSave: (post: PostWithAuthor) => void;
  shareNow: (post: PostWithAuthor) => void;
  shareWithThoughts: (post: PostWithAuthor) => void;
  copyLink: (post: PostWithAuthor) => void;
  copyText: (post: PostWithAuthor) => void;
  shareVia: (post: PostWithAuthor) => void;
  filterProblem: (problemId: string) => void;
  openOriginal: (postId: string) => void;
  openReactors: (target: 'post' | 'comment', id: string, counts: ReactionCounts | undefined) => void;
  toggleComments: (post: PostWithAuthor) => void;
  focusComposer: (post: PostWithAuthor) => void;
  sendInMessages: (post: PostWithAuthor) => void;
  openMedia: (paths: string[], index: number) => void;
  /** Re-read the post after its comments change, for the comment count. */
  refresh: (post: PostWithAuthor) => void;
  /** Open the small profile of whoever wrote something. */
  openProfile: (author: AuthorSummary) => void;
  toggleFollow: (authorId: string) => void;
  /** Read only this person's posts. */
  filterAuthor: (author: AuthorSummary) => void;
  /** Mark a "stuck" post resolved, or reopen it. Only its author is offered this. */
  setResolved: (post: PostWithAuthor, resolved: boolean) => void;
}

export const KIND_ICON: Record<PostKind, LucideIcon> = {
  solution: PenLine,
  stuck: LifeBuoy,
  trick: Lightbulb,
  challenge: Flag,
};

export default function PostCard({
  post,
  viewer,
  schema,
  problemTitle,
  commentsOpen,
  composerSignal,
  focusCommentId,
  highlighted,
  viewers,
  mentionCandidates,
  following,
  shielded = false,
  onSolve,
  actions,
}: {
  post: PostWithAuthor;
  viewer: AuthorSummary | null;
  schema: FeedSchema | null;
  problemTitle: (id: string | null | undefined) => string | null;
  commentsOpen: boolean;
  composerSignal: number;
  focusCommentId: string | null;
  highlighted: boolean;
  /** Other people with this post's comments open right now. */
  viewers: PresentPerson[];
  mentionCandidates: MentionPerson[];
  /** Ids the viewer follows. */
  following: ReadonlySet<string>;
  /** The post is about a problem the viewer has not solved, so a solution to it stays covered until asked for. */
  shielded?: boolean;
  /** Open the post's problem in Learn. */
  onSolve?: () => void;
  actions: PostActions;
}) {
  const now = useNow();
  const viewerId = viewer?.id ?? null;
  const own = viewerId === post.author_id;
  const isShare = Boolean(post.shared_post_id);
  const social = schema === 'social';
  const total = totalReactions(post.reactions);
  const shares = post.share_count ?? 0;
  const title = problemTitle(post.problem_id);
  const images = post.images ?? [];
  const { kind, resolved, text } = parsePost(post.body);
  const KindIcon = kind ? KIND_ICON[kind] : null;
  const followed = following.has(post.author_id);
  const author = post.author;
  // Only a write-up gives the answer away; a question or a trick is safe to read.
  const [revealed, setRevealed] = useState(false);
  const covered = shielded && kind === 'solution' && !isShare && !revealed;

  const menu: MenuEntry[] = [
    ...(own
      ? [
          { key: 'edit', label: 'Edit post', icon: Pencil, onSelect: () => actions.edit(post) },
          ...(kind === 'stuck' && !isShare
            ? [
                resolved
                  ? { key: 'reopen', label: 'Reopen', description: 'Still stuck: put it back in the queue.', icon: RotateCcw, onSelect: () => actions.setResolved(post, false) }
                  : { key: 'resolve', label: 'Mark as unstuck', description: 'You got there. It leaves the queue.', icon: CircleCheck, onSelect: () => actions.setResolved(post, true) },
              ]
            : []),
          { key: 'delete', label: 'Delete post', icon: Trash2, danger: true, onSelect: () => actions.remove(post) },
          { key: 'sep-own', separator: true as const },
        ]
      : []),
    ...(!own && author
      ? [
          ...(viewerId
            ? [
                followed
                  ? { key: 'follow', label: `Unfollow ${firstName(author)}`, icon: UserMinus, onSelect: () => actions.toggleFollow(post.author_id) }
                  : { key: 'follow', label: `Follow ${firstName(author)}`, description: 'Their posts appear under Following.', icon: UserPlus, onSelect: () => actions.toggleFollow(post.author_id) },
              ]
            : []),
          { key: 'theirs', label: `Posts by ${firstName(author)}`, icon: ScrollText, onSelect: () => actions.filterAuthor(author) },
          { key: 'sep-author', separator: true as const },
        ]
      : []),
    { key: 'link', label: 'Copy link', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(text.trim() ? [{ key: 'text', label: 'Copy text', icon: Copy, onSelect: () => actions.copyText(post) }] : []),
  ];

  const shareMenu: MenuEntry[] = [
    ...(viewerId && social
      ? [
          { key: 'now', label: 'Share now', description: 'Instantly share to the community feed.', icon: Repeat2, onSelect: () => actions.shareNow(post) },
          { key: 'thoughts', label: 'Share to feed', description: 'Add your own thoughts first.', icon: SquarePen, onSelect: () => actions.shareWithThoughts(post) },
          { key: 'sep', separator: true as const },
        ]
      : []),
    ...(viewerId
      ? [{ key: 'message', label: 'Send in Messages', description: 'Share it privately with another learner.', icon: Send, onSelect: () => actions.sendInMessages(post) }]
      : []),
    { key: 'link', label: 'Copy link', description: 'Paste it into a chat or an email.', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(canNativeShare() ? [{ key: 'device', label: 'Share via…', description: 'Messages, mail and other apps.', icon: Share2, onSelect: () => actions.shareVia(post) }] : []),
  ];

  return (
    <article id={`post-${post.id}`} className={`cm-card cm-post ${highlighted ? 'is-highlighted' : ''}`} aria-labelledby={`post-${post.id}-author`}>
      <header className="cm-post-header">
        <button type="button" className="cm-post-face" onClick={() => author && actions.openProfile(author)} disabled={!author} aria-label={`About ${authorName(author)}`}>
          <Avatar author={author} size={42} />
        </button>
        <div className="cm-post-meta">
          <p className="cm-post-author" id={`post-${post.id}-author`}>
            <button type="button" className="cm-post-name" onClick={() => author && actions.openProfile(author)} disabled={!author}>
              {authorName(author)}
            </button>
            {isShare && <span className="cm-muted"> shared a post</span>}
            {viewerId && !own && author && !followed && (
              <button type="button" className="cm-follow is-inline" onClick={() => actions.toggleFollow(post.author_id)} aria-label={`Follow ${authorName(author)}`}>
                Follow
              </button>
            )}
          </p>
          <p className="cm-post-sub">
            <time dateTime={post.created_at} title={fullTimestamp(post.created_at)}>
              {postAge(post.created_at, now)}
            </time>
            {author?.level && (
              <>
                <span aria-hidden="true">·</span>
                <span>{author.level}</span>
              </>
            )}
            {post.edited_at && (
              <>
                <span aria-hidden="true">·</span>
                <span title={`Edited ${fullTimestamp(post.edited_at)}`}>Edited</span>
              </>
            )}
          </p>
        </div>
        <Menu label="Post options" items={menu}>
          <MoreHorizontal size={20} aria-hidden="true" />
        </Menu>
      </header>

      {(kind || (title && post.problem_id)) && (
        <p className={`cm-filing ${kind ? `is-${kind}` : ''} ${resolved ? 'is-resolved' : ''}`}>
          {kind && KindIcon && (
            <span className="cm-kind">
              <KindIcon size={14} aria-hidden="true" />
              {KIND_META[kind].label}
              {title && post.problem_id ? (kind === 'solution' ? ' to' : kind === 'stuck' ? ' on' : ' ·') : ''}
            </span>
          )}
          {title && post.problem_id && (
            <button type="button" className="cm-problem-tag" onClick={() => actions.filterProblem(post.problem_id!)} title="Show every post about this problem">
              {title}
            </button>
          )}
          {kind === 'stuck' && (
            <span className={`cm-status ${resolved ? 'is-done' : 'is-open'}`}>{resolved ? 'Unstuck' : 'Needs a nudge'}</span>
          )}
        </p>
      )}

      {covered ? (
        <div className="cm-shield">
          <p>
            <strong>You have not solved this one yet.</strong> This post gives the solution away.
          </p>
          <div>
            {onSolve && (
              <button type="button" className="cm-button is-primary" onClick={onSolve}>
                Try the problem first
              </button>
            )}
            <button type="button" className="cm-button is-quiet" onClick={() => setRevealed(true)}>
              Show the solution
            </button>
          </div>
        </div>
      ) : (
        <ExpandableBody text={text} large={!isShare && !kind && images.length === 0 && isLargeText(text)} className="cm-post-body" />
      )}

      {!covered && images.length > 0 && (
        <div className="cm-post-media">
          <MediaGrid paths={images} label={authorName(post.author)} onOpen={(index) => actions.openMedia(images, index)} />
        </div>
      )}

      {isShare && (
        <div className="cm-post-shared">
          <SharedEmbed
            original={post.shared_post}
            problemTitle={problemTitle(post.shared_post?.problem_id)}
            onOpen={actions.openOriginal}
            onOpenMedia={actions.openMedia}
          />
        </div>
      )}

      {(total > 0 || post.comment_count > 0 || shares > 0 || viewers.length > 0) && (
        <div className="cm-post-stats">
          {total > 0 ? (
            <button
              type="button"
              className="cm-stat-reactions"
              onClick={() => actions.openReactors('post', post.id, post.reactions)}
              aria-label={`${plural(total, 'mark')}. See who left them`}
            >
              <ReactionStack counts={post.reactions} limit={4} />
            </button>
          ) : (
            <span />
          )}
          <span className="cm-stat-links">
            {viewers.length > 0 && (
              <span className="cm-viewing" title={`${viewers.map((person) => person.name).join(', ')} ${viewers.length === 1 ? 'is' : 'are'} reading the comments`}>
                <span className="cm-live-dot" aria-hidden="true" />
                <span className="cm-viewing-faces" aria-hidden="true">
                  {viewers.slice(0, 3).map((person) => (
                    <Avatar key={person.id} author={{ id: person.id, display_name: person.name, username: person.username, avatar_url: person.avatar_url }} size={18} />
                  ))}
                </span>
                <span className="sr-only">{viewers.length === 1 ? `${viewers[0]!.name} is` : `${viewers.length} people are`} reading the comments now</span>
                <span aria-hidden="true">{viewers.length} viewing</span>
              </span>
            )}
            {post.comment_count > 0 && (
              <button type="button" className="cm-stat-link" onClick={() => actions.toggleComments(post)} aria-expanded={commentsOpen}>
                {plural(post.comment_count, 'comment')}
              </button>
            )}
            {shares > 0 && <span className="cm-stat-link is-static">{plural(shares, 'share')}</span>}
          </span>
        </div>
      )}

      <div className="cm-actions" role="group" aria-label="Post actions">
        <ReactButton current={post.viewer_reaction ?? null} onReact={(next) => actions.react(post, next)} disabled={!viewerId} />
        <button type="button" className="cm-action" onClick={() => actions.focusComposer(post)} aria-expanded={commentsOpen}>
          <MessageCircle size={19} aria-hidden="true" />
          <span>{kind === 'stuck' && !resolved && !own ? 'Give a nudge' : 'Comment'}</span>
        </button>
        <Menu label="Share" items={shareMenu} buttonClassName="cm-action" align="end">
          <Share2 size={19} aria-hidden="true" />
          <span>Share</span>
        </Menu>
        {viewerId && (
          <button
            type="button"
            className={`cm-action is-icon ${post.viewer_has_saved ? 'is-saved' : ''}`}
            aria-pressed={Boolean(post.viewer_has_saved)}
            aria-label={post.viewer_has_saved ? 'Saved. Remove from your saved posts' : 'Save this post'}
            title={post.viewer_has_saved ? 'Saved' : 'Save'}
            onClick={() => actions.toggleSave(post)}
          >
            {post.viewer_has_saved ? <BookmarkCheck size={19} aria-hidden="true" /> : <Bookmark size={19} aria-hidden="true" />}
          </button>
        )}
      </div>

      {commentsOpen && (
        <Comments
          post={post}
          viewer={viewer}
          schema={schema}
          focusSignal={composerSignal}
          focusCommentId={focusCommentId}
          nudge={kind === 'stuck' && !resolved}
          onOpenReactors={actions.openReactors}
          onOpenProfile={actions.openProfile}
          onCountChange={() => actions.refresh(post)}
          mentionCandidates={mentionCandidates}
          onOpenMedia={actions.openMedia}
        />
      )}
    </article>
  );
}
