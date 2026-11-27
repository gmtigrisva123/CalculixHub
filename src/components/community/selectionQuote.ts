/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Turning a text selection inside a post back into the words that were typed.
 *
 * A reader selects what is on screen, but what is on screen is not what was
 * written: a formula is KaTeX's markup (its symbols twice over, once for the
 * eye and once for assistive technology), and a hint ladder has headings and
 * buttons between its lines. A note that quotes a line has to quote its source.
 */

const text = (node: Node): Element | null => (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);

/**
 * The source text a selection covers, and whether any of it was sealed (taken
 * from an opened hint or from hidden words), in which case the note that
 * quotes it must keep it sealed.
 */
export function quoteFromRange(range: Range): { text: string; sealed: boolean } {
  const whole = range.cloneRange();
  // Half a formula is not a formula: take all of any the selection starts or ends inside.
  const first = text(whole.startContainer)?.closest('.katex');
  if (first) whole.setStartBefore(first);
  const last = text(whole.endContainer)?.closest('.katex');
  if (last) whole.setEndAfter(last);

  const fragment = whole.cloneContents();
  for (const formula of [...fragment.querySelectorAll('.katex')]) {
    const source = formula.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    formula.replaceWith(source ? `$${source}$` : '');
  }
  // The rungs' headings, their "Open" buttons and the hatching over hidden words are furniture, not text.
  for (const control of [...fragment.querySelectorAll('.cm-hint-head, button:not(.cm-tag)')]) control.remove();

  const sealed = Boolean(text(whole.commonAncestorContainer)?.closest('.cm-hint-body, .cm-spoiler.is-open')) || fragment.querySelector('.cm-hint-body, .cm-spoiler.is-open') !== null;
  return { text: (fragment.textContent ?? '').replace(/\s+/g, ' ').trim(), sealed };
}
