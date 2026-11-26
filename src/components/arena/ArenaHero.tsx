/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Arena lobby's opening: the floodlit stage, a line that says what a
 * match is, and the one thing a visitor most wants to know -- what is on, and
 * how long until it opens or closes.
 *
 * Every number here is read off the match board the server already sent and
 * the clock the lobby already keeps. Nothing is fetched, stored or invented;
 * when there is no match to count down to, the card says so plainly.
 */

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, Brain, CalendarClock, DoorOpen, Flag, Ticket, WifiOff } from 'lucide-react';
import type { Arena } from '../../../shared/arena';
import { ease, spring } from '../../lib/motion';
import ArenaStage from './ArenaStage';
import { matchStatus, splitCountdown, spotlightMatch, ticketId, type Spotlight } from './lobbyModel';

interface ArenaHeroProps {
  arenas: Arena[];
  clock: number;
  loaded: boolean;
  catalogError: boolean;
  /** prefers-reduced-motion, resolved once by the lobby. */
  still: boolean;
}

export default function ArenaHero({ arenas, clock, loaded, catalogError, still }: ArenaHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const togglePause = useCallback(() => setPaused((value) => !value), []);

  // The pause covers every loop in the lobby, not only the canvas: the journey
  // and the rule drawings stop with it.
  useEffect(() => {
    const space = heroRef.current?.closest('.arena-space');
    if (!space) return;
    space.toggleAttribute('data-arena-paused', paused);
    return () => space.removeAttribute('data-arena-paused');
  }, [paused]);

  return (
    <m.header
      ref={heroRef}
      className="al-hero"
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <div className="al-hero-grid">
        <div className="al-hero-copy">
          <h1 className="al-title">
            <span className="al-title-line"><TitleLine words={['Timed', 'matches,']} delay={0.12} still={still} /></span>{' '}
            <span className="al-title-line al-title-accent">
              <TitleLine words={['ranked', 'by', 'points.']} delay={0.3} still={still} />
              <svg className="al-underline" viewBox="0 0 320 20" preserveAspectRatio="none" aria-hidden="true">
                <m.path
                  d="M4 14 C 70 5, 170 3, 316 10"
                  initial={still ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.85, duration: 0.9, ease: ease.standard }}
                />
              </svg>
            </span>
          </h1>
          <p className="al-lead">Register for a scheduled match and enter when it opens. Your clock starts when you enter, and the server keeps the time.</p>
        </div>
        <ArenaStage still={still} paused={paused} onTogglePause={togglePause} />
        <div className="al-hero-foot">
          <NextMatch spotlight={spotlightMatch(arenas, clock)} clock={clock} loaded={loaded} catalogError={catalogError} still={still} />
          <Journey />
        </div>
      </div>
    </m.header>
  );
}

/** Words rise out of a clipped line, one after another. */
function TitleLine({ words, delay, still }: { words: string[]; delay: number; still: boolean }) {
  return (
    <span className="al-title-words">
      {words.map((word, i) => (
        <Fragment key={word}>
          {i > 0 && ' '}
          <span className="al-word">
            <m.span initial={still ? false : { y: '110%' }} animate={{ y: '0%' }} transition={{ ...spring.smooth, delay: delay + i * 0.08 }}>
              {word}
            </m.span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function NextMatch({ spotlight, clock, loaded, catalogError, still }: { spotlight: Spotlight | null; clock: number; loaded: boolean; catalogError: boolean; still: boolean }) {
  if (!loaded) {
    return (
      <div className="al-next is-waiting" aria-hidden="true">
        <span className="al-skel is-short" />
        <span className="al-skel is-tall" />
      </div>
    );
  }
  if (catalogError || !spotlight) {
    return (
      <div className="al-next is-quiet">
        {catalogError ? <WifiOff size={20} aria-hidden="true" /> : <CalendarClock size={20} aria-hidden="true" />}
        <div>
          <strong>{catalogError ? 'The schedule is offline.' : 'No match is scheduled.'}</strong>
          <p>{catalogError ? 'Use Refresh on the board below to reconnect.' : 'New matches appear here when they are published.'}</p>
        </div>
      </div>
    );
  }
  const live = spotlight.status === 'Live now';
  const when = new Date(spotlight.target).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className={'al-next' + (live ? ' is-live' : '')}>
      <div className="al-next-head">
        <span className="al-pill">{live && <i className="al-dot" aria-hidden="true" />}{live ? 'Live now' : 'Next up'}</span>
        <strong>{spotlight.arena.title}</strong>
      </div>
      <div className="al-next-row">
        <div>
          <span className="al-next-label">{live ? 'Closes in' : 'Opens in'}</span>
          <Countdown ms={spotlight.target - clock} still={still} />
          <span className="sr-only">{live ? `Closes ${when}` : `Opens ${when}`}</span>
        </div>
        <button type="button" className="al-next-find" onClick={() => findTicket(spotlight.arena.id, still)}>
          Find it on the board <ArrowDown size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Scrolls the board to a match and flashes its ticket. */
function findTicket(arenaId: string, still: boolean) {
  const ticket = document.getElementById(ticketId(arenaId));
  if (!ticket) return;
  ticket.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
  ticket.focus({ preventScroll: true });
  ticket.classList.remove('is-found');
  void ticket.offsetWidth; // restart the flash if it is already running
  ticket.classList.add('is-found');
  window.setTimeout(() => ticket.classList.remove('is-found'), 1800);
}

function Countdown({ ms, still }: { ms: number; still: boolean }) {
  const { days, hours, minutes, seconds } = splitCountdown(ms);
  const units: [string, number, string][] = [['h', hours, 'hrs'], ['m', minutes, 'min'], ['s', seconds, 'sec']];
  if (days) units.unshift(['d', days, days === 1 ? 'day' : 'days']);
  return (
    <span className="al-count" aria-hidden="true">
      {units.map(([key, value, label]) => (
        <span className="al-count-unit" key={key}>
          <span className="al-count-digits">
            {String(value).padStart(2, '0').split('').map((digit, i, all) => <Digit key={all.length - i} digit={digit} still={still} />)}
          </span>
          <small>{label}</small>
        </span>
      ))}
    </span>
  );
}

/** One digit that rolls when it changes, like a stadium scoreboard. Under reduced motion it simply changes. */
function Digit({ digit, still }: { digit: string; still: boolean }) {
  if (still) return <span className="al-digit"><span>{digit}</span></span>;
  return (
    <span className="al-digit">
      <AnimatePresence initial={false}>
        <m.span
          key={digit}
          initial={{ y: '-75%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '75%', opacity: 0 }}
          transition={{ duration: 0.36, ease: ease.standard }}
        >
          {digit}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

const JOURNEY = [
  { label: 'Register', icon: Ticket },
  { label: 'Enter', icon: DoorOpen },
  { label: 'Think', icon: Brain },
  { label: 'Finish', icon: Flag },
] as const;

function Journey() {
  return (
    <ol className="al-journey" aria-label="The steps of a match">
      {JOURNEY.map(({ label, icon: Icon }, i) => (
        <li key={label} style={{ '--i': i } as CSSProperties}>
          <span className="al-journey-icon" aria-hidden="true"><Icon size={15} /></span>
          {label}
        </li>
      ))}
    </ol>
  );
}
