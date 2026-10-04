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

/**
 * Send one message to a learner, opening the direct conversation first if
 * there is none. `start_conversation` returns the existing thread when one
 * exists, so sharing twice to the same person lands in the same place.
 */
export async function sendDirectMessage(input:{targetId:string;senderId:string;body:string}):Promise<{ok:true;conversationId:string}|{ok:false;error:string}> {
 if(!supabase)return {ok:false,error:'Messaging is unavailable in this build.'};
 const body=input.body.trim();
 if(!body)return {ok:false,error:'Write a message first.'};
 if(body.length>4000)return {ok:false,error:'That message is too long (4000 characters maximum).'};
 const {data,error}=await supabase.rpc('start_conversation',{p_target:input.targetId});
 if(error||!data)return {ok:false,error:'Could not open a conversation with that learner.'};
 const sent=await supabase.from('messages').insert({conversation_id:data,sender_id:input.senderId,body});
 return sent.error?{ok:false,error:'Your message was not sent. Please retry.'}:{ok:true,conversationId:data as string};
}
