/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ShieldCheck,
  PencilLine,
  LibraryBig,
  House,
  Inbox,
  MessagesSquare,
  Settings,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'learn'
  | 'archive'
  | 'progress'
  | 'compete'
  | 'leaderboard'
  | 'community'
  | 'profile'
  | 'inbox'
  | 'plan'
  | 'settings'
  | 'admin';

/**
 * How the workspace is divided.
 *
 * The sidebar answers one question, "what do I want to do now?", so its groups
 * are the three things a learner comes to do, in the order a session usually
 * runs:
 *
 *   home      where the day starts; it has no group label because it is not one of several
 *   train     work on problems alone, and see how that work is going
 *   compete   timed contests, and where they leave you standing
 *   connect   other people: the discussion, and what they have sent you
 *
 * Two groups are deliberately *not* in that list:
 *
 *   account   who you are and how the app is set up (profile, plan, settings).
 *             These are visited rarely and never mid-session, so they live in
 *             the menu under your name instead of standing between the pages
 *             you use every day.
 *   staff     the Admin console, which is not a learner's page at all.
 */
export type NavGroupKey = 'home' | 'train' | 'compete' | 'connect' | 'account' | 'staff';

export interface NavItem {
  key: TabKey;
  group: NavGroupKey;
  /** The page's name: in the sidebar, the top bar and the command palette. */
  label: string;
  /** Abbreviated label for the mobile tab bar. */
  shortLabel: string;
  /** One line on what the page is for; shown in the command palette and the top bar. */
  hint: string;
  icon: LucideIcon;
  /** Whether the page has a place in the mobile tab bar. */
  inTabBar: boolean;
  /**
   * The second key of this page's "go to" shortcut: G, then this key. No page
   * uses S, which opens scratch paper from anywhere.
   */
  shortcut?: string;
}

/**
 * Single source of truth for workspace navigation.
 *
 * The sidebar, the account menu, the mobile tab bar and the command palette
 * all render from this list, so adding a page surfaces it in all four without
 * a second edit. Order is load bearing: it is the reading order of each group
 * and the left-to-right order of the tab bar. Every item has its own icon,
 * because two pages sharing one is how a rail stops being scannable.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', group: 'home', label: 'Home', shortLabel: 'Home', hint: 'Today at a glance', icon: House, inTabBar: true, shortcut: 'h' },

  { key: 'learn', group: 'train', label: 'Learn', shortLabel: 'Learn', hint: 'Problems chosen for your level', icon: PencilLine, inTabBar: true, shortcut: 'l' },
  { key: 'archive', group: 'train', label: 'Exam Archive', shortLabel: 'Exams', hint: 'Every past paper, AMC to IMO', icon: LibraryBig, inTabBar: false, shortcut: 'e' },
  { key: 'progress', group: 'train', label: 'Progress', shortLabel: 'Progress', hint: 'What you know, and what is next', icon: TrendingUp, inTabBar: false, shortcut: 'p' },

  { key: 'compete', group: 'compete', label: 'Arena', shortLabel: 'Arena', hint: 'Live timed contests', icon: Swords, inTabBar: true, shortcut: 'a' },
  { key: 'leaderboard', group: 'compete', label: 'Leaderboard', shortLabel: 'Ranks', hint: 'Where you stand', icon: Trophy, inTabBar: false, shortcut: 'r' },

  { key: 'community', group: 'connect', label: 'Community', shortLabel: 'Community', hint: 'Solutions and discussion', icon: MessagesSquare, inTabBar: true, shortcut: 'c' },
  { key: 'inbox', group: 'connect', label: 'Inbox', shortLabel: 'Inbox', hint: 'Notifications and messages', icon: Inbox, inTabBar: false, shortcut: 'i' },

  { key: 'profile', group: 'account', label: 'Profile', shortLabel: 'You', hint: 'Your record and badges', icon: User, inTabBar: false, shortcut: 'u' },
  { key: 'plan', group: 'account', label: 'Plan', shortLabel: 'Plan', hint: 'Free, Pro and Team', icon: Sparkles, inTabBar: false },
  { key: 'settings', group: 'account', label: 'Settings', shortLabel: 'Settings', hint: 'Study rhythm, account and data', icon: Settings, inTabBar: false, shortcut: ',' },

  { key: 'admin', group: 'staff', label: 'Admin', shortLabel: 'Admin', hint: 'Staff console', icon: ShieldCheck, inTabBar: false },
] as const;

export const NAV_GROUPS: readonly { key: NavGroupKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'train', label: 'Train' },
  { key: 'compete', label: 'Compete' },
  { key: 'connect', label: 'Connect' },
  { key: 'account', label: 'Account' },
  { key: 'staff', label: 'Staff' },
];

/** The groups listed in the sidebar itself, in order. Account and staff are placed separately. */
export const RAIL_GROUPS: readonly NavGroupKey[] = ['home', 'train', 'compete', 'connect'];

export const TAB_BAR_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.inTabBar);

export const itemsIn = (group: NavGroupKey): readonly NavItem[] => NAV_ITEMS.filter((item) => item.group === group);

export const groupOf = (tab: string): NavGroupKey | undefined => NAV_ITEMS.find((item) => item.key === tab)?.group;

/**
 * Admin is a staff console behind its own sign-in and security code. Learners
 * never need it, so it stays out of the sidebar until someone has opened it on
 * this device (by address, or from the command palette). The flag only decides
 * what the sidebar lists; it grants nothing.
 */
const STAFF_FLAG = 'calculix_staff_nav';
export const staffNavPinned = (): boolean => {
  try { return localStorage.getItem(STAFF_FLAG) === '1'; } catch { return false; }
};
export const pinStaffNav = (): void => {
  try { localStorage.setItem(STAFF_FLAG, '1'); } catch { /* private mode: it simply is not remembered */ }
};

/**
 * Whether the sidebar is folded down to its icons. Remembered per device; with
 * nothing remembered, it starts folded on screens too narrow to spare the room.
 */
const RAIL_FLAG = 'calculix_rail';
export const railCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem(RAIL_FLAG);
    if (stored) return stored === 'collapsed';
  } catch { /* fall through to the width */ }
  return typeof window !== 'undefined' && window.innerWidth < 1200;
};
export const rememberRail = (collapsed: boolean): void => {
  try { localStorage.setItem(RAIL_FLAG, collapsed ? 'collapsed' : 'open'); } catch { /* not remembered */ }
};

export const screenTitle = (tab: string): string => NAV_ITEMS.find((item) => item.key === tab)?.label ?? '';
