/**
 * "The archive": every paper in one place, from AMC to IMO.
 *
 * Two bands run across the full width — the contests in display type, and
 * real problems from the archive in a slower counter-current — and they
 * answer the scroll: flick the page and they speed up and lean into the
 * motion, then settle back to their idle drift.
 *
 * Below them is the staircase. The four banks are stacks of paper standing on
 * one floor, each taller than the last (a staircase of difficulty, not of
 * size), turned a little so their sides show. The stage pins, and scrolling
 * down carries the stacks sideways past the centre while the camera climbs
 * with them. As each stack reaches the centre its top sheet lifts and stands
 * up to face you with a real problem from that bank on it, its problem count
 * counts up, and its format appears. The thread of light runs along the stair
 * edges (sceneArchive.ts); it is worked out from the same numbers as these
 * transforms (archiveStairs.ts), so it sits on the edges exactly.
 *
 * The stacks are CSS 3D rather than WebGL so every word on them stays real,
 * crisp DOM text. Nothing on them is laid out again while scrolling: the
 * track, the sheets and the labels are moved by transform and opacity only,
 * written from the page clock in the scroll's own frame.
 *
 * On a narrow screen, a short one, or with reduced motion, there is no pin
 * and nothing travels: the stacks stand in a plain list (a row on a wide
 * screen, a column on a phone), each with its problem standing on top.
 *
 * The bands run on the Web Animations API, so the drift itself is composited
 * off the main thread; scrolling only changes its playback rate. They pause
 * offscreen, and hold still under reduced motion.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react';
import MathText from '../MathText';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES } from './archiveFigures';
import { ARCHIVE_SAMPLES, type ArchiveSample } from './archiveSamples';
import { STEP, labelIn, measureStairs, reached, sheetLift, sheetTransform, stairsCamera, stairsFocus, stairsProgress, trackPose, trackTransform, type StairsMeasure } from './archiveStairs';
import { PRIORITY, currentTick, onTick, type Tick } from './pageClock';
import { docBox, onMeasure, type Box } from './stageLayout';
import { useMediaQuery } from '../../hooks/useBreakpoint';
import { Arrow, CountUp, Magnetic, Rise, SplitText } from './kit';

const GLYPHS = ['∑', '∫', '≡', 'π', '∞', '√', '∂', '≅', 'ℤ', '∴'];

/**
 * The problem each stack lifts, by bank. The newest AMC and AIME papers, a
 * recent USAMO, and IMO 1988's sixth problem at the top of the stairs: the
 * archive's best-known hard problem is where the climb should end.
 */
const SHEET_IDS: Record<string, string> = { 'AMC 12': 'amc12-2024a-p4', AIME: 'aime-2010-i-p2', USAMO: 'usamo-2022-4', IMO: 'imo-1988-6' };
const PREFIX: Record<string, string> = { 'AMC 12': 'amc12-', AIME: 'aime-', USAMO: 'usamo-', IMO: 'imo-' };

function sampleFor(family: string): ArchiveSample | undefined {
  return ARCHIVE_SAMPLES.find(sample => sample.id === SHEET_IDS[family]) ?? ARCHIVE_SAMPLES.find(sample => sample.id.startsWith(PREFIX[family] ?? '\u0000'));
}

/** The pinned staircase needs room to travel: a wide screen, tall enough to pin, and motion allowed. */
const TRACK_QUERY = '(min-width: 901px) and (min-height: 560px)';

/** The page's scroll velocity, from the page clock, so the bands lean with exactly the scroll the stage draws. */
function useScrollVelocity(): MotionValue<number> {
  const velocity = useMotionValue(0);
  useEffect(() => onTick(tick => { if (velocity.get() !== tick.vy) velocity.set(tick.vy); }, PRIORITY.progress), [velocity]);
  return velocity;
}

export default function ArchiveLadder() {
  const reduce = Boolean(useReducedMotion());
  const roomy = useMediaQuery(TRACK_QUERY);
  const velocity = useScrollVelocity();
  const smooth = useSpring(velocity, { damping: 40, stiffness: 300 });
  // The lean never passes 5 degrees, however hard the page is flung.
  const skew = useTransform(smooth, [-2600, 0, 2600], [5, 0, -5], { clamp: true });

  return (
    <section className="lx-archive" id="archive" data-tone="paper" aria-labelledby="lx-archive-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <SplitText as="h2" id="lx-archive-title" className="lx-h2" text={'Every past paper,\nfrom *AMC to IMO.*'} />
          <Rise as="p" className="lx-lead" delay={0.1}>
            {ARCHIVE_FIGURES.problems.toLocaleString('en-US')} problems from {ARCHIVE_FIGURES.papers} past exams, {ARCHIVE_FIGURES.firstYear} to {ARCHIVE_FIGURES.lastYear}. Take a whole paper, or one problem at a time.
          </Rise>
        </header>
      </div>

      <div className="lx-marquee" aria-label="Contests in the archive">
        <m.div style={reduce ? undefined : { skewX: skew }}>
          <MarqueeRow duration={46} velocity={smooth} still={reduce} className="lx-marquee-names">
            {ARCHIVE_CONTESTS.map((contest, index) => (
              <span key={contest} className="lx-marquee-name">
                <span className={index % 2 ? 'is-outline' : undefined}>{contest}</span>
                <span className="lx-marquee-glyph" aria-hidden="true">{GLYPHS[index % GLYPHS.length]}</span>
              </span>
            ))}
          </MarqueeRow>
        </m.div>
        <MarqueeRow duration={120} velocity={smooth} still={reduce} reverse className="lx-marquee-problems">
          {ARCHIVE_SAMPLES.map(sample => (
            <figure key={sample.ref} className="lx-problem-chip">
              <figcaption>{sample.ref}</figcaption>
              <MathText text={sample.prompt} />
            </figure>
          ))}
        </MarqueeRow>
      </div>

      <Staircase mode={roomy && !reduce ? 'track' : 'list'} />

      <div className="lx-wrap">
        <div className="lx-archive-foot">
          <Rise delay={0.08}>
            <Magnetic>
              <a className="lx-btn lx-btn-ink" href="/?auth=signup&tab=archive">
                <span>Open the archive</span>
                <span className="lx-btn-icon" aria-hidden="true"><Arrow /></span>
              </a>
            </Magnetic>
          </Rise>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The staircase
// ---------------------------------------------------------------------------

function Staircase({ mode }: { mode: 'track' | 'list' }) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  // How many stacks have reached the centre: each count starts counting then, once.
  const [arrived, setArrived] = useState(0);
  const track = mode === 'track';

  useLayoutEffect(() => {
    const runwayElement = runwayRef.current;
    const pin = pinRef.current;
    const list = trackRef.current;
    if (!track || !runwayElement || !pin || !list) return;
    // Each stack's moving parts: its top sheet, the print on it, the sheet's shadow on the stack, its count and format.
    const stacks = Array.from(list.querySelectorAll<HTMLElement>('[data-stack]')).map(stack => ({
      sheet: stack.querySelector<HTMLElement>('[data-stack-sheet]'),
      prints: Array.from(stack.querySelectorAll<HTMLElement>('[data-stack-print]')),
      shade: stack.querySelector<HTMLElement>('[data-stack-shade]'),
      label: stack.querySelector<HTMLElement>('[data-stack-label]'),
    }));
    const stops = Array.from(axisRef.current?.querySelectorAll<HTMLElement>('[data-axis-stop]') ?? []);
    const marker = axisRef.current?.querySelector<HTMLElement>('[data-axis-marker]') ?? null;
    const fill = axisRef.current?.querySelector<HTMLElement>('[data-axis-fill]') ?? null;
    let measured: StairsMeasure | null = null;
    let runway: Box = docBox(runwayElement);
    let most = 0;
    let current = -1;
    const written = new Map<HTMLElement, string>();
    const put = (element: HTMLElement | null, property: 'transform' | 'opacity', value: string) => {
      if (!element || written.get(element) === value) return;
      written.set(element, value);
      element.style[property] = value;
    };

    const write = (value: number) => {
      if (!measured) return;
      const focus = stairsFocus(value);
      put(list, 'transform', trackTransform(trackPose(measured, value)));
      stacks.forEach((stack, i) => {
        const lift = sheetLift(focus, i);
        put(stack.sheet, 'transform', sheetTransform(lift));
        put(stack.shade, 'opacity', lift.toFixed(3));
        // Lying flat, the print is seen almost edge-on and reads as noise: it is faint until the sheet stands.
        const ink = (0.22 + 0.78 * Math.min(1, lift * 2)).toFixed(3);
        for (const print of stack.prints) put(print, 'opacity', ink);
        put(stack.label, 'opacity', labelIn(focus, i).toFixed(3));
      });
      // Where the climb is, on the axis: the marker on the stack in focus, the rule filled to it.
      const along = Math.min(1, Math.max(0, (focus + 0.5) / STEP.length));
      put(marker, 'transform', `translate3d(${(along * 100).toFixed(2)}%, 0, 0)`);
      put(fill, 'transform', `scaleX(${along.toFixed(4)})`);
      const nearest = Math.round(focus);
      const active = nearest >= 0 && nearest < stops.length && Math.abs(focus - nearest) < 0.5 ? nearest : -1;
      if (active !== current) {
        current = active;
        stops.forEach((stop, i) => stop.toggleAttribute('data-active', i === active));
      }
      const count = STEP.reduce((total, _, i) => total + (reached(focus, i) ? 1 : 0), 0);
      if (count > most) {
        most = count;
        setArrived(count);
      }
    };

    // On the page clock, in the scroll's own frame, from the same numbers the stage projects the thread with.
    const update = (tick: Pick<Tick, 'y'>) => {
      if (measured) write(stairsProgress(runway, measured.pin.height, tick.y));
    };

    const stopMeasure = onMeasure(() => {
      runway = docBox(runwayElement);
      measured = measureStairs(pin);
      if (measured) {
        // The camera, from the size of the screen's view of the stage: the stage reads the same numbers to project the thread.
        const camera = stairsCamera(measured.view.width, measured.view.height);
        pin.style.perspective = `${camera.perspective}px`;
        pin.style.perspectiveOrigin = `${camera.ox}px ${camera.oy}px`;
      }
      written.clear();
      current = -1;
      update(currentTick());
    });
    const stopTick = onTick(update, PRIORITY.progress);
    return () => {
      stopMeasure();
      stopTick();
      // Leaving the track (a resize, reduced motion switched on): the list keeps none of its inline motion.
      for (const element of written.keys()) { element.style.transform = ''; element.style.opacity = ''; }
      pin.style.perspective = '';
      pin.style.perspectiveOrigin = '';
    };
  }, [track]);

  return (
    <div className="lx-stairs" ref={runwayRef} data-mode={mode}>
      <div className="lx-stairs-pin" ref={pinRef}>
        {/* What the screen shows of the stage while it is pinned: the camera frames this, and the axis rides at its top. */}
        {track && <div className="lx-stairs-view" data-stairs-view aria-hidden="true" />}
        {track && (
          <div className="lx-stairs-axis" ref={axisRef} aria-hidden="true">
            <span className="lx-stairs-axis-end">easier</span>
            <span className="lx-stairs-axis-rule">
              <i className="lx-stairs-axis-fill" data-axis-fill />
              {ARCHIVE_FIGURES.families.map((entry, i) => (
                <span key={entry.family} className="lx-stairs-axis-stop" data-axis-stop style={{ left: `${((i + 0.5) / STEP.length) * 100}%` }}>
                  <i />
                  <span>{entry.family}</span>
                </span>
              ))}
              <span className="lx-stairs-axis-marker" data-axis-marker><i /></span>
            </span>
            <Arrow direction="right" size={14} />
            <span className="lx-stairs-axis-end">harder</span>
          </div>
        )}
        <ol className="lx-stairs-track" ref={trackRef} data-stairs-track aria-label="The archive, from easier contests to harder ones">
          {ARCHIVE_FIGURES.families.map((entry, index) => {
            const sample = sampleFor(entry.family);
            return (
              <li key={entry.family} className="lx-ream" data-stack style={{ ['--k' as string]: STEP[index] }}>
                <div className="lx-ream-box">
                  <div className="lx-ream-face is-front">
                    <div className="lx-ream-band">
                      <span className="lx-ladder-family">{entry.family}</span>
                      <span className="lx-ream-label" data-stack-label>
                        <span className="lx-ladder-format">{entry.format}</span>
                        <span className="lx-ream-count">
                          <strong><CountUp value={entry.problems} start={!track || arrived > index} /></strong> problems
                        </span>
                      </span>
                    </div>
                    <i className="lx-ream-lift" data-stack-shade aria-hidden="true" />
                    {/* The thread along this stack's edges, for a page without the WebGL stage. */}
                    <i className="lx-ream-thread" data-gl-swap aria-hidden="true" />
                  </div>
                  <div className="lx-ream-face is-side" aria-hidden="true"><i className="lx-ream-band-side" /></div>
                  <div className="lx-ream-face is-top" aria-hidden="true" />
                  <div className="lx-ream-floor" aria-hidden="true" />
                </div>
                {sample && (
                  <figure className="lx-ream-sheet" data-stack-sheet>
                    <figcaption data-stack-print>{sample.ref}</figcaption>
                    <span className="lx-ream-print" data-stack-print><MathText className="lx-ream-problem" text={sample.prompt} /></span>
                    <span className="lx-ream-ruled" aria-hidden="true" />
                  </figure>
                )}
              </li>
            );
          })}
        </ol>
        {!track && (
          <div className="lx-ladder-axis" aria-hidden="true">
            <span>easier</span>
            <span className="lx-ladder-rule" />
            <Arrow direction="right" size={14} />
            <span>harder</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The bands
// ---------------------------------------------------------------------------

interface MarqueeRowProps {
  children: ReactNode;
  /** Seconds for one full loop at idle. */
  duration: number;
  velocity: MotionValue<number>;
  still: boolean;
  reverse?: boolean;
  className?: string;
}

function MarqueeRow({ children, duration, velocity, still, reverse = false, className }: MarqueeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || still || typeof track.animate !== 'function') return;
    // Two copies of the content sit side by side; sliding by half is a seamless loop.
    const animation = track.animate(
      [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-50%, 0, 0)' }],
      { duration: duration * 1000, iterations: Infinity, easing: 'linear', direction: reverse ? 'reverse' : 'normal' },
    );
    let onScreen = true;
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) animation.play();
      else animation.pause();
    }, { rootMargin: '120px' });
    visibility.observe(track);
    let rate = 1;
    const stop = velocity.on('change', value => {
      // Rounded, so a velocity settling by fractions does not ask the compositor for a new rate every frame.
      const next = Math.round((1 + Math.min(5, Math.abs(value) / 700)) * 20) / 20;
      if (next === rate || !onScreen) return;
      rate = next;
      animation.updatePlaybackRate(next);
    });
    return () => {
      stop();
      visibility.disconnect();
      animation.cancel();
    };
  }, [duration, reverse, still, velocity]);

  return (
    <div className={className ? `lx-marquee-row ${className}` : 'lx-marquee-row'}>
      <div ref={trackRef} className="lx-marquee-track">
        <div className="lx-marquee-set">{children}</div>
        <div className="lx-marquee-set" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
