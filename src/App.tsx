/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { Problem, UserStats, WeeklyChallenge, Contest, CommunityDiscussion, LeaderboardEntry, Topic, Level } from './types';
import { computeStreak } from './lib/streak';
import { NAV_ITEMS, screenTitle, type TabKey } from './lib/navigation';
import MobileHeader from './components/MobileHeader';
import MobileTabBar from './components/MobileTabBar';
import Dashboard from './components/Dashboard';
import Learn from './components/Learn';
import Compete from './components/Compete';
import ProgressView from './components/ProgressView';
import Community from './components/Community';
import Profile from './components/Profile';
import ResearchAnalytics from './components/ResearchAnalytics';
import AITutorChat from './components/AITutorChat';
import WelcomeScreen from './components/WelcomeScreen';

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
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Deep navigation overrides for AI recommendations
  const [overrideFilters, setOverrideFilters] = useState<{ topic?: Topic; level?: Level } | undefined>(undefined);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => sessionStorage.getItem('calculix_is_logged_in') === 'true');

  const handleLoginSuccess = (name: string, level: Level, initialSkills?: Record<Topic, number>) => {
    sessionStorage.setItem('calculix_is_logged_in', 'true');
    sessionStorage.setItem('calculix_user_name', name);
    setIsLoggedIn(true);

    // Seed the learner's tier and, when they came through the adaptive
    // placement test, their measured per-domain skill profile.
    const updatedStats: UserStats = {
      ...userStats,
      level,
      ...(initialSkills ? { skills: initialSkills } : {}),
    };
    saveStatsToLocal(updatedStats);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('calculix_is_logged_in');
    sessionStorage.removeItem('calculix_user_name');
    localStorage.removeItem('calculix_is_logged_in');
    localStorage.removeItem('calculix_user_name');
    localStorage.removeItem('calculix_stats');
    localStorage.removeItem('calculix_completed');
    localStorage.removeItem('calculix_discussions');
    localStorage.removeItem('calculix_contests');
    setIsLoggedIn(false);
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

  // Settings State
  const [customGoal, setCustomGoal] = useState<string>('Qualify for a regional/national math olympiad');
  const [studyPace, setStudyPace] = useState<string>('30 minutes / day');
  const [studyReminders, setStudyReminders] = useState<boolean>(true);
  const [saveSuccessNotify, setSaveSuccessNotify] = useState<boolean>(false);

  // Load from database seeds & localStorage on mount
  useEffect(() => {
    // 1. Fetch static math database problems
    const fetchProblems = async () => {
      try {
        const response = await fetch('/api/problems');
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
        const response = await fetch('/api/statistics-seed');
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

    fetchProblems();
    fetchSeeds();

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
      fetch('/api/live-stats/event', {
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

  if (!isLoggedIn) {
    return <WelcomeScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col md:flex-row relative text-stone-800 antialiased font-sans">

      {/* MOBILE APP BAR — identity, points and reminders; navigation lives in the bottom rail */}
      <MobileHeader
        activeTab={activeTab}
        points={userStats.points}
        onBellClick={() => setActiveTab('settings')}
      />

      {/* SIDEBAR NAVIGATION BAR (Desktop only — mobile navigates via MobileTabBar) */}
      <aside
        id="side-nav-rail"
        className="hidden md:sticky md:flex top-0 left-0 h-screen z-40 bg-ink-950 border-r border-ink-850 text-stone-300 w-64 p-6 shrink-0 flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-8 select-none">
          {/* Logo Brand area */}
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-gradient-to-tr from-brass-500 to-brass-700 p-2.5 rounded-xl text-ink-950 font-black w-10 h-10 flex items-center justify-center text-base shadow-lg font-serif">
              &#8721;
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-widest text-stone-100 uppercase">CalculixHub</h1>
              <span className="text-[9px] font-bold text-stone-500 block -mt-0.5 uppercase tracking-wider">Math OS Platform</span>
            </div>
          </div>

          {/* Quick Point badge in sidebar */}
          <div className="bg-ink-850 rounded-2xl p-4.5 border border-ink-800/80 space-y-1">
            <span className="text-[9px] uppercase font-bold text-stone-500 tracking-wider">Learning status</span>
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-stone-200">You</span>
              <span className="text-xs font-black text-brass-400">{userStats.points} pts</span>
            </div>
            <div className="w-full bg-ink-800 rounded-full h-1 mt-2.5">
              <div
                className="bg-brass-500 h-1 rounded-full transition-all duration-400"
                style={{ width: `${Math.min(100, (userStats.points / 500) * 100)}%` }}
              />
            </div>
          </div>

          {/* Nav groups links */}
          <nav className="space-y-1.5 font-medium" id="side-nav-links">
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => selectTab(item.key)}
                  className={`w-full flex items-center gap-3 px-4.5 py-3 text-xs rounded-xl transition-all cursor-pointer ${
                    activeTab === item.key ? 'bg-brass-600 text-ink-950 font-extrabold' : 'hover:bg-ink-850 hover:text-white'
                  }`}
                >
                  <ItemIcon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="space-y-3.5 border-t border-ink-800/60 pt-4 mt-8">
          {/* User Name Info */}
          <div className="flex items-center justify-between text-xs text-stone-400 px-1 select-none">
            <span className="truncate max-w-[125px] font-semibold text-stone-200">
              {sessionStorage.getItem('calculix_user_name') || localStorage.getItem('calculix_user_name') || 'Student'}
            </span>
            <span className="bg-violet-900 border border-violet-700/50 text-violet-200 text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 scale-90 tracking-wide">
              {userStats.level || 'Foundation'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-rose-950/40 hover:bg-rose-900/40 active:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-900/30 hover:border-rose-800/60 font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>

          <div className="text-[10px] text-stone-500 select-none hidden md:block leading-snug pt-1">
            <p>© 2026 Calculix Platform.</p>
            <p className="mt-0.5">Democratizing math with AI.</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER CONTENT VIEWPORT */}
      {/* pb-26 on mobile clears the fixed bottom rail (~85px incl. safe area). */}
      <main className="flex-1 overflow-x-hidden p-4 pb-26 md:p-8 relative">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* HEADER WELCOME SEARCH ADVISOR ON DESKTOP */}
          <header className={`hidden md:flex items-center justify-between border-b border-stone-200 pb-3 mt-1 select-none ${
              activeTab === 'learn' || activeTab === 'compete' || activeTab === 'community' ? 'hidden' : ''
          }`}>
            <div>
              <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">CalculixHub Workspace</p>
              <h2 className="text-lg font-extrabold tracking-tight text-stone-900 mt-0.5 font-serif">
                {screenTitle(activeTab)}
              </h2>
            </div>

            <div className="flex gap-4">
              <span className="text-xs font-semibold text-stone-500 self-center">
                UTC: <strong className="text-stone-800 font-mono">{new Date().toISOString().slice(0, 10)}</strong>
              </span>
            </div>
          </header>

          {/* RENDER DYNAMIC TAB CONTENT VIEW */}
          {activeTab === 'dashboard' && (
            <Dashboard
              userStats={userStats}
              weeklyChallenges={weeklyChallenges}
              contests={contests}
              onNavigateToTab={navigateWithFilters}
              onJoinChallenge={handleJoinChallenge}
              onJoinContest={handleJoinContest}
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
            <div className="max-w-2xl bg-white border border-stone-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-1.5 font-serif">
                  <Settings className="w-5 h-5 text-stone-700" /> Personal Learning Settings
                </h2>
                <p className="text-[11px] text-stone-500 leading-normal mt-0.5">
                  Manage your adaptive study pace, reminders, and account configuration.
                </p>
              </div>

              {saveSuccessNotify && (
                <div className="p-3 bg-proof-50 text-proof-800 border border-proof-150 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-proof-500" /> Your settings have been applied to the OS.
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="space-y-4">

                  {/* Goal set input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block mb-1">Personal training goal</label>
                    <select
                      value={customGoal}
                      onChange={(e) => setCustomGoal(e.target.value)}
                      className="w-full border border-stone-200 focus:border-stone-900 rounded-xl px-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 bg-stone-50"
                    >
                      <option value="Qualify for a regional/national math olympiad">Qualify for a regional or national olympiad</option>
                      <option value="Score maximum on SAT Math and AMC 8/10/12">Score maximum on SAT Math and AMC 8/10/12</option>
                      <option value="Build strong Algebra and Combinatorics reflexes">Build strong Algebra and Combinatorics reflexes</option>
                    </select>
                  </div>

                  {/* Pace goal select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 block mb-1">Daily practice target</label>
                    <select
                      value={studyPace}
                      onChange={(e) => setStudyPace(e.target.value)}
                      className="w-full border border-stone-200 focus:border-stone-900 rounded-xl px-3.5 py-3 text-xs outline-hidden font-medium text-stone-800 bg-stone-50"
                    >
                      <option value="15 minutes / day">15 minutes / day (light, keeps momentum)</option>
                      <option value="30 minutes / day">30 minutes / day (serious reflex training)</option>
                      <option value="60 minutes / day">60 minutes / day (push toward a breakthrough)</option>
                    </select>
                  </div>

                  {/* Toggle Reminders */}
                  <div className="flex items-center justify-between p-3.5 bg-stone-50/60 rounded-xl border border-stone-100">
                    <div>
                      <span className="text-xs font-bold text-stone-800 block">Enable adaptive reminders</span>
                      <span className="text-[10px] text-stone-400 block font-medium mt-0.5">Periodic email summaries of your weak-point analysis.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={studyReminders}
                        onChange={(e) => setStudyReminders(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brass-600"></div>
                    </label>
                  </div>

                </div>

                <div className="pt-2 border-t border-stone-100 flex gap-2">
                  <button
                    id="btn-save-settings"
                    type="submit"
                    className="bg-ink-950 hover:bg-black text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Apply settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.clear();
                      window.location.reload();
                    }}
                    className="bg-rose-50 hover:bg-rose-100/80 text-rose-700 font-bold text-xs px-4 py-3 rounded-xl transition-all border border-rose-100 cursor-pointer"
                  >
                    Reset training data
                  </button>
                </div>
              </form>

              <div className="bg-stone-50 border border-stone-150 p-4.5 rounded-2xl space-y-2 text-xs text-stone-600 leading-normal">
                <span className="bg-violet-50 border border-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase block w-fit">
                  CalculixHub math OS
                </span>
                <p className="font-medium">
                  Built on four core layers: <strong>Learning Engine</strong>, <strong>AI Personalization (EduReach)</strong>, <strong>Competition Arena</strong>, and <strong>Analytics Radar</strong>. Your training data is stored entirely in your browser for full privacy.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* CHATBOT COOPERATIVE ASSISTANT ON FLOATING LAYER */}
      <AITutorChat />

      {/* MOBILE BOTTOM NAVIGATION RAIL */}
      <MobileTabBar activeTab={activeTab} onSelect={selectTab} />

    </div>
  );
}
