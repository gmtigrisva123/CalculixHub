-- Run once in Supabase SQL Editor; safe to rerun. No user data is rewritten.
begin;
alter table public.profiles drop constraint if exists profiles_level_check;
alter table public.profiles add constraint profiles_level_check
  check (level in ('Foundation', 'Intermediate', 'Advanced', 'Olympiad'));
alter table public.problem_attempts drop constraint if exists problem_attempts_level_check;
alter table public.problem_attempts add constraint problem_attempts_level_check
  check (level in ('Foundation', 'Intermediate', 'Advanced', 'Olympiad'));
commit;
