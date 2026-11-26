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
import { HINT_SOURCE, KIND_TAGS, MATH_SOURCE, POST_KINDS, VERBATIM_SOURCE, hiddenRanges, parsePost, redactSealed, type PostKind } from '../../../shared/postMarkup';

export { POST_KINDS, composePost, parsePost, redactSealed, type ParsedPost, type PostKind } from '../../../shared/postMarkup';

export interface ReactionMeta {
  /** The mark's name, as the picker and the "who marked this" dialog show it. */
  label: string;
  /** What leaving this mark says, in the reader's own words. */
  hint: string;
}

/**
 * Margin marks.
 *
 * What a reader pencils beside a worked solution: a tick where they follow, a
 * tombstone where the argument is elegant, a question mark where it loses
 * them. The seven keys are the ones the database has always stored (its check
 * constraint names them), so every mark left before this wording still counts
 * and nothing has to migrate; what changed is what each one means here.
 */
export const REACTION_META: Record<Reaction, ReactionMeta> = {
  like: { label: 'With you', hint: 'I can follow every step' },
  love: { label: 'Elegant', hint: 'A beautiful argument' },
  care: { label: 'Helped', hint: 'This got me unstuck' },
  haha: { label: 'Sneaky', hint: 'I did not see that trick coming' },
  wow: { label: 'Aha', hint: 'This made it click' },
  sad: { label: 'Lost me', hint: 'I cannot follow a step' },
  angry: { label: 'Check this', hint: 'A step looks wrong to me' },
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

export type CommentSort = 'relevant' | 'newest' | 'oldest';

export const COMMENT_SORTS: Record<CommentSort, { label: string; hint: string }> = {
  relevant: { label: 'Most marked', hint: 'Most marks and replies first.' },
  newest: { label: 'Newest', hint: 'The latest comments first.' },
  oldest: { label: 'Oldest first', hint: 'Every comment, in the order written.' },
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
const MATH = MATH_SOURCE;
const MENTION = String.raw`(?<![A-Za-z0-9_@.])@([A-Za-z0-9](?:[A-Za-z0-9_]{0,22}[A-Za-z0-9])?)(?![A-Za-z0-9_])`;

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

/**
 * Problem titles are only unique within a level, not across the whole
 * catalog — e.g. "A circle in disguise" exists at both Foundation and
 * Advanced. Appends the level only to the titles that actually collide, so
 * the common case stays as plain as before.
 */
export function disambiguateTitles<T extends { id: string; title: string; level: string }>(problems: T[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const problem of problems) counts.set(problem.title, (counts.get(problem.title) ?? 0) + 1);
  return new Map(problems.map((problem) => [problem.id, (counts.get(problem.title) ?? 0) > 1 ? `${problem.title} (${problem.level})` : problem.title]));
}

/* --------------------------------------------------------------------------
 * Kinds, tags, sealed hints
 *
 * All three live in the text of a post rather than in columns of their own. A
 * kind is the tag a post opens with ("#stuck"), a technique is a tag anywhere
 * in it ("#inversion"), and a sealed hint is a fenced block. That keeps them
 * working against any database the feed already works against, lets a post be
 * copied, emailed or read by an older client without losing its meaning, and
 * means filtering by one is an ordinary text match.
 * ------------------------------------------------------------------------ */

export interface KindMeta {
  /** On the post, and on the filter chip for one. */
  label: string;
  /** On the filter chip, where the plural reads better. */
  plural: string;
  /** What the composer's button says. */
  action: string;
  /** What the composer asks for. */
  prompt: string;
  /** One line under the kind in the composer. */
  blurb: string;
}

export const KIND_META: Record<PostKind, KindMeta> = {
  solution: {
    label: 'Solution',
    plural: 'Solutions',
    action: 'Write up a solution',
    prompt: 'Walk through it step by step. Seal the key idea in a hint so nobody is spoiled.',
    blurb: 'A full argument for a problem.',
  },
  stuck: {
    label: 'Stuck',
    plural: 'Stuck',
    action: 'Ask for a nudge',
    prompt: 'What have you tried, and where exactly does it stop working?',
    blurb: 'Show where you are. People reply with hints, not answers.',
  },
  trick: {
    label: 'Trick',
    plural: 'Tricks',
    action: 'Share a trick',
    prompt: 'State the idea in one line, then show it working on a small example.',
    blurb: 'A lemma, identity or habit worth keeping.',
  },
  challenge: {
    label: 'Challenge',
    plural: 'Challenges',
    action: 'Set a challenge',
    prompt: 'Pose the problem. Seal your own answer in a hint so others can try first.',
    blurb: 'A problem of your own for others to try.',
  },
};

/**
 * The pattern a feed query uses to narrow to one kind. It is deliberately a
 * plain prefix: the database keeps every post that could be one, and
 * `isKind` then keeps exactly the ones that are.
 */
export const kindPattern = (kind: PostKind): string => `#${kind}%`;

/** Whether a stored body is a post of this kind. For "stuck", only the ones still open. */
export function isKind(body: string, kind: PostKind): boolean {
  const parsed = parsePost(body);
  return parsed.kind === kind && !parsed.resolved;
}

// Formulas and inline code are verbatim: `#include` is not a technique (see shared/postMarkup.ts).
const VERBATIM = VERBATIM_SOURCE;

// A tag starts a word, begins with a letter, and is short enough to be a name.
const TAG_BODY = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
const TAG = String.raw`(?<![A-Za-z0-9_&#/])#(${TAG_BODY})(?![A-Za-z0-9_])`;
const TAG_MAX = 32;

/** Normalise what someone typed into a tag, or null if it cannot be one. */
export function normaliseTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, '').toLocaleLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  if (!tag || tag.length > TAG_MAX || !/^[a-z]/.test(tag) || KIND_TAGS.has(tag)) return null;
  return tag;
}

/**
 * The technique tags in a post, in the order written, without repeats.
 *
 * Tags are read from the text a reader can see. A technique named only inside
 * a sealed hint or between hidden-word bars is the idea the author sealed, and
 * listing it under "Techniques in play" would give it away. `includeSealed` is
 * for the composer, which must know every tag already typed.
 */
export function extractTags(body: string, includeSealed = false): string[] {
  const pattern = new RegExp(`(${VERBATIM})|${TAG}`, 'gi');
  const text = includeSealed ? body : redactSealed(body);
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const tag = match[3]?.toLowerCase();
    if (!tag || tag.length > TAG_MAX || KIND_TAGS.has(tag)) continue;
    seen.add(tag);
  }
  return [...seen];
}

/** The most used tags across a page of posts, each counted once per post. */
export function tallyTags(bodies: string[], limit = 8): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const body of bodies) for (const tag of extractTags(body)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Techniques the composer offers, so the same idea ends up under the same tag. */
export const SUGGESTED_TAGS: readonly string[] = [
  'vieta', 'am-gm', 'telescoping', 'symmetry', 'substitution', 'induction',
  'angle-chasing', 'similar-triangles', 'power-of-a-point', 'inversion', 'coordinates',
  'pigeonhole', 'invariant', 'bijection', 'casework', 'complementary-counting', 'recursion',
  'mod-arithmetic', 'parity', 'lte', 'extremal', 'generating-functions',
];

export type BodySegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'tag'; value: string }
  | { type: 'spoiler'; value: string };

/** Plain runs, `@mentions` and `#tags` of a stretch of text that holds no hidden words. */
function pushRuns(text: string, segments: BodySegment[]): void {
  if (!text) return;
  const pattern = new RegExp(`(${VERBATIM})|${MENTION}|${TAG}`, 'gi');
  let plain = '';
  let last = 0;
  const flush = () => {
    if (!plain) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === 'text') previous.value += plain;
    else segments.push({ type: 'text', value: plain });
    plain = '';
  };
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [, verbatim, , handle, tag] = match;
    if (verbatim !== undefined) continue;
    let segment: BodySegment;
    if (handle !== undefined) segment = { type: 'mention', value: handle };
    else if (tag !== undefined && tag.length <= TAG_MAX && !KIND_TAGS.has(tag.toLowerCase())) segment = { type: 'tag', value: tag.toLowerCase() };
    else continue;
    plain += text.slice(last, match.index);
    flush();
    segments.push(segment);
    last = match.index + match[0].length;
  }
  plain += text.slice(last);
  flush();
}

/**
 * Split running text into plain runs, `@mentions`, `#tags` and `||hidden words||`.
 * Formulas and inline code are left whole inside the plain runs, so a norm like
 * `$||x||$` or a `\#` in LaTeX is never mistaken for markup; hidden words keep
 * whatever is inside them, a formula included, for the reader who opens them.
 */
export function segmentInline(text: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const [start, end] of hiddenRanges(text)) {
    pushRuns(text.slice(cursor, start), segments);
    segments.push({ type: 'spoiler', value: text.slice(start + 2, end - 2) });
    cursor = end;
  }
  pushRuns(text.slice(cursor), segments);
  return segments;
}

export type BodyBlock = { type: 'prose'; value: string } | { type: 'hint'; value: string; step: number; of: number };

const HINT = new RegExp(HINT_SOURCE, 'gi');

/**
 * Split a post into prose and its sealed hints, numbering the hints as rungs
 * of one ladder: "Hint 2 of 3". An unclosed fence is left as the author typed
 * it, so a half-written post never swallows the rest of itself.
 */
export function segmentBlocks(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const hints: Array<{ type: 'hint'; value: string; step: number; of: number }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  HINT.lastIndex = 0;
  while ((match = HINT.exec(text)) !== null) {
    const before = text.slice(last, match.index);
    if (before.trim()) blocks.push({ type: 'prose', value: before.replace(/^\n+|\n+$/g, '') });
    const value = match[1]!.trim();
    if (value) {
      const hint = { type: 'hint' as const, value, step: hints.length + 1, of: 0 };
      hints.push(hint);
      blocks.push(hint);
    }
    last = match.index + match[0].length;
  }
  const rest = text.slice(last);
  if (rest.trim() || blocks.length === 0) blocks.push({ type: 'prose', value: blocks.length === 0 ? rest : rest.replace(/^\n+|\n+$/g, '') });
  for (const hint of hints) hint.of = hints.length;
  return blocks;
}

/** How many sealed hints a post carries, for the line under its text. */
export const countHints = (text: string): number => segmentBlocks(text).filter((block) => block.type === 'hint').length;

/* --------------------------------------------------------------------------
 * Today's board
 * ------------------------------------------------------------------------ */

const DAY_MS = 24 * HOUR;

/** The UTC day a moment falls on, as whole days since the epoch. */
export const boardDay = (now: number): number => Math.floor(now / DAY_MS);

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * The one problem everyone is looking at today.
 *
 * Chosen from the date alone, so every learner in every timezone's "today"
 * (UTC) sees the same one without the database having to pick it. The walk
 * through the bank uses a stride coprime to its size, which visits every
 * problem once before any repeats.
 */
export function boardProblem<T extends { id: string; proOnly?: boolean }>(problems: T[], now: number): T | null {
  const pool = problems.filter((problem) => !problem.proOnly).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  let stride = Math.min(pool.length - 1, 37) || 1;
  while (gcd(stride, pool.length) !== 1) stride += 1;
  return pool[(boardDay(now) * stride + 11) % pool.length] ?? null;
}

/** "9h 12m" until the board turns over; "under a minute" at the very end. */
export function boardCountdown(now: number): string {
  const left = (boardDay(now) + 1) * DAY_MS - now;
  const hours = Math.floor(left / HOUR);
  const minutes = Math.floor((left % HOUR) / MINUTE);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return minutes > 0 ? `${minutes}m` : 'under a minute';
}

/* --------------------------------------------------------------------------
 * Notes on a line
 *
 * A comment may be about one line of a post rather than the whole of it. It
 * says so the way plain-text mail does: it opens with the line, quoted behind
 * a ">". Nothing new is stored, an older client shows the quote as text, and
 * the thread can set the quoted line apart from what was said about it.
 * ------------------------------------------------------------------------ */

/** The most of a line a note quotes. Longer selections are cut at a word, never inside a formula. */
export const QUOTE_MAX = 220;

const QUOTED_LINE = /^[ \t]*>[ \t]?/;

/** Separate the line a comment quotes, if it opens with one, from what was written about it. */
export function splitQuote(body: string): { quote: string | null; text: string } {
  const lines = body.split('\n');
  let count = 0;
  while (count < lines.length && QUOTED_LINE.test(lines[count]!)) count += 1;
  const quote = lines
    .slice(0, count)
    .map((line) => line.replace(QUOTED_LINE, '').trim())
    .filter(Boolean)
    .join(' ');
  if (!quote) return { quote: null, text: body };
  return { quote, text: lines.slice(count).join('\n').replace(/^\n+/, '') };
}

/** One line, at most QUOTE_MAX long. A cut never lands inside `$…$`, and is marked with an ellipsis. */
export function clipQuote(raw: string): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= QUOTE_MAX) return flat;
  let cut = flat.slice(0, QUOTE_MAX);
  // An odd number of dollars is an open formula: go back to before it began.
  if ((cut.match(/\$/g) ?? []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf('$'));
  else cut = cut.replace(/\s+\S*$/, '');
  return `${cut.trim()}…`;
}

/**
 * The first line of a comment that quotes these words, ready to be typed
 * after. `sealed` is for words taken from an opened hint or from hidden text:
 * they are quoted hidden, so the note does not undo what the author sealed.
 */
export function quoteLine(raw: string, sealed = false): string {
  const flat = clipQuote(raw.replace(/\|\|/g, ' '));
  if (!flat) return '';
  return `> ${sealed ? `||${flat}||` : flat}\n`;
}

/* --------------------------------------------------------------------------
 * What the marks add up to
 * ------------------------------------------------------------------------ */

export interface Verdict {
  tone: 'checked' | 'questioned' | 'lost';
  text: string;
}

const CHECKED_AT = 5;
const QUESTIONED_AT = 3;
const LOST_AT = 3;

/**
 * The one line the marks on a post add up to, if they add up to anything.
 *
 * This is what makes a mark more than a reaction: enough readers saying "check
 * this" is a warning to the next reader, enough saying they follow with nobody
 * objecting is a reason to trust a write-up, and enough saying they are lost
 * is something only the author can act on, so only the author is told.
 */
export function verdict(counts: ReactionCounts | undefined, isAuthor: boolean): Verdict | null {
  const questioned = counts?.angry ?? 0;
  const followed = counts?.like ?? 0;
  const lost = counts?.sad ?? 0;

  if (questioned >= QUESTIONED_AT) return { tone: 'questioned', text: `${compactCount(questioned)} readers question a step` };
  if (isAuthor && lost >= LOST_AT) return { tone: 'lost', text: `${compactCount(lost)} readers got lost here. A hint might help.` };
  if (followed >= CHECKED_AT && questioned === 0) return { tone: 'checked', text: `checked by ${compactCount(followed)} readers` };
  return null;
}

/* --------------------------------------------------------------------------
 * Who is helping
 * ------------------------------------------------------------------------ */

export interface Helper<A> {
  id: string;
  author: A | null;
  posts: number;
  /** Marks that say a post helped. "Lost me" and "Check this" are not among them. */
  marks: number;
}

/** The marks a reader leaves when a post did them good. */
const HELPFUL: readonly Reaction[] = ['like', 'love', 'care', 'haha', 'wow'];

/** How many of a post's marks say it helped. Without a breakdown, the total stands in. */
export function helpfulMarks(post: { like_count: number; reactions?: ReactionCounts }): number {
  if (!post.reactions) return post.like_count;
  return HELPFUL.reduce((sum, key) => sum + (post.reactions![key] ?? 0), 0);
}

/**
 * The people whose posts on this page helped most: counted in the marks that
 * say so, with posts only breaking a tie, so neither writing a lot nor drawing
 * objections is a way onto the list. Someone with none is not listed.
 */
export function rankHelpers<A>(
  posts: Array<{ author_id: string; author: A | null; like_count: number; reactions?: ReactionCounts }>,
  limit = 5,
): Helper<A>[] {
  const people = new Map<string, Helper<A>>();
  for (const post of posts) {
    const entry = people.get(post.author_id) ?? { id: post.author_id, author: post.author, posts: 0, marks: 0 };
    entry.posts += 1;
    entry.marks += helpfulMarks(post);
    people.set(post.author_id, entry);
  }
  return [...people.values()]
    .filter((person) => person.marks > 0)
    .sort((a, b) => b.marks - a.marks || b.posts - a.posts)
    .slice(0, limit);
}

/* --------------------------------------------------------------------------
 * The composer's symbol keys
 * ------------------------------------------------------------------------ */

/**
 * Whether the caret sits inside a formula, so a symbol key can insert bare
 * LaTeX instead of wrapping it in a second pair of dollars. Decided from the
 * opener still unclosed before the caret, whichever of `$`, `$$`, `\(` or
 * `\[` it is; counting dollars alone gets `$$x + ` wrong.
 */
export function insideMath(value: string, caret: number): boolean {
  const before = value.slice(0, caret).replace(/\\\$/g, '');
  const unclosed = before.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$/g, '');
  return /\$|\\\(|\\\[/.test(unclosed);
}
