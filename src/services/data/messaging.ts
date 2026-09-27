import { useCallback } from 'react';
import { supabase } from '../supabase';
import { useLiveQuery } from './liveQuery';
import { useRealtimeSubscription } from './realtime';
import type { ConversationRow, MessageRow } from '../database.types';
export function useConversations(userId:string|null) {
 const load=useCallback(async()=>{
  if(!userId)return [] as ConversationRow[];
  if(!supabase)throw Error('Messaging is not configured.');
  const {data,error}=await supabase.from('conversations').select('*').order('last_message_at',{ascending:false,nullsFirst:false}).limit(100);
  if(error)throw Error('Could not load conversations.');return (data??[]) as ConversationRow[];
 },[userId]);
 const state=useLiveQuery('conversations:'+(userId??'guest'),[] as ConversationRow[],load);
 useRealtimeSubscription({table:'conversations',enabled:Boolean(userId),onReconnect:state.reload},()=>void state.reload());
 useRealtimeSubscription({table:'conversation_participants',filter:userId?`user_id=eq.${userId}`:undefined,enabled:Boolean(userId)},()=>void state.reload());
 return state;
}
export function useMessages(conversationId:string|null,userId:string|null) {
 const load=useCallback(async()=>{
  if(!conversationId||!userId)return [] as MessageRow[];
  if(!supabase)throw Error('Messaging is not configured.');
  const {data,error}=await supabase.from('messages').select('*').eq('conversation_id',conversationId).is('deleted_at',null).order('created_at',{ascending:false}).limit(100);
  if(error)throw Error('Could not load messages.');return ((data??[]) as MessageRow[]).reverse();
 },[conversationId,userId]);
 const state=useLiveQuery('messages:'+(userId??'guest')+':'+(conversationId??'none'),[] as MessageRow[],load);
 useRealtimeSubscription({table:'messages',filter:conversationId?`conversation_id=eq.${conversationId}`:undefined,enabled:Boolean(conversationId&&userId),onReconnect:state.reload},()=>void state.reload());
 return state;
}
