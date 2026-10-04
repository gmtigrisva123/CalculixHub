/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Community Solutions as a social feed: reactions, edits, shares, threaded
 * replies and comment removal, run against real PostgreSQL via PGlite.
 *
 * As in schema.test.ts, every permission is exercised from both sides, because
 * the database -- not the client -- is what decides who may do what.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let ada: string;
let bob: string;
let eve: string;

const post = async (author: string, body: string, extra: { shared?: string | null; community?: string } = {}) => {
  const [row] = await db.asUser<{ id: string }>(
    author,
    `insert into public.posts (author_id, body, shared_post_id, community_id) values ($1, $2, $3, $4) returning id`,
    [author, body, extra.shared ?? null, extra.community ?? null],
  );
  return row!.id;
};

const comment = async (author: string, postId: string, body: string, parent: string | null = null) => {
  const [row] = await db.asUser<{ id: string }>(
    author,
    `insert into public.comments (post_id, author_id, body, parent_id) values ($1, $2, $3, $4) returning id`,
    [postId, author, body, parent],
  );
  return row!.id;
};

const postRow = async (id: string) =>
  (await db.query<{ like_count: number; comment_count: number; share_count: number; edited_at: string | null; body: string; author_id: string }>(
    'select like_count, comment_count, share_count, edited_at, body, author_id from public.posts where id = $1',
    [id],
  ))[0]!;

beforeAll(async () => {
  db = await createTestDatabase();
  ada = await db.createUser({ email: 'feed-ada@example.com', username: 'feed_ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'feed-bob@example.com', username: 'feed_bob', displayName: 'Bob' });
  eve = await db.createUser({ email: 'feed-eve@example.com', username: 'feed_eve', displayName: 'Eve' });
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe('reactions', () => {
  it('stores a reaction, lets its owner change it, and counts it once', async () => {
    const id = await post(ada, 'Reaction target');
    await db.asUser(bob, `insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'love')`, [id, bob]);
    await db.asUser(eve, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [id, eve]);

    const changed = await db.asUser(bob, `update public.post_likes set reaction = 'haha' where post_id = $1 and user_id = $2 returning reaction`, [id, bob]);
    expect(changed).toEqual([{ reaction: 'haha' }]);
    expect((await postRow(id)).like_count).toBe(2);

    const summary = await db.asUser<{ reaction: string; total: number }>(null, 'select reaction, total from public.post_reaction_counts where post_id = $1 order by reaction', [id]);
    expect(summary).toEqual([{ reaction: 'haha', total: 1 }, { reaction: 'like', total: 1 }]);
  });

  it('refuses to change someone else’s reaction or to move a reaction to another post', async () => {
    const first = await post(ada, 'First');
    const second = await post(ada, 'Second');
    await db.asUser(bob, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [first, bob]);

    expect(await db.asUser(eve, `update public.post_likes set reaction = 'angry' where post_id = $1 returning reaction`, [first])).toHaveLength(0);

    await db.asUser(bob, `update public.post_likes set post_id = $2, reaction = 'wow' where post_id = $1 and user_id = $3`, [first, second, bob]);
    const rows = await db.query<{ post_id: string; reaction: string }>('select post_id, reaction from public.post_likes where user_id = $1 and post_id in ($2, $3)', [bob, first, second]);
    expect(rows).toEqual([{ post_id: first, reaction: 'wow' }]);
    expect((await postRow(first)).like_count).toBe(1);
    expect((await postRow(second)).like_count).toBe(0);
  });

  it('rejects a reaction that is not one of the seven', async () => {
    const id = await post(ada, 'Strict reactions');
    await expect(
      db.asUser(bob, `insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'meh')`, [id, bob]),
    ).rejects.toThrow(/check constraint/i);
  });

  it('reacts to comments the same way', async () => {
    const id = await post(ada, 'Comment reactions');
    const c = await comment(bob, id, 'Nice');
    await db.asUser(ada, `insert into public.comment_likes (comment_id, user_id, reaction) values ($1, $2, 'care')`, [c, ada]);
    await db.asUser(ada, `update public.comment_likes set reaction = 'love' where comment_id = $1 and user_id = $2`, [c, ada]);
    expect(await db.asUser(eve, `update public.comment_likes set reaction = 'sad' where comment_id = $1 returning reaction`, [c])).toHaveLength(0);

    const [row] = await db.query<{ like_count: number }>('select like_count from public.comments where id = $1', [c]);
    expect(row!.like_count).toBe(1);
    expect(await db.asUser(null, 'select reaction, total from public.comment_reaction_counts where comment_id = $1', [c])).toEqual([{ reaction: 'love', total: 1 }]);
  });
});

describe('editing', () => {
  it('stamps an edit when the words change, and not when the post is merely liked', async () => {
    const id = await post(ada, 'Before');
    await db.asUser(bob, `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [id, bob]);
    expect((await postRow(id)).edited_at).toBeNull();

    await db.asUser(ada, `update public.posts set body = 'After' where id = $1`, [id]);
    const after = await postRow(id);
    expect(after.body).toBe('After');
    expect(after.edited_at).not.toBeNull();
  });

  it('never lets an author write their own counters or hand the post to someone else', async () => {
    const id = await post(ada, 'Counters');
    await db.asUser(ada, `update public.posts set like_count = 999, comment_count = 999, share_count = 999, author_id = $2, edited_at = null where id = $1`, [id, bob]);
    const row = await postRow(id);
    expect(row).toMatchObject({ like_count: 0, comment_count: 0, share_count: 0, author_id: ada, edited_at: null });
  });

  it('starts every new post and comment at zero, whatever the request claims', async () => {
    const [created] = await db.asUser<{ id: string }>(ada, `insert into public.posts (author_id, body, like_count, comment_count, share_count, edited_at) values ($1, 'Fresh', 50, 50, 50, now()) returning id`, [ada]);
    expect(await postRow(created!.id)).toMatchObject({ like_count: 0, comment_count: 0, share_count: 0, edited_at: null });

    const [c] = await db.asUser<{ id: string }>(bob, `insert into public.comments (post_id, author_id, body, like_count, edited_at) values ($1, $2, 'Fresh reply', 50, now()) returning id`, [created!.id, bob]);
    expect((await db.query('select like_count, edited_at from public.comments where id = $1', [c!.id]))[0]).toEqual({ like_count: 0, edited_at: null });
  });

  it('lets only the comment author reword a comment', async () => {
    const id = await post(ada, 'Edit comments');
    const c = await comment(bob, id, 'Original');
    expect(await db.asUser(ada, `update public.comments set body = 'Put words in your mouth' where id = $1 returning id`, [c])).toHaveLength(0);
    expect(await db.asUser(eve, `update public.comments set body = 'Defaced' where id = $1 returning id`, [c])).toHaveLength(0);

    await db.asUser(bob, `update public.comments set body = 'Reworded' where id = $1`, [c]);
    const [row] = await db.query<{ body: string; edited_at: string | null }>('select body, edited_at from public.comments where id = $1', [c]);
    expect(row!.body).toBe('Reworded');
    expect(row!.edited_at).not.toBeNull();
  });
});

describe('sharing', () => {
  it('lets a share go out without words and counts it on the original', async () => {
    const original = await post(ada, 'Worth sharing');
    const share = await post(bob, '', { shared: original });
    await post(eve, 'Adding my thoughts', { shared: original });

    expect((await postRow(original)).share_count).toBe(2);
    expect((await postRow(share)).body).toBe('');
  });

  it('still refuses an empty post that shares nothing', async () => {
    await expect(post(ada, '   ')).rejects.toThrow(/check constraint/i);
  });

  it('shares the original when someone shares a share', async () => {
    const original = await post(ada, 'Root');
    const first = await post(bob, 'Look', { shared: original });
    const second = await post(eve, '', { shared: first });

    const [row] = await db.query<{ shared_post_id: string }>('select shared_post_id from public.posts where id = $1', [second]);
    expect(row!.shared_post_id).toBe(original);
    expect((await postRow(original)).share_count).toBe(2);
    expect((await postRow(first)).share_count).toBe(0);
  });

  it('gives the count back when a share is deleted', async () => {
    const original = await post(ada, 'Shared then unshared');
    const share = await post(bob, '', { shared: original });
    await db.asUser(bob, 'update public.posts set deleted_at = now() where id = $1', [share]);
    expect((await postRow(original)).share_count).toBe(0);
  });

  it('refuses to share a deleted post, or a private post the sharer cannot see', async () => {
    const gone = await post(ada, 'Soon gone');
    await db.asUser(ada, 'update public.posts set deleted_at = now() where id = $1', [gone]);
    await expect(post(bob, '', { shared: gone })).rejects.toThrow(/no longer available/i);

    const [community] = await db.asUser<{ id: string }>(ada, `insert into public.communities (slug, name, is_private, created_by) values ('feed-private', 'Private', true, $1) returning id`, [ada]);
    await db.asUser(ada, 'insert into public.community_members (community_id, user_id, role) values ($1, $2, $3)', [community!.id, ada, 'owner']);
    const secret = await post(ada, 'Members only', { community: community!.id });
    await expect(post(eve, '', { shared: secret })).rejects.toThrow(/no longer available/i);
  });

  it('still lets an account be deleted when others have shared its posts', async () => {
    const leaver = await db.createUser({ email: 'feed-leaver@example.com', username: 'feed_leaver' });
    const original = await post(leaver, 'Goodbye');
    const share = await post(bob, '', { shared: original });

    await db.query('delete from auth.users where id = $1', [leaver]);
    const [row] = await db.query<{ shared_post_id: string }>('select shared_post_id from public.posts where id = $1', [share]);
    expect(row!.shared_post_id).toBe(original);
    expect(await db.query('select id from public.posts where id = $1', [original])).toHaveLength(0);
  });
});

describe('threaded replies', () => {
  it('files a reply to a reply under the comment that started the thread', async () => {
    const id = await post(ada, 'Thread');
    const top = await comment(bob, id, 'Top');
    const reply = await comment(eve, id, 'Reply', top);
    const nested = await comment(ada, id, 'Reply to reply', reply);

    const [row] = await db.query<{ parent_id: string }>('select parent_id from public.comments where id = $1', [nested]);
    expect(row!.parent_id).toBe(top);
    expect((await postRow(id)).comment_count).toBe(3);
  });

  it('refuses a reply that points at a comment on another post', async () => {
    const one = await post(ada, 'One');
    const two = await post(ada, 'Two');
    const elsewhere = await comment(bob, one, 'Here');
    await expect(comment(eve, two, 'Wrong thread', elsewhere)).rejects.toThrow(/same post/i);
  });

  it('removes the replies with the comment and keeps the count exact', async () => {
    const id = await post(ada, 'Cascade');
    const top = await comment(bob, id, 'Top');
    await comment(eve, id, 'Reply one', top);
    await comment(ada, id, 'Reply two', top);
    await comment(eve, id, 'Unrelated');
    expect((await postRow(id)).comment_count).toBe(4);

    await db.asUser(bob, 'select public.remove_comment($1)', [top]);
    expect((await postRow(id)).comment_count).toBe(1);
    expect(await db.asUser(eve, 'select body from public.comments where post_id = $1 and deleted_at is null', [id])).toEqual([{ body: 'Unrelated' }]);
  });
});

describe('removing comments', () => {
  it('lets the post author remove a comment on their post without being able to read it afterwards', async () => {
    const id = await post(ada, 'My post, my rules');
    const c = await comment(eve, id, 'Off topic');
    await db.asUser(ada, 'select public.remove_comment($1)', [c]);

    expect(await db.asUser(ada, 'select id from public.comments where id = $1', [c])).toHaveLength(0);
    expect(await db.asUser(eve, 'select id from public.comments where id = $1', [c])).toHaveLength(1);
    expect((await postRow(id)).comment_count).toBe(0);

    // Removed by the post author, so its author cannot quietly bring it back.
    await db.asUser(eve, 'update public.comments set deleted_at = null where id = $1', [c]);
    expect((await postRow(id)).comment_count).toBe(0);
  });

  it('lets a comment author restore a comment only they removed', async () => {
    const id = await post(ada, 'Second thoughts');
    const c = await comment(bob, id, 'Hasty');
    await db.asUser(bob, 'select public.remove_comment($1)', [c]);
    await db.asUser(bob, 'update public.comments set deleted_at = null where id = $1', [c]);
    expect((await postRow(id)).comment_count).toBe(1);
  });

  it('refuses everyone else, including guests', async () => {
    const id = await post(ada, 'Not yours');
    const c = await comment(bob, id, 'Mine');
    await expect(db.asUser(eve, 'select public.remove_comment($1)', [c])).rejects.toThrow(/permission/i);
    await expect(db.asUser(null, 'select public.remove_comment($1)', [c])).rejects.toThrow(/permission denied|sign in/i);
    expect(await db.asUser(eve, 'select id from public.comments where id = $1', [c])).toHaveLength(1);
  });

  it('never lets the post author restore a comment its author removed', async () => {
    const id = await post(ada, 'Restore attempt');
    const c = await comment(bob, id, 'Regret');
    await db.asUser(bob, 'select public.remove_comment($1)', [c]);
    await db.asUser(ada, 'select public.remove_comment($1)', [c]);
    const [row] = await db.query<{ deleted_at: string | null }>('select deleted_at from public.comments where id = $1', [c]);
    expect(row!.deleted_at).not.toBeNull();
  });
});

describe('SQL Editor setup', () => {
  const setup = () => readFileSync(new URL('../../supabase/community-social-setup.sql', import.meta.url), 'utf8');
  const migration = () => readFileSync(new URL('../../supabase/migrations/20261004000100_community_social.sql', import.meta.url), 'utf8');
  const core = () => readFileSync(new URL('../../supabase/core-setup.sql', import.meta.url), 'utf8');
  const tables = ['posts', 'comments', 'post_likes', 'comment_likes', 'saved_posts'];
  const snapshot = async () => {
    const rows: Record<string, unknown> = {};
    for (const table of tables) rows[table] = await db.query(`select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`);
    return rows;
  };
  const objects = () => db.query(`
    select 'policy:' || tablename || '.' || policyname as name from pg_policies where schemaname = 'public'
    union all select 'trigger:' || tgname from pg_trigger where not tgisinternal
    order by 1`);

  it('carries exactly the migration, so the SQL Editor file cannot drift from it', () => {
    expect(setup().endsWith(migration())).toBe(true);
  });

  it('reruns, before or after core-setup.sql, without changing data or losing what it adds', async () => {
    const before = await snapshot();
    const named = await objects();

    await db.exec(setup());
    await db.exec(setup());
    await db.exec(core());

    expect(await snapshot()).toEqual(before);
    expect(await objects()).toEqual(named);

    // The rules still hold after the reruns.
    const id = await post(ada, 'After reruns');
    await db.asUser(ada, 'update public.posts set like_count = 5 where id = $1', [id]);
    expect((await postRow(id)).like_count).toBe(0);
  });
});
