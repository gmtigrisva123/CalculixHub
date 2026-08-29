/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Migration tests, run against real PostgreSQL 18 via PGlite.
 *
 * These exist because row-level security is the primary authorization control
 * in this system -- not a second line of defence behind API checks, but the
 * thing actually deciding who may read and write each row. A policy that is
 * subtly wrong fails open and silently, so each one is exercised from both
 * sides: the permitted case must succeed and the forbidden case must not.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let ada: string;
let bob: string;
let eve: string;

beforeAll(async () => {
  db = await createTestDatabase();
  ada = await db.createUser({ email: 'ada@example.com', username: 'ada', displayName: 'Ada' });
  bob = await db.createUser({ email: 'bob@example.com', username: 'bob', displayName: 'Bob' });
  eve = await db.createUser({ email: 'eve@example.com', username: 'eve', displayName: 'Eve' });
});

afterAll(async () => {
  await db?.close();
});

describe('accounts and profiles', () => {
  it('provisions exactly one profile per account, by trigger', async () => {
    const rows = await db.query<{ n: number }>('select count(*)::int as n from public.profiles');
    expect(rows[0]!.n).toBe(3);
  });

  it('never leaks the email address into the public display name', async () => {
    const id = await db.createUser({ email: 'private.person@example.com' });
    const [profile] = await db.query<{ username: string; display_name: string }>(
      'select username, display_name from public.profiles where id = $1',
      [id],
    );

    expect(profile!.display_name).not.toContain('@');
    expect(profile!.display_name).toBe(profile!.username);
  });

  it('stores the capitalisation a learner chose', async () => {
    const id = await db.createUser({ email: 'mixed@example.com' });
    await db.asUser(id, `update public.profiles set username = 'AdaLovelace' where id = $1`, [id]);

    const [row] = await db.query<{ username: string }>('select username from public.profiles where id = $1', [id]);
    expect(row!.username).toBe('AdaLovelace');
  });

  it('rejects a username that differs only by case', async () => {
    await expect(
      db.query(`insert into public.profiles (id, username, display_name) values (gen_random_uuid(), 'ADA', 'x')`),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('lets a learner edit only their own profile', async () => {
    const mine = await db.asUser(ada, `update public.profiles set bio = 'mine' where id = $1 returning bio`, [ada]);
    expect(mine).toHaveLength(1);

    const theirs = await db.asUser(ada, `update public.profiles set bio = 'hacked' where id = $1 returning bio`, [bob]);
    expect(theirs).toHaveLength(0);
  });

  it('records onboarding server-side so it cannot be replayed by clearing storage', async () => {
    await db.asUser(ada, `update public.profiles set onboarded_at = now() where id = $1`, [ada]);
    const [row] = await db.query<{ onboarded_at: string | null }>(
      'select onboarded_at from public.profiles where id = $1',
      [ada],
    );

    expect(row!.onboarded_at).not.toBeNull();
  });
});

describe('the follow graph', () => {
  it('maintains follower and following counts by trigger', async () => {
    await db.asUser(ada, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [ada, bob]);
    await db.asUser(eve, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [eve, bob]);

    const [bobProfile] = await db.query<{ follower_count: number }>(
      'select follower_count from public.profiles where id = $1',
      [bob],
    );
    const [adaProfile] = await db.query<{ following_count: number }>(
      'select following_count from public.profiles where id = $1',
      [ada],
    );

    expect(bobProfile!.follower_count).toBe(2);
    expect(adaProfile!.following_count).toBe(1);
  });

  it('refuses a follow written under someone else name', async () => {
    await expect(
      db.asUser(eve, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [ada, eve]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('decrements on unfollow without going negative', async () => {
    await db.asUser(eve, 'delete from public.follows where follower_id = $1 and following_id = $2', [eve, bob]);

    const [bobProfile] = await db.query<{ follower_count: number }>(
      'select follower_count from public.profiles where id = $1',
      [bob],
    );

    expect(bobProfile!.follower_count).toBe(1);
  });
});

describe('scoring integrity', () => {
  it('gives clients no way to write an attempt, so points cannot be self-awarded', async () => {
    // The exploit this prevents: insert a correct attempt worth 35 points.
    await expect(
      db.asUser(
        ada,
        `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded)
         values ($1, 'alg-o01', 'Algebra', 'Olympiad', 'whatever', true, 35)`,
        [ada],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('derives points, accuracy and solved count from the attempt log', async () => {
    // Written as the service role, which is how the server records a graded
    // attempt. This is the only writer.
    await db.query(
      `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded, duration_ms)
       values ($1, 'alg-f01', 'Algebra', 'Foundation', '7', true, 10, 30000),
              ($1, 'geo-f01', 'Geometry', 'Foundation', '31', false, 0, 45000)`,
      [ada],
    );

    const [stats] = await db.query<{
      points: number; attempts_total: number; attempts_correct: number;
      problems_solved: number; accuracy_pct: string; time_spent_seconds: number;
    }>('select * from public.user_stats_view where user_id = $1', [ada]);

    expect(stats!.points).toBe(10);
    expect(stats!.attempts_total).toBe(2);
    expect(stats!.attempts_correct).toBe(1);
    expect(stats!.problems_solved).toBe(1);
    expect(Number(stats!.accuracy_pct)).toBe(50);
    expect(stats!.time_spent_seconds).toBe(75);
  });

  it('updates per-domain mastery from real attempts', async () => {
    const rows = await db.query<{ topic: string; mastery: string; attempts: number }>(
      'select topic, mastery, attempts from public.skill_mastery where user_id = $1 order by topic',
      [ada],
    );

    expect(rows.map((r) => [r.topic, Number(r.mastery)])).toEqual([
      ['Algebra', 100],
      ['Geometry', 0],
    ]);
  });

  it('awards points only once per problem, so resubmitting cannot farm score', async () => {
    await expect(
      db.query(
        `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded)
         values ($1, 'alg-f01', 'Algebra', 'Foundation', '7', true, 10)`,
        [ada],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    // A non-scoring re-practice attempt is still permitted and still logged.
    await db.query(
      `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded)
       values ($1, 'alg-f01', 'Algebra', 'Foundation', '7', true, 0)`,
      [ada],
    );

    const [stats] = await db.query<{ points: number }>('select points from public.user_stats where user_id = $1', [ada]);
    expect(stats!.points).toBe(10);
  });

  it('keeps an attempt log private to the learner who made it', async () => {
    const own = await db.asUser(ada, 'select id from public.problem_attempts where user_id = $1', [ada]);
    const other = await db.asUser(bob, 'select id from public.problem_attempts where user_id = $1', [ada]);

    expect(own.length).toBeGreaterThan(0);
    expect(other).toHaveLength(0);
  });

  it('ranks the leaderboard from real activity, excluding learners with none', async () => {
    const rows = await db.asUser<{ username: string; rank: number; points: number }>(
      bob,
      'select username, rank, points from public.leaderboard_view order by rank',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ username: 'ada', points: 10 });
  });
});

describe('posts, comments and likes', () => {
  let postId: string;

  // Built here rather than in the first test. Shared state assigned by one `it`
  // and consumed by the next makes the suite order-dependent -- running a single
  // test with `-t` then fails on an undefined id, which is how this was found.
  beforeAll(async () => {
    const [row] = await db.asUser<{ id: string }>(
      ada,
      `insert into public.posts (author_id, problem_id, body) values ($1, 'alg-f01', 'Try Viete.') returning id`,
      [ada],
    );
    postId = row!.id;
  });

  it('stamps authorship from the session, not the payload', async () => {
    await expect(
      db.asUser(eve, `insert into public.posts (author_id, body) values ($1, 'impersonated')`, [ada]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('counts each like once per user, enforced by the database', async () => {
    await db.asUser(bob, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [postId, bob]);

    await expect(
      db.asUser(bob, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [postId, bob]),
    ).rejects.toThrow(/duplicate key|unique/i);

    const [post] = await db.query<{ like_count: number }>('select like_count from public.posts where id = $1', [postId]);
    expect(post!.like_count).toBe(1);
  });

  it('refuses a like attributed to another user', async () => {
    await expect(
      db.asUser(eve, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [postId, bob]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('restores the count on unlike', async () => {
    await db.asUser(bob, 'delete from public.post_likes where post_id = $1 and user_id = $2', [postId, bob]);
    const [post] = await db.query<{ like_count: number }>('select like_count from public.posts where id = $1', [postId]);
    expect(post!.like_count).toBe(0);
  });

  it('maintains the comment count and hides soft-deleted replies', async () => {
    const [comment] = await db.asUser<{ id: string }>(
      bob,
      `insert into public.comments (post_id, author_id, body) values ($1, $2, 'Equality case?') returning id`,
      [postId, bob],
    );

    let [post] = await db.query<{ comment_count: number }>('select comment_count from public.posts where id = $1', [postId]);
    expect(post!.comment_count).toBe(1);

    await db.asUser(bob, 'update public.comments set deleted_at = now() where id = $1', [comment!.id]);

    [post] = await db.query<{ comment_count: number }>('select comment_count from public.posts where id = $1', [postId]);
    expect(post!.comment_count).toBe(0);

    // Hidden from everyone else...
    const toOthers = await db.asUser(ada, 'select id from public.comments where post_id = $1', [postId]);
    expect(toOthers).toHaveLength(0);

    // ...but still reachable by its author, which is what makes the soft delete
    // possible at all: PostgreSQL checks SELECT policies against the updated
    // row, so a policy that hid it from its own author would reject the update.
    const toAuthor = await db.asUser(bob, 'select id from public.comments where post_id = $1', [postId]);
    expect(toAuthor).toHaveLength(1);
  });

  it('lets only the author edit a post', async () => {
    const theirs = await db.asUser(eve, `update public.posts set body = 'defaced' where id = $1 returning id`, [postId]);
    expect(theirs).toHaveLength(0);

    const mine = await db.asUser(ada, `update public.posts set body = 'Try Viete carefully.' where id = $1 returning id`, [postId]);
    expect(mine).toHaveLength(1);
  });

  it('keeps saved posts private to the person who saved them', async () => {
    await db.asUser(bob, 'insert into public.saved_posts (user_id, post_id) values ($1, $2)', [bob, postId]);

    expect(await db.asUser(bob, 'select post_id from public.saved_posts')).toHaveLength(1);
    expect(await db.asUser(eve, 'select post_id from public.saved_posts')).toHaveLength(0);
  });
});

describe('private communities', () => {
  let communityId: string;

  beforeAll(async () => {
    const [row] = await db.asUser<{ id: string }>(
      ada,
      `insert into public.communities (slug, name, is_private, created_by)
       values ('olympiad-prep', 'Olympiad Prep', true, $1) returning id`,
      [ada],
    );
    communityId = row!.id;
    await db.asUser(ada, `insert into public.community_members (community_id, user_id, role) values ($1, $2, 'owner')`, [
      communityId,
      ada,
    ]);
  });

  it('hides a private community and its posts from non-members', async () => {
    await db.asUser(ada, `insert into public.posts (author_id, community_id, body) values ($1, $2, 'members only')`, [
      ada,
      communityId,
    ]);

    expect(await db.asUser(ada, 'select id from public.communities where id = $1', [communityId])).toHaveLength(1);
    expect(await db.asUser(eve, 'select id from public.communities where id = $1', [communityId])).toHaveLength(0);

    const evePosts = await db.asUser(eve, 'select id from public.posts where community_id = $1', [communityId]);
    expect(evePosts).toHaveLength(0);
  });

  it('refuses a post to a community the author has not joined', async () => {
    await expect(
      db.asUser(eve, `insert into public.posts (author_id, community_id, body) values ($1, $2, 'sneaking in')`, [
        eve,
        communityId,
      ]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('reveals the community once the learner joins', async () => {
    await db.asUser(eve, 'insert into public.community_members (community_id, user_id) values ($1, $2)', [
      communityId,
      eve,
    ]);

    expect(await db.asUser(eve, 'select id from public.communities where id = $1', [communityId])).toHaveLength(1);
    expect(await db.asUser(eve, 'select id from public.posts where community_id = $1', [communityId])).toHaveLength(1);
  });
});

describe('direct messages', () => {
  let conversationId: string;

  beforeAll(async () => {
    const [row] = await db.asUser<{ id: string }>(
      ada,
      'insert into public.conversations (created_by) values ($1) returning id',
      [ada],
    );
    conversationId = row!.id;

    await db.asUser(ada, 'insert into public.conversation_participants (conversation_id, user_id) values ($1, $2)', [
      conversationId,
      ada,
    ]);
    await db.asUser(ada, 'insert into public.conversation_participants (conversation_id, user_id) values ($1, $2)', [
      conversationId,
      bob,
    ]);
  });

  it('delivers a message to both participants and nobody else', async () => {
    await db.asUser(ada, 'insert into public.messages (conversation_id, sender_id, body) values ($1, $2, $3)', [
      conversationId,
      ada,
      'Did you finish the Ptolemy proof?',
    ]);

    expect(await db.asUser(ada, 'select id from public.messages')).toHaveLength(1);
    expect(await db.asUser(bob, 'select id from public.messages')).toHaveLength(1);
    // The strictest boundary in the schema.
    expect(await db.asUser(eve, 'select id from public.messages')).toHaveLength(0);
    expect(await db.asUser(null, 'select id from public.messages')).toHaveLength(0);
  });

  it('refuses a message sent into a conversation the sender is not part of', async () => {
    await expect(
      db.asUser(eve, 'insert into public.messages (conversation_id, sender_id, body) values ($1, $2, $3)', [
        conversationId,
        eve,
        'let me in',
      ]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('refuses a stranger adding themselves to a private thread', async () => {
    await expect(
      db.asUser(eve, 'insert into public.conversation_participants (conversation_id, user_id) values ($1, $2)', [
        conversationId,
        eve,
      ]),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('notifications', () => {
  it('are generated by trigger from the action that caused them', async () => {
    // Self-contained: performs the actions, then asserts the notifications.
    const carol = await db.createUser({ email: 'carol@example.com', username: 'carol' });
    await db.asUser(carol, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [carol, bob]);

    const [post] = await db.asUser<{ id: string }>(
      bob,
      `insert into public.posts (author_id, body) values ($1, 'A lemma worth knowing') returning id`,
      [bob],
    );
    await db.asUser(carol, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [post!.id, carol]);
    await db.asUser(carol, `insert into public.comments (post_id, author_id, body) values ($1, $2, 'Neat.')`, [
      post!.id,
      carol,
    ]);

    const rows = await db.asUser<{ type: string }>(
      bob,
      'select type from public.notifications where user_id = $1 and actor_id = $2',
      [bob, carol],
    );

    expect(rows.map((r) => r.type).sort()).toEqual(['follow', 'post_comment', 'post_like']);
  });

  it('never notifies someone about their own action', async () => {
    const selfNotifications = await db.query<{ n: number }>(
      'select count(*)::int as n from public.notifications where user_id = actor_id',
    );
    expect(selfNotifications[0]!.n).toBe(0);
  });

  it('cannot be forged by a client', async () => {
    await expect(
      db.asUser(
        eve,
        `insert into public.notifications (user_id, actor_id, type, body)
         values ($1, $2, 'system', 'You have won a prize, click here')`,
        [bob, eve],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('are visible only to their recipient', async () => {
    const mine = await db.asUser(bob, 'select id from public.notifications');
    const others = await db.asUser(eve, 'select id from public.notifications where user_id = $1', [bob]);

    expect(mine.length).toBeGreaterThan(0);
    expect(others).toHaveLength(0);
  });

  it('lets the recipient mark them read', async () => {
    const updated = await db.asUser(
      bob,
      'update public.notifications set read_at = now() where user_id = $1 and read_at is null returning id',
      [bob],
    );
    expect(updated.length).toBeGreaterThan(0);
  });
});

describe('the anonymous visitor', () => {
  it('can read the public directory and leaderboard, and nothing private', async () => {
    expect((await db.asUser(null, 'select id from public.profiles')).length).toBeGreaterThan(0);

    expect(await db.asUser(null, 'select user_id from public.problem_attempts')).toHaveLength(0);
    expect(await db.asUser(null, 'select id from public.notifications')).toHaveLength(0);
    expect(await db.asUser(null, 'select post_id from public.saved_posts')).toHaveLength(0);
    expect(await db.asUser(null, 'select topic from public.skill_mastery')).toHaveLength(0);
  });

  it('cannot write anything', async () => {
    await expect(
      db.asUser(null, `insert into public.posts (author_id, body) values ($1, 'spam')`, [ada]),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });
});
