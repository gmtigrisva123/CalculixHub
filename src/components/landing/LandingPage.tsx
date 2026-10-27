import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import LandingNav from './LandingNav';
import Opening from './Opening';
import EngineStory from './EngineStory';
import ChordPlayground from './ChordPlayground';
import WorldsChapter from './WorldsChapter';
import ArchiveLadder from './ArchiveLadder';
import JourneyStack from './JourneyStack';
import PlansSection from './PlansSection';
import FaqSection from './FaqSection';
import FinalStage from './FinalStage';
import LandingFooter from './LandingFooter';
import { scrollToTarget, useSmoothScroll } from './smoothScroll';
import '../../styles/landing-experience.css';

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
 * Möbius strip, the engine replaying a real placement, the four worlds, and
 * the closing note. Everything sits on one raised sheet that lifts at the end
 * to uncover the footer.
 */
export default function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  const reduce = Boolean(useReducedMotion());
  const contentRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(!reduce);

  // Arriving with a section in the URL (/#plans) lands on it once the page exists.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) requestAnimationFrame(() => scrollToTarget(target, { immediate: true }));
  }, []);

  return (
    <div className="lx">
      <a className="lx-skip" href="#idea">Skip to the content</a>
      <LandingNav onSignIn={onSignIn} onRegister={onRegister} />
      <div className="lx-content" ref={contentRef}>
        <main className="lx-main">
          <Opening onRegister={onRegister} />
          <EngineStory onRegister={onRegister} />
          <ChordPlayground />
          <WorldsChapter />
          <ArchiveLadder />
          <JourneyStack onRegister={onRegister} />
          <PlansSection onRegister={onRegister} />
          <FaqSection />
          <FinalStage onRegister={onRegister} />
        </main>
      </div>
      <LandingFooter contentRef={contentRef} onSignIn={onSignIn} onRegister={onRegister} />
    </div>
  );
}
