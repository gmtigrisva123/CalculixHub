-- Rerunnable migration: preserves data. Apply after every other setup file.
begin;
-- CalculixHub: the QA cohort.
--
-- Accounts that exercise the live site -- scripted browsers and agent sessions --
-- form a cohort of their own. Each cohort sees only its own people and content:
-- a learner never meets a QA account in the feed, a ranking, an arena, a
-- notification, a conversation, presence or a platform total, and a QA account
-- never reaches a learner's post, counter or inbox. Nothing renders a flag. The
-- separation is simply that the two cohorts never meet.
--
-- An account joins the cohort when it signs up with an address whose local part
-- carries the `+cxqa-` tag, e.g. team+cxqa-linh.pham@gmail.com. Plus-addressing
-- delivers every QA mailbox to one inbox the team owns, and the tag is what the
-- trigger below reads. Deleting the auth user removes the account and, by
-- cascade, everything it wrote (qa/cleanup.sql).
--
-- Everything here is additive: restrictive policies AND-ed onto the existing
-- permissive ones, and triggers of its own, so rerunning an earlier setup file
-- leaves them in place. The four SECURITY DEFINER readers at the end bypass RLS
-- and are therefore redefined with the cohort filter; rerunning
-- admin-arena-setup.sql or realtime-setup.sql restores their unfiltered bodies,
-- so reapply this file after either.

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------

-- A schema of its own, which PostgREST does not expose: no client can list the
-- cohort, and the functions the policies need are not callable as RPCs.
create schema if not exists cohort;
grant usage on schema cohort to anon, authenticated, service_role;

create table if not exists cohort.qa_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table cohort.qa_accounts enable row level security;
revoke all on cohort.qa_accounts from public, anon, authenticated;
grant all on cohort.qa_accounts to service_role;

create or replace function cohort.is_qa(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null and exists (select 1 from cohort.qa_accounts q where q.user_id = who);
$$;

-- Policies call this through `(select ...)`, so it is evaluated once per
-- statement rather than once per row.
create or replace function cohort.viewer_is_qa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.is_qa(auth.uid());
$$;

-- Parent lookups. SECURITY DEFINER so they answer from the row itself rather
-- than from what the caller can see; each returns one boolean and no row data.
create or replace function cohort.post_is_qa(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.is_qa((select p.author_id from public.posts p where p.id = target));
$$;

create or replace function cohort.comment_is_qa(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.is_qa((select c.author_id from public.comments c where c.id = target));
$$;

create or replace function cohort.community_is_qa(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.is_qa((select c.created_by from public.communities c where c.id = target));
$$;

create or replace function cohort.conversation_is_qa(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.is_qa((select c.created_by from public.conversations c where c.id = target));
$$;

revoke all on all functions in schema cohort from public;
grant execute on all functions in schema cohort to anon, authenticated, service_role;

-- Sign-ups carrying the tag join the cohort in the same transaction that
-- creates the account, so a QA account is never visible to learners, not even
-- between sign-up and its first action.
create or replace function cohort.flag_qa_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email ~* '^[^@]+\+cxqa-[^@]*@' then
    insert into cohort.qa_accounts (user_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end;
$$;

revoke all on function cohort.flag_qa_signup() from public, anon, authenticated;

drop trigger if exists cohort_flag_qa_signup on auth.users;
create trigger cohort_flag_qa_signup
  after insert on auth.users
  for each row execute function cohort.flag_qa_signup();

insert into cohort.qa_accounts (user_id)
select u.id from auth.users u where u.email ~* '^[^@]+\+cxqa-[^@]*@'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Restrictive policies are AND-ed with the permissive ones already on each
-- table, so they can only narrow what those allow. `for all` applies the same
-- condition to the rows a statement reads and to the rows it writes.

drop policy if exists cohort_isolation on public.profiles;
create policy cohort_isolation on public.profiles as restrictive for all
  using (cohort.is_qa(id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.follows;
create policy cohort_isolation on public.follows as restrictive for all
  using (cohort.is_qa(follower_id) = (select cohort.viewer_is_qa()) and cohort.is_qa(following_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(follower_id) = (select cohort.viewer_is_qa()) and cohort.is_qa(following_id) = (select cohort.viewer_is_qa()));

-- A community nobody created (seeded) is readable by both cohorts; only a
-- cohort's own communities can be joined, so membership counts stay its own.
drop policy if exists cohort_isolation on public.communities;
create policy cohort_isolation on public.communities as restrictive for all
  using (created_by is null or cohort.is_qa(created_by) = (select cohort.viewer_is_qa()))
  with check (created_by is null or cohort.is_qa(created_by) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.community_members;
create policy cohort_isolation on public.community_members as restrictive for all
  using (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.community_is_qa(community_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.community_is_qa(community_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.posts;
create policy cohort_isolation on public.posts as restrictive for all
  using (
    cohort.is_qa(author_id) = (select cohort.viewer_is_qa())
    and (shared_post_id is null or cohort.post_is_qa(shared_post_id) = (select cohort.viewer_is_qa()))
  )
  with check (
    cohort.is_qa(author_id) = (select cohort.viewer_is_qa())
    and (shared_post_id is null or cohort.post_is_qa(shared_post_id) = (select cohort.viewer_is_qa()))
  );

drop policy if exists cohort_isolation on public.comments;
create policy cohort_isolation on public.comments as restrictive for all
  using (cohort.is_qa(author_id) = (select cohort.viewer_is_qa()) and cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(author_id) = (select cohort.viewer_is_qa()) and cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.post_likes;
create policy cohort_isolation on public.post_likes as restrictive for all
  using (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.comment_likes;
create policy cohort_isolation on public.comment_likes as restrictive for all
  using (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.comment_is_qa(comment_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.comment_is_qa(comment_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.saved_posts;
create policy cohort_isolation on public.saved_posts as restrictive for all
  using (cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()))
  with check (cohort.post_is_qa(post_id) = (select cohort.viewer_is_qa()));

-- Rankings: leaderboard_view is security_invoker, so this policy and the one on
-- profiles are what rank each cohort among itself.
drop policy if exists cohort_isolation on public.user_stats;
create policy cohort_isolation on public.user_stats as restrictive for all
  using (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.conversations;
create policy cohort_isolation on public.conversations as restrictive for all
  using (cohort.is_qa(created_by) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(created_by) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.conversation_participants;
create policy cohort_isolation on public.conversation_participants as restrictive for all
  using (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.conversation_is_qa(conversation_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(user_id) = (select cohort.viewer_is_qa()) and cohort.conversation_is_qa(conversation_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.messages;
create policy cohort_isolation on public.messages as restrictive for all
  using (cohort.is_qa(sender_id) = (select cohort.viewer_is_qa()))
  with check (cohort.is_qa(sender_id) = (select cohort.viewer_is_qa()));

drop policy if exists cohort_isolation on public.notifications;
create policy cohort_isolation on public.notifications as restrictive for all
  using (actor_id is null or cohort.is_qa(actor_id) = (select cohort.viewer_is_qa()))
  with check (actor_id is null or cohort.is_qa(actor_id) = (select cohort.viewer_is_qa()));

-- ---------------------------------------------------------------------------
-- Writes made by SECURITY DEFINER code
-- ---------------------------------------------------------------------------

-- Notification triggers run as the owner, so RLS does not see them. Every one
-- of them funnels into this table: a notification from the other cohort is
-- dropped before it is stored. An @mention of a learner's handle in a QA post
-- therefore reaches nobody.
create or replace function cohort.drop_cross_cohort_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_id is not null and cohort.is_qa(new.actor_id) <> cohort.is_qa(new.user_id) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function cohort.drop_cross_cohort_notification() from public, anon, authenticated;

drop trigger if exists cohort_guard on public.notifications;
create trigger cohort_guard
  before insert on public.notifications
  for each row execute function cohort.drop_cross_cohort_notification();

-- start_conversation is SECURITY DEFINER and adds both participants itself.
-- Refusing here keeps a direct message from crossing cohorts on that path too.
create or replace function cohort.guard_conversation_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cohort.is_qa(new.user_id) <> cohort.conversation_is_qa(new.conversation_id) then
    raise exception 'Select another learner';
  end if;
  return new;
end;
$$;

revoke all on function cohort.guard_conversation_participant() from public, anon, authenticated;

drop trigger if exists cohort_guard on public.conversation_participants;
create trigger cohort_guard
  before insert on public.conversation_participants
  for each row execute function cohort.guard_conversation_participant();

-- ---------------------------------------------------------------------------
-- Entry points for the app and the server
-- ---------------------------------------------------------------------------

-- The caller's own cohort, which the client uses to pick its presence room.
-- Presence and Broadcast relay between clients without touching a table, so
-- RLS cannot separate them; separate rooms do.
create or replace function public.viewer_cohort()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when cohort.is_qa(auth.uid()) then 'qa' else 'live' end;
$$;

revoke all on function public.viewer_cohort() from public;
grant execute on function public.viewer_cohort() to anon, authenticated;

-- The Admin route uses the service-role key, which bypasses RLS, so it filters
-- with this list instead. Not callable by any client.
create or replace function public.qa_account_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(q.user_id), '{}') from cohort.qa_accounts q;
$$;

revoke all on function public.qa_account_ids() from public, anon, authenticated;
grant execute on function public.qa_account_ids() to service_role;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER readers, redefined with the cohort filter
-- ---------------------------------------------------------------------------

-- An arena belongs to the cohort of the administrator who saved it.
create or replace function public.arena_catalog() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'starts_at',starts_at,'ends_at',ends_at,'duration_minutes',duration_minutes,'status',status,'question_count',jsonb_array_length(questions)) order by starts_at), '[]')
  from public.arenas where status <> 'draft' and cohort.is_qa(created_by) = cohort.is_qa(auth.uid());
$$;
revoke all on function public.arena_catalog() from public;
grant execute on function public.arena_catalog() to anon,authenticated;

create or replace function public.arena_action(p_arena uuid,p_action text,p_problem text default null,p_answer text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid(); a public.arenas; e public.arena_entries; q jsonb; state jsonb; updated jsonb;
  correct boolean; attempts integer; points integer; expired boolean; safe_questions jsonb; rankings jsonb;
  t double precision; lp double precision; prob double precision; weight double precision;
  total double precision:=0; mean double precision:=0; square double precision:=0; item jsonb; first boolean;
begin
  if uid is null then raise exception 'Sign in to enter an arena'; end if;
  if exists(select 1 from auth.users where id=uid and banned_until>now()) then raise exception 'Account suspended'; end if;
  select * into a from public.arenas where id=p_arena and status<>'draft' for update;
  if not found then raise exception 'Arena unavailable'; end if;
  if cohort.is_qa(a.created_by) <> cohort.is_qa(uid) then raise exception 'Arena unavailable'; end if;
  if p_action='register' then
    if a.status<>'published' or now()>=a.ends_at then raise exception 'Registration closed'; end if;
    insert into public.arena_entries(arena_id,user_id) values(p_arena,uid) on conflict do nothing;
  end if;
  select * into e from public.arena_entries where arena_id=p_arena and user_id=uid for update;
  if not found then raise exception 'Register before entering'; end if;
  if p_action='start' then
    if now()<a.starts_at or now()>=a.ends_at or a.status<>'published' then raise exception 'Arena is not live'; end if;
    if e.started_at is null then
      update public.arena_entries set started_at=now() where arena_id=p_arena and user_id=uid returning * into e;
    end if;
  end if;
  expired := e.started_at is not null and (now()>=least(a.ends_at,e.started_at+make_interval(mins=>a.duration_minutes)) or a.status='closed');
  if expired and e.finished_at is null then
    update public.arena_entries set finished_at=now() where arena_id=p_arena and user_id=uid returning * into e;
  end if;
  if p_action in ('submit','forfeit') then
    if e.started_at is null or e.finished_at is not null then raise exception 'Attempt is not active'; end if;
    select value into q from jsonb_array_elements(a.questions) where value->>'id'=p_problem;
    if q is null then raise exception 'Question unavailable'; end if;
    state:=coalesce(e.answers->p_problem,'{"count":0,"finished":false}');
    if (state->>'finished')::boolean then raise exception 'Question already closed'; end if;
    attempts:=(state->>'count')::integer+1;
    if length(coalesce(p_answer,''))>256 then raise exception 'Answer too long'; end if;
    correct:=p_action='submit' and case when trim(coalesce(p_answer,'')) ~ '^\d+$' then coalesce(nullif(ltrim(trim(p_answer),'0'),''),'0')=coalesce(nullif(ltrim(q->>'correctAnswer','0'),''),'0') else false end;
    points:=case when correct then (q->>'points')::integer else 0 end;
    updated:=jsonb_build_object('count',attempts,'finished',correct or attempts>=3 or p_action='forfeit','correct',correct,'forfeited',not correct and (attempts>=3 or p_action='forfeit'),'first_correct',case when attempts=1 then correct else (state->>'first_correct')::boolean end);
    e.answers:=jsonb_set(e.answers,array[p_problem],updated,true);
    -- EAP over an N(0,1) prior, 81 quadrature points; only the first response
    -- contributes. Editorial item priors are explicitly provisional.
    for i in 0..80 loop
      t:=-4+i*0.1; lp:=-t*t/2;
      for item in select value from jsonb_array_elements(a.questions) loop
        if e.answers ? (item->>'id') then
          first:=(e.answers->(item->>'id')->>'first_correct')::boolean;
          prob:=1/(1+exp(-(t-(item->>'difficulty')::double precision)));
          lp:=lp+case when first then ln(greatest(prob,1e-12)) else ln(greatest(1-prob,1e-12)) end;
        end if;
      end loop;
      weight:=exp(lp); total:=total+weight; mean:=mean+t*weight; square:=square+t*t*weight;
    end loop;
    update public.arena_entries set answers=e.answers,score=score+points,theta=mean/total,sem=sqrt(greatest(0,square/total-(mean/total)^2))
      where arena_id=p_arena and user_id=uid returning * into e;
  elsif p_action='finish' then
    if e.started_at is null then raise exception 'Start before finishing'; end if;
    update public.arena_entries set finished_at=coalesce(finished_at,now()) where arena_id=p_arena and user_id=uid returning * into e;
  elsif p_action not in ('register','start','view') then raise exception 'Unknown arena action'; end if;
  select coalesce(jsonb_agg(case when e.finished_at is not null then value else value-'correctAnswer'-'solution'-'hint' end),'[]') into safe_questions from jsonb_array_elements(a.questions);
  if e.started_at is null then safe_questions:='[]'; end if;
  select coalesce(jsonb_agg(row),'[]') into rankings from (
    select jsonb_build_object('name',coalesce(p.username,'Learner'),'score',s.score,'theta',round(s.theta::numeric,2),'sem',round(s.sem::numeric,2)) as row
    from public.arena_entries s left join public.profiles p on p.id=s.user_id where s.arena_id=p_arena and s.finished_at is not null
      and cohort.is_qa(s.user_id) = cohort.is_qa(uid)
    order by s.score desc,s.finished_at asc limit 50
  ) ranked;
  return jsonb_build_object('arena',jsonb_build_object('id',a.id,'title',a.title,'description',a.description,'ends_at',a.ends_at,'starts_at',a.starts_at,'duration_minutes',a.duration_minutes),
    'entry',to_jsonb(e)-'user_id','questions',safe_questions,'leaderboard',rankings,'server_time',now(),
    'deadline',case when e.started_at is null then null else least(a.ends_at,e.started_at+make_interval(mins=>a.duration_minutes)) end);
end; $$;
revoke all on function public.arena_action(uuid,text,text,text) from public;
grant execute on function public.arena_action(uuid,text,text,text) to authenticated;

-- Totals count the caller's cohort; signed-out visitors and learners see
-- learners only.
create or replace function public.platform_stats() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('registeredUsers',(select count(*) from public.profiles p where cohort.is_qa(p.id)=cohort.is_qa(auth.uid())),
 'testsCompleted',(select count(*) from public.profiles p where p.onboarded_at is not null and cohort.is_qa(p.id)=cohort.is_qa(auth.uid())),
 'problemsSolved',coalesce((select sum(s.problems_solved) from public.user_stats s where cohort.is_qa(s.user_id)=cohort.is_qa(auth.uid())),0),
 'activeContestsCount',(select count(*) from public.arenas a where a.status='published' and a.starts_at<=now() and a.ends_at>now() and cohort.is_qa(a.created_by)=cohort.is_qa(auth.uid())));
$$;
revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon,authenticated;

-- Unchanged except for the rank, which used leaderboard_view. Inside a
-- SECURITY DEFINER body that view runs as the owner, past RLS, so it ranked
-- learners against QA accounts; the rank is now taken within the cohort.
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
 select ranked.rank into position from (
  select s.user_id,rank() over (order by s.points desc,s.problems_solved desc,p.created_at asc) as rank
  from public.user_stats s join public.profiles p on p.id=s.user_id
  where s.attempts_total>0 and cohort.is_qa(s.user_id)=cohort.is_qa(uid)
 ) as ranked where ranked.user_id=uid;
 return jsonb_build_object('stats',stats,'skills',skills,'completed',completed,'attempts',attempts,'timeline',timeline,'preferences',prefs,'rank',position);
end; $$;
revoke all on function public.learning_snapshot() from public;
grant execute on function public.learning_snapshot() to authenticated;

commit;
