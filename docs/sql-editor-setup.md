# Running the core schema in Supabase SQL Editor

Open `supabase/core-setup.sql`, copy its complete contents, and run it in the SQL Editor of this CalculixHub project. This file contains identity, learning, social, messaging and notifications in dependency order, in one transaction. Existing user rows are preserved. It does not include Admin/Arena; that remains in `supabase/admin-arena-setup.sql`.

Each of the five original migration files is also safe to rerun individually. On a fresh project use this order: identity → learning → social → messaging → notifications. Use the updated file contents, not an older saved SQL Editor query.

PostgreSQL code 42710 means duplicate_object. Tables/indexes were already guarded, but triggers, policies and Realtime publication membership were not. The revised files replace only the explicitly named triggers and policies with their intended definitions, within a transaction. They preserve unrelated objects, rows and policy expressions. Realtime adds only missing table memberships; an absent publication is skipped, and a publication for all tables is preserved. Errors are not suppressed with a blanket duplicate_object exception.

Verification uses PostgreSQL/PGlite: first application; repeated application with existing records; RLS and counters after rerunning; recreation of missing named triggers/policies; partially populated Realtime publication; and publication for all tables. The hosted project must still receive the updated SQL through its SQL Editor because the REST service-role key cannot run DDL.

Reference: [PostgreSQL error codes](https://www.postgresql.org/docs/15/errcodes-appendix.html), [CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html).

After Admin/Arena setup, run `supabase/realtime-setup.sql` to enable the current application’s progress snapshot, private direct conversations, learner preferences and realtime invalidations. This file is also transactional and safe to rerun. See `docs/realtime-audit.md` for data sources and verification limits.

Then run `supabase/community-social-setup.sql` to turn Community Solutions into a full social feed: reactions (like, love, care, haha, wow, sad, angry) on posts and comments, edited labels stamped by the database, sharing a post to the feed, one level of threaded replies, and letting a post's author remove comments on it. It is transactional, safe to rerun and preserves existing posts, comments and likes (existing likes become "like" reactions). It adds columns, triggers, two views, one function and two policies without redefining anything from the core files, so rerunning `core-setup.sql` afterwards does not undo it. Until it is applied, the Community screen keeps working with likes, flat comments, saving, editing and deleting, and simply does not offer the features that need the new columns.
