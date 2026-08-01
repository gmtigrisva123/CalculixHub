-- CalculixHub: learning activity.
--
-- `problem_attempts` is the source of truth for everything this platform claims
-- about a learner. Points, accuracy, streaks, skill mastery and leaderboard rank
-- are all derived from it -- none is a number a client may set.
--
-- That inversion is the whole point. In the previous architecture the browser
-- computed its own score and stored it in localStorage, so every statistic on
-- the site was a claim by the party it flattered. Here a client can only assert
-- "I answered X"; the grade, the points and the rank are the database's
-- conclusions.

-- ---------------------------------------------------------------------------
-- Attempts: the append-only activity log
-- ---------------------------------------------------------------------------

create table if not exists public.problem_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Problems live in the server-side bank, not in a table, so this is a plain
  -- identifier rather than a foreign key. The format check keeps it from being
  -- used to smuggle anything into a query or a prompt.
  problem_id text not null check (problem_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  topic text not null check (topic in ('Algebra', 'Geometry', 'Combinatorics', 'Number Theory')),
  level text not null check (level in ('Foundation', 'Advanced', 'Olympiad')),

  submitted_answer text not null check (length(submitted_answer) <= 4000),

  -- Written by the server after grading. No client-writable path sets these:
  -- the insert policy below is what keeps a learner from awarding themselves a
  -- correct answer worth 35 points.
  is_correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),

  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  created_at timestamptz not null default now()
);

create index if not exists problem_attempts_user_idx on public.problem_attempts (user_id, created_at desc);
create index if not exists problem_attempts_problem_idx on public.problem_attempts (problem_id);

-- One scoring attempt per problem per learner. Re-practising is allowed and
-- still logged, but only the first solve can award points -- otherwise a
-- leaderboard is a measure of how many times someone pressed submit.
create unique index if not exists problem_attempts_first_solve_key
  on public.problem_attempts (user_id, problem_id)
  where points_awarded > 0;

-- ---------------------------------------------------------------------------
-- Derived per-learner statistics
-- ---------------------------------------------------------------------------

create table if not exists public.user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  points integer not null default 0 check (points >= 0),
  attempts_total integer not null default 0 check (attempts_total >= 0),
  attempts_correct integer not null default 0 check (attempts_correct >= 0),
  problems_solved integer not null default 0 check (problems_solved >= 0),
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),

  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_on date,

  updated_at timestamptz not null default now(),

  constraint user_stats_correct_within_total check (attempts_correct <= attempts_total)
);

-- Accuracy is computed on read rather than stored: a stored copy is one more
-- thing that can disagree with the counters it is derived from.
create or replace view public.user_stats_view as
  select
    s.*,
    case when s.attempts_total = 0 then null
         else round((s.attempts_correct::numeric / s.attempts_total) * 100, 1)
    end as accuracy_pct
  from public.user_stats s;

-- ---------------------------------------------------------------------------
-- Per-domain mastery
-- ---------------------------------------------------------------------------

create table if not exists public.skill_mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('Algebra', 'Geometry', 'Combinatorics', 'Number Theory')),

  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0),
  -- 0-100, so the client's existing skill map renders unchanged.
  mastery numeric(5,2) not null default 0 check (mastery between 0 and 100),
  last_activity_at timestamptz,

  primary key (user_id, topic),
  constraint skill_mastery_correct_within_attempts check (correct <= attempts)
);

-- ---------------------------------------------------------------------------
-- Statistics maintenance
-- ---------------------------------------------------------------------------

-- Folds one attempt into the learner's derived statistics.
--
-- Runs as a trigger rather than in application code so the numbers cannot drift
-- from the log: there is no way to insert an attempt and forget to update the
-- totals, and no second writer that could apply a different rule.
create or replace function public.apply_attempt_to_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_day date := (new.created_at at time zone 'utc')::date;
begin
  insert into public.user_stats (user_id) values (new.user_id)
  on conflict (user_id) do nothing;

  -- Streaks count consecutive *days with activity*, so several attempts in one
  -- day advance it once and a skipped day resets it. Derived from the stored
  -- date rather than a wall clock, so replaying the log reproduces it exactly.
  update public.user_stats s
  set
    attempts_total = s.attempts_total + 1,
    attempts_correct = s.attempts_correct + (case when new.is_correct then 1 else 0 end),
    problems_solved = s.problems_solved + (case when new.points_awarded > 0 then 1 else 0 end),
    points = s.points + new.points_awarded,
    time_spent_seconds = s.time_spent_seconds + coalesce(new.duration_ms, 0) / 1000,
    current_streak = case
      when s.last_active_on is null then 1
      when s.last_active_on = attempt_day then s.current_streak
      when s.last_active_on = attempt_day - 1 then s.current_streak + 1
      else 1
    end,
    last_active_on = greatest(coalesce(s.last_active_on, attempt_day), attempt_day),
    updated_at = now()
  where s.user_id = new.user_id;

  update public.user_stats s
  set longest_streak = greatest(s.longest_streak, s.current_streak)
  where s.user_id = new.user_id;

  -- Mastery: correct answers over attempts in the domain, held to 0-100.
  insert into public.skill_mastery (user_id, topic, attempts, correct, mastery, last_activity_at)
  values (
    new.user_id, new.topic, 1,
    case when new.is_correct then 1 else 0 end,
    case when new.is_correct then 100 else 0 end,
    new.created_at
  )
  on conflict (user_id, topic) do update
  set
    attempts = public.skill_mastery.attempts + 1,
    correct = public.skill_mastery.correct + (case when new.is_correct then 1 else 0 end),
    mastery = round(
      ((public.skill_mastery.correct + (case when new.is_correct then 1 else 0 end))::numeric
        / (public.skill_mastery.attempts + 1)) * 100, 2),
    last_activity_at = new.created_at;

  return new;
end;
$$;

create trigger problem_attempts_apply_stats
  after insert on public.problem_attempts
  for each row execute function public.apply_attempt_to_stats();

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

-- Ranked from real activity. There is no seed data behind this: an empty
-- platform shows an empty leaderboard, which is the honest rendering.
--
-- `security_invoker` makes the view evaluate RLS as the caller rather than as
-- its owner. Without it a view is a standing hole through every policy on the
-- tables beneath it.
create or replace view public.leaderboard_view
with (security_invoker = true)
as
  select
    rank() over (order by s.points desc, s.problems_solved desc, p.created_at asc) as rank,
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.country,
    p.level,
    s.points,
    s.problems_solved,
    s.current_streak,
    case when s.attempts_total = 0 then null
         else round((s.attempts_correct::numeric / s.attempts_total) * 100, 1)
    end as accuracy_pct
  from public.user_stats s
  join public.profiles p on p.id = s.user_id
  where s.attempts_total > 0;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.problem_attempts enable row level security;
alter table public.user_stats enable row level security;
alter table public.skill_mastery enable row level security;

-- An attempt log is private: it records what someone got wrong.
create policy problem_attempts_select_own
  on public.problem_attempts for select
  using (auth.uid() = user_id);

-- Deliberately no INSERT, UPDATE or DELETE policy for clients.
--
-- Grading decides `is_correct` and `points_awarded`, and grading happens on the
-- server. If a client could insert here it could award itself any score, so
-- attempts are written only through the service role, which bypasses RLS. The
-- absence of a policy is the control.
create policy user_stats_select_all
  on public.user_stats for select
  using (true);

create policy skill_mastery_select_own
  on public.skill_mastery for select
  using (auth.uid() = user_id);

comment on table public.problem_attempts is
  'Append-only. Written by the server after grading; no client-facing write policy exists, which is what makes every derived statistic trustworthy.';
