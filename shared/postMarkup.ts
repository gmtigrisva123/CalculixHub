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

/** `||hidden words||`: at least one character, not starting with a space, single bars allowed inside. */
export const SPOILER_SOURCE = String.raw`\|\|(?!\s)([^|\n](?:[^|]|\|(?!\|))*?)\|\|`;

/** `[hint] … [/hint]`, on its own lines or inline. An unclosed fence is not a hint. */
export const HINT_SOURCE = String.raw`\[hint\][ \t]*\n?([\s\S]*?)\n?[ \t]*\[\/hint\]`;

/**
 * The text as it may be quoted outside the feed: in an email, a share sheet, a
 * message preview. Sealed hints and hidden words are replaced by a note that
 * they are there, so nothing an author sealed reaches a reader who did not ask
 * for it.
 */
export function redactSealed(text: string): string {
  const withoutHints = text.replace(new RegExp(HINT_SOURCE, 'gi'), (_fence, inner: string) => (inner.trim() ? '\n[sealed hint]\n' : '\n'));
  const withoutSpoilers = withoutHints.replace(new RegExp(`(${VERBATIM_SOURCE})|${SPOILER_SOURCE}`, 'gi'), (match, verbatim: string | undefined) =>
    verbatim === undefined ? '[hidden]' : match,
  );
  // Each note on a line of its own, with no blank lines piling up where a fence used to be.
  return withoutSpoilers
    .replace(/[ \t]*\n\s*(?=\[sealed hint\])/g, '\n')
    .replace(/(\[sealed hint\])\s*\n[ \t]*/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
