/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Who holds which role in a community, run against real PostgreSQL via PGlite.
 *
 * The insert policy on `community_members` only ever checked that a learner
 * was adding themselves. It did not look at the role they asked for or at the
 * community they were joining, so "owner of someone else's community" and
 * "member of a private one" were both one request away. These tests are that
 * request, made from the wrong side, against every guard the roles file adds.
 *
 * Most of them run on the full schema, as every other suite does. One group
 * runs on a database with the core file only, because that is where the old
 * hole went furthest: with the cohort file applied, an update of a community
 * fails for an unrelated reason (see the roles file), and that failure would
 * hide what a self-appointed owner could otherwise do.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let ada: string;
let bob: string;
let eve: string;
let open: string;
let closed: string;

const community = async (creator: string, slug: string, isPrivate = false) => {
  const [row] = await db.asUser<{ id: string }>(
    creator,
    `insert into public.communities (slug, name, is_private, created_by) values ($1, $2, $3, $4) returning id`,
    [slug, `Circle ${slug}`, isPrivate, creator],
  );
  return row!.id;
};

/** Join as yourself, optionally asking for a role the way a hand-written request could. */
const join = (who: string, id: string, role?: string) =>
  role
    ? db.asUser(who, `insert into public.community_members (community_id, user_id, role) values ($1, $2, $3)`, [id, who, role])
    : db.asUser(who, `insert into public.community_members (community_id, user_id) values ($1, $2)`, [id, who]);

const leave = (who: string, id: string) =>
  db.asUser(who, `delete from public.community_members where community_id = $1 and user_id = $2`, [id, who]);

const roleOf = async (who: string, id: string) =>
  (await db.query<{ role: string }>('select role from public.community_members where community_id = $1 and user_id = $2', [id, who]))[0]?.role ?? null;

const row = async (id: string) =>
  (await db.query<{ name: string; is_private: boolean; created_by: string | null; member_count: number }>(
    'select name, is_private, created_by, member_count from public.communities where id = $1',
    [id],
  ))[0]!;

beforeAll(async () => {
  db = await createTestDatabase();
  ada = await db.createUser({ email: 'roles-ada@example.com', username: 'roles_ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'roles-bob@example.com', username: 'roles_bob', displayName: 'Bob' });
  eve = await db.createUser({ email: 'roles-eve@example.com', username: 'roles_eve', displayName: 'Eve' });
  open = await community(ada, 'roles-open');
  closed = await community(ada, 'roles-closed', true);
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe('the role a learner gets', () => {
  it('is owner for the creator and member for everybody else, whatever they ask for', async () => {
    await join(ada, open);
    await join(eve, open, 'owner');
    await join(bob, open, 'moderator');

    expect(await roleOf(ada, open)).toBe('owner');
    expect(await roleOf(eve, open)).toBe('member');
    expect(await roleOf(bob, open)).toBe('member');
  });

  it('cannot be claimed while the creator has not joined, or has left', async () => {
    const away = await community(ada, 'roles-away');

    await join(eve, away, 'owner');
    expect(await roleOf(eve, away)).toBe('member');

    // The creator is owner even when they ask for less: the title is not theirs to decline to someone else.
    await join(ada, away, 'member');
    expect(await roleOf(ada, away)).toBe('owner');

    await leave(ada, away);
    await join(bob, away, 'owner');
    expect(await roleOf(bob, away)).toBe('member');

    await join(ada, away);
    expect(await roleOf(ada, away)).toBe('owner');
    const owners = await db.query('select user_id from public.community_members where community_id = $1 and role = $2', [away, 'owner']);
    expect(owners).toEqual([{ user_id: ada }]);
  });

  it('is member when the community is created and joined in one statement', async () => {
    // The join in the main INSERT runs before the WITH clause has created the
    // community, so the guard cannot read it. It must not take that as leave to
    // believe the request.
    const id = '5f0e7c1a-9b2d-4c3e-8f10-a1b2c3d4e5f6';
    const [joined] = await db.asUser<{ role: string }>(
      eve,
      `with made as (
         insert into public.communities (id, slug, name, created_by) values ($1, 'roles-one-statement', 'One statement', $2)
       )
       insert into public.community_members (community_id, user_id, role) values ($1, $2, 'moderator') returning role`,
      [id, eve],
    );

    expect(joined).toEqual({ role: 'member' });
    // It is theirs, so the title is one ordinary join away.
    await leave(eve, id);
    await join(eve, id);
    expect(await roleOf(eve, id)).toBe('owner');
  });

  it('dates the join itself', async () => {
    const dated = await community(ada, 'roles-dated');
    const [made] = await db.asUser<{ joined_at: string }>(
      eve,
      `insert into public.community_members (community_id, user_id, joined_at) values ($1, $2, '2001-01-01') returning joined_at`,
      [dated, eve],
    );

    expect(new Date(made!.joined_at).getFullYear()).toBeGreaterThan(2020);
  });

  it('still cannot be written for somebody else', async () => {
    const other = await community(ada, 'roles-other');
    await expect(
      db.asUser(eve, `insert into public.community_members (community_id, user_id) values ($1, $2)`, [other, bob]),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('a private community', () => {
  it('cannot be joined by someone who knows its id', async () => {
    await join(ada, closed, 'owner');
    expect(await roleOf(ada, closed)).toBe('owner');
    await db.asUser(ada, `insert into public.posts (author_id, community_id, body) values ($1, $2, 'members only')`, [ada, closed]);

    await expect(join(eve, closed)).rejects.toThrow(/cannot join this community/i);
    await expect(join(eve, closed, 'owner')).rejects.toThrow(/cannot join this community/i);

    expect(await roleOf(eve, closed)).toBeNull();
    expect(await db.asUser(eve, 'select id from public.communities where id = $1', [closed])).toHaveLength(0);
    expect(await db.asUser(eve, 'select id from public.posts where community_id = $1', [closed])).toHaveLength(0);
    expect((await row(closed)).member_count).toBe(1);
  });

  it('is opened to a learner by the service role, as a member', async () => {
    await db.query(`insert into public.community_members (community_id, user_id) values ($1, $2)`, [closed, eve]);

    expect(await roleOf(eve, closed)).toBe('member');
    expect(await db.asUser(eve, 'select id from public.communities where id = $1', [closed])).toHaveLength(1);
    expect(await db.asUser(eve, 'select id from public.posts where community_id = $1', [closed])).toHaveLength(1);
  });

  it('keeps a moderator the service role appoints', async () => {
    await db.query(`insert into public.community_members (community_id, user_id, role) values ($1, $2, 'moderator')`, [closed, bob]);
    expect(await roleOf(bob, closed)).toBe('moderator');
  });
});

describe('a membership', () => {
  it('has no update path for a client', async () => {
    const promoted = await db.asUser(eve, `update public.community_members set role = 'owner' where community_id = $1 and user_id = $2 returning role`, [open, eve]);

    expect(promoted).toHaveLength(0);
    expect(await roleOf(eve, open)).toBe('member');
  });

  it('stays what it was even if an update policy is added later', async () => {
    await db.exec(`create policy test_members_update on public.community_members for update using (auth.uid() = user_id) with check (auth.uid() = user_id)`);
    try {
      const other = await community(eve, 'roles-elsewhere');
      const edited = await db.asUser<{ role: string; community_id: string }>(
        eve,
        `update public.community_members set role = 'owner', community_id = $3 where community_id = $1 and user_id = $2 returning role, community_id`,
        [open, eve, other],
      );

      expect(edited).toEqual([{ role: 'member', community_id: open }]);
      expect(await roleOf(eve, other)).toBeNull();
    } finally {
      await db.exec('drop policy test_members_update on public.community_members');
    }
  });
});

describe('a community’s bookkeeping', () => {
  /*
   * On the full schema an update of a community cannot be evaluated: the
   * cohort policy on `communities` contains a sub-select, and with it
   * PostgreSQL treats communities -> community_members -> communities as a
   * loop. These tests swap the update policy for one that reads memberships
   * through a function, which has no loop, so the guard can be held to what it
   * promises. The group at the end of this file does the same thing on a
   * database that never had the loop.
   */
  beforeAll(async () => {
    await db.exec(`
      create function public.test_is_staff(target uuid) returns boolean
      language sql stable security definer set search_path = public, pg_temp as $fn$
        select exists (
          select 1 from public.community_members m
          where m.community_id = target and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
        );
      $fn$;
      drop policy communities_update_owner on public.communities;
      create policy communities_update_owner on public.communities for update
        using (public.test_is_staff(id)) with check (public.test_is_staff(id));
    `);
  });

  afterAll(async () => {
    // Back to the policy exactly as the core file writes it.
    await db.exec(`
      drop policy communities_update_owner on public.communities;
      create policy communities_update_owner
        on public.communities for update
        using (exists (
          select 1 from public.community_members m
          where m.community_id = id and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
        ));
      drop function public.test_is_staff(uuid);
    `);
  });

  it('is out of reach of a member who asked to be owner', async () => {
    const taken = await db.asUser(eve, `update public.communities set name = 'Taken over', is_private = true where id = $1 returning id`, [open]);

    expect(taken).toHaveLength(0);
    expect(await row(open)).toMatchObject({ name: 'Circle roles-open', is_private: false });
  });

  it('survives its owner’s update, which may still rename it', async () => {
    const before = await row(open);
    const [after] = await db.asUser<{ name: string; member_count: number; created_by: string }>(
      ada,
      `update public.communities set name = 'Renamed by its owner', member_count = 999, created_by = $2, created_at = '2000-01-01'
        where id = $1 returning name, member_count, created_by`,
      [open, eve],
    );

    expect(after).toEqual({ name: 'Renamed by its owner', member_count: before.member_count, created_by: ada });
    // Handing the community to someone else did not work, so they cannot claim the title either.
    await leave(eve, open);
    await join(eve, open, 'owner');
    expect(await roleOf(eve, open)).toBe('member');
  });

  it('can be reworded by a moderator the service role appointed, and no further', async () => {
    const [after] = await db.asUser<{ name: string; created_by: string }>(
      bob,
      `update public.communities set name = 'Reworded by a moderator', created_by = $2 where id = $1 returning name, created_by`,
      [closed, bob],
    );

    expect(after).toEqual({ name: 'Reworded by a moderator', created_by: ada });
  });

  it('starts from nothing, whatever the request says', async () => {
    const [made] = await db.asUser<{ id: string; member_count: number; created_at: string }>(
      eve,
      `insert into public.communities (slug, name, created_by, member_count, created_at)
       values ('roles-inflated', 'Inflated', $1, 99999, '2001-01-01') returning id, member_count, created_at`,
      [eve],
    );

    expect(made!.member_count).toBe(0);
    expect(new Date(made!.created_at).getFullYear()).toBeGreaterThan(2020);
    await join(eve, made!.id);
    expect((await row(made!.id)).member_count).toBe(1);
  });

  it('still counts members as they come and go', async () => {
    const dan = await db.createUser({ email: 'roles-dan@example.com', username: 'roles_dan' });
    const before = (await row(open)).member_count;
    expect(before).toBe(3);

    await join(dan, open);
    expect((await row(open)).member_count).toBe(before + 1);
    await leave(dan, open);
    expect((await row(open)).member_count).toBe(before);
  });

  it('outlives its creator’s account, and nobody inherits the title', async () => {
    const zed = await db.createUser({ email: 'roles-zed@example.com', username: 'roles_zed' });
    const orphan = await community(zed, 'roles-orphan');
    await join(zed, orphan);
    await join(bob, orphan);
    expect(await row(orphan)).toMatchObject({ created_by: zed, member_count: 2 });

    await db.query('delete from auth.users where id = $1', [zed]);
    expect(await row(orphan)).toMatchObject({ created_by: null, member_count: 1 });

    await leave(bob, orphan);
    await join(bob, orphan, 'owner');
    expect(await roleOf(bob, orphan)).toBe('member');
  });
});

describe('SQL Editor setup', () => {
  const setup = () => readFileSync(new URL('../../supabase/community-roles-setup.sql', import.meta.url), 'utf8');
  const migration = () => readFileSync(new URL('../../supabase/migrations/20261126000100_community_roles.sql', import.meta.url), 'utf8');
  const core = () => readFileSync(new URL('../../supabase/core-setup.sql', import.meta.url), 'utf8');
  const objects = () => db.query(`
    select 'policy:' || tablename || '.' || policyname as name from pg_policies where schemaname = 'public'
    union all select 'trigger:' || tgname from pg_trigger where not tgisinternal
    order by 1`);
  let legacy: string;

  it('is exactly the migration, so the SQL Editor file cannot drift from it', () => {
    expect(setup()).toBe(migration());
  });

  it('resets, the first time it runs, every role it cannot vouch for', async () => {
    // A database as it was before this file: the insert guard is not there yet.
    await db.exec('drop trigger community_members_guard_insert on public.community_members');
    legacy = await community(ada, 'roles-legacy');
    await join(ada, legacy, 'owner');
    await join(eve, legacy, 'owner');
    await join(bob, legacy, 'moderator');
    expect([await roleOf(ada, legacy), await roleOf(eve, legacy), await roleOf(bob, legacy)]).toEqual(['owner', 'owner', 'moderator']);

    await db.exec(setup());

    expect([await roleOf(ada, legacy), await roleOf(eve, legacy), await roleOf(bob, legacy)]).toEqual(['owner', 'member', 'member']);
    // Elsewhere, what the guards themselves wrote is left alone.
    expect(await roleOf(ada, open)).toBe('owner');
    expect((await row(legacy)).member_count).toBe(3);
  });

  it('keeps later grants, and its own guards, through reruns before or after core-setup.sql', async () => {
    await db.query(`update public.community_members set role = 'moderator' where community_id = $1 and user_id = $2`, [legacy, bob]);
    const named = await objects();
    const members = await db.query('select community_id, user_id, role from public.community_members order by 1, 2');

    await db.exec(setup());
    await db.exec(setup());
    await db.exec(core());
    await db.exec(setup());

    expect(await objects()).toEqual(named);
    expect(await db.query('select community_id, user_id, role from public.community_members order by 1, 2')).toEqual(members);
    expect(await roleOf(bob, legacy)).toBe('moderator');

    // The rules still hold after the reruns.
    const late = await db.createUser({ email: 'roles-late@example.com', username: 'roles_late' });
    await join(late, legacy, 'owner');
    expect(await roleOf(late, legacy)).toBe('member');
    await expect(join(late, closed)).rejects.toThrow(/cannot join this community/i);
  });
});

describe('where the update policy works as written (a database with the core file only)', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  let bare: TestDatabase;
  let founder: string;
  let rival: string;
  let circle: string;

  const state = async () =>
    (await bare.query<{ name: string; is_private: boolean; created_by: string }>('select name, is_private, created_by from public.communities where id = $1', [circle]))[0]!;
  const role = async (who: string) =>
    (await bare.query<{ role: string }>('select role from public.community_members where community_id = $1 and user_id = $2', [circle, who]))[0]?.role ?? null;

  beforeAll(async () => {
    bare = await createTestDatabase({ scripts: [read('../../supabase/core-setup.sql')] });
    founder = await bare.createUser({ email: 'bare-founder@example.com', username: 'bare_founder' });
    rival = await bare.createUser({ email: 'bare-rival@example.com', username: 'bare_rival' });
    const [made] = await bare.asUser<{ id: string }>(
      founder,
      `insert into public.communities (slug, name, created_by) values ('bare-circle', 'Founders', $1) returning id`,
      [founder],
    );
    circle = made!.id;
    await bare.asUser(founder, `insert into public.community_members (community_id, user_id, role) values ($1, $2, 'owner')`, [circle, founder]);
  }, 30000);

  afterAll(async () => {
    await bare?.close();
  });

  it('let a learner appoint themselves owner, before the roles file', async () => {
    // The hole itself, kept here so that what follows is known to close something.
    await bare.asUser(rival, `insert into public.community_members (community_id, user_id, role) values ($1, $2, 'owner')`, [circle, rival]);
    expect(await role(rival)).toBe('owner');

    const reworded = await bare.asUser<{ name: string }>(rival, `update public.communities set name = 'Reworded by a stranger' where id = $1 returning name`, [circle]);
    expect(reworded).toEqual([{ name: 'Reworded by a stranger' }]);
  });

  it('takes the title back when the roles file arrives, and the reach with it', async () => {
    await bare.exec(read('../../supabase/community-roles-setup.sql'));

    expect(await role(founder)).toBe('owner');
    expect(await role(rival)).toBe('member');

    const taken = await bare.asUser(rival, `update public.communities set name = 'Taken over', is_private = true, created_by = $2 where id = $1 returning id`, [circle, rival]);
    expect(taken).toHaveLength(0);
    expect(await state()).toMatchObject({ name: 'Reworded by a stranger', is_private: false, created_by: founder });

    // Asking again changes nothing.
    await bare.asUser(rival, `delete from public.community_members where community_id = $1 and user_id = $2`, [circle, rival]);
    await bare.asUser(rival, `insert into public.community_members (community_id, user_id, role) values ($1, $2, 'owner')`, [circle, rival]);
    expect(await role(rival)).toBe('member');
  });

  it('leaves its owner able to reword it, and unable to give it away', async () => {
    const [after] = await bare.asUser<{ name: string; created_by: string; member_count: number }>(
      founder,
      `update public.communities set name = 'Founders again', created_by = $2, member_count = 500 where id = $1 returning name, created_by, member_count`,
      [circle, rival],
    );

    expect(after).toEqual({ name: 'Founders again', created_by: founder, member_count: 2 });
  });

  it('keeps a private community closed to someone who knows its id', async () => {
    await bare.asUser(founder, `update public.communities set is_private = true where id = $1`, [circle]);
    const late = await bare.createUser({ email: 'bare-late@example.com', username: 'bare_late' });

    await expect(
      bare.asUser(late, `insert into public.community_members (community_id, user_id) values ($1, $2)`, [circle, late]),
    ).rejects.toThrow(/cannot join this community/i);
    // The rival joined while it was open, and stays in.
    expect(await bare.asUser(rival, 'select id from public.communities where id = $1', [circle])).toHaveLength(1);
  });
});
