/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import MathText from '../MathText';
import { segmentBlocks, segmentInline } from './model';

/**
 * What a tag does when it is chosen. Provided once by the feed, so every post,
 * comment and preview under it can offer "show me more of this technique"
 * without the handler being threaded through each of them. Without a provider
 * a tag is still set apart, and simply is not a button.
 */
export const TagActionContext = createContext<((tag: string) => void) | null>(null);

/** Running text: KaTeX and light markdown, with mentions, tags and spoilers picked out. */
function Inline({ text }: { text: string }) {
  const segments = useMemo(() => segmentInline(text), [text]);
  const onTag = useContext(TagActionContext);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'mention') {
          return (
            <span key={index} className="cm-mention">
              @{segment.value}
            </span>
          );
        }
        if (segment.type === 'tag') {
          return onTag ? (
            <button key={index} type="button" className="cm-tag" onClick={() => onTag(segment.value)} title={`Show posts tagged #${segment.value}`}>
              #{segment.value}
            </button>
          ) : (
            <span key={index} className="cm-tag">
              #{segment.value}
            </span>
          );
        }
        if (segment.type === 'spoiler') return <Spoiler key={index} text={segment.value} />;
        return <MathText key={index} text={segment.value} />;
      })}
    </>
  );
}

/** `||text||`: struck out with pencil hatching until the reader asks to see it. */
function Spoiler({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      // The button that was pressed is gone; the words it uncovered take the focus it had.
      <span className="cm-spoiler is-open" tabIndex={-1} ref={(node) => node?.focus({ preventScroll: true })}>
        <MathText text={text} />
      </span>
    );
  }
  return (
    <button type="button" className="cm-spoiler" onClick={() => setOpen(true)} aria-label="Hidden text. Show it">
      {/* Width only: the words are not in the page until they are asked for. */}
      <span aria-hidden="true">{' '.repeat(Math.max(4, Math.min(28, Math.round(text.length * 0.9))))}</span>
    </button>
  );
}

/**
 * Post and comment text.
 *
 * Prose is KaTeX and light markdown through MathText, with `@mentions`,
 * `#tags` and `||spoilers||` picked out. `[hint]…[/hint]` blocks become the
 * rungs of a hint ladder: sealed until opened, and opened in order, so a reader
 * takes the smallest nudge that gets them moving instead of the whole answer.
 * Formulas are never split, so markup inside one stays part of the formula.
 */
export default function RichText({ text }: { text: string }) {
  const blocks = useMemo(() => segmentBlocks(text), [text]);
  const [opened, setOpened] = useState(0);
  const justOpened = useRef<HTMLSpanElement | null>(null);

  // Different words are a different ladder: nothing stays open from the last one.
  const [seen, setSeen] = useState(text);
  if (seen !== text) {
    setSeen(text);
    setOpened(0);
  }

  // "Open" disappears when pressed. Focus moves to the hint it opened, so the
  // next Tab carries on from there instead of from the top of the page.
  useEffect(() => {
    if (opened > 0) justOpened.current?.focus({ preventScroll: true });
  }, [opened]);

  if (blocks.length === 1 && blocks[0]!.type === 'prose') return <Inline text={blocks[0]!.value} />;

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'prose') {
          return (
            <span key={index} className="cm-prose-run">
              <Inline text={block.value} />
            </span>
          );
        }
        const isOpen = block.step <= opened;
        const isNext = block.step === opened + 1;
        return (
          <span key={index} className={`cm-hint ${isOpen ? 'is-open' : ''}`} role="group" aria-label={`Hint ${block.step} of ${block.of}`}>
            <span className="cm-hint-head">
              <span className="cm-hint-step" aria-hidden="true">
                {block.step}
              </span>
              <span className="cm-hint-title">
                {block.of > 1 ? `Hint ${block.step} of ${block.of}` : 'Sealed hint'}
              </span>
              {!isOpen &&
                (isNext ? (
                  <button type="button" className="cm-hint-open" onClick={() => setOpened(block.step)}>
                    Open
                  </button>
                ) : (
                  <span className="cm-hint-locked">
                    <LockKeyhole size={13} aria-hidden="true" /> After hint {block.step - 1}
                  </span>
                ))}
            </span>
            {isOpen && (
              <span className="cm-hint-body" tabIndex={-1} ref={block.step === opened ? justOpened : undefined}>
                <Inline text={block.value} />
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
