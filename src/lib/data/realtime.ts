/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Realtime subscriptions over Postgres changes.
 *
 * These are genuine server-pushed events: Supabase Realtime reads the database's
 * logical replication stream and forwards committed changes over a websocket.
 * Nothing here polls, and nothing simulates activity on a timer -- the previous
 * implementation's `setInterval` refetch every five seconds was neither live nor
 * cheap, and its randomised counters were not data at all.
 *
 * Row-level security is applied to every broadcast, so a subscriber receives
 * only the rows their own policies already permit. A learner subscribed to
 * `messages` sees changes in their own conversations and no others -- the same
 * rule as a direct query, enforced in the same place.
 */

import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface SubscriptionOptions {
  /** Table in the public schema, e.g. `posts`. */
  table: string;
  event?: ChangeEvent;
  /** PostgREST filter, e.g. `user_id=eq.<uuid>`. Narrows the stream server-side. */
  filter?: string;
  /** Disables the subscription without changing hook order. */
  enabled?: boolean;
}

/**
 * Subscribe to changes on a table for as long as the component is mounted.
 *
 * The handler is held in a ref and read at call time, so a caller can pass an
 * inline closure without the channel being torn down and re-established on
 * every render -- which would drop events in the gap and, on a busy feed, spend
 * more time reconnecting than listening.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  options: SubscriptionOptions,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
): void {
  const handler = useRef(onChange);
  handler.current = onChange;

  const { table, event = '*', filter, enabled = true } = options;

  useEffect(() => {
    if (!supabase || !enabled) return;

    // Distinct channel name per subscription shape. Reusing one name across
    // different filters makes the second subscriber silently inherit the
    // first's stream.
    const channel = supabase
      .channel(`realtime:${table}:${event}:${filter ?? 'all'}`)
      .on<T>(
        'postgres_changes',
        { schema: 'public', table, event, ...(filter ? { filter } : {}) },
        (payload) => handler.current(payload),
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR') {
          console.warn(`[CalculixHub] Realtime channel error on "${table}". Falling back to fetched data.`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, event, filter, enabled]);
}
