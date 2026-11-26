/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What a private community keeps to itself, run against real PostgreSQL via
 * PGlite.
 *
 * The posts and comments of a private community were hidden from the start.
 * What hung off them was not: marks could be read and left by anyone, people
 * who had gone kept being told what was said, every post was mailed to the
 * whole server, and two helper functions answered questions about anybody's
 * membership. Each test here is that request, made by someone who should not
 * be answered: a learner who was never in, one who has left, and nobody at all.
 *
 * The first group runs on a database as it stood before the privacy file, with
 * the holes still in it, so that what follows is known to close something. It
 * then applies the file on top, which is the path a hosted project takes.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createTestDatabase, type TestDatabase } from './db.harness';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const setup = () => read('../../supabase/community-privacy-setup.sql');
const PRIVACY_MIGRATION = '20261126000200_community_privacy.sql';
const EMAIL_MIGRATION = '20261103000100_email_delivery.sql';
const NOBODY = '00000000-0000-4000-8000-000000000000';

/** Every migration in order, leaving out the named ones. */
const migrationsWithout = (...skipped: string[]) =>
  readdirSync(new URL('../../supabase/migrations', import.meta.url))
    .filter((name) => name.endsWith('.sql') && !skipped.includes(name))
    .sort()
    .map((name) => read(`../../supabase/migrations/${name}`));

/** The helpers below, bound to one database. */
function toolkit(db: TestDatabase) {
  const one = async <T>(rows: Promise<T[]>) => (await rows)[0]!;
  return {
    community: async (creator: string, slug: string, isPrivate = false) =>
      (await one(db.asUser<{ id: string }>(
        creator,
        `insert into public.communities (slug, name, is_private, created_by) values ($1, $2, $3, $4) returning id`,
        [slug, `Circle ${slug}`, isPrivate, creator],
      ))).id,
    /** The creator joins their own community the ordinary way. */
    join: (who: string, id: string) =>
      db.asUser(who, `insert into public.community_members (community_id, user_id) values ($1, $2)`, [id, who]),
    /** Everyone else is added with the service role: there is no invitation flow yet. */
    admit: (who: string, id: string) =>
      db.query(`insert into public.community_members (community_id, user_id) values ($1, $2)`, [id, who]),
    expel: (who: string, id: string) =>
      db.query(`delete from public.community_members where community_id = $1 and user_id = $2`, [id, who]),
    leave: (who: string, id: string) =>
      db.asUser(who, `delete from public.community_members where community_id = $1 and user_id = $2`, [id, who]),
    post: async (author: string, body: string, circle: string | null = null, shared: string | null = null) =>
      (await one(db.asUser<{ id: string }>(
        author,
        `insert into public.posts (author_id, body, community_id, shared_post_id) values ($1, $2, $3, $4) returning id`,
        [author, body, circle, shared],
      ))).id,
    comment: async (author: string, postId: string, body: string, parent: string | null = null) =>
      (await one(db.asUser<{ id: string }>(
        author,
        `insert into public.comments (post_id, author_id, body, parent_id) values ($1, $2, $3, $4) returning id`,
        [postId, author, body, parent],
      ))).id,
    mark: (who: string, postId: string, reaction = 'like') =>
      db.asUser(who, `insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, $3)`, [postId, who, reaction]),
    markComment: (who: string, commentId: string, reaction = 'like') =>
      db.asUser(who, `insert into public.comment_likes (comment_id, user_id, reaction) values ($1, $2, $3)`, [commentId, who, reaction]),
    save: (who: string, postId: string) =>
      db.asUser(who, `insert into public.saved_posts (user_id, post_id) values ($1, $2)`, [who, postId]),
    /** Everything stored for a recipient, read as the owner. */
    stored: (who: string) =>
      db.query<{ type: string; actor_id: string; body: string | null }>(
        `select type, actor_id, body from public.notifications where user_id = $1 order by type, body nulls first`,
        [who],
      ),
    /** What a learner's own inbox query returns. */
    inbox: (who: string) =>
      db.asUser<{ type: string; body: string | null }>(
        who,
        `select type, body from public.notifications where user_id = $1 order by type, body nulls first`,
        [who],
      ),
    /** Queued mail for one recipient about one post. */
    mail: (who: string, postId: string) =>
      db.query<{ status: string }>(
        `select status from public.email_outbox where recipient_id = $1 and post_id = $2`,
        [who, postId],
      ),
    recipients: async (postId: string) =>
      (await db.query<{ recipient_id: string }>(
        `select recipient_id from public.email_outbox where post_id = $1 and kind = 'new_post' and status <> 'skipped'`,
        [postId],
      )).map((row) => row.recipient_id).sort(),
    ask: async (asker: string | null, circle: string, who: string) =>
      (await one(db.asUser<{ answer: boolean | null }>(asker, `select public.is_community_member($1, $2) as answer`, [circle, who]))).answer,
    primaryKey: async (table: string) =>
      (await db.query<{ attname: string }>(
        `select a.attname::text as attname
           from pg_index i
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
          where i.indrelid = ('public.' || $1)::regclass and i.indisprimary
          order by 1`,
        [table],
      )).map((row) => row.attname),
  };
}

// ---------------------------------------------------------------------------
// The holes, and the file applied on top of them
// ---------------------------------------------------------------------------

/**
 * The three functions the fix also corrects at their source, put back the way
 * a hosted project has them today. A project that applies only the new file
 * still runs these bodies for its email broadcast.
 */
const AS_HOSTED_TODAY = `
  create or replace function public.is_community_member(target uuid, who uuid)
  returns boolean language sql stable security definer set search_path = public, pg_temp as $$
    select exists (select 1 from public.community_members m where m.community_id = target and m.user_id = who);
  $$;

  create or replace function public.is_conversation_participant(target uuid, who uuid)
  returns boolean language sql stable security definer set search_path = public, pg_temp as $$
    select exists (select 1 from public.conversation_participants p where p.conversation_id = target and p.user_id = who);
  $$;

  create or replace function public.enqueue_post_broadcast()
  returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    insert into public.email_outbox (recipient_id, kind, post_id)
    select u.id, 'new_post', new.id
    from auth.users u
    where u.id <> new.author_id
      and public.email_recipient_ok(u.id)
      and public.email_same_cohort(u.id, new.author_id)
    on conflict do nothing;
    return null;
  end;
  $$;
`;

describe('a private community before the privacy file, and after it is applied on top', () => {
  let db: TestDatabase;
  let t: ReturnType<typeof toolkit>;
  let ada: string;
  let bob: string;
  let eve: string;
  let zed: string;
  let den: string;
  let secret: string;
  let lateSecret: string;
  let open: string;
  let zedsComment: string;
  let pairsBefore: Record<string, unknown[]>;

  const pairs = async () => ({
    community_members: await db.query('select community_id, user_id, role, joined_at from public.community_members order by 1, 2'),
    post_likes: await db.query('select post_id, user_id, reaction, created_at from public.post_likes order by 1, 2'),
    comment_likes: await db.query('select comment_id, user_id, reaction, created_at from public.comment_likes order by 1, 2'),
    saved_posts: await db.query('select user_id, post_id, created_at from public.saved_posts order by 1, 2'),
  });

  beforeAll(async () => {
    db = await createTestDatabase({ scripts: migrationsWithout(PRIVACY_MIGRATION) });
    t = toolkit(db);
    ada = await db.createUser({ email: 'old-ada@example.com', username: 'old_ada', displayName: 'Ada' });
    bob = await db.createUser({ email: 'old-bob@example.com', username: 'old_bob', displayName: 'Bob' });
    eve = await db.createUser({ email: 'old-eve@example.com', username: 'old_eve', displayName: 'Eve' });
    zed = await db.createUser({ email: 'old-zed@example.com', username: 'old_zed', displayName: 'Zed' });
  }, 60000);

  afterAll(async () => {
    await db?.close();
  });

  it('already mails a private post to its members only, where just the email file is new', async () => {
    den = await t.community(ada, 'old-den', true);
    await t.join(ada, den);
    await t.admit(bob, den);
    await t.admit(zed, den);

    const first = await t.post(ada, 'For the den only.', den);
    expect(await t.recipients(first)).toEqual([bob, zed].sort());

    open = await t.post(ada, 'For everyone.');
    expect(await t.recipients(open)).toEqual([bob, eve, zed].sort());
  });

  it('was open in every other way', async () => {
    await db.exec(AS_HOSTED_TODAY);

    secret = await t.post(ada, 'The plan nobody outside should read.', den);
    zedsComment = await t.comment(zed, secret, 'Zed, while still a member.');
    await t.mark(bob, secret, 'love');

    // Mailed to the whole server, quoted.
    expect(await t.recipients(secret)).toEqual([bob, eve, zed].sort());

    // Anyone, signed in or not, could read who marked it and how many did.
    expect(await db.asUser(null, 'select user_id from public.post_likes where post_id = $1', [secret])).toEqual([{ user_id: bob }]);
    expect(await db.asUser(null, 'select reaction, total from public.post_reaction_counts where post_id = $1', [secret])).toEqual([{ reaction: 'love', total: 1 }]);

    // An outsider could mark it and save it, and the author was told.
    await t.mark(eve, secret);
    await t.save(eve, secret);
    expect((await t.stored(ada)).filter((row) => row.actor_id === eve)).toEqual([{ type: 'post_like', actor_id: eve, body: null }]);

    // Someone who had left was still sent what was said there.
    await t.leave(zed, den);
    await t.comment(bob, secret, 'Bob, after Zed has gone.', zedsComment);
    expect(await t.inbox(zed)).toEqual([{ type: 'comment_reply', body: 'Bob, after Zed has gone.' }]);

    // Anyone could ask who was a member, about anyone.
    expect(await t.ask(eve, den, bob)).toBe(true);
    expect(await t.ask(null, den, bob)).toBe(true);

    // And a member could carry the post's id out into the open feed.
    await t.post(bob, 'Sharing it with the world.', null, secret);

    // The key Realtime announces when a row is deleted was the pair itself.
    expect(await t.primaryKey('community_members')).toEqual(['community_id', 'user_id']);

    pairsBefore = await pairs();
  });

  it('applies on top without losing a membership, a mark or a save', async () => {
    await db.exec(setup());
    expect(await pairs()).toEqual(pairsBefore);
  });

  it('gives each of the four tables a key that says nothing, and keeps the pair unique', async () => {
    for (const table of ['community_members', 'post_likes', 'comment_likes', 'saved_posts']) {
      expect(await t.primaryKey(table)).toEqual(['row_id']);
    }
    const ids = await db.query<{ row_id: string }>('select row_id from public.post_likes');
    expect(new Set(ids.map((row) => row.row_id)).size).toBe(ids.length);

    await expect(t.mark(bob, secret, 'wow')).rejects.toThrow(/duplicate key/i);
    await expect(t.admit(bob, den)).rejects.toThrow(/duplicate key/i);
    await expect(t.save(eve, open).then(() => t.save(eve, open))).rejects.toThrow(/duplicate key/i);
  });

  it('closes the marks to everyone outside', async () => {
    for (const viewer of [eve, zed, null]) {
      expect(await db.asUser(viewer, 'select user_id from public.post_likes where post_id = $1', [secret])).toEqual([]);
      expect(await db.asUser(viewer, 'select total from public.post_reaction_counts where post_id = $1', [secret])).toEqual([]);
    }
    // The members still see every mark, the outsider's old one included.
    expect(await db.asUser(ada, 'select user_id from public.post_likes where post_id = $1 order by 1', [secret])).toEqual(
      [{ user_id: bob }, { user_id: eve }].sort((a, b) => a.user_id.localeCompare(b.user_id)),
    );
  });

  it('hides what was already delivered to someone who has left, without deleting it', async () => {
    expect(await t.inbox(zed)).toEqual([]);
    expect((await t.stored(zed)).map((row) => row.type)).toEqual(['comment_reply']);
  });

  it('answers a question about membership to the member only', async () => {
    expect(await t.ask(eve, den, bob)).toBe(false);
    expect(await t.ask(null, den, bob)).toBe(false);
    expect(await t.ask(bob, den, bob)).toBe(true);
  });

  it('takes the unsent mail about private posts out of the queue', async () => {
    // Queued under the old broadcast for people who cannot read the post.
    expect(await t.mail(eve, secret)).toEqual([{ status: 'skipped' }]);
    expect(await t.mail(zed, secret)).toEqual([{ status: 'skipped' }]);
    // Mail a member is owed, and mail about an open post, is left alone.
    expect(await t.mail(bob, secret)).toEqual([{ status: 'pending' }]);
    expect(await t.mail(eve, open)).toEqual([{ status: 'pending' }]);
  });

  it('guards the queue itself, so the old broadcast can no longer reach outside', async () => {
    lateSecret = await t.post(ada, 'Posted after the fix, under the old broadcast.', den);
    expect(await t.recipients(lateSecret)).toEqual([bob]);
    expect(await t.mail(eve, lateSecret)).toEqual([]);
  });

  it('no longer lets an outsider mark, save or share', async () => {
    await expect(t.mark(eve, lateSecret)).rejects.toThrow(/row-level security/i);
    await expect(t.save(eve, lateSecret)).rejects.toThrow(/row-level security/i);
    await expect(t.post(bob, 'Out it goes again.', null, lateSecret)).rejects.toThrow(/only be shared inside it/i);
  });
});

// ---------------------------------------------------------------------------
// The full schema
// ---------------------------------------------------------------------------

let db: TestDatabase;
let t: ReturnType<typeof toolkit>;
let ada: string;
let bob: string;
let eve: string;
let zed: string;
let den: string;
let secret: string;
let openPost: string;
let secretComment: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = toolkit(db);
  ada = await db.createUser({ email: 'priv-ada@example.com', username: 'priv_ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'priv-bob@example.com', username: 'priv_bob', displayName: 'Bob' });
  eve = await db.createUser({ email: 'priv-eve@example.com', username: 'priv_eve', displayName: 'Eve' });
  zed = await db.createUser({ email: 'priv-zed@example.com', username: 'priv_zed', displayName: 'Zed' });

  den = await t.community(ada, 'priv-den', true);
  await t.join(ada, den);
  await t.admit(bob, den);
  await t.admit(zed, den);

  secret = await t.post(ada, 'A private proof sketch.', den);
  openPost = await t.post(ada, 'An open question for everyone.');
  secretComment = await t.comment(bob, secret, 'A comment inside the den.');
}, 60000);

afterAll(async () => {
  await db?.close();
});

describe('marks on a private post', () => {
  it('are read where the post is read, and nowhere else', async () => {
    await t.mark(bob, secret, 'love');
    await t.markComment(ada, secretComment, 'care');
    await t.mark(zed, secret, 'wow');
    await t.save(zed, secret);
    await t.leave(zed, den);

    const marks = (viewer: string | null) => db.asUser(viewer, 'select reaction from public.post_likes where post_id = $1 order by 1', [secret]);
    const counts = (viewer: string | null) => db.asUser(viewer, 'select reaction, total from public.post_reaction_counts where post_id = $1 order by 1', [secret]);
    const onComment = (viewer: string | null) => db.asUser(viewer, 'select reaction from public.comment_likes where comment_id = $1', [secretComment]);
    const commentCounts = (viewer: string | null) => db.asUser(viewer, 'select total from public.comment_reaction_counts where comment_id = $1', [secretComment]);

    for (const member of [ada, bob]) {
      expect(await marks(member)).toEqual([{ reaction: 'love' }, { reaction: 'wow' }]);
      expect(await counts(member)).toEqual([{ reaction: 'love', total: 1 }, { reaction: 'wow', total: 1 }]);
      expect(await onComment(member)).toEqual([{ reaction: 'care' }]);
      expect(await commentCounts(member)).toEqual([{ total: 1 }]);
    }
    for (const outsider of [eve, zed, null]) {
      expect(await marks(outsider)).toEqual([]);
      expect(await counts(outsider)).toEqual([]);
      expect(await onComment(outsider)).toEqual([]);
      expect(await commentCounts(outsider)).toEqual([]);
    }
  });

  it('cannot be found by asking for a person rather than a post', async () => {
    expect(await db.asUser(eve, 'select post_id from public.post_likes where user_id = $1', [bob])).toEqual([]);
    expect(await db.asUser(null, 'select comment_id from public.comment_likes where user_id = $1', [ada])).toEqual([]);
    expect(await db.asUser(null, 'select count(*)::int as n from public.post_likes')).toEqual([{ n: 0 }]);
  });

  it('stay open on an open post, for anyone', async () => {
    await t.mark(eve, openPost, 'haha');
    expect(await db.asUser(null, 'select reaction, total from public.post_reaction_counts where post_id = $1', [openPost])).toEqual([{ reaction: 'haha', total: 1 }]);
    expect(await db.asUser(zed, 'select user_id from public.post_likes where post_id = $1', [openPost])).toEqual([{ user_id: eve }]);
  });
});

describe('marking and saving from outside', () => {
  const state = async () => (await db.query<{ like_count: number }>('select like_count from public.posts where id = $1', [secret]))[0]!.like_count;

  it('is refused, moves no counter and tells nobody', async () => {
    const before = await state();
    const told = await t.stored(ada);

    for (const outsider of [eve]) {
      await expect(t.mark(outsider, secret)).rejects.toThrow(/row-level security/i);
      await expect(t.markComment(outsider, secretComment)).rejects.toThrow(/row-level security/i);
      await expect(t.save(outsider, secret)).rejects.toThrow(/row-level security/i);
    }
    await expect(db.asUser(null, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [secret, eve])).rejects.toThrow(/row-level security|permission denied/i);

    expect(await state()).toBe(before);
    expect(await t.stored(ada)).toEqual(told);
  });

  it('answers the same for a post that does not exist, so the refusal says nothing', async () => {
    const refusal = async (id: string) => String(await t.mark(eve, id).catch((error: Error) => error.message.split('\n')[0]));
    expect(await refusal(NOBODY)).toBe(await refusal(secret));

    const saveRefusal = async (id: string) => String(await t.save(eve, id).catch((error: Error) => error.message.split('\n')[0]));
    expect(await saveRefusal(NOBODY)).toBe(await saveRefusal(secret));
  });

  it('leaves someone who has gone unable to see, change or re-make the mark they left', async () => {
    expect(await db.asUser(zed, 'select reaction from public.post_likes where user_id = $1', [zed])).toEqual([]);
    expect(await db.asUser(zed, `update public.post_likes set reaction = 'angry' where post_id = $1 and user_id = $2 returning reaction`, [secret, zed])).toEqual([]);
    expect(await db.asUser(zed, 'delete from public.post_likes where post_id = $1 and user_id = $2 returning post_id', [secret, zed])).toEqual([]);
    expect(await db.asUser(zed, 'select post_id from public.saved_posts where user_id = $1', [zed])).toEqual([]);
    await expect(t.mark(zed, secret)).rejects.toThrow(/row-level security/i);

    // The mark stays where the members can see it.
    expect(await db.asUser(ada, 'select reaction from public.post_likes where post_id = $1 and user_id = $2', [secret, zed])).toEqual([{ reaction: 'wow' }]);
  });

  it('is unchanged for members, and for anyone on an open post', async () => {
    await t.mark(ada, secret, 'care');
    await t.save(bob, secret);
    expect(await db.asUser(bob, 'select post_id from public.saved_posts where user_id = $1', [bob])).toEqual([{ post_id: secret }]);
    expect(await db.asUser(bob, `update public.post_likes set reaction = 'haha' where post_id = $1 and user_id = $2 returning reaction`, [secret, bob])).toEqual([{ reaction: 'haha' }]);
    expect(await db.asUser(bob, 'delete from public.saved_posts where post_id = $1 and user_id = $2 returning post_id', [secret, bob])).toEqual([{ post_id: secret }]);

    await t.save(zed, openPost);
    expect(await db.asUser(zed, 'select post_id from public.saved_posts where user_id = $1', [zed])).toEqual([{ post_id: openPost }]);
  });
});

describe('notifications about a private post', () => {
  let zedsPost: string;
  let zedsComment: string;
  let evesOpenPost: string;

  beforeAll(async () => {
    // Zed is let back in, writes, and leaves again: what he wrote stays.
    await t.admit(zed, den);
    zedsPost = await t.post(zed, 'Zed wrote this while he was a member.', den);
    zedsComment = await t.comment(zed, secret, 'Zed commented while he was a member.');
    await t.leave(zed, den);
    await db.query('delete from public.notifications');
    evesOpenPost = await t.post(eve, 'Eve wrote this in the open feed.');
  });

  it('do not follow someone out of the community', async () => {
    await t.comment(bob, secret, 'A reply Zed must not be sent.', zedsComment);
    await t.markComment(bob, zedsComment, 'love');
    await t.comment(bob, zedsPost, 'A comment on the post Zed left behind.');
    await t.mark(bob, zedsPost, 'care');

    expect(await t.stored(zed)).toEqual([]);
    expect(await t.inbox(zed)).toEqual([]);
  });

  it('still reach the members they are for', async () => {
    // Bob's reply was also a comment on Ada's post, and she is a member.
    expect(await t.stored(ada)).toEqual([{ type: 'post_comment', actor_id: bob, body: 'A reply Zed must not be sent.' }]);

    await t.comment(ada, secret, 'Ada answers Bob.', secretComment);
    await t.markComment(ada, (await db.query<{ id: string }>(`select id from public.comments where body = 'A reply Zed must not be sent.'`))[0]!.id, 'wow');
    const bobs = (await t.inbox(bob)).map((row) => row.type);
    expect(bobs).toEqual(['comment_like', 'comment_reply']);
  });

  it('name a member who is mentioned, and nobody outside', async () => {
    await t.comment(bob, secret, 'Over to @priv_ada and @priv_eve and @priv_zed.');
    expect((await t.stored(ada)).filter((row) => row.type === 'mention')).toEqual([
      { type: 'mention', actor_id: bob, body: 'Over to @priv_ada and @priv_eve and @priv_zed.' },
    ]);
    expect(await t.stored(eve)).toEqual([]);
    expect(await t.stored(zed)).toEqual([]);

    const shout = await t.post(bob, 'A post for @priv_ada, and for @priv_eve who is not here.', den);
    expect((await t.stored(ada)).filter((row) => row.type === 'mention' && row.body?.startsWith('A post for'))).toHaveLength(1);
    expect(await t.stored(eve)).toEqual([]);
    expect(shout).toBeTruthy();
  });

  it('do not quote a share made inside to the outside author of what was shared', async () => {
    await t.post(bob, 'Look what Eve wrote, den.', den, evesOpenPost);
    expect(await t.stored(eve)).toEqual([]);

    // The same share in the open feed is hers to hear about.
    await t.post(bob, 'Look what Eve wrote, everyone.', null, evesOpenPost);
    expect(await t.stored(eve)).toEqual([{ type: 'post_share', actor_id: bob, body: 'Look what Eve wrote, everyone.' }]);

    // And a member is told about a share of their own post inside.
    await t.post(bob, 'Back to the proof.', den, secret);
    expect((await t.stored(ada)).filter((row) => row.type === 'post_share')).toEqual([{ type: 'post_share', actor_id: bob, body: 'Back to the proof.' }]);
  });

  it('are hidden from a member who is removed, and shown again if they return', async () => {
    const before = await t.inbox(bob);
    expect(before.length).toBeGreaterThan(0);
    const [target] = await db.query<{ id: string }>(`select id from public.notifications where user_id = $1 and type = 'comment_reply'`, [bob]);

    await t.expel(bob, den);
    expect(await t.inbox(bob)).toEqual([]);
    expect(await db.asUser(bob, 'update public.notifications set read_at = now() where id = $1 returning id', [target!.id])).toEqual([]);
    expect(await db.asUser(bob, 'delete from public.notifications where id = $1 returning id', [target!.id])).toEqual([]);
    expect(await db.asUser(bob, 'select count(*)::int as n from public.notifications')).toEqual([{ n: 0 }]);

    await t.admit(bob, den);
    expect(await t.inbox(bob)).toEqual(before);
  });

  it('are hidden from everyone outside when an open community closes', async () => {
    const agora = await t.community(ada, 'priv-agora');
    await t.join(ada, agora);
    const topic = await t.post(ada, 'An open circle, for now.', agora);
    const evesWord = await t.comment(eve, topic, 'Eve joins in from outside.');
    await t.comment(ada, topic, 'Ada replies to Eve.', evesWord);
    expect((await t.inbox(eve)).filter((row) => row.type === 'comment_reply')).toEqual([{ type: 'comment_reply', body: 'Ada replies to Eve.' }]);

    await db.query('update public.communities set is_private = true where id = $1', [agora]);
    expect((await t.inbox(eve)).filter((row) => row.type === 'comment_reply')).toEqual([]);
    expect(await db.asUser(eve, 'select id from public.comments where post_id = $1', [topic])).toEqual([]);
  });

  it('leave everything else in the inbox alone', async () => {
    await db.asUser(bob, `insert into public.follows (follower_id, following_id) values ($1, $2)`, [bob, eve]);
    await t.mark(bob, evesOpenPost, 'love');
    expect((await t.inbox(eve)).map((row) => row.type).sort()).toEqual(['follow', 'post_like', 'post_share']);
  });
});

describe('a share of a private post', () => {
  let nook: string;

  it('is allowed inside its community and nowhere else', async () => {
    nook = await t.community(ada, 'priv-nook', true);
    await t.join(ada, nook);
    await t.admit(bob, nook);

    await expect(t.post(bob, 'To the open feed.', null, secret)).rejects.toThrow(/only be shared inside it/i);
    await expect(t.post(bob, 'To another private circle.', nook, secret)).rejects.toThrow(/only be shared inside it/i);
    expect(await t.post(bob, 'Inside the den.', den, secret)).toBeTruthy();
  });

  it('tells an outsider only that the post is not there', async () => {
    const refusal = async (id: string) => String(await t.post(eve, 'Mine now.', null, id).catch((error: Error) => error.message.split('\n')[0]));
    expect(await refusal(secret)).toMatch(/no longer available to share/i);
    expect(await refusal(secret)).toBe(await refusal(NOBODY));
  });

  it('cannot be carried out through a share of a share', async () => {
    // A share that predates the rule: an open post pointing at a private one.
    await db.exec('alter table public.posts disable trigger privacy_wall');
    const relic = await t.post(bob, 'An old share from before the rule.', null, secret);
    await db.exec('alter table public.posts enable trigger privacy_wall');

    // A member sharing it would be sharing the private original.
    await expect(t.post(bob, 'Passing it on.', null, relic)).rejects.toThrow(/only be shared inside it/i);

    // An outsider shares the open post they can see, and gets no further.
    const passed = await t.post(eve, 'Passing on what I can see.', null, relic);
    expect(await db.query('select shared_post_id from public.posts where id = $1', [passed])).toEqual([{ shared_post_id: relic }]);
  });

  it('leaves sharing an open post into a private community alone', async () => {
    expect(await t.post(bob, 'An open post, discussed in private.', nook, openPost)).toBeTruthy();
  });
});

describe('removing a comment', () => {
  let zedsPost: string;
  let bobsComment: string;
  let zedsComment: string;
  let replyToZed: string;

  const removed = async (id: string) => (await db.query<{ deleted_at: string | null }>('select deleted_at from public.comments where id = $1', [id]))[0]!.deleted_at !== null;

  beforeAll(async () => {
    await t.admit(zed, den);
    zedsPost = await t.post(zed, 'A second post of Zed, written as a member.', den);
    bobsComment = await t.comment(bob, zedsPost, 'Bob comments on Zed\'s post.');
    zedsComment = await t.comment(zed, secret, 'Zed says something he will take back.');
    replyToZed = await t.comment(bob, secret, 'Bob replies under it.', zedsComment);
    await t.leave(zed, den);
  });

  it('is refused to the author of a post who can no longer read it', async () => {
    await expect(db.asUser(zed, 'select public.remove_comment($1)', [bobsComment])).rejects.toThrow(/do not have permission/i);
    expect(await removed(bobsComment)).toBe(false);
  });

  it('still lets someone who has left withdraw their own words, replies and all', async () => {
    await db.asUser(zed, 'select public.remove_comment($1)', [zedsComment]);
    expect(await removed(zedsComment)).toBe(true);
    expect(await removed(replyToZed)).toBe(true);
  });

  it('is unchanged for an author who is still a member', async () => {
    const onAdas = await t.comment(bob, secret, 'Bob says something Ada removes.');
    await db.asUser(ada, 'select public.remove_comment($1)', [onAdas]);
    expect(await removed(onAdas)).toBe(true);
  });
});

describe('asking who is a member', () => {
  /** A request as PostgREST runs it for a given role, with the role in its token. */
  const asRole = async (role: string, claim: string | null, sql: string, params: unknown[]) => {
    await db.exec('begin');
    try {
      await db.query(`select set_config('request.jwt.claim.sub', '', true)`);
      await db.query(`select set_config('request.jwt.claim.role', $1, true)`, [claim ?? '']);
      await db.exec(`set local role ${role}`);
      return await db.query<{ answer: boolean | null }>(sql, params);
    } finally {
      await db.exec('rollback');
    }
  };

  it('is answered about yourself, and with a plain no about anyone else', async () => {
    expect(await t.ask(bob, den, bob)).toBe(true);
    expect(await t.ask(eve, den, eve)).toBe(false);

    for (const asker of [ada, eve, zed, null]) {
      // `false`, not null: an answer that changed with the truth would be the answer.
      expect(await t.ask(asker, den, bob)).toBe(false);
      expect(await t.ask(asker, den, eve)).toBe(false);
    }
  });

  it('is answered in full to the service role and the SQL Editor, and to nobody dressed as them', async () => {
    const sql = 'select public.is_community_member($1, $2) as answer';
    expect(await db.query(sql, [den, bob])).toEqual([{ answer: true }]);
    expect(await asRole('service_role', 'service_role', sql, [den, bob])).toEqual([{ answer: true }]);

    // The role a request runs as and the role in its token both have to say so.
    expect(await asRole('authenticated', 'service_role', sql, [den, bob])).toEqual([{ answer: false }]);
    expect(await asRole('anon', null, sql, [den, bob])).toEqual([{ answer: false }]);
    expect(await asRole('service_role', 'authenticated', sql, [den, bob])).toEqual([{ answer: false }]);
  });

  it('cannot be asked of the helpers this file adds', async () => {
    await expect(db.asUser(eve, 'select privacy.is_member($1, $2)', [den, bob])).rejects.toThrow(/permission denied/i);
    await expect(db.asUser(eve, 'select privacy.wall_of($1)', [secret])).rejects.toThrow(/permission denied/i);
    await expect(db.asUser(eve, 'select privacy.can_read_post($1, $2)', [secret, bob])).rejects.toThrow(/permission denied/i);
    await expect(db.asUser(null, 'select privacy.sweep_email_outbox()')).rejects.toThrow(/permission denied/i);
    await expect(db.asUser(eve, 'select privacy.wire_email()')).rejects.toThrow(/permission denied/i);

    // The one a policy calls speaks only about whoever is asking.
    const open = (viewer: string | null) => db.asUser<{ answer: boolean }>(viewer, 'select privacy.viewer_may_open($1, null, null, null) as answer', [secret]);
    expect(await open(bob)).toEqual([{ answer: true }]);
    expect(await open(eve)).toEqual([{ answer: false }]);
    expect(await open(null)).toEqual([{ answer: false }]);
  });

  it('keeps the list of members to the members', async () => {
    expect(await db.asUser(eve, 'select user_id from public.community_members where community_id = $1', [den])).toEqual([]);
    expect(await db.asUser(null, 'select user_id from public.community_members where community_id = $1', [den])).toEqual([]);
    expect((await db.asUser(bob, 'select user_id from public.community_members where community_id = $1', [den])).length).toBe(2);
  });
});

describe('asking who is in a conversation', () => {
  let thread: string;
  const ask = async (asker: string | null, who: string) =>
    (await db.asUser<{ answer: boolean | null }>(asker, 'select public.is_conversation_participant($1, $2) as answer', [thread, who]))[0]!.answer;

  it('still finds the thread two people already share', async () => {
    const start = async (from: string, to: string) => (await db.asUser<{ id: string }>(from, 'select public.start_conversation($1) as id', [to]))[0]!.id;
    thread = await start(ada, bob);
    expect(await start(ada, bob)).toBe(thread);
    expect(await start(bob, ada)).toBe(thread);
    expect(await db.query('select count(*)::int as n from public.conversations')).toEqual([{ n: 1 }]);
  });

  it('is answered to its participants, and with a plain no to anyone else', async () => {
    expect(await ask(ada, ada)).toBe(true);
    expect(await ask(ada, bob)).toBe(true);
    for (const asker of [eve, null]) {
      expect(await ask(asker, ada)).toBe(false);
      expect(await ask(asker, bob)).toBe(false);
    }
    expect(await ask(eve, eve)).toBe(false);
  });

  it('leaves messaging as it was', async () => {
    await db.asUser(ada, `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Hello Bob')`, [thread, ada]);
    expect(await db.asUser(bob, 'select body from public.messages where conversation_id = $1', [thread])).toEqual([{ body: 'Hello Bob' }]);
    expect(await db.asUser(eve, 'select body from public.messages where conversation_id = $1', [thread])).toEqual([]);
    expect((await t.inbox(bob)).filter((row) => row.type === 'message')).toEqual([{ type: 'message', body: 'Hello Bob' }]);
  });
});

describe('email about a private post', () => {
  let kim: string;

  beforeAll(async () => {
    kim = await db.createUser({ email: 'priv-kim@example.com', username: 'priv_kim', displayName: 'Kim' });
    await t.admit(kim, den);
  });

  it('is queued for its members and nobody else', async () => {
    const fresh = await t.post(ada, 'News for the den.', den);
    expect(await t.recipients(fresh)).toEqual([bob, kim].sort());

    const everyone = await t.post(ada, 'News for everybody.');
    expect(await t.recipients(everyone)).toEqual([bob, eve, kim, zed].sort());
  });

  it('follows the notification it carries', async () => {
    const kimsPost = await t.post(kim, 'Kim asks the den something.', den);
    await t.comment(bob, kimsPost, 'Bob answers Kim.');
    const queued = await db.query<{ recipient_id: string }>(
      `select o.recipient_id from public.email_outbox o join public.notifications n on n.id = o.notification_id where n.entity_id = $1 and n.type = 'post_comment'`,
      [kimsPost],
    );
    expect(queued).toEqual([{ recipient_id: kim }]);
  });

  it('is set aside the moment its recipient leaves', async () => {
    const forKim = await t.post(ada, 'Queued for Kim, who is about to leave.', den);
    const openOne = await t.post(ada, 'An open post queued for Kim.');
    expect(await t.mail(kim, forKim)).toEqual([{ status: 'pending' }]);

    await t.leave(kim, den);
    expect(await t.mail(kim, forKim)).toEqual([{ status: 'skipped' }]);
    expect(await t.mail(kim, openOne)).toEqual([{ status: 'pending' }]);
    expect(await t.mail(bob, forKim)).toEqual([{ status: 'pending' }]);

    // Mail carrying a notification about the den goes the same way.
    const stillQueued = await db.query(
      `select 1 from public.email_outbox o join public.notifications n on n.id = o.notification_id
        where o.recipient_id = $1 and o.status = 'pending' and n.type = 'post_comment'`,
      [kim],
    );
    expect(stillQueued).toEqual([]);
  });

  it('is set aside for everyone outside when an open community closes', async () => {
    const forum = await t.community(ada, 'priv-forum');
    await t.join(ada, forum);
    await db.asUser(bob, `insert into public.community_members (community_id, user_id) values ($1, $2)`, [forum, bob]);
    const notice = await t.post(ada, 'Posted while the forum was open.', forum);
    expect(await t.mail(eve, notice)).toEqual([{ status: 'pending' }]);

    await db.query('update public.communities set is_private = true where id = $1', [forum]);
    expect(await t.mail(eve, notice)).toEqual([{ status: 'skipped' }]);
    expect(await t.mail(bob, notice)).toEqual([{ status: 'pending' }]);
  });

  it('is checked once more as the dispatcher claims it', async () => {
    // A row the other guards never saw: written straight into the queue.
    await db.exec('alter table public.email_outbox disable trigger privacy_guard');
    await db.query(`insert into public.email_outbox (recipient_id, kind, post_id) values ($1, 'new_post', $2)`, [eve, secret]);
    await db.exec('alter table public.email_outbox enable trigger privacy_guard');

    const claimed = await db.query<{ recipient_email: string; payload: { post_id?: string } | null }>(
      'select recipient_email, payload from public.claim_email_outbox(200)',
    );
    expect(claimed.length).toBeGreaterThan(0);
    expect(claimed.filter((row) => row.recipient_email === 'priv-eve@example.com' && row.payload?.post_id === secret)).toEqual([]);
    expect(await t.mail(eve, secret)).toEqual([{ status: 'skipped' }]);
  });

  it('is never shown to a client, queued or not', async () => {
    expect(await db.asUser(bob, 'select count(*)::int as n from public.email_outbox')).toEqual([{ n: 0 }]);
    await expect(db.asUser(bob, 'select public.claim_email_outbox(5)')).rejects.toThrow(/permission denied/i);
  });
});

describe('SQL Editor setup', () => {
  const objects = () => db.query(`
    select 'policy:' || tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') as name
      from pg_policies where schemaname = 'public'
    union all select 'trigger:' || c.relname || '.' || t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal
    union all select 'function:' || p.oid::regprocedure::text || ':' || coalesce((select string_agg(item::text, ',' order by item::text) from unnest(p.proacl) item), '')
      from pg_proc p where p.pronamespace = 'privacy'::regnamespace
    union all select 'constraint:' || conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) from pg_constraint
      where conrelid in ('public.community_members'::regclass, 'public.post_likes'::regclass, 'public.comment_likes'::regclass, 'public.saved_posts'::regclass)
    order by 1`);
  const data = async () => {
    const rows: Record<string, unknown> = {};
    for (const table of ['communities', 'community_members', 'posts', 'comments', 'post_likes', 'comment_likes', 'saved_posts', 'notifications', 'email_outbox']) {
      rows[table] = await db.query(`select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`);
    }
    return rows;
  };

  it('is exactly the migration, so the SQL Editor file cannot drift from it', () => {
    expect(setup()).toBe(read(`../../supabase/migrations/${PRIVACY_MIGRATION}`));
    expect(read('../../supabase/email-delivery-setup.sql')).toBe(read(`../../supabase/migrations/${EMAIL_MIGRATION}`));
  });

  it('carries the two membership functions exactly as core-setup.sql defines them', () => {
    const body = (sql: string, name: string) => {
      const start = sql.indexOf(`create or replace function public.${name}(`);
      return sql.slice(start, sql.indexOf('$$;', start) + 3);
    };
    for (const name of ['is_community_member', 'is_conversation_participant']) {
      expect(body(setup(), name).length).toBeGreaterThan(200);
      expect(body(setup(), name)).toBe(body(read('../../supabase/core-setup.sql'), name));
    }
    expect(body(setup(), 'is_community_member')).toBe(body(read('../../supabase/migrations/20260801000300_social.sql'), 'is_community_member'));
    expect(body(setup(), 'is_conversation_participant')).toBe(body(read('../../supabase/migrations/20260801000400_messaging.sql'), 'is_conversation_participant'));
  });

  it('keeps everything it adds, and every row, through reruns of itself and of every earlier file', async () => {
    const named = await objects();
    const rows = await data();

    await db.exec(setup());
    await db.exec(setup());
    for (const file of ['core-setup', 'community-social-setup', 'community-roles-setup', 'qa-cohort-setup', 'email-delivery-setup', 'realtime-setup']) {
      await db.exec(read(`../../supabase/${file}.sql`));
    }

    expect(await objects()).toEqual(named);
    expect(await data()).toEqual(rows);

    await db.exec(setup());
    expect(await objects()).toEqual(named);
    expect(await data()).toEqual(rows);
  });

  it('still holds every line after those reruns', async () => {
    expect(await db.asUser(null, 'select count(*)::int as n from public.post_likes where post_id = $1', [secret])).toEqual([{ n: 0 }]);
    expect(await t.ask(eve, den, bob)).toBe(false);
    await expect(t.mark(eve, secret)).rejects.toThrow(/row-level security/i);
    await expect(t.post(bob, 'Out again?', null, secret)).rejects.toThrow(/only be shared inside it/i);

    const fresh = await t.post(ada, 'After every rerun.', den);
    expect(await t.recipients(fresh)).toEqual([bob]);
    for (const table of ['community_members', 'post_likes', 'comment_likes', 'saved_posts']) {
      expect(await t.primaryKey(table)).toEqual(['row_id']);
    }
  });
});

describe('what the file stands on', () => {
  it('refuses to apply before the files it depends on, and says which', async () => {
    const coreOnly = await createTestDatabase({ scripts: [read('../../supabase/core-setup.sql')] });
    // The SQL Editor ends a failed run's transaction; here that takes a rollback.
    await expect(coreOnly.exec(setup())).rejects.toThrow(/community-social-setup\.sql first/);
    await coreOnly.exec('rollback');
    await coreOnly.exec(read('../../supabase/community-social-setup.sql'));
    await expect(coreOnly.exec(setup())).rejects.toThrow(/community-roles-setup\.sql first/);
    await coreOnly.exec('rollback');

    await coreOnly.exec(read('../../supabase/community-roles-setup.sql'));
    await coreOnly.exec(setup());
    await coreOnly.close();
  }, 60000);

  it('applies without the cohort or the email queue, and guards the queue when that arrives later', async () => {
    const lean = await createTestDatabase({
      scripts: ['core-setup', 'community-social-setup', 'community-roles-setup', 'community-privacy-setup'].map((file) => read(`../../supabase/${file}.sql`)),
    });
    const k = toolkit(lean);
    const founder = await lean.createUser({ email: 'lean-founder@example.com', username: 'lean_founder' });
    const member = await lean.createUser({ email: 'lean-member@example.com', username: 'lean_member' });
    const outsider = await lean.createUser({ email: 'lean-outsider@example.com', username: 'lean_outsider' });

    const circle = await k.community(founder, 'lean-circle', true);
    await k.join(founder, circle);
    await k.admit(member, circle);
    const hidden = await k.post(founder, 'Lean and private.', circle);
    await k.mark(member, hidden);

    expect(await lean.asUser(outsider, 'select user_id from public.post_likes where post_id = $1', [hidden])).toEqual([]);
    await expect(k.mark(outsider, hidden)).rejects.toThrow(/row-level security/i);
    // Leaving works with no queue to tidy.
    await k.leave(member, circle);
    await k.admit(member, circle);

    await lean.exec(read('../../supabase/email-delivery-setup.sql'));
    expect(await lean.query(`select tgname from pg_trigger where tgrelid = 'public.email_outbox'::regclass and tgname = 'privacy_guard'`)).toEqual([{ tgname: 'privacy_guard' }]);

    const later = await k.post(founder, 'Lean, private, and now mailed.', circle);
    expect(await k.recipients(later)).toEqual([member]);
    await lean.close();
  }, 60000);

  it('does not change what an older policy means by adding a column', async () => {
    // The update policy on communities compares a membership's community with
    // the community's own id. A new column on community_members called `id`
    // would have become that id the next time core-setup.sql was run, and no
    // owner could have edited a community again.
    const lean = await createTestDatabase({
      scripts: ['core-setup', 'community-social-setup', 'community-roles-setup', 'community-privacy-setup', 'core-setup'].map((file) => read(`../../supabase/${file}.sql`)),
    });
    const k = toolkit(lean);
    const founder = await lean.createUser({ email: 'key-founder@example.com', username: 'key_founder' });
    const member = await lean.createUser({ email: 'key-member@example.com', username: 'key_member' });
    const circle = await k.community(founder, 'key-circle');
    await k.join(founder, circle);
    await k.join(member, circle);

    expect(await lean.query(`select attname::text as name from pg_attribute where attrelid = 'public.community_members'::regclass and attname in ('id', 'row_id')`)).toEqual([{ name: 'row_id' }]);
    const [policy] = await lean.query<{ qual: string }>(`select qual from pg_policies where tablename = 'communities' and policyname = 'communities_update_owner'`);
    expect(policy!.qual).toContain('m.community_id = communities.id');

    expect(await lean.asUser(founder, `update public.communities set name = 'Renamed by its owner' where id = $1 returning name`, [circle])).toEqual([{ name: 'Renamed by its owner' }]);
    expect(await lean.asUser(member, `update public.communities set name = 'Renamed by a member' where id = $1 returning name`, [circle])).toEqual([]);
    await lean.close();
  }, 60000);
});
