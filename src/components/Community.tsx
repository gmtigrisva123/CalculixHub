/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Community Solutions: a social feed for problem discussions.
 *
 * Posts can be reacted to, commented on (with threaded replies), edited,
 * deleted, saved and shared -- to the feed, by link, or through the system
 * share sheet. A link to a post or comment opens this screen scrolled to it.
 *
 * Authorization lives in the database (see `services/data/feed.ts`); this
 * screen only decides what to offer, and renders the database's answer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  ArrowUp,
  Bookmark,
  CircleHelp,
  Hash,
  Link2,
  ListFilter,
  MessageCircle,
  MessageSquare,
  PenLine,
  RefreshCw,
  Sigma,
  Sparkles,
  X,
} from 'lucide-react';
import { Problem } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import type { AuthorSummary, PostWithAuthor, Reaction, ReactionCounts, SharedPost } from '../services/database.types';
import {
  createPost,
  deletePost,
  fetchPost,
  setPostReaction,
  toggleSavedPost,
  updatePost,
  usePostFeed,
  type FeedView,
  type MutationResult,
} from '../services/data/feed';
import { useCommunityPresence, type PresentPerson } from '../services/data/live';
import { duration, ease, spring, staggerDelay } from '../lib/motion';
import { Lightbox } from './community/Media';
import type { MentionPerson } from './community/Mentions';
import PostCard, { type PostActions } from './community/PostCard';
import PostComposer from './community/PostComposer';
import { ReactorsDialog } from './community/Reactions';
import SendDialog from './community/SendDialog';
import { FormattingTips, ProblemFilter, TopContributors } from './community/Sidebar';
import { authorName, disambiguateTitles, firstName, holdBackFresh, isUuid, newestCreatedAt, shareLink, shiftReaction } from './community/model';
import { Avatar, ConfirmDialog, Dialog, NowContext, ToastProvider, copyText, nativeShare, useTicker, useToast } from './community/ui';
import '../styles/community.css';

const PAGE = 20;
const HIGHLIGHT_MS = 2600;

const VIEWS: Record<FeedView, string> = {
  all: 'All posts',
  saved: 'Saved',
  mine: 'Your posts',
};

type ComposerState =
  | { mode: 'create'; placeholder?: string; preview?: boolean }
  | { mode: 'edit'; post: PostWithAuthor }
  | { mode: 'share'; original: SharedPost };

interface LinkTarget {
  postId: string;
  commentId: string | null;
}

/** `?post=<id>&comment=<id>` from a shared link, if it is well-formed. */
function readLinkTarget(): LinkTarget | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('post');
  const commentId = params.get('comment');
  return isUuid(postId) ? { postId, commentId: isUuid(commentId) ? commentId : null } : null;
}

/** What a share points at: the original of a share, unless that is gone. */
function originalOf(post: PostWithAuthor): SharedPost {
  return post.shared_post_id && post.shared_post ? post.shared_post : post;
}

function excerpt(text: string, length = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

export default function Community({ problems }: { problems: Problem[] }) {
  return (
    <ToastProvider>
      <CommunityFeed problems={problems} />
    </ToastProvider>
  );
}

function CommunityFeed({ problems }: { problems: Problem[] }) {
  const { user, profile } = useAuth();
  const viewerId = user?.id ?? null;
  const viewer = useMemo<AuthorSummary | null>(() => {
    if (!user) return null;
    return profile
      ? { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, level: profile.level }
      : { id: user.id, username: '', display_name: '', avatar_url: null, level: 'Foundation' };
  }, [user, profile]);

  const now = useTicker();
  const toast = useToast();

  const [problemFilter, setProblemFilter] = useState('All');
  const [view, setView] = useState<FeedView>('all');
  const [limit, setLimit] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const feed = usePostFeed({ problemId: problemFilter, viewerId, view, limit });
  const schema = feed.schema;

  const [overrides, setOverrides] = useState<Record<string, Reaction | null>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [composerSignals, setComposerSignals] = useState<Record<string, number>>({});
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PostWithAuthor | null>(null);
  const [reactors, setReactors] = useState<{ target: 'post' | 'comment'; id: string; counts: ReactionCounts | undefined } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<LinkTarget | null>(readLinkTarget);
  const [focusComment, setFocusComment] = useState<LinkTarget | null>(null);
  const [linked, setLinked] = useState<PostWithAuthor | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<PostWithAuthor | null>(null);
  const [lightbox, setLightbox] = useState<{ paths: string[]; index: number } | null>(null);
  const [baseline, setBaseline] = useState<{ key: string; cutoff: string | null } | null>(null);

  const present = useCommunityPresence(viewer, watching);
  const viewersByPost = useMemo(() => {
    const map = new Map<string, PresentPerson[]>();
    for (const person of present) if (person.post) map.set(person.post, [...(map.get(person.post) ?? []), person]);
    return map;
  }, [present]);

  const inFlight = useRef(new Set<string>());
  const latest = useRef({ posts: feed.data, linked });
  latest.current = { posts: feed.data, linked };
  const feedTop = useRef<HTMLDivElement>(null);

  const titles = useMemo(() => disambiguateTitles(problems), [problems]);
  const problemTitle = useCallback((id: string | null | undefined) => (id ? titles.get(id) ?? null : null), [titles]);

  // A shared link is read once; drop it from the address bar so coming back
  // to this tab later does not jump to the same post again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('post') && !url.searchParams.has('comment')) return;
    url.searchParams.delete('post');
    url.searchParams.delete('comment');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => setLoadingMore(false), [feed.data]);

  const withOverride = useCallback(
    (post: PostWithAuthor): PostWithAuthor => {
      if (!(post.id in overrides)) return post;
      const next = overrides[post.id] ?? null;
      const previous = post.viewer_reaction ?? null;
      return {
        ...post,
        viewer_reaction: next,
        viewer_has_liked: Boolean(next),
        reactions: shiftReaction(post.reactions, previous, next),
        like_count: post.like_count + (next ? 1 : 0) - (previous ? 1 : 0),
      };
    },
    [overrides],
  );

  const posts = useMemo(() => feed.data.map(withOverride), [feed.data, withOverride]);

  // New posts from other people wait behind a "new posts" pill instead of
  // pushing the feed down while it is being read. The baseline is the newest
  // post on screen when this feed (problem, tab, account) first loaded.
  const feedKey = `${problemFilter}:${view}:${viewerId ?? 'guest'}`;
  useEffect(() => {
    if (feed.loading || baseline?.key === feedKey) return;
    setBaseline({ key: feedKey, cutoff: newestCreatedAt(feed.data) ?? new Date().toISOString() });
  }, [feed.loading, feed.data, feedKey, baseline?.key]);
  const { visible, fresh } = holdBackFresh(posts, baseline?.key === feedKey ? baseline.cutoff : null, viewerId);
  const showFresh = () => {
    setBaseline({ key: feedKey, cutoff: newestCreatedAt(feed.data) });
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Everyone around the feed, for @mention suggestions and "Send in Messages".
  const people = useMemo(() => {
    const map = new Map<string, MentionPerson>();
    for (const person of present) map.set(person.id, { id: person.id, username: person.username, display_name: person.name, avatar_url: person.avatar_url });
    for (const post of feed.data) if (post.author && !map.has(post.author.id)) map.set(post.author.id, post.author);
    if (viewerId) map.delete(viewerId);
    return [...map.values()].filter((person) => person.username);
  }, [present, feed.data, viewerId]);
  const linkedPost = linked && !feed.data.some((post) => post.id === linked.id) ? withOverride(linked) : null;

  // Thread counts and contributors come from the unfiltered feed, and are kept
  // while a filter or tab is applied, so the side column does not lose its
  // numbers the moment it is used.
  const unfiltered = problemFilter === 'All' && view === 'all';
  const countsCache = useRef(new Map<string, number>());
  const problemCounts = useMemo(() => {
    if (!unfiltered) return countsCache.current;
    const counts = new Map<string, number>();
    for (const post of feed.data) if (post.problem_id) counts.set(post.problem_id, (counts.get(post.problem_id) ?? 0) + 1);
    countsCache.current = counts;
    return counts;
  }, [feed.data, unfiltered]);

  const contributorsCache = useRef<Array<{ id: string; author: AuthorSummary | null; count: number }>>([]);
  const contributors = useMemo(() => {
    if (!unfiltered) return contributorsCache.current;
    const counts = new Map<string, { id: string; author: AuthorSummary | null; count: number }>();
    for (const post of feed.data) {
      const entry = counts.get(post.author_id) ?? { id: post.author_id, author: post.author, count: 0 };
      entry.count += 1;
      counts.set(post.author_id, entry);
    }
    contributorsCache.current = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    return contributorsCache.current;
  }, [feed.data, unfiltered]);

  const reveal = useCallback((target: LinkTarget) => {
    if (target.commentId) {
      setOpenComments((set) => new Set(set).add(target.postId));
      setFocusComment(target);
      setWatching(target.postId);
    }
    setHighlight(target.postId);
    window.setTimeout(() => document.getElementById(`post-${target.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    window.setTimeout(() => setHighlight((current) => (current === target.postId ? null : current)), HIGHLIGHT_MS);
  }, []);

  // Open a linked post: scroll to it when it is in the feed, fetch it when it
  // is older than the loaded page.
  const focusInFeed = focus ? feed.data.some((post) => post.id === focus.postId) : false;
  useEffect(() => {
    if (!focus || feed.loading) return;
    if (focusInFeed) {
      reveal(focus);
      setFocus(null);
      return;
    }
    let alive = true;
    fetchPost(focus.postId, viewerId)
      .then((post) => {
        if (!alive) return;
        if (post) {
          setLinked(post);
          reveal(focus);
        } else {
          toast('That post is no longer available.', 'error');
        }
        setFocus(null);
      })
      .catch(() => {
        if (!alive) return;
        toast('Could not open that post. Please try again.', 'error');
        setFocus(null);
      });
    return () => {
      alive = false;
    };
  }, [focus, focusInFeed, feed.loading, viewerId, reveal, toast]);

  // Keep a linked post in step with the feed's own refreshes.
  useEffect(() => {
    const current = latest.current.linked;
    if (!current) return;
    let alive = true;
    fetchPost(current.id, viewerId)
      .then((post) => alive && setLinked(post))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [feed.data, viewerId]);

  const refreshLinked = async (postId: string) => {
    if (latest.current.linked?.id === postId) setLinked(await fetchPost(postId, viewerId).catch(() => latest.current.linked));
  };

  const signedIn = (verb: string): AuthorSummary | null => {
    if (!viewer) toast(`Sign in to ${verb}.`, 'error');
    return viewer;
  };

  const actions: PostActions = {
    react: async (post, next) => {
      if (!viewerId || inFlight.current.has(post.id)) return;
      inFlight.current.add(post.id);
      const stored =
        (latest.current.posts.find((row) => row.id === post.id) ?? (latest.current.linked?.id === post.id ? latest.current.linked : null))?.viewer_reaction ?? null;
      setOverrides((map) => ({ ...map, [post.id]: next }));
      const result = await setPostReaction({ postId: post.id, userId: viewerId, current: stored, next, schema });
      await Promise.all([feed.reload(), refreshLinked(post.id)]);
      setOverrides(({ [post.id]: _settled, ...rest }) => rest);
      inFlight.current.delete(post.id);
      if (!result.ok) toast(result.error, 'error');
    },
    edit: (post) => setComposer({ mode: 'edit', post }),
    remove: (post) => setConfirmDelete(post),
    toggleSave: async (post) => {
      const me = signedIn('save posts');
      if (!me) return;
      const saved = Boolean(post.viewer_has_saved);
      const result = await toggleSavedPost({ postId: post.id, userId: me.id, saved });
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      toast(saved ? 'Removed from your saved posts' : 'Post saved. Find it under Saved.');
      await Promise.all([feed.reload(), refreshLinked(post.id)]);
    },
    shareNow: async (post) => {
      const me = signedIn('share posts');
      if (!me) return;
      const original = originalOf(post);
      const result = await createPost({ authorId: me.id, body: '', problemId: original.problem_id, sharedPostId: original.id });
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      toast('Shared to the community feed');
      await feed.reload();
    },
    shareWithThoughts: (post) => {
      if (!signedIn('share posts')) return;
      setComposer({ mode: 'share', original: originalOf(post) });
    },
    copyLink: async (post) => {
      toast((await copyText(shareLink(post.id))) ? 'Link copied to clipboard' : 'Could not copy the link', 'neutral');
    },
    copyText: async (post) => {
      toast((await copyText(post.body)) ? 'Post text copied' : 'Could not copy the text', 'neutral');
    },
    shareVia: async (post) => {
      const outcome = await nativeShare({
        title: `${authorName(post.author)} on CalculixHub`,
        text: excerpt(post.body || post.shared_post?.body || 'A discussion on CalculixHub'),
        url: shareLink(post.id),
      });
      if (outcome === 'failed') toast('Sharing is not available here. Try “Copy link”.', 'error');
    },
    filterProblem: (problemId) => {
      setProblemFilter(problemId);
      setView('all');
      setLimit(PAGE);
      feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    openOriginal: (postId) => {
      if (feed.data.some((post) => post.id === postId)) reveal({ postId, commentId: null });
      else setFocus({ postId, commentId: null });
    },
    openReactors: (target, id, counts) => setReactors({ target, id, counts }),
    toggleComments: (post) => {
      const opening = !openComments.has(post.id);
      setOpenComments((set) => {
        const next = new Set(set);
        if (next.has(post.id)) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setWatching((current) => (opening ? post.id : current === post.id ? null : current));
    },
    refresh: (post) => void Promise.all([feed.reload(), refreshLinked(post.id)]),
    focusComposer: (post) => {
      setOpenComments((set) => new Set(set).add(post.id));
      setComposerSignals((signals) => ({ ...signals, [post.id]: (signals[post.id] ?? 0) + 1 }));
      setWatching(post.id);
    },
    sendInMessages: (post) => {
      if (signedIn('send posts')) setSendTarget(post);
    },
    openMedia: (paths, index) => setLightbox({ paths, index }),
  };

  const openCreate = (options: { placeholder?: string; preview?: boolean } = {}) => {
    if (!viewer) {
      window.location.assign('/?auth=signup');
      return;
    }
    setComposer({ mode: 'create', ...options });
  };

  const submitComposer = async (body: string, problemId: string | null, images: string[]): Promise<MutationResult> => {
    if (!composer || !viewer) return { ok: false, error: 'Sign in to post.' };

    let result: MutationResult;
    if (composer.mode === 'edit') {
      result = await updatePost({
        postId: composer.post.id,
        body,
        problemId,
        isShare: Boolean(composer.post.shared_post_id),
        ...(schema === 'social' ? { images } : {}),
      });
      if (result.ok) toast('Post updated');
      await refreshLinked(composer.post.id);
    } else {
      result = await createPost({
        authorId: viewer.id,
        body,
        problemId,
        sharedPostId: composer.mode === 'share' ? composer.original.id : null,
        images,
      });
      if (result.ok) {
        toast(composer.mode === 'share' ? 'Shared to the community feed' : 'Your post is live');
        setView('all');
        if (problemFilter !== 'All' && problemFilter !== problemId) setProblemFilter('All');
        feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    if (result.ok) await feed.reload();
    return result;
  };

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    const result = await deletePost(confirmDelete.id);
    if (!result.ok) {
      toast(result.error, 'error');
      setConfirmDelete(null);
      return;
    }
    if (linked?.id === confirmDelete.id) setLinked(null);
    setConfirmDelete(null);
    toast('Post deleted');
    await feed.reload();
  };

  const card = (post: PostWithAuthor) => (
    <PostCard
      post={post}
      viewer={viewer}
      schema={schema}
      problemTitle={problemTitle}
      commentsOpen={openComments.has(post.id)}
      composerSignal={composerSignals[post.id] ?? 0}
      focusCommentId={focusComment?.postId === post.id ? focusComment.commentId : null}
      highlighted={highlight === post.id}
      viewers={viewersByPost.get(post.id) ?? []}
      mentionCandidates={people}
      actions={actions}
    />
  );

  const hasMore = feed.data.length >= limit;
  const selectedTitle = problemTitle(problemFilter);
  const initialLoading = feed.loading && feed.data.length === 0;

  return (
    <NowContext.Provider value={now}>
      <div className="cm-root">
        <header className="cm-hero">
          <p className="cm-eyebrow">Mathematical Forum &amp; Discussions</p>
          <h1>
            <MessageSquare size={26} aria-hidden="true" /> Community Solutions
          </h1>
          <p className="cm-lede">Share approaches, ask for a nudge, and react to each other&rsquo;s solutions.</p>
          <AnimatePresence>
            {present.length > 0 && (
              <m.p
                className="cm-online"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
                title={present.map((person) => person.name).join(', ')}
              >
                <span className="cm-live-dot" aria-hidden="true" />
                <span className="cm-online-faces" aria-hidden="true">
                  {present.slice(0, 5).map((person) => (
                    <Avatar key={person.id} author={{ id: person.id, display_name: person.name, username: person.username, avatar_url: person.avatar_url }} size={24} />
                  ))}
                </span>
                {present.length === 1 ? `${present[0]!.name} is here now` : `${present.length} learners are here now`}
              </m.p>
            )}
          </AnimatePresence>
        </header>

        <div className="cm-layout">
          <section className="cm-feed" aria-label="Community feed">
            <div ref={feedTop} className="cm-scroll-anchor" />

            <section className="cm-card cm-prompt" aria-label="Create a post">
              <div className="cm-prompt-row">
                <Avatar author={viewer} size={42} />
                <button type="button" className="cm-prompt-input" onClick={() => openCreate()}>
                  {viewer ? `What’s on your mind, ${firstName(viewer)}?` : 'Sign in to start a discussion'}
                </button>
              </div>
              {viewer && (
                <div className="cm-prompt-actions">
                  <button type="button" onClick={() => openCreate({ placeholder: 'Walk through your solution, step by step…' })}>
                    <Sparkles size={20} className="is-solution" aria-hidden="true" /> Solution
                  </button>
                  <button type="button" onClick={() => openCreate({ placeholder: 'What are you stuck on? Share what you have tried so far…' })}>
                    <CircleHelp size={20} className="is-question" aria-hidden="true" /> Ask for help
                  </button>
                  <button type="button" onClick={() => openCreate({ placeholder: 'Write it in LaTeX, e.g. $a^2 + b^2 = c^2$', preview: true })}>
                    <Sigma size={20} className="is-math" aria-hidden="true" /> Math
                  </button>
                </div>
              )}
            </section>

            <div className="cm-feed-bar">
              {viewer ? (
                <div className="cm-segmented" role="group" aria-label="Show">
                  {(Object.keys(VIEWS) as FeedView[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={view === key}
                      onClick={() => {
                        setView(key);
                        setLimit(PAGE);
                      }}
                    >
                      {view === key && <m.span layoutId="cm-segment" className="cm-segment-pill" transition={spring.snappy} />}
                      <span>{VIEWS[key]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <button type="button" className="cm-filter-button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog">
                <ListFilter size={16} aria-hidden="true" />
                <span>{selectedTitle ?? 'All problems'}</span>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {selectedTitle && (
                <m.div
                  className="cm-active-filter"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                  exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
                >
                  <Hash size={15} aria-hidden="true" />
                  <span>
                    Discussions of <strong>{selectedTitle}</strong>
                  </span>
                  <button type="button" className="cm-icon-button" aria-label="Show all problems" onClick={() => actions.filterProblem('All')}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </m.div>
              )}
            </AnimatePresence>

            {linkedPost && (
              <section className="cm-linked" aria-label="Linked post">
                <div className="cm-linked-bar">
                  <span>
                    <Link2 size={15} aria-hidden="true" /> Linked post
                  </span>
                  <button type="button" className="cm-link-button" onClick={() => setLinked(null)}>
                    Close
                  </button>
                </div>
                {card(linkedPost)}
              </section>
            )}

            {feed.error && (
              <div className="cm-card cm-notice" role="alert">
                <p>{feed.error}</p>
                <button type="button" className="cm-button is-quiet" onClick={() => void feed.reload()}>
                  <RefreshCw size={16} aria-hidden="true" /> Try again
                </button>
              </div>
            )}

            {initialLoading && (
              <div role="status" aria-label="Loading discussions">
                {[0, 1].map((index) => (
                  <div key={index} className="cm-card cm-skeleton" aria-hidden="true">
                    <div className="cm-skeleton-head">
                      <span className="cm-skeleton-avatar" />
                      <span className="cm-skeleton-lines">
                        <i />
                        <i />
                      </span>
                    </div>
                    <i />
                    <i />
                    <i className="is-short" />
                  </div>
                ))}
              </div>
            )}

            {!initialLoading && !feed.error && visible.length === 0 && (
              <div className="cm-card cm-empty">
                <span className="cm-empty-icon">{view === 'saved' ? <Bookmark size={26} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}</span>
                <h2>{view === 'saved' ? 'Nothing saved yet' : view === 'mine' ? 'You haven’t posted yet' : selectedTitle ? 'No discussions of this problem yet' : 'No discussions yet'}</h2>
                <p>
                  {view === 'saved'
                    ? 'Open the ••• menu on any post and choose “Save post” to keep it here.'
                    : 'Share an approach, a question or a neat trick — and start the conversation.'}
                </p>
                {viewer && view !== 'saved' && (
                  <button type="button" className="cm-button is-primary" onClick={() => openCreate()}>
                    <PenLine size={16} aria-hidden="true" /> Create post
                  </button>
                )}
              </div>
            )}

            <AnimatePresence>
              {fresh.length > 0 && (
                <m.div
                  className="cm-fresh-wrap"
                  initial={{ opacity: 0, y: -12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
                  exit={{ opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.exit } }}
                >
                  <button type="button" className="cm-fresh" onClick={showFresh}>
                    <ArrowUp size={16} aria-hidden="true" />
                    <span className="cm-fresh-faces" aria-hidden="true">
                      {[...new Map(fresh.map((post) => [post.author_id, post.author])).values()].slice(0, 3).map((author, index) => (
                        <Avatar key={author?.id ?? index} author={author} size={22} />
                      ))}
                    </span>
                    {fresh.length === 1 ? '1 new post' : `${fresh.length} new posts`}
                  </button>
                </m.div>
              )}
            </AnimatePresence>

            <div className="cm-post-list">
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((post, index) => (
                  <m.div
                    key={post.id}
                    layout="position"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { ...spring.smooth, delay: staggerDelay(index) } }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.exit } }}
                  >
                    {card(post)}
                  </m.div>
                ))}
              </AnimatePresence>
            </div>

            {visible.length > 0 && (
              <div className="cm-feed-end">
                {hasMore ? (
                  <button
                    type="button"
                    className="cm-button is-quiet"
                    disabled={loadingMore}
                    onClick={() => {
                      setLoadingMore(true);
                      setLimit((value) => value + PAGE);
                    }}
                  >
                    {loadingMore ? 'Loading…' : 'See more posts'}
                  </button>
                ) : (
                  <p className="cm-muted">You&rsquo;re all caught up.</p>
                )}
              </div>
            )}
          </section>

          <aside className="cm-side" aria-label="Community overview">
            <section className="cm-card cm-side-card" aria-labelledby="cm-threads">
              <h3 id="cm-threads">
                <Hash size={18} aria-hidden="true" /> Problem threads
              </h3>
              <ProblemFilter problems={problems} counts={problemCounts} selected={problemFilter} onSelect={actions.filterProblem} />
            </section>
            <TopContributors people={contributors} />
            <FormattingTips />
          </aside>
        </div>

        <AnimatePresence>
          {composer && (
            <PostComposer
              key="composer"
              mode={composer.mode}
              author={viewer}
              problems={problems}
              initialBody={composer.mode === 'edit' ? composer.post.body : ''}
              initialProblemId={
                composer.mode === 'edit'
                  ? composer.post.problem_id
                  : composer.mode === 'share'
                    ? composer.original.problem_id
                    : problemFilter === 'All'
                      ? null
                      : problemFilter
              }
              shared={composer.mode === 'share' ? composer.original : composer.mode === 'edit' ? composer.post.shared_post ?? null : null}
              sharing={composer.mode === 'share' || (composer.mode === 'edit' && Boolean(composer.post.shared_post_id))}
              placeholder={composer.mode === 'create' ? composer.placeholder : undefined}
              initialPreview={composer.mode === 'create' && Boolean(composer.preview)}
              initialImages={composer.mode === 'edit' ? composer.post.images ?? [] : []}
              allowImages={schema === 'social'}
              mentionCandidates={people}
              onSubmit={submitComposer}
              onClose={() => setComposer(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmDelete && (
            <ConfirmDialog
              key="confirm-post"
              title="Delete post?"
              message="It will be removed from the feed for everyone, along with its comments. This can’t be undone."
              confirmLabel="Delete"
              onConfirm={confirmRemove}
              onClose={() => setConfirmDelete(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {reactors && <ReactorsDialog key="reactors" target={reactors.target} id={reactors.id} counts={reactors.counts} schema={schema} onClose={() => setReactors(null)} />}
        </AnimatePresence>

        <AnimatePresence>
          {sendTarget && viewer && (
            <SendDialog
              key="send"
              post={sendTarget}
              original={originalOf(sendTarget)}
              viewer={viewer}
              suggestions={people}
              problemTitle={problemTitle(originalOf(sendTarget).problem_id)}
              onClose={() => setSendTarget(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>{lightbox && <Lightbox key="lightbox" paths={lightbox.paths} start={lightbox.index} onClose={() => setLightbox(null)} />}</AnimatePresence>

        <AnimatePresence>
          {filterOpen && (
            <Dialog key="filter" title="Filter by problem" onClose={() => setFilterOpen(false)} size="sm">
              <div className="cm-dialog-body">
                <ProblemFilter
                  problems={problems}
                  counts={problemCounts}
                  selected={problemFilter}
                  autoFocus
                  onSelect={(problemId) => {
                    actions.filterProblem(problemId);
                    setFilterOpen(false);
                  }}
                />
              </div>
            </Dialog>
          )}
        </AnimatePresence>
      </div>
    </NowContext.Provider>
  );
}
