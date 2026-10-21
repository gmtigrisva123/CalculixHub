/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The QA cohort, run against real PostgreSQL via PGlite.
 *
 * Accounts signed up with a `+cxqa-` address must never meet learners: not in
 * the feed, a ranking, an arena, a notification, a conversation or a platform
 * total. Each test checks both directions, and that a cohort still works
 * normally among itself.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDatabase, type TestDatabase } from './db.harness';

let db: TestDatabase;
let lan: string;
let minh: string;
let qaAnna: string;
let qaRavi: string;

const post = async (author: string, body: string, shared: string | null = null) => {
  const [row] = await db.asUser<{ id: string }>(
    author,
    'insert into public.posts (author_id, body, shared_post_id) values ($1, $2, $3) returning id',
    [author, body, shared],
  );
  return row!.id;
};

const comment = async (author: string, postId: string, body: string) => {
  const [row] = await db.asUser<{ id: string }>(
    author,
    'insert into public.comments (post_id, author_id, body) values ($1, $2, $3) returning id',
    [postId, author, body],
  );
  return row!.id;
};

const visiblePosts = async (viewer: string | null) =>
  (await db.asUser<{ body: string }>(viewer, 'select body from public.posts order by created_at')).map((row) => row.body);

const counters = async (id: string) =>
  (await db.query<{ like_count: number; comment_count: number; share_count: number }>(
    'select like_count, comment_count, share_count from public.posts where id = $1',
    [id],
  ))[0]!;

const solve = async (user: string, points: number) => {
  await db.query(
    `insert into public.problem_attempts (user_id, problem_id, topic, level, submitted_answer, is_correct, points_awarded)
     values ($1, $2, 'Algebra', 'Foundation', '1', true, $3)`,
    [user, `qa-cohort-${user.slice(0, 8)}-${points}`, points],
  );
};

beforeAll(async () => {
  db = await createTestDatabase();
  lan = await db.createUser({ email: 'lan@example.com', username: 'lan_tran', displayName: 'Lan' });
  minh = await db.createUser({ email: 'minh@example.com', username: 'minh_vo', displayName: 'Minh' });
  qaAnna = await db.createUser({ email: 'team+cxqa-anna.berg@gmail.com', username: 'anna_berg', displayName: 'Anna' });
  qaRavi = await db.createUser({ email: 'Team+CXQA-ravi.nair@gmail.com', username: 'ravi_nair', displayName: 'Ravi' });
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe('membership', () => {
  it('flags tagged sign-ups, in any case, and nobody else', async () => {
    const rows = await db.query<{ user_id: string }>('select user_id from cohort.qa_accounts order by user_id');
    expect(rows.map((row) => row.user_id).sort()).toEqual([qaAnna, qaRavi].sort());
    const plusOnly = await db.createUser({ email: 'lan+maths@example.com', displayName: 'Lan again' });
    expect(await db.query('select 1 from cohort.qa_accounts where user_id = $1', [plusOnly])).toHaveLength(0);
  });

  it('tells each caller only its own cohort, and keeps the list from clients', async () => {
    expect(await db.asUser(qaAnna, 'select public.viewer_cohort() as cohort')).toEqual([{ cohort: 'qa' }]);
    expect(await db.asUser(lan, 'select public.viewer_cohort() as cohort')).toEqual([{ cohort: 'live' }]);
    expect(await db.asUser(null, 'select public.viewer_cohort() as cohort')).toEqual([{ cohort: 'live' }]);
    await expect(db.asUser(lan, 'select public.qa_account_ids()')).rejects.toThrow(/permission denied/);
    expect((await db.query<{ ids: string[] }>('select public.qa_account_ids() as ids'))[0]!.ids.sort()).toEqual([qaAnna, qaRavi].sort());
    await expect(db.asUser(qaAnna, 'select * from cohort.qa_accounts')).rejects.toThrow(/permission denied/);
  });
});

describe('profiles and rankings', () => {
  it('lists each cohort only to itself', async () => {
    const names = async (viewer: string | null) =>
      (await db.asUser<{ username: string }>(viewer, 'select username from public.profiles order by username')).map((row) => row.username);
    expect(await names(null)).not.toContain('anna_berg');
    expect(await names(lan)).toEqual(expect.arrayContaining(['lan_tran', 'minh_vo']));
    expect(await names(lan)).not.toEqual(expect.arrayContaining(['anna_berg']));
    expect(await names(qaAnna)).toEqual(['anna_berg', 'ravi_nair']);
  });

  it('ranks learners among learners, in the view and in the snapshot', async () => {
    await solve(qaAnna, 90);
    await solve(lan, 40);
    await solve(minh, 20);

    const board = await db.asUser<{ username: string; rank: string }>(null, 'select username, rank from public.leaderboard_view order by rank');
    expect(board.map((row) => [row.username, Number(row.rank)])).toEqual([['lan_tran', 1], ['minh_vo', 2]]);

    const [snapshot] = await db.asUser<{ snapshot: { rank: number } }>(lan, 'select public.learning_snapshot() as snapshot');
    expect(snapshot!.snapshot.rank).toBe(1);

    const qaBoard = await db.asUser<{ username: string }>(qaRavi, 'select username from public.leaderboard_view');
    expect(qaBoard.map((row) => row.username)).toEqual(['anna_berg']);
  });

  it('counts only learners in the public platform totals', async () => {
    const [{ stats }] = (await db.asUser<{ stats: { registeredUsers: number; problemsSolved: number } }>(null, 'select public.platform_stats() as stats')) as [{ stats: { registeredUsers: number; problemsSolved: number } }];
    const learners = await db.query<{ n: number }>('select count(*)::int as n from public.profiles where id not in (select user_id from cohort.qa_accounts)');
    expect(stats.registeredUsers).toBe(learners[0]!.n);
    expect(stats.problemsSolved).toBe(2);
  });

  it('refuses a follow across cohorts and keeps counters clean', async () => {
    await expect(
      db.asUser(qaAnna, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [qaAnna, lan]),
    ).rejects.toThrow(/row-level security/);
    await db.asUser(qaAnna, 'insert into public.follows (follower_id, following_id) values ($1, $2)', [qaAnna, qaRavi]);
    const rows = await db.query<{ follower_count: number }>('select follower_count from public.profiles where id = $1', [lan]);
    expect(rows[0]!.follower_count).toBe(0);
  });
});

describe('community feed', () => {
  it('shows each cohort only its own posts', async () => {
    await post(lan, 'Learner question about Vieta');
    await post(qaAnna, 'QA post about AM-GM');
    expect(await visiblePosts(null)).not.toContain('QA post about AM-GM');
    expect(await visiblePosts(minh)).toContain('Learner question about Vieta');
    expect(await visiblePosts(minh)).not.toContain('QA post about AM-GM');
    expect(await visiblePosts(qaRavi)).toEqual(['QA post about AM-GM']);
  });

  it('keeps QA accounts off a learner post: no comment, reaction, share or save', async () => {
    const learnerPost = await post(lan, 'Hands off this one');

    await expect(comment(qaAnna, learnerPost, 'reply')).rejects.toThrow(/row-level security/);
    await expect(
      db.asUser(qaAnna, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [learnerPost, qaAnna]),
    ).rejects.toThrow(/row-level security/);
    await expect(post(qaAnna, '', learnerPost)).rejects.toThrow();
    await expect(
      db.asUser(qaAnna, 'insert into public.saved_posts (user_id, post_id) values ($1, $2)', [qaAnna, learnerPost]),
    ).rejects.toThrow(/row-level security/);

    expect(await counters(learnerPost)).toEqual({ like_count: 0, comment_count: 0, share_count: 0 });
  });

  it('keeps learners off a QA post as well', async () => {
    const qaPost = await post(qaRavi, 'QA only');
    await expect(comment(lan, qaPost, 'reply')).rejects.toThrow(/row-level security/);
    await expect(
      db.asUser(lan, 'insert into public.post_likes (post_id, user_id) values ($1, $2)', [qaPost, lan]),
    ).rejects.toThrow(/row-level security/);
  });

  it('works normally inside the QA cohort', async () => {
    const qaPost = await post(qaAnna, 'Who solved problem 7?');
    const reply = await comment(qaRavi, qaPost, 'Me, by Cauchy-Schwarz');
    await db.asUser(qaRavi, `insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'love')`, [qaPost, qaRavi]);
    await db.asUser(qaAnna, 'insert into public.comment_likes (comment_id, user_id) values ($1, $2)', [reply, qaAnna]);
    await post(qaRavi, 'Sharing this', qaPost);

    expect(await counters(qaPost)).toEqual({ like_count: 1, comment_count: 1, share_count: 1 });
    const kinds = await db.asUser<{ type: string }>(qaAnna, 'select type from public.notifications order by type');
    expect(kinds.map((row) => row.type)).toEqual(expect.arrayContaining(['post_comment', 'post_like', 'post_share']));

    const reactions = await db.asUser(lan, 'select * from public.post_reaction_counts where post_id = $1', [qaPost]);
    expect(reactions).toHaveLength(0);
  });

  it('delivers no notification across cohorts, even for an @mention', async () => {
    await post(qaAnna, 'Hey @lan_tran and @ravi_nair, look at this');
    const learner = await db.query('select 1 from public.notifications where user_id = $1 and actor_id = $2', [lan, qaAnna]);
    expect(learner).toHaveLength(0);
    const peer = await db.query(`select 1 from public.notifications where user_id = $1 and actor_id = $2 and type = 'mention'`, [qaRavi, qaAnna]);
    expect(peer).toHaveLength(1);
  });
});

describe('messages', () => {
  it('refuses a conversation across cohorts in either direction', async () => {
    await expect(db.asUser(qaAnna, 'select public.start_conversation($1)', [lan])).rejects.toThrow(/Select another learner/);
    await expect(db.asUser(minh, 'select public.start_conversation($1)', [qaRavi])).rejects.toThrow(/Select another learner/);
    const [row] = await db.asUser<{ id: string }>(qaAnna, 'select public.start_conversation($1) as id', [qaRavi]);
    expect(row!.id).toBeTruthy();
  });
});

describe('arenas', () => {
  const arena = async (createdBy: string, title: string) => {
    const [row] = await db.query<{ id: string }>(
      `insert into public.arenas (title, starts_at, ends_at, duration_minutes, status, questions, created_by)
       values ($1, now() - interval '1 hour', now() + interval '1 day', 30, 'published', $2, $3) returning id`,
      [title, JSON.stringify([{ id: 'q1', question: 'Find n.', correctAnswer: '7', solution: 'Seven.', points: 50, difficulty: 0 }]), createdBy],
    );
    return row!.id;
  };

  it('lists and admits each cohort only to its own arenas', async () => {
    const live = await arena(minh, 'Saturday Arena');
    const qa = await arena(qaRavi, 'QA Arena');

    const titles = async (viewer: string | null) =>
      ((await db.asUser<{ list: Array<{ title: string }> }>(viewer, 'select public.arena_catalog() as list'))[0]!.list).map((a) => a.title);
    expect(await titles(null)).toEqual(['Saturday Arena']);
    expect(await titles(lan)).toEqual(['Saturday Arena']);
    expect(await titles(qaAnna)).toEqual(['QA Arena']);

    await expect(db.asUser(qaAnna, `select public.arena_action($1, 'register')`, [live])).rejects.toThrow(/Arena unavailable/);
    await expect(db.asUser(lan, `select public.arena_action($1, 'register')`, [qa])).rejects.toThrow(/Arena unavailable/);
    await db.asUser(qaAnna, `select public.arena_action($1, 'register')`, [qa]);
    expect(await db.query('select 1 from public.arena_entries where arena_id = $1', [live])).toHaveLength(0);

    const [{ stats }] = (await db.asUser<{ stats: { activeContestsCount: number } }>(null, 'select public.platform_stats() as stats')) as [{ stats: { activeContestsCount: number } }];
    expect(stats.activeContestsCount).toBe(1);
  });
});

it('reapplies the setup file without losing the cohort or any row', async () => {
  const before = await db.query<{ n: number }>('select (select count(*) from cohort.qa_accounts) + (select count(*) from public.posts) as n');
  await db.exec(readFileSync(new URL('../../supabase/qa-cohort-setup.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../../supabase/qa-cohort-setup.sql', import.meta.url), 'utf8'));
  expect(await db.query('select (select count(*) from cohort.qa_accounts) + (select count(*) from public.posts) as n')).toEqual(before);
  expect(await visiblePosts(lan)).not.toContain('QA only');
});

it('cleans up every QA account and its content, and nothing of the learners', async () => {
  const learnerPosts = await db.query<{ n: number }>('select count(*)::int as n from public.posts where author_id not in (select user_id from cohort.qa_accounts)');
  const learnerProfiles = await db.query<{ n: number }>('select count(*)::int as n from public.profiles where id not in (select user_id from cohort.qa_accounts)');

  await db.exec(readFileSync(new URL('../../qa/cleanup.sql', import.meta.url), 'utf8'));

  expect(await db.query('select 1 from cohort.qa_accounts')).toHaveLength(0);
  expect(await db.query('select 1 from auth.users where id = any($1::uuid[])', [[qaAnna, qaRavi]])).toHaveLength(0);
  expect(await db.query('select 1 from public.arenas where created_by = any($1::uuid[])', [[qaAnna, qaRavi]])).toHaveLength(0);
  expect(await db.query('select 1 from public.conversations where created_by = any($1::uuid[])', [[qaAnna, qaRavi]])).toHaveLength(0);
  expect(await db.query<{ n: number }>('select count(*)::int as n from public.posts')).toEqual(learnerPosts);
  expect(await db.query<{ n: number }>('select count(*)::int as n from public.profiles')).toEqual(learnerProfiles);
  expect(await db.query('select 1 from public.arenas where created_by = $1', [minh])).toHaveLength(1);
});
