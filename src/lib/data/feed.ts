/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The discussion feed: posts, comments, likes and saves.
 *
 * Every function here is a thin, typed wrapper over a PostgREST query. There is
 * deliberately no permission logic in this file -- authorship, visibility and
 * ownership are decided by the policies in `20260801000300_social.sql`, and
 * duplicating those checks here would create a second set of rules that can
 * disagree with the first. A caller that tries to write someone else's row gets
 * an error from the database, not from a branch in this module.
 *
 * What this file does own is shape: joining authors, resolving whether the
 * viewer has liked something, and returning discriminated results so callers
 * render an error state instead of a blank screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { CommentWithAuthor, PostWithAuthor } from '../database.types';
import { useRealtimeSubscription } from './realtime';

/** Every read returns this, so a caller can never mistake an error for "empty". */
export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export type MutationResult = { ok: true } | { ok: false; error: string };

const AUTHOR_COLUMNS = 'id, username, display_name, avatar_url, level';
const POST_COLUMNS =
  `id, author_id, problem_id, community_id, body, like_count, comment_count, deleted_at, created_at, updated_at,
   author:profiles!posts_author_id_fkey (${AUTHOR_COLUMNS})`;

/**
 * Translate a database error into something a learner can act on.
 *
 * A policy violation is reported as a permission problem rather than echoed:
 * PostgREST's message names the table and policy, which is internal structure
 * an unauthenticated caller should not be handed.
 */
function describeError(error: { message: string; code?: string }): string {
  if (error.code === '42501' || /row-level security/i.test(error.message)) {
    return 'You do not have permission to do that.';
  }
  if (error.code === '23505') return 'That has already been done.';
  if (error.code === '23514') return 'That content is not valid.';

  console.error('[CalculixHub] Database error', error.message);
  return 'Something went wrong. Please try again.';
}

/**
 * Live discussion feed, optionally scoped to one problem.
 *
 * The realtime subscription refetches rather than patching the local array from
 * the payload. A payload carries the changed row only -- no joined author, and
 * no `viewer_has_liked` -- so merging it would render a post with a missing
 * author until the next full load. Refetching costs one indexed query per
 * change and keeps every row complete.
 */
export function usePostFeed(options: { problemId?: string; viewerId?: string | null } = {}): QueryState<PostWithAuthor[]> & {
  reload: () => Promise<void>;
} {
  const { problemId, viewerId } = options;
  const [state, setState] = useState<QueryState<PostWithAuthor[]>>({ data: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    let query = supabase
      .from('posts')
      .select(POST_COLUMNS)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (problemId && problemId !== 'All') query = query.eq('problem_id', problemId);

    const { data, error } = await query;

    if (error) {
      setState({ data: [], loading: false, error: describeError(error) });
      return;
    }

    const posts = (data ?? []) as unknown as PostWithAuthor[];

    // Resolve the viewer's own likes and saves in two set-membership queries
    // rather than a correlated subquery per post.
    if (viewerId && posts.length > 0) {
      const ids = posts.map((post) => post.id);
      const [{ data: likes }, { data: saves }] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
        supabase.from('saved_posts').select('post_id').eq('user_id', viewerId).in('post_id', ids),
      ]);

      const liked = new Set((likes ?? []).map((row) => (row as { post_id: string }).post_id));
      const saved = new Set((saves ?? []).map((row) => (row as { post_id: string }).post_id));

      for (const post of posts) {
        post.viewer_has_liked = liked.has(post.id);
        post.viewer_has_saved = saved.has(post.id);
      }
    }

    setState({ data: posts, loading: false, error: null });
  }, [problemId, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeSubscription({ table: 'posts' }, () => void load());
  useRealtimeSubscription({ table: 'post_likes' }, () => void load());

  return { ...state, reload: load };
}

/** Live comments for one post. */
export function useComments(postId: string | null): QueryState<CommentWithAuthor[]> & { reload: () => Promise<void> } {
  const [state, setState] = useState<QueryState<CommentWithAuthor[]>>({ data: [], loading: Boolean(postId), error: null });

  const load = useCallback(async () => {
    if (!supabase || !postId) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from('comments')
      .select(`id, post_id, author_id, body, like_count, deleted_at, created_at,
               author:profiles!comments_author_id_fkey (${AUTHOR_COLUMNS})`)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      setState({ data: [], loading: false, error: describeError(error) });
      return;
    }

    setState({ data: (data ?? []) as unknown as CommentWithAuthor[], loading: false, error: null });
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeSubscription(
    { table: 'comments', filter: postId ? `post_id=eq.${postId}` : undefined, enabled: Boolean(postId) },
    () => void load(),
  );

  return { ...state, reload: load };
}

/**
 * Publish a post.
 *
 * `author_id` is sent because the column is NOT NULL, but it is not what makes
 * the post yours: the insert policy compares it against `auth.uid()` and
 * rejects any mismatch. Sending someone else's id fails at the database.
 */
export async function createPost(input: {
  authorId: string;
  body: string;
  problemId?: string | null;
  communityId?: string | null;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'The community is unavailable in this build.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > 5000) return { ok: false, error: 'That post is too long (5000 characters maximum).' };

  const { error } = await supabase.from('posts').insert({
    author_id: input.authorId,
    body,
    problem_id: input.problemId ?? null,
    community_id: input.communityId ?? null,
  });

  return error ? { ok: false, error: describeError(error) } : { ok: true };
}

export async function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'The community is unavailable in this build.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > 2000) return { ok: false, error: 'That comment is too long (2000 characters maximum).' };

  const { error } = await supabase
    .from('comments')
    .insert({ post_id: input.postId, author_id: input.authorId, body });

  return error ? { ok: false, error: describeError(error) } : { ok: true };
}

/**
 * Toggle a like.
 *
 * The composite primary key makes this idempotent at the database, so a double
 * click cannot produce two likes and the count cannot be inflated by replaying
 * the request. `like_count` is never written here -- a trigger owns it.
 */
export async function togglePostLike(input: {
  postId: string;
  userId: string;
  liked: boolean;
}): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const { error } = input.liked
    ? await supabase.from('post_likes').delete().eq('post_id', input.postId).eq('user_id', input.userId)
    : await supabase.from('post_likes').insert({ post_id: input.postId, user_id: input.userId });

  // Re-liking an already-liked post is a no-op, not a failure.
  if (error && error.code !== '23505') return { ok: false, error: describeError(error) };
  return { ok: true };
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

/** Soft-delete your own post. The policy rejects anyone else's. */
export async function deletePost(postId: string): Promise<MutationResult> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };

  const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId);
  return error ? { ok: false, error: describeError(error) } : { ok: true };
}
