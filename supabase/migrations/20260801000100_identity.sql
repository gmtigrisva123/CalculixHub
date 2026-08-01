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
create policy profiles_select_all
  on public.profiles for select
  using (true);

-- A profile row is created by trigger, never by a client. No insert policy is
-- defined, so no client can insert one.
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy follows_select_all
  on public.follows for select
  using (true);

-- WITH CHECK is what stops a caller writing a row that claims someone else
-- follows a target. USING alone would leave the insert path open.
create policy follows_insert_own
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy follows_delete_own
  on public.follows for delete
  using (auth.uid() = follower_id);
