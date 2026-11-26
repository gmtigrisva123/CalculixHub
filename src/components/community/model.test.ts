import { describe, expect, it } from 'vitest';
import type { CommentWithAuthor } from '../../services/database.types';
import {
  compactAge,
  compactCount,
  disambiguateTitles,
  initials,
  isUuid,
  postAge,
  shareLink,
  activeMention,
  completeMention,
  holdBackFresh,
  newestCreatedAt,
  shiftReaction,
  threadComments,
  typingSentence,
  verdict,
  topReactions,
  totalReactions,
  KIND_META,
  POST_KINDS,
  REACTION_META,
  SUGGESTED_TAGS,
  boardCountdown,
  boardDay,
  boardProblem,
  composePost,
  countHints,
  extractTags,
  helpfulMarks,
  insideMath,
  isKind,
  kindPattern,
  normaliseTag,
  parsePost,
  rankHelpers,
  redactSealed,
  segmentBlocks,
  segmentInline,
  tallyTags,
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

  it('names all seven marks, each with what leaving it says', () => {
    const marks = Object.entries(REACTION_META);
    // The keys are the database's; only what they are called here is ours to change.
    expect(marks.map(([key]) => key)).toEqual(['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry']);
    expect(new Set(marks.map(([, meta]) => meta.label)).size).toBe(7);
    for (const [, meta] of marks) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.hint.length).toBeGreaterThan(0);
    }
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
    expect(segmentInline('@ada_l nice proof')).toEqual([{ type: 'mention', value: 'ada_l' }, { type: 'text', value: ' nice proof' }]);
    expect(segmentInline('Thanks @bob and @Eve_N!')).toEqual([
      { type: 'text', value: 'Thanks ' },
      { type: 'mention', value: 'bob' },
      { type: 'text', value: ' and ' },
      { type: 'mention', value: 'Eve_N' },
      { type: 'text', value: '!' },
    ]);
    expect(segmentInline('mail me@x.com, $a@b$ and $$x @y$$')).toEqual([{ type: 'text', value: 'mail me@x.com, $a@b$ and $$x @y$$' }]);
    expect(segmentInline('\\begin{align}@z\\end{align} @ok')).toEqual([
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

describe('disambiguating problem titles', () => {
  it('tags only the titles that collide across levels, leaving unique ones alone', () => {
    const problems = [
      { id: '1', title: 'A circle in disguise', level: 'Foundation' },
      { id: '2', title: 'A circle in disguise', level: 'Advanced' },
      { id: '3', title: 'The lonely triangle', level: 'Foundation' },
    ];
    const titles = disambiguateTitles(problems);
    expect(titles.get('1')).toBe('A circle in disguise (Foundation)');
    expect(titles.get('2')).toBe('A circle in disguise (Advanced)');
    expect(titles.get('3')).toBe('The lonely triangle');
  });
});

describe('the kind of a post', () => {
  it('is the tag the post opens with, read apart from what the author wrote', () => {
    expect(parsePost('#stuck\nWhere do I start?')).toEqual({ kind: 'stuck', resolved: false, text: 'Where do I start?' });
    expect(parsePost('#Solution  \nSquare both sides.')).toEqual({ kind: 'solution', resolved: false, text: 'Square both sides.' });
    expect(parsePost('#trick\r\nSubtract the 2.')).toEqual({ kind: 'trick', resolved: false, text: 'Subtract the 2.' });
    // A post that is only its kind (the rest was images) still has one.
    expect(parsePost('#challenge')).toEqual({ kind: 'challenge', resolved: false, text: '' });
  });

  it('reads a resolved question as a stuck post that is no longer open', () => {
    expect(parsePost('#unstuck\nGot it, thanks.')).toEqual({ kind: 'stuck', resolved: true, text: 'Got it, thanks.' });
  });

  it('leaves a sentence that merely starts with the word alone', () => {
    for (const body of ['#stuck on problem 4, any ideas?', '#solutions are overrated', 'Hello #stuck', '# stuck\nspaced', 'stuck\nno hash']) {
      expect(parsePost(body)).toEqual({ kind: null, resolved: false, text: body });
    }
  });

  it('stores the kind once, however many times a post is edited', () => {
    expect(composePost('Body', 'trick')).toBe('#trick\nBody');
    expect(composePost('#stuck\nBody', 'solution')).toBe('#solution\nBody');
    expect(composePost('#stuck\nBody', null)).toBe('Body');
    expect(composePost('Body', 'stuck', true)).toBe('#unstuck\nBody');
    // Only a question can be resolved.
    expect(composePost('Body', 'solution', true)).toBe('#solution\nBody');
    for (const kind of POST_KINDS) {
      const stored = composePost(composePost('Two\nlines', kind), kind);
      expect(parsePost(stored)).toEqual({ kind, resolved: false, text: 'Two\nlines' });
    }
  });

  it('keeps a tag typed by hand when it is composed with the kind it names', () => {
    for (const text of ['x', '#stuck\nx', '  lead']) {
      for (const kind of [...POST_KINDS, null]) {
        const stored = composePost(text, kind);
        expect(parsePost(stored).kind).toBe(kind);
        expect(composePost(stored, parsePost(stored).kind)).toBe(stored);
      }
    }
    expect(composePost('#stuck\nx', parsePost('#stuck\nx').kind)).toBe('#stuck\nx');
  });

  it('narrows a feed to open posts of one kind', () => {
    expect(kindPattern('stuck')).toBe('#stuck%');
    expect(isKind('#stuck\nHelp', 'stuck')).toBe(true);
    // The database pattern is a prefix, so these reach the client and are dropped here.
    expect(isKind('#unstuck\nSolved', 'stuck')).toBe(false);
    expect(isKind('#stuckness is a state of mind', 'stuck')).toBe(false);
    expect(isKind('#solution\nQED', 'stuck')).toBe(false);
  });

  it('describes every kind', () => {
    for (const kind of POST_KINDS) {
      const meta = KIND_META[kind];
      for (const text of [meta.label, meta.plural, meta.action, meta.prompt, meta.blurb]) expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('technique tags', () => {
  it('finds tags in prose, once each, lower-cased, in the order written', () => {
    expect(extractTags('Tried #AM-GM, then #vieta and #am-gm again.')).toEqual(['am-gm', 'vieta']);
  });

  it('ignores what only looks like a tag', () => {
    const body = '#stuck\nSee $\\#S = 3$, https://example.org/page#anchor, C#, issue #12, `#include`, me#you and #unstuck.';
    expect(extractTags(body)).toEqual([]);
  });

  it('does not read a technique out of what the author sealed', () => {
    const body = '[hint]use #inversion[/hint] and ||#pigeonhole||, then #vieta';
    expect(extractTags(body)).toEqual(['vieta']);
    // The composer still needs to know every tag that has been typed.
    expect(extractTags(body, true)).toEqual(['inversion', 'pigeonhole', 'vieta']);
  });

  it('keeps a tag of 32 characters and no longer', () => {
    expect(extractTags(`#${'a'.repeat(32)} and #${'b'.repeat(33)}, (#parity) #parity,#casework #Invariant #INVARIANT`)).toEqual(['a'.repeat(32), 'parity', 'casework', 'invariant']);
  });

  it('normalises what someone types into the form a tag is stored in', () => {
    expect(normaliseTag(' #Angle Chasing ')).toBe('angle-chasing');
    expect(normaliseTag('power_of_a_point')).toBe('power-of-a-point');
    expect(normaliseTag('a--b')).toBe('a-b');
    expect(normaliseTag('#stuck')).toBeNull();
    expect(normaliseTag('2024')).toBeNull();
    expect(normaliseTag('')).toBeNull();
    expect(normaliseTag('x'.repeat(40))).toBeNull();
  });

  it('counts a tag once per post and lists the most used first', () => {
    const tally = tallyTags(['#vieta and #vieta', 'again #vieta #parity', 'no tags here', '#parity', '#lte'], 2);
    expect(tally).toEqual([{ tag: 'parity', count: 2 }, { tag: 'vieta', count: 2 }]);
  });

  it('suggests only tags that are valid as written', () => {
    for (const tag of SUGGESTED_TAGS) expect(normaliseTag(tag)).toBe(tag);
    expect(new Set(SUGGESTED_TAGS).size).toBe(SUGGESTED_TAGS.length);
  });
});

describe('text with mentions, tags and hidden words', () => {
  it('picks each out and leaves formulas whole', () => {
    expect(segmentInline('Thanks @ada: use #vieta, the answer is ||682||, since $||x|| \\le 1$.')).toEqual([
      { type: 'text', value: 'Thanks ' },
      { type: 'mention', value: 'ada' },
      { type: 'text', value: ': use ' },
      { type: 'tag', value: 'vieta' },
      { type: 'text', value: ', the answer is ' },
      { type: 'spoiler', value: '682' },
      { type: 'text', value: ', since $||x|| \\le 1$.' },
    ]);
  });

  it('does not hide a logical or, or an empty pair of bars', () => {
    for (const text of ['a || b || c', '||||', '|| spaced out ||', 'one | two | three']) {
      expect(segmentInline(text)).toEqual([{ type: 'text', value: text }]);
    }
  });

  it('keeps a single bar inside hidden words', () => {
    expect(segmentInline('so ||a|b|| holds')).toEqual([
      { type: 'text', value: 'so ' },
      { type: 'spoiler', value: 'a|b' },
      { type: 'text', value: ' holds' },
    ]);
  });

  it('pairs the bars by word and by line, so ordinary writing is never hidden', () => {
    // Parallel lines, a chain of ors, and two stray pairs in different paragraphs.
    for (const text of ['Since AB||CD we get equal angles, and EF||GH too.', 'x||y||z', '||two\nlines||', 'first || here\n\nand there ||x']) {
      expect(segmentInline(text)).toEqual([{ type: 'text', value: text }]);
      expect(redactSealed(text)).toBe(text);
    }
    expect(segmentInline('(||42||), then ||a|b||.')).toEqual([
      { type: 'text', value: '(' },
      { type: 'spoiler', value: '42' },
      { type: 'text', value: '), then ' },
      { type: 'spoiler', value: 'a|b' },
      { type: 'text', value: '.' },
    ]);
  });

  it('keeps a formula whole inside hidden words, bars and all', () => {
    expect(segmentInline('The answer is ||$||v|| = 5$|| done')).toEqual([
      { type: 'text', value: 'The answer is ' },
      { type: 'spoiler', value: '$||v|| = 5$' },
      { type: 'text', value: ' done' },
    ]);
    expect(redactSealed('The answer is ||$||v|| = 5$|| done')).toBe('The answer is [hidden] done');
  });

  it('stays fast on hostile input', () => {
    const hostile = [
      '|'.repeat(5000),
      `||${'a|'.repeat(2500)}`,
      `||a${'||a'.repeat(1600)}`,
      `||a ${'|| '.repeat(1600)}`,
      '$'.repeat(5000),
      '#'.repeat(5000),
      '@'.repeat(5000),
      '`'.repeat(5000),
      `${' '.repeat(5000)}#`,
      '#a-'.repeat(1600),
      '\\begin{a}'.repeat(550),
      '[hint]'.repeat(830),
      // An opener, a long run of blanks and no close: the shape that made an
      // earlier hint pattern backtrack for twenty seconds.
      `[hint]${' '.repeat(4990)}x`,
      `[hint]${'\t'.repeat(40)}\n`.repeat(100),
      `${'[hint] '.repeat(700)}[/hint]`,
    ];
    for (const text of hostile) {
      for (const read of [segmentInline, segmentBlocks, countHints, extractTags, parsePost, redactSealed, (value: string) => redactSealed(value, { truncated: true })]) {
        const started = performance.now();
        read(text);
        expect(performance.now() - started).toBeLessThan(250);
      }
    }
  });
});

describe('sealed hints', () => {
  it('numbers the hints of a post as the rungs of one ladder', () => {
    expect(segmentBlocks('Intro\n[hint]\nFirst\n[/hint]\n[HINT]Second[/hint]\nOutro')).toEqual([
      { type: 'prose', value: 'Intro' },
      { type: 'hint', value: 'First', step: 1, of: 2 },
      { type: 'hint', value: 'Second', step: 2, of: 2 },
      { type: 'prose', value: 'Outro' },
    ]);
    expect(countHints('a[hint]x[/hint]b[hint]y[/hint]')).toBe(2);
  });

  it('leaves an unclosed or empty fence as the author typed it', () => {
    expect(segmentBlocks('Text [hint] with no close')).toEqual([{ type: 'prose', value: 'Text [hint] with no close' }]);
    expect(segmentBlocks('[hint]  [/hint]Only this')).toEqual([{ type: 'prose', value: 'Only this' }]);
    expect(segmentBlocks('')).toEqual([{ type: 'prose', value: '' }]);
    expect(countHints('no hints')).toBe(0);
  });
});

describe('today’s board', () => {
  const problems = Array.from({ length: 10 }, (_, index) => ({ id: `p${String(index).padStart(2, '0')}`, proOnly: index === 3 }));
  const midnight = Date.UTC(2026, 10, 26);
  const HOUR = 3_600_000;

  it('shows everyone the same problem for the whole UTC day', () => {
    const first = boardProblem(problems, midnight);
    expect(first).not.toBeNull();
    expect(boardProblem(problems, midnight + 23 * HOUR + 59 * 60_000)).toBe(first);
    expect(boardProblem([...problems].reverse(), midnight + 5 * HOUR)).toBe(first);
    expect(boardProblem(problems, midnight + 24 * HOUR)).not.toBe(first);
    expect(boardDay(midnight + 24 * HOUR)).toBe(boardDay(midnight) + 1);
  });

  it('goes through every free problem before repeating one', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 9; day++) seen.add(boardProblem(problems, midnight + day * 24 * HOUR)!.id);
    expect(seen.size).toBe(9);
    expect(seen.has('p03')).toBe(false);
  });

  it('has nothing to pin when the bank is empty or all of it is paid', () => {
    expect(boardProblem([], midnight)).toBeNull();
    expect(boardProblem([{ id: 'only', proOnly: true }], midnight)).toBeNull();
    expect(boardProblem([{ id: 'only' }], midnight + 400 * 24 * HOUR)).toEqual({ id: 'only' });
  });

  it('counts down to midnight UTC', () => {
    expect(boardCountdown(midnight + HOUR)).toBe('23h 00m');
    expect(boardCountdown(midnight + 14 * HOUR + 48 * 60_000)).toBe('9h 12m');
    expect(boardCountdown(midnight + 24 * HOUR - 5 * 60_000)).toBe('5m');
    expect(boardCountdown(midnight + 24 * HOUR - 30_000)).toBe('under a minute');
  });
});

describe('who is helping', () => {
  it('ranks by the marks that say a post helped, and by posts only to break a tie', () => {
    const posts = [
      { author_id: 'a', author: 'Ada', like_count: 2, reactions: { like: 2 } },
      { author_id: 'b', author: 'Bao', like_count: 5, reactions: { love: 3, wow: 2 } },
      { author_id: 'a', author: 'Ada', like_count: 4, reactions: { care: 3, haha: 1 } },
      { author_id: 'c', author: 'Chloe', like_count: 6, reactions: { like: 6 } },
      { author_id: 'd', author: null, like_count: 0, reactions: {} },
    ];
    expect(rankHelpers(posts, 3)).toEqual([
      { id: 'a', author: 'Ada', posts: 2, marks: 6 },
      { id: 'c', author: 'Chloe', posts: 1, marks: 6 },
      { id: 'b', author: 'Bao', posts: 1, marks: 5 },
    ]);
    expect(rankHelpers([])).toEqual([]);
  });

  it('does not count objections as help, or list someone who drew only those', () => {
    const disputed = { author_id: 'e', author: 'Eve', like_count: 9, reactions: { angry: 6, sad: 3 } };
    const mixed = { author_id: 'f', author: 'Farah', like_count: 5, reactions: { like: 2, sad: 3 } };

    expect(helpfulMarks(disputed)).toBe(0);
    expect(helpfulMarks(mixed)).toBe(2);
    expect(rankHelpers([disputed, mixed])).toEqual([{ id: 'f', author: 'Farah', posts: 1, marks: 2 }]);
    // An older database has no breakdown, and its one kind of mark was a like.
    expect(helpfulMarks({ like_count: 4 })).toBe(4);
  });
});

describe('the composer’s symbol keys', () => {
  it('know when the caret is inside a formula, whichever way it was opened', () => {
    expect(insideMath('$x', 2)).toBe(true);
    expect(insideMath('$$x + ', 6)).toBe(true);
    expect(insideMath('\\(x + ', 6)).toBe(true);
    expect(insideMath('\\[ a + ', 7)).toBe(true);
    expect(insideMath('$x$ and ', 8)).toBe(false);
    expect(insideMath('$$a$$ b', 7)).toBe(false);
    expect(insideMath('it cost \\$5 and ', 17)).toBe(false);
    expect(insideMath('', 0)).toBe(false);
  });
});

describe('quoting a post outside the feed', () => {
  it('replaces what the author sealed with a note that it is there', () => {
    const text = 'Drop the altitude.\n[hint]\nThe height is 12.\n[/hint]\nSo the answer is ||100||.';
    expect(redactSealed(text)).toBe('Drop the altitude.\n[sealed hint]\nSo the answer is [hidden].');
  });

  it('leaves formulas, inline code and anything unsealed exactly as written', () => {
    const text = 'A norm $||x|| \\le 1$, code `a||b||c`, a || b, and [hint] with no close.';
    expect(redactSealed(text)).toBe(text);
  });

  it('seals to the end what a cut left open', () => {
    // The database keeps the first 140 characters of a body for a notification.
    expect(redactSealed('Start ||the secret answ', { truncated: true })).toBe('Start [hidden]');
    expect(redactSealed('Start [hint] the key idea goes', { truncated: true })).toBe('Start\n[sealed hint]');
    // Without the option an unclosed fence is only what the author typed.
    expect(redactSealed('Start ||the secret answ')).toBe('Start ||the secret answ');
    // A line break after the bars means they never were an opener.
    expect(redactSealed('Start ||a\nb', { truncated: true })).toBe('Start ||a\nb');
  });

  it('keeps a ladder readable as a ladder, without leaving gaps where empty hints were', () => {
    expect(redactSealed('[hint]one[/hint]\n[hint]two[/hint]\n[hint] [/hint]\nDone')).toBe('[sealed hint]\n[sealed hint]\nDone');
    expect(redactSealed('Before [hint]inline[/hint] after')).toBe('Before\n[sealed hint]\nafter');
    expect(redactSealed('')).toBe('');
  });
});

describe('what the marks add up to', () => {
  it('says a write-up was checked once enough readers follow it and nobody objects', () => {
    expect(verdict({ like: 5 }, false)).toEqual({ tone: 'checked', text: 'checked by 5 readers' });
    expect(verdict({ like: 4, love: 9 }, false)).toBeNull();
    // One objection is enough to withhold it.
    expect(verdict({ like: 12, angry: 1 }, false)).toBeNull();
  });

  it('warns the next reader when several question a step, whatever else was marked', () => {
    expect(verdict({ like: 30, angry: 3 }, false)).toEqual({ tone: 'questioned', text: '3 readers question a step' });
    expect(verdict({ angry: 2 }, false)).toBeNull();
  });

  it('tells only the author that readers are getting lost', () => {
    expect(verdict({ sad: 3 }, true)).toEqual({ tone: 'lost', text: '3 readers got lost here. A hint might help.' });
    expect(verdict({ sad: 3 }, false)).toBeNull();
    expect(verdict({ sad: 3, like: 6 }, false)).toEqual({ tone: 'checked', text: 'checked by 6 readers' });
  });

  it('says nothing about a post with few marks or none', () => {
    expect(verdict(undefined, true)).toBeNull();
    expect(verdict({}, false)).toBeNull();
    expect(verdict({ wow: 2, care: 1 }, true)).toBeNull();
  });
});
