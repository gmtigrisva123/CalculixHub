import { describe, expect, it } from 'vitest';
import type { CommentWithAuthor } from '../../services/database.types';
import {
  compactAge,
  compactCount,
  initials,
  isUuid,
  postAge,
  reactionSentence,
  shareLink,
  activeMention,
  completeMention,
  holdBackFresh,
  newestCreatedAt,
  segmentMentions,
  shiftReaction,
  threadComments,
  typingSentence,
  topReactions,
  totalReactions,
} from './model';

const NOW = new Date('2026-10-04T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const comment = (id: string, created: string, extra: Partial<CommentWithAuthor> = {}): CommentWithAuthor => ({
  id,
  post_id: 'p',
  author_id: 'a',
  body: id,
  like_count: 0,
  deleted_at: null,
  created_at: created,
  author: null,
  ...extra,
});

describe('time labels', () => {
  it('reads like a feed: just now, minutes, hours, days, weeks, years', () => {
    expect(compactAge(ago(10_000), NOW)).toBe('Just now');
    expect(compactAge(ago(5 * 60_000), NOW)).toBe('5m');
    expect(compactAge(ago(3 * 3_600_000), NOW)).toBe('3h');
    expect(compactAge(ago(2 * 86_400_000), NOW)).toBe('2d');
    expect(compactAge(ago(15 * 86_400_000), NOW)).toBe('2w');
    expect(compactAge(ago(400 * 86_400_000), NOW)).toBe('1y');
  });

  it('treats a timestamp from a fast clock as just now', () => {
    expect(compactAge(new Date(NOW + 30_000).toISOString(), NOW)).toBe('Just now');
  });

  it('switches posts to a date after a week, adding the year only when it differs', () => {
    expect(postAge(ago(2 * 86_400_000), NOW)).toBe('2d');
    expect(postAge('2026-09-01T09:30:00Z', NOW, 'en-US')).toMatch(/^September 1 at /);
    expect(postAge('2025-03-02T09:30:00Z', NOW, 'en-US')).toBe('March 2, 2025');
  });
});

describe('counts', () => {
  it('abbreviates large numbers the way a feed does', () => {
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1234)).toBe('1.2K');
    expect(compactCount(15_900)).toBe('15K');
    expect(compactCount(2_500_000)).toBe('2.5M');
  });

  it('builds initials from one or more names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('gmtigrisva123')).toBe('GM');
    expect(initials('  ')).toBe('?');
  });
});

describe('reactions', () => {
  it('totals and ranks reactions, breaking ties by picker order', () => {
    const counts = { love: 2, like: 2, wow: 5, sad: 1 };
    expect(totalReactions(counts)).toBe(10);
    expect(topReactions(counts)).toEqual(['wow', 'like', 'love']);
    expect(topReactions({})).toEqual([]);
  });

  it('moves the viewer from one reaction to another without touching anyone else’s', () => {
    expect(shiftReaction({ like: 3 }, null, 'love')).toEqual({ like: 3, love: 1 });
    expect(shiftReaction({ like: 3, love: 1 }, 'love', 'haha')).toEqual({ like: 3, haha: 1 });
    expect(shiftReaction({ like: 1 }, 'like', null)).toEqual({});
    expect(shiftReaction(undefined, null, null)).toEqual({});
  });

  it('phrases the summary from the viewer’s point of view', () => {
    expect(reactionSentence(1, true)).toBe('You');
    expect(reactionSentence(2, true)).toBe('You and 1 other');
    expect(reactionSentence(4, true)).toBe('You and 3 others');
    expect(reactionSentence(4, false)).toBe('4');
  });
});

describe('comment threads', () => {
  const flat = [
    comment('a', '2026-10-04T10:00:00Z', { reactions: { like: 1 } }),
    comment('b', '2026-10-04T10:05:00Z'),
    comment('b1', '2026-10-04T10:06:00Z', { parent_id: 'b' }),
    comment('b2', '2026-10-04T10:07:00Z', { parent_id: 'b' }),
    comment('c', '2026-10-04T10:10:00Z'),
    comment('orphan', '2026-10-04T10:11:00Z', { parent_id: 'gone' }),
  ];

  it('nests replies under their comment, oldest first', () => {
    const threads = threadComments(flat, 'oldest');
    expect(threads.map((thread) => thread.comment.id)).toEqual(['a', 'b', 'c', 'orphan']);
    expect(threads[1]!.replies.map((reply) => reply.id)).toEqual(['b1', 'b2']);
  });

  it('orders top-level comments by the chosen sort', () => {
    expect(threadComments(flat, 'newest').map((thread) => thread.comment.id)).toEqual(['orphan', 'c', 'b', 'a']);
    // b has two replies (score 2), a has one reaction (score 2): the older wins the tie.
    expect(threadComments(flat, 'relevant').map((thread) => thread.comment.id)).toEqual(['a', 'b', 'c', 'orphan']);
  });
});

describe('share links and mentions', () => {
  it('links to the post, and to the comment when there is one', () => {
    const post = '0b8f6a52-3c2d-4e1f-9a7b-1234567890ab';
    const reply = '1c9f6a52-3c2d-4e1f-9a7b-1234567890ab';
    expect(shareLink(post, null, 'https://calculixhub.app/?tab=learn#top')).toBe(`https://calculixhub.app/?tab=community&post=${post}`);
    expect(shareLink(post, reply, 'https://calculixhub.app/')).toBe(`https://calculixhub.app/?tab=community&post=${post}&comment=${reply}`);
    expect(isUuid(post)).toBe(true);
    expect(isUuid('../etc')).toBe(false);
  });

  it('finds mentions anywhere, but not in formulas or email addresses', () => {
    expect(segmentMentions('@ada_l nice proof')).toEqual([{ type: 'mention', value: 'ada_l' }, { type: 'text', value: ' nice proof' }]);
    expect(segmentMentions('Thanks @bob and @Eve_N!')).toEqual([
      { type: 'text', value: 'Thanks ' },
      { type: 'mention', value: 'bob' },
      { type: 'text', value: ' and ' },
      { type: 'mention', value: 'Eve_N' },
      { type: 'text', value: '!' },
    ]);
    expect(segmentMentions('mail me@x.com, $a@b$ and $$x @y$$')).toEqual([{ type: 'text', value: 'mail me@x.com, $a@b$ and $$x @y$$' }]);
    expect(segmentMentions('\\begin{align}@z\\end{align} @ok')).toEqual([
      { type: 'text', value: '\\begin{align}@z\\end{align} ' },
      { type: 'mention', value: 'ok' },
    ]);
  });
});

describe('typing a mention', () => {
  it('knows when the caret is in an @query', () => {
    expect(activeMention('hi @ad', 6)).toEqual({ start: 3, query: 'ad' });
    expect(activeMention('@', 1)).toEqual({ start: 0, query: '' });
    expect(activeMention('me@ad', 5)).toBeNull();
    expect(activeMention('hi @ad done', 11)).toBeNull();
  });

  it('completes the mention and leaves the caret after it', () => {
    expect(completeMention('hi @ad', 6, 'ada_l')).toEqual({ next: 'hi @ada_l ', caret: 10 });
    expect(completeMention('hi @ad there', 6, 'ada_l')).toEqual({ next: 'hi @ada_l there', caret: 10 });
    expect(completeMention('no mention', 3, 'x')).toEqual({ next: 'no mention', caret: 3 });
  });
});

describe('live feed', () => {
  it('names who is typing', () => {
    expect(typingSentence([])).toBe('');
    expect(typingSentence(['Ada'])).toBe('Ada is writing a comment…');
    expect(typingSentence(['Ada', 'Bob'])).toBe('Ada and Bob are writing comments…');
    expect(typingSentence(['Ada', 'Bob', 'Eve'])).toBe('Ada and 2 others are writing comments…');
  });

  it('holds back other people’s new posts until the viewer asks for them', () => {
    const posts = [
      { id: 'mine', created_at: '2026-10-04T10:05:00Z', author_id: 'me' },
      { id: 'new', created_at: '2026-10-04T10:04:00Z', author_id: 'ada' },
      { id: 'old', created_at: '2026-10-04T10:00:00Z', author_id: 'bob' },
    ];
    const { visible, fresh } = holdBackFresh(posts, '2026-10-04T10:00:00Z', 'me');
    expect(visible.map((post) => post.id)).toEqual(['mine', 'old']);
    expect(fresh.map((post) => post.id)).toEqual(['new']);
    expect(holdBackFresh(posts, null, 'me').fresh).toEqual([]);
    expect(newestCreatedAt(posts)).toBe('2026-10-04T10:05:00Z');
    expect(newestCreatedAt([])).toBeNull();
  });
});
