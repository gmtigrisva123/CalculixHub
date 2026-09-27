-- Admin secrets remain inaccessible to anon/authenticated. Student arena writes
-- go through narrow authenticated RPCs, never through a service-role browser key.
create table if not exists public.admin_settings (
  id integer primary key check (id=1), code_hash text, code_enabled boolean not null default true,
  version integer not null default 1, updated_at timestamptz not null default now()
);
insert into public.admin_settings(id) values(1) on conflict(id) do nothing;
create table if not exists public.admin_members (user_id uuid primary key references auth.users(id) on delete cascade, granted_at timestamptz default now());
create table if not exists public.admin_audit (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null, action text not null, target text, created_at timestamptz default now());
create table if not exists public.problem_catalog (id text primary key, document jsonb not null, archived boolean not null default false, updated_at timestamptz default now());
create table if not exists public.arenas (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
  starts_at timestamptz not null, ends_at timestamptz not null, duration_minutes integer not null check(duration_minutes between 5 and 240),
  status text not null default 'draft' check(status in ('draft','published','closed')),
  questions jsonb not null check(jsonb_array_length(questions) between 1 and 30),
  created_by uuid references auth.users(id), created_at timestamptz default now(),
  check(ends_at>starts_at)
);
create table if not exists public.arena_entries (
  arena_id uuid references public.arenas(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  registered_at timestamptz default now(), started_at timestamptz, finished_at timestamptz,
  answers jsonb not null default '{}', score integer not null default 0, theta double precision not null default 0,
  sem double precision not null default 1, primary key(arena_id,user_id)
);
alter table public.admin_settings enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_audit enable row level security;
alter table public.problem_catalog enable row level security;
alter table public.arenas enable row level security;
alter table public.arena_entries enable row level security;
drop policy if exists catalog_read on public.problem_catalog;
create policy catalog_read on public.problem_catalog for select using(true);
grant select on public.problem_catalog to anon,authenticated;
revoke all on public.admin_settings,public.admin_members,public.admin_audit,public.arenas,public.arena_entries from anon,authenticated;
grant all on public.admin_settings,public.admin_members,public.admin_audit,public.problem_catalog,public.arenas,public.arena_entries to service_role;
grant usage,select on sequence public.admin_audit_id_seq to service_role;

create or replace function public.arena_catalog() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'starts_at',starts_at,'ends_at',ends_at,'duration_minutes',duration_minutes,'status',status,'question_count',jsonb_array_length(questions)) order by starts_at), '[]')
  from public.arenas where status <> 'draft';
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
    order by s.score desc,s.finished_at asc limit 50
  ) ranked;
  return jsonb_build_object('arena',jsonb_build_object('id',a.id,'title',a.title,'description',a.description,'ends_at',a.ends_at,'starts_at',a.starts_at,'duration_minutes',a.duration_minutes),
    'entry',to_jsonb(e)-'user_id','questions',safe_questions,'leaderboard',rankings,'server_time',now(),
    'deadline',case when e.started_at is null then null else least(a.ends_at,e.started_at+make_interval(mins=>a.duration_minutes)) end);
end; $$;
revoke all on function public.arena_action(uuid,text,text,text) from public;
grant execute on function public.arena_action(uuid,text,text,text) to authenticated;

-- Locking the arena row serializes starting and editing a match.
create or replace function public.guard_started_arena() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.questions is distinct from old.questions or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.duration_minutes is distinct from old.duration_minutes)
 and exists(select 1 from public.arena_entries where arena_id=old.id and started_at is not null) then
  raise exception 'Started arenas are immutable; duplicate to create a new match';
 end if;
 return new;
end;
$$;
revoke all on function public.guard_started_arena() from public;
drop trigger if exists arena_immutable on public.arenas;
create trigger arena_immutable before update on public.arenas for each row execute function public.guard_started_arena();
