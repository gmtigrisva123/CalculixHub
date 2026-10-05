/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ephemeral realtime for the Community feed: who is here, and who is typing.
 *
 * Neither is stored. Presence and typing ride Supabase Realtime's Presence and
 * Broadcast features, which relay between connected clients without touching
 * a table -- the right shape for state that is only true while someone has the
 * page open. Database changes (posts, comments, reactions) keep using
 * `postgres_changes` in `realtime.ts`, where row-level security applies.
 *
 * Both degrade to nothing: without a backend, or when a project restricts
 * Realtime to private channels, the hooks simply report nobody.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { AuthorSummary } from '../database.types';

export interface PresentPerson {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  /** The post whose comments this person has open, if any. */
  post: string | null;
  /** When this person last changed what they are looking at, epoch ms. */
  at: number;
}

type PresenceState = Record<string, Array<Partial<PresentPerson> & { presence_ref?: string }>>;

/**
 * One entry per person, newest state first. A learner with the feed open in
 * two tabs is one person, not two; the viewer is never in their own list.
 */
export function flattenPresence(state: PresenceState, selfId: string | null): PresentPerson[] {
  const people = new Map<string, PresentPerson>();
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      if (!meta.id || meta.id === selfId) continue;
      const entry: PresentPerson = {
        id: meta.id,
        name: meta.name ?? meta.username ?? 'Learner',
        username: meta.username ?? '',
        avatar_url: meta.avatar_url ?? null,
        post: meta.post ?? null,
        at: meta.at ?? 0,
      };
      const previous = people.get(entry.id);
      if (!previous || entry.at > previous.at) people.set(entry.id, entry);
    }
  }
  return [...people.values()].sort((a, b) => b.at - a.at);
}

/**
 * Everyone with the Community feed open right now, and which post's comments
 * each of them is reading. Guests see who is here but are not announced.
 */
export function useCommunityPresence(viewer: AuthorSummary | null, viewingPostId: string | null): PresentPerson[] {
  const [people, setPeople] = useState<PresentPerson[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const joined = useRef(false);
  const latest = useRef({ viewer, viewingPostId });
  latest.current = { viewer, viewingPostId };

  const announce = useCallback(() => {
    const { viewer: me, viewingPostId: post } = latest.current;
    if (!me || !channel.current || !joined.current) return;
    void channel.current.track({
      id: me.id,
      name: me.display_name || me.username || 'Learner',
      username: me.username,
      avatar_url: me.avatar_url,
      post,
      at: Date.now(),
    });
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const key = viewer?.id ?? `guest-${crypto.randomUUID()}`;
    const room = client.channel('community:presence', { config: { presence: { key } } });
    channel.current = room;
    joined.current = false;

    room
      .on('presence', { event: 'sync' }, () => setPeople(flattenPresence(room.presenceState() as PresenceState, viewer?.id ?? null)))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          joined.current = true;
          announce();
        }
      });

    return () => {
      joined.current = false;
      channel.current = null;
      setPeople([]);
      void client.removeChannel(room);
    };
  }, [viewer?.id, announce]);

  // Re-announce when the viewer opens another post's comments or renames themselves.
  useEffect(() => announce(), [viewingPostId, viewer?.display_name, viewer?.avatar_url, announce]);

  return people;
}

export interface Typer {
  id: string;
  name: string;
}

const TYPING_TTL_MS = 4500;
const TYPING_THROTTLE_MS = 2000;

/**
 * Who is writing a comment on one post, and a function to say that you are.
 *
 * `announce` is throttled, so it can be called on every keystroke; `stop` is
 * sent when a comment goes out, so the indicator clears at once rather than
 * after the timeout.
 */
export function useTyping(postId: string | null, viewer: AuthorSummary | null): {
  typers: Typer[];
  announce: () => void;
  stop: () => void;
} {
  const [typers, setTypers] = useState<Array<Typer & { until: number }>>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const client = supabase;
    if (!client || !postId) return;

    const room = client.channel(`community:typing:${postId}`, { config: { broadcast: { self: false } } });
    channel.current = room;

    room
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typer = payload as Typer;
        if (!typer?.id || typer.id === viewer?.id) return;
        setTypers((list) => [...list.filter((entry) => entry.id !== typer.id), { id: typer.id, name: typer.name, until: Date.now() + TYPING_TTL_MS }]);
      })
      .on('broadcast', { event: 'stopped' }, ({ payload }) => {
        const id = (payload as Partial<Typer>)?.id;
        setTypers((list) => list.filter((entry) => entry.id !== id));
      })
      .subscribe();

    const sweep = window.setInterval(() => {
      setTypers((list) => (list.some((entry) => entry.until <= Date.now()) ? list.filter((entry) => entry.until > Date.now()) : list));
    }, 1000);

    return () => {
      window.clearInterval(sweep);
      channel.current = null;
      setTypers([]);
      void client.removeChannel(room);
    };
  }, [postId, viewer?.id]);

  const announce = useCallback(() => {
    if (!viewer || !channel.current) return;
    const now = Date.now();
    if (now - lastSent.current < TYPING_THROTTLE_MS) return;
    lastSent.current = now;
    void channel.current.send({ type: 'broadcast', event: 'typing', payload: { id: viewer.id, name: viewer.display_name || viewer.username || 'Someone' } });
  }, [viewer]);

  const stop = useCallback(() => {
    if (!viewer || !channel.current) return;
    lastSent.current = 0;
    void channel.current.send({ type: 'broadcast', event: 'stopped', payload: { id: viewer.id } });
  }, [viewer]);

  return { typers: typers.map(({ id, name }) => ({ id, name })), announce, stop };
}
