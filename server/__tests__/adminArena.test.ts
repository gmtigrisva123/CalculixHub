import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { checkCode, hashCode, mintAdminSession, validAdminSession } from '../adminSecurity';
const db=new PGlite();const uid='11111111-1111-4111-8111-111111111111';const aid='22222222-2222-4222-8222-222222222222';
const invoke=async(action:string,answer:string|null=null)=>{const r=await db.query<{value:any}>('select public.arena_action($1,$2,$3,$4) as value',[aid,action,'test-q',answer]);return r.rows[0].value;};
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,banned_until timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,username text);
 create table public.problem_attempts(user_id uuid,problem_id text,topic text,level text,submitted_answer text,is_correct boolean,points_awarded integer,duration_ms integer);
 insert into auth.users(id) values('${uid}');insert into profiles values('${uid}','Test learner');set test.uid='${uid}';`);
 for(const file of ['20260926000100_admin_arena.sql','20260926000200_learning_grade.sql','20260926000300_catalog_seed.sql'])await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query(`insert into public.arenas(id,title,starts_at,ends_at,duration_minutes,status,questions) values($1,'Test match',now()-interval '1 hour',now()+interval '1 day',45,'published',$2)`,[aid,JSON.stringify([{id:'test-q',question:'Find the integer.',correctAnswer:'123',solution:'A worked solution.',points:67,difficulty:.28}])]);
},30000);
afterAll(()=>db.close());
describe('Admin credential boundary',()=>{
 it('hashes codes and rejects malformed hashes',()=>{const hash=hashCode('test-long-secret');expect(checkCode('test-long-secret',hash)).toBe(true);expect(checkCode('wrong',hash)).toBe(false);expect(checkCode('x','invalid')).toBe(false);expect(hash).not.toContain('test-long-secret');});
 it('binds elevated sessions to account, version and signing secret',()=>{const token=mintAdminSession(uid,3,'server-secret');expect(validAdminSession(token,uid,3,'server-secret')).toBe(true);expect(validAdminSession(token,uid,4,'server-secret')).toBe(false);expect(validAdminSession(token,'other',3,'server-secret')).toBe(false);expect(validAdminSession(token,uid,3,'other')).toBe(false);expect(validAdminSession(token+'x',uid,3,'server-secret')).toBe(false);});
});
describe('Real SQL Arena rules',()=>{
 it('seeds the full bank and restricts direct student writes',async()=>{expect((await db.query('select count(*)::int as count from problem_catalog')).rows[0]).toEqual({count:124});const r=await db.query(`select has_table_privilege('authenticated','public.arena_entries','INSERT') as entries,has_table_privilege('anon','public.admin_settings','SELECT') as secrets`);expect(r.rows[0]).toEqual({entries:false,secrets:false});});
 it('withholds questions before starting and answer keys during a match',async()=>{await expect(invoke('view')).rejects.toThrow('Register');expect((await invoke('register')).questions).toEqual([]);const v=await invoke('start');expect(v.questions[0].correctAnswer).toBeUndefined();expect(v.questions[0].solution).toBeUndefined();});
 it('prevents rewriting a started match',async()=>{await expect(db.query(`update arenas set duration_minutes=60 where id=$1`,[aid])).rejects.toThrow('immutable');});
 it('awards server points once, while only the first response changes IRT',async()=>{const wrong=await invoke('submit','100');expect(wrong.entry.score).toBe(0);const right=await invoke('submit','0123');expect(right.entry.score).toBe(67);expect(right.entry.theta).toBeCloseTo(wrong.entry.theta,10);expect(right.entry.sem).toBeLessThan(1);await expect(invoke('submit','123')).rejects.toThrow('closed');const end=await invoke('finish');expect(end.questions[0].solution).toBeDefined();expect(end.leaderboard[0].score).toBe(67);});
 it('isolates users and closes after three wrong answers',async()=>{const other='33333333-3333-4333-8333-333333333333';await db.exec(`insert into auth.users(id) values('${other}');set test.uid='${other}';`);await expect(invoke('view')).rejects.toThrow('Register');await invoke('register');await invoke('start');await invoke('submit','0');await invoke('submit','0');const v=await invoke('submit','0');expect(v.entry.answers['test-q'].finished).toBe(true);expect(v.entry.score).toBe(0);await expect(invoke('submit','123')).rejects.toThrow('closed');});
});

describe('Persistence and exhaustion',()=>{
 it('locks a passed question without points',async()=>{
  const id='44444444-4444-4444-8444-444444444444';await db.exec(`insert into auth.users(id) values('${id}');set test.uid='${id}';`);
  await invoke('register');await invoke('start');const v=await invoke('forfeit');expect(v.entry.score).toBe(0);expect(v.entry.answers['test-q'].forfeited).toBe(true);await expect(invoke('submit','123')).rejects.toThrow('closed');
 });
 it('enforces elapsed server time',async()=>{
  const id='55555555-5555-4555-8555-555555555555';await db.exec(`insert into auth.users(id) values('${id}');set test.uid='${id}';`);
  await invoke('register');await invoke('start');await db.query(`update arena_entries set started_at=now()-interval '1 hour' where user_id=$1`,[id]);
  await expect(invoke('submit','123')).rejects.toThrow('active');expect((await invoke('view')).entry.finished_at).toBeTruthy();
 });
 it('grades Learn from the stored answer and reward, with persistent limits',async()=>{
  await db.query('insert into problem_catalog(id,document) values($1,$2)',['learn-test',JSON.stringify({correctAnswer:'42',points:73,topic:'Algebra',level:'Advanced'})]);
  const grade=async(answer:string)=>(await db.query<{value:any}>(`select learning_grade('learn-test',$1) as value`,[answer])).rows[0].value;
  await grade('1');await grade('2');expect((await grade('0042')).pointsAwarded).toBe(73);expect((await grade('42')).pointsAwarded).toBe(0);
  expect((await grade('42')).status).toBe('exhausted');
 });
 it('denies proof items that are staged for Pro',async()=>{
  await db.query('insert into problem_catalog(id,document) values($1,$2)',['locked-test',JSON.stringify({proOnly:true,correctAnswer:'42',points:73})]);
  await expect(db.query(`select learning_grade('locked-test','42')`)).rejects.toThrow('unavailable');
 });
});

it('reapplies setup without deleting matches, results or settings',async()=>{
 const before=await db.query('select count(*)::int as n from arena_entries');
 await db.exec('update admin_settings set version=9,code_enabled=false where id=1');
 await db.exec(readFileSync(new URL('../../supabase/admin-arena-setup.sql',import.meta.url),'utf8'));
 expect((await db.query('select count(*)::int as n from arena_entries')).rows).toEqual(before.rows);
 expect((await db.query('select version,code_enabled from admin_settings where id=1')).rows[0]).toEqual({version:9,code_enabled:false});
});
