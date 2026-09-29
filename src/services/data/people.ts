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
import { useLiveQuery } from './liveQuery';
import type { UserStats } from '../../../shared/types';

/** Empty is a legitimate answer: a platform with no activity has no ranking. */
export function useLeaderboard(limit = 50) {
 const load=useCallback(async()=>{
  if(!supabase)throw Error('Database is not configured.');
  const {data,error}=await supabase.from('leaderboard_view').select('*').order('rank').limit(limit);
  if(error)throw Error('Could not load the leaderboard.');return (data??[]) as LeaderboardRow[];
 },[limit]);
 const state=useLiveQuery('leaderboard:'+limit,[] as LeaderboardRow[],load);
 useRealtimeSubscription({table:'user_stats',onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'profiles'},()=>void state.reload());
 useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.ranking',onReconnect:state.reload},()=>void state.reload());
 return state;
}

export interface LearnerSnapshot {
  rank?: number | null;
  stats: UserStatsRow | null;
  skills: Record<Topic, number>;
  accuracyPct: number | null;
  completed: string[];
  attempts: Record<string,{count:number;finished:boolean;forfeited:boolean}>;
  timeline: UserStats['learningTimeline'];
  preferences: {goal:string;pace:string}|null;
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
export function useLearnerSnapshot(userId: string | null) {
 const empty:LearnerSnapshot={stats:null,skills:{...EMPTY_SKILLS},accuracyPct:null,completed:[],attempts:{},timeline:[],preferences:null};
 const load=useCallback(async()=>{
  if(!userId)return {stats:null,skills:{...EMPTY_SKILLS},accuracyPct:null,completed:[],attempts:{},timeline:[],preferences:null} as LearnerSnapshot;
  if(!supabase)throw Error('Database is not configured.');
  const {data,error}=await supabase.rpc('learning_snapshot');
  if(error)throw Error('Could not load your saved progress. Apply the realtime database setup.');
  const stats=data.stats as UserStatsRow|null;
  return {...data,skills:{...EMPTY_SKILLS,...data.skills},accuracyPct:stats&&stats.attempts_total>0?Math.round(stats.attempts_correct/stats.attempts_total*1000)/10:null} as LearnerSnapshot;
 },[userId]);
 const state=useLiveQuery('learner:'+(userId??'guest'),empty,load);
 useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.ranking',enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'problem_attempts',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'user_stats',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'skill_mastery',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'learner_preferences',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 return state;
}

export async function searchProfiles(term: string, limit = 20): Promise<ProfileRow[]> {
  if (!supabase) return [];

  const cleaned = term.trim();
  if (cleaned.length < 2) return [];

  // `%` and `_` are wildcards in ILIKE, so they are escaped rather than passed
  // through -- a bare `%` would otherwise match the entire directory.
  const escaped = cleaned.replace(/[\\%_]/g, (match) => `\\${match}`);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, country, level, follower_count, following_count, onboarded_at, created_at')
    .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
    .limit(limit);

  if (error) throw new Error('Could not search learners. Please reconnect and try again.');
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
