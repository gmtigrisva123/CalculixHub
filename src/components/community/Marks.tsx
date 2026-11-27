/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Margin marks, drawn.
 *
 * Seven pencil marks rather than seven emoji: each is a few hand-set strokes in
 * a 24-unit box, so it takes the colour it is given, stays sharp at any size,
 * and looks like something a reader left beside a proof. What each one means
 * is in `REACTION_META` (model.ts); what each one stores is unchanged.
 */

import type { Reaction } from '../../services/database.types';

const STROKES: Record<Reaction, React.ReactNode> = {
  // A tick: "I follow".
  like: <path d="M4.4 12.9c2 1.6 3.6 3.7 5 6.2C11.9 13.2 15.300 8.500 19.900 4.700" />,
  // The tombstone that ends a proof.
  love: <path d="M6.700 6.100l11.100-.5.500 12.200-11.900.6z" fill="currentColor" />,
  // Therefore.
  care: (
    <>
      <circle cx="12" cy="6.600" r="2.150" fill="currentColor" stroke="none" />
      <circle cx="6.500" cy="16.900" r="2.150" fill="currentColor" stroke="none" />
      <circle cx="17.500" cy="16.900" r="2.150" fill="currentColor" stroke="none" />
    </>
  ),
  // An asterisk, as beside a step worth a footnote.
  haha: <path d="M12.1 4.300c-.1 5-.1 10.200.1 15.400M5.400 8.300c4.300 2.300 8.800 4.800 13.300 7.500M18.700 8.100c-4.500 2.500-8.900 5.100-13.200 7.800" />,
  wow: (
    <>
      <path d="M12.400 3.900c-.3 3.600-.5 7.200-.6 10.700" />
      <circle cx="11.700" cy="19.400" r="1.500" fill="currentColor" stroke="none" />
    </>
  ),
  sad: (
    <>
      <path d="M7.500 8.500c.2-2.800 2.300-4.500 4.800-4.400 2.600.1 4.400 1.900 4.200 4.200-.2 2.700-4.300 3.400-4.400 6.700" />
      <circle cx="12" cy="19.500" r="1.500" fill="currentColor" stroke="none" />
    </>
  ),
  // Not equal: "I get something different here".
  angry: <path d="M5 9.300c4.600-.6 9.300-.7 14-.2M5.100 15.100c4.600-.6 9.200-.6 13.900-.200M15.500 4.500c-2.200 5.100-4.400 10.100-6.700 15.200" />,
};

/** One mark, in the current text colour. Decorative: its label is always printed or announced beside it. */
export function MarkGlyph({ reaction, size = 18, className = '' }: { reaction: Reaction; size?: number; className?: string }) {
  return (
    <svg
      className={`cm-mark is-${reaction} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 16 ? 2.7 : 2.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {STROKES[reaction]}
    </svg>
  );
}
