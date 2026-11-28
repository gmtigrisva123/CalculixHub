/**
 * "Topics": four topics, one problem in each, and a chalkboard to think on.
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
 *
 * With the WebGL stage drawing (sceneTopics.ts), the thread arrives here as
 * chalk dust that settles on the board, and each room's symbol is a 3D
 * chalk glyph that answers the reader: it shudders and puffs dust at a wrong
 * choice, and draws a chalk ring round itself at a right one while the dust
 * swirls into the explanation. Each choice is told to the stage on the
 * thread bus. The type symbol underneath is the drawing without WebGL, and
 * it answers too: a small shake, and a ring drawn in the room's colour.
 */

import { useRef, useState } from 'react';
import { AnimatePresence, m, useAnimationControls, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import MathText from '../MathText';
import { TOPIC_ROOMS, ringPath, type TopicRoom } from './topicRooms';
import { ChalkFilter, TOPIC_BOARDS } from './TopicBoards';
import { Arrow, GLIDE, Magnetic, Rise, SplitText, useSpotlight } from './kit';
import { useStageScroll } from './stageLayout';
import { emitThread } from './threadBus';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Faint remains of what was rubbed out before the lesson, as on any real
 * board, at three depths: the far ones rubbed nearly away and drifting
 * slowest, the near ones freshest and drifting fastest as the board passes.
 */
const GHOSTS = [
  { text: 'a² + b² = c²', x: '3%', y: '16%', turn: -7, size: 30, depth: 1 },
  { text: 'e^{iπ} + 1 = 0', x: '63%', y: '5%', turn: 4, size: 28, depth: 0 },
  { text: '∑ 1/n² = π²/6', x: '71%', y: '51%', turn: -3, size: 26, depth: 2 },
  { text: 'n! ≡ ?', x: '1%', y: '58%', turn: 5, size: 30, depth: 0 },
  { text: '(n choose k)', x: '40%', y: '91%', turn: -2, size: 26, depth: 1 },
  { text: '∠ABC = 90°', x: '84%', y: '88%', turn: 6, size: 26, depth: 2 },
  { text: 'sin²θ + cos²θ = 1', x: '46%', y: '27%', turn: 3, size: 24, depth: 0 },
  { text: 'x ≡ 2 (mod 3)', x: '8%', y: '79%', turn: -4, size: 27, depth: 2 },
  { text: 'V − E + F = 2', x: '57%', y: '71%', turn: 2, size: 24, depth: 1 },
  { text: 'φ² = φ + 1', x: '27%', y: '44%', turn: -5, size: 28, depth: 2 },
] as const;

/** How far each depth drifts against the board over its passage, px: far, middle, near. */
const DRIFT: [number, number][] = [[-70, 70], [90, -90], [240, -240]];

/** The ring the type symbol draws round itself when the room is answered (the 3D glyph's ring, in SVG). */
const RING_D = (() => {
  const points = ringPath(64).map(([x, y]) => [50 + x * 34, 50 - y * 34]);
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
})();

function Ghosts({ drift, still }: { drift: MotionValue<number>; still: boolean }) {
  const far = useTransform(drift, [0, 1], DRIFT[0]);
  const middle = useTransform(drift, [0, 1], DRIFT[1]);
  const near = useTransform(drift, [0, 1], DRIFT[2]);
  const layers = [far, middle, near];
  return (
    <div className="lx-topics-ghosts" aria-hidden="true">
      {GHOSTS.map(ghost => (
        <m.span
          key={ghost.text}
          data-depth={ghost.depth}
          style={{ left: ghost.x, top: ghost.y, fontSize: ghost.size, rotate: ghost.turn, y: still ? 0 : layers[ghost.depth] }}
        >
          {ghost.text}
        </m.span>
      ))}
    </div>
  );
}

export default function TopicsChapter({ onRegister }: { onRegister: () => void }) {
  const reduce = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  // On the page clock, so the drifting formulas and the dust on the stage read one scroll.
  const drift = useStageScroll(stageRef, ['start end', 'end start']);
  return (
    <section className="lx-topics" id="topics" aria-labelledby="lx-topics-title">
      <ChalkFilter />
      <div ref={stageRef} className="lx-topics-stage" data-tone="ink">
        <Ghosts drift={drift} still={reduce} />

        <header className="lx-topics-head lx-wrap">
          <div>
            <SplitText as="h2" id="lx-topics-title" className="lx-h2" text={'Four kinds of problem.\nWhich one is *yours?*'} />
          </div>
          <div className="lx-topics-intro">
            <Rise as="p" className="lx-lead" delay={0.1}>
              Contest problems fall into four topics. Try one real problem from the archive in each.
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
            <p className="lx-topics-foot-line">Start with a short placement and we&rsquo;ll find your level.</p>
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
  const shudder = useAnimationControls();
  const [struck, setStruck] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [nudge, setNudge] = useState(false);
  const { problem } = room;

  const choose = (choice: number) => {
    if (solved || struck.includes(choice)) return;
    const right = choice === problem.answer;
    // The stage's glyph answers too: a shudder and a puff, or a ring and a swirl of dust.
    emitThread({ type: 'topic-choice', room: index, right });
    if (right) {
      setSolved(true);
      return;
    }
    setStruck(list => [...list, choice]);
    if (!reduce) {
      void shake.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.42, ease: 'easeOut' } });
      void shudder.start({ rotate: [0, -11, 9, -6, 3, 0], transition: { duration: 0.6, ease: 'easeOut' } });
    }
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
      <Rise className="lx-topic-inner" y={44} amount={0.2} panel>
        <header className="lx-topic-head">
          {/* The drawing without WebGL; with it, the stage's 3D chalk glyph stands exactly here. */}
          <m.span className="lx-topic-symbol" data-topic-glyph data-gl-swap aria-hidden="true" animate={shudder}>
            {room.symbol}
            <svg className="lx-topic-ring" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
              <m.path
                d={RING_D}
                initial={false}
                animate={{ pathLength: solved ? 1 : 0, opacity: solved ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.95, ease: GLIDE }, opacity: { duration: 0.15 } }}
              />
            </svg>
          </m.span>
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
