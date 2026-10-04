/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The discussion feed: posts, comments, reactions, shares and saves.
 *
 * Every function here is a thin, typed wrapper over a PostgREST query. There is
 * deliberately no permission logic in this file -- authorship, visibility and
 * ownership are decided by the policies in `20260801000300_social.sql` and
 * `20261004000100_community_social.sql`, and duplicating those checks here
 * would create a second set of rules that can disagree with the first. A caller
 * that tries to write someone else's row gets an error from the database, not
 * from a branch in this module.
 *
 * What this file does own is shape: joining authors, resolving what the viewer
 * has reacted with, attaching the original to a share, and returning
 * discriminated results so callers render an error state instead of a blank
 * screen.
 *
 * It also owns one compatibility rule. The social columns arrive with a
 * migration that a hosted project applies through its SQL Editor, so the
 * client may briefly run ahead of the database. `detectFeedSchema` asks once,
 * and every query below selects only columns that exist: against an older
 * database the feed keeps working with likes, flat comments, edits and
 * deletes, and simply does not offer what the database cannot store.
 */

import { useCallback } from 'react';
import { supabase } from '../supabase';
import type {
  AuthorSummary,
  CommentWithAuthor,
  PostWithAuthor,
  Reaction,
  ReactionCounts,
  SharedPost,
} from '../database.types';
import { useRealtimeSubscription } from './realtime';
import { useLiveQuery } from './liveQuery';

/** Every read returns this, so a caller can never mistake an error for "empty". */
export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export type MutationResult = { ok: true } | { ok: false; error: string };

/** `social` once the community migration is applied, `legacy` before it. */
export type FeedSchema = 'social' | 'legacy';

/** In the order the reaction picker shows them. */
export const REACTIONS: readonly Reaction[] = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];

export const POST_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 2000;

const AUTHOR_COLUMNS = 'id, username, display_name, avatar_url, level';
const POST_AUTHOR = `author:profiles!posts_author_id_fkey (${AUTHOR_COLUMNS})`;
const POST_BASE = 'id, author_id, problem_id, community_id, body, like_count, comment_count, deleted_at, created_at, updated_at';
const POST_COLUMNS = `${POST_BASE}, ${POST_AUTHOR}`;
const SOCIAL_POST_COLUMNS = `${POST_BASE}, edited_at, shared_post_id, share_count, ${POST_AUTHOR}`;
const SHARED_POST_COLUMNS = `id, author_id, problem_id, body, deleted_at, created_at, ${POST_AUTHOR}`;
const COMMENT_AUTHOR = `author:profiles!comments_author_id_fkey (${AUTHOR_COLUMNS})`;
const COMMENT_BASE = 'id, post_id, author_id, body, like_count, deleted_at, created_at';
const COMMENT_COLUMNS = `${COMMENT_BASE}, ${COMMENT_AUTHOR}`;
const SOCIAL_COMMENT_COLUMNS = `${COMMENT_BASE}, parent_id, edited_at, ${COMMENT_AUTHOR}`;

/**
 * Codes for a column, table, view, relationship or function that does not
 * exist -- from PostgreSQL directly, or from PostgREST's schema cache.
 */
const MISSING_SCHEMA = new Set(['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);

/**
 * Translate a database error into something a learner can act on.
 *
 * A policy violation is reported as a permission problem rather than echoed:
 * PostgREST's message names the table and policy, which is internal structure
 * an unauthenticated caller should not be handed. The two check messages
 * raised by the community triggers are written for people, so they pass
 * through in plain words.
 */
function describeError(error: { message: string; code?: string }): string {
  if (error.code === '42501' || /row-level security|permission/i.test(error.message)) {
    return 'You do not have permission to do that.';
  }
  if (error.code === '23505') return 'That has already been done.';
  if (error.code === '23514') {
    if (/no longer available/i.test(error.message)) return 'That post is no longer available to share.';
    if (/same post/i.test(error.message)) return 'That comment is no longer available to reply to.';
    return 'That content is not valid.';
  }

  console.error('[CalculixHub] Database error', error.message);
  return 'Something went wrong. Please try again.';
}

let schemaProbe: Promise<FeedSchema> | null = null;

/**
 * Whether the community migration has been applied, asked once per session.
 *
 * A transient failure is not cached, so the next load asks again instead of
 * pinning the session to the older feature set.
 */
export function detectFeedSchema(): Promise<FeedSchema> {
  const client = supabase;
  if (!client) return Promise.resolve('legacy');

  if (!schemaProbe) {
    schemaProbe = (async () => {
      const { error } = await client.from('posts').select('share_count').limit(1);
      if (!error) return 'social';
      if (error.code && MISSING_SCHEMA.has(error.code)) return 'legacy';
      schemaProbe = null;
      throw Error(describeError(error));
    })();
  }

  return schemaProbe;
}

/** Rows from a query whose failure should degrade a decoration, not the feed. */
async function rowsOf<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data } = await query;
  return (data ?? []) as T[];
}

function tally<K extends string>(rows: Array<Record<K, string> & { reaction: Reaction; total: number }>, key: K) {
  const counts = new Map<string, ReactionCounts>();
  for (const row of rows) {
    const entry = counts.get(row[key]) ?? {};
    entry[row.reaction] = (entry[row.reaction] ?? 0) + row.total;
    counts.set(row[key], entry);
  }
  return counts;
}

/**
 * Attach reactions, saves and share originals to a page of posts.
 *
 * Each is one set-membership query over the page rather than a correlated
 * subquery per post, so a page costs the same handful of round trips however
 * long it is.
 */
async function decoratePosts(
  client: NonNullable<typeof supabase>,
  posts: PostWithAuthor[],
  viewerId: string | null,
  schema: FeedSchema,
): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return posts;
  const ids = posts.map((post) => post.id);

  const saves = viewerId
    ? rowsOf<{ post_id: string }>(client.from('saved_posts').select('post_id').eq('user_id', viewerId).in('post_id', ids))
    : Promise.resolve([]);

  if (schema === 'legacy') {
    const likes = viewerId
      ? rowsOf<{ post_id: string }>(client.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids))
      : Promise.resolve([]);
    const [liked, saved] = await Promise.all([likes, saves]);
    const likedIds = new Set(liked.map((row) => row.post_id));
    const savedIds = new Set(saved.map((row) => row.post_id));

    for (const post of posts) {
      post.reactions = post.like_count > 0 ? { like: post.like_count } : {};
      post.share_count = 0;
      if (viewerId) {
        post.viewer_has_liked = likedIds.has(post.id);
        post.viewer_reaction = post.viewer_has_liked ? 'like' : null;
        post.viewer_has_saved = savedIds.has(post.id);
      }
    }
    return posts;
  }

  const sharedIds = [...new Set(posts.map((post) => post.shared_post_id).filter((id): id is string => Boolean(id)))];
  const [counts, mine, saved, originals] = await Promise.all([
    rowsOf<{ post_id: string; reaction: Reaction; total: number }>(
      client.from('post_reaction_counts').select('post_id, reaction, total').in('post_id', ids),
    ),
    viewerId
      ? rowsOf<{ post_id: string; reaction: Reaction }>(
          client.from('post_likes').select('post_id, reaction').eq('user_id', viewerId).in('post_id', ids),
        )
      : Promise.resolve([]),
    saves,
    sharedIds.length > 0
      ? rowsOf<SharedPost>(client.from('posts').select(SHARED_POST_COLUMNS).in('id', sharedIds))
      : Promise.resolve([]),
  ]);

  const reactionsByPost = tally(counts, 'post_id');
  const viewerReactions = new Map(mine.map((row) => [row.post_id, row.reaction]));
  const savedIds = new Set(saved.map((row) => row.post_id));
  // RLS already hides an original this viewer may not see. One its own author
  // deleted is still visible to that author, and renders as unavailable too.
  const originalsById = new Map(originals.filter((post) => !post.deleted_at).map((post) => [post.id, post]));

  for (const post of posts) {
    post.reactions = reactionsByPost.get(post.id) ?? (post.like_count > 0 ? { like: post.like_count } : {});
    if (post.shared_post_id) post.shared_post = originalsById.get(post.shared_post_id) ?? null;
    if (viewerId) {
      post.viewer_reaction = viewerReactions.get(post.id) ?? null;
      post.viewer_has_liked = Boolean(post.viewer_reaction);
      post.viewer_has_saved = savedIds.has(post.id);
    }
  }
  return posts;
}

async function decorateComments(
  client: NonNullable<typeof supabase>,
  comments: CommentWithAuthor[],
  viewerId: string | null,
  schema: FeedSchema,
): Promise<CommentWithAuthor[]> {
  if (comments.length === 0) return comments;
  const ids = comments.map((comment) => comment.id);

  const [counts, mine] = await Promise.all([
    schema === 'social'
      ? rowsOf<{ comment_id: string; reaction: Reaction; total: number }>(
          client.from('comment_reaction_counts').select('comment_id, reaction, total').in('comment_id', ids),
        )
      : Promise.resolve([]),
    viewerId
      ? rowsOf<{ comment_id: string; reaction?: Reaction }>(
          client
            .from('comment_likes')
            .select(schema === 'social' ? 'comment_id, reaction' : 'comment_id')
            .eq('user_id', viewerId)
            .in('comment_id', ids),
        )
      : Promise.resolve([]),
  ]);

  const reactionsByComment = tally(counts, 'comment_id');
  const viewerReactions = new Map(mine.map((row) => [row.comment_id, row.reaction ?? 'like']));

  for (const comment of comments) {
    comment.reactions = reactionsByComment.get(comment.id) ?? (comment.like_count > 0 ? { like: comment.like_count } : {});
    if (viewerId) comment.viewer_reaction = viewerReactions.get(comment.id) ?? null;
  }
  return comments;
}

interface FeedPage {
  schema: FeedSchema | null;
  posts: PostWithAuthor[];
}

const EMPTY_FEED: FeedPage = { schema: null, posts: [] };

export interface PostFeed extends QueryState<PostWithAuthor[]> {
  schema: FeedSchema | null;
  reload: () => Promise<void>;
}

/** Which posts a feed shows: everyone's, the viewer's saved posts, or the viewer's own. */
export type FeedView = 'all' | 'saved' | 'mine';

/**
 * Live discussion feed, optionally scoped to one problem.
 *
 * `limit` is deliberately not part of the live-query key: raising it to load
 * more keeps the posts already on screen until the longer page arrives,
 * instead of blanking the feed while it loads.
 *
 * The realtime subscription refetches rather than patching the local array from
 * the payload. A payload carries the changed row only -- no joined author, and
 * no viewer reaction -- so merging it would render a post with a missing
 * author until the next full load. Refetching costs one indexed query per
 * change and keeps every row complete.
 */
export function usePostFeed(
  options: { problemId?: string; viewerId?: string | null; view?: FeedView; limit?: number } = {},
): PostFeed {
  const { problemId, viewerId, limit = 30 } = options;
  const view = viewerId ? options.view ?? 'all' : 'all';
  const load = useCallback(async (): Promise<FeedPage> => {
    const client = supabase;
    if (!client) throw Error('The community database is not configured.');

    const schema = await detectFeedSchema();
    let query = client
      .from('posts')
      .select(schema === 'social' ? SOCIAL_POST_COLUMNS : POST_COLUMNS)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (problemId && problemId !== 'All') query = query.eq('problem_id', problemId);
    if (view === 'mine' && viewerId) query = query.eq('author_id', viewerId);
    if (view === 'saved' && viewerId) {
      // Saves are private rows, so the set is read first and the posts second.
      const saved = await rowsOf<{ post_id: string }>(
        client.from('saved_posts').select('post_id').eq('user_id', viewerId).order('created_at', { ascending: false }).limit(limit),
      );
      if (saved.length === 0) return { schema, posts: [] };
      query = query.in('id', saved.map((row) => row.post_id));
    }

    const { data, error } = await query;
    if (error) throw Error(describeError(error));

    const posts = (data ?? []) as unknown as PostWithAuthor[];
    return { schema, posts: await decoratePosts(client, posts, viewerId ?? null, schema) };
  }, [problemId, viewerId, view, limit]);

  const state = useLiveQuery(`posts:${problemId ?? 'All'}:${view}:${viewerId ?? 'guest'}`, EMPTY_FEED, load);
  useRealtimeSubscription({ table: 'posts', onReconnect: state.reload }, () => void state.reload());
  useRealtimeSubscription({ table: 'post_likes' }, () => void state.reload());
  useRealtimeSubscription({ table: 'profiles' }, () => void state.reload());
  useRealtimeSubscription({ table: 'communities', onReconnect: state.reload }, () => void state.reload());
  useRealtimeSubscription({ table: 'community_members', enabled: Boolean(viewerId), onReconnect: state.reload }, () => void state.reload());
  useRealtimeSubscription({ table: 'saved_posts', filter: viewerId ? `user_id=eq.${viewerId}` : undefined, enabled: Boolean(viewerId) }, () => void state.reload());

  return {
    data: state.data.posts,
    schema: state.data.schema,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}

/**
 * One post by id, for a shared link to a post older than the loaded page.
 * Resolves to null when the post is gone or hidden from this viewer.
 */
export async function fetchPost(postId: string, viewerId: string | null): Promise<PostWithAuthor | null> {
  const client = supabase;
  if (!client) return null;

  const schema = await detectFeedSchema();
  const { data, error } = await client
    .from('posts')
    .select(schema === 'social' ? SOCIAL_POST_COLUMNS : POST_COLUMNS)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw Error(describeError(error));
  if (!data) return null;

  const [post] = await decoratePosts(client, [data as unknown as PostWithAuthor], viewerId, schema);
  return post ?? null;
}

interface CommentPage {
  schema: FeedSchema | null;
  comments: CommentWithAuthor[];
}

const EMPTY_COMMENTS: CommentPage = { schema: null, comments: [] };

export interface CommentFeed extends QueryState<CommentWithAuthor[]> {
  schema: FeedSchema | null;
  reload: () => Promise<void>;
}

/** Live comments for one post, replies included, oldest first. */
export function useComments(postId: string | null, viewerId: string | null = null): CommentFeed {
  const load = useCallback(async (): Promise<CommentPage> => {
    const client = supabase;
    if (!client || !postId) return EMPTY_COMMENTS;

    const schema = await detectFeedSchema();
    const { data, error } = await client
      .from('comments')
      .select(schema === 'social' ? SOCIAL_COMMENT_COLUMNS : COMMENT_COLUMNS)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw Error(describeError(error));

    const comments = (data ?? []) as unknown as CommentWithAuthor[];
    return { schema, comments: await decorateComments(client, comments, viewerId, schema) };
  }, [postId, viewerId]);

  const state = useLiveQuery('comments:' + (postId ?? 'none') + ':' + (viewerId ?? 'guest'), EMPTY_COMMENTS, load);
  useRealtimeSubscription({ table: 'comments', filter: postId ? `post_id=eq.${postId}` : undefined, enabled: Boolean(postId), onReconnect: state.reload }, () => void state.reload());
  useRealtimeSubscription({ table: 'comment_likes', enabled: Boolean(postId) }, () => void state.reload());
  useRealtimeSubscription({ table: 'profiles', enabled: Boolean(postId) }, () => void state.reload());

  return {
    data: state.data.comments,
    schema: state.data.schema,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}

/**
 * Publish a post, or share one.
 *
 * `author_id` is sent because the column is NOT NULL, but it is not what makes
 * the post yours: the insert policy compares it against `auth.uid()` and
 * rejects any mismatch. Sending someone else's id fails at the database.
 *
 * A share may carry no words of its own. Sharing a share is resolved to the
 * original by the database, not here.
 */
export async function createPost(input: {
  authorId: string;
  body: string;
  problemId?: string | null;
  communityId?: string | null;
  sharedPostId?: string | null;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'The community is unavailable in this build.' };

  const body = input.body.trim();
  if (!body && !input.sharedPostId) return { ok: false, error: 'Write something first.' };
  if (body.length > POST_MAX_LENGTH) return { ok: false, error: `That post is too long (${POST_MAX_LENGTH} characters maximum).` };

  const { error } = await supabase.from('posts').insert({
    author_id: input.authorId,
    body,
    problem_id: input.problemId ?? null,
    community_id: input.communityId ?? null,
    ...(input.sharedPostId ? { shared_post_id: input.sharedPostId } : {}),
  });

  return error ? { ok: false, error: describeError(error) } : { ok: true };
}

/**
 * Reword your own post or re-file it under another problem. The database
 * stamps `edited_at` when the words change; nothing here claims it.
 */
export async function updatePost(input: {
  postId: string;
  body: string;
  problemId?: string | null;
  /** A share may be edited down to no words at all, as it was posted. */
  isShare?: boolean;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const body = input.body.trim();
  if (!body && !input.isShare) return { ok: false, error: 'Write something first.' };
  if (body.length > POST_MAX_LENGTH) return { ok: false, error: `That post is too long (${POST_MAX_LENGTH} characters maximum).` };

  const patch: { body: string; problem_id?: string | null } = { body };
  if (input.problemId !== undefined) patch.problem_id = input.problemId;

  const { data, error } = await supabase.from('posts').update(patch).eq('id', input.postId).select('id');
  if (error) return { ok: false, error: describeError(error) };
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'You do not have permission to do that.' };
}

/** Soft-delete your own post. The policy rejects anyone else's. */
export async function deletePost(postId: string): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const { data, error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
    .select('id');
  if (error) return { ok: false, error: describeError(error) };
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'You do not have permission to do that.' };
}

/**
 * Move one reaction row from `current` to `next`: add, change or remove it.
 *
 * The composite primary key makes this idempotent at the database, so a double
 * click cannot produce two reactions and the count cannot be inflated by
 * replaying the request. `like_count` is never written here -- a trigger owns
 * it, and changing which reaction you chose leaves it untouched.
 */
async function setReaction(input: {
  table: 'post_likes' | 'comment_likes';
  key: 'post_id' | 'comment_id';
  id: string;
  userId: string;
  current: Reaction | null;
  next: Reaction | null;
  schema: FeedSchema | null;
}): Promise<MutationResult> {
  const client = supabase;
  if (!client) return { ok: false, error: 'Unavailable in this build.' };
  if (input.current === input.next) return { ok: true };

  const social = input.schema === 'social';
  const mine = () => client.from(input.table).update({ reaction: input.next }).eq(input.key, input.id).eq('user_id', input.userId);

  if (!input.next) {
    const { error } = await client.from(input.table).delete().eq(input.key, input.id).eq('user_id', input.userId);
    return error ? { ok: false, error: describeError(error) } : { ok: true };
  }

  if (input.current && social) {
    const { error } = await mine();
    return error ? { ok: false, error: describeError(error) } : { ok: true };
  }

  const { error } = await client
    .from(input.table)
    .insert({ [input.key]: input.id, user_id: input.userId, ...(social ? { reaction: input.next } : {}) });

  // Already reacted from another tab: settle on the reaction chosen here.
  if (error?.code === '23505') {
    if (!social) return { ok: true };
    const retry = await mine();
    return retry.error ? { ok: false, error: describeError(retry.error) } : { ok: true };
  }
  return error ? { ok: false, error: describeError(error) } : { ok: true };
}

export function setPostReaction(input: {
  postId: string;
  userId: string;
  current: Reaction | null;
  next: Reaction | null;
  schema: FeedSchema | null;
}): Promise<MutationResult> {
  return setReaction({ table: 'post_likes', key: 'post_id', id: input.postId, ...input });
}

export function setCommentReaction(input: {
  commentId: string;
  userId: string;
  current: Reaction | null;
  next: Reaction | null;
  schema: FeedSchema | null;
}): Promise<MutationResult> {
  return setReaction({ table: 'comment_likes', key: 'comment_id', id: input.commentId, ...input });
}

export async function toggleSavedPost(input: {
  postId: string;
  userId: string;
  saved: boolean;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const { error } = input.saved
    ? await supabase.from('saved_posts').delete().eq('post_id', input.postId).eq('user_id', input.userId)
    : await supabase.from('saved_posts').insert({ post_id: input.postId, user_id: input.userId });

  if (error && error.code !== '23505') return { ok: false, error: describeError(error) };
  return { ok: true };
}

/**
 * Comment on a post, or reply to a comment on it. A reply to a reply is filed
 * under the comment that started the thread -- by the database.
 */
export async function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentId?: string | null;
  schema?: FeedSchema | null;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'The community is unavailable in this build.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > COMMENT_MAX_LENGTH) return { ok: false, error: `That comment is too long (${COMMENT_MAX_LENGTH} characters maximum).` };

  const { error } = await supabase.from('comments').insert({
    post_id: input.postId,
    author_id: input.authorId,
    body,
    ...(input.parentId && input.schema === 'social' ? { parent_id: input.parentId } : {}),
  });

  return error ? { ok: false, error: describeError(error) } : { ok: true };
}

/** Reword your own comment. The database stamps `edited_at`. */
export async function updateComment(input: { commentId: string; body: string }): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > COMMENT_MAX_LENGTH) return { ok: false, error: `That comment is too long (${COMMENT_MAX_LENGTH} characters maximum).` };

  const { data, error } = await supabase.from('comments').update({ body }).eq('id', input.commentId).select('id');
  if (error) return { ok: false, error: describeError(error) };
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'You do not have permission to do that.' };
}

/**
 * Remove a comment: your own, or -- once the community migration is applied --
 * one left on your post. Its replies go with it.
 */
export async function deleteComment(input: { commentId: string; schema: FeedSchema | null }): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  if (input.schema === 'social') {
    const { error } = await supabase.rpc('remove_comment', { p_comment: input.commentId });
    return error ? { ok: false, error: describeError(error) } : { ok: true };
  }

  const { data, error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.commentId)
    .select('id');
  if (error) return { ok: false, error: describeError(error) };
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'You do not have permission to do that.' };
}

export interface Reactor {
  reaction: Reaction;
  user: AuthorSummary | null;
}

/** Who reacted to a post or comment, newest first. */
export async function fetchReactors(input: {
  target: 'post' | 'comment';
  id: string;
  schema: FeedSchema | null;
}): Promise<Reactor[]> {
  const client = supabase;
  if (!client) return [];

  const table = input.target === 'post' ? 'post_likes' : 'comment_likes';
  const key = input.target === 'post' ? 'post_id' : 'comment_id';
  const columns = `${input.schema === 'social' ? 'reaction, ' : ''}created_at, user:profiles!${table}_user_id_fkey (${AUTHOR_COLUMNS})`;

  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(key, input.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw Error(describeError(error));
  return ((data ?? []) as unknown as Array<{ reaction?: Reaction; user: AuthorSummary | null }>).map((row) => ({
    reaction: row.reaction ?? 'like',
    user: row.user,
  }));
}
