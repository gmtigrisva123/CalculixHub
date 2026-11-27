/**
 * Keeping a formula and the punctuation after it on one line.
 *
 * A formula is set as a single box, and a browser is free to break the line
 * between that box and the comma or full stop that follows it, which leaves a
 * line opening with a stray "." or "?". Here the mark is moved inside the
 * formula, where it is set in the same face and at the same place but can no
 * longer be parted from it.
 *
 * Only the text handed to the typesetter changes. A problem as the archive
 * holds it is untouched, and that is what the tests compare.
 */

// The segments MathText treats as mathematics, in the order it tries them.
const SEGMENT = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g;
const MARKS = '.,;:?!';

export function bindPunctuation(text: string): string {
  let out = '';
  let last = 0;
  for (const match of text.matchAll(SEGMENT)) {
    const segment = match[0];
    const end = match.index + segment.length;
    out += text.slice(last, match.index);
    const mark = text[end];
    // Displayed formulas stand on a line of their own; nothing can be parted from them.
    const inline = !segment.startsWith('$$') && !segment.startsWith('\\[');
    if (inline && mark !== undefined && MARKS.includes(mark)) {
      const closer = segment.startsWith('$') ? 1 : 2;
      out += segment.slice(0, -closer) + mark + segment.slice(-closer);
      last = end + 1;
    } else {
      out += segment;
      last = end;
    }
  }
  return out + text.slice(last);
}
