/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Circles: small groups that study one thing together.
 *
 * A circle is a row in `public.communities`, a table the schema has had since
 * the social migration and the app never surfaced. Membership is a row in
 * `community_members`; a post made inside a circle carries its `community_id`.
 * Nothing here needs new SQL.
 *
 * Only open circles are created and listed. The schema also has private ones,
 * but joining is a self-insert that the database does not gate on an
 * invitation, so "private" would promise more than it keeps. Until it does,
 * this file does not offer it.
 *
 * As everywhere in this folder there is no permission logic: who may create,
 * join or post is decided by the policies in `20260801000300_social.sql`, and
 * a refusal comes back as a refusal.
 */

import { useCallback } from 'react';
import { supabase } from '../supabase';
import type { MutationResult, QueryState } from './feed';
import { useLiveQuery } from './liveQuery';
import { useRealtimeSubscription } from './realtime';

export interface Circle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by: string | null;
  member_count: number;
  created_at: string;
}

export const CIRCLE_NAME_MAX = 60;
export const CIRCLE_ABOUT_MAX = 500;
const SLUG_MAX = 40;
const LIST_LIMIT = 60;
const COLUMNS = 'id, slug, name, description, created_by, member_count, created_at';

/**
 * The address a circle gets from its name: lower case, words joined by hyphens.
 * The database requires 2 to 40 characters of `a-z`, `0-9` and inner hyphens;
 * a name written in another script has none of those, and falls back to "circle".
 */
export function circleSlug(name: string, suffix = ''): string {
  const room = SLUG_MAX - (suffix ? suffix.length + 1 : 0);
  const base = name
    // "đ" has no decomposition, so it is mapped by hand before the accents are stripped.
    .replace(/[đĐ]/g, 'd')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, room)
    .replace(/-+$/, '');
  const stem = base.length >= 2 ? base : 'circle';
  return suffix ? `${stem}-${suffix}` : stem;
}

interface CirclePage {
  circles: Circle[];
  joined: string[];
}

const EMPTY: CirclePage = { circles: [], joined: [] };

export interface Circles extends QueryState<Circle[]> {
  /** Ids of the circles the viewer belongs to. Empty for a guest. */
  joined: ReadonlySet<string>;
  reload: () => Promise<void>;
}

/** Open circles, the most joined first, and which of them the viewer is in. */
export function useCircles(viewerId: string | null): Circles {
  const load = useCallback(async (): Promise<CirclePage> => {
    const client = supabase;
    if (!client) return EMPTY;

    const [list, mine] = await Promise.all([
      client.from('communities').select(COLUMNS).eq('is_private', false).order('member_count', { ascending: false }).order('created_at', { ascending: true }).limit(LIST_LIMIT),
      viewerId ? client.from('community_members').select('community_id').eq('user_id', viewerId) : Promise.resolve({ data: [], error: null }),
    ]);
    if (list.error) throw Error('Could not load the circles. Please try again.');

    return {
      circles: (list.data ?? []) as Circle[],
      joined: ((mine.data ?? []) as Array<{ community_id: string }>).map((row) => row.community_id),
    };
  }, [viewerId]);

  const state = useLiveQuery(`circles:${viewerId ?? 'guest'}`, EMPTY, load);
  useRealtimeSubscription({ table: 'communities', onReconnect: state.reload }, () => void state.reload());
  useRealtimeSubscription({ table: 'community_members', filter: viewerId ? `user_id=eq.${viewerId}` : undefined, enabled: Boolean(viewerId) }, () => void state.reload());

  return {
    data: state.data.circles,
    joined: new Set(state.data.joined),
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}

const shortId = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');

/**
 * Start a circle and join it as its owner.
 *
 * Two circles may share a name but not an address, so a taken slug is retried
 * with a short suffix rather than refused: the name is what people read.
 */
export async function createCircle(input: { ownerId: string; name: string; about?: string }): Promise<{ ok: true; circle: Circle } | { ok: false; error: string }> {
  const client = supabase;
  if (!client) return { ok: false, error: 'Circles are unavailable in this build.' };

  const name = input.name.trim().replace(/\s+/g, ' ');
  const about = input.about?.trim() ?? '';
  if (name.length < 2) return { ok: false, error: 'Give the circle a name of at least two characters.' };
  if (name.length > CIRCLE_NAME_MAX) return { ok: false, error: `Keep the name to ${CIRCLE_NAME_MAX} characters.` };
  if (about.length > CIRCLE_ABOUT_MAX) return { ok: false, error: `Keep the description to ${CIRCLE_ABOUT_MAX} characters.` };

  let circle: Circle | null = null;
  for (let attempt = 0; attempt < 4 && !circle; attempt++) {
    const { data, error } = await client
      .from('communities')
      .insert({ slug: circleSlug(name, attempt === 0 ? '' : shortId()), name, description: about || null, is_private: false, created_by: input.ownerId })
      .select(COLUMNS)
      .single();
    if (data) circle = data as Circle;
    else if (error?.code !== '23505') {
      if (error?.code === '42501') return { ok: false, error: 'You do not have permission to start a circle.' };
      console.error('[CalculixHub] Could not create circle', error?.message);
      return { ok: false, error: 'Could not start the circle. Please try again.' };
    }
  }
  if (!circle) return { ok: false, error: 'That name is taken many times over. Try a more specific one.' };

  const membership = await client.from('community_members').insert({ community_id: circle.id, user_id: input.ownerId, role: 'owner' });
  if (membership.error && membership.error.code !== '23505') {
    // The circle exists; its founder can still join from the list.
    return { ok: true, circle };
  }
  return { ok: true, circle: { ...circle, member_count: Math.max(1, circle.member_count) } };
}

/** Join a circle, or leave it. Idempotent: joining twice is still joined. */
export async function setCircleMembership(input: { circleId: string; userId: string; joined: boolean }): Promise<MutationResult> {
  const client = supabase;
  if (!client) return { ok: false, error: 'Circles are unavailable in this build.' };

  const { error } = input.joined
    ? await client.from('community_members').delete().eq('community_id', input.circleId).eq('user_id', input.userId)
    : await client.from('community_members').insert({ community_id: input.circleId, user_id: input.userId });

  if (error && error.code !== '23505') return { ok: false, error: input.joined ? 'Could not leave the circle. Please try again.' : 'Could not join the circle. Please try again.' };
  return { ok: true };
}
