/**
 * The footer, uncovered rather than scrolled to.
 *
 * The page's content sits on a raised sheet; the footer waits underneath it,
 * pinned to the bottom of the screen, and the sheet's lower edge lifts away to
 * reveal it, catching the light with a slight curl as it goes (drawn by the
 * WebGL stage; see sceneFinal.ts). As it is uncovered the wordmark rises letter by letter. The
 * reveal is driven by how far the sheet has lifted, never by an observer — the
 * footer is technically on screen the whole time, behind everything.
 */

import type { RefObject } from 'react';
import { m, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { useStageScroll } from './stageLayout';
import { Arrow, BrandMark } from './kit';
import { scrollToTarget } from './smoothScroll';

const WORD = 'calculixhub';

interface LandingFooterProps {
  contentRef: RefObject<HTMLDivElement | null>;
}

export default function LandingFooter({ contentRef }: LandingFooterProps) {
  const reduce = Boolean(useReducedMotion());
  // 0 when the sheet's bottom edge reaches the bottom of the screen, 1 when it has cleared the top.
  // On the page clock, so the wordmark and the stage's curl of the sheet's edge (sceneFinal.ts) read one value.
  const lift = useStageScroll(contentRef, ['end end', 'end start']);
  const drift = useTransform(lift, [0, 0.35], ['-18%', '0%']);

  return (
    <footer className="lx-footer" data-tone="ink">
      <m.div className="lx-footer-inner" style={reduce ? undefined : { y: drift }}>
        <div className="lx-footer-top lx-wrap">
          <div className="lx-footer-lede">
            <BrandMark />
            <p>Competition mathematics practice, AMC to IMO.</p>
          </div>
        </div>

        <p className="lx-wordmark">
          <span className="sr-only">CalculixHub</span>
          {WORD.split('').map((letter, index) => (
            <Letter key={index} letter={letter} index={index} lift={lift} still={reduce} />
          ))}
          <Letter letter="." index={WORD.length} lift={lift} still={reduce} dot />
        </p>

        <div className="lx-footer-bottom lx-wrap">
          <a className="lx-top" href="/?preview=ios">iPhone preview <Arrow size={13} /></a>
          <a className="lx-top" href="/?preview=mac">MacBook preview <Arrow size={13} /></a>
          <button type="button" className="lx-top" onClick={() => scrollToTarget(0)}>
            Back to top <Arrow direction="up" size={13} />
          </button>
        </div>
      </m.div>
    </footer>
  );
}

function Letter({ letter, index, lift, still, dot = false }: { letter: string; index: number; lift: MotionValue<number>; still: boolean; dot?: boolean }) {
  // Timed to finish well inside the footer's own height: on a phone the footer is shorter than the
  // screen, so the lift never gets far, and a slower rise left the wordmark stuck half-way up.
  const start = 0.04 + index * 0.012;
  const y = useTransform(lift, [start, start + 0.2], ['105%', '0%']);
  return (
    <span className={dot ? 'lx-letter is-dot' : index >= 8 ? 'lx-letter is-light' : 'lx-letter'} aria-hidden="true">
      <m.span style={still ? undefined : { y }}>{letter}</m.span>
    </span>
  );
}
