/**
 * The landing page's motion vocabulary.
 *
 * A handful of primitives every section shares, so a heading in the engine
 * chapter arrives exactly like a heading in the plans, and a count-up in the
 * hero settles like one in the archive. They read the house motion rules from
 * MotionConfig — `reducedMotion="user"` drops transforms and keeps fades — and
 * add the two decisions Motion cannot make for them: what happens on a coarse
 * pointer (no magnetism, no spotlight), and what the text says before any
 * script runs (the settled value, always).
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, m, useInView, useReducedMotion, useSpring, type Variants } from 'motion/react';
import { useMediaQuery } from '../../hooks/useBreakpoint';

/** The page's signature curve: a fast departure that glides into place. */
export const GLIDE = [0.16, 1, 0.3, 1] as const;
/** For things that travel on screen rather than arrive. */
export const SWEEP = [0.65, 0, 0.35, 1] as const;

export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)');

// ---------------------------------------------------------------------------
// Headings that rise into place, word by word
// ---------------------------------------------------------------------------

interface Segment { text: string; em: boolean }

/**
 * `*asterisks*` mark emphasis (set in Newsreader italic) and may span words;
 * `\n` breaks a line. Each word becomes one masked unit, carrying its own
 * punctuation so "*question*." rises as one piece.
 */
export function splitEmphasis(source: string): Segment[][][] {
  let em = false;
  return source.split('\n').map(line => line.split(' ').filter(Boolean).map(word => {
    const segments: Segment[] = [];
    let current = '';
    for (const char of word) {
      if (char === '*') {
        if (current) segments.push({ text: current, em });
        current = '';
        em = !em;
      } else current += char;
    }
    if (current) segments.push({ text: current, em });
    return segments;
  }));
}

const lineContainer: Variants = {
  hidden: {},
  shown: (custom: { delay: number; stagger: number }) => ({ transition: { delayChildren: custom.delay, staggerChildren: custom.stagger } }),
};

const wordRise: Variants = {
  hidden: { y: '112%', rotate: 2.5 },
  shown: { y: '0%', rotate: 0, transition: { duration: 1.05, ease: GLIDE } },
};

interface SplitTextProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  id?: string;
  /** Seconds before the first word moves. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
  /** Rise when mounted (the hero) or when scrolled into view (everything else). */
  trigger?: 'mount' | 'view';
}

/**
 * The words are real text in the heading, separated by real spaces, so the
 * accessible name is the sentence as written and nothing needs an aria-label.
 */
export function SplitText({ text, as = 'h2', className, id, delay = 0, stagger = 0.055, trigger = 'view' }: SplitTextProps) {
  const Tag = m[as];
  const lines = splitEmphasis(text);
  // Once the last word has landed the masks are lifted, so no descender or italic overhang is ever clipped.
  const [settled, setSettled] = useState(false);
  const lastLine = lines.length - 1;
  const lastWord = lines[lastLine].length - 1;
  const play = trigger === 'mount' ? { animate: 'shown' } : { whileInView: 'shown', viewport: { once: true, amount: 0.5 } };
  const classes = ['lx-split', className, settled && 'is-settled'].filter(Boolean).join(' ');
  return (
    <Tag id={id} className={classes} initial="hidden" {...play} variants={lineContainer} custom={{ delay, stagger }}>
      {lines.map((words, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {words.map((segments, wordIndex) => (
            <Fragment key={wordIndex}>
              {wordIndex > 0 && ' '}
              <span className="lx-w">
                <m.span
                  className="lx-wi"
                  variants={wordRise}
                  onAnimationComplete={lineIndex === lastLine && wordIndex === lastWord ? (definition: unknown) => { if (definition === 'shown') setSettled(true); } : undefined}
                >
                  {segments.map((segment, index) => segment.em ? <em key={index}>{segment.text}</em> : <Fragment key={index}>{segment.text}</Fragment>)}
                </m.span>
              </span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Blocks that settle in as they are scrolled to
// ---------------------------------------------------------------------------

interface RiseProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Distance travelled, in px. */
  y?: number;
  as?: 'div' | 'p' | 'li' | 'ol' | 'ul' | 'article' | 'section' | 'header' | 'figure';
  amount?: number;
  id?: string;
  /**
   * Blur on the way in. Right for text, where it softens the moment the words
   * appear; wrong for a large panel, where a filter over that much area costs a
   * weak GPU frames for an effect nobody can see at that size.
   */
  blur?: boolean;
}

/** A heavy fade-up, with a little blur for text-sized things. */
export function Rise({ children, className, delay = 0, y = 34, as = 'div', amount = 0.25, id, blur = true }: RiseProps) {
  const Tag = m[as];
  return (
    <Tag
      id={id}
      className={className}
      initial={blur ? { opacity: 0, y, filter: 'blur(6px)' } : { opacity: 0, y }}
      whileInView={blur ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 1, ease: GLIDE, delay, opacity: { duration: 0.7, ease: GLIDE, delay } }}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Numbers that count up once
// ---------------------------------------------------------------------------

const grouped = (value: number) => Math.round(value).toLocaleString('en-US');

interface CountUpProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  delay?: number;
  /** Where the count starts. */
  from?: number;
  className?: string;
}

/**
 * The settled figure is what the markup holds, and what a screen reader hears:
 * the animated digits are hidden from assistive technology, and swapped for the
 * starting value only once script is running and motion is allowed.
 */
export function CountUp({ value, format = grouped, duration = 1.9, delay = 0, from = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const formatRef = useRef(format);
  formatRef.current = format;

  useLayoutEffect(() => {
    if (!reduce && ref.current) ref.current.textContent = formatRef.current(from);
  }, [reduce, from]);

  useEffect(() => {
    if (reduce || !inView) return;
    const node = ref.current;
    const controls = animate(from, value, {
      duration,
      delay,
      ease: GLIDE,
      onUpdate: latest => { if (node) node.textContent = formatRef.current(latest); },
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration, delay, from]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="lx-tabular">{format(value)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pointer physics
// ---------------------------------------------------------------------------

/**
 * Pulls its child a little toward the pointer and springs back on leave. Only
 * on a fine pointer: on touch there is no hover to respond to, and a control
 * that slides under a finger is one the finger misses.
 */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 260, damping: 20, mass: 0.5 });
  const y = useSpring(0, { stiffness: 260, damping: 20, mass: 0.5 });
  const live = fine && !reduce;
  return (
    <m.span
      className={className ? `lx-magnetic ${className}` : 'lx-magnetic'}
      style={{ x, y }}
      onPointerMove={live ? event => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
      } : undefined}
      onPointerLeave={live ? () => { x.set(0); y.set(0); } : undefined}
    >
      {children}
    </m.span>
  );
}

/**
 * A light that follows the pointer across a card and along its border, written
 * to two custom properties once per frame at most. The card's own CSS decides
 * what the light looks like.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const fine = useFinePointer();
  useEffect(() => {
    const element = ref.current;
    if (!element || !fine) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        element.style.setProperty('--sx', `${x}px`);
        element.style.setProperty('--sy', `${y}px`);
      });
    };
    element.addEventListener('pointermove', move);
    return () => {
      element.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
    };
  }, [fine]);
  return ref;
}

// ---------------------------------------------------------------------------
// Small shared marks
// ---------------------------------------------------------------------------

/** The house arrow, drawn at the page's stroke weight rather than an icon set's. */
export function Arrow({ direction = 'up-right', size = 16 }: { direction?: 'right' | 'up-right' | 'down' | 'up'; size?: number }) {
  const rotate = { right: 0, 'up-right': -45, down: 90, up: -90 }[direction];
  return (
    <svg className="lx-arrow" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M2.5 8h10.5M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The CalculixHub mark: a pencilled curve and the point it is heading for. */
export function BrandMark({ draw = false }: { draw?: boolean }) {
  return (
    <svg className="lx-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <m.path
        d="M30 9C11 2 2 27 18 32c7 3 15-3 15-10M7 23 32 12"
        stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: GLIDE, delay: 0.2 }}
      />
      <m.circle
        cx="31" cy="12" r="3" fill="currentColor"
        initial={draw ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: GLIDE, delay: 1.2 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
    </svg>
  );
}

interface EyebrowProps {
  children: ReactNode;
  index?: string;
  live?: boolean;
  className?: string;
}

/** The small label above a heading: a chapter number or a live dot, then the words. */
export function Eyebrow({ children, index, live, className }: EyebrowProps) {
  return (
    <span className={className ? `lx-eyebrow ${className}` : 'lx-eyebrow'}>
      {live && <span className="lx-live" aria-hidden="true" />}
      {index && <span className="lx-eyebrow-index">{index}</span>}
      <span>{children}</span>
    </span>
  );
}
