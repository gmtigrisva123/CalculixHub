/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One post in the feed: header, text, shared original, reaction summary, the
 * Like / Comment / Share bar, and -- when opened -- its comments.
 */

import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Globe2,
  Hash,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Share2,
  SquarePen,
  Trash2,
} from 'lucide-react';
import type { AuthorSummary, PostWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import type { FeedSchema } from '../../services/data/feed';
import Comments from './Comments';
import { ExpandableBody, SharedEmbed, isLargeText } from './PostBody';
import { ReactButton, ReactionStack } from './Reactions';
import { authorName, fullTimestamp, plural, postAge, reactionSentence, totalReactions } from './model';
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
  /** Re-read the post after its comments change, for the comment count. */
  refresh: (post: PostWithAuthor) => void;
}

export default function PostCard({
  post,
  viewer,
  schema,
  problemTitle,
  commentsOpen,
  composerSignal,
  focusCommentId,
  highlighted,
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

  const menu: MenuEntry[] = [
    ...(own
      ? [
          { key: 'edit', label: 'Edit post', icon: Pencil, onSelect: () => actions.edit(post) },
          { key: 'delete', label: 'Delete post', icon: Trash2, danger: true, onSelect: () => actions.remove(post) },
          { key: 'sep-own', separator: true as const },
        ]
      : []),
    ...(viewerId
      ? [
          post.viewer_has_saved
            ? { key: 'save', label: 'Unsave post', description: 'Remove this from your saved posts.', icon: BookmarkCheck, onSelect: () => actions.toggleSave(post) }
            : { key: 'save', label: 'Save post', description: 'Find it again under the Saved tab.', icon: Bookmark, onSelect: () => actions.toggleSave(post) },
        ]
      : []),
    { key: 'link', label: 'Copy link', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(post.body.trim() ? [{ key: 'text', label: 'Copy text', icon: Copy, onSelect: () => actions.copyText(post) }] : []),
  ];

  const shareMenu: MenuEntry[] = [
    ...(viewerId && social
      ? [
          { key: 'now', label: 'Share now', description: 'Instantly share to the community feed.', icon: Repeat2, onSelect: () => actions.shareNow(post) },
          { key: 'thoughts', label: 'Share to feed', description: 'Add your own thoughts first.', icon: SquarePen, onSelect: () => actions.shareWithThoughts(post) },
          { key: 'sep', separator: true as const },
        ]
      : []),
    { key: 'link', label: 'Copy link', description: 'Paste it into a chat or an email.', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(canNativeShare() ? [{ key: 'device', label: 'Share via…', description: 'Messages, mail and other apps.', icon: Share2, onSelect: () => actions.shareVia(post) }] : []),
  ];

  return (
    <article id={`post-${post.id}`} className={`cm-card cm-post ${highlighted ? 'is-highlighted' : ''}`} aria-labelledby={`post-${post.id}-author`}>
      <header className="cm-post-header">
        <Avatar author={post.author} size={42} />
        <div className="cm-post-meta">
          <p className="cm-post-author" id={`post-${post.id}-author`}>
            <strong>{authorName(post.author)}</strong>
            {isShare && <span className="cm-muted"> shared a post</span>}
          </p>
          <p className="cm-post-sub">
            <time dateTime={post.created_at} title={fullTimestamp(post.created_at)}>
              {postAge(post.created_at, now)}
            </time>
            <span aria-hidden="true">·</span>
            <Globe2 size={13} aria-label="Visible to the community" />
            {post.edited_at && (
              <>
                <span aria-hidden="true">·</span>
                <span title={`Edited ${fullTimestamp(post.edited_at)}`}>Edited</span>
              </>
            )}
            {post.author?.level && (
              <>
                <span aria-hidden="true">·</span>
                <span>{post.author.level}</span>
              </>
            )}
          </p>
        </div>
        <Menu label="Post options" items={menu}>
          <MoreHorizontal size={20} aria-hidden="true" />
        </Menu>
      </header>

      {title && post.problem_id && (
        <button type="button" className="cm-problem-tag" onClick={() => actions.filterProblem(post.problem_id!)} title="Show every discussion of this problem">
          <Hash size={13} aria-hidden="true" />
          {title}
        </button>
      )}

      <ExpandableBody text={post.body} large={!isShare && isLargeText(post.body)} className="cm-post-body" />

      {isShare && (
        <div className="cm-post-shared">
          <SharedEmbed original={post.shared_post} problemTitle={problemTitle(post.shared_post?.problem_id)} onOpen={actions.openOriginal} />
        </div>
      )}

      {(total > 0 || post.comment_count > 0 || shares > 0) && (
        <div className="cm-post-stats">
          {total > 0 ? (
            <button
              type="button"
              className="cm-stat-reactions"
              onClick={() => actions.openReactors('post', post.id, post.reactions)}
              aria-label={`${total} reactions. See who reacted`}
            >
              <ReactionStack counts={post.reactions} />
              <span>{reactionSentence(total, Boolean(post.viewer_reaction))}</span>
            </button>
          ) : (
            <span />
          )}
          <span className="cm-stat-links">
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
          <span>Comment</span>
        </button>
        <Menu label="Share" items={shareMenu} buttonClassName="cm-action" align="end">
          <Share2 size={19} aria-hidden="true" />
          <span>Share</span>
        </Menu>
      </div>

      {commentsOpen && (
        <Comments
          post={post}
          viewer={viewer}
          schema={schema}
          focusSignal={composerSignal}
          focusCommentId={focusCommentId}
          onOpenReactors={actions.openReactors}
          onCountChange={() => actions.refresh(post)}
        />
      )}
    </article>
  );
}
