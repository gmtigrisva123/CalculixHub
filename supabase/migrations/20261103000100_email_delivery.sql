-- Rerunnable migration: preserves data. Apply after qa-cohort-setup.sql.
begin;
-- CalculixHub: email delivery.
--
-- Two rules, both enforced in the database so no client can skip them:
--
--   1. Every notification a learner receives is also emailed to them.
--   2. Every new post is emailed to every other learner on the server.
--
-- Mail is never sent from inside a transaction. The triggers below only write
-- rows into `email_outbox`, in the same transaction as the notification or the
-- post, so a mail job exists exactly when the thing it describes exists. The
-- server's dispatcher (POST /api/email/dispatch) claims pending rows, renders
-- them and hands them to the mail provider. A failed send stays in the outbox
-- and is retried, up to five attempts.
--
-- The dispatcher is woken two ways, both optional and both skipped quietly
-- when unavailable:
--   * pg_net: after each insert into the outbox the database POSTs to the
--     dispatcher, so mail leaves within seconds;
--   * pg_cron: once a minute, as a backstop for a wake-up that was lost.
-- Configure both by setting the dispatcher URL and secret once:
--
--   update public.email_settings
--      set dispatch_url = 'https://<your-site>/api/email/dispatch',
--          dispatch_secret = '<same value as EMAIL_DISPATCH_SECRET>'
--    where id = 1;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table if not exists public.email_settings (
  id smallint primary key default 1 check (id = 1),
  dispatch_url text check (dispatch_url is null or dispatch_url ~ '^https?://'),
  dispatch_secret text check (dispatch_secret is null or length(dispatch_secret) >= 24),
  updated_at timestamptz not null default now()
);

insert into public.email_settings (id) values (1) on conflict (id) do nothing;

-- Holds a secret: no client role may read it, only the owner and the server.
alter table public.email_settings enable row level security;
revoke all on public.email_settings from public, anon, authenticated;
grant all on public.email_settings to service_role;

-- ---------------------------------------------------------------------------
-- The outbox
-- ---------------------------------------------------------------------------

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('notification', 'new_post')),
  notification_id uuid references public.notifications(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or length(last_error) <= 500),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'notification' and notification_id is not null)
    or (kind = 'new_post' and post_id is not null)
  )
);

-- One email per notification and one per post per recipient, however often a
-- trigger is replayed.
create unique index if not exists email_outbox_notification_key
  on public.email_outbox (recipient_id, notification_id) where kind = 'notification';
create unique index if not exists email_outbox_post_key
  on public.email_outbox (recipient_id, post_id) where kind = 'new_post';
create index if not exists email_outbox_pending_idx
  on public.email_outbox (created_at) where status in ('pending', 'sending');

-- Recipient addresses are resolved at send time from auth.users and never
-- stored here, but the queue still says who gets mail about what, so it is
-- server-only.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant all on public.email_outbox to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Who may be mailed
-- ---------------------------------------------------------------------------

-- An address mail can actually reach: present, not suspended, and not one of
-- the reserved `.invalid` addresses the community seed accounts use.
create or replace function public.email_recipient_ok(who uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from auth.users u
    where u.id = who
      and u.email is not null
      and u.email !~* '\.invalid$'
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

-- QA accounts and learners never meet (qa-cohort-setup.sql), and that includes
-- their mailboxes. Resolved dynamically so this file also applies on a project
-- that has not installed the cohort yet.
create or replace function public.email_same_cohort(a uuid, b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  same boolean;
begin
  if to_regprocedure('cohort.is_qa(uuid)') is null then
    return true;
  end if;
  execute 'select cohort.is_qa($1) = cohort.is_qa($2)' into same using a, b;
  return coalesce(same, true);
end;
$$;

revoke all on function public.email_recipient_ok(uuid) from public, anon, authenticated;
revoke all on function public.email_same_cohort(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enqueueing
-- ---------------------------------------------------------------------------

-- Rule 1. Runs after the cohort guard and the dedupe index, so only a
-- notification that was actually stored produces mail.
create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.email_recipient_ok(new.user_id) then
    insert into public.email_outbox (recipient_id, kind, notification_id)
    values (new.user_id, 'notification', new.id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email
  after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- Rule 2. One row per learner, so each delivery is tracked and retried on its
-- own. The author is not told about their own post.
create or replace function public.enqueue_post_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.email_outbox (recipient_id, kind, post_id)
  select u.id, 'new_post', new.id
  from auth.users u
  where u.id <> new.author_id
    and public.email_recipient_ok(u.id)
    and public.email_same_cohort(u.id, new.author_id)
  on conflict do nothing;
  return null;
end;
$$;

drop trigger if exists posts_enqueue_email on public.posts;
create trigger posts_enqueue_email
  after insert on public.posts
  for each row execute function public.enqueue_post_broadcast();

revoke all on function public.enqueue_notification_email() from public, anon, authenticated;
revoke all on function public.enqueue_post_broadcast() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Waking the dispatcher
-- ---------------------------------------------------------------------------

-- Fire-and-forget. pg_net queues the request and sends it after commit; any
-- failure here is downgraded to a warning, because a missed wake-up only delays
-- mail until the next one and must never roll back a post.
create or replace function public.kick_email_dispatch()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target text;
  secret text;
begin
  if to_regnamespace('net') is null then
    return;
  end if;
  select dispatch_url, dispatch_secret into target, secret from public.email_settings where id = 1;
  if target is null or secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using target, '{}'::jsonb,
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret);
exception when others then
  raise warning 'email dispatch wake-up skipped: %', sqlerrm;
end;
$$;

revoke all on function public.kick_email_dispatch() from public, anon, authenticated;

create or replace function public.email_outbox_kick()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.kick_email_dispatch();
  return null;
end;
$$;

revoke all on function public.email_outbox_kick() from public, anon, authenticated;

-- Per statement, so a broadcast to every learner wakes the dispatcher once.
drop trigger if exists email_outbox_kick on public.email_outbox;
create trigger email_outbox_kick
  after insert on public.email_outbox
  for each statement execute function public.email_outbox_kick();

-- The once-a-minute backstop, where pg_cron is installed.
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'calculixhub-email-dispatch';
    perform cron.schedule('calculixhub-email-dispatch', '* * * * *', 'select public.kick_email_dispatch()');
  end if;
exception when others then
  raise warning 'email dispatch schedule skipped: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claiming work (server only)
-- ---------------------------------------------------------------------------

-- Locks a batch with SKIP LOCKED, so two dispatchers woken together share the
-- queue instead of sending everything twice. A row left in `sending` by a
-- dispatcher that died is reclaimed after ten minutes. Everything the email
-- needs is returned with the row, so rendering costs no further queries.
create or replace function public.claim_email_outbox(batch_size integer default 50)
returns table (
  id bigint,
  kind text,
  attempts integer,
  recipient_email text,
  recipient_name text,
  payload jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select o.id
    from public.email_outbox o
    where o.attempts < 5
      and (o.status = 'pending' or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes'))
    order by o.created_at
    limit greatest(1, least(coalesce(batch_size, 50), 200))
    for update skip locked
  ),
  claimed as (
    update public.email_outbox o
       set status = 'sending', locked_at = now(), attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.*
  )
  select
    c.id,
    c.kind,
    c.attempts,
    u.email::text,
    coalesce(rp.display_name, rp.username)::text,
    case c.kind
      when 'notification' then (
        select jsonb_build_object(
          'type', n.type,
          'body', n.body,
          'entity_type', n.entity_type,
          'entity_id', n.entity_id,
          'post_id', n.post_id,
          'comment_id', n.comment_id,
          'created_at', n.created_at,
          'actor', coalesce(a.display_name, a.username)
        )
        from public.notifications n
        left join public.profiles a on a.id = n.actor_id
        where n.id = c.notification_id
      )
      else (
        select jsonb_build_object(
          'post_id', p.id,
          'body', left(p.body, 1200),
          'deleted', p.deleted_at is not null,
          'created_at', p.created_at,
          'author', coalesce(a.display_name, a.username),
          'author_username', a.username
        )
        from public.posts p
        left join public.profiles a on a.id = p.author_id
        where p.id = c.post_id
      )
    end
  from claimed c
  left join auth.users u on u.id = c.recipient_id
  left join public.profiles rp on rp.id = c.recipient_id;
end;
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

commit;
