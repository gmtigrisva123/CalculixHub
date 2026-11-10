/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account controls and billing, run against real PostgreSQL.
 *
 * The promises under test: a learner cannot give themselves a paid plan, can
 * see no subscription but their own, and the two destructive functions touch
 * the caller's rows and nobody else's.
 */

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let ada: string;
let bob: string;

const attempt = (user: string, problem: string, points: number) =>
  db.query(
    `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded)
     values ($1, $2, 'Algebra', 'Foundation', '7', $3, $4)`,
    [user, problem, points > 0, points],
  );

beforeAll(async () => {
  db = await createTestDatabase();
  ada = await db.createUser({ email: 'ada@example.com', username: 'ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'bob@example.com', username: 'bob', displayName: 'Bob' });
});

afterAll(async () => {
  await db?.close();
});

describe('subscriptions', () => {
  it('cannot be created or changed by the learner they describe', async () => {
    await expect(
      db.asUser(ada, `insert into public.subscriptions (user_id, plan, status) values ($1, 'pro', 'active')`, [ada]),
    ).rejects.toThrow(/row-level security/i);

    // Written the way the webhook writes it: as the owner, past RLS.
    await db.query(`insert into public.subscriptions (user_id, plan, status, billing_cycle) values ($1, 'pro', 'canceled', 'monthly')`, [ada]);

    // An update with no permitting policy matches no rows rather than failing.
    await db.asUser(ada, `update public.subscriptions set status = 'active' where user_id = $1`, [ada]);
    const [row] = await db.query<{ status: string }>('select status from public.subscriptions where user_id = $1', [ada]);
    expect(row!.status).toBe('canceled');
  });

  it('are visible only to their owner', async () => {
    expect(await db.asUser(ada, 'select plan from public.subscriptions')).toHaveLength(1);
    expect(await db.asUser(bob, 'select plan from public.subscriptions')).toHaveLength(0);
    expect(await db.asUser(null, 'select plan from public.subscriptions')).toHaveLength(0);
  });

  it('accept only the plans that are sold', async () => {
    await expect(
      db.query(`insert into public.subscriptions (user_id, plan, status) values ($1, 'free', 'active')`, [bob]),
    ).rejects.toThrow(/check constraint/i);
  });
});

describe('the founding list', () => {
  it('lets a learner add and read only their own entry', async () => {
    await db.asUser(ada, `insert into public.plan_interest (user_id, plan, note) values ($1, 'team', 'Lincoln High math club')`, [ada]);
    await expect(
      db.asUser(ada, `insert into public.plan_interest (user_id, plan) values ($1, 'pro')`, [bob]),
    ).rejects.toThrow(/row-level security/i);

    expect(await db.asUser(ada, 'select plan from public.plan_interest')).toEqual([{ plan: 'team' }]);
    expect(await db.asUser(bob, 'select plan from public.plan_interest')).toHaveLength(0);
  });
});

describe('reset_my_progress', () => {
  it('clears the caller’s practice record and leaves everyone else’s', async () => {
    await attempt(ada, 'alg-f01', 10);
    await attempt(bob, 'alg-f01', 10);

    await db.asUser(ada, 'select public.reset_my_progress()');

    expect(await db.query('select 1 from public.problem_attempts where user_id = $1', [ada])).toHaveLength(0);
    expect(await db.query('select 1 from public.user_stats where user_id = $1', [ada])).toHaveLength(0);
    expect(await db.query('select 1 from public.skill_mastery where user_id = $1', [ada])).toHaveLength(0);

    const [other] = await db.query<{ points: number }>('select points from public.user_stats where user_id = $1', [bob]);
    expect(other!.points).toBe(10);
  });

  it('starts the statistics again from the next attempt', async () => {
    await attempt(ada, 'alg-f01', 10);
    const [stats] = await db.query<{ points: number; attempts_total: number }>('select points, attempts_total from public.user_stats where user_id = $1', [ada]);
    expect(stats).toMatchObject({ points: 10, attempts_total: 1 });
  });

  it('is not callable signed out', async () => {
    await expect(db.asUser(null, 'select public.reset_my_progress()')).rejects.toThrow(/permission denied|sign in required/i);
  });
});

describe('delete_my_account', () => {
  it('refuses while a subscription is still renewing', async () => {
    await db.query(`update public.subscriptions set status = 'active', cancel_at_period_end = false where user_id = $1`, [ada]);
    await expect(db.asUser(ada, 'select public.delete_my_account()')).rejects.toThrow(/cancel your subscription/i);
    expect(await db.query('select 1 from auth.users where id = $1', [ada])).toHaveLength(1);
  });

  it('removes the caller and everything that hangs off them, and nobody else', async () => {
    await db.query(`update public.subscriptions set cancel_at_period_end = true where user_id = $1`, [ada]);

    await db.asUser(ada, 'select public.delete_my_account()');

    for (const table of ['auth.users where id', 'public.profiles where id', 'public.problem_attempts where user_id', 'public.subscriptions where user_id', 'public.plan_interest where user_id']) {
      expect(await db.query(`select 1 from ${table} = $1`, [ada]), table).toHaveLength(0);
    }
    expect(await db.query('select 1 from public.profiles where id = $1', [bob])).toHaveLength(1);
    expect(await db.query('select 1 from public.problem_attempts where user_id = $1', [bob])).toHaveLength(1);
  });

  it('is not callable signed out', async () => {
    await expect(db.asUser(null, 'select public.delete_my_account()')).rejects.toThrow(/permission denied|sign in required/i);
  });
});

describe('SQL Editor reruns', () => {
  it('applies a second time without losing rows or policies', async () => {
    await db.query(`insert into public.subscriptions (user_id, plan, status) values ($1, 'team', 'active')`, [bob]);
    await db.exec(readFileSync(new URL('../../supabase/account-billing-setup.sql', import.meta.url), 'utf8'));

    expect(await db.asUser(bob, 'select plan from public.subscriptions')).toEqual([{ plan: 'team' }]);
    await expect(
      db.asUser(bob, `update public.subscriptions set plan = 'pro' where user_id = $1 returning plan`, [bob]),
    ).resolves.toHaveLength(0);
  });

  it('keeps the migration and the SQL Editor file identical', () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    expect(read('../../supabase/migrations/20261110000200_account_billing.sql')).toBe(read('../../supabase/account-billing-setup.sql'));
  });
});
