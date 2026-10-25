/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds supabase/community-seed.sql and supabase/community-seed-cleanup.sql
 * from the personas and threads in this folder.
 *
 *   node scripts/community-seed/build.mjs
 *
 * The output is deterministic: every id is derived from a stable key, so the
 * SQL is safe to rerun (each insert is `on conflict do nothing`) and a rebuild
 * with no content change produces the same file.
 *
 * Times are written relative to `now()` at the moment the SQL runs, so the
 * threads read as recent whenever the seed is applied.
 *
 * The build refuses to write anything if a thread breaks a rule the feed
 * relies on: fewer than ten distinct people replying, an unknown author or
 * @mention, a reply before its parent, a comment after "now", a persona taking
 * part before joining, or a problem id the catalog does not have.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { personas } from './personas.mjs';
import threads01 from './threads-01.mjs';
import threads02 from './threads-02.mjs';
import threads03 from './threads-03.mjs';
import threads04 from './threads-04.mjs';
import threads05 from './threads-05.mjs';

export const SEED_EMAIL_DOMAIN = 'community-seed.calculixhub.invalid';
const MIN_REPLIERS = 10;

export const threads = [...threads01, ...threads02, ...threads03, ...threads04, ...threads05];

const root = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

/** A stable UUID (v4 layout) for a seed row. */
export function seedId(kind, key) {
  const hex = createHash('md5').update(`calculixhub-community-seed:${kind}:${key}`).digest('hex').split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Small deterministic PRNG (mulberry32) so reactions are stable across builds. */
function rng(seedText) {
  let a = parseInt(createHash('md5').update(seedText).digest('hex').slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickReaction(random) {
  const roll = random();
  if (roll < 0.56) return 'like';
  if (roll < 0.78) return 'love';
  if (roll < 0.88) return 'wow';
  if (roll < 0.95) return 'haha';
  return 'care';
}

const quote = (text) => `'${text.replace(/'/g, "''")}'`;
/** `now()` minus a number of seconds, as SQL. */
const ago = (seconds) => `now() - interval '${Math.max(0, Math.round(seconds))} seconds'`;

function catalogIds() {
  const sql = readFileSync(root('supabase/migrations/20260926000300_catalog_seed.sql'), 'utf8');
  return new Set([...sql.matchAll(/\('([a-z0-9-]+)','\{/g)].map((match) => match[1]));
}

const MENTION = /(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9_]{1,22}[A-Za-z0-9])/g;

/** Validate every thread and resolve it to rows. Throws with every problem found. */
export function resolveSeed() {
  const errors = [];
  const byHandle = new Map(personas.map((persona) => [persona.handle, persona]));
  const problems = catalogIds();
  const keys = new Set();

  if (byHandle.size !== personas.length) errors.push('Two personas share a handle.');
  for (const persona of personas) {
    if (!/^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/.test(persona.handle) || persona.handle.length < 3 || persona.handle.length > 20) {
      errors.push(`Handle ${persona.handle} would be rewritten at sign-up.`);
    }
    if (persona.bio.length > 280) errors.push(`Bio of ${persona.handle} is too long.`);
  }

  const checkText = (where, text, limit) => {
    if (!text.trim()) errors.push(`${where}: empty body.`);
    if (text.length > limit) errors.push(`${where}: body is ${text.length} characters (max ${limit}).`);
    for (const match of text.matchAll(MENTION)) {
      if (!byHandle.has(match[1].toLowerCase())) errors.push(`${where}: @${match[1]} is not a persona.`);
    }
  };

  const checkPersona = (where, handle, secondsAgo) => {
    const persona = byHandle.get(handle);
    if (!persona) return errors.push(`${where}: unknown persona ${handle}.`);
    if (persona.joined * 86400 <= secondsAgo) errors.push(`${where}: ${handle} has not joined yet.`);
  };

  const posts = [];
  const comments = [];

  for (const thread of threads) {
    const where = `thread ${thread.key}`;
    if (keys.has(thread.key)) errors.push(`${where}: duplicate key.`);
    keys.add(thread.key);
    if (thread.problem && !problems.has(thread.problem)) errors.push(`${where}: unknown problem ${thread.problem}.`);

    const postAgo = thread.ago * 3600;
    checkPersona(where, thread.by, postAgo);
    checkText(where, thread.body, 5000);

    const postId = seedId('post', thread.key);
    posts.push({ id: postId, key: thread.key, author: thread.by, problem: thread.problem ?? null, body: thread.body, agoSeconds: postAgo });

    const repliers = new Set();
    const threadComments = [];
    thread.comments.forEach(([by, minutes, body, replyTo], index) => {
      const at = `${where} comment ${index}`;
      const commentAgo = postAgo - minutes * 60;
      if (commentAgo < 60) errors.push(`${at}: lands after now (post is ${thread.ago}h old, comment at +${minutes}m).`);
      checkPersona(at, by, commentAgo);
      checkText(at, body, 2000);
      if (by !== thread.by) repliers.add(by);

      let parent = null;
      if (replyTo !== undefined) {
        const target = threadComments[replyTo];
        if (!target) errors.push(`${at}: replies to comment ${replyTo}, which does not come before it.`);
        else {
          if (commentAgo > target.agoSeconds) errors.push(`${at}: replies before its parent was written.`);
          // Replies nest one level; the database files a reply to a reply under
          // the comment that started the thread, so the seed does the same.
          parent = target.parent ?? target.id;
        }
      }

      threadComments.push({
        id: seedId('comment', `${thread.key}:${index}`),
        postId,
        author: by,
        parent,
        body,
        agoSeconds: commentAgo,
      });
    });

    if (repliers.size < MIN_REPLIERS) errors.push(`${where}: only ${repliers.size} people reply (need ${MIN_REPLIERS}).`);
    comments.push(...threadComments);
  }

  if (errors.length > 0) throw new Error(`Community seed is invalid:\n  - ${errors.join('\n  - ')}`);
  return { posts, comments };
}

/** Who reacted to which post and comment, and who follows whom. */
function engagement({ posts, comments }) {
  const handles = personas.map((persona) => persona.handle);
  const joinedAgo = new Map(personas.map((persona) => [persona.handle, persona.joined * 86400]));
  const postLikes = [];
  const commentLikes = [];

  for (const post of posts) {
    const random = rng(`post-likes:${post.key}`);
    const threadComments = comments.filter((comment) => comment.postId === post.id);
    const want = Math.min(handles.length - 1, 9 + Math.floor(threadComments.length * 0.8) + Math.floor(random() * 14));
    const reactors = shuffle(handles.filter((handle) => handle !== post.author), random).slice(0, want);
    for (const handle of reactors) {
      // Within two days of the post, and never before "now" minus a minute.
      const window = Math.min(post.agoSeconds - 60, 2 * 86400);
      postLikes.push({ post: post.id, user: handle, reaction: pickReaction(random), agoSeconds: post.agoSeconds - random() * window });
    }

    for (const comment of threadComments) {
      const commentRandom = rng(`comment-likes:${comment.id}`);
      const skew = commentRandom();
      const count = Math.floor(skew * skew * 11);
      const likers = shuffle(handles.filter((handle) => handle !== comment.author), commentRandom).slice(0, count);
      for (const handle of likers) {
        const window = Math.min(comment.agoSeconds - 60, 86400);
        commentLikes.push({
          comment: comment.id,
          user: handle,
          reaction: commentRandom() < 0.75 ? 'like' : pickReaction(commentRandom),
          agoSeconds: comment.agoSeconds - commentRandom() * window,
        });
      }
    }
  }

  const follows = [];
  for (const handle of handles) {
    const random = rng(`follows:${handle}`);
    const count = 4 + Math.floor(random() * 7);
    for (const other of shuffle(handles.filter((h) => h !== handle), random).slice(0, count)) {
      const since = Math.min(joinedAgo.get(handle), joinedAgo.get(other)) - 3600;
      follows.push({ follower: handle, following: other, agoSeconds: random() * since });
    }
  }

  return { postLikes, commentLikes, follows };
}

function chunked(rows, size, render) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(render(rows.slice(i, i + size)));
  return out.join('\n\n');
}

export function buildSeedSql() {
  const resolved = resolveSeed();
  const { posts, comments } = resolved;
  const { postLikes, commentLikes, follows } = engagement(resolved);
  const user = (handle) => quote(seedId('user', handle));

  const accounts = personas.map((persona) => {
    const meta = JSON.stringify({ username: persona.handle, display_name: persona.name });
    return `  ('00000000-0000-0000-0000-000000000000', ${user(persona.handle)}, 'authenticated', 'authenticated', ${quote(`${persona.handle}@${SEED_EMAIL_DOMAIN}`)}, '', ${ago(persona.joined * 86400)}, '{"provider":"email","providers":["email"]}'::jsonb, ${quote(meta)}::jsonb, ${ago(persona.joined * 86400)}, ${ago(persona.joined * 86400)}, '', '', '', '')`;
  });

  const profiles = personas.map(
    (persona) =>
      `  (${user(persona.handle)}::uuid, ${quote(persona.handle)}, ${quote(persona.name)}, ${quote(persona.bio)}, ${quote(persona.country)}, ${quote(persona.level)}, ${ago(persona.joined * 86400)}, ${ago(persona.joined * 86400 - 1200)})`,
  );

  const topLevel = comments.filter((comment) => !comment.parent);
  const replies = comments.filter((comment) => comment.parent);

  const commentInsert = (rows) =>
    `insert into public.comments (id, post_id, author_id, parent_id, body, created_at, updated_at) values\n${rows
      .map(
        (c) =>
          `  (${quote(c.id)}, ${quote(c.postId)}, ${user(c.author)}, ${c.parent ? quote(c.parent) : 'null'}, ${quote(c.body)}, ${ago(c.agoSeconds)}, ${ago(c.agoSeconds)})`,
      )
      .join(',\n')}\non conflict (id) do update set body = excluded.body where comments.body is distinct from excluded.body;`;

  const handles = personas.map((persona) => quote(persona.handle)).join(', ');
  const userIndex = new Map(personas.map((persona, i) => [persona.handle, i]));
  const postIndex = new Map(posts.map((post, i) => [post.id, i]));
  const commentIndex = new Map(comments.map((comment, i) => [comment.id, i]));
  /** Value tuples, ten to a line. */
  const chunkLines = (tuples) => chunked(tuples, 10, (line) => line.join(',')).replace(/\n\n/g, ',\n');

  return `-- CalculixHub: the opening Community Solutions threads.
--
-- GENERATED by scripts/community-seed/build.mjs -- edit the threads there and
-- rebuild; do not edit this file by hand.
--
-- Run once in the Supabase SQL Editor, after core-setup.sql and
-- community-social-setup.sql. Safe to rerun: every row has a fixed id, so a
-- rerun adds nothing twice and leaves counters exact; it only brings the
-- wording of posts, comments and profiles up to date with the threads. Times
-- are relative to now(), so the threads read as recent on the day this runs.
--
-- ${personas.length} accounts, ${posts.length} posts, ${comments.length} comments, ${postLikes.length} post reactions,
-- ${commentLikes.length} comment reactions, ${follows.length} follows. The accounts have no password and
-- cannot sign in. Their addresses use the reserved .invalid domain
-- (${SEED_EMAIL_DOMAIN}), so no mail is ever sent, and
-- community-seed-cleanup.sql removes all of it by that domain.
begin;

-- A learner who already holds one of these usernames would otherwise be the one
-- an @mention in the seed notifies. Stop instead.
do $$
declare
  taken text;
begin
  select string_agg(p.username, ', ') into taken
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) in (${handles})
    and u.email not like '%@${SEED_EMAIL_DOMAIN}';
  if taken is not null then
    raise exception 'Community seed: these usernames already belong to learners: %. Rename the personas in scripts/community-seed/personas.mjs and rebuild.', taken;
  end if;
end $$;

-- Accounts. The profile row is created by on_auth_user_created, as for any sign-up.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values
${accounts.join(',\n')}
on conflict (id) do nothing;

update public.profiles p
set display_name = v.display_name,
    bio = v.bio,
    country = v.country,
    level = v.level,
    created_at = v.created_at,
    onboarded_at = coalesce(p.onboarded_at, v.onboarded_at)
from (values
${profiles.join(',\n')}
) as v (id, username, display_name, bio, country, level, created_at, onboarded_at)
where p.id = v.id and lower(p.username) = lower(v.username);

-- Follows and reactions name accounts, posts and comments by number through
-- these lookups, which keeps the file small enough to paste.
create temp table seed_user (i smallint primary key, id uuid not null) on commit drop;
insert into seed_user values ${personas.map((p, i) => `(${i}, ${user(p.handle)})`).join(', ')};

create temp table seed_post (i smallint primary key, id uuid not null) on commit drop;
insert into seed_post values ${posts.map((p, i) => `(${i}, ${quote(p.id)})`).join(', ')};

create temp table seed_comment (i smallint primary key, id uuid not null) on commit drop;
${chunked(comments, 200, (rows) => `insert into seed_comment values ${rows.map((c) => `(${commentIndex.get(c.id)}, ${quote(c.id)})`).join(', ')};`)}

-- Follows.
insert into public.follows (follower_id, following_id, created_at)
select a.id, b.id, now() - make_interval(secs => v.s)
from (values
${chunkLines(follows.map((f) => `(${userIndex.get(f.follower)},${userIndex.get(f.following)},${Math.round(f.agoSeconds)})`))}
) as v (a, b, s)
join seed_user a on a.i = v.a
join seed_user b on b.i = v.b
on conflict do nothing;

-- A rerun rewords rows already in place. The guard triggers would stamp a
-- post "Edited" and refuse to reword a comment for anyone but its author, and
-- the edit triggers would notify @mentions again, so they sit out until the
-- comments are in. All four are back on before this transaction commits.
alter table public.posts disable trigger posts_guard_update;
alter table public.posts disable trigger posts_notify_community_edit;
alter table public.comments disable trigger comments_guard_update;
alter table public.comments disable trigger comments_notify_community_edit;

-- Posts.
insert into public.posts (id, author_id, problem_id, body, created_at, updated_at) values
${posts.map((p) => `  (${quote(p.id)}, ${user(p.author)}, ${p.problem ? quote(p.problem) : 'null'}, ${quote(p.body)}, ${ago(p.agoSeconds)}, ${ago(p.agoSeconds)})`).join(',\n')}
on conflict (id) do update set body = excluded.body where posts.body is distinct from excluded.body;

-- Comments. Top-level first: a reply's insert trigger looks its parent up, and
-- a row is not visible to the statement that is inserting it.
${chunked(topLevel, 200, commentInsert)}

${chunked(replies, 200, commentInsert)}

alter table public.posts enable trigger posts_guard_update;
alter table public.posts enable trigger posts_notify_community_edit;
alter table public.comments enable trigger comments_guard_update;
alter table public.comments enable trigger comments_notify_community_edit;

-- Reactions. Counters follow by trigger.
insert into public.post_likes (post_id, user_id, reaction, created_at)
select p.id, u.id, v.r, now() - make_interval(secs => v.s)
from (values
${chunkLines(postLikes.map((r) => `(${postIndex.get(r.post)},${userIndex.get(r.user)},'${r.reaction}',${Math.round(r.agoSeconds)})`))}
) as v (p, u, r, s)
join seed_post p on p.i = v.p
join seed_user u on u.i = v.u
on conflict do nothing;

insert into public.comment_likes (comment_id, user_id, reaction, created_at)
select c.id, u.id, v.r, now() - make_interval(secs => v.s)
from (values
${chunkLines(commentLikes.map((r) => `(${commentIndex.get(r.comment)},${userIndex.get(r.user)},'${r.reaction}',${Math.round(r.agoSeconds)})`))}
) as v (c, u, r, s)
join seed_comment c on c.i = v.c
join seed_user u on u.i = v.u
on conflict do nothing;

-- The seed accounts talking to each other generated notifications for each
-- other as it ran. Nobody will read them; clear them so their inboxes start
-- empty instead of hundreds deep.
delete from public.notifications
where user_id in (select id from auth.users where email like '%@${SEED_EMAIL_DOMAIN}')
  and (actor_id is null or actor_id in (select id from auth.users where email like '%@${SEED_EMAIL_DOMAIN}'));

commit;
`;
}

export function buildCleanupSql() {
  return `-- CalculixHub: remove the opening Community Solutions threads.
--
-- GENERATED by scripts/community-seed/build.mjs.
--
-- Deletes every seed account (email ending @${SEED_EMAIL_DOMAIN}) and, by
-- cascade, its profile, posts, comments, reactions, follows and notifications.
-- Comments that learners left on seed posts go with those posts. Learners'
-- own posts are untouched.
begin;

select
  (select count(*) from auth.users where email like '%@${SEED_EMAIL_DOMAIN}') as seed_accounts,
  (select count(*) from public.posts where author_id in (select id from auth.users where email like '%@${SEED_EMAIL_DOMAIN}')) as seed_posts;

delete from auth.users where email like '%@${SEED_EMAIL_DOMAIN}';

commit;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sql = buildSeedSql();
  writeFileSync(root('supabase/community-seed.sql'), sql);
  writeFileSync(root('supabase/community-seed-cleanup.sql'), buildCleanupSql());
  const { posts, comments } = resolveSeed();
  console.log(`Wrote supabase/community-seed.sql: ${personas.length} accounts, ${posts.length} posts, ${comments.length} comments.`);
}
