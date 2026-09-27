/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import WorkspaceShell from './components/WorkspaceShell';
const IPhonePrototype = lazy(() => import('./components/prototype/IPhonePrototype'));

export default function App() {
  return new URLSearchParams(window.location.search).get('preview') === 'ios'
    ? <Suspense fallback={<div className="prototype-loading" role="status">Opening your pocket-sized learning space…</div>}><IPhonePrototype /></Suspense>
    : <LearningApp />;
}

import { Problem, UserStats, WeeklyChallenge, Contest, CommunityDiscussion, LeaderboardEntry, Topic, Level } from '../shared/types';
import { computeStreak } from './domain/streak';
import { apiUrl, apiFetch, isNativePlatform } from './services/apiBase';
import { remindersEnabled, enableReminders, disableReminders, syncReminders } from './platform/reminders';
import { useOnlineStatus } from './platform/offline';
import PullToRefresh from './components/PullToRefresh';
import { NAV_ITEMS, type TabKey } from './lib/navigation';
import Dashboard from './components/Dashboard';
import Learn from './components/Learn';
import Arena from './components/Arena';
import Inbox from './components/Inbox';
import { supabase } from './services/supabase';
import { useRealtimeSubscription } from './services/data/realtime';
import AdminWorkspace from './components/AdminWorkspace';
import ProgressView from './components/ProgressView';
import Community from './components/Community';
import Profile from './components/Profile';
import ResearchAnalytics from './components/ResearchAnalytics';
import Settings from './components/Settings';
import AITutorChat from './components/AITutorChat';
import WelcomeScreen from './components/WelcomeScreen';
import { TabTransition } from './components/motion';
import { useAuth } from './context/AuthContext';
import { useLeaderboard, useLearnerSnapshot } from './services/data/people';
import AchievementToast from './components/AchievementToast';
import { ACHIEVEMENTS, type Achievement } from './domain/achievements';

function LearningApp() {
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
  const [overrideFilters, setOverrideFilters] = useState<{ topic?: Topic; level?: Level } | undefined>(() => {
    const topic = new URLSearchParams(window.location.search).get('topic');
    return topic && ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'].includes(topic) ? { topic: topic as Topic } : undefined;
  });
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);

  const queueAchievements = (newlyUnlocked: Achievement[]) => {
    if (newlyUnlocked.length > 0) {
      setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
    }
  };

  // Connectivity, and any answers captured while offline. The queue drains
  // automatically as soon as the connection returns.
  const online = useOnlineStatus();
  const pendingGrades = 0;

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
  const { status: authStatus, authError, profile, signOut, hasOnboarded } = useAuth();
  const isLoggedIn = authStatus === 'authenticated';

  const [guestAllowed, setGuestAllowed] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('home') || params.has('auth') || params.has('error') || window.location.hash.includes('error=')) return false;
    return new URLSearchParams(window.location.search).get('demo') === '1' || localStorage.getItem('calculix_guest_access') === 'true';
  });

  const handleLoginSuccess = (_name:string,_level:Level) => {
    localStorage.setItem('calculix_guest_access','true');setGuestAllowed(true);
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
      'calculix_registered_users', 'calculix_guest_access',
    ]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    setGuestAllowed(false);

    setActiveTab('dashboard');
    setCompletedProblems([]);
    setUserStats({
      rank: 0,
      points: 0,
      streak: 0,
      completedCount: 0,
      accuracy: 0,
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
  const [catalogError,setCatalogError]=useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallenge[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [discussions, setDiscussions] = useState<CommunityDiscussion[]>([]);
  const [completedProblems, setCompletedProblems] = useState<string[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    rank: 0,
    points: 0,
    streak: 0,
    completedCount: 0,
    accuracy: 0,
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

  const learner=useLearnerSnapshot(isLoggedIn ? profile?.id ?? null : null);
  const ranking=useLeaderboard();
  useEffect(()=>{
   const row=learner.data.stats;
   setCompletedProblems(learner.data.completed);
   setUserStats({level:hasOnboarded?profile?.level:undefined,rank:learner.data.rank??0,
    points:row?.points??0,streak:row?.current_streak??0,completedCount:row?.problems_solved??0,
    accuracy:learner.data.accuracyPct??0,timeSpent:(row?.time_spent_seconds??0)/60,skills:learner.data.skills,
    weaknesses:[],learningTimeline:learner.data.timeline});
  },[learner.data,ranking.data,profile?.id,profile?.level,hasOnboarded]);
  useEffect(()=>setLeaderboard(ranking.data.map(r=>({rank:r.rank,name:r.display_name||r.username,points:r.points,country:r.country??'',age:0,avatarSeed:r.username,accuracy:r.accuracy_pct??undefined}))),[ranking.data]);

  // Settings State
  const [customGoal, setCustomGoal] = useState<string>('Build fundamental mathematical problem-solving skills');
  const [studyPace, setStudyPace] = useState<string>('30 minutes / day (Recommended)');
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
  useEffect(()=>{setCustomGoal(learner.data.preferences?.goal??'Build fundamental mathematical problem-solving skills');setStudyPace(learner.data.preferences?.pace??'30 minutes / day (Recommended)');},[learner.data.preferences]);
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
        setProblems(data);setCatalogError('');
      }else setCatalogError('Could not load the live question catalog. Please retry.');
    } catch (err) {
      setCatalogError('The live question catalog is unavailable.');
    }
  };

  useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.catalog',onReconnect:fetchProblems},()=>void fetchProblems());
  const fetchArenaSchedule = async () => {
    try {
      const response = await apiFetch('/api/arenas');
      if (!response.ok) return;
      const rows = await response.json();
      setContests(rows.map((arena:any)=>({id:arena.id,title:arena.title,date:arena.starts_at,
        duration:`${arena.duration_minutes} minutes`,problemCount:arena.question_count??0,
        status:arena.status==='closed'||Date.parse(arena.ends_at)<=Date.now()?'past':Date.parse(arena.starts_at)>Date.now()?'upcoming':'ongoing'})));
    } catch { /* Arena displays the connection error when opened. */ }
  };
  useRealtimeSubscription({table:'realtime_signals',filter:'scope=eq.arena',onReconnect:fetchArenaSchedule},()=>void fetchArenaSchedule());
  useEffect(()=>{void fetchArenaSchedule();},[]);
  const handleRefresh=async()=>{await Promise.all([fetchProblems(),learner.reload(),ranking.reload()]);};
  useEffect(()=>{void fetchProblems();void syncReminders();},[]);
  const shown=React.useRef(new Set<string>());
  useEffect(()=>{shown.current.clear();setAchievementQueue([]);},[profile?.id]);
  useEffect(()=>{
   if(!isLoggedIn||learner.loading||learner.error)return;
   const fresh=ACHIEVEMENTS.filter(a=>a.condition(userStats,completedProblems.length)&&!shown.current.has(a.id));
   fresh.forEach(a=>shown.current.add(a.id));if(fresh.length)queueAchievements(fresh);
  },[isLoggedIn,learner.loading,learner.error,userStats,completedProblems.length]);
  const handleSolveProblemStatus=(_id:string,_correct:boolean,_points:number)=>{if(isLoggedIn)void learner.reload();};
  const handleJoinChallenge=(_id:string)=>setActiveTab('compete');
  const handleJoinContest=(_id:string)=>setActiveTab('compete');

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

  const handleSaveSettings=async(e:React.FormEvent)=>{
   e.preventDefault();setSaveSuccessNotify(false);
   if(!supabase||!profile?.id){setReminderNotice('Sign in to save your learning preferences.');return;}
   const {error}=await supabase.from('learner_preferences').upsert({user_id:profile.id,goal:customGoal,pace:studyPace});
   if(error){setReminderNotice('Could not save your preferences. Please retry.');return;}
   await learner.reload();setSaveSuccessNotify(true);
  };

  if (authStatus === 'loading') return <main className="min-h-screen flex items-center justify-center bg-surface text-content"><p role="status">Opening your learning space…</p></main>;
  if ((!isLoggedIn && (!guestAllowed || authError)) || (isLoggedIn && !hasOnboarded)) {
    return <WelcomeScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <WorkspaceShell activeTab={activeTab} onSelect={selectTab}
        name={profile?.display_name ?? profile?.username ?? 'Curious learner'}
        points={userStats.points} streak={userStats.streak} online={online}
        pendingGrades={pendingGrades} onLogout={handleLogout}>
        {catalogError&&<p role="alert" className="arena-notice">{catalogError}</p>}
        {learner.error&&<div role="alert" className="arena-notice">{learner.error}</div>}
        {ranking.error&&<div role="alert" className="arena-notice">{ranking.error}</div>}
        {!isLoggedIn&&<p className="arena-note">Guest practice is not saved. Sign in to track your progress across devices.</p>}
        <PullToRefresh onRefresh={handleRefresh}>
          <TabTransition tabKey={activeTab}>
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
              savedAttempts={learner.data.attempts}
            />
          )}

          {activeTab === 'compete' && <Arena />}
          {activeTab === 'admin' && <AdminWorkspace onContentChange={() => void fetchProblems()} />}

          {activeTab === 'progress' && (
            <ProgressView userStats={userStats} />
          )}

          {activeTab === 'community' && (
            <Community problems={problems} />
          )}

          {activeTab === 'profile' && (
            <Profile
              userStats={userStats}
              completedProblems={completedProblems}
              problems={problems}
              onLogout={handleLogout}
              onTriggerAlert={(badge) => queueAchievements([badge])}
            />
          )}

          {activeTab === 'inbox' && <Inbox />}

          {activeTab === 'research' && <ResearchAnalytics />}

          {activeTab === 'settings' && (
            <Settings
              customGoal={customGoal}
              setCustomGoal={setCustomGoal}
              studyPace={studyPace}
              setStudyPace={setStudyPace}
              studyReminders={studyReminders}
              onToggleReminders={handleToggleReminders}
              reminderNotice={reminderNotice}
              onSaveSettings={handleSaveSettings}
              saveSuccessNotify={saveSuccessNotify}
            />
          )}
          </TabTransition>
        </PullToRefresh>
      </WorkspaceShell>
      <AITutorChat />
      <AchievementToast achievement={achievementQueue[0] || null}
        onClose={() => setAchievementQueue(prev => prev.slice(1))}
        onNavigateToProfile={() => selectTab('profile')} />
    </>
  );
}
