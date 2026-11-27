/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One post in the feed, laid out as a sheet with a margin.
 *
 * The margin holds who wrote it and what readers have pencilled beside it: the
 * marks, each one a button, and the way to leave another. The sheet holds the
 * rest: how the post is filed (its kind, its problem, its circle), what the
 * marks add up to, the text, and one quiet line for comments, reposting and
 * saving. On a phone the margin folds into a row under the text.
 */

import { useEffect, useRef, useState } from 'react';
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
  MessageSquareQuote,
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
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuthorSummary, PostWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import type { FeedSchema } from '../../services/data/feed';
import type { PresentPerson } from '../../services/data/live';
import Comments from './Comments';
import { MediaGrid } from './Media';
import type { MentionPerson } from './Mentions';
import { ExpandableBody, SharedEmbed, Shield, isLargeText, type ShieldReason } from './PostBody';
import { MarkControl } from './Reactions';
import { KIND_META, authorName, firstName, fullTimestamp, parsePost, plural, postAge, quoteLine, totalReactions, verdict, type PostKind } from './model';
import { quoteFromRange } from './selectionQuote';
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
  /** The author says they are unstuck: ask which reply got them there, then resolve. */
  askUnstuck: (post: PostWithAuthor) => void;
  /** Open the circle a post was made in. */
  openCircle: (circleId: string) => void;
  /** A signed-out reader pressed something that needs an account. */
  needAccount: (verb: string) => void;
  /** Start a comment about one line of the post: `line` is the quoted line, ready to type after. */
  quote: (post: PostWithAuthor, line: string) => void;
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
  circleName,
  commentsOpen,
  composerSignal,
  quoteSignal = null,
  focusCommentId,
  highlighted,
  viewers,
  mentionCandidates,
  following,
  shield = null,
  sharedShield = null,
  onSolve,
  onSolveShared,
  actions,
}: {
  post: PostWithAuthor;
  viewer: AuthorSummary | null;
  schema: FeedSchema | null;
  problemTitle: (id: string | null | undefined) => string | null;
  /** The circle the post was made in, when it is one the reader can see. */
  circleName: string | null;
  commentsOpen: boolean;
  composerSignal: number;
  /** A line of this post the reader has just asked to leave a note on. */
  quoteSignal?: { text: string; key: number } | null;
  focusCommentId: string | null;
  highlighted: boolean;
  /** Other people with this post's comments open right now. */
  viewers: PresentPerson[];
  mentionCandidates: MentionPerson[];
  /** Ids the viewer follows. */
  following: ReadonlySet<string>;
  /** Why this post, if it is a solution, stays covered until asked for. Null when it need not be. */
  shield?: ShieldReason | null;
  /** The same, for the post a repost carries. */
  sharedShield?: ShieldReason | null;
  /** Open the post's problem in Learn. */
  onSolve?: () => void;
  onSolveShared?: () => void;
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
  const author = post.author;
  // A repost never has a kind of its own: its words are a note on someone else's post.
  const { kind, resolved, text } = isShare ? { kind: null, resolved: false, text: post.body } : parsePost(post.body);
  const KindIcon = kind === 'stuck' && resolved ? CircleCheck : kind ? KIND_ICON[kind] : null;
  const followed = following.has(post.author_id);
  // Kept for this card once pressed, so the button does not vanish from under the finger or the focus.
  const [followedHere, setFollowedHere] = useState(false);
  // Only a write-up gives the answer away; a question or a trick is safe to read.
  const [revealed, setRevealed] = useState(false);
  const covered = Boolean(shield) && kind === 'solution' && !revealed;
  const summed = covered ? null : verdict(post.reactions, own);
  const nudge = kind === 'stuck' && !resolved;

  // Selecting part of the text offers a note on that line. The offer stands
  // where the selection is, and leaves when the selection does.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ x: number; y: number; line: string } | null>(null);
  const readSelection = () => {
    const selection = window.getSelection();
    const host = bodyRef.current;
    const card = host?.closest('article');
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !host || !card) return setPick(null);
    const range = selection.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) return setPick(null);
    const found = quoteFromRange(range);
    const line = found.text.length >= 3 ? quoteLine(found.text, found.sealed) : '';
    if (!line) return setPick(null);
    const at = range.getBoundingClientRect();
    const frame = card.getBoundingClientRect();
    const x = Math.max(74, Math.min(frame.width - 74, at.left + at.width / 2 - frame.left));
    setPick({ x, y: at.top - frame.top, line });
  };
  const picking = pick !== null;
  useEffect(() => {
    if (!picking) return;
    const onChange = () => {
      if (window.getSelection()?.isCollapsed ?? true) setPick(null);
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [picking]);

  const reveal = () => {
    setRevealed(true);
    // The button that was pressed is gone; keep the keyboard on this post.
    requestAnimationFrame(() => document.getElementById(`post-${post.id}`)?.focus({ preventScroll: true }));
  };

  const menu: MenuEntry[] = [
    ...(own
      ? [
          { key: 'edit', label: 'Edit post', icon: Pencil, onSelect: () => actions.edit(post) },
          ...(kind === 'stuck'
            ? [
                resolved
                  ? { key: 'reopen', label: 'Reopen', description: 'Still stuck: put it back in the queue.', icon: RotateCcw, onSelect: () => actions.setResolved(post, false) }
                  : { key: 'resolve', label: 'Mark as unstuck', description: 'You got there. It leaves the queue.', icon: CircleCheck, onSelect: () => actions.askUnstuck(post) },
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
    ...(total > 0 ? [{ key: 'marks', label: 'See who marked this', icon: Users, onSelect: () => actions.openReactors('post', post.id, post.reactions) }] : []),
    { key: 'link', label: 'Copy link', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(text.trim() ? [{ key: 'text', label: 'Copy text', icon: Copy, onSelect: () => actions.copyText(post) }] : []),
  ];

  // A repost of something inside a closed circle is posted inside it too.
  const reposted = post.shared_post_id && post.shared_post ? post.shared_post : post;
  const staysInside = Boolean(reposted.community_id) && reposted.walled !== false;
  const shareMenu: MenuEntry[] = [
    ...(viewerId && social
      ? [
          { key: 'now', label: 'Repost', description: staysInside ? 'It stays inside this circle, under your name.' : 'It appears in the feed under your name.', icon: Repeat2, onSelect: () => actions.shareNow(post) },
          { key: 'thoughts', label: 'Repost with a note', description: 'Write a line above it first.', icon: SquarePen, onSelect: () => actions.shareWithThoughts(post) },
          { key: 'sep', separator: true as const },
        ]
      : []),
    ...(viewerId
      ? [{ key: 'message', label: 'Send in a message', description: 'To one learner, privately.', icon: Send, onSelect: () => actions.sendInMessages(post) }]
      : []),
    { key: 'link', label: 'Copy link', description: 'Paste it into a chat or an email.', icon: Link2, onSelect: () => actions.copyLink(post) },
    ...(canNativeShare() ? [{ key: 'device', label: 'Share via…', description: 'Messages, mail and other apps.', icon: Share2, onSelect: () => actions.shareVia(post) }] : []),
  ];

  return (
    <article id={`post-${post.id}`} tabIndex={-1} className={`cm-card cm-post ${highlighted ? 'is-highlighted' : ''}`} aria-labelledby={`post-${post.id}-author`}>
      <button type="button" className="cm-post-face" onClick={() => author && actions.openProfile(author)} disabled={!author} aria-label={`About ${authorName(author)}`}>
        <Avatar author={author} size={40} />
      </button>

      <header className="cm-post-header">
        <div className="cm-post-meta">
          <p className="cm-post-author" id={`post-${post.id}-author`}>
            <button type="button" className="cm-post-name" onClick={() => author && actions.openProfile(author)} disabled={!author}>
              {authorName(author)}
            </button>
            {isShare && <span className="cm-muted">reposted</span>}
            {viewerId && !own && author && (!followed || followedHere) && (
              <button
                type="button"
                className={`cm-follow is-inline ${followed ? 'is-on' : ''}`}
                aria-pressed={followed}
                aria-label={followed ? `Following ${authorName(author)}. Unfollow` : `Follow ${authorName(author)}`}
                onClick={() => {
                  setFollowedHere(true);
                  actions.toggleFollow(post.author_id);
                }}
              >
                {followed ? 'Following' : 'Follow'}
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
            {/* Marking a question unstuck rewrites its first line, which the database dates as an edit. It is not one. */}
            {post.edited_at && !(kind === 'stuck' && resolved) && (
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

      <div className="cm-post-marks">
        <MarkControl
          counts={post.reactions}
          current={post.viewer_reaction ?? null}
          max={4}
          onShowAll={() => actions.openReactors('post', post.id, post.reactions)}
          onReact={(next) => (viewerId ? actions.react(post, next) : actions.needAccount('leave a mark'))}
        />
      </div>

      <div className="cm-post-main">
        {(kind || (title && post.problem_id) || circleName) && (
          <p className={`cm-filing ${kind ? `is-${kind}` : ''} ${resolved ? 'is-resolved' : ''}`}>
            {kind && KindIcon && (
              <span className="cm-kind" title={kind === 'stuck' && resolved && post.edited_at ? `Marked unstuck ${fullTimestamp(post.edited_at)}` : undefined}>
                <KindIcon size={14} aria-hidden="true" />
                {kind === 'stuck' && resolved ? 'Unstuck' : KIND_META[kind].label}
                {title && post.problem_id ? (kind === 'solution' ? ' to' : kind === 'stuck' ? ' on' : ' ·') : ''}
              </span>
            )}
            {title && post.problem_id && (
              <button type="button" className="cm-problem-tag" onClick={() => actions.filterProblem(post.problem_id!)} title="Show every post about this problem">
                {title}
              </button>
            )}
            {circleName && post.community_id && (
              <button type="button" className="cm-circle-tag" onClick={() => actions.openCircle(post.community_id!)} title="Open this circle">
                in {circleName}
              </button>
            )}
          </p>
        )}

        {summed && <p className={`cm-verdict is-${summed.tone}`}>{summed.text}</p>}

        {covered ? (
          <Shield reason={shield!} onSolve={onSolve} onReveal={reveal} />
        ) : (
          <>
            <div ref={bodyRef} onMouseUp={() => requestAnimationFrame(readSelection)} onKeyUp={readSelection} onTouchEnd={() => window.setTimeout(readSelection, 60)}>
              <ExpandableBody text={text} large={!isShare && !kind && images.length === 0 && isLargeText(text)} className="cm-post-body" />
            </div>

            {images.length > 0 && (
              <div className="cm-post-media">
                <MediaGrid paths={images} label={authorName(author)} onOpen={(index) => actions.openMedia(images, index)} />
              </div>
            )}

            {isShare && (
              <div className="cm-post-shared">
                <SharedEmbed
                  original={post.shared_post}
                  problemTitle={problemTitle(post.shared_post?.problem_id)}
                  shield={sharedShield}
                  onSolve={onSolveShared}
                  onOpen={actions.openOriginal}
                  onOpenMedia={actions.openMedia}
                />
              </div>
            )}
          </>
        )}
      </div>

      {pick && (
        <button
          type="button"
          className="cm-quote-pick"
          style={{ left: pick.x, top: pick.y }}
          // Pressing it must not clear the selection it is about.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const line = pick.line;
            setPick(null);
            window.getSelection()?.removeAllRanges();
            if (viewerId) actions.quote(post, line);
            else actions.needAccount('comment');
          }}
        >
          <MessageSquareQuote size={14} aria-hidden="true" /> Note on this line
        </button>
      )}

      <footer className="cm-post-foot">
        {covered ? (
          <span className="cm-foot-note">{post.comment_count > 0 ? plural(post.comment_count, 'comment') : 'No comments yet'}</span>
        ) : (
          <button
            type="button"
            className="cm-foot-button"
            aria-expanded={commentsOpen}
            onClick={() => (post.comment_count > 0 && !commentsOpen ? actions.toggleComments(post) : actions.focusComposer(post))}
          >
            <MessageCircle size={17} aria-hidden="true" />
            <span>{post.comment_count > 0 ? plural(post.comment_count, 'comment') : nudge && !own ? 'Give a nudge' : 'Comment'}</span>
          </button>
        )}
        {viewers.length > 0 && (
          <span className="cm-viewing" title={`${viewers.map((person) => person.name).join(', ')} ${viewers.length === 1 ? 'is' : 'are'} reading the comments`}>
            <span className="cm-live-dot" aria-hidden="true" />
            <span className="cm-viewing-faces" aria-hidden="true">
              {viewers.slice(0, 3).map((person) => (
                <Avatar key={person.id} author={{ id: person.id, display_name: person.name, username: person.username, avatar_url: person.avatar_url }} size={18} />
              ))}
            </span>
            <span className="sr-only">{viewers.length === 1 ? `${viewers[0]!.name} is` : `${viewers.length} people are`} reading the comments now</span>
            <span aria-hidden="true">{viewers.length} reading</span>
          </span>
        )}
        {shares > 0 && <span className="cm-foot-note">{plural(shares, 'repost')}</span>}

        <span className="cm-foot-end">
          <Menu label="Share" items={shareMenu} buttonClassName="cm-foot-button" align="end">
            <Share2 size={17} aria-hidden="true" />
            <span>Share</span>
          </Menu>
          <button
            type="button"
            className={`cm-foot-button is-icon ${post.viewer_has_saved ? 'is-saved' : ''}`}
            aria-pressed={Boolean(post.viewer_has_saved)}
            aria-label={post.viewer_has_saved ? 'Saved. Remove from your saved posts' : 'Save this post'}
            title={post.viewer_has_saved ? 'Saved' : 'Save'}
            onClick={() => (viewerId ? actions.toggleSave(post) : actions.needAccount('save posts'))}
          >
            {post.viewer_has_saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
          </button>
        </span>
      </footer>

      {commentsOpen && !covered && (
        <Comments
          post={post}
          viewer={viewer}
          schema={schema}
          focusSignal={composerSignal}
          quoteSignal={quoteSignal}
          focusCommentId={focusCommentId}
          nudge={nudge}
          creditFrom={kind === 'stuck' && resolved ? post.author_id : null}
          canCredit={own && kind === 'stuck'}
          onCredited={() => {
            if (!resolved) actions.setResolved(post, true);
          }}
          onOpenReactors={actions.openReactors}
          onOpenProfile={actions.openProfile}
          onNeedAccount={actions.needAccount}
          onCountChange={() => actions.refresh(post)}
          mentionCandidates={mentionCandidates}
          onOpenMedia={actions.openMedia}
        />
      )}
    </article>
  );
}
