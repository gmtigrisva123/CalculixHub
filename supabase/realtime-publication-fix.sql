-- Run after realtime-setup.sql. Preserves records, RLS and private Admin/Arena access.
begin;
do $$
declare target text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Apply Supabase Realtime publication setup first';
 end if;
 foreach target in array array['communities','community_members'] loop
  if not exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables)
   and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
   execute format('alter publication supabase_realtime add table public.%I',target);
  end if;
  execute format('alter table public.%I replica identity full',target);
 end loop;
end; $$;
commit;

-- Read-only explanation of direct publication versus trigger-driven refresh.
select c.relname as object_name,
 case
  when c.relkind='v' then 'VIEW: listen to profiles/user_stats, then refetch'
  when exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=c.relname) then 'DIRECT: enabled'
  when exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='refresh_live_signal' and t.tgenabled in ('O','A') and t.tgfoid='public.touch_realtime_signal()'::regprocedure)
   and exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename='realtime_signals') then 'SIGNAL: enabled via realtime_signals'
  else 'CHECK: no realtime path detected'
 end as realtime_path
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v')
order by c.relname;
