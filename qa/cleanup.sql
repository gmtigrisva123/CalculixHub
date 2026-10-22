-- CalculixHub: remove every QA account and everything it created.
-- Run in the Supabase SQL Editor after a QA run. Learners' data is untouched:
-- every statement is scoped to cohort.qa_accounts.
begin;

-- What is about to go.
select
  (select count(*) from cohort.qa_accounts) as qa_accounts,
  (select count(*) from public.posts where author_id in (select user_id from cohort.qa_accounts)) as posts,
  (select count(*) from public.comments where author_id in (select user_id from cohort.qa_accounts)) as comments,
  (select count(*) from public.arenas where created_by in (select user_id from cohort.qa_accounts)) as arenas;

-- Rows that would outlive their author, or block deleting it.
delete from public.arenas where created_by in (select user_id from cohort.qa_accounts);            -- entries cascade
delete from public.conversations where created_by in (select user_id from cohort.qa_accounts);     -- participants, messages cascade
delete from public.communities where created_by in (select user_id from cohort.qa_accounts);       -- memberships cascade
delete from public.admin_audit where user_id in (select user_id from cohort.qa_accounts);

-- Uploaded images live under <user id>/ in community-media. Newer Supabase
-- projects refuse to delete storage rows from SQL; if so, the notices name the
-- folders to delete in Storage > community-media.
do $$
declare
  folder text;
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  begin
    delete from storage.objects
    where bucket_id = 'community-media'
      and (storage.foldername(name))[1] in (select user_id::text from cohort.qa_accounts);
  exception when others then
    for folder in select q.user_id::text from cohort.qa_accounts q loop
      raise notice 'Delete Storage folder community-media/% by hand (%).', folder, sqlerrm;
    end loop;
  end;
end $$;

-- The accounts. Profiles, posts, comments, reactions, follows, stats, attempts,
-- notifications, admin membership and the cohort rows cascade from auth.users.
delete from auth.users where id in (select user_id from cohort.qa_accounts);

commit;
