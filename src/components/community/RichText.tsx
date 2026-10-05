/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import MathText from '../MathText';
import { segmentMentions } from './model';

/**
 * Post and comment text: KaTeX and light markdown through MathText, with
 * `@username` mentions picked out. Formulas are never split, so an `@` inside
 * one stays part of the formula.
 */
export default function RichText({ text }: { text: string }) {
  const segments = useMemo(() => segmentMentions(text), [text]);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span key={index} className="cm-mention">
            @{segment.value}
          </span>
        ) : (
          <MathText key={index} text={segment.value} />
        ),
      )}
    </>
  );
}
