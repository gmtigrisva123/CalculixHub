-- Apply after core-setup.sql (and the other setup files). Safe to rerun; preserves user data.
-- Community Solutions: reactions, edits, shares, threaded replies, comment removal, images and notifications.
-- Rerunnable migration: adds columns, named triggers, policies and views only; preserves data.
begin;
-- CalculixHub: a social feed for Community Solutions.
--
-- Builds on `20260801000300_social.sql` without redefining anything it owns,
-- so rerunning core-setup.sql afterwards cannot revert what is added here:
--
--   * reactions (like, love, care, haha, wow, sad, angry) on posts and comments
--   * edits, stamped by the database rather than claimed by the client
--   * shares, which are posts that quote another post
--   * one level of threaded replies under a comment
--   * the author of a post may remove comments left on it
--   * images on posts and comments, stored in the `community-media` bucket
--   * notifications for replies, @mentions, shares and comment reactions
--
-- No existing policy is replaced. The new permissions are an update policy on
-- each reaction table -- PostgreSQL ORs permissive policies together, so the
-- originals keep their exact meaning -- one narrow function for removing a
-- comment, and upload rights confined to each learner's own storage folder.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

-- `edited_at` rather than `updated_at`: the counter triggers touch
-- `updated_at` every time someone likes a post, so it cannot tell a reworded
-- post from a popular one.
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists edited_at timestamptz;

-- A loose reference rather than a foreign key, on purpose. With `on delete set
-- null`, deleting an account would null out every share of its posts, and an
-- empty share with no original fails the body check below -- which would make
-- the account impossible to delete. A dangling id renders as "unavailable",
-- exactly as a soft-deleted original does.
alter table public.posts add column if not exists shared_post_id uuid;
alter table public.posts add column if not exists share_count integer not null default 0 check (share_count >= 0);

alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;

-- Who removed a comment, so that a comment removed by the post's author stays
-- removed. Null on a removed comment means its author removed it, which was
-- the only possibility before this migration.
alter table public.comments add column if not exists removed_by uuid references public.profiles(id) on delete set null;

-- Attached images, as paths inside the `community-media` storage bucket rather
-- than URLs, so a change of storage host does not strand every post. Each path
-- must sit in the author's own folder: the upload policy below already confines
-- writes there, and this keeps a post from claiming someone else's file.
alter table public.posts add column if not exists images text[] not null default '{}';
alter table public.comments add column if not exists images text[] not null default '{}';

alter table public.post_likes add column if not exists reaction text not null default 'like'
  check (reaction in ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'));
alter table public.comment_likes add column if not exists reaction text not null default 'like'
  check (reaction in ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'));

create or replace function public.valid_media_paths(paths text[], owner uuid, max_count integer)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select cardinality(paths) <= max_count
    and not exists (
      select 1 from unnest(paths) as path
      where path !~ ('^' || owner::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
    );
$$;

alter table public.posts drop constraint if exists posts_images_check;
alter table public.posts add constraint posts_images_check check (public.valid_media_paths(images, author_id, 4));
alter table public.comments drop constraint if exists comments_images_check;
alter table public.comments add constraint comments_images_check check (public.valid_media_paths(images, author_id, 1));

-- A share may go out without words of its own, and a post or comment may be
-- just a picture -- a photo of handwritten working. Anything else needs words.
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (length(body) <= 5000 and (shared_post_id is not null or length(trim(body)) >= 1 or cardinality(images) > 0));
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments add constraint comments_body_check
  check (length(body) <= 2000 and (length(trim(body)) >= 1 or cardinality(images) > 0));

create index if not exists posts_shared_idx on public.posts (shared_post_id) where shared_post_id is not null;
create index if not exists comments_parent_idx on public.comments (parent_id, created_at) where parent_id is not null;
create index if not exists comment_likes_user_idx on public.comment_likes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity on write
-- ---------------------------------------------------------------------------

-- What a client may change on its own post is the wording and the problem it
-- is filed under. Counters, authorship and the share target are owned by the
-- database. `pg_trigger_depth() > 1` lets the counter triggers through: they
-- update posts from inside another trigger, never directly from a client.
create or replace function public.guard_post_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  new.author_id := old.author_id;
  new.community_id := old.community_id;
  new.shared_post_id := old.shared_post_id;
  new.like_count := old.like_count;
  new.comment_count := old.comment_count;
  new.share_count := old.share_count;
  new.created_at := old.created_at;
  new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  return new;
end;
$$;

drop trigger if exists posts_guard_update on public.posts;
create trigger posts_guard_update
  before update on public.posts
  for each row execute function public.guard_post_update();

-- Sharing a share shares the original, as long as the original is still there
-- for this learner to see. Runs as the caller, so the lookups below see only
-- what row-level security already lets them see: a post in a private community
-- cannot be shared by someone outside it.
create or replace function public.prepare_post_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  root uuid;
begin
  -- A new post starts with no reactions, replies, shares or edits, whatever
  -- the request says.
  new.like_count := 0;
  new.comment_count := 0;
  new.share_count := 0;
  new.edited_at := null;

  if new.shared_post_id is null then
    return new;
  end if;

  select p.shared_post_id into root
  from public.posts p
  where p.id = new.shared_post_id and p.deleted_at is null;

  if not found then
    raise exception 'That post is no longer available to share' using errcode = '23514';
  end if;

  if root is not null and exists (select 1 from public.posts p where p.id = root and p.deleted_at is null) then
    new.shared_post_id := root;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_prepare_insert on public.posts;
create trigger posts_prepare_insert
  before insert on public.posts
  for each row execute function public.prepare_post_insert();

create or replace function public.sync_post_share_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.shared_post_id is not null and new.deleted_at is null then
      update public.posts set share_count = share_count + 1 where id = new.shared_post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.shared_post_id is not null and old.deleted_at is null then
      update public.posts set share_count = greatest(0, share_count - 1) where id = old.shared_post_id;
    end if;
  elsif new.shared_post_id is not null then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.posts set share_count = greatest(0, share_count - 1) where id = new.shared_post_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.posts set share_count = share_count + 1 where id = new.shared_post_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists posts_sync_share_count on public.posts;
create trigger posts_sync_share_count
  after insert or delete or update of deleted_at on public.posts
  for each row execute function public.sync_post_share_count();

-- The comment author may reword or remove their comment, and restore it if
-- they were the one who removed it. The post author, who reaches a comment
-- only through remove_comment() below, may remove it but never reword it.
create or replace function public.guard_comment_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  new.author_id := old.author_id;
  new.post_id := old.post_id;
  new.parent_id := old.parent_id;
  new.like_count := old.like_count;
  new.created_at := old.created_at;

  if auth.uid() is distinct from old.author_id then
    new.body := old.body;
    new.images := old.images;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    new.removed_by := auth.uid();
  elsif old.deleted_at is not null and new.deleted_at is null
    and auth.uid() is not distinct from old.author_id
    and (old.removed_by is null or old.removed_by = auth.uid()) then
    new.removed_by := null;
  else
    new.deleted_at := old.deleted_at;
    new.removed_by := old.removed_by;
  end if;

  new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  return new;
end;
$$;

drop trigger if exists comments_guard_update on public.comments;
create trigger comments_guard_update
  before update on public.comments
  for each row execute function public.guard_comment_update();

-- Replies nest one level, the way the feed renders them: a reply to a reply is
-- filed under the comment that started the thread.
create or replace function public.prepare_comment_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_post uuid;
  grandparent uuid;
begin
  new.like_count := 0;
  new.edited_at := null;

  if new.parent_id is null then
    return new;
  end if;

  select c.post_id, c.parent_id into parent_post, grandparent
  from public.comments c
  where c.id = new.parent_id and c.deleted_at is null;

  if not found or parent_post is distinct from new.post_id then
    raise exception 'A reply must answer a comment on the same post' using errcode = '23514';
  end if;

  if grandparent is not null then
    new.parent_id := grandparent;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_prepare_insert on public.comments;
create trigger comments_prepare_insert
  before insert on public.comments
  for each row execute function public.prepare_comment_insert();

-- Removing a comment removes the replies under it. Each reply passes through
-- comments_sync_post_count on the way, so the post's count stays exact.
create or replace function public.cascade_comment_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.comments set deleted_at = new.deleted_at, removed_by = new.removed_by
    where parent_id = new.id and deleted_at is null;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_cascade_soft_delete on public.comments;
create trigger comments_cascade_soft_delete
  after update of deleted_at on public.comments
  for each row execute function public.cascade_comment_soft_delete();

-- Changing a reaction may change only the reaction. Moving a like to another
-- post would leave both counters wrong, since they move on insert and delete.
create or replace function public.guard_post_reaction_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.post_id := old.post_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists post_likes_guard_update on public.post_likes;
create trigger post_likes_guard_update
  before update on public.post_likes
  for each row execute function public.guard_post_reaction_update();

create or replace function public.guard_comment_reaction_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.comment_id := old.comment_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists comment_likes_guard_update on public.comment_likes;
create trigger comment_likes_guard_update
  before update on public.comment_likes
  for each row execute function public.guard_comment_reaction_update();

-- ---------------------------------------------------------------------------
-- Removing a comment
-- ---------------------------------------------------------------------------

-- The post author may remove comments left on their post. That runs through
-- this function rather than an update policy: an update policy would also
-- need a select policy letting the post author read removed comments, since
-- PostgreSQL checks SELECT policies against the updated row, and removed
-- comments are meant to stay hidden from everyone but the person who wrote
-- them. The function answers one closed question -- may this caller remove
-- this comment -- and guard_comment_update still stops it rewording anything.
create or replace function public.remove_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  target public.comments%rowtype;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into target from public.comments where id = p_comment;

  if not found or not (
    target.author_id = uid
    or exists (select 1 from public.posts p where p.id = target.post_id and p.author_id = uid)
  ) then
    raise exception 'You do not have permission to do that' using errcode = '42501';
  end if;

  if target.deleted_at is null then
    update public.comments set deleted_at = now() where id = p_comment;
  end if;
end;
$$;

revoke all on function public.remove_comment(uuid) from public;
grant execute on function public.remove_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Changing a reaction
-- ---------------------------------------------------------------------------

drop policy if exists post_likes_update_own on public.post_likes;
create policy post_likes_update_own
  on public.post_likes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists comment_likes_update_own on public.comment_likes;
create policy comment_likes_update_own
  on public.comment_likes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Notifications for replies, mentions, shares and comment reactions
-- ---------------------------------------------------------------------------

-- Where a notification leads. `entity_id` names what it is about (a comment, a
-- share); these say where to open it, so the inbox can link straight to the
-- comment without a lookup per row.
alter table public.notifications add column if not exists post_id uuid;
alter table public.notifications add column if not exists comment_id uuid;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'post_like', 'comment_like', 'post_comment', 'message', 'system',
  'comment_reply', 'mention', 'post_share'
));

-- Same rules as emit_notification -- nobody is told about their own action,
-- and the dedupe index collapses repeats -- plus the two location columns.
create or replace function public.emit_community_notification(
  recipient uuid,
  actor uuid,
  notification_type text,
  entity_kind text,
  entity uuid,
  post uuid,
  comment uuid,
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

  insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, post_id, comment_id, body)
  values (recipient, actor, notification_type, entity_kind, entity, post, comment, message)
  on conflict do nothing;
end;
$$;

-- Learners named with @username in `body` and not already named in `previous`,
-- so an edit notifies only the people it adds. Capped, so one post cannot be
-- used to page the whole community.
create or replace function public.mentioned_users(body text, previous text default null)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with named as (
    select distinct lower(m[1]) as handle
    from regexp_matches(coalesce(body, ''), '(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9_]{1,22}[A-Za-z0-9])', 'g') as m
  ),
  earlier as (
    select distinct lower(m[1]) as handle
    from regexp_matches(coalesce(previous, ''), '(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9_]{1,22}[A-Za-z0-9])', 'g') as m
  )
  select p.id
  from public.profiles p
  join named n on lower(p.username) = n.handle
  where n.handle not in (select handle from earlier)
  limit 10;
$$;

create or replace function public.notify_community_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_author uuid;
  recipient uuid;
  community uuid;
  snippet text := nullif(left(new.body, 140), '');
begin
  if new.deleted_at is not null then
    return null;
  end if;

  select community_id into community from public.posts where id = new.post_id;

  if tg_op = 'INSERT' and new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.emit_community_notification(parent_author, new.author_id, 'comment_reply', 'comment', new.id, new.post_id, new.id, snippet);
  end if;

  -- The person replied to already hears about the reply; a mention of them in
  -- it would only say the same thing twice.
  for recipient in
    select m.user_id from public.mentioned_users(new.body, case when tg_op = 'UPDATE' then old.body end) m
  loop
    -- Naming someone outside a private community does not show them its posts.
    if recipient is distinct from parent_author and (community is null or public.is_community_member(community, recipient)) then
      perform public.emit_community_notification(recipient, new.author_id, 'mention', 'comment', new.id, new.post_id, new.id, snippet);
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists comments_notify_community on public.comments;
create trigger comments_notify_community
  after insert on public.comments
  for each row execute function public.notify_community_comment();

drop trigger if exists comments_notify_community_edit on public.comments;
create trigger comments_notify_community_edit
  after update of body on public.comments
  for each row when (old.body is distinct from new.body)
  execute function public.notify_community_comment();

create or replace function public.notify_community_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  original_author uuid;
  recipient uuid;
  snippet text := nullif(left(new.body, 140), '');
begin
  if new.deleted_at is not null then
    return null;
  end if;

  if tg_op = 'INSERT' and new.shared_post_id is not null then
    select author_id into original_author from public.posts where id = new.shared_post_id;
    perform public.emit_community_notification(original_author, new.author_id, 'post_share', 'post', new.id, new.id, null, snippet);
  end if;

  for recipient in
    select m.user_id from public.mentioned_users(new.body, case when tg_op = 'UPDATE' then old.body end) m
  loop
    if new.community_id is null or public.is_community_member(new.community_id, recipient) then
      perform public.emit_community_notification(recipient, new.author_id, 'mention', 'post', new.id, new.id, null, snippet);
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists posts_notify_community on public.posts;
create trigger posts_notify_community
  after insert on public.posts
  for each row execute function public.notify_community_post();

drop trigger if exists posts_notify_community_edit on public.posts;
create trigger posts_notify_community_edit
  after update of body on public.posts
  for each row when (old.body is distinct from new.body)
  execute function public.notify_community_post();

create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  comment_author uuid;
  comment_post uuid;
begin
  select author_id, post_id into comment_author, comment_post from public.comments where id = new.comment_id;
  perform public.emit_community_notification(comment_author, new.user_id, 'comment_like', 'comment', new.comment_id, comment_post, new.comment_id);
  return null;
end;
$$;

drop trigger if exists comment_likes_notify on public.comment_likes;
create trigger comment_likes_notify
  after insert on public.comment_likes
  for each row execute function public.notify_comment_like();

-- These helpers write notifications as anyone, so only triggers may call them.
-- In the public schema a SECURITY DEFINER function is otherwise reachable as an
-- RPC; emit_notification from the core migration was, which let any client
-- write a notification "from" any learner to any other.
revoke execute on function public.emit_notification(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.emit_community_notification(uuid, uuid, text, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.mentioned_users(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Image storage
-- ---------------------------------------------------------------------------

-- Public reads, because posts are public: an image URL is no more private than
-- the post that shows it. Writes and deletes are confined to the uploader's own
-- folder, `<user id>/...`. Skipped where Supabase Storage is absent, as in a
-- bare Postgres, where the rest of this migration must still apply.
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('community-media', 'community-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists community_media_insert_own on storage.objects';
  execute $policy$
    create policy community_media_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text)
  $policy$;

  execute 'drop policy if exists community_media_select_own on storage.objects';
  execute $policy$
    create policy community_media_select_own on storage.objects for select to authenticated
    using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text)
  $policy$;

  execute 'drop policy if exists community_media_delete_own on storage.objects';
  execute $policy$
    create policy community_media_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text)
  $policy$;
end $$;

-- ---------------------------------------------------------------------------
-- Reaction summaries
-- ---------------------------------------------------------------------------

-- `security_invoker` makes these read through the caller's policies rather
-- than the view owner's, so a reaction on a post the caller cannot see is not
-- counted for them.
create or replace view public.post_reaction_counts with (security_invoker = true) as
  select post_id, reaction, count(*)::integer as total
  from public.post_likes
  group by post_id, reaction;

create or replace view public.comment_reaction_counts with (security_invoker = true) as
  select comment_id, reaction, count(*)::integer as total
  from public.comment_likes
  group by comment_id, reaction;

grant select on public.post_reaction_counts, public.comment_reaction_counts to anon, authenticated;

commit;
