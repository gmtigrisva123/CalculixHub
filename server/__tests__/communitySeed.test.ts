/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The opening Community Solutions threads, applied to real PostgreSQL via
 * PGlite exactly as the SQL Editor would run them.
 *
 * Checks that the committed SQL is what the generator produces, that it
 * applies on top of every migration, that every thread has at least ten
 * people replying with counters that match the rows, that learners can read
 * it, that a rerun changes nothing, and that the cleanup removes it all while
 * leaving learners' own posts alone.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTestDatabase, type TestDatabase } from './db.harness';
import { buildCleanupSql, buildSeedSql, SEED_EMAIL_DOMAIN, threads } from '../../scripts/community-seed/build.mjs';

const file = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

// The columns of Supabase's auth.users that the seed writes and the harness
// stub does not declare.
const AUTH_COLUMNS = `
  alter table auth.users
    add column if not exists instance_id uuid,
    add column if not exists aud text,
    add column if not exists role text,
    add column if not exists encrypted_password text,
    add column if not exists email_confirmed_at timestamptz,
    add column if not exists raw_app_meta_data jsonb,
    add column if not exists updated_at timestamptz,
    add column if not exists confirmation_token text,
    add column if not exists recovery_token text,
    add column if not exists email_change_token_new text,
    add column if not exists email_change text;
`;

let db: TestDatabase;
let learner: string;

const seedCounts = async () => {
  const [row] = await db.query<{ posts: number; comments: number; likes: number; comment_likes: number }>(`
    select
      (select count(*)::int from public.posts p join auth.users u on u.id = p.author_id where u.email like '%@${SEED_EMAIL_DOMAIN}') as posts,
      (select count(*)::int from public.comments) as comments,
      (select count(*)::int from public.post_likes) as likes,
      (select count(*)::int from public.comment_likes) as comment_likes
  `);
  return row!;
};

beforeAll(async () => {
  db = await createTestDatabase();
  await db.exec(AUTH_COLUMNS);
  learner = await db.createUser({ email: 'lan@example.com', username: 'lan_learner' });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('community seed', () => {
  it('is committed exactly as the generator builds it', () => {
    expect(file('supabase/community-seed.sql')).toBe(buildSeedSql());
    expect(file('supabase/community-seed-cleanup.sql')).toBe(buildCleanupSql());
  });

  it('applies, with ten or more people replying under every post', async () => {
    await db.exec(file('supabase/community-seed.sql'));

    const posts = await db.query<{ id: string; comment_count: number; like_count: number; repliers: number; rows: number; likes: number }>(`
      select p.id, p.comment_count, p.like_count,
        (select count(distinct c.author_id)::int from public.comments c where c.post_id = p.id and c.author_id <> p.author_id) as repliers,
        (select count(*)::int from public.comments c where c.post_id = p.id and c.deleted_at is null) as rows,
        (select count(*)::int from public.post_likes l where l.post_id = p.id) as likes
      from public.posts p
    `);

    expect(posts).toHaveLength(threads.length);
    for (const post of posts) {
      expect(post.repliers).toBeGreaterThanOrEqual(10);
      expect(post.comment_count).toBe(post.rows);
      expect(post.like_count).toBe(post.likes);
    }

    const [future] = await db.query<{ n: number }>(`
      select (select count(*)::int from public.posts where created_at > now())
           + (select count(*)::int from public.comments where created_at > now()) as n
    `);
    expect(future!.n).toBe(0);

    const [inbox] = await db.query<{ n: number }>('select count(*)::int as n from public.notifications');
    expect(inbox!.n).toBe(0);
  }, 60_000);

  it('is read by learners like any other post', async () => {
    const visible = await db.asUser<{ n: number }>(learner, 'select count(*)::int as n from public.posts');
    expect(visible[0]!.n).toBe(threads.length);
    const replies = await db.asUser<{ n: number }>(learner, 'select count(*)::int as n from public.comments where parent_id is not null');
    expect(replies[0]!.n).toBeGreaterThan(0);
  });

  it('changes nothing when run again', async () => {
    const before = await seedCounts();
    await db.exec(file('supabase/community-seed.sql'));
    expect(await seedCounts()).toEqual(before);
  }, 60_000);

  it('brings the wording of an earlier seed up to date without marking it edited', async () => {
    const [post] = await db.query<{ id: string; body: string }>('select id, body from public.posts order by created_at limit 1');
    const [comment] = await db.query<{ id: string; body: string }>('select id, body from public.comments order by created_at limit 1');
    await db.exec(`
      alter table public.posts disable trigger posts_guard_update;
      alter table public.comments disable trigger comments_guard_update;
      update public.posts set body = 'Old wording' where id = '${post!.id}';
      update public.comments set body = 'Old wording' where id = '${comment!.id}';
      alter table public.posts enable trigger posts_guard_update;
      alter table public.comments enable trigger comments_guard_update;
    `);
    const before = await seedCounts();

    await db.exec(file('supabase/community-seed.sql'));

    const [postAfter] = await db.query<{ body: string; edited_at: string | null }>('select body, edited_at from public.posts where id = $1', [post!.id]);
    const [commentAfter] = await db.query<{ body: string; edited_at: string | null }>('select body, edited_at from public.comments where id = $1', [comment!.id]);
    expect(postAfter).toEqual({ body: post!.body, edited_at: null });
    expect(commentAfter).toEqual({ body: comment!.body, edited_at: null });
    expect(await seedCounts()).toEqual(before);

    const disabled = await db.query<{ tgname: string }>(
      `select tgname from pg_trigger where tgrelid in ('public.posts'::regclass, 'public.comments'::regclass) and not tgisinternal and tgenabled = 'D'`,
    );
    expect(disabled).toEqual([]);
  }, 60_000);

  it('refuses to run when a learner already holds one of its usernames', async () => {
    const fresh = await createTestDatabase();
    try {
      await fresh.exec(AUTH_COLUMNS);
      await fresh.createUser({ email: 'someone@example.com', username: 'meilin_chen' });
      await expect(fresh.exec(file('supabase/community-seed.sql'))).rejects.toThrow(/already belong to learners: meilin_chen/);
    } finally {
      await fresh.close();
    }
  }, 60_000);

  it('cleans up everything it wrote and nothing else', async () => {
    const [mine] = await db.asUser<{ id: string }>(
      learner,
      'insert into public.posts (author_id, body) values ($1, $2) returning id',
      [learner, 'My own question'],
    );

    await db.exec(file('supabase/community-seed-cleanup.sql'));

    const left = await db.query<{ id: string }>('select id from public.posts');
    expect(left.map((row) => row.id)).toEqual([mine!.id]);
    const [accounts] = await db.query<{ n: number }>(`select count(*)::int as n from auth.users where email like '%@${SEED_EMAIL_DOMAIN}'`);
    expect(accounts!.n).toBe(0);
  });
});
