import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { ARCHIVE_SAMPLES } from './archiveSamples';
import { PAPER_BANK } from './paperBank';
import { bindPunctuation } from './tex';

describe('binding punctuation to the formula before it', () => {
  it('moves a mark that follows an inline formula inside it', () => {
    expect(bindPunctuation('What is $x$?')).toBe('What is $x?$');
    expect(bindPunctuation('so $x=5$, $y=-3$.')).toBe('so $x=5,$ $y=-3.$');
    expect(bindPunctuation('primes \\((p, q)\\), both odd')).toBe('primes \\((p, q),\\) both odd');
  });

  it('leaves everything else exactly as it was', () => {
    // Plain text, a formula with no mark after it, and displayed formulas, which stand on their own line.
    for (const text of ['No maths here.', 'Let $x$ be real', '$$ x^2 $$. Then', 'a \\[ b \\], c']) {
      expect(bindPunctuation(text)).toBe(text);
    }
  });

  it('pairs delimiters the way the typesetter does, never across two formulas', () => {
    // The text between two formulas is not itself a formula, whatever it is followed by.
    expect(bindPunctuation('$a$ then $.5$')).toBe('$a$ then $.5$');
    expect(bindPunctuation('$a$, then $b$; then $c$')).toBe('$a,$ then $b;$ then $c$');
  });

  it('changes no letter of any problem on the page, and still typesets', () => {
    const letters = (text: string) => text.replace(/[\s.,;:?!]/g, '');
    const texts = [...PAPER_BANK.flatMap(item => [item.question, ...item.options, item.hint, item.reason]), ...ARCHIVE_SAMPLES.map(sample => sample.prompt)];
    for (const text of texts) {
      const bound = bindPunctuation(text);
      expect(bound).toHaveLength(text.length);
      expect(letters(bound)).toBe(letters(text));
      for (const match of bound.matchAll(/\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g)) {
        expect(() => katex.renderToString(match[1] ?? match[2], { throwOnError: true, strict: 'ignore' }), text).not.toThrow();
      }
    }
  });
});
