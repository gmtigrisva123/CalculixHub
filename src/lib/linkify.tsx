/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/** A URL with the sentence punctuation that usually trails it removed. */
function trimUrl(raw: string): { url: string; trailing: string } {
  const match = /[.,;:!?)\]]+$/.exec(raw);
  return match ? { url: raw.slice(0, match.index), trailing: match[0] } : { url: raw, trailing: '' };
}

export type LinkSegment = { type: 'text'; value: string } | { type: 'link'; value: string };

export function linkSegments(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const { url, trailing } = trimUrl(match[0]);
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: 'text', value: text.slice(last, start) });
    segments.push({ type: 'link', value: url });
    if (trailing) segments.push({ type: 'text', value: trailing });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

/**
 * Plain text with its web addresses made clickable. Links back into this app
 * open in place; anything else opens in a new tab without handing it a
 * reference to this window.
 */
export function Linkified({ text }: { text: string }) {
  const here = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    <>
      {linkSegments(text).map((segment, index) => {
        if (segment.type === 'text') return <React.Fragment key={index}>{segment.value}</React.Fragment>;
        const internal = Boolean(here) && segment.value.startsWith(here);
        return (
          <a key={index} href={segment.value} {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
            {segment.value}
          </a>
        );
      })}
    </>
  );
}
