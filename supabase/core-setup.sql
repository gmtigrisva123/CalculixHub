-- CalculixHub core schema. Safe to rerun; keeps user rows. Run in Supabase SQL Editor.
begin;
-- 20260801000100_identity.sql
-- CalculixHub: identity.
--
-- Profiles and the follow graph. Inserts no data: every row in this database
-- originates from a real person taking a real action.
--
-- Authorization is enforced by row-level security, not by the API. That is a
-- deliberate choice over checking ownership in route handlers: RLS binds to the
-- table, so it holds for every path that ever reaches the data -- the REST API,
-- a realtime subscription, a future admin tool, a psql session. A check in a
-- handler only protects the handler that remembered to run it.
--
-- Every table below denies by default and is opened by explicit policy.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  -- Shares the primary key with auth.users, so a profile cannot outlive the
  -- account and no join table is needed to get from a session to a profile.
  id uuid primary key references auth.users(id) on delete cascade,

  -- Public handle. Format is constrained here rather than only in the client,
  -- because the client is not the only thing that writes to this column.
  --
  -- Mixed case is stored so a learner keeps the capitalisation they chose,
  -- while the unique index below folds case for collision purposes. Storing
  -- lowercase instead would be simpler but would rename people.
  username text not null
    check (length(username) between 3 and 24)
    check (username ~ '^[A-Za-z0-9](?:[A-Za-z0-9_]*[A-Za-z0-9])?$'),

  display_name text not null check (length(trim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  bio text check (bio is null or length(bio) <= 280),
  country text check (country is null or length(country) <= 56),

  -- Tier the learner practises at. Advanced by placement, not self-declared.
  level text not null default 'Foundation' check (level in ('Foundation', 'Advanced', 'Olympiad')),

  -- Denormalised social counters. Maintained by trigger in the social
  -- migration. Counting followers on every profile read is the query that
  -- stops working first as a social graph grows.
  follower_count integer not null default 0 check (follower_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),

  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness. A unique index on lower(username) rather than a
-- citext column: it is portable, it is the same one index the lookup uses, and
-- it makes the case-folding rule visible at the point it is enforced.
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- Supports "who does this user follow" and profile search.
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

comment on column public.profiles.onboarded_at is
  'Set once, when placement completes. Its presence is what stops onboarding being shown again; it is server-side so clearing browser storage cannot replay it.';

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (follower_id, following_id),
  -- Self-follow is meaningless and would inflate counters.
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profile provisioning
-- ---------------------------------------------------------------------------

-- Creates the profile row the moment an account is created.
--
-- A trigger rather than a client-side insert after sign-up: the client call can
-- fail, be interrupted, or simply not be made by a different client, leaving an
-- authenticated account with no profile -- a state every read path would then
-- have to tolerate forever. Doing it in the same transaction as the account
-- makes that state unreachable.
--
-- SECURITY DEFINER because the inserting role is GoTrue's, which has no rights
-- on public.profiles. search_path is pinned: without it, a schema earlier on the
-- caller's search_path could shadow a referenced object and run as the owner.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_username text;
  candidate text;
  suffix integer := 0;
begin
  -- Sign-up metadata is client-supplied, so it is sanitised rather than trusted:
  -- lowercased, stripped to the permitted alphabet, and length-bounded.
  requested_username := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  requested_username := regexp_replace(requested_username, '[^a-z0-9_]', '', 'g');
  requested_username := regexp_replace(requested_username, '^_+|_+$', '', 'g');

  if length(requested_username) < 3 then
    -- Derive from the email local part, then fall back to an opaque handle.
    requested_username := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
    requested_username := regexp_replace(requested_username, '^_+|_+$', '', 'g');
  end if;

  if length(requested_username) < 3 then
    requested_username := 'learner' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  requested_username := substr(requested_username, 1, 20);
  candidate := requested_username;

  -- Resolve collisions by suffixing. The unique index remains the authority;
  -- this loop only avoids surfacing a constraint violation to a new user.
  while exists (select 1 from public.profiles p where lower(p.username) = candidate) loop
    suffix := suffix + 1;
    candidate := substr(requested_username, 1, 20) || suffix::text;
    if suffix > 5000 then
      candidate := 'learner' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    -- Falls back to the username, never to the email address: display_name is
    -- public, and leaking an address into a public column is not recoverable.
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      candidate
    )
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.follows enable row level security;

-- Profiles are a public directory: a social platform cannot show an author or a
-- leaderboard without them. Only non-sensitive columns exist on this table --
-- the email address and password digest live in auth.users, which is not
-- readable through the API at all.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles for select
  using (true);

-- A profile row is created by trigger, never by a client. No insert policy is
-- defined, so no client can insert one.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists follows_select_all on public.follows;
create policy follows_select_all
  on public.follows for select
  using (true);

-- WITH CHECK is what stops a caller writing a row that claims someone else
-- follows a target. USING alone would leave the insert path open.
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own
  on public.follows for delete
  using (auth.uid() = follower_id);

-- 20260801000200_learning.sql
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

drop trigger if exists problem_attempts_apply_stats on public.problem_attempts;
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
drop policy if exists problem_attempts_select_own on public.problem_attempts;
create policy problem_attempts_select_own
  on public.problem_attempts for select
  using (auth.uid() = user_id);

-- Deliberately no INSERT, UPDATE or DELETE policy for clients.
--
-- Grading decides `is_correct` and `points_awarded`, and grading happens on the
-- server. If a client could insert here it could award itself any score, so
-- attempts are written only through the service role, which bypasses RLS. The
-- absence of a policy is the control.
drop policy if exists user_stats_select_all on public.user_stats;
create policy user_stats_select_all
  on public.user_stats for select
  using (true);

drop policy if exists skill_mastery_select_own on public.skill_mastery;
create policy skill_mastery_select_own
  on public.skill_mastery for select
  using (auth.uid() = user_id);

comment on table public.problem_attempts is
  'Append-only. Written by the server after grading; no client-facing write policy exists, which is what makes every derived statistic trustworthy.';

-- 20260801000300_social.sql
-- CalculixHub: the social graph.
--
-- Posts, comments, likes, saves and communities. The existing Community screen
-- is problem-centric discussion, so a post optionally hangs off a problem while
-- also being able to stand alone in a community.
--
-- Two rules run through every table here:
--
--   * Authorship is asserted by the database, not the client. Every insert
--     policy carries `with check (auth.uid() = author_id)`, so a row cannot be
--     written under someone else's name whatever the caller sends.
--   * Counters are maintained by trigger. A like count that a client can PATCH
--     is decoration; one derived from the rows it counts is a fact.

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' and length(slug) between 2 and 40),
  name text not null check (length(trim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 500),

  -- Private communities are readable only by members. The policy below is what
  -- enforces that; this column is only the declaration.
  is_private boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists communities_slug_key on public.communities (lower(slug));

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists community_members_user_idx on public.community_members (user_id);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,

  -- Optional anchors. A post belongs to a problem thread, a community, both, or
  -- neither (a plain feed post).
  problem_id text check (problem_id is null or problem_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  community_id uuid references public.communities(id) on delete cascade,

  body text not null check (length(trim(body)) between 1 and 5000),

  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),

  -- Soft delete: removing a post outright would cascade away the discussion
  -- underneath it. The select policy hides these; the row survives so replies
  -- keep their context and moderation stays auditable.
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_problem_idx on public.posts (problem_id, created_at desc) where deleted_at is null;
create index if not exists posts_community_idx on public.posts (community_id, created_at desc) where deleted_at is null;
create index if not exists posts_author_idx on public.posts (author_id, created_at desc) where deleted_at is null;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  like_count integer not null default 0 check (like_count >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at) where deleted_at is null;

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Likes and saves
-- ---------------------------------------------------------------------------

-- The composite primary key is the idempotency guarantee: one like per user per
-- post, enforced by the database. The previous implementation tracked votes in
-- localStorage, so clearing the browser let one person vote without limit.
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------------------------------------------------------------------------
-- Counter maintenance
-- ---------------------------------------------------------------------------

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    -- greatest(...) rather than a bare subtraction: a counter that can be
    -- driven negative by a replayed delete violates its own check constraint
    -- and takes the whole statement down.
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_sync_count on public.post_likes;
create trigger post_likes_sync_count
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_like_count();

create or replace function public.sync_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_likes_sync_count on public.comment_likes;
create trigger comment_likes_sync_count
  after insert or delete on public.comment_likes
  for each row execute function public.sync_comment_like_count();

create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  -- A soft delete has to move the counter too, or the thread advertises replies
  -- that no longer render.
  elsif old.deleted_at is null and new.deleted_at is not null then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = new.post_id;
  elsif old.deleted_at is not null and new.deleted_at is null then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_sync_post_count on public.comments;
create trigger comments_sync_post_count
  after insert or delete or update of deleted_at on public.comments
  for each row execute function public.sync_post_comment_count();

create or replace function public.sync_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  else
    update public.profiles set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_sync_counts on public.follows;
create trigger follows_sync_counts
  after insert or delete on public.follows
  for each row execute function public.sync_follow_counts();

create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(0, member_count - 1) where id = old.community_id;
  end if;
  return null;
end;
$$;

drop trigger if exists community_members_sync_count on public.community_members;
create trigger community_members_sync_count
  after insert or delete on public.community_members
  for each row execute function public.sync_community_member_count();

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------

-- Used by the policies below.
--
-- SECURITY DEFINER breaks what would otherwise be infinite recursion: a policy
-- on community_members that itself queries community_members re-enters its own
-- policy. Reading through a definer function steps outside that evaluation. It
-- is safe to do so because the function answers exactly one closed question
-- about the caller and returns no row data.
create or replace function public.is_community_member(target uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = target and m.user_id = who
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.saved_posts enable row level security;

-- Communities -----------------------------------------------------------------

-- `created_by` is part of this on purpose. An INSERT ... RETURNING is also a
-- read, so without it the creator of a private community cannot see the row
-- they just created -- membership is only inserted on the next statement. That
-- is a real failure, not a theoretical one: it made every private community
-- impossible to create.
drop policy if exists communities_select_visible on public.communities;
create policy communities_select_visible
  on public.communities for select
  using (
    not is_private
    or created_by = auth.uid()
    or public.is_community_member(id, auth.uid())
  );

drop policy if exists communities_insert_authenticated on public.communities;
create policy communities_insert_authenticated
  on public.communities for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

drop policy if exists communities_update_owner on public.communities;
create policy communities_update_owner
  on public.communities for update
  using (exists (
    select 1 from public.community_members m
    where m.community_id = id and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
  ));

drop policy if exists community_members_select_visible on public.community_members;
create policy community_members_select_visible
  on public.community_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.communities c
      where c.id = community_id and (not c.is_private or public.is_community_member(c.id, auth.uid()))
    )
  );

-- Join and leave act on your own membership only.
drop policy if exists community_members_insert_self on public.community_members;
create policy community_members_insert_self
  on public.community_members for insert
  with check (auth.uid() = user_id);

drop policy if exists community_members_delete_self on public.community_members;
create policy community_members_delete_self
  on public.community_members for delete
  using (auth.uid() = user_id);

-- Posts -----------------------------------------------------------------------

-- `or author_id = auth.uid()` is required, not a convenience.
--
-- PostgreSQL applies SELECT policies to the *new* row of an UPDATE. A soft
-- delete sets deleted_at, so with `deleted_at is null` alone the updated row
-- would fail its own visibility check and the delete would be rejected -- an
-- author could not delete their own post. Keeping the author able to see their
-- deleted rows fixes that and makes undelete possible.
--
-- Hiding deleted content from a feed is the query's job (`.is('deleted_at',
-- null)`), not this policy's. This decides *who* may see a row; the query
-- decides which rows to show.
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible
  on public.posts for select
  using (
    (deleted_at is null or author_id = auth.uid())
    and (
      community_id is null
      or exists (
        select 1 from public.communities c
        where c.id = community_id and (not c.is_private or public.is_community_member(c.id, auth.uid()))
      )
    )
  );

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and (
      community_id is null
      or public.is_community_member(community_id, auth.uid())
    )
  );

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Comments --------------------------------------------------------------------

-- Same reasoning as posts_select_visible: without the author clause a comment
-- author cannot soft-delete their own comment.
drop policy if exists comments_select_visible on public.comments;
create policy comments_select_visible
  on public.comments for select
  using (
    (deleted_at is null or author_id = auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null)
  );

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own
  on public.comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Likes and saves --------------------------------------------------------------

drop policy if exists post_likes_select_all on public.post_likes;
create policy post_likes_select_all on public.post_likes for select using (true);
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes for insert with check (auth.uid() = user_id);
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes for delete using (auth.uid() = user_id);

drop policy if exists comment_likes_select_all on public.comment_likes;
create policy comment_likes_select_all on public.comment_likes for select using (true);
drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes for delete using (auth.uid() = user_id);

-- Saves are private: what someone bookmarks is nobody else's business.
drop policy if exists saved_posts_select_own on public.saved_posts;
create policy saved_posts_select_own on public.saved_posts for select using (auth.uid() = user_id);
drop policy if exists saved_posts_insert_own on public.saved_posts;
create policy saved_posts_insert_own on public.saved_posts for insert with check (auth.uid() = user_id);
drop policy if exists saved_posts_delete_own on public.saved_posts;
create policy saved_posts_delete_own on public.saved_posts for delete using (auth.uid() = user_id);

-- 20260801000400_messaging.sql
-- CalculixHub: direct messaging.
--
-- Modelled as conversations with participants rather than a sender/recipient
-- pair on each message. A pair column reads simpler for exactly two people and
-- then has to be rebuilt the moment a group thread is wanted; participants cost
-- one extra table now and nothing later.
--
-- Message privacy is the strictest boundary in this schema. Every policy below
-- routes through `is_conversation_participant`, and there is no path that
-- exposes a message to anyone outside its thread.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- Null for a direct thread; named threads are group conversations.
  title text check (title is null or length(trim(title)) between 1 and 80),
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Drives the unread badge without a per-message read table.
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

-- Keeps the conversation list orderable without aggregating messages on read.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- SECURITY DEFINER for the same reason as `is_community_member`: a policy on
-- conversation_participants that queries conversation_participants would
-- recurse into itself.
create or replace function public.is_conversation_participant(target uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = target and p.user_id = who
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- `created_by` for the same reason as communities: INSERT ... RETURNING is a
-- read, and the creator is not yet a participant at that point.
drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant
  on public.conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_participant(id, auth.uid())
  );

drop policy if exists conversations_insert_authenticated on public.conversations;
create policy conversations_insert_authenticated
  on public.conversations for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

drop policy if exists conversation_participants_select_participant on public.conversation_participants;
create policy conversation_participants_select_participant
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));

-- You may add yourself to a conversation you created, or be added by an
-- existing participant. Anything else would let a stranger insert themselves
-- into a private thread.
drop policy if exists conversation_participants_insert on public.conversation_participants;
create policy conversation_participants_insert
  on public.conversation_participants for insert
  with check (
    public.is_conversation_participant(conversation_id, auth.uid())
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

-- Only your own read cursor.
drop policy if exists conversation_participants_update_own on public.conversation_participants;
create policy conversation_participants_update_own
  on public.conversation_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists conversation_participants_delete_own on public.conversation_participants;
create policy conversation_participants_delete_own
  on public.conversation_participants for delete
  using (auth.uid() = user_id);

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant
  on public.messages for select
  using (deleted_at is null and public.is_conversation_participant(conversation_id, auth.uid()));

-- Both halves matter: you must be in the thread, and the message must be yours.
drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
  on public.messages for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- 20260801000500_notifications.sql
-- CalculixHub: notifications and realtime.
--
-- Notifications are generated by database triggers on the actions that cause
-- them, not by the client that performed the action. A client-generated
-- notification is one the client can forge, omit, or simply fail to send when a
-- request is interrupted halfway. Generating them in the same transaction as
-- the like or the follow makes them exactly as reliable as the action itself.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Who sees it.
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Who caused it. Nullable so a system notification has no actor.
  actor_id uuid references public.profiles(id) on delete cascade,

  type text not null check (type in (
    'follow', 'post_like', 'comment_like', 'post_comment', 'message', 'system'
  )),

  -- Loose references: the target may be a post, comment or conversation, and a
  -- typed FK per kind would mean five nullable columns and five join paths.
  entity_type text check (entity_type is null or entity_type in ('post', 'comment', 'conversation', 'profile')),
  entity_id uuid,

  body text check (body is null or length(body) <= 500),

  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Serves the unread badge directly: a partial index over unread rows only,
-- which stays small no matter how much history accumulates.
create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- Collapses duplicates. Liking, unliking and re-liking a post should not
-- produce three notifications; the unique index makes the second one a no-op.
create unique index if not exists notifications_dedupe_key
  on public.notifications (user_id, actor_id, type, entity_id)
  where actor_id is not null and entity_id is not null;

-- ---------------------------------------------------------------------------
-- Generation
-- ---------------------------------------------------------------------------

-- Central insert. Self-directed notifications are dropped here rather than in
-- each caller: nobody needs telling that they liked their own post.
create or replace function public.emit_notification(
  recipient uuid,
  actor uuid,
  notification_type text,
  entity_kind text,
  entity uuid,
  message text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if recipient is null or recipient = actor then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, body)
  values (recipient, actor, notification_type, entity_kind, entity, message)
  on conflict do nothing;
end;
$$;

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_notification(new.following_id, new.follower_id, 'follow', 'profile', new.follower_id);
  return null;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

create or replace function public.notify_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  perform public.emit_notification(post_author, new.user_id, 'post_like', 'post', new.post_id);
  return null;
end;
$$;

drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify
  after insert on public.post_likes
  for each row execute function public.notify_on_post_like();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  perform public.emit_notification(
    post_author, new.author_id, 'post_comment', 'post', new.post_id,
    left(new.body, 140)
  );
  return null;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- One notification per other participant, so group threads work unchanged.
  perform public.emit_notification(
    p.user_id, new.sender_id, 'message', 'conversation', new.conversation_id,
    left(new.body, 140)
  )
  from public.conversation_participants p
  where p.conversation_id = new.conversation_id and p.user_id <> new.sender_id;

  return null;
end;
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  using (auth.uid() = user_id);

-- Marking as read is the only client-writable change. No insert policy exists:
-- notifications come from triggers, so a client cannot manufacture one that
-- appears to be from someone else.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Adds the tables whose changes clients subscribe to.
--
-- Realtime respects RLS on every broadcast, so a subscriber receives only rows
-- their policies already allow -- adding a table here does not widen access. It
-- is guarded because `supabase_realtime` is created by the platform and is
-- absent in a bare Postgres, where these migrations must still apply.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach table_name in array array['posts','comments','post_likes','comment_likes','messages','notifications','user_stats'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table %I.%I', 'public', table_name);
      end if;
    end loop;
  end if;
end $$;

-- Realtime needs the full old row to evaluate RLS on DELETE and UPDATE events;
-- the default only replicates the primary key, which is not enough to decide
-- whether a subscriber was entitled to see the row that changed.
alter table public.posts replica identity full;
alter table public.comments replica identity full;
alter table public.post_likes replica identity full;
alter table public.comment_likes replica identity full;
alter table public.messages replica identity full;
alter table public.notifications replica identity full;

commit;
