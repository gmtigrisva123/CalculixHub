/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers behind the Community feed: time labels, reaction arithmetic,
 * comment threading and share links. Kept free of React and of the network so
 * every rule here is unit-tested directly.
 */

import type { AuthorSummary, CommentWithAuthor, Reaction, ReactionCounts } from '../../services/database.types';
import { apiUrl, isNativePlatform } from '../../services/apiBase';

export interface ReactionMeta {
  label: string;
  emoji: string;
}

export const REACTION_META: Record<Reaction, ReactionMeta> = {
  like: { label: 'Like', emoji: '👍' },
  love: { label: 'Love', emoji: '❤️' },
  care: { label: 'Care', emoji: '🥰' },
  haha: { label: 'Haha', emoji: '😆' },
  wow: { label: 'Wow', emoji: '😮' },
  sad: { label: 'Sad', emoji: '😢' },
  angry: { label: 'Angry', emoji: '😡' },
};

export function authorName(author: Pick<AuthorSummary, 'display_name' | 'username'> | null | undefined): string {
  return author?.display_name?.trim() || author?.username || 'Learner';
}

export function firstName(author: Pick<AuthorSummary, 'display_name' | 'username'> | null | undefined): string {
  return authorName(author).split(/\s+/)[0] ?? 'there';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2);
  return letters.toLocaleUpperCase();
}

/** A stable hue per person, so an avatar keeps its colour across sessions. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  return Math.abs(hash) % 360;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Compact age, as comments show it: "Just now", "5m", "3h", "2d", "4w", "1y".
 * A timestamp slightly in the future (clock skew) reads as "Just now".
 */
export function compactAge(iso: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 365 * DAY) return `${Math.floor(elapsed / WEEK)}w`;
  return `${Math.floor(elapsed / (365 * DAY))}y`;
}

/**
 * Post age, as a feed header shows it: compact for the first week, then the
 * date -- with the year only when it is not this year.
 */
export function postAge(iso: string, now: number, locale?: string): string {
  const then = new Date(iso);
  const elapsed = Math.max(0, now - then.getTime());
  if (elapsed < WEEK) return compactAge(iso, now);

  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  const date = then.toLocaleDateString(locale, { month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  if (!sameYear) return date;
  return `${date} at ${then.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`;
}

/** The full timestamp, for a tooltip and for assistive technology. */
export function fullTimestamp(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' });
}

/** "1.2K" style counts above a thousand. */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value < 1_000_000 ? value / 1000 : value / 1_000_000;
  const suffix = value < 1_000_000 ? 'K' : 'M';
  return `${scaled >= 10 ? Math.floor(scaled) : Math.floor(scaled * 10) / 10}${suffix}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${compactCount(count)} ${count === 1 ? one : many}`;
}

export function totalReactions(counts: ReactionCounts | undefined): number {
  return Object.values(counts ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
}

/** The most-used reactions first, ties broken by picker order. */
export function topReactions(counts: ReactionCounts | undefined, limit = 3): Reaction[] {
  const order = Object.keys(REACTION_META) as Reaction[];
  return order
    .filter((reaction) => (counts?.[reaction] ?? 0) > 0)
    .sort((a, b) => (counts![b] ?? 0) - (counts![a] ?? 0) || order.indexOf(a) - order.indexOf(b))
    .slice(0, limit);
}

/**
 * The counts as they will be once the viewer's pending reaction lands.
 *
 * Used for optimistic rendering: the server's counts already include the
 * viewer's stored reaction, so moving from `from` to `to` takes one away from
 * the first and adds one to the second.
 */
export function shiftReaction(counts: ReactionCounts | undefined, from: Reaction | null, to: Reaction | null): ReactionCounts {
  const next: ReactionCounts = { ...(counts ?? {}) };
  if (from === to) return next;
  if (from) {
    const remaining = (next[from] ?? 0) - 1;
    if (remaining > 0) next[from] = remaining;
    else delete next[from];
  }
  if (to) next[to] = (next[to] ?? 0) + 1;
  return next;
}

/** "You and 3 others", "You", or the bare total. */
export function reactionSentence(total: number, viewerReacted: boolean): string {
  if (!viewerReacted) return compactCount(total);
  if (total <= 1) return 'You';
  return `You and ${plural(total - 1, 'other')}`;
}

export type CommentSort = 'relevant' | 'newest' | 'oldest';

export const COMMENT_SORTS: Record<CommentSort, { label: string; hint: string }> = {
  relevant: { label: 'Most relevant', hint: 'Most reacted and discussed first.' },
  newest: { label: 'Newest', hint: 'The latest comments first.' },
  oldest: { label: 'All comments', hint: 'Every comment, oldest first.' },
};

export interface CommentThread {
  comment: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

/**
 * Group a flat, oldest-first list into top-level threads.
 *
 * Replies always read oldest first under their comment, as a conversation does;
 * only the top-level order follows the chosen sort. A reply whose parent is
 * missing (removed, or a legacy row) is shown as a top-level comment rather
 * than dropped.
 */
export function threadComments(comments: CommentWithAuthor[], sort: CommentSort): CommentThread[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const replies = new Map<string, CommentWithAuthor[]>();
  const roots: CommentWithAuthor[] = [];

  for (const comment of comments) {
    if (comment.parent_id && ids.has(comment.parent_id)) {
      const list = replies.get(comment.parent_id) ?? [];
      list.push(comment);
      replies.set(comment.parent_id, list);
    } else {
      roots.push(comment);
    }
  }

  const byTime = (a: CommentWithAuthor, b: CommentWithAuthor) => a.created_at.localeCompare(b.created_at);
  const threads = roots.map((comment) => ({ comment, replies: (replies.get(comment.id) ?? []).sort(byTime) }));

  if (sort === 'oldest') return threads.sort((a, b) => byTime(a.comment, b.comment));
  if (sort === 'newest') return threads.sort((a, b) => byTime(b.comment, a.comment));

  const score = (thread: CommentThread) => totalReactions(thread.comment.reactions) * 2 + thread.replies.length;
  return threads.sort((a, b) => score(b) - score(a) || byTime(a.comment, b.comment));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

/**
 * The public address of the app, for links that leave it.
 *
 * Inside the native shell `location.origin` is the app container, which means
 * nothing to the person a link is sent to; the web deployment's address is
 * the API base the native build is configured with.
 */
function publicBase(): string {
  if (isNativePlatform()) {
    const configured = apiUrl('/');
    if (/^https?:\/\//.test(configured)) return configured;
  }
  return `${window.location.origin}${window.location.pathname}`;
}

export function shareLink(postId: string, commentId?: string | null, base: string = publicBase()): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('tab', 'community');
  url.searchParams.set('post', postId);
  if (commentId) url.searchParams.set('comment', commentId);
  return url.toString();
}

// Math is matched first, so an `@` inside a formula is never read as a mention.
const MATH = String.raw`\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\\begin\{(?<env>[a-z*]+)\}[\s\S]+?\\end\{\k<env>\}`;
const MENTION = String.raw`(?<![A-Za-z0-9_@.])@([A-Za-z0-9](?:[A-Za-z0-9_]{0,22}[A-Za-z0-9])?)(?![A-Za-z0-9_])`;

export type RichSegment = { type: 'text'; value: string } | { type: 'mention'; value: string };

/**
 * Split text into plain runs and `@username` mentions. Formulas stay inside
 * the plain runs whole, for MathText to render; an email address is not a
 * mention.
 */
export function segmentMentions(text: string): RichSegment[] {
  const pattern = new RegExp(`(${MATH})|${MENTION}`, 'g');
  const segments: RichSegment[] = [];
  let plain = '';
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const handle = match[3];
    if (handle === undefined) continue; // a formula: leave it in the plain run
    plain += text.slice(last, match.index);
    if (plain) segments.push({ type: 'text', value: plain });
    plain = '';
    segments.push({ type: 'mention', value: handle });
    last = match.index + match[0].length;
  }
  plain += text.slice(last);
  if (plain) segments.push({ type: 'text', value: plain });
  return segments;
}

/**
 * The `@query` being typed at the caret, if any: where it starts and what has
 * been typed after the `@` so far.
 */
export function activeMention(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{0,24})$/.exec(before);
  if (!match) return null;
  return { start: caret - match[2]!.length - 1, query: match[2]! };
}

/** Replace the `@query` at the caret with a finished mention and a space. */
export function completeMention(value: string, caret: number, username: string): { next: string; caret: number } {
  const active = activeMention(value, caret);
  if (!active) return { next: value, caret };
  const insert = `@${username} `;
  const after = value.slice(caret).replace(/^[A-Za-z0-9_]+/, '');
  const next = value.slice(0, active.start) + insert + after.replace(/^ /, '');
  return { next, caret: active.start + insert.length };
}

/** "Ada is writing a comment…", "Ada and Bob are…", "Ada and 2 others are…". */
export function typingSentence(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is writing a comment…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are writing comments…`;
  return `${names[0]} and ${names.length - 1} others are writing comments…`;
}

/**
 * Hold back posts that arrived since the viewer last looked, so a busy feed
 * does not shuffle under their thumb. The viewer's own posts always show.
 * `cutoff` is the newest `created_at` the viewer has acknowledged.
 */
export function holdBackFresh<T extends { created_at: string; author_id: string }>(
  posts: T[],
  cutoff: string | null,
  viewerId: string | null,
): { visible: T[]; fresh: T[] } {
  if (!cutoff) return { visible: posts, fresh: [] };
  const visible: T[] = [];
  const fresh: T[] = [];
  for (const post of posts) {
    if (post.created_at > cutoff && post.author_id !== viewerId) fresh.push(post);
    else visible.push(post);
  }
  return { visible, fresh };
}

/** The newest `created_at` in a page, or null for an empty one. */
export function newestCreatedAt(posts: Array<{ created_at: string }>): string | null {
  return posts.reduce<string | null>((newest, post) => (!newest || post.created_at > newest ? post.created_at : newest), null);
}
