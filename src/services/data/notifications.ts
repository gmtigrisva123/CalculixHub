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
import { useLiveQuery } from './liveQuery';

export interface NotificationFeed extends QueryState<NotificationWithActor[]> {
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useNotifications(userId: string | null, limit = 50): NotificationFeed {
 const [mutationError,setMutationError]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!userId)return {items:[] as NotificationWithActor[],unread:0};
  if(!supabase)throw Error('Notifications are not configured.');
  const [rows,total]=await Promise.all([
   supabase.from('notifications').select('*,actor:profiles!notifications_actor_id_fkey(id,username,display_name,avatar_url)').eq('user_id',userId).order('created_at',{ascending:false}).limit(limit),
   supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',userId).is('read_at',null)
  ]);
  if(rows.error||total.error)throw Error('Could not load notifications.');
  return {items:(rows.data??[]) as unknown as NotificationWithActor[],unread:total.count??0};
 },[userId,limit]);
 const state=useLiveQuery('notifications:'+(userId??'guest')+':'+limit,{items:[] as NotificationWithActor[],unread:0},load);
 useEffect(()=>setMutationError(null),[userId]);
 useRealtimeSubscription({table:'notifications',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'profiles',enabled:Boolean(userId)},()=>void state.reload());
 const mark=async(id?:string)=>{
  if(!supabase||!userId)return;
  let query=supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId);
  query=id?query.eq('id',id):query.is('read_at',null);
  const {error}=await query;setMutationError(error?'Could not mark notifications as read.':null);await state.reload();
 };
 return {data:state.data.items,loading:state.loading,error:mutationError??state.error,unreadCount:state.data.unread,reload:state.reload,markRead:id=>mark(id),markAllRead:()=>mark()};
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
