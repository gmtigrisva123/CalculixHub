/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Community: where learners write up solutions, ask for a nudge, and pencil
 * marks in the margin of each other's work.
 *
 * The page opens on today's board (one problem, the same for everyone) and
 * runs into the feed. A post has a kind (solution, stuck, trick, challenge),
 * may carry technique tags and sealed hints, may be filed in a circle, and can
 * be marked, commented on (with threaded replies), edited, deleted, saved and
 * reposted, or sent on by link or through the system share sheet. People can
 * be followed, and a link to a post or comment opens this screen scrolled to
 * it.
 *
 * Authorization lives in the database (see `services/data/feed.ts`); this
 * screen only decides what to offer, and renders the database's answer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowUp, Link2, ListFilter, PenLine, RefreshCw, X } from 'lucide-react';
import { Problem } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import type { AuthorSummary, PostWithAuthor, Reaction, ReactionCounts, SharedPost } from '../services/database.types';
import {
  CREDIT_MARK,
  createPost,
  deletePost,
  fetchPost,
  setCommentReaction,
  setPostReaction,
  toggleSavedPost,
  updatePost,
  usePostFeed,
  type FeedSort,
  type FeedView,
  type MutationResult,
} from '../services/data/feed';
import { createCircle, setCircleMembership, useCircles } from '../services/data/circles';
import { useFollowing } from '../services/data/people';
import { useCommunityPresence, type PresentPerson } from '../services/data/live';
import { duration, ease, spring, staggerDelay } from '../lib/motion';
import { CircleHeader, CircleList, StartCircleDialog } from './community/Circles';
import { Lightbox } from './community/Media';
import type { MentionPerson } from './community/Mentions';
import type { ShieldReason } from './community/PostBody';
import PostCard, { KIND_ICON, type PostActions } from './community/PostCard';
import PostComposer from './community/PostComposer';
import ProfilePeek from './community/ProfilePeek';
import { ReactorsDialog } from './community/Reactions';
import { TagActionContext } from './community/RichText';
import SendDialog from './community/SendDialog';
import { Helpers, MarginKey, ProblemFilter, Techniques } from './community/Sidebar';
import TodayBoard from './community/TodayBoard';
import UnstuckDialog from './community/UnstuckDialog';
import {
  KIND_META,
  POST_KINDS,
  authorName,
  boardDay,
  boardProblem,
  composePost,
  disambiguateTitles,
  extractTags,
  firstName,
  holdBackFresh,
  isKind,
  isUuid,
  kindPattern,
  newestCreatedAt,
  parsePost,
  plural,
  rankHelpers,
  redactSealed,
  shareLink,
  shiftReaction,
  tallyTags,
  type Helper,
  type PostKind,
} from './community/model';
import { Avatar, ConfirmDialog, Dialog, NowContext, ToastProvider, copyText, nativeShare, useTicker, useToast } from './community/ui';
import '../styles/community.css';

const PAGE = 20;
/** How far the feed reads ahead on its own when a filter leaves a whole page empty. */
const AUTO_PAGE_LIMIT = 200;
const HIGHLIGHT_MS = 2600;
const DAY_MS = 86_400_000;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

const VIEWS: Record<FeedView, string> = {
  all: 'Everyone',
  following: 'Following',
  saved: 'Saved',
  mine: 'Yours',
};

const SORTS: Record<FeedSort, string> = {
  latest: 'Latest',
  top: 'Top this week',
};

type ComposerState =
  | { mode: 'create'; kind?: PostKind | null; problemId?: string | null; circleId?: string | null }
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

interface CommunityProps {
  problems: Problem[];
  /**
   * Problems the viewer has solved, so a solution to one they have not is kept
   * under a shield. Absent while that is not known (the record is loading, could
   * not be read, or nobody is signed in), and then every solution stays covered.
   */
  solvedIds?: readonly string[];
  /** Open a problem in Learn. Absent where there is nowhere to send the learner. */
  onSolveProblem?: (problem: Problem) => void;
}

export default function Community(props: CommunityProps) {
  return (
    <ToastProvider>
      <CommunityFeed {...props} />
    </ToastProvider>
  );
}

function CommunityFeed({ problems, solvedIds, onSolveProblem }: CommunityProps) {
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
  const [kindFilter, setKindFilter] = useState<PostKind | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<AuthorSummary | null>(null);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [sort, setSort] = useState<FeedSort>('latest');
  const [limit, setLimit] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const feed = usePostFeed({
    problemId: problemFilter,
    viewerId,
    view,
    startsWith: kindFilter ? kindPattern(kindFilter) : null,
    tag: tagFilter,
    authorId: authorFilter?.id ?? null,
    circleId,
    sort,
    limit,
  });
  const schema = feed.schema;
  const following = useFollowing(viewerId);
  const circles = useCircles(viewerId);
  const circle = circleId ? circles.data.find((entry) => entry.id === circleId) ?? null : null;
  const inCircle = Boolean(circle && circles.joined.has(circle.id));
  const circleNames = useMemo(() => new Map(circles.data.map((entry) => [entry.id, entry.name])), [circles.data]);
  const joinedCircles = useMemo(() => circles.data.filter((entry) => circles.joined.has(entry.id)), [circles.data, circles.joined]);
  const solved = useMemo(() => new Set(solvedIds ?? []), [solvedIds]);
  const solvedKnown = solvedIds !== undefined;

  const [overrides, setOverrides] = useState<Record<string, Reaction | null>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [composerSignals, setComposerSignals] = useState<Record<string, number>>({});
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PostWithAuthor | null>(null);
  const [reactors, setReactors] = useState<{ target: 'post' | 'comment'; id: string; counts: ReactionCounts | undefined } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [startingCircle, setStartingCircle] = useState(false);
  const [circleBusy, setCircleBusy] = useState(false);
  const [unstuck, setUnstuck] = useState<PostWithAuthor | null>(null);
  const [peek, setPeek] = useState<AuthorSummary | null>(null);
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

  // A circle that has gone (removed, or no longer visible) is not a place to stay.
  useEffect(() => {
    if (circleId && !circles.loading && !circles.error && !circles.data.some((entry) => entry.id === circleId)) setCircleId(null);
  }, [circleId, circles.loading, circles.error, circles.data]);

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

  // The database narrows by text, so "#parity" also finds "#parity-check" and
  // "#stuck%" also finds a sentence that starts that way; the exact ones are
  // kept here. A repost has no kind, whatever its note begins with.
  const posts = useMemo(
    () =>
      feed.data
        .filter(
          (post) =>
            (!tagFilter || extractTags(post.body).includes(tagFilter)) && (!kindFilter || (!post.shared_post_id && isKind(post.body, kindFilter))),
        )
        .map(withOverride),
    [feed.data, withOverride, tagFilter, kindFilter],
  );

  // New posts from other people wait behind a "new posts" pill instead of
  // pushing the feed down while it is being read. The baseline is the newest
  // post on screen when this feed (problem, tab, account) first loaded.
  const feedKey = `${problemFilter}:${view}:${kindFilter ?? ''}:${tagFilter ?? ''}:${authorFilter?.id ?? ''}:${circleId ?? ''}:${sort}:${viewerId ?? 'guest'}`;
  useEffect(() => {
    if (feed.loading || baseline?.key === feedKey) return;
    setBaseline({ key: feedKey, cutoff: newestCreatedAt(feed.data) ?? new Date().toISOString() });
  }, [feed.loading, feed.data, feedKey, baseline?.key]);
  // Only where the newest is on top: a page ordered by marks, or by when
  // something was saved, has newer posts all through it, and none of them is news.
  const holdable = sort === 'latest' && view !== 'saved';
  const { visible, fresh } = holdBackFresh(posts, holdable && baseline?.key === feedKey ? baseline.cutoff : null, viewerId);
  const showFresh = () => {
    setBaseline({ key: feedKey, cutoff: newestCreatedAt(feed.data) });
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Everyone around the feed, for @mention suggestions and "Send in a message".
  const people = useMemo(() => {
    const map = new Map<string, MentionPerson>();
    for (const person of present) map.set(person.id, { id: person.id, username: person.username, display_name: person.name, avatar_url: person.avatar_url });
    for (const post of feed.data) if (post.author && !map.has(post.author.id)) map.set(post.author.id, post.author);
    if (viewerId) map.delete(viewerId);
    return [...map.values()].filter((person) => person.username);
  }, [present, feed.data, viewerId]);
  const linkedPost = linked && !feed.data.some((post) => post.id === linked.id) ? withOverride(linked) : null;

  // Thread counts, techniques and helpers come from the unfiltered feed, and are
  // kept while a filter or tab is applied, so the side column does not lose
  // its numbers the moment it is used.
  const unfiltered = problemFilter === 'All' && view === 'all' && !kindFilter && !tagFilter && !authorFilter && !circleId && sort === 'latest';
  const countsCache = useRef(new Map<string, number>());
  const problemCounts = useMemo(() => {
    if (!unfiltered) return countsCache.current;
    const counts = new Map<string, number>();
    for (const post of feed.data) if (post.problem_id) counts.set(post.problem_id, (counts.get(post.problem_id) ?? 0) + 1);
    countsCache.current = counts;
    return counts;
  }, [feed.data, unfiltered]);

  const helpersCache = useRef<Array<Helper<AuthorSummary>>>([]);
  const helpers = useMemo(() => {
    if (unfiltered) helpersCache.current = rankHelpers(feed.data);
    return helpersCache.current;
  }, [feed.data, unfiltered]);

  const tagsCache = useRef<Array<{ tag: string; count: number }>>([]);
  const tags = useMemo(() => {
    if (unfiltered) tagsCache.current = tallyTags(feed.data.map((post) => post.body), 12);
    return tagsCache.current;
  }, [feed.data, unfiltered]);

  // One problem a day, the same for everyone; recomputed only when the day turns.
  const today = boardDay(now);
  const board = useMemo(() => boardProblem(problems, today * DAY_MS), [problems, today]);
  const boardBefore = useMemo(() => {
    const previous = boardProblem(problems, (today - 1) * DAY_MS);
    return previous && previous.id !== board?.id ? previous : null;
  }, [problems, today, board]);

  const toTop = () => feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const narrow = (apply: () => void) => {
    apply();
    setLimit(PAGE);
    toTop();
  };
  const filterTag = useCallback((tag: string | null) => {
    setTagFilter(tag);
    setLimit(PAGE);
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  const solveHandler = (problemId: string | null | undefined) => {
    const problem = onSolveProblem && problemId ? problems.find((entry) => entry.id === problemId) : undefined;
    return problem ? () => onSolveProblem!(problem) : undefined;
  };

  // The shield fails closed. A write-up of a problem stays covered unless the
  // reader wrote it or is known to have solved the problem; "not known" covers
  // a record still loading, one that could not be read, and a signed-out reader.
  const shieldFor = (post: { problem_id: string | null; author_id: string } | null | undefined): ShieldReason | null => {
    if (!post?.problem_id || post.author_id === viewerId) return null;
    if (!solvedKnown) return 'unknown';
    return solved.has(post.problem_id) ? null : 'unsolved';
  };

  const openCircle = (id: string | null) =>
    narrow(() => {
      setCircleId(id);
      setFilterOpen(false);
      if (id) {
        setView('all');
        setProblemFilter('All');
        setTagFilter(null);
        setAuthorFilter(null);
        setKindFilter(null);
      }
    });

  const toggleCircle = async () => {
    const me = signedIn('join a circle');
    if (!me || !circle || circleBusy) return;
    const leaving = circles.joined.has(circle.id);
    setCircleBusy(true);
    const result = await setCircleMembership({ circleId: circle.id, userId: me.id, joined: leaving });
    setCircleBusy(false);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast(leaving ? `You left ${circle.name}.` : `You joined ${circle.name}. New posts can be filed in it.`, 'neutral');
    await circles.reload();
  };

  const resolve = async (post: PostWithAuthor, resolved: boolean) => {
    const { text } = parsePost(post.body);
    const result = await updatePost({ postId: post.id, body: composePost(text, 'stuck', resolved) });
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast(resolved ? 'Marked as unstuck. It has left the queue.' : 'Reopened. It is back in the queue.');
    await Promise.all([feed.reload(), refreshLinked(post.id)]);
  };

  const actions: PostActions = {
    react: async (post, next) => {
      if (!signedIn('leave a mark') || !viewerId || inFlight.current.has(post.id)) return;
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
      toast(saved ? 'Removed from Saved.' : 'Saved. It is under Saved.');
      await Promise.all([feed.reload(), refreshLinked(post.id)]);
    },
    shareNow: async (post) => {
      const me = signedIn('repost');
      if (!me) return;
      const original = originalOf(post);
      const result = await createPost({ authorId: me.id, body: '', problemId: original.problem_id, sharedPostId: original.id });
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      toast('Reposted.');
      await feed.reload();
    },
    shareWithThoughts: (post) => {
      if (!signedIn('repost')) return;
      setComposer({ mode: 'share', original: originalOf(post) });
    },
    copyLink: async (post) => {
      toast((await copyText(shareLink(post.id))) ? 'Link copied.' : 'Could not copy the link.', 'neutral');
    },
    copyText: async (post) => {
      // The words as written, without the line that files the post.
      const text = post.shared_post_id ? post.body : parsePost(post.body).text;
      toast((await copyText(text)) ? 'Text copied.' : 'Could not copy the text.', 'neutral');
    },
    shareVia: async (post) => {
      // What leaves the page is the open text only: a sealed hint or hidden word stays sealed.
      const quote = (body: string | null | undefined, isShare = false) => redactSealed(isShare ? body ?? '' : parsePost(body ?? '').text);
      const outcome = await nativeShare({
        title: `${authorName(post.author)} on CalculixHub`,
        text: excerpt(quote(post.body, Boolean(post.shared_post_id)) || quote(post.shared_post?.body) || 'A discussion on CalculixHub'),
        url: shareLink(post.id),
      });
      if (outcome === 'failed') toast('Sharing is not available here. Use “Copy link”.', 'error');
    },
    filterProblem: (problemId) =>
      narrow(() => {
        setProblemFilter(problemId);
        setView('all');
        setFilterOpen(false);
      }),
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
    openProfile: (author) => setPeek(author),
    toggleFollow: async (authorId) => {
      if (!signedIn('follow people')) return;
      const result = await following.toggle(authorId);
      if (!result.ok) {
        toast(result.error ?? 'Could not update that follow.', 'error');
        return;
      }
      toast(result.following ? 'Following. Their posts are under Following.' : 'Unfollowed.', 'neutral');
      // The live channel usually brings this in; when it does not, the list would be stale.
      if (view === 'following') void feed.reload();
    },
    filterAuthor: (author) =>
      narrow(() => {
        setAuthorFilter(author);
        setView('all');
      }),
    setResolved: (post, resolved) => void resolve(post, resolved),
    askUnstuck: (post) => {
      // Crediting a reply is the asker's "Helped" mark on it, which only the newer schema stores.
      if (schema === 'social' && post.comment_count > 0) setUnstuck(post);
      else void resolve(post, true);
    },
    openCircle: (id) => openCircle(id),
    needAccount: (verb) => void signedIn(verb),
  };

  const openCreate = (options: { kind?: PostKind | null; problemId?: string | null } = {}) => {
    if (!viewer) {
      window.location.assign('/?auth=signup');
      return;
    }
    setComposer({ mode: 'create', ...options, circleId: inCircle ? circleId : null });
  };

  const submitComposer = async (body: string, problemId: string | null, images: string[], postedIn: string | null): Promise<MutationResult> => {
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
      if (result.ok) toast('Saved.');
      await refreshLinked(composer.post.id);
    } else {
      result = await createPost({
        authorId: viewer.id,
        body,
        problemId,
        communityId: composer.mode === 'create' ? postedIn : null,
        sharedPostId: composer.mode === 'share' ? composer.original.id : null,
        images,
      });
      if (result.ok) {
        toast(composer.mode === 'share' ? 'Reposted.' : 'Posted.');
        // Show the new post: drop whatever narrowing would hide it.
        setView('all');
        setSort('latest');
        setTagFilter(null);
        setAuthorFilter(null);
        if (kindFilter && (composer.mode === 'share' || kindFilter !== parsePost(body).kind)) setKindFilter(null);
        if (problemFilter !== 'All' && problemFilter !== problemId) setProblemFilter('All');
        if (circleId && circleId !== postedIn) setCircleId(null);
        toTop();
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
    toast('Post deleted.');
    await feed.reload();
  };

  const startCircle = async (name: string, about: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!viewer) return { ok: false, error: 'Sign in to start a circle.' };
    const result = await createCircle({ ownerId: viewer.id, name, about });
    if (!result.ok) return result;
    await circles.reload();
    openCircle(result.circle.id);
    toast(`${result.circle.name} is open. Anyone can join it.`);
    return { ok: true };
  };

  // Keyed by post, so what one card holds (a lifted cover, opened hints, a
  // half-written comment) never carries over to another shown in its place.
  const card = (post: PostWithAuthor) => (
    <PostCard
      key={post.id}
      post={post}
      viewer={viewer}
      schema={schema}
      problemTitle={problemTitle}
      circleName={post.community_id && post.community_id !== circleId ? circleNames.get(post.community_id) ?? null : null}
      commentsOpen={openComments.has(post.id)}
      composerSignal={composerSignals[post.id] ?? 0}
      focusCommentId={focusComment?.postId === post.id ? focusComment.commentId : null}
      highlighted={highlight === post.id}
      viewers={viewersByPost.get(post.id) ?? []}
      mentionCandidates={people}
      following={following.ids}
      shield={shieldFor(post)}
      sharedShield={shieldFor(post.shared_post)}
      onSolve={solveHandler(post.problem_id)}
      onSolveShared={solveHandler(post.shared_post?.problem_id)}
      actions={actions}
    />
  );

  const hasMore = feed.data.length >= limit;
  const selectedTitle = problemTitle(problemFilter);
  const initialLoading = feed.loading && feed.data.length === 0;
  const narrowed = [selectedTitle, tagFilter, authorFilter].filter(Boolean).length;
  const clearNarrowing = () =>
    narrow(() => {
      setProblemFilter('All');
      setTagFilter(null);
      setAuthorFilter(null);
    });
  const clearEverything = () =>
    narrow(() => {
      setProblemFilter('All');
      setTagFilter(null);
      setAuthorFilter(null);
      setKindFilter(null);
      setView('all');
    });

  // The exact filter runs here, on what the database returned for a looser
  // one, so a full page can come back with nothing in it while later pages do
  // hold a match. Read on, within reason, before saying there is nothing.
  useEffect(() => {
    if (posts.length === 0 && hasMore && !feed.loading && !feed.error && limit < AUTO_PAGE_LIMIT) setLimit((value) => value + PAGE);
  }, [posts.length, hasMore, feed.loading, feed.error, limit]);
  const readingOn = posts.length === 0 && hasMore && !feed.error && limit < AUTO_PAGE_LIMIT;

  const filtersOn = [view !== 'all', Boolean(kindFilter), Boolean(tagFilter), Boolean(authorFilter), Boolean(selectedTitle)].filter(Boolean).length;
  const empty: { title: string; text: string; reset?: boolean; write?: boolean } = (() => {
    if (filtersOn > 1) return { title: 'Nothing matches all of these', text: 'Remove a filter to see more.', reset: true };
    if (kindFilter === 'stuck') return { title: 'Nobody is waiting for a nudge', text: 'Every open question here has been answered. Ask one of your own.', write: true };
    if (kindFilter) return { title: `No ${KIND_META[kindFilter].plural.toLocaleLowerCase()} here yet`, text: 'The first one could be yours.', write: true };
    if (tagFilter) return { title: `Nothing tagged #${tagFilter} yet`, text: 'Add the tag to a post and it is found here.', write: true };
    if (selectedTitle) return { title: 'Nobody has written about this problem yet', text: 'Post your approach, or ask about the step that stops you.', write: true };
    if (authorFilter) return { title: `${firstName(authorFilter)} has not posted yet`, text: 'Their posts will appear here.' };
    if (view === 'saved') return { title: 'Nothing saved yet', text: 'Use the bookmark on any post to keep it here.' };
    if (view === 'following') {
      return following.ids.size === 0
        ? { title: 'You are not following anyone yet', text: 'Follow someone from their post or from “Helping lately”, and what they write is collected here.' }
        : { title: 'Nothing new from the people you follow', text: 'Their next post will appear here.' };
    }
    if (view === 'mine') return { title: 'You have not posted yet', text: 'Write up a solution, or ask for a nudge on a problem you are stuck on.', write: true };
    if (circle) {
      return inCircle
        ? { title: `Nothing in ${circle.name} yet`, text: 'The first post in a circle sets its tone.', write: true }
        : { title: `Nothing in ${circle.name} yet`, text: viewer ? 'Join the circle to write its first post.' : 'Sign in and join the circle to write its first post.' };
    }
    return { title: 'No posts yet', text: 'Write up a solution, share a trick, or ask for a nudge.', write: true };
  })();
  const canWrite = !circle || inCircle;

  // Shown twice: in the side column, and in the Browse sheet that replaces it on
  // narrower screens. Each copy gets its own ids.
  const browse = (prefix: string) => (
    <>
      <Techniques idPrefix={prefix} tags={tags} selected={tagFilter} onSelect={(tag) => { filterTag(tag); setFilterOpen(false); }} />
      <section className="cm-side-card" aria-labelledby={`${prefix}-threads`}>
        <h3 id={`${prefix}-threads`}>Problem threads</h3>
        <ProblemFilter problems={problems} counts={problemCounts} selected={problemFilter} onSelect={actions.filterProblem} />
      </section>
      <CircleList
        idPrefix={prefix}
        circles={circles.data}
        joined={circles.joined}
        selected={circleId}
        loading={circles.loading}
        error={circles.error}
        canStart={Boolean(viewer)}
        onSelect={(entry) => openCircle(entry?.id ?? null)}
        onStart={() => { setFilterOpen(false); setStartingCircle(true); }}
      />
      <Helpers
        idPrefix={prefix}
        people={helpers}
        viewerId={viewerId}
        following={following.ids}
        onToggleFollow={actions.toggleFollow}
        onOpen={(author) => { setFilterOpen(false); actions.openProfile(author); }}
      />
    </>
  );

  return (
    <NowContext.Provider value={now}>
      <TagActionContext.Provider value={filterTag}>
        <div className="cm-root">
          <h1 className="sr-only">Community</h1>

          {board && (
            <TodayBoard
              problem={board}
              yesterday={boardBefore}
              solved={solvedKnown && solved.has(board.id)}
              signedIn={Boolean(viewer)}
              refreshKey={`${feed.data.length}:${newestCreatedAt(feed.data) ?? ''}`}
              onSolve={onSolveProblem}
              onOpenThread={actions.filterProblem}
              onOpenYesterday={(problemId) =>
                narrow(() => {
                  setProblemFilter(problemId);
                  setView('all');
                  setKindFilter(null);
                  setSort('top');
                })
              }
              onWrite={(problem) => openCreate({ kind: 'solution', problemId: problem.id })}
              onStuck={(problem) => openCreate({ kind: 'stuck', problemId: problem.id })}
            />
          )}

          <div className="cm-layout">
            <section className="cm-feed" aria-label="Community feed">
              <div ref={feedTop} className="cm-scroll-anchor" />

              {circle && (
                <CircleHeader circle={circle} isMember={inCircle} canJoin={Boolean(viewer)} busy={circleBusy} onToggle={() => void toggleCircle()} onClose={() => openCircle(null)} />
              )}

              {canWrite && (
                <section className="cm-write" aria-label="Write a post">
                  {viewer ? (
                    <>
                      <div className="cm-write-kinds">
                        {POST_KINDS.map((kind) => {
                          const Icon = KIND_ICON[kind];
                          return (
                            <button key={kind} type="button" className={`cm-write-kind is-${kind}`} onClick={() => openCreate({ kind })} title={KIND_META[kind].blurb}>
                              <Icon size={17} aria-hidden="true" />
                              <span>{KIND_META[kind].action}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button type="button" className="cm-write-any" onClick={() => openCreate()}>
                        <PenLine size={17} aria-hidden="true" />
                        <span>Write a post</span>
                      </button>
                    </>
                  ) : (
                    <button type="button" className="cm-write-any is-guest" onClick={() => openCreate()}>
                      <PenLine size={17} aria-hidden="true" />
                      <span>Sign in to post</span>
                    </button>
                  )}
                </section>
              )}

              <div className="cm-feed-bar">
                {viewer && (
                  <div className="cm-segmented" role="group" aria-label="Whose posts">
                    {(Object.keys(VIEWS) as FeedView[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={view === key}
                        onClick={() =>
                          narrow(() => {
                            setView(key);
                            // "By someone" inside Yours or Following can only be empty.
                            if (key !== 'all') setAuthorFilter(null);
                          })
                        }
                      >
                        {view === key && <m.span layoutId="cm-segment" className="cm-segment-pill" transition={spring.snappy} />}
                        <span>{VIEWS[key]}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="cm-feed-tools">
                  <div className="cm-sort" role="group" aria-label="Order">
                    {(Object.keys(SORTS) as FeedSort[]).map((key) => (
                      <button key={key} type="button" aria-pressed={sort === key} onClick={() => narrow(() => setSort(key))} title={key === 'top' ? 'The posts that drew the most marks in the last seven days' : 'Newest first'}>
                        {SORTS[key]}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="cm-filter-button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog">
                    <ListFilter size={16} aria-hidden="true" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              <div className="cm-kind-bar" role="group" aria-label="Kind of post">
                <button type="button" className="cm-kind-chip" aria-pressed={!kindFilter} onClick={() => narrow(() => setKindFilter(null))}>
                  All kinds
                </button>
                {POST_KINDS.map((kind) => {
                  const Icon = KIND_ICON[kind];
                  return (
                    <button key={kind} type="button" className={`cm-kind-chip is-${kind}`} aria-pressed={kindFilter === kind} onClick={() => narrow(() => setKindFilter(kindFilter === kind ? null : kind))}>
                      <Icon size={14} aria-hidden="true" />
                      {KIND_META[kind].plural}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
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
                        <Avatar key={person.id} author={{ id: person.id, display_name: person.name, username: person.username, avatar_url: person.avatar_url }} size={22} />
                      ))}
                    </span>
                    {present.length === 1 ? `${present[0]!.name} is here now` : `${present.length} learners are here now`}
                  </m.p>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {narrowed > 0 && (
                  <m.div
                    className="cm-active-filter"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, transition: spring.snappy }}
                    exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
                  >
                    <span className="cm-active-list">
                      {selectedTitle && (
                        <button type="button" onClick={() => narrow(() => setProblemFilter('All'))} aria-label={`Showing posts about ${selectedTitle}. Clear`}>
                          {selectedTitle} <X size={14} aria-hidden="true" />
                        </button>
                      )}
                      {tagFilter && (
                        <button type="button" onClick={() => filterTag(null)} aria-label={`Showing posts tagged ${tagFilter}. Clear`}>
                          #{tagFilter} <X size={14} aria-hidden="true" />
                        </button>
                      )}
                      {authorFilter && (
                        <button type="button" onClick={() => narrow(() => setAuthorFilter(null))} aria-label={`Showing posts by ${authorName(authorFilter)}. Clear`}>
                          By {authorName(authorFilter)} <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                    {narrowed > 1 && (
                      <button type="button" className="cm-link-button" onClick={clearNarrowing}>
                        Clear all
                      </button>
                    )}
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
                  <p>{feed.error === GENERIC_ERROR ? 'The feed could not be loaded. Check your connection and try again.' : feed.error}</p>
                  <button type="button" className="cm-button is-quiet" onClick={() => void feed.reload()}>
                    <RefreshCw size={16} aria-hidden="true" /> Try again
                  </button>
                </div>
              )}

              {(initialLoading || (readingOn && visible.length === 0)) && (
                <div role="status" aria-label="Loading posts">
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

              {!initialLoading && !readingOn && !feed.error && visible.length === 0 && fresh.length === 0 && (
                <div className="cm-empty">
                  <h2>{empty.title}</h2>
                  <p>{empty.text}</p>
                  {empty.reset ? (
                    <button type="button" className="cm-button is-quiet" onClick={clearEverything}>
                      Clear filters
                    </button>
                  ) : (
                    empty.write &&
                    viewer &&
                    canWrite && (
                      <button type="button" className="cm-button is-primary" onClick={() => openCreate({ kind: kindFilter, problemId: problemFilter === 'All' ? null : problemFilter })}>
                        <PenLine size={16} aria-hidden="true" /> {kindFilter ? KIND_META[kindFilter].action : 'Write a post'}
                      </button>
                    )
                  )}
                </div>
              )}

              <AnimatePresence>
                {fresh.length > 0 && (
                  <m.div
                    className="cm-fresh-wrap"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } }}
                    exit={{ opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.exit } }}
                  >
                    <button type="button" className="cm-fresh" onClick={showFresh}>
                      <ArrowUp size={16} aria-hidden="true" />
                      <span className="cm-fresh-faces" aria-hidden="true">
                        {[...new Map(fresh.map((post) => [post.author_id, post.author])).values()].slice(0, 3).map((author, index) => (
                          <Avatar key={author?.id ?? index} author={author} size={22} />
                        ))}
                      </span>
                      {plural(fresh.length, 'new post')}
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
                      exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.exit } }}
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
                      {loadingMore ? 'Loading…' : `Load ${PAGE} more`}
                    </button>
                  ) : (
                    <p className="cm-muted">That is everything{sort === 'top' ? ' from this week' : ''}.</p>
                  )}
                </div>
              )}
            </section>

            <aside className="cm-side" aria-label="Browse the community">
              {browse('cm-side')}
              <MarginKey idPrefix="cm-side" />
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
                initialKind={composer.mode === 'create' ? composer.kind ?? null : null}
                initialProblemId={
                  composer.mode === 'edit'
                    ? composer.post.problem_id
                    : composer.mode === 'share'
                      ? composer.original.problem_id
                      : composer.problemId !== undefined
                        ? composer.problemId
                        : problemFilter === 'All'
                          ? null
                          : problemFilter
                }
                shared={composer.mode === 'share' ? composer.original : composer.mode === 'edit' ? composer.post.shared_post ?? null : null}
                sharing={composer.mode === 'share' || (composer.mode === 'edit' && Boolean(composer.post.shared_post_id))}
                initialImages={composer.mode === 'edit' ? composer.post.images ?? [] : []}
                allowImages={schema === 'social'}
                mentionCandidates={people}
                circles={joinedCircles}
                initialCircleId={composer.mode === 'create' ? composer.circleId ?? null : null}
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
                message="It will be removed from the feed for everyone, along with its comments. This cannot be undone."
                confirmLabel="Delete"
                onConfirm={confirmRemove}
                onClose={() => setConfirmDelete(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {unstuck && viewerId && (
              <UnstuckDialog
                key="unstuck"
                post={unstuck}
                onClose={() => setUnstuck(null)}
                onConfirm={async (commentId) => {
                  if (commentId) {
                    const credited = await setCommentReaction({ commentId, userId: viewerId, current: null, next: CREDIT_MARK, schema });
                    if (!credited.ok) toast('The credit could not be saved. The question is still marked unstuck.', 'error');
                  }
                  await resolve(unstuck, true);
                  setUnstuck(null);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>{startingCircle && <StartCircleDialog key="start-circle" onSubmit={startCircle} onClose={() => setStartingCircle(false)} />}</AnimatePresence>

          <AnimatePresence>
            {reactors && <ReactorsDialog key="reactors" target={reactors.target} id={reactors.id} counts={reactors.counts} schema={schema} onClose={() => setReactors(null)} />}
          </AnimatePresence>

          <AnimatePresence>
            {peek && (
              <ProfilePeek
                key={`peek-${peek.id}`}
                person={peek}
                isSelf={peek.id === viewerId}
                canFollow={Boolean(viewerId)}
                following={following.ids.has(peek.id)}
                onToggleFollow={() => actions.toggleFollow(peek.id)}
                onSeePosts={() => {
                  actions.filterAuthor(peek);
                  setPeek(null);
                }}
                onClose={() => setPeek(null)}
              />
            )}
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
              <Dialog key="filter" title="Browse" onClose={() => setFilterOpen(false)} size="sm">
                <div className="cm-dialog-body cm-browse">
                  {browse('cm-sheet')}
                  <MarginKey compact idPrefix="cm-sheet" />
                </div>
              </Dialog>
            )}
          </AnimatePresence>
        </div>
      </TagActionContext.Provider>
    </NowContext.Provider>
  );
}
