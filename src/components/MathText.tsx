/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import katex from 'katex';

// Recognizes $$...$$, \[...\], \(...\) and $...$ segments inside otherwise
// plain text and renders the math parts with real KaTeX instead of showing
// raw backslash-escaped source. Plain-text segments stay as normal React
// text nodes (escaped by React), only the KaTeX-generated markup for the
// matched math segments is trusted HTML, so this is safe to use on
// user-submitted community content as well as seeded problem content.
const SEGMENT_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

interface Segment {
  type: 'text' | 'math';
  content: string;
  display: boolean;
}

function parseSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SEGMENT_PATTERN.lastIndex = 0;
  while ((match = SEGMENT_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: source.slice(lastIndex, match.index), display: false });
    }

    const [, displayDollar, displayBracket, inlineParen, inlineDollar] = match;
    if (displayDollar !== undefined) {
      segments.push({ type: 'math', content: displayDollar, display: true });
    } else if (displayBracket !== undefined) {
      segments.push({ type: 'math', content: displayBracket, display: true });
    } else if (inlineParen !== undefined) {
      segments.push({ type: 'math', content: inlineParen, display: false });
    } else if (inlineDollar !== undefined) {
      segments.push({ type: 'math', content: inlineDollar, display: false });
    }

    lastIndex = SEGMENT_PATTERN.lastIndex;
  }

  if (lastIndex < source.length) {
    segments.push({ type: 'text', content: source.slice(lastIndex), display: false });
  }

  return segments;
}

function renderMath(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode: display,
      strict: 'ignore',
    });
  } catch {
    return expr;
  }
}

interface MathTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
}

export default function MathText({ text, className, as: Tag = 'span' }: MathTextProps) {
  const segments = useMemo(() => parseSegments(text ?? ''), [text]);

  return (
    <Tag className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <React.Fragment key={idx}>
              {seg.content.split('\n').map((line, lineIdx, arr) => (
                <React.Fragment key={lineIdx}>
                  {line}
                  {lineIdx < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }
        return (
          <span
            key={idx}
            className={seg.display ? 'block my-2 overflow-x-auto' : undefined}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderMath(seg.content, seg.display) }}
          />
        );
      })}
    </Tag>
  );
}
