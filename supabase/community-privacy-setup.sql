-- Rerunnable migration: preserves data. Apply after community-roles-setup.sql.
begin;
-- CalculixHub: what a private community keeps to itself.
--
-- The social migration hides the posts and comments of a private community
-- from everyone outside it, and community-roles-setup.sql stops outsiders
-- joining one. Everything attached to those posts was still open:
--
--   * Marks. `post_likes` and `comment_likes` were readable by anyone, signed in
--     or not, so who marked a private post, and how many did, was public.
--   * Marking and saving. The insert policies checked only whose row it was, so
--     someone outside could mark or save a private post by id. The author was
--     notified, and the counter moved.
--   * Notifications. A reply went to the author of the comment it answered, and
--     a comment or mark to the author of the post, whether or not they were
--     still in the community: someone who had left kept receiving what was said
--     there, quoted. A share written inside a private community was quoted to
--     the author of the post it shared.
--   * Email. Every new post was mailed to every learner on the server, private
--     ones included.
--   * Membership. `is_community_member(community, anyone)` answered for anyone
--     who asked, about anyone. `is_conversation_participant` did the same for
--     conversations.
--   * Realtime. A deleted row is announced to every subscriber of its table,
--     carrying its primary key, and row-level security cannot be applied to a
--     row that is gone. For memberships, marks and saves the key was the pair
--     of ids itself: leaving a private community told everyone listening who
--     had been in which one.
--
-- This file closes them. Like qa-cohort-setup.sql it adds restrictive policies
-- and triggers of its own, which rerunning an earlier file does not remove.
-- The two membership functions are the exception: they belong to
-- core-setup.sql, so they are corrected there as well as here, and a rerun of
-- either file leaves the corrected body in place.
--
-- The rule throughout: what you cannot read, you cannot act on, be told about
-- or be counted towards. Leaving a private community ends all three at once.
--
-- What it does not change:
--   * Images. `community-media` is a public bucket; a file is reached by an
--     address nobody can guess but anybody can use. Leaving a community does
--     not take back an address already seen.
--   * What a member does with what they can read. A member can still copy a
--     post out by hand.
--   * A row that is removed outright (an account deleted, say) is still
--     announced to Realtime subscribers by its id. The id names nothing that
--     can be read any more.

-- ---------------------------------------------------------------------------
-- 0. What this file stands on
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.community_members') is null or to_regclass('public.notifications') is null then
    raise exception 'Apply supabase/core-setup.sql first.';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.notifications'::regclass and attname = 'comment_id' and not attisdropped
  ) then
    raise exception 'Apply supabase/community-social-setup.sql first.';
  end if;

  -- Without the join guard a private community is open to anyone who knows its
  -- id, and nothing below would mean anything.
  if not exists (
    select 1 from pg_trigger
    where tgname = 'community_members_guard_insert'
      and tgrelid = 'public.community_members'::regclass
      and not tgisinternal
  ) then
    raise exception 'Apply supabase/community-roles-setup.sql first.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Who may read what
-- ---------------------------------------------------------------------------

-- A schema of its own, which PostgREST does not expose, so none of these can
-- be called as an RPC. They are SECURITY DEFINER because each has to see the
-- row as it is: a private community is invisible to exactly the people these
-- must refuse.
create schema if not exists privacy;
grant usage on schema privacy to anon, authenticated, service_role;

-- The private community a post sits inside, or null when nothing walls it
-- off: no such post, no community, or a community that is open.
create or replace function privacy.wall_of(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.posts p
  join public.communities c on c.id = p.community_id
  where p.id = target and c.is_private;
$$;

create or replace function privacy.is_member(circle uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null and exists (
    select 1 from public.community_members m
    where m.community_id = circle and m.user_id = who
  );
$$;

-- Whether a wall stands between this person and this post. Whether the post
-- is deleted, or belongs to the other cohort, is for other policies to say.
create or replace function privacy.can_read_post(target uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when w.id is null then true else privacy.is_member(w.id, who) end
  from (select privacy.wall_of(target) as id) w;
$$;

-- The post a notification is about, if it is about one. The core triggers
-- name it as the entity; the community triggers fill the two columns added
-- for them.
create or replace function privacy.post_behind(about_post uuid, about_comment uuid, entity_kind text, entity uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    about_post,
    case entity_kind
      when 'post' then entity
      when 'comment' then (select c.post_id from public.comments c where c.id = entity)
    end,
    (select c.post_id from public.comments c where c.id = about_comment)
  );
$$;

-- For the policy on notifications. It answers only about the caller.
create or replace function privacy.viewer_may_open(about_post uuid, about_comment uuid, entity_kind text, entity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privacy.can_read_post(privacy.post_behind(about_post, about_comment, entity_kind, entity), auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 2. Membership is answered to the member
-- ---------------------------------------------------------------------------

-- Both functions are SECURITY DEFINER so that a policy can ask about the
-- caller without re-entering itself. They took the person as an argument and
-- trusted it, and in the public schema a function is also an RPC: anyone could
-- ask whether anyone else was in a community, or in a conversation.
--
-- They now answer about somebody else only where the answer does not travel
-- back to a client, and say a plain "no" everywhere else (never null, which
-- would be an answer of its own):
--   * inside a trigger, where it feeds a decision (the notification triggers
--     ask whether the person mentioned may be told);
--   * for a request that is not a learner's at all: the service role, the SQL
--     Editor, a scheduled job. Both the role the request runs as and the role
--     in its token have to say so.
-- A conversation also answers to its own participants, who can read the list
-- of participants anyway; start_conversation relies on that to find a thread
-- two people already share.
--
-- Defined in core-setup.sql with these same bodies.
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
  )
  and coalesce(
    who = auth.uid()
    or pg_trigger_depth() > 0
    or (
      coalesce(current_setting('role', true), '') not in ('anon', 'authenticated')
      and coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        'service_role'
      ) = 'service_role'
    ),
    false
  );
$$;

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
  )
  and coalesce(
    who = auth.uid()
    or pg_trigger_depth() > 0
    or exists (
      select 1 from public.conversation_participants me
      where me.conversation_id = target and me.user_id = auth.uid()
    )
    or (
      coalesce(current_setting('role', true), '') not in ('anon', 'authenticated')
      and coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        'service_role'
      ) = 'service_role'
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Marks and saves follow the post
-- ---------------------------------------------------------------------------

-- Restrictive policies are AND-ed with the permissive ones already on each
-- table, so they can only narrow what those allow. The sub-select runs under
-- the caller's own policies on posts and comments: a mark is readable, and
-- can be made, changed or withdrawn, exactly where the thing it marks can be
-- read. Whatever decides that later is followed without touching this file.
--
-- The two count views are `security_invoker`, so they count through the same
-- policy and need no change.

drop policy if exists privacy_wall on public.post_likes;
create policy privacy_wall on public.post_likes as restrictive for all
  using (exists (select 1 from public.posts p where p.id = post_id))
  with check (exists (select 1 from public.posts p where p.id = post_id));

drop policy if exists privacy_wall on public.comment_likes;
create policy privacy_wall on public.comment_likes as restrictive for all
  using (exists (select 1 from public.comments c where c.id = comment_id))
  with check (exists (select 1 from public.comments c where c.id = comment_id));

drop policy if exists privacy_wall on public.saved_posts;
create policy privacy_wall on public.saved_posts as restrictive for all
  using (exists (select 1 from public.posts p where p.id = post_id))
  with check (exists (select 1 from public.posts p where p.id = post_id));

-- ---------------------------------------------------------------------------
-- 4. Notifications stay inside the wall
-- ---------------------------------------------------------------------------

-- The notification triggers run as the owner and each decides its own
-- recipient: the author of the post, the author of the comment replied to,
-- the author of the post that was shared. None of them asks whether that
-- person can still read the post. Every one of them funnels into this table,
-- so the question is asked once, here, before the row is stored. A dropped
-- notification produces no email either: that trigger fires after insert.
create or replace function privacy.drop_walled_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privacy.can_read_post(privacy.post_behind(new.post_id, new.comment_id, new.entity_type, new.entity_id), new.user_id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists privacy_guard on public.notifications;
create trigger privacy_guard
  before insert on public.notifications
  for each row execute function privacy.drop_walled_notification();

-- Notifications already delivered are judged as things stand now. Someone who
-- has left a private community, or was outside one when it closed, no longer
-- sees what they were sent about it; nothing is deleted, so it is theirs again
-- if they are let back in.
drop policy if exists privacy_wall on public.notifications;
create policy privacy_wall on public.notifications as restrictive for all
  using (privacy.viewer_may_open(post_id, comment_id, entity_type, entity_id))
  with check (privacy.viewer_may_open(post_id, comment_id, entity_type, entity_id));

-- ---------------------------------------------------------------------------
-- 5. A share stays inside too
-- ---------------------------------------------------------------------------

-- A share carries the id of the post it shares, and the feed shows that post
-- to whoever can read it. Shared anywhere else, a private post would be a
-- reference its readers cannot follow, and a public record of who can.
--
-- Fires after posts_prepare_insert (triggers on one event run in name order),
-- which has already turned a share of a share into a share of the original.
-- Only a member is told the reason; to anyone else the post does not exist,
-- and they are told what posts_prepare_insert would have told them.
create or replace function privacy.keep_share_inside()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wall uuid;
begin
  if new.shared_post_id is null then
    return new;
  end if;

  wall := privacy.wall_of(new.shared_post_id);
  if wall is null or new.community_id is not distinct from wall then
    return new;
  end if;

  if auth.uid() is null or privacy.is_member(wall, auth.uid()) then
    raise exception 'A post from a private community can only be shared inside it' using errcode = '23514';
  end if;
  raise exception 'That post is no longer available to share' using errcode = '23514';
end;
$$;

drop trigger if exists privacy_wall on public.posts;
create trigger privacy_wall
  before insert on public.posts
  for each row execute function privacy.keep_share_inside();

-- ---------------------------------------------------------------------------
-- 6. Removing a comment
-- ---------------------------------------------------------------------------

-- remove_comment() lets the author of a post remove comments left on it, and
-- runs as the owner, so it never asked whether that author can still read the
-- post. Someone who has left a private community may withdraw what they wrote
-- themselves. They may not go on moderating a thread they can no longer see.
--
-- `pg_trigger_depth() > 1` lets through the replies removed along with a
-- comment: they are a consequence of a removal already allowed.
create or replace function privacy.guard_comment_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null
    and auth.uid() is distinct from old.author_id
    and not privacy.can_read_post(old.post_id, auth.uid()) then
    raise exception 'You do not have permission to do that' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists privacy_wall on public.comments;
create trigger privacy_wall
  before update of deleted_at on public.comments
  for each row execute function privacy.guard_comment_removal();

-- ---------------------------------------------------------------------------
-- 7. Email
-- ---------------------------------------------------------------------------

-- email-delivery-setup.sql queues one email per notification and one per new
-- post for every learner. Its broadcast now leaves out the people a private
-- post is not for; these guards hold the same line from this side, so the
-- queue is right whichever file was applied last, and stays right when things
-- change between a row being queued and being sent.
--
-- The functions are plpgsql throughout so that this file applies on a project
-- that has no email queue yet: their bodies are not resolved until they run.

-- Whether a queued email is about something its recipient can read.
create or replace function privacy.email_allowed(recipient uuid, kind text, notification uuid, post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case kind
    when 'new_post' then privacy.can_read_post(post, recipient)
    when 'notification' then coalesce(
      (
        select privacy.can_read_post(privacy.post_behind(n.post_id, n.comment_id, n.entity_type, n.entity_id), recipient)
        from public.notifications n
        where n.id = notification
      ),
      true
    )
    else true
  end;
$$;

create or replace function privacy.drop_walled_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privacy.email_allowed(new.recipient_id, new.kind, new.notification_id, new.post_id) then
    return null;
  end if;
  return new;
end;
$$;

-- Sets aside, without sending, everything queued for someone who can no
-- longer read it. Returns how many rows that was. The dispatcher's claim
-- calls it before each batch.
create or replace function privacy.sweep_email_outbox()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  set_aside integer := 0;
begin
  if to_regclass('public.email_outbox') is null then
    return 0;
  end if;

  update public.email_outbox o
     set status = 'skipped', locked_at = null, last_error = 'The recipient can no longer read this.'
   where o.status in ('pending', 'sending')
     and not privacy.email_allowed(o.recipient_id, o.kind, o.notification_id, o.post_id);

  get diagnostics set_aside = row_count;
  return set_aside;
end;
$$;

-- Leaving a private community, by choice or not, takes the unsent mail about
-- it out of the queue in the same transaction.
create or replace function privacy.after_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regclass('public.email_outbox') is null then
    return null;
  end if;

  update public.email_outbox o
     set status = 'skipped', locked_at = null, last_error = 'The recipient can no longer read this.'
   where o.recipient_id = old.user_id
     and o.status in ('pending', 'sending')
     and not privacy.email_allowed(o.recipient_id, o.kind, o.notification_id, o.post_id);
  return null;
end;
$$;

drop trigger if exists privacy_member_left on public.community_members;
create trigger privacy_member_left
  after delete on public.community_members
  for each row execute function privacy.after_member_left();

-- So does closing a community that was open.
create or replace function privacy.after_community_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privacy.sweep_email_outbox();
  return null;
end;
$$;

drop trigger if exists privacy_community_closed on public.communities;
create trigger privacy_community_closed
  after update of is_private on public.communities
  for each row when (new.is_private and not old.is_private)
  execute function privacy.after_community_closed();

-- Puts the guard on the queue, where there is one, and sets aside what is
-- already in it. Called below, and by email-delivery-setup.sql when that file
-- is applied after this one.
create or replace function privacy.wire_email()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if to_regclass('public.email_outbox') is null then
    return;
  end if;

  drop trigger if exists privacy_guard on public.email_outbox;
  create trigger privacy_guard
    before insert on public.email_outbox
    for each row execute function privacy.drop_walled_email();

  perform privacy.sweep_email_outbox();
end;
$$;

do $$
begin
  perform privacy.wire_email();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. What a deleted row announces
-- ---------------------------------------------------------------------------

-- Realtime sends a DELETE to every subscriber of the table. It cannot check a
-- policy against a row that no longer exists, so what it sends is cut down to
-- the primary key. On these four tables the key was the pair of ids, and the
-- pair is the whole fact: this learner was in that community, marked that
-- post, saved that one. Leaving a private community announced the membership
-- to everyone listening; so did taking back a mark on a private post.
--
-- Each table gets a key that says nothing. The pair stays unique, which is
-- what `on conflict` and the 23505 the client treats as "already done" rest
-- on. Skipped where it has been done.
--
-- The column is `row_id`, not `id`, on purpose. Policies written before it
-- existed name other tables' columns without qualifying them: the update
-- policy on communities says `m.community_id = id`, meaning the community's.
-- A column called `id` on community_members would quietly become what that
-- `id` means the next time core-setup.sql was run.
do $$
declare
  spot record;
  key_name text;
  key_columns text[];
  pair_name text;
begin
  for spot in
    select * from (values
      ('community_members', 'community_id, user_id'),
      ('post_likes', 'post_id, user_id'),
      ('comment_likes', 'comment_id, user_id'),
      ('saved_posts', 'user_id, post_id')
    ) as v (tbl, pair)
  loop
    execute format('alter table public.%I add column if not exists row_id uuid not null default gen_random_uuid()', spot.tbl);

    select c.conname,
           array(
             select a.attname::text
             from unnest(c.conkey) with ordinality as k (num, pos)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num
             order by k.pos
           )
      into key_name, key_columns
      from pg_constraint c
     where c.conrelid = format('public.%I', spot.tbl)::regclass and c.contype = 'p';

    if key_columns = array['row_id'] then
      continue;
    end if;

    pair_name := spot.tbl || '_pair_key';
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = format('public.%I', spot.tbl)::regclass and c.conname = pair_name
    ) then
      execute format('alter table public.%I add constraint %I unique (%s)', spot.tbl, pair_name, spot.pair);
    end if;

    if key_name is not null then
      execute format('alter table public.%I drop constraint %I', spot.tbl, key_name);
    end if;
    execute format('alter table public.%I add constraint %I primary key (row_id)', spot.tbl, spot.tbl || '_pkey');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

-- Only the one function a policy calls is open to client roles, and it speaks
-- only about the caller. The rest are reached from triggers and from each
-- other, which run as the owner.
revoke all on all functions in schema privacy from public, anon, authenticated;
grant execute on function privacy.viewer_may_open(uuid, uuid, text, uuid) to anon, authenticated, service_role;

commit;
