/**
 * The four chalk drawings of the "Topics" chapter.
 *
 * Each is a sketch of the very problem its room asks (topicRooms.ts), the way a
 * teacher would start it at the board: the completed square for the algebra
 * problem, the circle with its chord and a right triangle for the geometry
 * one, the in-or-out tree for the subsets, the factor tree of 2024.
 *
 * They are drawn stroke by stroke once, when scrolled to. The chalk itself is
 * an SVG filter (ChalkFilter) that wobbles the lines and breaks them up with
 * grain, so no stroke is ever a perfect vector — and the lettering is the same
 * hand as the margin notes elsewhere on the page.
 *
 * Reduced motion shows every drawing finished.
 */

import type { ReactNode } from 'react';
import { m, useReducedMotion, type Variants } from 'motion/react';
import { GLIDE } from './kit';

/** One filter for every board: a gentle wobble, then holes where the chalk skipped. */
export function ChalkFilter() {
  return (
    <svg className="lx-chalk-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="lx-chalk" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="wobble" />
        <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="11" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.05" result="dust" />
        <feComposite in="wobble" in2="dust" operator="in" />
      </filter>
    </svg>
  );
}

const stroke: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  shown: (delay: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.9, ease: GLIDE, delay }, opacity: { duration: 0.12, delay } },
  }),
};
const letters: Variants = {
  hidden: { opacity: 0, y: 5 },
  shown: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: GLIDE, delay } }),
};
const pop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  shown: (delay: number) => ({ scale: 1, opacity: 1, transition: { type: 'spring', visualDuration: 0.4, bounce: 0.45, delay } }),
};

interface LineProps {
  d: string;
  delay: number;
  /** Drawn in the room's colour instead of plain chalk. */
  tone?: boolean;
  /** A lighter stroke, for construction lines. */
  thin?: boolean;
  /** Faint, for what is only suggested. */
  faint?: boolean;
}

function Line({ d, delay, tone, thin, faint }: LineProps) {
  const className = ['lx-stroke', tone && 'is-tone', thin && 'is-thin', faint && 'is-faint'].filter(Boolean).join(' ');
  return <m.path className={className} d={d} custom={delay} variants={stroke} />;
}

interface WordProps {
  x: number;
  y: number;
  delay: number;
  children: ReactNode;
  tone?: boolean;
  /** Margin-note lettering, smaller and quieter than the working. */
  note?: boolean;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
}

function Word({ x, y, delay, children, tone, note, size = 28, anchor = 'start' }: WordProps) {
  const className = ['lx-scrawl', tone && 'is-tone', note && 'is-note'].filter(Boolean).join(' ');
  return (
    <m.text className={className} x={x} y={y} fontSize={size} textAnchor={anchor} custom={delay} variants={letters}>
      {children}
    </m.text>
  );
}

function Dot({ x, y, delay, r = 4, tone }: { x: number; y: number; delay: number; r?: number; tone?: boolean }) {
  return <m.circle className={tone ? 'lx-fill is-tone' : 'lx-fill'} cx={x} cy={y} r={r} custom={delay} variants={pop} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />;
}

/** A hand-drawn circle around something, a little open at the join as a real one is. */
function ring(cx: number, cy: number, rx: number, ry = rx) {
  return `M${cx - rx} ${cy + 2}C${cx - rx} ${cy - ry * 1.1} ${cx + rx} ${cy - ry * 1.1} ${cx + rx} ${cy}C${cx + rx} ${cy + ry * 1.1} ${cx - rx} ${cy + ry * 1.1} ${cx - rx + 3} ${cy - 4}`;
}

interface BoardProps {
  /** An accessible description of what is drawn. */
  label: string;
  children: ReactNode;
}

/** The drawing surface: draws itself in once, when a third of it has come into view. */
function Board({ label, children }: BoardProps) {
  const reduce = Boolean(useReducedMotion());
  return (
    <m.svg
      className="lx-board"
      viewBox="0 0 600 240"
      role="img"
      aria-label={label}
      initial={reduce ? 'shown' : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, amount: 0.35 }}
    >
      <g className="lx-board-chalk">{children}</g>
    </m.svg>
  );
}

// ---------------------------------------------------------------------------
// Algebra: completing the square, as areas
// ---------------------------------------------------------------------------

function AlgebraBoard() {
  return (
    <Board label="A square of side x with two strips of width 5 along its edges and a 5 by 5 corner still missing: x squared plus 10x plus 25 makes (x plus 5) squared.">
      <Line d="M70 48H186V164H70Z" delay={0.1} />
      <Line d="M186 48H238V164H186" delay={0.5} />
      <Line d="M70 164V216H186V164" delay={0.8} />
      <Line d="M186 164H238V216H186Z" delay={1.1} tone />
      <Line d="M190 206L220 166M200 214L234 174M216 214L236 194" delay={1.5} tone thin />
      <Line d="M70 38H186M70 32V44M186 32V44" delay={1.6} thin />
      <Line d="M186 38H238M238 32V44" delay={1.7} thin />
      <Word x={128} y={116} delay={1.2} anchor="middle" size={34}>x²</Word>
      <Word x={212} y={114} delay={1.35} anchor="middle" size={26}>5x</Word>
      <Word x={128} y={198} delay={1.5} anchor="middle" size={26}>5x</Word>
      <Word x={212} y={197} delay={1.7} anchor="middle" size={26} tone>25</Word>
      <Word x={128} y={26} delay={1.8} anchor="middle" size={24}>x</Word>
      <Word x={212} y={26} delay={1.9} anchor="middle" size={24}>5</Word>
      <Word x={300} y={92} delay={2.1} size={34}>x² + 10x + 25</Word>
      <Line d="M300 106C380 112 440 108 500 100" delay={2.6} thin faint />
      <Word x={300} y={146} delay={2.7} size={38} tone>= (x + 5)²</Word>
      <Line d="M326 202C306 212 278 214 250 206" delay={3.0} tone thin />
      <Line d="M262 196L249 206L263 213" delay={3.3} tone thin />
      <Word x={338} y={210} delay={3.1} size={24} note>the missing piece!</Word>
    </Board>
  );
}

// ---------------------------------------------------------------------------
// Geometry: a chord, and the right triangle it hides
// ---------------------------------------------------------------------------

function GeometryBoard() {
  return (
    <Board label="A circle with centre O and a chord of length 10 whose distance from the centre is 5. Radii to the chord's ends and the perpendicular from O make a right triangle.">
      <Line d="M96 134A94 94 0 1 1 284 134A94 94 0 1 1 96 134" delay={0.1} />
      <Line d="M123.5 67.5H256.5" delay={1.0} tone />
      <Line d="M190 134V67.5" delay={1.5} />
      <Line d="M190 134L123.5 67.5M190 134L256.5 67.5" delay={1.9} thin />
      <Line d="M190 81.5H204V67.5" delay={2.3} thin />
      <Dot x={190} y={134} delay={2.2} />
      <Word x={168} y={158} delay={2.3} size={26}>O</Word>
      <Word x={98} y={64} delay={2.4} size={26}>A</Word>
      <Word x={264} y={64} delay={2.4} size={26}>B</Word>
      <Word x={190} y={60} delay={2.6} anchor="middle" size={21} tone>10</Word>
      <Word x={200} y={116} delay={2.7} size={26} tone>5</Word>
      <Word x={240} y={108} delay={2.8} size={26}>r</Word>
      <Word x={330} y={96} delay={3.0} size={34}>r² = 5² + <tspan className="is-tone">?²</tspan></Word>
      <Line d="M330 112C400 118 470 114 520 106" delay={3.4} thin faint />
      <Word x={330} y={158} delay={3.5} size={32}>area = π r²</Word>
      <Word x={330} y={206} delay={3.8} size={24} note>find the triangle first</Word>
    </Board>
  );
}

// ---------------------------------------------------------------------------
// Combinatorics: every number is in, or out
// ---------------------------------------------------------------------------

const SET = [2, 3, 4, 5, 6, 7, 8, 9];
const PRIMES = new Set([2, 3, 5, 7]);
const TILE = 52;
const TILE_GAP = 10;
const SET_X = 57;

/** The tree of choices, three levels of it: each fork is "in" to the left and "out" to the right. */
const TREE_EDGES = [
  'M300 108Q256 116 218 138', 'M300 108Q344 116 382 138',
  'M208 148Q184 160 170 176', 'M218 148Q238 160 252 176', 'M392 148Q368 160 348 176', 'M382 148Q408 160 430 176',
  'M162 186Q150 200 146 214', 'M172 186Q180 200 186 214', 'M258 186Q248 200 238 214', 'M262 186Q270 200 278 214',
  'M342 186Q332 200 322 214', 'M352 186Q360 200 366 214', 'M434 186Q424 200 414 214', 'M438 186Q448 200 456 214',
];
const TREE_NODES: [number, number][] = [
  [300, 104], [212, 144], [388, 144], [166, 182], [256, 182], [344, 182], [434, 182],
];
const LEAVES = [146, 188, 238, 280, 322, 366, 414, 458];

function CombinatoricsBoard() {
  return (
    <Board label="The numbers 2 to 9 in a row with the primes circled, and a tree of choices below: each number is either in the subset or out of it.">
      {SET.map((value, index) => {
        const x = SET_X + index * (TILE + TILE_GAP);
        const prime = PRIMES.has(value);
        return (
          <g key={value}>
            <Line d={`M${x} 20H${x + TILE}V66H${x}Z`} delay={0.1 + index * 0.1} thin />
            <Word x={x + TILE / 2} y={54} delay={0.4 + index * 0.1} anchor="middle" size={30} tone={prime}>{value}</Word>
            {prime && <Line d={ring(x + TILE / 2, 43, 20, 19)} delay={1.3 + index * 0.12} tone />}
          </g>
        );
      })}
      {TREE_EDGES.map((d, index) => (
        <Line key={d} d={d} delay={1.9 + index * 0.07} thin faint={index > 5} />
      ))}
      {TREE_NODES.map(([x, y], index) => <Dot key={index} x={x} y={y} delay={2.0 + index * 0.1} r={index === 0 ? 5 : 4} tone={index === 0} />)}
      {LEAVES.map((x, index) => <Dot key={x} x={x} y={218} delay={3.0 + index * 0.05} r={3} />)}
      <Word x={240} y={118} delay={2.6} size={22} anchor="end" note>in</Word>
      <Word x={362} y={118} delay={2.6} size={22} note>out</Word>
      <Word x={36} y={150} delay={3.2} size={26} tone>in or</Word>
      <Word x={36} y={178} delay={3.3} size={26} tone>out?</Word>
      <Line d="M112 160C142 168 172 162 200 149M189 146L200 149L193 160" delay={3.5} tone thin />
      <Word x={482} y={174} delay={3.6} size={22} note>…and again,</Word>
      <Word x={482} y={200} delay={3.7} size={22} note>for all eight</Word>
    </Board>
  );
}

// ---------------------------------------------------------------------------
// Number theory: a factor tree
// ---------------------------------------------------------------------------

function NumberTheoryBoard() {
  return (
    <Board label="A factor tree of 2024: it splits into 8 and 253, then into 2 times 2 times 2 times 11 times 23, with every prime circled.">
      <Line d="M216 52L152 88M244 52L310 88" delay={0.3} thin />
      <Line d="M132 114L106 146M150 114L174 146M308 114L286 146M332 114L356 146" delay={0.8} thin />
      <Line d="M176 174L156 200M194 174L214 200" delay={1.3} thin />
      <Word x={230} y={50} delay={0.1} anchor="middle" size={40}>2024</Word>
      <Word x={140} y={110} delay={0.6} anchor="middle" size={34}>8</Word>
      <Word x={320} y={110} delay={0.6} anchor="middle" size={34}>253</Word>
      <Word x={96} y={170} delay={1.1} anchor="middle" size={34} tone>2</Word>
      <Word x={184} y={170} delay={1.1} anchor="middle" size={34}>4</Word>
      <Word x={276} y={170} delay={1.15} anchor="middle" size={34} tone>11</Word>
      <Word x={366} y={170} delay={1.15} anchor="middle" size={34} tone>23</Word>
      <Word x={148} y={226} delay={1.6} anchor="middle" size={34} tone>2</Word>
      <Word x={220} y={226} delay={1.6} anchor="middle" size={34} tone>2</Word>
      <Line d={ring(96, 159, 20, 19)} delay={2.1} tone />
      <Line d={ring(276, 159, 27, 20)} delay={2.2} tone />
      <Line d={ring(366, 159, 27, 20)} delay={2.3} tone />
      <Line d={ring(148, 215, 20, 19)} delay={2.4} tone />
      <Line d={ring(220, 215, 20, 19)} delay={2.5} tone />
      <Word x={440} y={96} delay={2.7} size={28} tone>circle every</Word>
      <Word x={440} y={124} delay={2.8} size={28} tone>prime</Word>
      <Line d="M436 134C418 144 404 152 396 158" delay={3.0} tone thin />
      <Line d="M408 148L395 159L411 162" delay={3.3} tone thin />
      <Word x={426} y={196} delay={3.2} size={21} note>then ask: when does n!</Word>
      <Word x={426} y={220} delay={3.3} size={21} note>have all of them?</Word>
    </Board>
  );
}

export const TOPIC_BOARDS = [AlgebraBoard, GeometryBoard, CombinatoricsBoard, NumberTheoryBoard] as const;
