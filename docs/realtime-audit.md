# Realtime data audit — 26 September 2026

The audit found browser-owned progress, Community votes/posts, unsourced counters, a separate iPhone demo dataset, and Arena/Admin views that refreshed only on demand. These have been replaced in the active application.

| Area | Source | Update mechanism |
| --- | --- | --- |
| Dashboard, Progress, badges | Saved attempts, database-derived user_stats and skill_mastery; learning_snapshot RPC | Own-account changes and ranking signals; refetch after reconnect/foreground |
| Learn | Admin-managed problem_catalog, authenticated learning_grade RPC | Catalog signals, persisted attempt history, server-awarded points |
| Leaderboard and own rank | leaderboard_view | user_stats/profile changes and ranking signals |
| Community | posts, comments, post_likes and saved_posts under RLS | Post/like/comment/profile events; confirmed writes |
| Community visibility | communities and community_members under RLS | Community and membership events invalidate the feed |
| Inbox | conversations, participants, messages, notifications under RLS | Committed database changes; reconnect/foreground reload |
| Profile | Authenticated profile and saved progress | Own profile/progress events |
| Goals and pace | learner_preferences, restricted to its owner | Account-filtered changes; save errors reported |
| Arena | arena_catalog / arena_action RPCs | Public scope-only invalidations, followed by authorized reads |
| Admin | Server-authorized administrative reads and writes | Scope-only invalidations, followed by elevated-session reads |
| Platform totals | platform_stats aggregate RPC | Ranking signals; unavailable shown when the query fails |
| iPhone prototype | Same application in a phone-sized frame | Same session, database and subscriptions as the website |

No browser event can manufacture platform totals. Signed-in grading failures do not create points or silently queue someone else's work. Guest practice is explicitly unsaved and earns no account points. API responses are not reused by the service worker as live data.

Math questions, illustrations, editorial difficulty priors, interface text, animations and mathematical sandbox sliders are authored/computed content, not claims of user activity. Research labels its sandbox separately from saved measurements. Theme, device reminder permissions and guest practice controls remain device-local settings.

Apply core-setup.sql, admin-arena-setup.sql, then realtime-setup.sql on a fresh database. The files can be rerun without deleting user records. Realtime publishes permitted core tables and a four-scope invalidation table. Private Admin/Arena contents are fetched through their existing authorization, rather than exposed in the invalidations.

Validation: PostgreSQL/PGlite tests cover authoritative snapshot totals/history, private goals/messages, unforgeable scope signals, publication membership and repeated setup. HTTP tests reject manufactured activity and report missing database configuration. These tests do not prove hosted WebSocket event delivery. A hosted anonymous check confirmed platform_stats, all four signal scopes, and a SUBSCRIBED WebSocket after the user applied the setup. Cross-device signed-in mutation delivery still needs two authenticated user sessions; no test accounts or fake activity were inserted into production.

Reference: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

The Table Editor's Realtime label indicates direct publication membership. Admin/settings/arenas/catalog intentionally refresh through the published realtime_signals table. Views cannot be added to a PostgreSQL publication: leaderboard_view and user_stats_view are refreshed from their underlying user_stats/profiles events. For projects set up before community visibility subscriptions were added, run realtime-publication-fix.sql once. Its final read-only result explains each public object’s realtime path; no credentials or private records are returned.
