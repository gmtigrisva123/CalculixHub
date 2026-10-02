import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './db.harness';

describe('saved exam archive sessions', () => {
  let db: TestDatabase;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await db.createUser({ email: 'archive-alice@example.com', username: 'archive_alice' });
    bob = await db.createUser({ email: 'archive-bob@example.com', username: 'archive_bob' });
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('saves answers and position for the owner, including an unfinished paper', async () => {
    await db.asUser(alice, `insert into public.exam_archive_progress
      (user_id, collection_id, answers, current_index)
      values ($1, 'amc12-2025a', '{"amc12-2025a-p1":"2"}'::jsonb, 5)`, [alice]);
    const own = await db.asUser<{ answers: Record<string, string>; current_index: number }>(alice,
      `select answers, current_index from public.exam_archive_progress where collection_id='amc12-2025a'`);
    expect(own[0]?.answers['amc12-2025a-p1']).toBe('2');
    expect(own[0]?.current_index).toBe(5);
  });

  it('keeps other accounts and guests out of a learner’s saved answers', async () => {
    expect(await db.asUser(bob, `select * from public.exam_archive_progress where user_id=$1`, [alice])).toEqual([]);
    expect(await db.asUser(null, `select * from public.exam_archive_progress where user_id=$1`, [alice])).toEqual([]);
    await expect(db.asUser(bob, `insert into public.exam_archive_progress (user_id,collection_id)
      values ($1,'aime-2026')`, [alice])).rejects.toThrow();
  });
});
