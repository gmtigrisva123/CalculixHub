/**
 * Formulas for the static reading version, typeset at build time as MathML.
 *
 * The reading version (LandingReading.tsx) is rendered once, in Node, into
 * dist/index.html, for visitors without JavaScript and for crawlers that do
 * not run it. Each formula is written by KaTeX as MathML only: every current
 * browser renders MathML natively, so the page needs neither KaTeX's script
 * nor its stylesheet and fonts, and the markup is a fraction of the size of
 * KaTeX's HTML output. The text is split exactly as the live page splits it,
 * with MathText's own parser; what lies between the formulas stays plain text.
 *
 * Build time only: nothing here ships to the browser.
 */

import { Fragment } from 'react';
import katex from 'katex';
import { parseSegments } from '../../MathText';

/**
 * KaTeX wraps its <math> in <span class="katex">, which the app's KaTeX
 * stylesheet sizes and sets in KaTeX's own fonts. The reading version keeps
 * only the MathML, which the browser sets in its math font.
 */
const KATEX_WRAPPER = /^<span class="katex">(<math[\s\S]*<\/math>)<\/span>$/;

function mathml(expr: string, displayMode: boolean): string {
  // `strict: 'ignore'` as in MathText, so the build typesets what the live page does, without warnings.
  const html = katex.renderToString(expr, { output: 'mathml', throwOnError: false, displayMode, strict: 'ignore' });
  return KATEX_WRAPPER.exec(html)?.[1] ?? html;
}

/** A line of copy with its formulas typeset: `$…$`, `\(…\)`, `$$…$$`, `\[…\]` and environments, as MathText reads them. */
export default function ReadingMath({ text }: { text: string }) {
  return (
    <>
      {parseSegments(text).map((segment, index) => segment.type === 'text'
        ? <Fragment key={index}>{segment.content}</Fragment>
        // KaTeX's own markup for a formula written in this repository, never user input.
        : <span key={index} dangerouslySetInnerHTML={{ __html: mathml(segment.content, segment.display) }} />)}
    </>
  );
}
