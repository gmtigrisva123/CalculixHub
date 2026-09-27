/** Public platform totals come from committed database records, never browser-reported events. */
import { createClient } from '@supabase/supabase-js';
import { json } from '../http';
import type { Handler } from '../pipeline';
export const liveStatsHandler:Handler=async ctx=>{
 if(!ctx.config.supabaseUrl||!ctx.config.supabaseAnonKey)return json({error:'Platform statistics are unavailable.'},{status:503});
 const client=createClient(ctx.config.supabaseUrl,ctx.config.supabaseAnonKey,{auth:{persistSession:false}});
 const {data,error}=await client.rpc('platform_stats');
 return error?json({error:'Apply the realtime database setup to enable platform statistics.'},{status:503}):json(data);
};
// Compatibility route: browser claims cannot create platform activity or points.
export const liveStatsEventHandler:Handler=()=>json({error:'Activity is recorded from authenticated database actions.'},{status:410});
export function resetLiveStatsForTests():void {}
