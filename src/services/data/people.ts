/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Profiles, the follow graph, the leaderboard, and a learner's own statistics.
 *
 * Everything here reads derived data. Points, ranks, streaks and mastery are
 * computed by database triggers from the attempt log and are not writable from
 * a browser at all -- the previous implementation kept them in localStorage,
 * which meant every number the platform displayed was supplied by the person it
 * described.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { LeaderboardRow, ProfileRow, SkillMasteryRow, Topic, UserStatsRow } from '../database.types';
import type { QueryState } from './feed';
import { useRealtimeSubscription } from './realtime';

/** Empty is a legitimate answer: a platform with no activity has no ranking. */
export function useLeaderboard(limit = 50): QueryState<LeaderboardRow[]> {
  const [state, setState] = useState<QueryState<LeaderboardRow[]>>({ data: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit);

    setState({
      data: (data ?? []) as LeaderboardRow[],
      loading: false,
      error: error ? 'Could not load the leaderboard.' : null,
    });
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ranks move when anyone's totals move, so the feed follows user_stats.
  useRealtimeSubscription({ table: 'user_stats' }, () => void load());

  return state;
}

export interface LearnerSnapshot {
  stats: UserStatsRow | null;
  skills: Record<Topic, number>;
  accuracyPct: number | null;
}

const EMPTY_SKILLS: Record<Topic, number> = {
  Algebra: 0,
  Geometry: 0,
  Combinatorics: 0,
  'Number Theory': 0,
};

/**
 * A learner's own derived statistics, kept live.
 *
 * Returns zeros rather than null for a learner with no activity, so the
 * dashboard renders a real "nothing yet" state instead of placeholder numbers.
 */
export function useLearnerSnapshot(userId: string | null): QueryState<LearnerSnapshot> & { reload: () => Promise<void> } {
  const [state, setState] = useState<QueryState<LearnerSnapshot>>({
    data: { stats: null, skills: { ...EMPTY_SKILLS }, accuracyPct: null },
    loading: Boolean(userId),
    error: null,
  });

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState({ data: { stats: null, skills: { ...EMPTY_SKILLS }, accuracyPct: null }, loading: false, error: null });
      return;
    }

    const [statsResult, masteryResult] = await Promise.all([
      supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('skill_mastery').select('*').eq('user_id', userId),
    ]);

    if (statsResult.error || masteryResult.error) {
      setState((previous) => ({ ...previous, loading: false, error: 'Could not load your progress.' }));
      return;
    }

    const stats = (statsResult.data as UserStatsRow | null) ?? null;
    const skills = { ...EMPTY_SKILLS };
    for (const row of (masteryResult.data ?? []) as SkillMasteryRow[]) {
      skills[row.topic] = Number(row.mastery);
    }

    const accuracyPct =
      stats && stats.attempts_total > 0
        ? Math.round((stats.attempts_correct / stats.attempts_total) * 1000) / 10
        : null;

    setState({ data: { stats, skills, accuracyPct }, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeSubscription(
    { table: 'user_stats', filter: userId ? `user_id=eq.${userId}` : undefined, enabled: Boolean(userId) },
    () => void load(),
  );

  return { ...state, reload: load };
}

export async function searchProfiles(term: string, limit = 20): Promise<ProfileRow[]> {
  if (!supabase) return [];

  const cleaned = term.trim();
  if (cleaned.length < 2) return [];

  // `%` and `_` are wildcards in ILIKE, so they are escaped rather than passed
  // through -- a bare `%` would otherwise match the entire directory.
  const escaped = cleaned.replace(/[\\%_]/g, (match) => `\\${match}`);

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, country, level, follower_count, following_count, onboarded_at, created_at')
    .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
    .limit(limit);

  return (data ?? []) as ProfileRow[];
}

export async function setFollowing(input: {
  followerId: string;
  targetId: string;
  following: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Unavailable in this build.' };
  if (input.followerId === input.targetId) return { ok: false, error: 'You cannot follow yourself.' };

  const { error } = input.following
    ? await supabase.from('follows').delete().eq('follower_id', input.followerId).eq('following_id', input.targetId)
    : await supabase.from('follows').insert({ follower_id: input.followerId, following_id: input.targetId });

  if (error && error.code !== '23505') return { ok: false, error: 'Could not update that follow.' };
  return { ok: true };
}

/** Ids the viewer follows, for rendering follow state across a list. */
export async function fetchFollowingIds(viewerId: string): Promise<Set<string>> {
  if (!supabase) return new Set();

  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', viewerId);
  return new Set((data ?? []).map((row) => (row as { following_id: string }).following_id));
}
