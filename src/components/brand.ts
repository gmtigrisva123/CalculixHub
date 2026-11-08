/**
 * The CalculixHub mark: a lowercase "e" drawn in one pencilled stroke, with a
 * round point at the end of the crossbar. It is the only logo the product has.
 *
 * This geometry is the single source in code. Everything that draws the mark —
 * the sidebar, the sign-in screens, the landing page, the printed report — reads
 * it from here, and `brand.test.ts` checks that `public/favicon.svg` (and so the
 * generated app icons, the favicon.ico and the link-preview card) draws exactly
 * the same shape. To change the logo, change it here and in favicon.svg, then
 * run `python3 scripts/generate-icons.py`.
 */

/** The open curve of the "e" and its crossbar, in a 40 × 40 box. */
export const MARK_PATH = 'M30 9C11 2 2 27 18 32c7 3 15-3 15-10M7 23 32 12';
/** The round point the crossbar is heading for. */
export const MARK_DOT = { cx: 31, cy: 12, r: 3 } as const;
export const MARK_STROKE = 2.5;
export const MARK_VIEWBOX = '0 0 40 40';
