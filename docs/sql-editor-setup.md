# Running the core schema in Supabase SQL Editor

Open `supabase/core-setup.sql`, copy its complete contents, and run it in the SQL Editor of this CalculixHub project. This file contains identity, learning, social, messaging and notifications in dependency order, in one transaction. Existing user rows are preserved. It does not include Admin/Arena; that remains in `supabase/admin-arena-setup.sql`.

Each of the five original migration files is also safe to rerun individually. On a fresh project use this order: identity → learning → social → messaging → notifications. Use the updated file contents, not an older saved SQL Editor query.

PostgreSQL code 42710 means duplicate_object. Tables/indexes were already guarded, but triggers, policies and Realtime publication membership were not. The revised files replace only the explicitly named triggers and policies with their intended definitions, within a transaction. They preserve unrelated objects, rows and policy expressions. Realtime adds only missing table memberships; an absent publication is skipped, and a publication for all tables is preserved. Errors are not suppressed with a blanket duplicate_object exception.

Verification uses PostgreSQL/PGlite: first application; repeated application with existing records; RLS and counters after rerunning; recreation of missing named triggers/policies; partially populated Realtime publication; and publication for all tables. The hosted project must still receive the updated SQL through its SQL Editor because the REST service-role key cannot run DDL.

Reference: [PostgreSQL error codes](https://www.postgresql.org/docs/15/errcodes-appendix.html), [CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html).

After Admin/Arena setup, run `supabase/realtime-setup.sql` to enable the current application’s progress snapshot, private direct conversations, learner preferences and realtime invalidations. This file is also transactional and safe to rerun. See `docs/realtime-audit.md` for data sources and verification limits.

Then run `supabase/community-social-setup.sql` to turn Community Solutions into a full social feed:

- reactions (like, love, care, haha, wow, sad, angry) on posts and comments, and "Edited" labels stamped by the database;
- sharing a post to the feed, one level of threaded replies, and letting a post's author remove comments on it;
- images on posts (up to 4) and comments (1), in a public `community-media` Storage bucket where each learner may write only to their own folder (5 MB per file, PNG/JPEG/WebP/GIF);
- notifications for replies, @mentions, shares and comment reactions, each linking to the exact post or comment.

It also closes a hole in the core notifications setup: `emit_notification` was callable as an RPC, which let any client write a notification "from" anyone to anyone. Only database triggers can call it now.

The file is transactional, safe to rerun and preserves existing posts, comments and likes (existing likes become "like" reactions). It adds columns, triggers, two views, a few functions, the bucket and its policies, without redefining anything from the core files, so rerunning `core-setup.sql` afterwards does not undo it. Until it is applied, the Community screen keeps working with likes, flat comments, saving, editing and deleting, and simply does not offer the features that need the new columns. Live presence ("here now", "viewing") and "is writing a comment" use Realtime Presence and Broadcast, which need no SQL.

Then run `supabase/community-roles-setup.sql`. It makes the database, not the browser, decide who holds which role in a community (the `communities` and `community_members` tables that Circles in the Community screen are built on):

- whoever created a community becomes its owner when they join it; everybody else joins as a member, whatever role the request asks for. Before this file any signed-in learner could add themselves to any community as its owner, and an owner could then rename it, make it private and write themselves in as its creator;
- a private community can no longer be joined by someone who merely knows its id. Only its creator may add themselves. There is no invitation flow yet, so add other members with the service role (the SQL Editor);
- no client can change a membership's role, community, person or date; a new community starts with no members and the current time whatever the request says; and its creator, member count and creation time survive every update.

The first time it runs it resets the roles it cannot vouch for, because either could have been self-assigned: every moderator, and every owner who is not the community's creator. It reports how many in a notice. Reruns skip that step, so a moderator you appoint afterwards in the SQL Editor is kept. To hand a community to someone else, change `communities.created_by` as well as the member's role: owning a community now rests on having created it.

The file is transactional, safe to rerun, and adds only triggers and functions of its own, so rerunning `core-setup.sql` afterwards does not undo it. Two things it cannot do:

- It cannot repair a community that was already taken over. If `created_by` was rewritten before this file ran, there is no other record of who made the community, and the reset will trust what it finds. If you had communities before running it, read the list once and correct any that look wrong:

  ```sql
  select c.slug, c.name, c.is_private, p.username as created_by, c.member_count, c.created_at
    from public.communities c
    left join public.profiles p on p.id = c.created_by
   order by c.created_at;
  ```

- It does not make a community editable where `qa-cohort-setup.sql` is also applied. There, any update of a community by a learner currently fails with "infinite recursion detected in policy for relation communities": the cohort policy on `communities` contains a sub-select, and with it PostgreSQL treats communities, community_members and communities again as a loop. Nothing in the app updates a community, so nothing is broken by it, but an owner cannot yet rename one there. The guards in this file do not rely on that failure; they hold on a database without the cohort file, where the update works.

Last, run `supabase/qa-cohort-setup.sql`. It creates the QA cohort: accounts that sign up with a `+cxqa-` plus-address (the live-site QA bots and agents in `qa/`) see only each other, and learners never see them. That covers the feed, rankings, arenas, notifications, messages, presence and platform totals. The file adds restrictive policies and triggers of its own, so rerunning earlier files leaves them in place. The exception is four SECURITY DEFINER readers it redefines with the cohort filter: `arena_catalog`, `arena_action`, `platform_stats` and `learning_snapshot`. Rerun this file after `admin-arena-setup.sql` or `realtime-setup.sql`. `qa/cleanup.sql` removes the cohort and everything it created. See `qa/README.md`.

Optionally, run `supabase/community-seed.sql` to open Community Solutions with 50 discussion threads (each with at least ten people replying, plus reactions and follows) written by 36 learner accounts. Run it after `community-social-setup.sql`. It is transactional and safe to rerun, and it stops without writing anything if a learner already holds one of its usernames. Times are relative to the moment it runs, so the threads read as recent. The accounts cannot sign in, and their addresses use the reserved `community-seed.calculixhub.invalid` domain, so no mail is sent. They count as learners everywhere else too, for example in platform totals. `supabase/community-seed-cleanup.sql` removes all of it, including any comments learners left on those threads. Both files are generated: edit the threads in `scripts/community-seed/` and rebuild with `node scripts/community-seed/build.mjs`.

## Email for notifications and new posts

Run `supabase/email-delivery-setup.sql` after `qa-cohort-setup.sql`. From then on:

- every notification (follow, reaction, comment, reply, mention, share, message) is also emailed to the learner who received it;
- every new post is emailed to every other member, except suspended accounts, the seed accounts on the reserved `.invalid` domain, and accounts in the other cohort (QA and learners never mail each other).

The triggers only write rows into `public.email_outbox`, in the same transaction as the notification or post. The server route `POST /api/email/dispatch` sends them and retries failures up to five times. Set the server environment (see `.env.example`): `EMAIL_PROVIDER` (`smtp` for Gmail with an App Password, or `resend`), its credentials, `APP_URL` and `EMAIL_DISPATCH_SECRET`. Then tell the database where the dispatcher is:

```sql
update public.email_settings
   set dispatch_url = 'https://<your-site>/api/email/dispatch',
       dispatch_secret = '<the EMAIL_DISPATCH_SECRET value>'
 where id = 1;
```

With the `pg_net` extension enabled (Database → Extensions), each enqueue wakes the dispatcher within seconds; with `pg_cron` enabled, it is also woken once a minute as a backstop. Without either, call the route from any scheduler with the same bearer secret.

## Account controls and billing

Run `supabase/account-billing-setup.sql` after `email-delivery-setup.sql`. It adds the two functions behind the danger zone in Settings (`reset_my_progress()` and `delete_my_account()`, each acting only on the caller), the `subscriptions` table that records who holds a paid plan, and the `plan_interest` list. It is transactional, safe to rerun and redefines nothing from the earlier files. Until it is applied, Settings still shows the danger zone but both actions report that nothing was changed. `docs/billing-setup.md` covers the Stripe side.
