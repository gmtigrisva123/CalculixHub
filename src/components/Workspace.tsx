/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import WorkspaceShell, { type WorkspaceNotice } from './WorkspaceShell';
import { Problem, UserStats, WeeklyChallenge, Contest, Topic, Level } from '../../shared/types';
import { apiUrl, apiFetch, isNativePlatform } from '../services/apiBase';
import { remindersEnabled, enableReminders, disableReminders, syncReminders } from '../platform/reminders';
import { useOnlineStatus } from '../platform/offline';
import PullToRefresh from './PullToRefresh';
import { type TabKey } from '../lib/navigation';
import { SCREENS, openingTab, preloadLikelyScreens } from '../lib/screens';
import { whenIdle } from '../lib/lazy';
import { supabase } from '../services/supabase';
import { useRealtimeSubscription } from '../services/data/realtime';
import type { SaveOutcome } from './Settings';
import { TabTransition } from './motion';
import { useAuth } from '../context/AuthContext';
import { useLeaderboard, useLearnerSnapshot } from '../services/data/people';
import AchievementToast from './AchievementToast';
import ScreenSkeleton from './ScreenSkeleton';
import BootLift from '../boot/BootLift';
import { ACHIEVEMENTS, getShownToastIds, saveShownToastIds, type Achievement } from '../domain/achievements';

/*
 * The two overlays are fetched after the workspace has drawn. Neither is on
 * screen at first, and the tutor brings the maths typesetter with it.
 */
const ScratchPaper = lazy(() => import('./ScratchPaper'));
const AITutorChat = lazy(() => import('./AITutorChat'));

const { dashboard: Dashboard, learn: Learn, archive: ExamArchive, progress: ProgressView, compete: Arena, leaderboard: Leaderboard,
  community: Community, profile: Profile, inbox: Inbox, plan: Plan, settings: Settings, admin: AdminWorkspace } = SCREENS;

interface WorkspaceProps {
  /** Guest access was only ever granted for one visit; signing out ends it. */
  onSignedOut: () => void;
}

/**
 * The signed-in (or guest) application: the shell, the page inside it, and the
 * data every page shares. Loaded as its own bundle, so none of this is paid for
 * by someone who has only come to read the landing page.
 */
export default function Workspace({ onSignedOut }: WorkspaceProps) {
  /*
   * Opening tab, honouring a ?tab= query parameter. The manifest's app
   * shortcuts launch ./?tab=learn and ./?tab=progress, so a long-press on the
   * installed icon lands directly on a page. Read during initial state rather
   * than in an effect, which would flash the dashboard first.
   */
  const [activeTab, setActiveTab] = useState<string>(openingTab);

  /*
   * The address follows the page. Back and Forward then move between pages the
   * way they do everywhere else on the web, a reload keeps you where you were,
   * and any page can be bookmarked. Parameters that belong to one page (a post
   * being linked to, a topic filter) are dropped on the way out of it.
   */
  const goTo = (tab: string) => {
    setActiveTab(tab);
    if (openingTab() === tab) return;
    const url = new URL(window.location.href);
    for (const name of ['post', 'comment', 'view', 'topic', 'problem', 'checkout']) url.searchParams.delete(name);
    if (tab === 'dashboard') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.pushState({ tab }, '', url.pathname + url.search + url.hash);
  };
  useEffect(() => {
    const onHistory = () => setActiveTab(openingTab());
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  // Deep navigation overrides for AI recommendations
  const [overrideFilters, setOverrideFilters] = useState<{ topic?: Topic; level?: Level } | undefined>(() => {
    const topic = new URLSearchParams(window.location.search).get('topic');
    return topic && ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'].includes(topic) ? { topic: topic as Topic } : undefined;
  });
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [learnVisit, setLearnVisit] = useState(0);
  const [tutorRequest, setTutorRequest] = useState<{ id: number; userId: string; prompt?: string } | null>(null);
  const openTutor = (prompt?: string) => { setOverlays(true); setTutorRequest(previous => ({ id: (previous?.id ?? 0) + 1, userId: profile?.id ?? 'guest', prompt })); };

  const queueAchievements = (newlyUnlocked: Achievement[]) => {
    if (newlyUnlocked.length > 0) {
      setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
    }
  };

  // Connectivity, and any answers captured while offline. The queue drains
  // automatically as soon as the connection returns.
  const online = useOnlineStatus();
  const pendingGrades = 0;

  const { status: authStatus, profile, signOut, hasOnboarded } = useAuth();
  const isLoggedIn = authStatus === 'authenticated';

  const handleLogout = async () => {
    // Revokes the refresh token server-side, so signing out actually ends the
    // session rather than only hiding it from this tab.
    const result = await signOut();
    if (!result.ok) {
      setReminderNotice(result.error ?? 'Could not sign out. Please try again.');
      return;
    }

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
    onSignedOut();

    // The next person to sign in on this browser starts on Home, not on the page this session ended on.
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
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

  // Once the first page is drawn, fetch the code for the pages likely to be next.
  useEffect(() => preloadLikelyScreens(), []);
  const [overlays, setOverlays] = useState(false);
  useEffect(() => whenIdle(() => setOverlays(true), 2500), []);
  const shown=React.useRef(new Set<string>());
  useEffect(()=>{shown.current=profile?.id?getShownToastIds(profile.id):new Set();setAchievementQueue([]);},[profile?.id]);
  useEffect(()=>{
   if(!isLoggedIn||!profile?.id||learner.loading||learner.error)return;
   const fresh=ACHIEVEMENTS.filter(a=>a.condition(userStats,completedProblems.length)&&!shown.current.has(a.id));
   fresh.forEach(a=>shown.current.add(a.id));
   if(fresh.length){saveShownToastIds(shown.current,profile.id);queueAchievements(fresh);}
  },[isLoggedIn,profile?.id,learner.loading,learner.error,userStats,completedProblems.length]);
  const handleSolveProblemStatus=(_id:string,_correct:boolean,_points:number)=>{if(isLoggedIn)void learner.reload();};
  const handleJoinChallenge=(_id:string)=>goTo('compete');
  const handleJoinContest=(_id:string)=>goTo('compete');

  // Navigation controller with search query injection
  const navigateWithFilters = (tab: string, args?: { topic?: Topic; level?: Level }) => {
    goTo(tab);
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
      setLearnVisit(count => count + 1);
      navigateWithFilters('learn');
      return;
    }
    goTo(tab);
  };

  /** Goal and pace are saved the moment one is chosen; Settings shows the outcome. */
  const savePreferences = async (next: { goal: string; pace: string }): Promise<SaveOutcome> => {
    setCustomGoal(next.goal);
    setStudyPace(next.pace);
    if (!supabase || !profile?.id) return 'guest';
    const { error } = await supabase.from('learner_preferences').upsert({ user_id: profile.id, goal: next.goal, pace: next.pace });
    if (error) return 'error';
    void learner.reload();
    return 'saved';
  };

  /*
   * What this session needs the learner to know, each thing said once. Three
   * loaders can fail for the same reason (no connection, no database), and
   * three stacked copies of one sentence read as three problems.
   */
  const notices: WorkspaceNotice[] = [];
  if (activeTab !== 'archive') {
    for (const text of new Set([catalogError, learner.error, ranking.error].filter((value): value is string => Boolean(value)))) {
      notices.push({ tone: 'warning', text, action: { label: 'Try again', onClick: () => void handleRefresh() } });
    }
  }
  if (!isLoggedIn) {
    notices.push({
      tone: 'info',
      text: activeTab === 'archive'
        ? 'You’re exploring as a guest. Exam progress stays on this device; an account syncs it everywhere.'
        : 'You’re exploring as a guest, so nothing here is saved. An account keeps your progress and finds your level.',
      action: { label: 'Create a free account', href: '/?auth=signup' },
    });
  }

  return (
    <>
      <WorkspaceShell activeTab={activeTab} onSelect={selectTab}
        name={profile?.display_name ?? profile?.username ?? 'Curious learner'}
        streak={userStats.streak} online={online} pendingGrades={pendingGrades}
        arenaLive={contests.some(contest => contest.status === 'ongoing')}
        notices={notices} onLogout={() => void handleLogout()}
        onOpenScratch={() => { setOverlays(true); setScratchOpen(open => !open); }}>
        <PullToRefresh onRefresh={handleRefresh}>
          <TabTransition tabKey={activeTab}>
          <Suspense fallback={<ScreenSkeleton />}>
          {activeTab === 'dashboard' && (
            <Dashboard
              minutesPerDay={Number(studyPace.match(/\d+/)?.[0]) || 30}
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
              onOpenTutor={openTutor}
              visit={learnVisit}
            />
          )}

          {activeTab === 'archive' && <ExamArchive userId={isLoggedIn ? profile?.id ?? null : null} />}

          {activeTab === 'compete' && <Arena />}
          {activeTab === 'leaderboard' && <Leaderboard rows={ranking.data} loading={ranking.loading} error={ranking.error} onRefresh={ranking.reload} currentUserId={profile?.id ?? null} currentRank={userStats.rank} currentPoints={userStats.points} currentSolved={userStats.completedCount} onPractice={() => { if (isLoggedIn) selectTab('learn'); else window.location.assign('/?auth=signup'); }} />}
          {activeTab === 'admin' && <AdminWorkspace onContentChange={() => void fetchProblems()} />}

          {activeTab === 'progress' && (
            <ProgressView userStats={userStats} onSeePlans={() => selectTab('plan')} />
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
              onSeePlans={() => selectTab('plan')}
            />
          )}

          {activeTab === 'inbox' && <Inbox />}

          {activeTab === 'plan' && <Plan />}

          {activeTab === 'settings' && (
            <Settings
              customGoal={customGoal}
              studyPace={studyPace}
              onChangePreferences={savePreferences}
              studyReminders={studyReminders}
              onToggleReminders={handleToggleReminders}
              reminderNotice={reminderNotice}
              onLogout={handleLogout}
              onProgressReset={() => void handleRefresh()}
            />
          )}
          </Suspense>
          </TabTransition>
        </PullToRefresh>
      </WorkspaceShell>
      <BootLift />
      {overlays && (
        <Suspense fallback={null}>
          <ScratchPaper open={scratchOpen} onOpenChange={setScratchOpen} />
          <AITutorChat key={profile?.id ?? 'guest'} request={tutorRequest?.userId === (profile?.id ?? 'guest') ? tutorRequest : null} />
        </Suspense>
      )}
      <AchievementToast achievement={achievementQueue[0] || null}
        onClose={() => setAchievementQueue(prev => prev.slice(1))}
        onNavigateToProfile={() => selectTab('profile')} />
    </>
  );
}
