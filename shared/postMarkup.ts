/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * How the text of a Community post is marked up.
 *
 * A post's kind, its sealed hints and its hidden words all live in the text
 * itself rather than in columns of their own: a kind is the tag a post opens
 * with ("#stuck"), a sealed hint is a fenced block, hidden words sit between
 * double bars. That keeps them working against the database the feed already
 * has, lets a post be copied or read by an older client without losing its
 * meaning, and makes filtering by one an ordinary text match.
 *
 * It also means the text is read in two places, and they must agree. The
 * browser renders it (src/components/community); the server quotes it in the
 * email every member receives for a new post (server/email.ts), where a sealed
 * hint must stay sealed. So the syntax is defined once, here, with no React,
 * no DOM and no dependency.
 */

export type PostKind = 'solution' | 'stuck' | 'trick' | 'challenge';

export const POST_KINDS: readonly PostKind[] = ['solution', 'stuck', 'trick', 'challenge'];

/** The tag a resolved "stuck" post carries instead of `#stuck`. */
export const RESOLVED_TAG = 'unstuck';

/** Tags that file a post rather than describe a technique. */
export const KIND_TAGS: ReadonlySet<string> = new Set<string>([...POST_KINDS, RESOLVED_TAG]);

// The tag stands alone on the first line. "#stuck on problem 4" is somebody's
// sentence, not a filing instruction, and is left exactly as they wrote it.
const LEADING_KIND = /^\s*#(solution|stuck|unstuck|trick|challenge)[ \t]*(?:\r?\n|$)/i;

export interface ParsedPost {
  kind: PostKind | null;
  /** Only ever true for a "stuck" post whose author has marked it resolved. */
  resolved: boolean;
  /** The body without its kind tag: what is shown, and what the composer edits. */
  text: string;
}

/** Read the kind a post opens with, and separate it from what the author wrote. */
export function parsePost(body: string): ParsedPost {
  const match = LEADING_KIND.exec(body);
  if (!match) return { kind: null, resolved: false, text: body };
  const tag = match[1]!.toLowerCase();
  const text = body.slice(match[0].length);
  return tag === RESOLVED_TAG ? { kind: 'stuck', resolved: true, text } : { kind: tag as PostKind, resolved: false, text };
}

/** The body to store for a post of this kind. A share, or a plain post, has no tag. */
export function composePost(text: string, kind: PostKind | null, resolved = false): string {
  const stripped = parsePost(text).text;
  if (!kind) return stripped;
  return `#${kind === 'stuck' && resolved ? RESOLVED_TAG : kind}\n${stripped}`;
}

/*
 * Sources for the patterns, as strings, so each reader can combine them with
 * its own alternatives. Formulas and inline code are "verbatim": whatever is
 * inside one is never markup, so a norm such as `$||x||$` or a `#` in code is
 * left alone. `MATH_SOURCE` contains one named group (`env`), which also takes
 * a number: in `(${VERBATIM_SOURCE})|…` the next free group is the third.
 */
export const MATH_SOURCE = String.raw`\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\\begin\{(?<env>[a-z*]+)\}[\s\S]+?\\end\{\k<env>\}`;
export const CODE_SOURCE = String.raw`\x60[^\x60\n]+\x60`;
export const VERBATIM_SOURCE = `${MATH_SOURCE}|${CODE_SOURCE}`;

/**
 * `[hint] … [/hint]`, on its own lines or inline. An unclosed fence is not a
 * hint. One lazy quantifier and nothing else between the fences: whitespace is
 * trimmed by whoever reads the capture. An earlier form matched the optional
 * whitespace itself, on both sides of the capture, and an opener followed by a
 * long run of spaces made that backtrack for seconds.
 */
export const HINT_SOURCE = String.raw`\[hint\]([\s\S]*?)\[\/hint\]`;

const WORD = /[A-Za-z0-9]/;
const SEALED_NOTE = '[sealed hint]';

/**
 * Where the hidden words of a text are: `[start, end)` for each, bars included.
 *
 * Bars are paired by walking the text rather than by one pattern, because what
 * sits between them may be a formula with bars of its own, and a pattern that
 * nests formulas backtracks without bound. The rules a pair must meet are the
 * ones that keep ordinary writing from being hidden by accident:
 *
 *   - the opening bars start a word (`AB||CD`, parallel lines, is not markup)
 *     and are followed by something that is not a space (`a || b` is not);
 *   - the closing bars end a word and follow something that is not a space;
 *   - both sit on one line, so two stray pairs in different paragraphs never
 *     swallow what lies between them.
 *
 * `openEnded` is for a text that was cut short, such as the first 140
 * characters the database keeps for a notification: an opener with no closer
 * is then taken to run to the end, so what was hidden stays hidden.
 */
export function hiddenRanges(text: string, openEnded = false): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const pattern = new RegExp(`(${VERBATIM_SOURCE})|\\|\\|`, 'gi');
  let open = -1;
  let scanned = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match[1] !== undefined) continue;
    const at = match.index;

    if (open >= 0) {
      const newline = text.indexOf('\n', scanned);
      if (newline >= 0 && newline < at) open = -1;
      scanned = at;
    }

    const before = text[at - 1];
    const after = text[at + 2];
    if (open < 0) {
      const startsWord = !(before !== undefined && WORD.test(before));
      const holdsSomething = after !== undefined && !/[\s|]/.test(after);
      if (startsWord && holdsSomething) {
        open = at;
        scanned = at;
      }
    } else if (at > open + 2 && before !== undefined && !/\s/.test(before) && !(after !== undefined && WORD.test(after))) {
      ranges.push([open, at + 2]);
      open = -1;
    }
  }

  if (openEnded && open >= 0 && text.indexOf('\n', open) < 0) ranges.push([open, text.length]);
  return ranges;
}

/**
 * The text as it may be quoted outside the feed: in an email, a share sheet, a
 * message preview. Sealed hints and hidden words are replaced by a note that
 * they are there, so nothing an author sealed reaches a reader who did not ask
 * for it. Pass `truncated` for a text that was cut short before it got here:
 * a fence or a pair of bars left open by the cut is then sealed to the end.
 */
export function redactSealed(text: string, options: { truncated?: boolean } = {}): string {
  let open = text.replace(new RegExp(HINT_SOURCE, 'gi'), (_fence, inner: string) => (inner.trim() ? `\n${SEALED_NOTE}\n` : '\n'));
  if (options.truncated) {
    const dangling = open.search(/\[hint\]/i);
    if (dangling >= 0) open = `${open.slice(0, dangling)}\n${SEALED_NOTE}`;
  }

  let quoted = '';
  let cursor = 0;
  for (const [start, end] of hiddenRanges(open, options.truncated)) {
    quoted += `${open.slice(cursor, start)}[hidden]`;
    cursor = end;
  }
  quoted += open.slice(cursor);

  // Each note on a line of its own, with no blank lines piling up where a fence
  // used to be. Done by splitting rather than by a pattern over the whitespace:
  // a pattern that starts with "any spaces" is quadratic on a long run of them.
  const parts = quoted.split(SEALED_NOTE);
  if (parts.length > 1) {
    const last = parts.length - 1;
    quoted = parts.map((part, index) => (index === 0 ? part.trimEnd() : index === last ? part.trimStart() : part.trim())).join(`\n${SEALED_NOTE}\n`);
  }
  return quoted
    .replace(/\[sealed hint\]\n\n(?=\[sealed hint\])/g, `${SEALED_NOTE}\n`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
