/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The three house rules, each with a small drawing that acts it out: two
 * misses and a hit, a clock the server keeps, and a podium only finished
 * matches climb. The drawings loop in CSS; at rest -- reduced motion, or the
 * lobby paused -- each one shows its finished state.
 */

import { m, useReducedMotion } from 'motion/react';
import { spring } from '../../lib/motion';

function AttemptsArt() {
  return (
    <svg className="al-art" viewBox="0 0 150 64">
      {[0, 1, 2].map((i) => (
        <g key={i} className={`al-pip al-pip-${i}`} transform={`translate(${24 + i * 50} 38)`}>
          <circle className="al-pip-ring" r="18" />
          <path className="al-pip-mark" d={i < 2 ? 'M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5' : 'M-7 0.5 L-2 5.5 L7.5 -5'} />
        </g>
      ))}
      <text className="al-pip-points" x="124" y="10">+pts</text>
    </svg>
  );
}

function ClockArt() {
  return (
    <svg className="al-art" viewBox="0 0 150 64">
      <circle className="al-clock-face" cx="32" cy="32" r="26" />
      <circle className="al-clock-sweep" cx="32" cy="32" r="26" pathLength={1} />
      <g className="al-clock-ticks">
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="32" y1="9" x2="32" y2="12.5" transform={`rotate(${i * 30} 32 32)`} />)}
      </g>
      <line className="al-clock-hand" x1="32" y1="32" x2="32" y2="14" />
      <circle className="al-clock-hub" cx="32" cy="32" r="2.6" />
      <line className="al-sync" x1="66" y1="32" x2="106" y2="32" />
      <circle className="al-sync-dot" cx="104" cy="32" r="3" />
      <g className="al-server">
        <rect x="112" y="15" width="32" height="15" rx="4" />
        <rect x="112" y="34" width="32" height="15" rx="4" />
        <circle className="al-server-led" cx="137" cy="22.5" r="2" />
        <circle className="al-server-led is-late" cx="137" cy="41.5" r="2" />
      </g>
    </svg>
  );
}

function PodiumArt() {
  return (
    <svg className="al-art" viewBox="0 0 150 64">
      <rect className="al-bar al-bar-2" x="20" y="31" width="32" height="31" rx="5" />
      <rect className="al-bar al-bar-1" x="59" y="19" width="32" height="43" rx="5" />
      <rect className="al-bar al-bar-3" x="98" y="40" width="32" height="22" rx="5" />
      <path className="al-podium-star" d="M75 1 L76.76 5.57 L81.66 5.84 L77.85 8.93 L79.11 13.66 L75 11 L70.89 13.66 L72.15 8.93 L68.34 5.84 L73.24 5.57 Z" />
      <line className="al-podium-floor" x1="10" y1="62.5" x2="140" y2="62.5" />
    </svg>
  );
}

const RULES = [
  { title: 'Three attempts.', copy: 'A correct answer earns the question’s points. Three misses close it.', Art: AttemptsArt },
  { title: 'Your pace, measured fairly.', copy: 'The timer is enforced on the server. IRT uses your first response only.', Art: ClockArt },
  { title: 'Real people. Real results.', copy: 'Rankings contain finished, saved matches.', Art: PodiumArt },
];

/** One strip, three segments: each rule's drawing sits beside its words. */
export default function ArenaRules() {
  const reduce = useReducedMotion();
  return (
    <footer className="al-rules">
      <div className="al-rules-strip">
        {RULES.map(({ title, copy, Art }, index) => (
          <m.article
            key={title}
            className="al-rule"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...spring.smooth, delay: index * 0.07 }}
          >
            <div className="al-rule-art" aria-hidden="true"><Art /></div>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </m.article>
        ))}
      </div>
    </footer>
  );
}
