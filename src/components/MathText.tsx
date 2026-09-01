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
// Recognizes $$...$$, \[...\], \(...\), $...$, and \begin{env}...\end{env} segments
const SEGMENT_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$|\\begin\{([a-z*]+)\}([\s\S]+?)\\end\{\5\}/g;

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

    const [, displayDollar, displayBracket, inlineParen, inlineDollar, envName, envBody] = match;
    if (displayDollar !== undefined) {
      segments.push({ type: 'math', content: displayDollar, display: true });
    } else if (displayBracket !== undefined) {
      segments.push({ type: 'math', content: displayBracket, display: true });
    } else if (inlineParen !== undefined) {
      segments.push({ type: 'math', content: inlineParen, display: false });
    } else if (inlineDollar !== undefined) {
      segments.push({ type: 'math', content: inlineDollar, display: false });
    } else if (envName !== undefined && envBody !== undefined) {
      segments.push({ type: 'math', content: `\\begin{${envName}}${envBody}\\end{${envName}}`, display: true });
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

/** Render basic markdown bold, italic, code, and linebreaks inside text segments */
function renderMarkdownText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Process markdown formatting (**bold**, *italic*, `code`)
    const parts: React.ReactNode[] = [];
    const mdPattern = /(\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = mdPattern.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(line.slice(lastIdx, match.index));
      }

      const [full, , bold, italic, code] = match;
      if (bold !== undefined) {
        parts.push(<strong key={`${lineIdx}-${match.index}`} className="font-bold">{bold}</strong>);
      } else if (italic !== undefined) {
        parts.push(<em key={`${lineIdx}-${match.index}`} className="italic">{italic}</em>);
      } else if (code !== undefined) {
        parts.push(
          <code key={`${lineIdx}-${match.index}`} className="px-1 py-0.5 rounded bg-surface-sunken font-mono text-xs">
            {code}
          </code>
        );
      }

      lastIdx = mdPattern.lastIndex;
    }

    if (lastIdx < line.length) {
      parts.push(line.slice(lastIdx));
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
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
          return <React.Fragment key={idx}>{renderMarkdownText(seg.content)}</React.Fragment>;
        }
        return (
          <span
            key={idx}
            className={seg.display ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5'}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderMath(seg.content, seg.display) }}
          />
        );
      })}
    </Tag>
  );
}
