import { startTransition, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import LandingNav from './LandingNav';
import Opening from './Opening';
import LandingFooter from './LandingFooter';
import GroundTones from './GroundTones';
import { afterChapters, onChapterDemand } from './chapters';
import { scrollToTarget, useSmoothScroll } from './smoothScroll';
import { whenIdle } from '../../lib/lazy';
/*
 * Every landing stylesheet is imported here, in this order, including the ones
 * whose markup arrives later with the chapters. The order is the cascade:
 * landing-motion.css is written to come last and win.
 */
import '../../styles/landing-margins.css';
import '../../styles/landing-experience.css';
import '../../styles/landing-frame.css';
import '../../styles/landing-desk.css';
import '../../styles/landing-plans.css';
import '../../styles/landing-motion.css';

type Chapters = typeof import('./LandingChapters');

/*
 * Asked for as soon as this file runs, so the download overlaps the hero's
 * first paint. Having the code is not the same as mounting it: that waits for
 * the hero to land (see chapters.ts).
 */
const chaptersCode: Promise<Chapters | null> = import('./LandingChapters').catch(() => null);

/**
 * How long the hero's entrance is given before the chapters are mounted under
 * it, in ms. The last word lands about a second after the cue; by this point
 * the hero is still, so the work of mounting cannot be seen as a dropped frame.
 */
const AFTER_ENTRANCE = 1350;

interface LandingPageProps {
  liveStats: { registeredUsers: number; testsCompleted: number; problemsSolved: number };
  onSignIn: () => void;
  onRegister: () => void;
}

/**
 * The public front page: a scroll through what CalculixHub is, told with the
 * product's own mathematics.
 *
 * Paper is the ground; ink stages hold the parts that move — the hero's
 * Lorenz butterfly, the engine replaying a real placement, the topics board, and
 * the closing note. Everything sits on one raised sheet that lifts at the end
 * to uncover the footer.
 */
export default function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  const reduce = Boolean(useReducedMotion());
  const contentRef = useRef<HTMLDivElement>(null);
  const [chapters, setChapters] = useState<Chapters | null>(null);
  // Mount every chapter at once (a link to one was followed) rather than one per idle moment.
  const [all, setAll] = useState(false);
  // Every chapter is in the document: the parts that measure them can start.
  const [whole, setWhole] = useState(false);
  useSmoothScroll(!reduce);

  useEffect(() => {
    let live = true;
    let asked = false;
    let cancelIdle = () => {};
    const begin = () => {
      if (asked) return;
      asked = true;
      void chaptersCode.then(code => { if (live && code) startTransition(() => setChapters(code)); });
    };
    const everything = () => { setAll(true); begin(); };
    onChapterDemand(everything);
    void afterChapters().then(() => { if (live) setWhole(true); });

    // A link straight to a chapter (/#plans), or a reader who asked for no
    // motion and so has no entrance to protect: mount everything at once.
    if (window.location.hash.length > 1 || reduce) everything();
    const timer = window.setTimeout(() => { cancelIdle = whenIdle(begin, 600); }, AFTER_ENTRANCE);
    // Any sign of leaving the first screen starts the chapters without waiting for the timer.
    const intents = ['wheel', 'touchstart', 'keydown'] as const;
    for (const type of intents) window.addEventListener(type, begin, { passive: true, once: true });

    return () => {
      live = false;
      window.clearTimeout(timer);
      cancelIdle();
      for (const type of intents) window.removeEventListener(type, begin);
      onChapterDemand(null);
    };
  }, [reduce]);

  // Arriving with a section in the URL (/#plans) lands on it once the page exists.
  useEffect(() => {
    if (!whole) return;
    const id = window.location.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) requestAnimationFrame(() => scrollToTarget(target, { immediate: true }));
  }, [whole]);

  const Rails = whole ? chapters?.MarginRails : undefined;
  const Rest = chapters?.default;

  return (
    <div className="lx">
      <a className="lx-skip" href="#idea">Skip to the content</a>
      <LandingNav onSignIn={onSignIn} onRegister={onRegister} chapters={whole} />
      <div className="lx-content" ref={contentRef}>
        <GroundTones />
        {Rails && <Rails />}
        <main className="lx-main">
          <Opening onRegister={onRegister} />
          {/* Until the chapters are in, a stretch of blank paper keeps the footer out of reach. */}
          {Rest ? <Rest onRegister={onRegister} all={all} /> : <div className="lx-chapters-hold" aria-hidden="true" />}
        </main>
      </div>
      <LandingFooter contentRef={contentRef} />
    </div>
  );
}
