/**
 * The footer, uncovered rather than scrolled to.
 *
 * The page's content sits on a raised sheet; the footer waits underneath it,
 * pinned to the bottom of the screen, and the sheet's lower edge lifts away to
 * reveal it. As it is uncovered the wordmark rises letter by letter. The
 * reveal is driven by how far the sheet has lifted, never by an observer — the
 * footer is technically on screen the whole time, behind everything.
 */

import type { RefObject } from 'react';
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { Arrow, BrandMark } from './kit';
import { scrollToTarget } from './smoothScroll';

const WORD = 'calculixhub';

interface LandingFooterProps {
  contentRef: RefObject<HTMLDivElement | null>;
  onSignIn: () => void;
  onRegister: () => void;
}

export default function LandingFooter({ contentRef, onSignIn, onRegister }: LandingFooterProps) {
  const reduce = Boolean(useReducedMotion());
  // 0 when the sheet's bottom edge reaches the bottom of the screen, 1 when it has cleared the top.
  const { scrollYProgress: lift } = useScroll({ target: contentRef, offset: ['end end', 'end start'] });
  const drift = useTransform(lift, [0, 0.8], ['-18%', '0%']);

  return (
    <footer className="lx-footer" data-tone="ink">
      <m.div className="lx-footer-inner" style={reduce ? undefined : { y: drift }}>
        <div className="lx-footer-top lx-wrap">
          <div className="lx-footer-lede">
            <BrandMark />
            <p>Keep a little room for a good question.</p>
          </div>
          <nav className="lx-footer-links" aria-label="Footer">
            <div>
              <h2>Begin</h2>
              <button type="button" onClick={onRegister}>Create a free account</button>
              <button type="button" onClick={onSignIn}>Sign in</button>
              <a href="/?preview=ios">The iPhone experience <Arrow size={13} /></a>
            </div>
            <div>
              <h2>Explore</h2>
              <a href="/?auth=signup&tab=learn">Practice</a>
              <a href="/?auth=signup&tab=archive">Exam archive</a>
              <a href="/?auth=signup&tab=compete">Arena</a>
              <a href="/?auth=signup&tab=community">Community</a>
            </div>
          </nav>
        </div>

        <p className="lx-wordmark">
          <span className="sr-only">CalculixHub</span>
          {WORD.split('').map((letter, index) => (
            <Letter key={index} letter={letter} index={index} lift={lift} still={reduce} />
          ))}
          <Letter letter="." index={WORD.length} lift={lift} still={reduce} dot />
        </p>

        <div className="lx-footer-bottom lx-wrap">
          <span>Made for the working-it-out part.</span>
          <button type="button" className="lx-top" onClick={() => scrollToTarget(0)}>
            Back to the question <Arrow direction="up" size={13} />
          </button>
          <span>© {new Date().getFullYear()} CalculixHub</span>
        </div>
      </m.div>
    </footer>
  );
}

function Letter({ letter, index, lift, still, dot = false }: { letter: string; index: number; lift: MotionValue<number>; still: boolean; dot?: boolean }) {
  const start = 0.18 + index * 0.025;
  const y = useTransform(lift, [start, start + 0.32], ['105%', '0%']);
  return (
    <span className={dot ? 'lx-letter is-dot' : index >= 8 ? 'lx-letter is-light' : 'lx-letter'} aria-hidden="true">
      <m.span style={still ? undefined : { y }}>{letter}</m.span>
    </span>
  );
}
