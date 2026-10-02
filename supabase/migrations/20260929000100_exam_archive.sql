-- Saved exam sessions belong to one learner. Archive scores do not affect points.
create table if not exists public.exam_archive_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id text not null,
  saved boolean not null default true,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  current_index integer not null default 0 check (current_index >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

alter table public.exam_archive_progress enable row level security;
drop policy if exists exam_archive_own_select on public.exam_archive_progress;
drop policy if exists exam_archive_own_insert on public.exam_archive_progress;
drop policy if exists exam_archive_own_update on public.exam_archive_progress;
drop policy if exists exam_archive_own_delete on public.exam_archive_progress;
create policy exam_archive_own_select on public.exam_archive_progress for select to authenticated using (auth.uid() = user_id);
create policy exam_archive_own_insert on public.exam_archive_progress for insert to authenticated with check (auth.uid() = user_id);
create policy exam_archive_own_update on public.exam_archive_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exam_archive_own_delete on public.exam_archive_progress for delete to authenticated using (auth.uid() = user_id);
revoke all on public.exam_archive_progress from anon, authenticated;
grant select, insert, update, delete on public.exam_archive_progress to authenticated;
