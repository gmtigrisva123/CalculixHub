/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What to try next: up to two weekly challenges and the next open match,
 * each with the same Join action, disabled state and wording as before.
 * When nothing is scheduled, a drawn route to a flag points to the library.
 */

import type { CSSProperties } from 'react';
import { m } from 'motion/react';
import { ArrowRight, ArrowUpRight, Check, Sparkles, Trophy } from 'lucide-react';
import type { Contest, Level, Topic, WeeklyChallenge } from '../../../shared/types';
import { spring } from '../../lib/motion';

interface NextAdventureProps {
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
  navigate: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
  still: boolean;
}

function opens(date: string): string | null {
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return null;
  const day = new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function due(date: string): string | null {
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return null;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NextAdventure({ weeklyChallenges, contests, onJoinChallenge, onJoinContest, navigate, still }: NextAdventureProps) {
  const open = contests.filter((contest) => contest.status !== 'past');
  const items = weeklyChallenges.slice(0, 2).length + open.slice(0, 1).length;
  const enter = (index: number) => ({
    initial: still ? (false as const) : { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { ...spring.smooth, delay: index * 0.07 },
  });

  return (
    <m.section
      className="dh-card dh-next"
      aria-labelledby="dh-next-title"
      initial={still ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={spring.smooth}
    >
      <div className="dh-section-head">
        <div>
          <h2 id="dh-next-title">Your next adventure</h2>
          <p>A little friendly challenge.</p>
        </div>
        <span className="dh-next-icon" aria-hidden="true">
          <Trophy size={18} />
        </span>
      </div>

      {items > 0 && (
        <ul className="dh-passes">
          {weeklyChallenges.slice(0, 2).map((challenge, index) => (
            <m.li key={challenge.id} className="dh-pass" {...enter(index)}>
              <span className="dh-pass-icon" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <span className="dh-pass-body">
                {due(challenge.dueDate) && <span className="dh-pass-kind">Due {due(challenge.dueDate)}</span>}
                <h3>{challenge.title}</h3>
                <p>{challenge.points} points · Weekly challenge</p>
              </span>
              <button type="button" className="dh-join" disabled={challenge.completed} onClick={() => onJoinChallenge(challenge.id)}>
                {challenge.completed ? (
                  <>
                    <Check size={14} aria-hidden="true" /> Joined
                  </>
                ) : (
                  <>
                    Join <ArrowUpRight size={14} aria-hidden="true" />
                  </>
                )}
              </button>
            </m.li>
          ))}
          {open.slice(0, 1).map((contest, index) => {
            const live = contest.status === 'ongoing';
            const when = opens(contest.date);
            return (
              <m.li key={contest.id} className="dh-pass" data-live={live || undefined} {...enter(weeklyChallenges.slice(0, 2).length + index)}>
                <span className="dh-pass-icon" aria-hidden="true">
                  <Trophy size={17} />
                </span>
                <span className="dh-pass-body">
                  <span className="dh-pass-kind">
                    <i className="dh-pass-dot" aria-hidden="true" />
                    {live ? 'Live now' : when ? `Opens ${when}` : 'Upcoming'}
                  </span>
                  <h3>{contest.title}</h3>
                  <p>
                    {contest.problemCount} problems · {contest.duration}
                  </p>
                </span>
                <button type="button" className="dh-join" disabled={contest.joined} onClick={() => onJoinContest(contest.id)}>
                  {contest.joined ? 'Joined' : 'Join'}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </m.li>
            );
          })}
        </ul>
      )}

      {!weeklyChallenges.length && !open.length && (
        <div className="dh-next-empty">
          <Summit still={still} />
          <div>
            <h3>Set your own pace.</h3>
            <p>While the next challenge takes shape, there’s a whole library to explore.</p>
            <button type="button" className="dh-link" onClick={() => navigate('learn')}>
              Choose a challenge <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <a className="dh-sprint" href="/?preview=ios">
        <span>Have a minute? Try a focus sprint.</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </a>
    </m.section>
  );
}

const ROUTE = 'M14 92 C 40 88, 44 64, 70 62 S 104 44, 118 40 S 150 22, 166 18';
const STOPS: [number, number, string][] = [
  [14, 92, 'alg'],
  [70, 62, 'geo'],
  [118, 40, 'com'],
  [166, 18, 'num'],
];

/** A dotted route climbing through the four domains to a flag. Decorative. */
function Summit({ still }: { still: boolean }) {
  return (
    <svg className="dh-summit" viewBox="0 0 190 104" aria-hidden="true">
      <path className="dh-summit-ground" d="M0 100 L46 72 L74 84 L118 50 L142 62 L176 30 L190 38 L190 104 L0 104 Z" />
      <m.path
        className="dh-summit-route"
        d={ROUTE}
        initial={still ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.32, 0.72, 0, 1] }}
      />
      {STOPS.map(([x, y, key], i) => (
        <m.circle
          key={key}
          className="dh-summit-stop"
          data-topic={key}
          cx={x}
          cy={y}
          r="4.5"
          initial={still ? false : { opacity: 0, scale: 0.3 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ...spring.snappy, delay: 0.25 + i * 0.32 }}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
      <g className="dh-summit-flag" transform="translate(166 18)">
        <line x1="0" y1="0" x2="0" y2="-16" />
        <path className="dh-summit-pennant" d="M0 -16 L13 -11.5 L0 -7 Z" />
      </g>
    </svg>
  );
}
