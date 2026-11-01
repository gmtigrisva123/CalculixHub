/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Email delivery: every notification is queued for its recipient, every post
 * is queued for every other learner, and nobody outside the server can read
 * or write the queue. Run against real PostgreSQL via PGlite.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let ada: string;
let bob: string;
let eve: string;
let seed: string;
let qa: string;

const post = async (author: string, body: string) => {
  const [row] = await db.asUser<{ id: string }>(author, `insert into public.posts (author_id, body) values ($1, $2) returning id`, [author, body]);
  return row!.id;
};

const outboxFor = (column: 'post_id' | 'notification_id', id: string) =>
  db.query<{ recipient_id: string; kind: string; status: string }>(
    `select recipient_id, kind, status from public.email_outbox where ${column} = $1 order by recipient_id`,
    [id],
  );

beforeAll(async () => {
  db = await createTestDatabase();
  ada = await db.createUser({ email: 'mail-ada@example.com', username: 'mail_ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'mail-bob@example.com', username: 'mail_bob', displayName: 'Bob' });
  eve = await db.createUser({ email: 'mail-eve@example.com', username: 'mail_eve', displayName: 'Eve' });
  seed = await db.createUser({ email: 'seed@community-seed.calculixhub.invalid', username: 'mail_seed', displayName: 'Seed' });
  qa = await db.createUser({ email: 'team+cxqa-mail@example.com', username: 'mail_qa', displayName: 'QA' });
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe('new posts', () => {
  it('queue one email for every other reachable learner in the same cohort', async () => {
    const id = await post(ada, 'Here is a neat trick for telescoping sums.');
    const rows = await outboxFor('post_id', id);
    expect(rows.map(r => r.recipient_id).sort()).toEqual([bob, eve].sort());
    expect(rows.every(r => r.kind === 'new_post' && r.status === 'pending')).toBe(true);
  });

  it('skip suspended accounts', async () => {
    await db.query(`update auth.users set banned_until = now() + interval '7 days' where id = $1`, [eve]);
    const id = await post(ada, 'Second post');
    expect((await outboxFor('post_id', id)).map(r => r.recipient_id)).toEqual([bob]);
    await db.query(`update auth.users set banned_until = null where id = $1`, [eve]);
  });

  it('keep QA posts inside the QA cohort', async () => {
    const id = await post(qa, 'QA post');
    expect(await outboxFor('post_id', id)).toEqual([]);
    expect(seed).toBeTruthy();
  });
});

describe('notifications', () => {
  it('queue an email for the recipient of each stored notification', async () => {
    await db.asUser(bob, `insert into public.follows (follower_id, following_id) values ($1, $2)`, [bob, ada]);
    const [notification] = await db.query<{ id: string }>(`select id from public.notifications where user_id = $1 and type = 'follow'`, [ada]);
    expect(notification).toBeTruthy();
    const rows = await outboxFor('notification_id', notification!.id);
    expect(rows).toEqual([{ recipient_id: ada, kind: 'notification', status: 'pending' }]);
  });

  it('hand the dispatcher everything it needs to render the email', async () => {
    const claimed = await db.query<{ kind: string; recipient_email: string; payload: Record<string, unknown> }>(
      `select kind, recipient_email, payload from public.claim_email_outbox(200)`,
    );
    const follow = claimed.find(row => row.kind === 'notification');
    expect(follow?.recipient_email).toBe('mail-ada@example.com');
    expect(follow?.payload).toMatchObject({ type: 'follow', actor: 'Bob' });
    const broadcast = claimed.find(row => row.kind === 'new_post');
    expect(broadcast?.payload).toMatchObject({ author: 'Ada', deleted: false });

    const again = await db.query(`select id from public.claim_email_outbox(200)`);
    expect(again).toEqual([]);
  });
});

describe('the queue', () => {
  it('is invisible and unwritable to learners', async () => {
    // Row-level security with no policy: the table reads as empty, whatever it holds.
    expect(await db.asUser(ada, `select id from public.email_outbox`).catch(() => [])).toEqual([]);
    await expect(db.asUser(ada, `insert into public.email_outbox (recipient_id, kind, post_id) values ($1, 'new_post', gen_random_uuid())`, [ada])).rejects.toThrow();
    await expect(db.asUser(ada, `select * from public.claim_email_outbox(10)`)).rejects.toThrow();
    expect(await db.asUser(ada, `select dispatch_secret from public.email_settings`).catch(() => [])).toEqual([]);
  });

  it('reapplies without duplicating mail or losing the queue', async () => {
    const before = await db.query<{ total: number }>(`select count(*)::int as total from public.email_outbox`);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261103000100_email_delivery.sql', import.meta.url), 'utf8'));
    const after = await db.query<{ total: number }>(`select count(*)::int as total from public.email_outbox`);
    expect(after).toEqual(before);
  });
});
