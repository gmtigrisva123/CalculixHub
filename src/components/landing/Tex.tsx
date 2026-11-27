/**
 * Text that may hold formulas, as the landing page sets it: by the product's
 * own typesetter (MathText), with each formula's punctuation bound to it so a
 * line never opens with a stray full stop (see tex.ts).
 *
 * Kept out of kit.tsx on purpose. The typesetter is most of the page's code,
 * and the first screen's own chunk must not have to bring it along.
 */

import type { ElementType } from 'react';
import MathText from '../MathText';
import { bindPunctuation } from './tex';

export default function Tex({ text, className, as }: { text: string; className?: string; as?: ElementType }) {
  return <MathText text={bindPunctuation(text)} className={className} as={as} />;
}
