/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The dashboard's opening: the question that starts every session, the one
 * action that answers it, and the drawing machine beside them.
 */

import { Fragment } from 'react';
import { m } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { ease, spring } from '../../lib/motion';
import EpicycleStage from './EpicycleStage';

interface DashboardHeroProps {
  still: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onBegin: () => void;
}

export default function DashboardHero({ still, paused, onTogglePause, onBegin }: DashboardHeroProps) {
  return (
    <m.section
      className="dh-hero"
      aria-labelledby="dh-hero-title"
      initial={still ? false : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring.gentle, delay: 0.05 }}
    >
      <div className="dh-hero-copy">
        <p className="dh-hero-chip">
          <i className="dh-live-dot" aria-hidden="true" />
          Where would you like to begin?
        </p>
        <h2 id="dh-hero-title" className="dh-hero-title">
          <span className="dh-line">
            <Words words={['One', 'question.']} delay={0.16} still={still} />
          </span>{' '}
          <span className="dh-line dh-line-accent">
            <Words words={['Your', 'own', 'way']} delay={0.32} still={still} />{' '}
            <span className="dh-underlined">
              <Words words={['through.']} delay={0.53} still={still} />
              <svg className="dh-underline" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <m.path
                  d="M4 13 C 52 5, 128 3, 196 9"
                  initial={still ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1, duration: 0.8, ease: ease.standard }}
                />
              </svg>
            </span>
          </span>
        </h2>
        <m.p
          className="dh-hero-lead"
          initial={still ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: 0.62 }}
        >
          No need to rush the answer. Give yourself a little room to work it out.
        </m.p>
        <m.div
          className="dh-hero-actions"
          initial={still ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: 0.74 }}
        >
          <m.button type="button" className="dh-cta" onClick={onBegin} whileTap={{ scale: 0.97 }} transition={spring.press}>
            Open my practice
            <span className="dh-cta-arrow" aria-hidden="true">
              <ArrowUpRight size={18} />
            </span>
          </m.button>
        </m.div>
      </div>
      <EpicycleStage still={still} paused={paused} onTogglePause={onTogglePause} />
    </m.section>
  );
}

/** Words rise one after another out of a clipped line. */
function Words({ words, delay, still }: { words: string[]; delay: number; still: boolean }) {
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={word}>
          {i > 0 && ' '}
          <span className="dh-word">
            <m.span
              initial={still ? false : { y: '108%' }}
              animate={{ y: '0%' }}
              transition={{ ...spring.smooth, delay: delay + i * 0.07 }}
            >
              {word}
            </m.span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
