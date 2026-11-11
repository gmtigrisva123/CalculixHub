/**
 * Everything on the landing page below the first two screens, as one bundle.
 * See chapters.ts for why it is mounted separately from the hero.
 *
 * The nine chapters are not mounted in one go either. Together they are some
 * eighteen screens of markup, and laying all of that out at once holds the
 * browser for the better part of a second. They go in one at a time, top to
 * bottom, each in a moment when the browser is idle, so no single frame waits
 * for more than one chapter. A reader would have to out-scroll the page's
 * first two screens in under two seconds to catch up with it, and if they
 * follow a link to a chapter, the rest are mounted at once (`all`).
 */

import { startTransition, useEffect, useLayoutEffect, useState, type ComponentType } from 'react';
import EngineStory from './EngineStory';
import ChordPlayground from './ChordPlayground';
import TopicsChapter from './TopicsChapter';
import ArchiveLadder from './ArchiveLadder';
import JourneyStack from './JourneyStack';
import DeskSection from './DeskSection';
import PlansSection from './PlansSection';
import FaqSection from './FaqSection';
import FinalStage from './FinalStage';
import { chaptersMounted } from './chapters';
import { whenIdle } from '../../lib/lazy';

export { default as MarginRails } from './MarginRails';

const CHAPTERS: readonly ComponentType<{ onRegister: () => void }>[] = [
  EngineStory, ChordPlayground, TopicsChapter, ArchiveLadder, JourneyStack, DeskSection, PlansSection, FaqSection, FinalStage,
];

interface LandingChaptersProps {
  onRegister: () => void;
  /** Mount every chapter now instead of one per idle moment. */
  all: boolean;
}

export default function LandingChapters({ onRegister, all }: LandingChaptersProps) {
  const [count, setCount] = useState(all ? CHAPTERS.length : 1);
  if (all && count < CHAPTERS.length) setCount(CHAPTERS.length);
  const complete = count >= CHAPTERS.length;

  useEffect(() => {
    if (complete) return;
    return whenIdle(() => startTransition(() => setCount(mounted => Math.min(CHAPTERS.length, mounted + 1))), 400);
  }, [count, complete]);

  useLayoutEffect(() => { if (complete) chaptersMounted(); }, [complete]);

  return (
    <>
      {CHAPTERS.slice(0, count).map((Chapter, index) => <Chapter key={index} onRegister={onRegister} />)}
      {/* Blank paper below the last mounted chapter keeps the footer out of reach until the page is whole. */}
      {!complete && <div className="lx-chapters-hold" aria-hidden="true" />}
    </>
  );
}
