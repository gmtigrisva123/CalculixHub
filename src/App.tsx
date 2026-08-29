/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { m } from 'motion/react';
import {
  Settings,
  Sparkles,
  Search,
  BookOpen,
  HelpCircle,
  Award,
  CheckCircle,
  LogOut,
} from 'lucide-react';
import { Problem, UserStats, WeeklyChallenge, Contest, CommunityDiscussion, LeaderboardEntry, Topic, Level } from '../shared/types';
import { computeStreak } from './domain/streak';
import { apiUrl, isNativePlatform } from './services/apiBase';
import { remindersEnabled, enableReminders, disableReminders, syncReminders } from './platform/reminders';
import { useOnlineStatus, useGradeQueueFlush, flushGradeQueue } from './platform/offline';
import PullToRefresh from './components/PullToRefresh';
import { NAV_ITEMS, screenTitle, type TabKey } from './lib/navigation';
import MobileHeader from './components/MobileHeader';
import MobileTabBar from './components/MobileTabBar';
import InstallAppButton from './components/InstallAppButton';
import Dashboard from './components/Dashboard';
import Learn from './components/Learn';
import Compete from './components/Compete';
import ProgressView from './components/ProgressView';
import Community from './components/Community';
import Profile from './components/Profile';
import ResearchAnalytics from './components/ResearchAnalytics';
import AITutorChat from './components/AITutorChat';
import WelcomeScreen from './components/WelcomeScreen';
import { TabTransition, SpringBar, AnimatedNumber, Collapse } from './components/motion';
import ThemeToggle from './components/ThemeToggle';
import { spring } from './lib/motion';
import { useAuth } from './context/AuthContext';
import { useLearnerSnapshot } from './services/data/people';

const DISCUSSION_CLEANUP_KEY = 'calculix_discussions_demo_cleanup_v1';
const LEGACY_DEMO_DISCUSSION_IDS = new Set(['disc-1', 'disc-2']);

const isLegacyDemoDiscussion = (discussion: CommunityDiscussion) => {
  const normalizedContent = discussion.content.trim().toLowerCase();

  return (
    LEGACY_DEMO_DISCUSSION_IDS.has(discussion.id) ||
    (discussion.role === 'Student' && normalizedContent === 'hello')
  );
};

export default function App() {
  /**
   * Opening tab, honouring a ?tab= query parameter.
   *
   * The manifest's app shortcuts ("Start practicing", "View analytics") launch
   * ./?tab=learn and ./?tab=progress, so a long-press on the installed icon can
   * land directly on a workspace. Read once during initial state rather than in
   * an effect, which would otherwise flash the dashboard first. Unknown values
   * fall through to the dashboard.
   */
  const [activeTab, setActiveTab] = useState<string>(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return NAV_ITEMS.some((item) => item.key === requested) ? requested! : 'dashboard';
  });

  // Deep navigation overrides for AI recommendations
  const [overrideFilters, setOverrideFilters] = useState<{ topic?: Topic; level?: Level } | undefined>(undefined);

  // Connectivity, and any answers captured while offline. The queue drains
  // automatically as soon as the connection returns.
  const online = useOnlineStatus();
  const pendingGrades = useGradeQueueFlush(online);

  /**
   * Authentication.
   *
   * `sessionStorage.getItem('calculix_is_logged_in') === 'true'` used to stand
   * in for this. That was not authentication: the browser owned the string, so
   * anyone could set it from a console, and it carried no identity the server
   * could act on. The session now comes from a server-signed JWT that Supabase
   * verifies on every request and that every row-level security policy reads.
   *
   * `status` distinguishes "still restoring" from "definitely signed out",
   * which is what stops a refresh flashing the landing page at a signed-in
   * learner before the session is rehydrated.
   */
  const { status: authStatus, profile, signOut, hasOnboarded } = useAuth();
  const isLoggedIn = authStatus === 'authenticated';

  const handleLoginSuccess = (name: string, level: Level, initialSkills?: Record<Topic, number>) => {

    // Seed the learner's tier and, when they came through the adaptive
    // placement test, their measured per-domain skill profile.
    const updatedStats: UserStats = {
      ...userStats,
      level,
      ...(initialSkills ? { skills: initialSkills } : {}),
    };
    saveStatsToLocal(updatedStats);
  };

  const handleLogout = async () => {
    // Revokes the refresh token server-side, so signing out actually ends the
    // session rather than only hiding it from this tab.
    await signOut();

    // Clear the local caches from the pre-database build. Progress now lives in
    // Postgres, so nothing of value is lost, but stale copies would otherwise
    // be shown to the next person to use this browser.
    for (const key of [
      'calculix_is_logged_in', 'calculix_user_name', 'calculix_stats',
      'calculix_completed', 'calculix_discussions', 'calculix_contests',
      'calculix_registered_users',
    ]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }

    setActiveTab('dashboard');
    setCompletedProblems([]);
    setUserStats({
      rank: 10,
      points: 0,
      streak: 0,
      completedCount: 0,
      accuracy: 100,
      timeSpent: 0,
      skills: {
        Algebra: 0,
        Geometry: 0,
        Combinatorics: 0,
        'Number Theory': 0,
      },
      weaknesses: [],
      learningTimeline: [],
    });
  };

  // States
  const [problems, setProblems] = useState<Problem[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallenge[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [discussions, setDiscussions] = useState<CommunityDiscussion[]>([]);
  const [completedProblems, setCompletedProblems] = useState<string[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    rank: 10,
    points: 0,
    streak: 0,
    completedCount: 0,
    accuracy: 100,
    timeSpent: 0,
    skills: {
      Algebra: 0,
      Geometry: 0,
      Combinatorics: 0,
      'Number Theory': 0,
    },
    weaknesses: [],
    learningTimeline: [],
  });

  /**
   * Progress, restored from the database.
   *
   * This is what makes an account mean something. Everything above initialises
   * `userStats` from localStorage, which is per-browser and per-device: a
   * learner who signed in on a second machine, cleared their cache, or simply
   * reinstalled the app saw zeros, no matter how much work the server had
   * faithfully recorded against their user id.
   *
   * The write half of this loop already existed and was already correct --
   * `/api/evaluate` verifies the caller's token and calls `recordAttempt`, and a
   * database trigger derives `user_stats` and `skill_mastery` from the appended
   * rows so the totals cannot drift from the attempts behind them. Only the read
   * back was missing, so the numbers accumulated where nothing displayed them.
   *
   * `useLearnerSnapshot` also subscribes to realtime changes on this learner's
   * row, which means a solve on the phone moves the total on the laptop without
   * a refresh.
   */
  const { data: snapshot } = useLearnerSnapshot(isLoggedIn ? profile?.id ?? null : null);

  useEffect(() => {
    // Signed out, practice is still local and localStorage remains correct.
    if (!isLoggedIn || !snapshot.stats) return;

    const row = snapshot.stats;

    setUserStats((previous) => ({
      ...previous,
      level: profile?.level ?? previous.level,
      points: row.points,
      streak: row.current_streak,
      completedCount: row.problems_solved,
      // Null until the learner has attempted anything; keeping the previous
      // value avoids flashing 0% accuracy at someone who has simply not started.
      accuracy: snapshot.accuracyPct ?? previous.accuracy,
      // The column is seconds and the UI is minutes.
      timeSpent: Math.round(row.time_spent_seconds / 60),
      skills: snapshot.skills,
    }));
  }, [isLoggedIn, snapshot, profile?.level]);

  // Settings State
  const [customGoal, setCustomGoal] = useState<string>('Qualify for a regional/national math olympiad');
  const [studyPace, setStudyPace] = useState<string>('30 minutes / day');
  // Reflects what is actually scheduled, not an optimistic default: the OS can
  // refuse permission, and the toggle must not claim to be on when it is not.
  const [studyReminders, setStudyReminders] = useState<boolean>(() => remindersEnabled());
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  /**
   * Turn the daily reminder on or off.
   *
   * Permission is requested here rather than on load because browsers reject
   * unsolicited prompts, and iOS only offers notifications to an installed PWA
   * at all — so a refusal needs explaining rather than silently failing.
   */
  const handleToggleReminders = async (enabled: boolean) => {
    if (!enabled) {
      await disableReminders();
      setStudyReminders(false);
      setReminderNotice(null);
      return;
    }

    const result = await enableReminders();

    if (result === 'granted') {
      setStudyReminders(true);
      setReminderNotice(
        isNativePlatform()
          ? null
          : 'Reminders are on. In a browser tab they only appear while CalculixHub is open — install the app for reminders that arrive on their own.',
      );
      return;
    }

    // Permission was not granted, so nothing is scheduled. Leave the toggle off.
    setStudyReminders(false);
    setReminderNotice(
      result === 'denied'
        ? 'Notifications are blocked for CalculixHub. Re-enable them in your browser or system settings, then try again.'
        : result === 'unsupported'
          ? 'This browser cannot show notifications. Install the app to get streak reminders.'
          : 'Reminders need notification permission. Tap the toggle again and choose Allow.',
    );
  };
  const [saveSuccessNotify, setSaveSuccessNotify] = useState<boolean>(false);

  // 1. Fetch static math database problems
  //
  // Declared outside the mount effect because pull-to-refresh re-runs both
  // fetches on demand. Offline these resolve from the service worker cache, so
  // a refresh with no connection still repopulates rather than blanking the UI.
  const fetchProblems = async () => {
    try {
      const response = await fetch(apiUrl('/api/problems'));
      if (response.ok) {
        const data = await response.json();
        setProblems(data);
      }
    } catch (err) {
      console.error('Error fetching math catalog:', err);
    }
  };

  // 2. Fetch standard seeds (Leaderboard, etc.)
  const fetchSeeds = async () => {
    try {
      const response = await fetch(apiUrl('/api/statistics-seed'));
      if (response.ok) {
        const data = await response.json();
        setWeeklyChallenges(data.weeklyChallenges || []);
        setContests(data.contests || []);
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching math seeds:', err);
    }
  };

  /** Pull-to-refresh handler: re-read server data and replay anything queued. */
  const handleRefresh = async () => {
    await Promise.all([fetchProblems(), fetchSeeds(), flushGradeQueue()]);
  };

  // Load from database seeds & localStorage on mount
  useEffect(() => {
    fetchProblems();
    fetchSeeds();

    // Re-arm the daily reminder. Normally a no-op, since iOS keeps scheduled
    // notifications across restarts; it matters after a reinstall, where the
    // stored preference says enabled but nothing is actually scheduled.
    void syncReminders();

    // 3. Sync local storage states
    const localCompleted = localStorage.getItem('calculix_completed');
    if (localCompleted) {
      setCompletedProblems(JSON.parse(localCompleted));
    }

    const localStats = localStorage.getItem('calculix_stats');
    if (localStats) {
      const parsedStats: UserStats = JSON.parse(localStats);
      // Recompute on load too, not just after the next solve — otherwise a
      // stale streak number could linger for a full day after a miss.
      parsedStats.streak = computeStreak((parsedStats.learningTimeline || []).map((t) => t.date));
      setUserStats(parsedStats);
    }

    const localDiscussions = localStorage.getItem('calculix_discussions');
    if (localDiscussions) {
      const parsedDiscussions = JSON.parse(localDiscussions) as CommunityDiscussion[];
      const shouldCleanDemoDiscussions = !localStorage.getItem(DISCUSSION_CLEANUP_KEY);
      const storedDiscussions = shouldCleanDemoDiscussions
        ? parsedDiscussions.filter((discussion) => !isLegacyDemoDiscussion(discussion))
        : parsedDiscussions;

      if (shouldCleanDemoDiscussions) {
        localStorage.setItem(DISCUSSION_CLEANUP_KEY, 'true');
        if (storedDiscussions.length > 0) {
          localStorage.setItem('calculix_discussions', JSON.stringify(storedDiscussions));
        } else {
          localStorage.removeItem('calculix_discussions');
        }
      }

      setDiscussions(storedDiscussions);
    }

    const localContests = localStorage.getItem('calculix_contests');
    if (localContests) {
      setContests(JSON.parse(localContests));
    }
  }, []);

  // Sync to local storage on edits
  const saveStatsToLocal = (newStats: UserStats) => {
    setUserStats(newStats);
    localStorage.setItem('calculix_stats', JSON.stringify(newStats));
  };

  const handleRewardPoints = (pts: number) => {
    const updatedUserStats: UserStats = {
      ...userStats,
      points: userStats.points + pts,
    };
    saveStatsToLocal(updatedUserStats);
  };

  // Solve problem event trigger
  const handleSolveProblemStatus = (id: string, isCorrect: boolean, scorePoints: number) => {
    // 1. Update completed list if correct
    let updatedCompleted = [...completedProblems];
    if (isCorrect && !completedProblems.includes(id)) {
      updatedCompleted.push(id);
      setCompletedProblems(updatedCompleted);
      localStorage.setItem('calculix_completed', JSON.stringify(updatedCompleted));
    }

    // 2. Estimate skill map adaptively
    const problem = problems.find((p) => p.id === id);
    let updatedSkills = { ...userStats.skills };
    if (problem) {
      const topicName = problem.topic;
      const currentScale = updatedSkills[topicName] || 50;
      if (isCorrect) {
        // Boost score for correct solution
        updatedSkills[topicName] = Math.min(100, currentScale + 8);
      } else {
        // Moderate drag down or stable
        updatedSkills[topicName] = Math.max(0, currentScale - 2);
      }
    }

    // Sort skills to find weakest
    const skillList = Object.entries(updatedSkills) as [string, number][];
    skillList.sort((a, b) => a[1] - b[1]);
    const weakestName = skillList[0][0];

    // 3. Recalculate metrics
    const preCount = userStats.completedCount;
    const newCount = isCorrect ? preCount + 1 : preCount;

    const calculatedPoints = userStats.points + scorePoints;
    const tempAcc = isCorrect ? 100 : 0;
    const accumulatedAcc = Math.round((userStats.accuracy * 4 + tempAcc) / 5);
    const finalAccuracy = userStats.completedCount === 0 ? tempAcc : accumulatedAcc;

    // Track one real timeline point per attempt (capped) so the Progress
    // view's chart reflects actual history instead of a decorative fake line.
    const today = new Date().toISOString().slice(0, 10);
    const existingTimeline = userStats.learningTimeline || [];
    const withoutToday = existingTimeline.filter((entry) => entry.date !== today);
    const updatedTimeline = [...withoutToday, { date: today, points: calculatedPoints, accuracy: finalAccuracy }].slice(-14);

    const updatedUserStats: UserStats = {
      ...userStats,
      points: calculatedPoints,
      completedCount: newCount,
      accuracy: finalAccuracy,
      // Consecutive calendar days with activity, derived from the real
      // timeline instead of incrementing once per correct answer (which
      // used to count 5 problems solved in one sitting as a "5 day streak").
      streak: computeStreak(updatedTimeline.map((t) => t.date)),
      timeSpent: userStats.timeSpent + 3, // Add avg 3 minutes per try
      skills: updatedSkills,
      weaknesses: [weakestName],
      learningTimeline: updatedTimeline,
    };

    saveStatsToLocal(updatedUserStats);

    if (isCorrect) {
      fetch(apiUrl('/api/live-stats/event'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'problem-solved' }),
      }).catch(err => console.error('Error reporting problem-solved event:', err));
    }
  };

  // Register or Join Challenge
  const handleJoinChallenge = (id: string) => {
    const updated = weeklyChallenges.map((wc) => {
      if (wc.id === id) {
        return { ...wc, completed: true, participants: wc.participants + 1 };
      }
      return wc;
    });
    setWeeklyChallenges(updated);

    // Boost points slightly for registry
    const updatedStats = {
      ...userStats,
      points: userStats.points + 10,
    };
    saveStatsToLocal(updatedStats);
  };

  // Register or Join Contest
  const handleJoinContest = (id: string) => {
    const updated = contests.map((cont) => {
      if (cont.id === id) {
        return { ...cont, joined: true };
      }
      return cont;
    });
    setContests(updated);
    localStorage.setItem('calculix_contests', JSON.stringify(updated));

    // Boost points slightly for registration
    const updatedStats = {
      ...userStats,
      points: userStats.points + 15,
    };
    saveStatsToLocal(updatedStats);
  };

  // Add customized comment from student inside forum
  const handleAddCommunityComment = (comment: Omit<CommunityDiscussion, 'id' | 'timestamp' | 'likes' | 'replies'>) => {
    const newDiscussionEntry: CommunityDiscussion = {
      ...comment,
      id: Date.now().toString(),
      timestamp: 'Just now',
      likes: 0,
      replies: 0,
    };

    const updatedAll = [newDiscussionEntry, ...discussions];
    setDiscussions(updatedAll);
    localStorage.setItem('calculix_discussions', JSON.stringify(updatedAll));

    // Reward active contributor points
    const updatedStats = {
      ...userStats,
      points: userStats.points + 5,
    };
    saveStatsToLocal(updatedStats);
  };

  // Navigation controller with search query injection
  const navigateWithFilters = (tab: string, args?: { topic?: Topic; level?: Level }) => {
    setActiveTab(tab);
    if (args) {
      setOverrideFilters(args);
    } else {
      setOverrideFilters(undefined);
    }
  };

  /**
   * Tab selection shared by the desktop sidebar and the mobile bottom rail.
   *
   * 'learn' routes through navigateWithFilters so that selecting it from the
   * nav clears any topic/level override left behind by an AI recommendation
   * deep-link; the remaining tabs do not read overrideFilters.
   */
  const selectTab = (tab: TabKey) => {
    if (tab === 'learn') {
      navigateWithFilters('learn');
      return;
    }
    setActiveTab(tab);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessNotify(true);
    setTimeout(() => setSaveSuccessNotify(false), 3000);
  };

  if (!isLoggedIn || (isLoggedIn && !hasOnboarded)) {
    return <WelcomeScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="cx-ground min-h-screen flex flex-col md:flex-row relative text-content antialiased font-sans">

      {/* MOBILE APP BAR — identity, points and reminders; navigation lives in the bottom rail */}
      <MobileHeader
        activeTab={activeTab}
        points={userStats.points}
        onBellClick={() => setActiveTab('settings')}
        online={online}
        pendingGrades={pendingGrades}
        cachedProblems={problems.length}
      />

      {/* SIDEBAR NAVIGATION BAR (Desktop only — mobile navigates via MobileTabBar) */}
      {/*
        `ramp-static` because this column is dark in both themes — in daylight
        it is the ink spine the brand is built on, and after dark it stays put
        while the page around it drops to meet it. Its text is written with the
        bridged `stone-*` classes, which invert; pinning the ramp is what stops
        `text-stone-500` becoming a dark grey on a ground that never moved.
      */}
      <aside
        id="side-nav-rail"
        className="ramp-static hidden md:sticky md:flex top-0 left-0 h-screen z-40 bg-surface-rail border-r border-[rgba(231,226,217,0.14)] w-66 px-5 py-6.5 shrink-0 flex-col justify-between overflow-y-auto"
      >
        <div className="select-none">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="cx-mark">&#8721;</span>
            <span className="flex flex-col leading-[1.15]">
              <span className="font-serif text-[19px] text-stone-50">CalculixHub</span>
              <span className="type-eyebrow text-stone-600">Math OS Platform</span>
            </span>
          </div>

          {/* Learning status — a hairline meter, not a filled card. */}
          <div className="mt-6.5 rounded-card border border-[rgba(231,226,217,0.16)] px-3.75 py-3.5">
            <span className="type-eyebrow block text-stone-600">Learning status</span>
            <div className="mt-2.25 flex items-baseline justify-between">
              <span className="text-[13px] text-stone-300">You</span>
              <span className="font-serif text-[19px] text-azure-400 tnum">
                <AnimatedNumber value={userStats.points} /> pts
              </span>
            </div>
            <SpringBar
              value={(userStats.points / 500) * 100}
              track="w-full h-0.5 bg-[rgba(231,226,217,0.14)] mt-2.5"
              fill="h-0.5 bg-azure-400"
              label="Progress toward 500 points"
            />
            <span className="mt-2 block text-[10px] tracking-[0.04em] text-stone-600">Toward 500 points</span>
          </div>

          {/* Nav */}
          <nav className="mt-6.5 flex flex-col gap-0.5" id="side-nav-links">
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeTab === item.key;
              return (
                /*
                  The active mark is a 2px left edge and a 14% wash, both drawn
                  by `.cx-rail-item` off `aria-current`. The previous build slid
                  a shared `layoutId` rectangle between links; that reads well
                  with a filled pill and not at all with an edge, where the
                  travelling element would be a 2px line skating up and down the
                  column. State here is carried by the attribute a screen reader
                  reads anyway, which is one fewer thing to keep in sync.
                */
                <button
                  key={item.key}
                  onClick={() => selectTab(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className="cx-rail-item"
                >
                  <ItemIcon className="w-3.75 h-3.75 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Identity and session */}
        <div className="mt-6 border-t border-[rgba(231,226,217,0.12)] pt-4">
          <button
            type="button"
            onClick={() => selectTab('profile')}
            className="mb-3.5 flex w-full items-center justify-between gap-2.5 text-left cursor-pointer"
          >
            <span className="truncate text-[13px] text-stone-300">
              {profile?.display_name ?? profile?.username ?? 'Student'}
            </span>
            <span className="cx-tag cx-tag-neutral shrink-0 border-[rgba(231,226,217,0.24)] text-stone-400 text-[9px] tracking-[0.14em]">
              {userStats.level || 'Unplaced'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="cx-btn cx-btn-on-dark cx-btn-block py-2.5 text-[14px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>

          <div className="pt-4 text-[10px] leading-[1.6] text-stone-600 select-none">
            <p>© 2026 Calculix Platform.</p>
            <p>Democratizing math with AI.</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER CONTENT VIEWPORT */}
      {/* pb-26 on mobile clears the fixed bottom rail (~85px incl. safe area). */}
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 pb-26 md:px-10 md:pt-8.5 md:pb-16 relative">
        <PullToRefresh onRefresh={handleRefresh}>
        <div className="max-w-7xl mx-auto space-y-7">
          
          {/*
            The workspace header: a tracked kicker over a flush-left display
            line, closed by a hairline. Every screen in the design opens this
            way, which is what makes eight unrelated workspaces read as chapters
            of one document.

            Learn, Compete and Community ship their own headers, so this one
            stands down for them rather than stacking a second title above.
          */}
          {/*
            Learn, Compete and Community ship their own headers, so this one
            stands down for them rather than stacking a second title above.

            It is a render guard, not a `hidden` class. The previous version
            appended `hidden` to a className that already began `hidden md:flex`
            — and `md:flex` wins at every width this header is visible at, so
            the "suppressed" header rendered anyway on exactly the screens it
            was meant to skip.
          */}
          {activeTab !== 'learn' && activeTab !== 'compete' && activeTab !== 'community' && (
            <header className="hidden md:flex items-end justify-between gap-6 border-b border-line pb-4.5 select-none">
              <div>
                <p className="type-eyebrow text-accent-text">CalculixHub Workspace</p>
                <h2 className="type-title mt-1.5 font-normal text-[clamp(1.75rem,2.6vw,2.375rem)]">
                  {screenTitle(activeTab)}
                </h2>
              </div>

              <span className="text-[12px] tracking-[0.08em] text-content-subtle tnum">
                UTC {new Date().toISOString().slice(0, 10)}
              </span>
            </header>
          )}

          {/* RENDER DYNAMIC TAB CONTENT VIEW */}
          <TabTransition tabKey={activeTab}>
          {activeTab === 'dashboard' && (
            <Dashboard
              userStats={userStats}
              weeklyChallenges={weeklyChallenges}
              contests={contests}
              onNavigateToTab={navigateWithFilters}
              onJoinChallenge={handleJoinChallenge}
              onJoinContest={handleJoinContest}
              onRewardPoints={handleRewardPoints}
            />
          )}

          {activeTab === 'learn' && (
            <Learn
              problems={problems}
              completedProblems={completedProblems}
              userStats={userStats}
              onSolveProblem={handleSolveProblemStatus}
              initialFilters={overrideFilters}
            />
          )}

          {activeTab === 'compete' && (
            <Compete
              weeklyChallenges={weeklyChallenges}
              contests={contests}
              leaderboard={leaderboard}
              onJoinChallenge={handleJoinChallenge}
              onJoinContest={handleJoinContest}
              userPoints={userStats.points}
              userStats={userStats}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView userStats={userStats} />
          )}

          {activeTab === 'community' && (
            <Community
              discussions={discussions}
              problems={problems}
              onAddComment={handleAddCommunityComment}
            />
          )}

          {activeTab === 'profile' && (
            <Profile
              userStats={userStats}
              completedProblems={completedProblems}
              problems={problems}
              onLogout={handleLogout}
            />
          )}

          {activeTab === 'research' && <ResearchAnalytics />}

          {activeTab === 'settings' && (
            /*
              Two columns, the design's split: training and preferences on the
              left, account and the destructive action on the right. The whole
              screen used to be one bordered card 42rem wide with nine stacked
              sections inside it, which put "Reset training data" — the only
              irreversible control in the product — three scrolls below the fold
              and inside the same box as a dropdown.
            */
            <div className="grid [grid-template-columns:repeat(auto-fit,minmax(22.5rem,1fr))] items-start gap-8.5">
              <div className="space-y-6.5">
                <form onSubmit={handleSaveSettings}>
                  <h3 className="type-title text-[26px]">Training</h3>
                  <p className="type-caption mt-1.5 mb-4.5 text-content-subtle">
                    What you are aiming at, and how much time you have for it.
                  </p>

                  <label className="cx-label" htmlFor="set-goal">Personal goal</label>
                  <select
                    id="set-goal"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    className="cx-input mb-5"
                  >
                    <option value="Qualify for a regional/national math olympiad">Qualify for a regional or national olympiad</option>
                    <option value="Score maximum on SAT Math and AMC 8/10/12">Score maximum on SAT Math and AMC 8/10/12</option>
                    <option value="Build strong Algebra and Combinatorics reflexes">Build strong Algebra and Combinatorics reflexes</option>
                  </select>

                  <label className="cx-label" htmlFor="set-pace">Daily practice target</label>
                  <select
                    id="set-pace"
                    value={studyPace}
                    onChange={(e) => setStudyPace(e.target.value)}
                    className="cx-input"
                  >
                    <option value="15 minutes / day">15 minutes a day — light, keeps momentum</option>
                    <option value="30 minutes / day">30 minutes a day — serious reflex training</option>
                    <option value="60 minutes / day">60 minutes a day — push toward a breakthrough</option>
                  </select>

                  <h3 className="type-title mt-8 text-[26px]">Preferences</h3>
                  <p className="type-caption mt-1.5 mb-4.5 text-content-subtle">
                    Applied the moment you choose them.
                  </p>

                  <div className="cx-card">
                    <div className="flex items-center justify-between gap-4.5 border-b border-line-faint px-5.5 py-4.5">
                      <div>
                        <span className="block text-[15px]">Daily streak reminder</span>
                        <span className="block text-[13px] text-content-subtle">
                          A nudge at 6pm on days you have not practised.
                        </span>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer select-none items-center">
                        <input
                          type="checkbox"
                          checked={studyReminders}
                          onChange={(e) => handleToggleReminders(e.target.checked)}
                          className="sr-only peer"
                        />
                        {/*
                          The knob rides --ease-emphasized so it settles into
                          each end rather than stopping dead, which is what makes
                          a switch feel like a physical throw. The track is an
                          outline that tints rather than a filled pill that
                          changes colour — the same restraint every other control
                          here follows.
                        */}
                        <div className="peer h-6 w-11 rounded-pill border border-content/22 transition-colors duration-240 ease-standard after:absolute after:top-[3px] after:left-[3px] after:h-4.5 after:w-4.5 after:rounded-full after:bg-stone-400 after:transition-[transform,background-color] after:duration-240 after:ease-emphasized after:content-[''] peer-checked:border-accent peer-checked:bg-accent/20 peer-checked:after:translate-x-5 peer-checked:after:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2" />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4.5 px-5.5 py-4.5">
                      <div>
                        <span className="block text-[15px]">Appearance</span>
                        <span className="block text-[13px] text-content-subtle">
                          Daylight for a lit room, lamplight for a dark one.
                        </span>
                      </div>
                      {/*
                        Appearance sits inside the card but outside the form's
                        deferred contract on purpose: it applies on choice, and
                        the label under it says so.
                      */}
                      <ThemeToggle />
                    </div>
                  </div>

                  {/*
                    States the actual outcome. A toggle that reports "on" while
                    the OS is blocking notifications is worse than no toggle.
                  */}
                  <Collapse open={Boolean(reminderNotice)}>
                    <p className="mt-3.5 border-l-2 border-accent/40 pl-3.5 text-[13px] leading-[1.7] text-accent-text">
                      {reminderNotice}
                    </p>
                  </Collapse>

                  <div className="mt-6.5 flex flex-wrap items-center gap-3">
                    <m.button
                      id="btn-save-settings"
                      type="submit"
                      whileTap={{ scale: 0.97 }}
                      transition={spring.press}
                      className="cx-btn cx-btn-fill"
                    >
                      Apply settings
                    </m.button>
                    {/*
                      The confirmation is the only feedback that the form did
                      anything. It grows in beside the button that produced it
                      rather than above the whole panel, so nothing below shifts.
                    */}
                    <Collapse open={saveSuccessNotify}>
                      <span className="inline-flex items-center gap-2 text-[13.5px] text-proof">
                        <CheckCircle className="h-3.75 w-3.75" /> Applied
                      </span>
                    </Collapse>
                  </div>
                </form>
              </div>

              <div className="space-y-6.5">
                <div>
                  <h3 className="type-title text-[26px]">Account</h3>
                  <p className="type-caption mt-1.5 mb-4.5 text-content-subtle">This device and this install.</p>
                  <div className="cx-card">
                    <InstallAppButton variant="row" />
                  </div>
                </div>

                <div>
                  <h3 className="type-title text-[26px]">The platform</h3>
                  <p className="type-caption mt-1.5 mb-4.5 text-content-subtle">What is running underneath.</p>
                  <p className="type-body text-content-muted">
                    Four core layers: <span className="italic">Learning Engine</span>,{' '}
                    <span className="italic">AI Personalisation (EduReach)</span>,{' '}
                    <span className="italic">Competition Arena</span> and{' '}
                    <span className="italic">Analytics Radar</span>.
                  </p>
                </div>

                {/*
                  The one destructive control, in its own tinted panel at the
                  end of the column — the only place on this screen where a
                  fill is used to mean "stop and read this".
                */}
                <div className="cx-card cx-tint-accent p-6">
                  <h4 className="type-title text-[21px]">Reset training data</h4>
                  <p className="type-caption mt-2 mb-4.5 leading-[1.75] text-content-muted">
                    Clears your answers, streak and skill estimates from this browser. The account itself stays.
                    This cannot be undone.
                  </p>
                  <m.button
                    type="button"
                    onClick={() => {
                      localStorage.clear();
                      window.location.reload();
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring.press}
                    className="cx-btn cx-btn-primary py-2.75 text-[15px]"
                  >
                    Reset everything
                  </m.button>
                </div>
              </div>
            </div>
          )}
          </TabTransition>

        </div>
        </PullToRefresh>
      </main>

      {/* CHATBOT COOPERATIVE ASSISTANT ON FLOATING LAYER */}
      <AITutorChat />

      {/* MOBILE BOTTOM NAVIGATION RAIL */}
      <MobileTabBar activeTab={activeTab} onSelect={selectTab} />

    </div>
  );
}
