/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Arena lobby's opening: the floodlit stage, the line that names the
 * place, and the one thing a visitor most wants to know -- what is on, and
 * how long until it opens or closes.
 *
 * Every number here is read off the match board the server already sent and
 * the clock the lobby already keeps. Nothing is fetched, stored or invented;
 * when there is no match to count down to, the card says so plainly.
 */

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, Brain, DoorOpen, Flag, Sparkles, Swords, Ticket, WifiOff } from 'lucide-react';
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

  // The pause covers every loop in the lobby, not only the canvas: the ticker,
  // the journey and the rule drawings all stop with it.
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
          <p className="al-brand"><Swords size={15} aria-hidden="true" /> THE MATHEMATICS ARENA</p>
          <h1 className="al-title">
            <span className="al-title-line"><TitleLine words={['Good', 'minds.']} delay={0.12} still={still} /></span>{' '}
            <span className="al-title-line al-title-accent">
              <TitleLine words={['Great', 'matches.']} delay={0.3} still={still} />
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
          <p className="al-lead">Find your rhythm. Take a seat. Let the ideas do the competing.</p>
        </div>
        <ArenaStage still={still} paused={paused} onTogglePause={togglePause} />
        <div className="al-hero-foot">
          <NextMatch spotlight={spotlightMatch(arenas, clock)} clock={clock} loaded={loaded} catalogError={catalogError} still={still} />
          <Journey />
        </div>
      </div>
      <Ticker arenas={arenas} clock={clock} />
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
        {catalogError ? <WifiOff size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}
        <div>
          <strong>{catalogError ? 'The schedule is offline.' : 'No match on the clock.'}</strong>
          <p>{catalogError ? 'Use Refresh on the board below to reconnect.' : 'New matches appear here the moment they are published.'}</p>
        </div>
      </div>
    );
  }
  const live = spotlight.status === 'Live now';
  const when = new Date(spotlight.target).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className={'al-next' + (live ? ' is-live' : '')}>
      <div className="al-next-head">
        <span className="al-pill"><i className="al-dot" aria-hidden="true" />{live ? 'Live now' : 'Next up'}</span>
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
    <ol className="al-journey" aria-label="Arena journey">
      {JOURNEY.map(({ label, icon: Icon }, i) => (
        <li key={label} style={{ '--i': i } as CSSProperties}>
          <span className="al-journey-icon" aria-hidden="true"><Icon size={15} /></span>
          {label}
        </li>
      ))}
    </ol>
  );
}

const HOUSE_NOTES = ['Three attempts per question', 'Timer kept by the server', 'Worked solutions open when you finish', 'Register · Enter · Think · Finish'];
const MARKS = ['∑', 'π', '∞', '√', '∫', '△'];
const STATUS_CLASS = { 'Live now': 'is-live', Upcoming: 'is-upcoming', Finished: 'is-finished' } as const;

/**
 * The stadium's LED band: every match on the board, then the house rules,
 * scrolling past. Decorative -- the board below carries the same facts for
 * assistive technology -- so it is hidden from it.
 */
function Ticker({ arenas, clock }: { arenas: Arena[]; clock: number }) {
  const notes = [
    ...arenas.map((arena) => ({
      key: arena.id,
      status: matchStatus(arena, clock),
      text: [arena.title, `${arena.duration_minutes} min`, arena.question_count != null ? `${arena.question_count} questions` : ''].filter(Boolean).join(' · '),
    })),
    ...HOUSE_NOTES.map((text) => ({ key: text, status: null, text })),
  ];
  // One run must outlast the widest stage, or the loop shows its seam.
  const runWidth = notes.reduce((total, note) => total + note.text.length * 7.4 + (note.status ? 90 : 0) + 64, 0);
  const repeats = Math.max(1, Math.ceil(1700 / runWidth));
  const run = (copy: number) =>
    Array.from({ length: repeats }, (_, r) =>
      notes.map((note, i) => (
        <span className="al-ticker-item" key={`${copy}-${r}-${note.key}`}>
          {note.status && <b className={'al-ticker-status ' + STATUS_CLASS[note.status]}>{note.status}</b>}
          {note.text}
          <span className="al-ticker-mark">{MARKS[(i + r) % MARKS.length]}</span>
        </span>
      )),
    );
  return (
    <div className="al-ticker" aria-hidden="true">
      <div className="al-ticker-track" style={{ '--al-ticker-time': `${Math.round((runWidth * repeats) / 42)}s` } as CSSProperties}>
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}
