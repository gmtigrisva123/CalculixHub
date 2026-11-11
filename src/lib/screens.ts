/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazyWithPreload, whenIdle } from './lazy';
import type { TabKey } from './navigation';

/**
 * Every workspace page, each in its own bundle.
 *
 * Someone opening Learn should not first download the Arena, the community
 * feed and the staff console. A page's code is fetched when it is opened; when
 * the pointer or the keyboard reaches its link, so it is usually there before
 * the click lands; and for the pages most likely to be next, in the quiet after
 * the workspace has drawn.
 *
 * This file imports nothing heavy itself, so the app's entry can read it to
 * start fetching the opening page alongside the shell rather than after it.
 */
export const SCREENS = {
  dashboard: lazyWithPreload(() => import('../components/Dashboard')),
  learn: lazyWithPreload(() => import('../components/Learn')),
  archive: lazyWithPreload(() => import('../components/ExamArchive')),
  progress: lazyWithPreload(() => import('../components/ProgressView')),
  compete: lazyWithPreload(() => import('../components/Arena')),
  leaderboard: lazyWithPreload(() => import('../components/Leaderboard')),
  community: lazyWithPreload(() => import('../components/Community')),
  profile: lazyWithPreload(() => import('../components/Profile')),
  inbox: lazyWithPreload(() => import('../components/Inbox')),
  plan: lazyWithPreload(() => import('../components/Plan')),
  settings: lazyWithPreload(() => import('../components/Settings')),
  admin: lazyWithPreload(() => import('../components/AdminWorkspace')),
} as const;

const isScreen = (tab: string): tab is TabKey => tab in SCREENS;

/** Start fetching a page's code. Unknown names are ignored. */
export function preloadScreen(tab: string): void {
  if (isScreen(tab)) void SCREENS[tab].preload();
}

/** The pages a learner most often goes to next, fetched one at a time while idle. */
const LIKELY_NEXT: readonly TabKey[] = ['dashboard', 'learn', 'progress', 'compete', 'community', 'leaderboard', 'profile', 'settings'];

export function preloadLikelyScreens(): () => void {
  const queue = [...LIKELY_NEXT];
  let cancel = () => {};
  const next = () => {
    const tab = queue.shift();
    if (!tab) return;
    void SCREENS[tab].preload().then(() => { cancel = whenIdle(next, 1500); });
  };
  cancel = whenIdle(next, 3000);
  return () => { queue.length = 0; cancel(); };
}

/** The tab named by ?tab=, or the dashboard. Read by the entry and by the workspace. */
export function openingTab(): TabKey {
  const requested = new URLSearchParams(window.location.search).get('tab') ?? '';
  return isScreen(requested) ? requested : 'dashboard';
}
