-- Rerunnable migration: preserves data. Apply after core-setup.sql.
begin;
-- CalculixHub: who holds which role in a community.
--
-- The social migration left one thing to the client that the database has to
-- own. Its insert policy on `community_members` checks a single fact:
--
--     with check (auth.uid() = user_id)
--
-- That stops a learner adding somebody else. It says nothing about `role`,
-- which is an ordinary column of the row being inserted, so any signed-in
-- learner could add themselves to any community as its owner. The update
-- policy on `communities` trusts that column, so the same learner could then
-- rename the community, make it private, and write themselves in as its
-- creator. And because the insert policy never looks at the community, a
-- private one could be joined by anyone who knew its id, after which its posts
-- were theirs to read.
--
-- (Where qa-cohort-setup.sql has also been applied, any update of a community
-- currently fails instead: the cohort policy on `communities` contains a
-- sub-select, and with it PostgreSQL treats communities -> community_members
-- -> communities as a loop and refuses to evaluate it. That is an accident of
-- how two policies combine, not a defence, and a database without that file
-- has no such accident. Nothing here depends on it either way.)
--
-- This file closes the holes with triggers rather than replacement policies.
-- A trigger this file names is not touched by rerunning an earlier file, where
-- a policy redefined here would be put back the way it was.
--
--   1. The database decides the role. Whoever created a community becomes its
--      owner when they join it and it has none; everybody else is a member,
--      whatever the request says.
--   2. A private community is not joined by asking. Only its creator may add
--      themselves. There is no invitation flow yet, so other members are added
--      with the service role until there is one.
--   3. A membership cannot be edited into something else: no client may change
--      its role, its community, its person or its date.
--   4. A community's bookkeeping is the database's. It starts with no members
--      and the current time whatever the request says, and its creator, member
--      count and creation time survive every update. Owning a community rests
--      on having created it, so `created_by` must not be something an owner
--      can hand on.
--
-- Requests with no signed-in caller (the service role, the SQL Editor, seed
-- files) are trusted to mean what they write: that is how a moderator is
-- appointed and how a member is added to a private community today.
--
-- On first application, roles that predate these guards are reset where the
-- database cannot vouch for them: every moderator, and every owner who is not
-- the community's creator. Either could have been self-assigned. Reruns skip
-- that step, so a role granted afterwards with the service role is kept.
--
-- What it cannot repair is a community whose `created_by` was already
-- rewritten by someone who took it over: there is no other record of who made
-- it. If communities existed before this file, read the list once (see
-- docs/sql-editor-setup.md) and put right any that look wrong.

-- ---------------------------------------------------------------------------
-- 0. Roles written before the guards existed
-- ---------------------------------------------------------------------------

do $$
declare
  reset_count integer;
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'community_members_guard_insert'
      and tgrelid = 'public.community_members'::regclass
      and not tgisinternal
  ) then
    return;
  end if;

  update public.community_members m
     set role = 'member'
    from public.communities c
   where c.id = m.community_id
     and (
       m.role = 'moderator'
       or (m.role = 'owner' and m.user_id is distinct from c.created_by)
     );

  get diagnostics reset_count = row_count;
  if reset_count > 0 then
    raise notice 'community roles: reset % role(s) that could have been self-assigned', reset_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 and 2. Joining
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER because it has to read the community as it is, not as the
-- caller is allowed to see it: a private community is invisible to exactly the
-- people this must refuse, and a check that could not see the row would wave
-- them through. It returns no row data and raises one message for every
-- refusal.
--
-- Every path that does not end in "the creator, and no owner yet" ends in
-- "member", including the one where the community cannot be found. That one
-- is reachable on purpose: a single statement can create a community in a
-- WITH clause and join it in its main INSERT, and the join runs first, so the
-- community is not there to be read. The foreign key still has the last word
-- on whether the row may exist at all.
create or replace function public.guard_community_member_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  target public.communities%rowtype;
begin
  if caller is null then
    return new;
  end if;

  new.role := 'member';
  new.joined_at := now();

  select * into target from public.communities c where c.id = new.community_id;
  if not found then
    return new;
  end if;

  if target.is_private and target.created_by is distinct from caller then
    raise exception 'You cannot join this community' using errcode = '42501';
  end if;

  if target.created_by = caller and not exists (
    select 1 from public.community_members m
    where m.community_id = new.community_id and m.role = 'owner'
  ) then
    new.role := 'owner';
  end if;

  return new;
end;
$$;

drop trigger if exists community_members_guard_insert on public.community_members;
create trigger community_members_guard_insert
  before insert on public.community_members
  for each row execute function public.guard_community_member_insert();

-- ---------------------------------------------------------------------------
-- 3. A membership stays what it was
-- ---------------------------------------------------------------------------

-- No policy lets a client update this table today, so this changes nothing
-- yet. It is here so that a policy added later for some other reason does not
-- quietly become a way to promote yourself, or to move a membership into a
-- community that would have refused the join.
create or replace function public.guard_community_member_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.community_id := old.community_id;
  new.user_id := old.user_id;
  new.role := old.role;
  new.joined_at := old.joined_at;
  return new;
end;
$$;

drop trigger if exists community_members_guard_update on public.community_members;
create trigger community_members_guard_update
  before update on public.community_members
  for each row execute function public.guard_community_member_update();

-- ---------------------------------------------------------------------------
-- 4. A community's bookkeeping
-- ---------------------------------------------------------------------------

-- A new community has no members and begins now, whatever the request says.
-- The counter that follows is a count of rows, and it can only be that if it
-- starts from nothing.
create or replace function public.guard_community_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.member_count := 0;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists communities_guard_insert on public.communities;
create trigger communities_guard_insert
  before insert on public.communities
  for each row execute function public.guard_community_insert();

-- An owner or moderator may reword a community and change who can see it.
-- Who created it, how many belong to it and when it began are facts, and stay
-- as the database recorded them. `pg_trigger_depth() > 1` lets through the two
-- writers that are not a client: the member counter, and the foreign key that
-- clears `created_by` when its creator's account is deleted. Both update this
-- table from inside another trigger.
create or replace function public.guard_community_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.member_count := old.member_count;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists communities_guard_update on public.communities;
create trigger communities_guard_update
  before update on public.communities
  for each row execute function public.guard_community_update();

commit;
