/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Flame, Trophy, Percent, Clock, Sparkles, Brain, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import { UserStats, WeeklyChallenge, Contest, AIRecommendation, Topic, Level } from '../../shared/types';
import { TOPIC_META, getRankForPoints, formatMinutes } from '../lib/topics';
import { getLastNDateKeys } from '../domain/streak';
import { apiUrl } from '../services/apiBase';
import { duration, ease, spring, staggerDelay, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';
import { TiltCard, TiltLayer } from './surface';
import DailyReflexWidget from './DailyReflexWidget';

interface DashboardProps {
  userStats: UserStats;
  weeklyChallenges: WeeklyChallenge[];
  contests: Contest[];
  onNavigateToTab: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
  onJoinChallenge: (id: string) => void;
  onJoinContest: (id: string) => void;
  onRewardPoints?: (pts: number) => void;
}

export default function Dashboard({
  userStats,
  weeklyChallenges,
  contests,
  onNavigateToTab,
  onJoinChallenge,
  onJoinContest,
  onRewardPoints,
}: DashboardProps) {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const fetchAIRecommendations = async () => {
      setLoadingAI(true);
      try {
        const response = await fetch(apiUrl('/api/recommend'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: userStats.points,
            completedCount: userStats.completedCount,
            accuracy: userStats.accuracy,
            skills: userStats.skills,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendation(data);
        }
      } catch (err) {
        console.error('Error fetching AI recommendation:', err);
      } finally {
        setLoadingAI(false);
      }
    };

    fetchAIRecommendations();
  }, [userStats.points, userStats.completedCount, userStats.accuracy, userStats.skills]);

  const rank = getRankForPoints(userStats.points);

  // Ambient loops on this screen: the streak flame and the recommendation
  // sparkle. Both keep their appearance and stop costing frames off-screen.
  const flameRef = useAmbient<SVGSVGElement>();
  const aiSparkleRef = useAmbient<SVGSVGElement>();

  /*
   * Nothing measured yet is a real state, not a loading state, and the design
   * gives it its own copy. A dashboard that shows "100% accuracy" over zero
   * answers is worse than one that says it has not measured anything: the
   * figure is arithmetically true and completely meaningless, and the learner
   * has no way to tell it apart from a real one.
   */
  const unmeasured = userStats.completedCount === 0;

  return (
    <div className="space-y-7">
      {/*
        The hero band.

        The one surface in the product made of the opposite material to the page
        around it: an ink block on paper by day, and after dark the same block
        on a ground that has come down to meet it. It is absolute in both
        themes, hence `ramp-static` — see the note in styles/tokens.css.

        It no longer tilts, and there is no graph paper or corner bracketry
        under it. Those belonged to an instrument-panel metaphor; this system's
        hero is a colophon page, and its only decoration is the warm light
        thrown across it.
      */}
      <section className="ramp-static cx-band rounded-card px-8 py-10 md:px-11 md:py-11">
        <div className="cx-band__wash" aria-hidden="true" />

        <div className="relative max-w-[60ch]">
          <p className="cx-pill">
            <Trophy className="w-3 h-3" /> CalculixHub Operating System
          </p>
          <h1 className="type-display mt-5 text-stone-50">
            {unmeasured
              ? 'Take the placement test to begin'
              : 'Sharpen how you think, not just what you remember'}
          </h1>
          <p className="type-lead mt-4 text-stone-400">
            {unmeasured
              ? 'Nothing here is measured yet. Eight to sixteen questions is all it takes to fill this page in.'
              : 'Every session here is built to strengthen structural reasoning, not rote memorisation — practice that actually moves your ceiling.'}
          </p>
          <div className="mt-6.5 flex flex-wrap gap-3">
            <m.button
              onClick={() => onNavigateToTab('learn')}
              whileTap={{ scale: 0.96 }}
              transition={spring.press}
              className="cx-btn cx-btn-fill"
            >
              <Brain className="w-3.75 h-3.75" /> Start practising
            </m.button>
            <m.button
              onClick={() => onNavigateToTab('progress')}
              whileTap={{ scale: 0.96 }}
              transition={spring.press}
              className="cx-btn cx-btn-on-dark"
            >
              View analytics
            </m.button>
          </div>
        </div>
      </section>

      {/* Daily Math Reflex Warm-up Puzzle */}
      <DailyReflexWidget onRewardXP={onRewardPoints} />

      {/*
        Stats.

        Four hue-tinted panels, one per figure, drawn as a border and an 8%
        wash — never a filled block. The cards arrive in a short left-to-right
        wave, which gives the row a reading order, and every figure counts to
        its value so a session that earned points shows the gain happening
        rather than presenting a number that was apparently always there.
      */}
      <section className="grid [grid-template-columns:repeat(auto-fit,minmax(14.5rem,1fr))] gap-4.5">
        <StaggerItem index={0} className="cx-card-quantum cx-tint-algebra flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-[0.18em]">Rank tier</p>
              <h3 className="cx-figure mt-1">{rank.name}</h3>
            </div>
            <Trophy className="w-4.5 h-4.5 text-amber-600 shrink-0" />
          </div>
          <div className="mt-5">
            <div className="mb-1.75 flex justify-between text-[11.5px] text-content-muted tnum">
              <span><AnimatedNumber value={userStats.points} /> pts</span>
              <span>{userStats.level || 'Unplaced'}</span>
            </div>
            <SpringBar
              value={(userStats.points / 500) * 100}
              track="w-full h-0.5 bg-line-strong"
              fill="h-0.5 bg-accent"
              label="Progress toward 500 points"
            />
          </div>
        </StaggerItem>

        <StaggerItem index={1} className="cx-card-quantum cx-tint-algebra flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-[0.18em]">Daily streak</p>
              <h3 className="cx-figure mt-1">
                <AnimatedNumber value={userStats.streak} /> days
              </h3>
            </div>
            <Flame
              ref={flameRef}
              className={`w-4.5 h-4.5 shrink-0 ${userStats.streak > 0 ? 'text-accent animate-pulse' : 'text-content-subtle'}`}
            />
          </div>
          <p className="type-caption mt-5 leading-[1.6] text-content-muted">
            {userStats.streak > 0
              ? 'Streak is live — keep it going to hold your compounding gains.'
              : 'Solve one problem today to light the first flame.'}
          </p>
        </StaggerItem>

        <StaggerItem index={2} className="cx-card-quantum cx-tint-number-theory flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-[0.18em]">Accuracy</p>
              <h3 className={`cx-figure mt-1 ${unmeasured ? 'text-content-subtle' : ''}`}>
                {unmeasured ? 'Not measured' : <><AnimatedNumber value={userStats.accuracy} />%</>}
              </h3>
            </div>
            <Percent className="w-4.5 h-4.5 text-sky-700 shrink-0" />
          </div>
          {unmeasured ? (
            <p className="type-caption mt-5 leading-[1.6] text-content-muted">Needs at least one graded answer.</p>
          ) : (
            <div className="mt-5">
              <div className="mb-1.75 flex justify-between text-[11.5px] text-content-muted tnum">
                <span><AnimatedNumber value={userStats.completedCount} /> solved</span>
                <span>Target 80%</span>
              </div>
              <SpringBar
                value={userStats.accuracy}
                track="w-full h-0.5 bg-line-strong"
                fill="h-0.5 bg-accent"
                label="Current accuracy"
              />
            </div>
          )}
        </StaggerItem>

        <StaggerItem index={3} className="cx-card-quantum cx-tint-geometry flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-eyebrow text-content-subtle tracking-[0.18em]">Time invested</p>
              <h3 className="cx-figure mt-1">{formatMinutes(userStats.timeSpent)}</h3>
            </div>
            <Clock className="w-4.5 h-4.5 text-proof shrink-0" />
          </div>
          <p className="type-caption mt-5 leading-[1.6] text-content-muted">
            {unmeasured
              ? 'Counted from your first session onward.'
              : <>Roughly <b className="font-normal italic">{Math.max(1, Math.round(userStats.timeSpent / 25))} focused sessions</b> so far.</>}
          </p>
        </StaggerItem>
      </section>

      {/* Streak calendar: which of the last 7 real calendar days had activity */}
      <section className="cx-card bg-surface-raised/50 px-6.5 pt-6.5 pb-7">
        <div className="mb-5.5 flex items-start justify-between gap-5">
          <div>
            <h3 className="type-title text-[23px]">Streak calendar</h3>
            <p className="type-caption mt-1 text-content-subtle">Lights up on every real day you showed up and practised.</p>
          </div>
          <span className="cx-tag cx-tag-neutral shrink-0 px-2.75 py-1.5">
            {userStats.streak} {userStats.streak === 1 ? 'day' : 'days'} active
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {getLastNDateKeys(7).map((dateKey, index) => {
            const isActive = (userStats.learningTimeline || []).some((t) => t.date === dateKey);
            const isToday = dateKey === new Date().toISOString().slice(0, 10);
            const dayLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = new Date(`${dateKey}T00:00:00`).getDate();
            return (
              <div key={dateKey} className="flex flex-col items-center gap-2">
                <span className="type-eyebrow text-content-subtle tracking-[0.16em] text-[9px]">{dayLabel}</span>
                {/*
                  The week lights up left to right, one day at a time. It is the
                  one place in the product where a stagger is not just ordering
                  — the sequence is the week passing, and an active day landing
                  with a spring is the small reward for having shown up.

                  A day that has not happened is a dashed outline, not a filled
                  grey tile: the calendar reads as a form waiting to be filled
                  in rather than as seven disabled buttons.
                */}
                <m.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...spring.snappy, delay: staggerDelay(index, 0.04) }}
                  className={`flex aspect-square w-full items-center justify-center rounded-[3px] transition-[background-color,border-color] duration-240 ease-standard ${
                    isActive
                      ? 'border border-accent/45 bg-accent/10'
                      : 'border border-dashed border-content/22 bg-content/4'
                  } ${isToday ? 'ring-2 ring-accent/30' : ''}`}
                >
                  <Flame className={`w-4 h-4 sm:w-4.25 sm:h-4.25 ${isActive ? 'text-accent' : 'text-stone-350'}`} />
                </m.div>
                <span className={`text-[10px] tnum ${isToday ? 'text-accent-text' : 'text-content-subtle'}`}>{dayNum}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* AI recommendation */}
        <div className="space-y-4.5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="type-title text-[26px]">Practice recommendation</h2>
            <span className="type-eyebrow text-content-subtle tracking-[0.18em]">Calculix Practice Coach</span>
          </div>

          <div className="cx-card cx-tint-combinatorics p-6.5">
            {/*
              Skeleton to content.

              Cross-fading through AnimatePresence in wait mode gives the
              arrival of a real recommendation a beat of its own, and the height
              settles on a spring rather than jumping.
            */}
            <AnimatePresence mode="wait" initial={false}>
            {loadingAI ? (
              <m.div
                key="ai-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: duration.instant, ease: ease.exit } }}
                transition={{ duration: duration.base, ease: ease.standard }}
                className="space-y-3 py-4"
              >
                <div className="h-4 w-1/3 animate-pulse rounded-sm bg-violet-200/60" />
                <div className="h-14 animate-pulse rounded-sm bg-violet-100/60" />
                <div className="h-8 animate-pulse rounded-sm bg-violet-100/60" />
              </m.div>
            ) : recommendation ? (
              <m.div
                key="ai-loaded"
                initial={{ opacity: 0, y: travel.sm }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: duration.instant, ease: ease.exit } }}
                transition={spring.smooth}
                className="space-y-4.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-eyebrow text-violet-600">Focus topic</span>
                  {recommendation.isFallback && (
                    <span className="cx-tag cx-tag-accent">
                      <AlertTriangle className="mr-1.5 h-3 w-3" /> Offline fallback
                    </span>
                  )}
                </div>

                <p className="type-body italic text-content">&ldquo;{recommendation.recommendation}&rdquo;</p>

                <div className="flex gap-5 border-t border-line-faint pt-4.5">
                  <div className="shrink-0">
                    <span className="type-eyebrow block text-content-subtle">Target tier</span>
                    <span className="mt-1.5 block font-serif text-[19px]">{recommendation.suggestedLevel}</span>
                  </div>
                  <p className="type-caption leading-[1.7] text-content-muted">{recommendation.rationale}</p>
                </div>

                <m.button
                  onClick={() => onNavigateToTab('learn', { topic: recommendation.recommendedTopic, level: recommendation.suggestedLevel })}
                  whileTap={{ scale: 0.96 }}
                  transition={spring.press}
                  className="cx-btn group border-violet-500/50 py-2.75 text-violet-600"
                >
                  Reinforce {TOPIC_META[recommendation.recommendedTopic].label}
                  <ChevronRight className="w-3.75 h-3.75 transition-transform duration-160 ease-standard group-hover:translate-x-0.5" />
                </m.button>
              </m.div>
            ) : (
              /*
                The empty state says what it is waiting for rather than
                apologising. "The engine will not guess" is the whole product
                argument in one line, and this is the first place a new learner
                meets it.
              */
              <m.div
                key="ai-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.standard }}
                className="py-4 text-center"
              >
                <Sparkles ref={aiSparkleRef} className="mx-auto h-5.5 w-5.5 text-violet-600" />
                <p className="mt-3.5 font-serif text-[22px]">Nothing to recommend yet</p>
                <p className="type-caption mx-auto mt-1.5 max-w-[42ch] leading-[1.7] text-content-muted">
                  The engine will not guess at your weakest topic before it has measured one.
                </p>
                <button
                  onClick={() => onNavigateToTab('learn')}
                  className="cx-btn mt-5 border-violet-500/50 py-2.75 text-violet-600"
                >
                  Answer the first question <ChevronRight className="w-3.75 h-3.75" />
                </button>
              </m.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* Competition */}
        <div className="space-y-4.5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="type-title text-[26px]">Competition</h2>
            <button
              onClick={() => onNavigateToTab('compete')}
              className="type-eyebrow text-accent-text tracking-[0.14em] cursor-pointer hover:underline underline-offset-4"
            >
              View all
            </button>
          </div>

          {contests.slice(0, 2).map((cont, index) => (
            <StaggerItem key={cont.id} index={index} inView className="cx-card p-5">
              <div className="flex items-start justify-between gap-3.5">
                <div>
                  <span className={`cx-tag ${cont.joined ? 'text-proof border-proof/45' : 'cx-tag-accent'} mb-2.5 inline-flex text-[9px] tracking-[0.16em]`}>
                    {cont.joined ? 'Registered' : 'Upcoming arena'}
                  </span>
                  <h3 className="type-title text-[21px]">{cont.title}</h3>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-content-subtle tnum">{cont.duration}</span>
              </div>
              <div className="mt-4.5 flex items-center justify-between gap-3.5 border-t border-line-faint pt-4">
                <span className="text-[12.5px] text-content-subtle">
                  Date <span className="text-content">{cont.date}</span>
                </span>
                <m.button
                  onClick={() => onJoinContest(cont.id)}
                  whileTap={{ scale: 0.95 }}
                  transition={spring.press}
                  className={`cx-btn px-4 py-2 text-[15px] ${cont.joined ? 'border-proof/50 text-proof' : 'cx-btn-primary'}`}
                >
                  {/*
                    Registering swaps the label in place. Keying the text makes
                    that read as a confirmation rather than as the button having
                    been relabelled behind the user's back.
                  */}
                  <AnimatePresence mode="wait" initial={false}>
                    <m.span
                      key={cont.joined ? 'joined' : 'join'}
                      className="block"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: duration.fast, ease: ease.standard }}
                    >
                      {cont.joined ? 'Registered' : 'Open'}
                    </m.span>
                  </AnimatePresence>
                </m.button>
              </div>
            </StaggerItem>
          ))}

          {/* Weekly challenge — the second dark object on the page, and the last. */}
          {weeklyChallenges[0] && (
            <div className="ramp-static cx-band rounded-card p-6.5">
              <div className="cx-band__wash" aria-hidden="true" />
              <div className="relative">
                <h3 className="type-title text-[23px] text-stone-50">{weeklyChallenges[0].title}</h3>
                <p className="type-caption mt-2.5 line-clamp-2 leading-[1.7] text-stone-400">
                  {weeklyChallenges[0].description}
                </p>
                <div className="mt-5.5 flex items-center justify-between gap-3.5 border-t border-[rgba(231,226,217,0.14)] pt-4">
                  <span className="text-[12px] text-stone-500">
                    Registered <span className="text-stone-200 tnum">{weeklyChallenges[0].participants}</span>
                  </span>
                  <m.button
                    onClick={() => { onJoinChallenge(weeklyChallenges[0].id); onNavigateToTab('compete'); }}
                    whileTap={{ scale: 0.95 }}
                    transition={spring.press}
                    className={`cx-btn px-4.5 py-2.25 text-[15px] ${weeklyChallenges[0].completed ? 'cx-btn-on-dark' : 'cx-btn-fill'}`}
                  >
                    {weeklyChallenges[0].completed ? 'Completed' : 'Start challenge'}
                  </m.button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
