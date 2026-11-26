/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The dashboard's opening: the one thing to do next, said from the learner's
 * own numbers, and the drawing machine beside it.
 *
 * With some practice behind them, a learner is pointed at the topic they have
 * done least of, with the figures that say so. Before any, there is nothing to
 * compare, and the hero says to start with one problem.
 */

import { Fragment } from 'react';
import { m } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { Topic } from '../../../shared/types';
import { ease, spring } from '../../lib/motion';
import { formatLike, type Focus } from './dashboardModel';
import EpicycleStage from './EpicycleStage';

interface DashboardHeroProps {
  still: boolean;
  paused: boolean;
  /** Where to practise next, or null before any practice. */
  focus: Focus | null;
  onTogglePause: () => void;
  onBegin: (topic?: Topic) => void;
}

const percent = (value: number) => `${formatLike(value, value)}%`;

export default function DashboardHero({ still, paused, focus, onTogglePause, onBegin }: DashboardHeroProps) {
  const lead = !focus
    ? 'Your first answers set your level in each of the four topics, so what comes after is neither too easy nor out of reach.'
    : focus.ahead
      ? `It is where you have practised least: ${percent(focus.mastery)} mastery, against ${percent(focus.ahead.mastery)} in ${focus.ahead.topic}.`
      : `Your four topics stand level at ${percent(focus.mastery)}. This one comes first.`;
  const accent = focus ? focus.topic.split(' ') : ['one', 'problem'];

  return (
    <m.section
      className="dh-hero"
      aria-labelledby="dh-hero-title"
      initial={still ? false : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring.gentle, delay: 0.05 }}
    >
      <div className="dh-hero-copy">
        <h2 id="dh-hero-title" className="dh-hero-title">
          <span className="dh-line">
            <Words words={focus ? ['Next:'] : ['Start', 'with']} delay={0.16} still={still} />
          </span>{' '}
          <span className="dh-line dh-line-accent">
            <span className="dh-underlined">
              <Words words={accent.map((word, i) => (i === accent.length - 1 ? `${word}.` : word))} delay={0.32} still={still} />
              <svg className="dh-underline" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <m.path
                  d="M4 13 C 52 5, 128 3, 196 9"
                  initial={still ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: 0.8, ease: ease.standard }}
                />
              </svg>
            </span>
          </span>
        </h2>
        <m.p
          className="dh-hero-lead"
          initial={still ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: 0.5 }}
        >
          {lead}
        </m.p>
        <m.div
          className="dh-hero-actions"
          initial={still ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: 0.62 }}
        >
          <m.button type="button" className="dh-cta" onClick={() => onBegin(focus?.topic)} whileTap={{ scale: 0.97 }} transition={spring.press}>
            {focus ? `Practise ${focus.topic}` : 'Open practice'}
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
        <Fragment key={`${word}-${i}`}>
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
