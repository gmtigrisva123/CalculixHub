/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notifications, delivered live.
 *
 * Rows arrive over the same websocket the rest of the app uses, so a follow or
 * a reply appears without a refresh and without polling. Notifications are
 * created by database triggers on the actions that cause them, so this module
 * only ever reads them and marks them read -- there is no client path that can
 * create one, which is what stops a caller fabricating a notification that
 * appears to come from someone else.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { NotificationWithActor } from '../database.types';
import type { QueryState } from './feed';
import { useRealtimeSubscription } from './realtime';

export interface NotificationFeed extends QueryState<NotificationWithActor[]> {
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useNotifications(userId: string | null, limit = 50): NotificationFeed {
  const [state, setState] = useState<QueryState<NotificationWithActor[]>>({
    data: [],
    loading: Boolean(userId),
    error: null,
  });

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(`id, user_id, actor_id, type, entity_type, entity_id, body, read_at, created_at,
               actor:profiles!notifications_actor_id_fkey (id, username, display_name, avatar_url)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    setState({
      data: (data ?? []) as unknown as NotificationWithActor[],
      loading: false,
      error: error ? 'Could not load notifications.' : null,
    });
  }, [userId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtered server-side to this learner. The RLS policy already restricts the
  // stream, but narrowing it here avoids waking every client on every insert.
  useRealtimeSubscription(
    { table: 'notifications', filter: userId ? `user_id=eq.${userId}` : undefined, enabled: Boolean(userId) },
    () => void load(),
  );

  const markAllRead = useCallback(async () => {
    if (!supabase || !userId) return;

    // Applied locally first so the badge clears immediately; the realtime
    // update that follows reconciles it with what the database actually did.
    setState((previous) => ({
      ...previous,
      data: previous.data.map((row) => (row.read_at ? row : { ...row, read_at: new Date().toISOString() })),
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) await load();
  }, [userId, load]);

  const markRead = useCallback(
    async (id: string) => {
      if (!supabase || !userId) return;
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    [userId],
  );

  return {
    ...state,
    unreadCount: state.data.filter((row) => !row.read_at).length,
    markAllRead,
    markRead,
    reload: load,
  };
}

/** Human-readable line for a notification row. */
export function describeNotification(notification: NotificationWithActor): string {
  const who = notification.actor?.display_name ?? notification.actor?.username ?? 'Someone';

  switch (notification.type) {
    case 'follow':
      return `${who} started following you`;
    case 'post_like':
      return `${who} liked your post`;
    case 'comment_like':
      return `${who} liked your comment`;
    case 'post_comment':
      return `${who} replied to your post`;
    case 'message':
      return `${who} sent you a message`;
    case 'system':
      return notification.body ?? 'Update from CalculixHub';
  }
}
