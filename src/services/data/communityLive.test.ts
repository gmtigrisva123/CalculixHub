import { describe, expect, it } from 'vitest';
import { linkSegments } from '../../lib/linkify';
import { flattenPresence } from './live';
import { fitWithin, rejectReason } from './media';
import { describeNotification, notificationLink } from './notifications';
import type { NotificationWithActor } from '../database.types';

const note = (extra: Partial<NotificationWithActor>): NotificationWithActor => ({
  id: 'n',
  user_id: 'me',
  actor_id: 'ada',
  type: 'post_like',
  entity_type: 'post',
  entity_id: 'p1',
  body: null,
  read_at: null,
  created_at: '2026-10-04T10:00:00Z',
  actor: { id: 'ada', username: 'ada_l', display_name: 'Ada', avatar_url: null },
  ...extra,
});

describe('notifications', () => {
  it('describes the community notification types', () => {
    expect(describeNotification(note({ type: 'comment_reply' }))).toBe('Ada replied to your comment');
    expect(describeNotification(note({ type: 'mention', entity_type: 'comment' }))).toBe('Ada mentioned you in a comment');
    expect(describeNotification(note({ type: 'mention', entity_type: 'post' }))).toBe('Ada mentioned you in a post');
    expect(describeNotification(note({ type: 'post_share' }))).toBe('Ada shared your post');
    expect(describeNotification(note({ type: 'comment_like' }))).toBe('Ada reacted to your comment');
  });

  it('links to the post, and to the comment inside it when there is one', () => {
    expect(notificationLink(note({ type: 'post_like' }))).toBe('?tab=community&post=p1');
    expect(notificationLink(note({ type: 'comment_reply', entity_type: 'comment', entity_id: 'c9', post_id: 'p2', comment_id: 'c9' }))).toBe(
      '?tab=community&post=p2&comment=c9',
    );
    expect(notificationLink(note({ type: 'message', entity_type: 'conversation', entity_id: 'x' }))).toBe('?tab=inbox');
    expect(notificationLink(note({ type: 'follow', entity_type: 'profile', entity_id: 'ada' }))).toBeNull();
  });
});

describe('message links', () => {
  it('finds web addresses and leaves trailing punctuation outside them', () => {
    expect(linkSegments('Look: https://calculixhub.com/?tab=community&post=1. Nice!')).toEqual([
      { type: 'text', value: 'Look: ' },
      { type: 'link', value: 'https://calculixhub.com/?tab=community&post=1' },
      { type: 'text', value: '.' },
      { type: 'text', value: ' Nice!' },
    ]);
    expect(linkSegments('no links here')).toEqual([{ type: 'text', value: 'no links here' }]);
    expect(linkSegments('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
  });
});

describe('presence', () => {
  it('lists each other person once, with their latest state', () => {
    const people = flattenPresence(
      {
        a: [{ id: 'ada', name: 'Ada', username: 'ada_l', post: null, at: 1 }],
        a2: [{ id: 'ada', name: 'Ada', username: 'ada_l', post: 'p1', at: 5 }],
        me: [{ id: 'me', name: 'Me', at: 9 }],
        b: [{ id: 'bob', name: 'Bob', username: 'bob_m', at: 3 }],
        guest: [{}],
      },
      'me',
    );
    expect(people.map((person) => [person.id, person.post])).toEqual([
      ['ada', 'p1'],
      ['bob', null],
    ]);
  });
});

describe('image uploads', () => {
  it('scales the longest edge down to 2048px and never up', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 1024, height: 2048 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('accepts common image types and refuses the rest', () => {
    expect(rejectReason({ type: 'image/jpeg', size: 9_000_000 })).toBeNull();
    expect(rejectReason({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPEG, WebP and GIF/);
    expect(rejectReason({ type: 'image/gif', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(rejectReason({ type: 'image/png', size: 30 * 1024 * 1024 })).toMatch(/25 MB/);
  });
});
