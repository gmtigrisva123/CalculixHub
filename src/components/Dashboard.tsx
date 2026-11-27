/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { MoonStar, Sun, Sunrise, Sunset } from 'lucide-react';
import type { UserStats, WeeklyChallenge, Contest, Topic, Level } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { RACE_STORAGE, parseRaceDay } from '../domain/raceDay';
import { getLastNDateKeys } from '../domain/streak';
import { spring } from '../lib/motion';
import { TOPIC_LIST } from '../lib/topics';
import '../styles/dashboard-refresh.css';
import DashboardHero from './dashboard/DashboardHero';
import Instruments from './dashboard/Instruments';
import TopicTiles from './dashboard/TopicTiles';
import MomentumChart from './dashboard/MomentumChart';
import ProofTile from './dashboard/ProofTile';
import NextAdventure from './dashboard/NextAdventure';
import RaceDay from './dashboard/RaceDay';
import { activeDays, dailyPoints, greeting, pointsCurve, standing, thinnestTopic, weekTotal } from './dashboard/dashboardModel';

interface DashboardProps { minutesPerDay?: number; userStats: UserStats; weeklyChallenges: WeeklyChallenge[]; contests: Contest[]; onNavigateToTab: (tab: string, arg?: { topic?: Topic; level?: Level }) => void; onJoinChallenge: (id: string) => void; onJoinContest: (id: string) => void; onRewardPoints?: (pts: number) => void; }

/** Whether a contest day has been set on this device, read once when the page opens. */
const hasRaceDay = (): boolean => {
  try { return Boolean(parseRaceDay(localStorage.getItem(RACE_STORAGE))); } catch { return false; }
};

/**
 * The workspace home, in the order a learner uses it:
 *
 *   1. what to do next (and the countdown, for someone training for a date);
 *   2. where they stand: the four figures, then this week day by day, beside
 *      what is coming up;
 *   3. the four topics, to choose from;
 *   4. one proof to look at.
 *
 * Presentation only: every figure is read from the props, and every action
 * calls the handler it always did. The animation stops on the hero's pause
 * control, off screen, in a hidden tab, and under reduced motion.
 */
export default function Dashboard({ minutesPerDay = 30, userStats: stats, weeklyChallenges, contests, onNavigateToTab: navigate, onJoinChallenge, onJoinContest }: DashboardProps) {
  const still = Boolean(useReducedMotion());
  const { profile } = useAuth();
  const [paused, setPaused] = useState(false);
  const togglePause = useCallback(() => setPaused((value) => !value), []);
  const rootRef = useSpotlight<HTMLDivElement>();
  // A countdown someone set is the first thing they want; the offer to set one can wait below.
  const [training] = useState(hasRaceDay);

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
  const focus = thinnestTopic(stats.skills, TOPIC_LIST);

  const now = new Date();
  const hour = now.getHours();
  const GreetingIcon = hour < 5 ? MoonStar : hour < 12 ? Sunrise : hour < 18 ? Sun : Sunset;
  const firstName = (profile?.display_name || '').trim().split(/\s+/)[0] ?? '';
  const intro = (delay: number) => ({
    initial: still ? (false as const) : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring.smooth, delay },
  });

  const raceDay = <RaceDay skills={stats.skills} minutesPerDay={minutesPerDay} navigate={navigate} still={still} />;

  return (
    <div className="dh" ref={rootRef} data-dh-paused={paused || undefined}>
      <header className="dh-head">
        <m.p className="dh-greeting" {...intro(0)}>
          <GreetingIcon size={15} aria-hidden="true" />
          <span>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </m.p>
        <m.h1 className="dh-title" {...intro(0.04)}>
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ''}.
        </m.h1>
        <m.p className="dh-sub" {...intro(0.1)}>
          {standing({ streak: stats.streak, weekPoints, solved: stats.completedCount })}
        </m.p>
      </header>

      <DashboardHero still={still} paused={paused} focus={focus} onTogglePause={togglePause} onBegin={(topic) => navigate('learn', topic ? { topic } : undefined)} />

      {training && raceDay}

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
      </div>

      {!training && raceDay}

      <TopicTiles skills={stats.skills} still={still} paused={paused} navigate={navigate} />

      <ProofTile still={still} paused={paused} navigate={navigate} />
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
