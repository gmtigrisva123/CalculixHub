-- Rerunnable migration: preserves data. Apply after email-delivery-setup.sql.
begin;
-- CalculixHub: account controls and billing.
--
-- Four things, each enforced here rather than in a route handler:
--
--   1. `subscriptions`: which plan a learner holds. A learner may read their
--      own row and nothing else. No client can write one: there is no insert,
--      update or delete policy, so the only writer is the billing webhook,
--      which uses the service role after verifying Stripe's signature. A plan
--      that a browser could set for itself would not be a paid plan.
--   2. `plan_interest`: the list of learners who asked to hear when a plan
--      opens. A learner writes and removes only their own entry.
--   3. `reset_my_progress()`: clears the caller's own practice record.
--   4. `delete_my_account()`: removes the caller's own account and, through the
--      foreign keys every table already declares, everything that hangs off it.
--
-- The two functions are SECURITY DEFINER because the rows they remove are ones
-- no client may delete directly (attempts are append-only to a browser, and
-- `auth.users` is not reachable through the API at all). Each acts only on
-- `auth.uid()`: there is no parameter through which a caller could name
-- somebody else.

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('pro', 'team')),
  -- Stripe's own vocabulary (active, trialing, past_due, canceled, ...), stored
  -- as reported so a new status never fails the webhook that carries it.
  status text not null check (length(status) between 1 and 40),
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'yearly')),
  seats integer not null default 1 check (seats between 1 and 5000),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Interest in a plan that is not on sale yet
-- ---------------------------------------------------------------------------

create table if not exists public.plan_interest (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('pro', 'team')),
  -- For Team: a line about the club or class. Never shown to other learners.
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, plan)
);

alter table public.plan_interest enable row level security;

drop policy if exists plan_interest_select_own on public.plan_interest;
create policy plan_interest_select_own
  on public.plan_interest for select
  using (auth.uid() = user_id);

drop policy if exists plan_interest_insert_own on public.plan_interest;
create policy plan_interest_insert_own
  on public.plan_interest for insert
  with check (auth.uid() = user_id);

drop policy if exists plan_interest_update_own on public.plan_interest;
create policy plan_interest_update_own
  on public.plan_interest for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists plan_interest_delete_own on public.plan_interest;
create policy plan_interest_delete_own
  on public.plan_interest for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Reset my progress
-- ---------------------------------------------------------------------------

-- Clears the practice record: attempts, the statistics derived from them, and
-- exam-archive progress. The account, posts, messages and Arena results stay.
-- Statistics are rebuilt by trigger from the next attempt, so removing the
-- derived rows cannot leave them disagreeing with the log.
create or replace function public.reset_my_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  delete from public.problem_attempts where user_id = uid;
  delete from public.skill_mastery where user_id = uid;
  delete from public.user_stats where user_id = uid;

  -- The exam archive is a separate setup file; a project without it has
  -- nothing there to clear.
  if to_regclass('public.exam_archive_progress') is not null then
    execute 'delete from public.exam_archive_progress where user_id = $1' using uid;
  end if;
end;
$$;

revoke all on function public.reset_my_progress() from public, anon;
grant execute on function public.reset_my_progress() to authenticated;

-- ---------------------------------------------------------------------------
-- Delete my account
-- ---------------------------------------------------------------------------

-- Removes the caller from auth.users. Every table that refers to a learner
-- does so with ON DELETE CASCADE (or SET NULL where a shared thing should
-- outlive its creator), so this one delete is the whole erasure.
--
-- It refuses while a subscription is still renewing. Deleting the account
-- would not stop Stripe charging the card, and the learner would have no
-- account left from which to cancel it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'trialing', 'past_due')
      and not s.cancel_at_period_end
  ) then
    raise exception 'Cancel your subscription before deleting your account.' using errcode = 'P0001';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
