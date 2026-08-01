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
create policy communities_select_visible
  on public.communities for select
  using (
    not is_private
    or created_by = auth.uid()
    or public.is_community_member(id, auth.uid())
  );

create policy communities_insert_authenticated
  on public.communities for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

create policy communities_update_owner
  on public.communities for update
  using (exists (
    select 1 from public.community_members m
    where m.community_id = id and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
  ));

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
create policy community_members_insert_self
  on public.community_members for insert
  with check (auth.uid() = user_id);

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

create policy posts_insert_own
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and (
      community_id is null
      or public.is_community_member(community_id, auth.uid())
    )
  );

create policy posts_update_own
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Comments --------------------------------------------------------------------

-- Same reasoning as posts_select_visible: without the author clause a comment
-- author cannot soft-delete their own comment.
create policy comments_select_visible
  on public.comments for select
  using (
    (deleted_at is null or author_id = auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

create policy comments_insert_own
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null)
  );

create policy comments_update_own
  on public.comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Likes and saves --------------------------------------------------------------

create policy post_likes_select_all on public.post_likes for select using (true);
create policy post_likes_insert_own on public.post_likes for insert with check (auth.uid() = user_id);
create policy post_likes_delete_own on public.post_likes for delete using (auth.uid() = user_id);

create policy comment_likes_select_all on public.comment_likes for select using (true);
create policy comment_likes_insert_own on public.comment_likes for insert with check (auth.uid() = user_id);
create policy comment_likes_delete_own on public.comment_likes for delete using (auth.uid() = user_id);

-- Saves are private: what someone bookmarks is nobody else's business.
create policy saved_posts_select_own on public.saved_posts for select using (auth.uid() = user_id);
create policy saved_posts_insert_own on public.saved_posts for insert with check (auth.uid() = user_id);
create policy saved_posts_delete_own on public.saved_posts for delete using (auth.uid() = user_id);
