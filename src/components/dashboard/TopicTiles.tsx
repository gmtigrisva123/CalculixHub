/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The four domains, each a door into Learn.
 *
 * A tile is a medallion -- a ring that fills to the learner's mastery, around a
 * small proof that keeps working -- then the name, a line about the subject and
 * the mastery figure itself. The ring is drawn from the same number the text
 * states, so the two can never disagree.
 */

import { useCallback, useRef } from 'react';
import { m, useInView } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { Level, Topic } from '../../../shared/types';
import { spring } from '../../lib/motion';
import { TOPIC_LIST } from '../../lib/topics';
import { AnimatedNumber } from '../motion';
import { clampPercent, formatLike, TOPIC_KEY } from './dashboardModel';
import { createGlyph } from './glyphs';
import { useCanvasScene } from './useCanvasScene';

const DESCRIPTIONS: Record<Topic, string> = {
  Algebra: 'Make the patterns click',
  Geometry: 'See a different angle',
  Combinatorics: 'Count the possibilities',
  'Number Theory': 'Discover what adds up',
};

const RING = 46;

interface TopicTilesProps {
  skills: Record<Topic, number>;
  still: boolean;
  paused: boolean;
  navigate: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
}

export default function TopicTiles({ skills, still, paused, navigate }: TopicTilesProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gridRef, { once: true, amount: 0.25 });
  const shown = still || inView;

  return (
    <section className="dh-topics" aria-labelledby="dh-topics-title">
      <div className="dh-section-head">
        <div>
          <h2 id="dh-topics-title">Follow your curiosity</h2>
          <p>Four different ways to see the world.</p>
        </div>
        <button type="button" className="dh-link" onClick={() => navigate('learn')}>
          Explore all <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="dh-topic-grid" ref={gridRef}>
        {TOPIC_LIST.map((topic, index) => (
          <TopicTile
            key={topic}
            topic={topic}
            index={index}
            // Same clamp as ever: a mastery outside 0–100 is shown at the nearest end.
            mastery={clampPercent(skills[topic] || 0)}
            shown={shown}
            still={still}
            paused={paused}
            onOpen={() => navigate('learn', { topic })}
          />
        ))}
      </div>
    </section>
  );
}

interface TopicTileProps {
  topic: Topic;
  index: number;
  mastery: number;
  shown: boolean;
  still: boolean;
  paused: boolean;
  onOpen: () => void;
}

function TopicTile({ topic, index, mastery, shown, still, paused, onOpen }: TopicTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boost = useRef(0);
  const create = useCallback(() => createGlyph(topic, still, boost), [topic, still]);
  useCanvasScene(canvasRef, create, { still, paused, fps: 30 });

  const sweep = (mastery / 100) * Math.PI * 2;
  const cap = { x: 50 + Math.cos(sweep) * RING, y: 50 + Math.sin(sweep) * RING };
  const settled = formatLike(mastery, mastery);

  return (
    <m.button
      type="button"
      className="dh-card dh-topic"
      data-topic={TOPIC_KEY[topic]}
      onClick={onOpen}
      onPointerEnter={() => (boost.current = 1)}
      onPointerLeave={() => (boost.current = 0)}
      onFocus={() => (boost.current = 1)}
      onBlur={() => (boost.current = 0)}
      initial={still ? false : { opacity: 0, y: 16 }}
      animate={shown ? { opacity: 1, y: 0 } : undefined}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      transition={{ ...spring.smooth, delay: shown ? index * 0.07 : 0 }}
    >
      <span className="dh-topic-top">
        <span className="dh-medallion" aria-hidden="true">
          <svg className="dh-ring" viewBox="0 0 100 100">
            <circle className="dh-ring-track" cx="50" cy="50" r={RING} />
            {mastery > 0 && (
              <>
                <m.circle
                  className="dh-ring-fill"
                  cx="50"
                  cy="50"
                  r={RING}
                  initial={still ? false : { pathLength: 0 }}
                  animate={{ pathLength: shown ? mastery / 100 : 0 }}
                  transition={{ ...spring.data, delay: 0.15 + index * 0.07 }}
                />
                <m.circle
                  className="dh-ring-cap"
                  cx={cap.x}
                  cy={cap.y}
                  r="4.4"
                  initial={still ? false : { opacity: 0 }}
                  animate={{ opacity: shown ? 1 : 0 }}
                  transition={{ duration: 0.3, delay: 0.75 + index * 0.07 }}
                />
              </>
            )}
          </svg>
          <canvas ref={canvasRef} className="dh-glyph" />
        </span>
        <ArrowUpRight className="dh-topic-arrow" size={18} aria-hidden="true" />
      </span>
      <span className="dh-topic-name">{topic}</span>
      <span className="dh-topic-desc">{DESCRIPTIONS[topic]}</span>
      <span className="dh-topic-foot">
        <span>{mastery ? 'Your growing confidence' : 'A new world to explore'}</span>
        <strong>
          <span aria-hidden="true">
            <AnimatedNumber value={shown ? mastery : 0} format={(value) => formatLike(value, mastery)} />%
          </span>
          <span className="sr-only">{settled}%</span>
        </strong>
      </span>
    </m.button>
  );
}
