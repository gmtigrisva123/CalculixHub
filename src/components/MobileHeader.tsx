/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, Trophy, WifiOff } from 'lucide-react';
import { screenTitle } from '../lib/navigation';

interface MobileHeaderProps {
  activeTab: string;
  points: number;
  onBellClick: () => void;
  /** False when the device has lost connectivity; reveals the offline banner. */
  online: boolean;
  /** Grades captured offline and awaiting replay. */
  pendingGrades: number;
  /** Cached problems still available without a connection. */
  cachedProblems: number;
}

/**
 * Compact dark app bar, mobile only.
 *
 * Replaces the hamburger header: navigation moved to the bottom rail, so this
 * bar is free to carry identity (mark + current workspace) and the points
 * total, which the sidebar used to own and which mobile users otherwise lose.
 *
 * The top padding tracks safe-area-inset-top so the bar clears the notch or
 * Dynamic Island when the PWA runs standalone, and falls back to a plain 12px
 * in a normal browser tab where the inset resolves to 0.
 */
export default function MobileHeader({
  activeTab,
  points,
  onBellClick,
  online,
  pendingGrades,
  cachedProblems,
}: MobileHeaderProps) {
  return (
    <div className="md:hidden sticky top-0 z-30 shrink-0">
    <header
      className="bg-ink-950 border-b border-ink-800 px-4 pb-3 flex items-center justify-between w-full select-none"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brass-500 to-brass-700 text-ink-950 font-extrabold flex items-center justify-center text-[15px] font-serif shadow-md shadow-brass-500/35">
          &#8721;
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-ink-50 leading-none">
            CalculixHub
          </span>
          <span className="text-[8px] font-bold tracking-[0.12em] uppercase text-ink-500 leading-none">
            {screenTitle(activeTab)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-ink-850 border border-brass-500/30 px-2.5 py-1.5 rounded-full">
          <Trophy className="w-3 h-3 text-brass-400" strokeWidth={2.2} />
          <span className="text-[11px] font-bold font-mono text-brass-300 leading-none">{points}</span>
        </div>
        <button
          type="button"
          onClick={onBellClick}
          aria-label="Notifications and reminders"
          className="w-9 h-9 rounded-xl bg-ink-850 text-ink-300 flex items-center justify-center cursor-pointer active:bg-ink-800 transition-colors"
        >
          <Bell className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </header>

    {/*
      Offline banner.

      Sits below the app bar rather than floating over content so it never
      covers anything, and states what still works instead of only what does
      not — the cached item bank means practice continues offline, which the
      learner cannot know unless told.
    */}
    {!online && (
      <div
        role="status"
        className="bg-brass-900 text-brass-150 px-4 py-1.5 flex items-center gap-2"
      >
        <WifiOff className="w-3 h-3 shrink-0" strokeWidth={2} />
        <span className="text-[9.5px] font-semibold leading-tight tracking-[0.02em]">
          Offline &mdash; {cachedProblems} cached {cachedProblems === 1 ? 'problem' : 'problems'}{' '}
          available
          {pendingGrades > 0 && (
            <>
              , {pendingGrades} {pendingGrades === 1 ? 'answer' : 'answers'} queued
            </>
          )}
        </span>
      </div>
    )}
    </div>
  );
}
