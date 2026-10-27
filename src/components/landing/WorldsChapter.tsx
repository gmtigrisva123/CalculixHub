/**
 * "Four worlds": the four topics, one card each, and one particle cloud that
 * becomes each topic's form as its card is read.
 *
 * The visual is sticky — beside the text on a wide screen, behind it on a
 * narrow one — and the scroll position through the four articles drives a
 * continuous morph index (0–3). Each form holds while its article is centred
 * and flows into the next only in the space between them, so the shape on
 * screen always belongs to the words beside it.
 */

import { lazy, Suspense, useRef, useState } from 'react';
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import MathText from '../MathText';
import { WORLD_IDEAS, type WorldIdea } from './worldIdeas';
import { Arrow, Eyebrow, GLIDE, Rise, SplitText } from './kit';
import { scrollToTarget } from './smoothScroll';

const ParticleField = lazy(() => import('./ParticleField'));

/** Hold each form across the middle of its article; morph only between them. */
function dwell(progress: number) {
  const s = Math.max(0, Math.min(3, progress * 4 - 0.5));
  const whole = Math.floor(s);
  const part = s - whole;
  const eased = Math.max(0, Math.min(1, (part - 0.22) / 0.56));
  return Math.min(3, whole + eased * eased * (3 - 2 * eased));
}

export default function WorldsChapter() {
  const reduce = Boolean(useReducedMotion());
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start center', 'end center'] });
  const morph = useTransform(scrollYProgress, dwell);
  const progressLine = useTransform(scrollYProgress, [0.06, 0.94], [0, 1]);
  useMotionValueEvent(morph, 'change', value => setActive(Math.round(value)));

  return (
    <section className="lx-worlds" id="worlds" aria-labelledby="lx-worlds-title">
      <div className="lx-worlds-stage" data-tone="ink">
        <header className="lx-worlds-head lx-wrap">
          <Eyebrow index="04">Topics</Eyebrow>
          <SplitText as="h2" id="lx-worlds-title" className="lx-h2" text={'Four worlds.\n*One way of thinking.*'} />
          <Rise as="p" className="lx-lead" delay={0.1}>
            Four kinds of contest problems. Scroll to watch each one take shape.
          </Rise>
          <Rise as="ol" className="lx-worlds-index" delay={0.18}>
            {WORLD_IDEAS.map((idea, index) => (
              <li key={idea.topic}>
                <a href={`#world-${index + 1}`} onClick={event => {
                  const target = document.getElementById(`world-${index + 1}`);
                  if (!target) return;
                  event.preventDefault();
                  // Land with the article centred, where its form is fully drawn.
                  scrollToTarget(target, { offset: (target.offsetHeight - window.innerHeight) / 2 });
                }}>
                  <span aria-hidden="true">{idea.symbol}</span>{idea.topic}
                </a>
              </li>
            ))}
          </Rise>
        </header>

        <div className="lx-worlds-body">
          <div className="lx-worlds-visual">
            <Suspense fallback={null}>
              <ParticleField
                variant="worlds"
                morph={morph}
                still={reduce}
                className={ready ? 'lx-worlds-field is-ready' : 'lx-worlds-field'}
                onReady={() => setReady(true)}
              />
            </Suspense>
            <div className="lx-worlds-hud" aria-hidden="true">
              <ol className="lx-worlds-steps">
                {WORLD_IDEAS.map((idea, index) => (
                  <li key={idea.topic} data-active={index === active || undefined}>
                    <span>{String(index + 1).padStart(2, '0')}</span>{idea.topic}
                  </li>
                ))}
              </ol>
              <div className="lx-worlds-meter"><m.span style={{ scaleX: progressLine }} /></div>
            </div>
            <div className="lx-worlds-caption" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <m.p
                  key={active}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.5, ease: GLIDE }}
                >
                  <span className="lx-worlds-caption-label">Now drawing</span>
                  {WORLD_IDEAS[active].form}
                </m.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="lx-worlds-list" ref={listRef}>
            {WORLD_IDEAS.map((idea, index) => <WorldArticle key={idea.topic} idea={idea} index={index} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorldArticle({ idea, index }: { idea: WorldIdea; index: number }) {
  const id = `world-${index + 1}`;
  return (
    <article className="lx-world" id={id} aria-labelledby={`${id}-title`} data-world={index + 1}>
      <Rise className="lx-world-card" y={50} amount={0.35} blur={false}>
        <div className="lx-world-meta">
          <span className="lx-world-symbol" aria-hidden="true">{idea.symbol}</span>
          <span>{String(index + 1).padStart(2, '0')} / 04</span>
        </div>
        <h3 id={`${id}-title`} className="lx-world-title">{idea.topic}</h3>
        <p className="lx-world-line">{idea.line}</p>
        <figure className="lx-theorem">
          <figcaption className="lx-theorem-head">{idea.name}</figcaption>
          <MathText className="lx-theorem-formula" text={idea.formula} />
        </figure>
        <a className="lx-link" href={`/?auth=signup&tab=learn&topic=${encodeURIComponent(idea.topic)}`}>
          Explore {idea.topic.toLowerCase()} <Arrow direction="right" size={15} />
        </a>
      </Rise>
    </article>
  );
}
