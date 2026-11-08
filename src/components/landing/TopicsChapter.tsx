/**
 * "Topics": four rooms, one problem in each, and a chalkboard to think on.
 *
 * Instead of describing the four topics, the chapter lets a visitor stand in
 * each. Every room has a chalk drawing of a real contest problem (TopicBoards)
 * and the problem itself, pinned beside it on a slip of paper with its real
 * answer choices. Pick one: a wrong choice is struck out and the room says so
 * kindly, a right one circles itself and explains the idea in a line. A nudge
 * is there for anyone who wants it. Nothing here needs an account — the point
 * is that the first taste of the product costs nothing.
 *
 * The rooms are staggered rather than gridded, the lettering is a hand, and
 * the stage ends on a chalk ledge. All of it is still one honest row of four
 * links into the product.
 */

import { useState } from 'react';
import { AnimatePresence, m, useAnimationControls, useReducedMotion } from 'motion/react';
import MathText from '../MathText';
import { TOPIC_ROOMS, type TopicRoom } from './topicRooms';
import { ChalkFilter, TOPIC_BOARDS } from './TopicBoards';
import { Arrow, Eyebrow, GLIDE, Magnetic, Rise, SplitText, useSpotlight } from './kit';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Faint remains of what was rubbed out before the lesson, as on any real board. */
const GHOSTS = [
  { text: 'a² + b² = c²', x: '3%', y: '16%', turn: -7, size: 30 },
  { text: 'e^{iπ} + 1 = 0', x: '63%', y: '5%', turn: 4, size: 28 },
  { text: '∑ 1/n² = π²/6', x: '71%', y: '51%', turn: -3, size: 26 },
  { text: 'n! ≡ ?', x: '1%', y: '58%', turn: 5, size: 30 },
  { text: '(n choose k)', x: '40%', y: '91%', turn: -2, size: 26 },
  { text: '∠ABC = 90°', x: '84%', y: '88%', turn: 6, size: 26 },
];

export default function TopicsChapter({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="lx-topics" id="topics" aria-labelledby="lx-topics-title">
      <ChalkFilter />
      <div className="lx-topics-stage" data-tone="ink">
        <div className="lx-topics-ghosts" aria-hidden="true">
          {GHOSTS.map(ghost => (
            <span key={ghost.text} style={{ left: ghost.x, top: ghost.y, fontSize: ghost.size, rotate: `${ghost.turn}deg` }}>{ghost.text}</span>
          ))}
        </div>

        <header className="lx-topics-head lx-wrap">
          <div>
            <Eyebrow index="04">Topics</Eyebrow>
            <SplitText as="h2" id="lx-topics-title" className="lx-h2" text={'Four kinds of problem.\n*Which one is yours?*'} />
          </div>
          <div className="lx-topics-intro">
            <Rise as="p" className="lx-lead" delay={0.1}>
              Every contest problem lives in one of four rooms. Walk into each, have a go at a real one from the archive, and see which feels like home.
            </Rise>
            <Rise delay={0.2}>
              <p className="lx-topics-aside">
                <svg viewBox="0 0 70 54" fill="none" aria-hidden="true">
                  <path d="M6 6C8 30 30 44 60 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M50 38L61 46L49 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>no sign-up, no timer — just have a go</span>
              </p>
            </Rise>
          </div>
        </header>

        <div className="lx-wrap lx-topics-grid">
          {TOPIC_ROOMS.map((room, index) => <TopicRoomCard key={room.topic} room={room} index={index} />)}
        </div>

        <div className="lx-wrap lx-topics-foot">
          <Rise>
            <p className="lx-topics-foot-note">Can&rsquo;t pick one?</p>
            <p className="lx-topics-foot-line">Good. Start with a short placement, and we&rsquo;ll find your level in each room for you.</p>
          </Rise>
          <Rise delay={0.1}>
            <Magnetic>
              <button type="button" className="lx-btn lx-btn-cream" onClick={onRegister}>
                <span>Find your level</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </button>
            </Magnetic>
          </Rise>
        </div>

        <ChalkLedge />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// One room
// ---------------------------------------------------------------------------

function TopicRoomCard({ room, index }: { room: TopicRoom; index: number }) {
  const id = `topic-${index + 1}`;
  const Board = TOPIC_BOARDS[index];
  const spot = useSpotlight<HTMLElement>();
  const reduce = Boolean(useReducedMotion());
  const shake = useAnimationControls();
  const [struck, setStruck] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [nudge, setNudge] = useState(false);
  const { problem } = room;

  const choose = (choice: number) => {
    if (solved || struck.includes(choice)) return;
    if (choice === problem.answer) {
      setSolved(true);
      return;
    }
    setStruck(list => [...list, choice]);
    if (!reduce) void shake.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.42, ease: 'easeOut' } });
  };

  const status = solved
    ? 'Yes — that’s it.'
    : struck.length === 0
      ? ''
      : struck.length >= problem.options.length - 1
        ? 'Only one left…'
        : 'Not quite — have another go.';

  return (
    <article ref={spot} className="lx-topic" id={id} aria-labelledby={`${id}-title`} data-topic={index + 1} data-solved={solved || undefined}>
      <Rise className="lx-topic-inner" y={44} amount={0.2} blur={false}>
        <header className="lx-topic-head">
          <span className="lx-topic-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="lx-topic-symbol" aria-hidden="true">{room.symbol}</span>
        </header>
        <h3 id={`${id}-title`} className="lx-topic-title">{room.topic}</h3>
        <p className="lx-topic-feel">{room.feel}</p>

        <div className="lx-topic-board">
          <Board />
        </div>

        <m.div className="lx-slip" data-tone="paper" animate={shake}>
          <span className="lx-slip-tape" aria-hidden="true" />
          <p className="lx-slip-ref">{problem.ref}</p>
          <MathText className="lx-slip-prompt" text={problem.prompt} />

          <div className="lx-opts" role="group" aria-label="Answer choices">
            {problem.options.map((option, choice) => {
              const wrong = struck.includes(choice);
              const right = solved && choice === problem.answer;
              return (
                <button
                  key={option}
                  type="button"
                  className="lx-opt"
                  data-state={right ? 'right' : wrong ? 'wrong' : undefined}
                  aria-disabled={solved || wrong || undefined}
                  onClick={() => choose(choice)}
                >
                  <span className="lx-opt-letter" aria-hidden="true">{LETTERS[choice]}</span>
                  <MathText className="lx-opt-text" text={option} />
                </button>
              );
            })}
          </div>

          <div className="lx-slip-note" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {solved ? (
                <m.div key="solved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: GLIDE }}>
                  <p className="lx-slip-pencil is-right">{status}</p>
                  <MathText className="lx-slip-reason" text={room.reason} />
                </m.div>
              ) : (
                <m.div key={`open-${struck.length}-${nudge}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                  {status && <p className="lx-slip-pencil">{status}</p>}
                  {nudge
                    ? <MathText className="lx-slip-hint" text={room.hint} />
                    : <button type="button" className="lx-slip-nudge" onClick={() => setNudge(true)}>Need a nudge?</button>}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </m.div>

        <footer className="lx-topic-foot">
          <p className="lx-topic-covers">{room.covers}</p>
          <a className="lx-topic-go" href={`/?auth=signup&tab=learn&topic=${encodeURIComponent(room.topic)}`}>
            <span>{solved ? `More ${room.topic.toLowerCase()}` : `Start with ${room.topic.toLowerCase()}`}</span>
            <span className="lx-topic-go-icon" aria-hidden="true"><Arrow size={14} /></span>
          </a>
        </footer>
      </Rise>
    </article>
  );
}

// ---------------------------------------------------------------------------
// The ledge the chalk sits on
// ---------------------------------------------------------------------------

function ChalkLedge() {
  return (
    <div className="lx-ledge" aria-hidden="true">
      <span className="lx-chalk-piece is-1" />
      <span className="lx-chalk-piece is-2" />
      <span className="lx-chalk-piece is-3" />
      <span className="lx-chalk-piece is-stub" />
      <span className="lx-eraser" />
      <span className="lx-chalk-smudge" />
    </div>
  );
}
