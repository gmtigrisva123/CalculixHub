begin;
create table if not exists public.realtime_signals (
 scope text primary key check(scope in ('arena','catalog','ranking','admin')),
 version bigint not null default 0, changed_at timestamptz not null default now()
);
insert into public.realtime_signals(scope) values('arena'),('catalog'),('ranking'),('admin') on conflict do nothing;
alter table public.realtime_signals enable row level security;
drop policy if exists signals_read on public.realtime_signals;
create policy signals_read on public.realtime_signals for select using(true);
revoke all on public.realtime_signals from anon,authenticated;
grant select on public.realtime_signals to anon,authenticated;
grant all on public.realtime_signals to service_role;
-- Only fixed-scope invalidations are published, never private Arena/Admin rows.
create or replace function public.touch_realtime_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.realtime_signals set version=version+1,changed_at=clock_timestamp() where scope=tg_argv[0];
 return null;
end; $$;
revoke all on function public.touch_realtime_signal() from public;
do $$
declare target text; scope_name text;
begin
 for target,scope_name in select * from (values
  ('arenas','arena'),('arena_entries','arena'),('problem_catalog','catalog'),('user_stats','ranking'),
  ('profiles','ranking'),('admin_settings','admin'),('admin_members','admin'),('admin_audit','admin')
 ) as sources(target,scope_name) loop
  execute format('drop trigger if exists refresh_live_signal on public.%I',target);
  execute format('create trigger refresh_live_signal after insert or update or delete on public.%I for each statement execute function public.touch_realtime_signal(%L)',target,scope_name);
 end loop;
end; $$;
drop trigger if exists admin_accounts_live_signal on auth.users;
create trigger admin_accounts_live_signal after insert or update or delete on auth.users for each statement execute function public.touch_realtime_signal('admin');

create table if not exists public.learner_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 goal text not null default 'Build fundamental mathematical problem-solving skills' check(length(goal) between 1 and 1000),
 pace text not null default '30 minutes / day (Recommended)' check(length(pace) between 1 and 200)
);
alter table public.learner_preferences enable row level security;
drop policy if exists preferences_own on public.learner_preferences;
create policy preferences_own on public.learner_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.learner_preferences to authenticated;

create or replace function public.learning_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stats jsonb; skills jsonb; completed jsonb; attempts jsonb; timeline jsonb; prefs jsonb; position bigint;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select to_jsonb(s)||jsonb_build_object('current_streak',case when last_active_on >= (now() at time zone 'UTC')::date-1 then current_streak else 0 end) into stats from public.user_stats s where user_id=uid;
 select coalesce(jsonb_object_agg(topic,mastery),'{}') into skills from public.skill_mastery where user_id=uid;
 select coalesce(jsonb_agg(distinct problem_id),'[]') into completed from public.problem_attempts where user_id=uid and is_correct;
 select coalesce(jsonb_object_agg(problem_id,jsonb_build_object('count',least(3,n),'finished',solved or passed or n>=3,'forfeited',not solved and (passed or n>=3))),'{}') into attempts from (
  select problem_id,count(*) filter(where submitted_answer<>'__forfeit__') as n,bool_or(is_correct) as solved,bool_or(submitted_answer='__forfeit__') as passed from public.problem_attempts where user_id=uid group by problem_id
 ) as history;
 select coalesce(jsonb_agg(to_jsonb(t) order by date),'[]') into timeline from (
  select date,points,accuracy from (
   select (created_at at time zone 'UTC')::date as date,
    sum(sum(points_awarded)) over(order by (created_at at time zone 'UTC')::date) as points,
    round(100.0*sum(count(*) filter(where is_correct)) over(order by (created_at at time zone 'UTC')::date)/sum(count(*)) over(order by (created_at at time zone 'UTC')::date),1) as accuracy
   from public.problem_attempts where user_id=uid group by (created_at at time zone 'UTC')::date
  ) as daily order by date desc limit 365
 ) as t;
 select to_jsonb(p)-'user_id' into prefs from public.learner_preferences p where user_id=uid;
 select rank into position from public.leaderboard_view where user_id=uid;
 return jsonb_build_object('stats',stats,'skills',skills,'completed',completed,'attempts',attempts,'timeline',timeline,'preferences',prefs,'rank',position);
end; $$;
revoke all on function public.learning_snapshot() from public;
grant execute on function public.learning_snapshot() to authenticated;

create or replace function public.platform_stats() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('registeredUsers',(select count(*) from public.profiles),
 'testsCompleted',(select count(*) from public.profiles where onboarded_at is not null),
 'problemsSolved',coalesce((select sum(problems_solved) from public.user_stats),0),
 'activeContestsCount',(select count(*) from public.arenas where status='published' and starts_at<=now() and ends_at>now()));
$$;
revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon,authenticated;

-- Existing publication members stay intact. No Admin/Arena private table is published here.
do $$
declare table_name text;
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
  foreach table_name in array array['realtime_signals','profiles','follows','problem_attempts','skill_mastery','learner_preferences','saved_posts','conversations','conversation_participants','messages','notifications','posts','comments','post_likes','comment_likes','user_stats','communities','community_members'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
    execute format('alter publication supabase_realtime add table public.%I',table_name);
   end if;
   execute format('alter table public.%I replica identity full',table_name);
  end loop;
 end if;
end; $$;

create or replace function public.start_conversation(p_target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid;
begin
 if uid is null or p_target=uid or not exists(select 1 from public.profiles where id=p_target) then raise exception 'Select another learner'; end if;
 if exists(select 1 from auth.users where id=uid and banned_until>now()) then raise exception 'Account suspended'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid::text,p_target::text)||':'||greatest(uid::text,p_target::text),0));
 select c.id into result from public.conversations c where c.title is null
 and public.is_conversation_participant(c.id,uid) and public.is_conversation_participant(c.id,p_target)
 and (select count(*) from public.conversation_participants where conversation_id=c.id)=2 limit 1;
 if result is null then
  insert into public.conversations(created_by) values(uid) returning id into result;
  insert into public.conversation_participants(conversation_id,user_id) values(result,uid),(result,p_target);
 end if;
 return result;
end; $$;
revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;
commit;
