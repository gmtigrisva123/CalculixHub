/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Brain,
  Calendar,
  FlaskConical,
  MessageSquare,
  Settings,
  TrendingUp,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'learn'
  | 'compete'
  | 'progress'
  | 'community'
  | 'profile'
  | 'research'
  | 'settings';

export interface NavItem {
  key: TabKey;
  /** Sidebar label, also the expanded label on the mobile tab rail. */
  label: string;
  /** Abbreviated label for the rail, where an active tab gets ~64px of width. */
  shortLabel: string;
  icon: LucideIcon;
  /**
   * Whether the tab appears in the mobile bottom rail. All eight fit because
   * inactive tabs collapse to icon-only, but the flag keeps the rail tunable
   * without having to re-derive the ordering in two places.
   */
  inTabBar: boolean;
}

/**
 * Single source of truth for workspace navigation.
 *
 * The desktop sidebar and the mobile bottom rail both render from this list, so
 * adding a workspace surfaces it on both without a second edit. Order is load
 * bearing: it is the left-to-right order of the mobile rail.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Trophy, inTabBar: true },
  { key: 'learn', label: 'Learn', shortLabel: 'Learn', icon: Brain, inTabBar: true },
  { key: 'compete', label: 'Compete', shortLabel: 'Arena', icon: Calendar, inTabBar: true },
  { key: 'progress', label: 'Progress', shortLabel: 'Stats', icon: TrendingUp, inTabBar: true },
  { key: 'community', label: 'Community', shortLabel: 'Forum', icon: MessageSquare, inTabBar: true },
  { key: 'profile', label: 'Profile', shortLabel: 'You', icon: User, inTabBar: true },
  { key: 'research', label: 'Research', shortLabel: 'Lab', icon: FlaskConical, inTabBar: true },
  { key: 'settings', label: 'Settings', shortLabel: 'Config', icon: Settings, inTabBar: true },
] as const;

export const TAB_BAR_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.inTabBar);

/** Workspace headings, keyed by tab. Screens that ship their own header are absent. */
const SCREEN_TITLES: Partial<Record<TabKey, string>> = {
  dashboard: 'Welcome back',
  progress: 'EduReach Core Stats',
  profile: 'Student Honor Space',
  research: 'Research & Analytics',
  settings: 'Workspace Configuration',
};

export const screenTitle = (tab: string): string =>
  SCREEN_TITLES[tab as TabKey] ?? NAV_ITEMS.find((item) => item.key === tab)?.label ?? '';
