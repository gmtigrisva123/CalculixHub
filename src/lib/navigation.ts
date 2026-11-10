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
 * The three things a learner comes here to do, plus the staff door.
 *
 *   practice  work on problems alone, and see how it is going
 *   together  everything that involves other people
 *   you       your identity, your messages, your plan, your preferences
 *   staff     the Admin console, which is not a learner's page at all
 */
export type NavGroupKey = 'practice' | 'together' | 'you' | 'staff';

export interface NavItem {
  key: TabKey;
  group: NavGroupKey;
  /** Sidebar label. */
  label: string;
  /** Abbreviated label for the mobile rail. */
  shortLabel: string;
  /** One line on what the page is for; shown in the command palette. */
  hint: string;
  icon: LucideIcon;
  /** Whether the tab appears in the mobile bottom rail. */
  inTabBar: boolean;
}

/**
 * Single source of truth for workspace navigation.
 *
 * The sidebar, the mobile rail and the command palette all render from this
 * list, so adding a workspace surfaces it in all three without a second edit.
 * Order is load bearing: it is the reading order of each group in the sidebar
 * and the left-to-right order of the mobile rail. Every item has its own icon,
 * because two pages sharing one is how a rail stops being scannable.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', group: 'practice', label: 'Home', shortLabel: 'Home', hint: 'Today at a glance', icon: House, inTabBar: true },
  { key: 'learn', group: 'practice', label: 'Learn', shortLabel: 'Learn', hint: 'Problems chosen for your level', icon: PencilLine, inTabBar: true },
  { key: 'archive', group: 'practice', label: 'Exam Archive', shortLabel: 'Exams', hint: 'Every past paper, AMC to IMO', icon: LibraryBig, inTabBar: false },
  { key: 'progress', group: 'practice', label: 'Progress', shortLabel: 'Progress', hint: 'What you know, and what is next', icon: TrendingUp, inTabBar: false },

  { key: 'compete', group: 'together', label: 'Arena', shortLabel: 'Arena', hint: 'Live timed contests', icon: Swords, inTabBar: true },
  { key: 'leaderboard', group: 'together', label: 'Leaderboard', shortLabel: 'Ranks', hint: 'Where you stand', icon: Trophy, inTabBar: false },
  { key: 'community', group: 'together', label: 'Community', shortLabel: 'Community', hint: 'Solutions and discussion', icon: MessagesSquare, inTabBar: true },

  { key: 'profile', group: 'you', label: 'Profile', shortLabel: 'You', hint: 'Your record and badges', icon: User, inTabBar: false },
  { key: 'inbox', group: 'you', label: 'Inbox', shortLabel: 'Inbox', hint: 'Notifications and messages', icon: Inbox, inTabBar: false },
  { key: 'plan', group: 'you', label: 'Plan', shortLabel: 'Plan', hint: 'Free, Pro and Team', icon: Sparkles, inTabBar: false },
  { key: 'settings', group: 'you', label: 'Settings', shortLabel: 'Settings', hint: 'Study rhythm, account and data', icon: Settings, inTabBar: false },

  { key: 'admin', group: 'staff', label: 'Admin', shortLabel: 'Admin', hint: 'Staff console', icon: ShieldCheck, inTabBar: false },
] as const;

export const NAV_GROUPS: readonly { key: NavGroupKey; label: string }[] = [
  { key: 'practice', label: 'Practice' },
  { key: 'together', label: 'Together' },
  { key: 'you', label: 'You' },
  { key: 'staff', label: 'Staff' },
];

export const TAB_BAR_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.inTabBar);

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

export const screenTitle = (tab: string): string => NAV_ITEMS.find((item) => item.key === tab)?.label ?? '';
