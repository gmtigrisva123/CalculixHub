/* Hallmark · pre-emit critique: P5 H5 E5 S5 R4 V5 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { MoonStar, Sun, Sunrise, Sunset } from 'lucide-react';
import type { UserStats, WeeklyChallenge, Contest, Topic, Level } from '../../shared/types';
import { getLastNDateKeys } from '../domain/streak';
import { ease, spring } from '../lib/motion';
import '../styles/dashboard-refresh.css';
import DashboardHero from './dashboard/DashboardHero';
import Instruments from './dashboard/Instruments';
import TopicTiles from './dashboard/TopicTiles';
import MomentumChart from './dashboard/MomentumChart';
import ProofTile from './dashboard/ProofTile';
import NextAdventure from './dashboard/NextAdventure';
import { activeDays, dailyPoints, greeting, pointsCurve, weekTotal } from './dashboard/dashboardModel';

interface DashboardProps { userStats: UserStats; weeklyChallenges: WeeklyChallenge[]; contests: Contest[]; onNavigateToTab: (tab: string, arg?: { topic?: Topic; level?: Level }) => void; onJoinChallenge: (id: string) => void; onJoinContest: (id: string) => void; onRewardPoints?: (pts: number) => void; }

const QUOTE = 'Mathematics is the art of giving the same name to different things.';

/**
 * The workspace home.
 *
 * Presentation only: every figure is read from the props exactly as before,
 * and every action calls the same handler with the same arguments. What
 * changed is how it looks and moves -- a night stage with a drawing machine,
 * instruments that draw their own numbers, and four topic medallions that keep
 * a small proof running. All of it stops on the hero's pause control, off
 * screen, in a hidden tab, and under reduced motion.
 */
export default function Dashboard({ userStats: stats, weeklyChallenges, contests, onNavigateToTab: navigate, onJoinChallenge, onJoinContest }: DashboardProps) {
  const still = Boolean(useReducedMotion());
  const [paused, setPaused] = useState(false);
  const togglePause = useCallback(() => setPaused((value) => !value), []);
  const rootRef = useSpotlight<HTMLDivElement>();

  const days = getLastNDateKeys(7);
  const timeline = stats.learningTimeline || [];
  const daily = dailyPoints(timeline, days);
  const weekPoints = weekTotal(daily);
  const practised = activeDays(timeline, days);
  const week = days.map((date, i) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    active: practised[i],
    today: i === days.length - 1,
  }));

  const now = new Date();
  const hour = now.getHours();
  const GreetingIcon = hour < 5 ? MoonStar : hour < 12 ? Sunrise : hour < 18 ? Sun : Sunset;
  const intro = (delay: number) => ({
    initial: still ? (false as const) : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring.smooth, delay },
  });

  return (
    <div className="dh" ref={rootRef} data-dh-paused={paused || undefined}>
      <header className="dh-head">
        <m.p className="dh-greeting" {...intro(0)}>
          <GreetingIcon size={15} aria-hidden="true" />
          <span>{greeting(hour)}</span>
          <span className="dh-greeting-dot" aria-hidden="true" />
          <span>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </m.p>
        <m.h1 className="dh-title" {...intro(0.04)}>
          A little time{' '}
          <span className="dh-title-accent">
            to understand.
            <svg className="dh-title-underline" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
              <m.path
                d="M3 11 C 70 3, 170 2, 297 8"
                initial={still ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.55, duration: 0.8, ease: ease.standard }}
              />
            </svg>
          </span>
        </m.h1>
        <m.p className="dh-sub" {...intro(0.1)}>
          Pick something interesting. Take it at your own pace.
        </m.p>
      </header>

      <DashboardHero still={still} paused={paused} onTogglePause={togglePause} onBegin={() => navigate('learn')} />

      <Instruments
        points={stats.points}
        weekPoints={weekPoints}
        curve={pointsCurve(timeline)}
        solved={stats.completedCount}
        accuracy={stats.accuracy}
        streak={stats.streak}
        week={week}
        still={still}
      />

      <TopicTiles skills={stats.skills} still={still} paused={paused} navigate={navigate} />

      <div className="dh-bento">
        <MomentumChart daily={daily} weekPoints={weekPoints} still={still} onProgress={() => navigate('progress')} />
        <NextAdventure
          weeklyChallenges={weeklyChallenges}
          contests={contests}
          onJoinChallenge={onJoinChallenge}
          onJoinContest={onJoinContest}
          navigate={navigate}
          still={still}
        />
        <ProofTile still={still} paused={paused} navigate={navigate} />
      </div>

      <figure className="dh-quote">
        <blockquote>
          <p>
            <span aria-hidden="true">“</span>
            {QUOTE.split(' ').map((word, i) => (
              <Fragment key={`${word}-${i}`}>
                {i > 0 && ' '}
                <m.span
                  className="dh-quote-word"
                  initial={still ? false : { opacity: 0, y: 8, filter: 'blur(6px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.55, delay: i * 0.045, ease: ease.standard }}
                >
                  {word}
                </m.span>
              </Fragment>
            ))}
            <span aria-hidden="true">”</span>
          </p>
        </blockquote>
        <figcaption>Henri Poincaré</figcaption>
      </figure>
    </div>
  );
}

/**
 * Lets the card under a fine pointer catch the light where the pointer is.
 *
 * One listener on the dashboard rather than one per card, coalesced to a frame,
 * and only where hover exists at all.
 */
function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const card = (last?.target as Element | null)?.closest?.('.dh-card') as HTMLElement | null;
      if (!last || !card || !root.contains(card)) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--dh-mx', `${last.clientX - box.left}px`);
      card.style.setProperty('--dh-my', `${last.clientY - box.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    root.addEventListener('pointermove', onMove);
    return () => {
      root.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
