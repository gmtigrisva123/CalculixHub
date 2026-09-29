import { z } from 'zod';
import { adminClient, verifyAccessToken } from '../auth/supabaseAdmin';
import { checkCode, hashCode, mintAdminSession, validAdminSession } from '../adminSecurity';
import { json, readJsonBody } from '../http';
import type { RouteDefinition } from '../pipeline';
import { problems } from '../data';
import { problemScore } from '../../shared/problemScore';

const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), title: z.string().min(2).max(150), question: z.string().min(5).max(4000),
  correctAnswer: z.string().regex(/^\d{1,6}$/), solution: z.string().min(5).max(6000), hint: z.string().max(1000).default(''),
  topic: z.enum(['Algebra','Geometry','Combinatorics','Number Theory']), level: z.enum(['Foundation','Intermediate','Advanced','Olympiad']),
  figure: z.object({kind:z.enum(['triangle','circle','quadrilateral','coordinate-grid','regular-polygon']),labels:z.array(z.string().max(30)).max(20).optional(),values:z.array(z.number().finite()).max(30).optional(),construction:z.enum(['median','bisector','centers','ceva','euler-line','diagonals']).optional(),illustrative:z.boolean().optional()}).optional(),
  competition:z.enum(['AMC','AIME','USAMO','IMO']).optional(),
  estimatedSteps: z.number().int().min(1).max(15), abstraction: z.number().int().min(1).max(5),
}).transform(q => ({ ...q, type: 'text' as const, answerMode: 'numeric-grid' as const, answerDigits: Math.max(3,q.correctAnswer.length), maxAttempts: 3, points: problemScore({ ...q, answerMode: 'numeric-grid' }), difficulty: Math.max(-2.5,Math.min(2.5,(problemScore({ ...q, answerMode: 'numeric-grid' })-60)/25)) }));
const arenaSchema = z.object({ title: z.string().min(3).max(120), description: z.string().max(1200), starts_at: z.string().datetime(), ends_at: z.string().datetime(), duration_minutes: z.number().int().min(5).max(240), status: z.enum(['draft','published','closed']), questions: z.array(questionSchema).min(1).max(30) }).refine(a => Date.parse(a.ends_at)>Date.parse(a.starts_at) && new Set(a.questions.map(q=>q.id)).size===a.questions.length);
const attempts = new Map<string,{ count:number; until:number }>();

export function adminRoutes(): RouteDefinition[] {
  return [{ method:'POST',path:'/api/admin',routeClass:'read',handler:async ctx=>{
    const user = await verifyAccessToken(ctx.request.headers.get('authorization'));
    if (!user) return json({error:'Sign in before switching to Admin.'},{status:401});
    const body = await readJsonBody(ctx.request,262144);
    if (!body.ok) return body.response;
    const parsed=z.object({action:z.string().max(40),code:z.string().max(128).optional(),payload:z.unknown().optional()}).safeParse(body.value);
    if(!parsed.success) return json({error:'Invalid admin request.'},{status:400});
    const client=adminClient();
    const secret=process.env.ADMIN_SESSION_SECRET;
    if(!client || !secret) return json({error:'Server Admin configuration is missing.'},{status:503});
    const account=await client.auth.admin.getUserById(user.id);
    if(account.error || !account.data.user || account.data.user.banned_until && Date.parse(account.data.user.banned_until)>Date.now()) return json({error:'Account unavailable or suspended.'},{status:403});
    const {data:settings,error:setupError}=await client.from('admin_settings').select('*').eq('id',1).single();
    if(setupError) return json({error:'Apply the Admin/Arena database migration to enable administration.'},{status:503});
    const {data:member}=await client.from('admin_members').select('user_id').eq('user_id',user.id).maybeSingle();
    const {action,code,payload}=parsed.data;
    if(action==='unlock') {
      const key=user.id+':'+ctx.clientKey; const failed=attempts.get(key);
      if(failed && failed.until>Date.now() && failed.count>=5) return json({error:'Too many incorrect codes. Try again in 15 minutes.'},{status:429});
      const allowed=settings.code_enabled ? checkCode(code??'',settings.code_hash??process.env.ADMIN_ACCESS_CODE_HASH??'') : Boolean(member);
      if(!allowed) { attempts.set(key,{count:failed && failed.until>Date.now()?failed.count+1:1,until:Date.now()+15*60_000}); return json({error:settings.code_enabled?'The security code is incorrect.':'Code entry is disabled. An existing administrator must restore access.'},{status:403}); }
      const {error}=await client.from('admin_members').upsert({user_id:user.id},{onConflict:'user_id'});
      if(error) return json({error:'Admin access could not be granted.'},{status:503});
      attempts.delete(key);
      await client.from('admin_audit').insert({user_id:user.id,action:'unlock'});
      return json({token:mintAdminSession(user.id,settings.version,secret),expiresIn:1800,codeEnabled:settings.code_enabled});
    }
    if(!member || !validAdminSession(ctx.request.headers.get('x-admin-session')??'',user.id,settings.version,secret)) return json({error:'Admin session expired or revoked. Unlock again.'},{status:403});
    const audit=async(target?:string)=>{await client.from('admin_audit').insert({user_id:user.id,action,target});};
    if(action==='state') {
      const [arenas,catalog,auditLog,members]=await Promise.all([client.from('arenas').select('*').order('created_at',{ascending:false}),client.from('problem_catalog').select('*'),client.from('admin_audit').select('*').order('created_at',{ascending:false}).limit(50),client.from('admin_members').select('*')]);
      if(arenas.error || catalog.error || auditLog.error || members.error) return json({error:'Could not load the admin workspace.'},{status:503});
      return json({arenas:arenas.data,catalog:catalog.data,audit:auditLog.data,members:members.data,bank:problems.filter(p=>!p.proOnly),codeEnabled:settings.code_enabled});
    }
    if(action==='set-code' || action==='remove-code' || action==='revoke-sessions') {
      if(action==='set-code' && (!code || code.length<12)) return json({error:'Choose a code of at least 12 characters.'},{status:400});
      const update={version:settings.version+1,updated_at:new Date().toISOString(),...(action==='set-code'?{code_hash:hashCode(code!),code_enabled:true}:action==='remove-code'?{code_hash:null,code_enabled:false}:{})};
      const {data,error}=await client.from('admin_settings').update(update).eq('id',1).eq('version',settings.version).select('version').single();
      if(error) return json({error:'Settings changed concurrently. Unlock and retry.'},{status:409});
      await audit(); return json({token:mintAdminSession(user.id,data.version,secret),codeEnabled:action==='set-code'?true:action==='remove-code'?false:settings.code_enabled});
    }
    if(action==='save-arena') {
      const input=z.object({id:z.string().uuid().optional(),arena:arenaSchema}).safeParse(payload);
      if(!input.success) return json({error:'Check dates, duration, question IDs and numeric answers.'},{status:400});
      if(input.data.id) {
        const {data:entries}=await client.from('arena_entries').select('user_id').eq('arena_id',input.data.id).not('started_at','is',null).limit(1);
        if(entries?.length) return json({error:'A started arena cannot be edited. Close it or duplicate it.'},{status:409});
      }
      const {data,error}=await client.from('arenas').upsert({...input.data.arena,...(input.data.id?{id:input.data.id}:{}),created_by:user.id}).select('id').single();
      if(error) return json({error:'Arena could not be saved.'},{status:503});
      await audit(data.id);return json({id:data.id});
    }
    if(action==='close-arena' || action==='delete-arena') {
      const input=z.object({id:z.string().uuid(),confirmation:z.string().optional()}).safeParse(payload);
      if(!input.success || action==='delete-arena' && input.data.confirmation!=='DELETE') return json({error:'Confirm deletion with DELETE.'},{status:400});
      const result=action==='delete-arena'?await client.from('arenas').delete().eq('id',input.data.id):await client.from('arenas').update({status:'closed'}).eq('id',input.data.id);
      if(result.error) return json({error:'Arena action failed.'},{status:503});await audit(input.data.id);return json({ok:true});
    }
    if(action==='save-problem') {
      const input=questionSchema.safeParse(payload);
      if(!input.success) return json({error:'Check question fields and numeric answer.'},{status:400});
      const {error}=await client.from('problem_catalog').upsert({id:input.data.id,document:input.data,archived:false,updated_at:new Date().toISOString()});
      if(error) return json({error:'Question could not be saved.'},{status:503});await audit(input.data.id);return json({ok:true});
    }
    if(action==='archive-problem') {
      const input=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)}).safeParse(payload);
      if(!input.success)return json({error:'Invalid question ID.'},{status:400});
      const {error}=await client.from('problem_catalog').upsert({id:input.data.id,document:{},archived:true});
      if(error)return json({error:'Question could not be archived.'},{status:503});await audit(input.data.id);return json({ok:true});
    }
    if(action==='users') {
      const {data,error}=await client.auth.admin.listUsers({page:1,perPage:100});
      if(error)return json({error:'User directory unavailable.'},{status:503});
      return json({users:data.users.map(u=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,banned_until:u.banned_until}))});
    }
    if(action==='suspend-user' || action==='restore-user') {
      const input=z.object({id:z.string().uuid()}).safeParse(payload);
      if(!input.success || input.data.id===user.id)return json({error:'You cannot suspend your own account.'},{status:400});
      const {error}=await client.auth.admin.updateUserById(input.data.id,{ban_duration:action==='suspend-user'?'168h':'none'});
      if(error)return json({error:'User moderation failed.'},{status:503});await audit(input.data.id);return json({ok:true});
    }
    if(action==='results') {
      const input=z.object({id:z.string().uuid()}).safeParse(payload);
      if(!input.success)return json({error:'Invalid arena ID.'},{status:400});
      const {data,error}=await client.from('arena_entries').select('*').eq('arena_id',input.data.id);
      return error?json({error:'Results unavailable.'},{status:503}):json({entries:data});
    }
    return json({error:'Unknown admin action.'},{status:400});
  }}];
}
