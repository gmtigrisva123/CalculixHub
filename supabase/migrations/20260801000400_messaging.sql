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
create policy conversations_select_participant
  on public.conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_participant(id, auth.uid())
  );

create policy conversations_insert_authenticated
  on public.conversations for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

create policy conversation_participants_select_participant
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));

-- You may add yourself to a conversation you created, or be added by an
-- existing participant. Anything else would let a stranger insert themselves
-- into a private thread.
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
create policy conversation_participants_update_own
  on public.conversation_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy conversation_participants_delete_own
  on public.conversation_participants for delete
  using (auth.uid() = user_id);

create policy messages_select_participant
  on public.messages for select
  using (deleted_at is null and public.is_conversation_participant(conversation_id, auth.uid()));

-- Both halves matter: you must be in the thread, and the message must be yours.
create policy messages_insert_participant
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy messages_update_own
  on public.messages for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);
