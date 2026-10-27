/**
 * "The archive": every paper in one place, from AMC to IMO.
 *
 * Two bands run across the full width — the contests in display type, and
 * real problems from the archive in a slower counter-current — and they
 * answer the scroll: flick the page and they speed up and lean into the
 * motion, then settle back to their idle drift. Below them, the four banks
 * rise as a staircase of difficulty, each step counting its own problems.
 *
 * The bands run on the Web Animations API, so the drift itself is composited
 * off the main thread; scrolling only changes its playback rate. They pause
 * offscreen, and hold still under reduced motion.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { m, useReducedMotion, useScroll, useSpring, useTransform, useVelocity, type MotionValue } from 'motion/react';
import MathText from '../MathText';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES } from './archiveFigures';
import { ARCHIVE_SAMPLES } from './archiveSamples';
import { Arrow, CountUp, Eyebrow, GLIDE, Magnetic, Rise, SplitText } from './kit';

/** Each bank's step, as a share of the tallest: a staircase of difficulty, not of size. */
const STEP = [0.44, 0.61, 0.8, 1];
const GLYPHS = ['∑', '∫', '≡', 'π', '∞', '√', '∂', '≅', 'ℤ', '∴'];

export default function ArchiveLadder() {
  const reduce = Boolean(useReducedMotion());
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 40, stiffness: 300 });
  const skew = useTransform(smooth, [-2600, 0, 2600], [5, 0, -5], { clamp: true });

  return (
    <section className="lx-archive" id="archive" data-tone="paper" aria-labelledby="lx-archive-title">
      <div className="lx-wrap">
        <header className="lx-section-head lx-section-head-split">
          <div>
            <Eyebrow index="05">Past papers</Eyebrow>
            <SplitText as="h2" id="lx-archive-title" className="lx-h2" text={'Every past paper,\n*from AMC to IMO.*'} />
          </div>
          <Rise as="p" className="lx-lead" delay={0.1}>
            {ARCHIVE_FIGURES.problems.toLocaleString('en-US')} real problems from {ARCHIVE_FIGURES.papers} past exams. Take a whole paper, or one problem at a time.
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

      <div className="lx-wrap">
        <ol className="lx-ladder" aria-label="The archive, from easier contests to harder ones">
          {ARCHIVE_FIGURES.families.map((entry, index) => (
            <m.li
              key={entry.family}
              className="lx-ladder-step"
              style={{ ['--k' as string]: STEP[index] }}
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, amount: 0.4 }}
            >
              <div className="lx-ladder-column">
                <m.div
                  className="lx-ladder-bar"
                  variants={{ hidden: { scaleY: 0 }, shown: { scaleY: 1, transition: { duration: 1.3, ease: GLIDE, delay: 0.12 * index } } }}
                />
                <m.div
                  className="lx-ladder-head"
                  variants={{ hidden: { opacity: 0, y: 24 }, shown: { opacity: 1, y: 0, transition: { duration: 0.9, ease: GLIDE, delay: 0.5 + 0.12 * index } } }}
                >
                  <span className="lx-ladder-family">{entry.family}</span>
                  <span className="lx-ladder-format">{entry.format}</span>
                </m.div>
                <m.div
                  className="lx-ladder-figure"
                  variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: { duration: 0.8, ease: GLIDE, delay: 0.35 + 0.12 * index } } }}
                >
                  <strong><CountUp value={entry.problems} delay={0.3 + 0.12 * index} /></strong>
                  <span>problems</span>
                </m.div>
              </div>
            </m.li>
          ))}
          <li className="lx-ladder-axis" aria-hidden="true">
            <span>easier</span>
            <span className="lx-ladder-rule" />
            <Arrow direction="right" size={14} />
            <span>harder</span>
          </li>
        </ol>

        <div className="lx-archive-foot">
          <Rise as="p" className="lx-archive-note">
            Answers are checked instantly. Proofs come with full solutions.
          </Rise>
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
    const visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) animation.play();
      else animation.pause();
    }, { rootMargin: '120px' });
    visibility.observe(track);
    const stop = velocity.on('change', value => {
      animation.updatePlaybackRate(1 + Math.min(5, Math.abs(value) / 700));
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
