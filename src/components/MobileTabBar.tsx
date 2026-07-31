/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TAB_BAR_ITEMS, type TabKey } from '../lib/navigation';

interface MobileTabBarProps {
  activeTab: string;
  onSelect: (tab: TabKey) => void;
}

/**
 * Fixed bottom navigation rail, mobile only (hidden at md+, where the sidebar
 * takes over).
 *
 * All eight workspaces fit on a 375px viewport because inactive tabs collapse
 * to icon-only and the active tab expands to reveal its label -- flex 1.6 vs 1,
 * matching the source design. That yields ~64px for the active tab and ~40px
 * for the rest, so every target clears the 44px minimum on its long axis while
 * the rail stays a single row.
 *
 * The rail sits above the iOS home indicator via safe-area-inset-bottom. On
 * viewports without a safe area the max() floor keeps a resting 12px of padding
 * so the rail never crowds the screen edge.
 */
export default function MobileTabBar({ activeTab, onSelect }: MobileTabBarProps) {
  return (
    <nav
      id="mobile-tab-bar"
      aria-label="Workspace navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-0.5 bg-ink-950 border-t border-ink-850 px-2 pt-2.5 select-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {TAB_BAR_ITEMS.map((item) => {
        const ItemIcon = item.icon;
        const isActive = activeTab === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={isActive ? 'page' : undefined}
            // The icon carries the label for inactive tabs, whose text is not
            // rendered -- so the accessible name has to come from the button.
            aria-label={item.label}
            style={{ flex: isActive ? 1.6 : 1 }}
            className={`min-w-0 h-11.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 px-1.5 cursor-pointer transition-colors duration-150 ${
              isActive
                ? 'bg-brass-600 text-ink-950'
                : 'text-stone-500 active:bg-ink-850'
            }`}
          >
            <ItemIcon className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
            {isActive && (
              <span className="text-[8px] font-extrabold tracking-wide whitespace-nowrap leading-none">
                {item.shortLabel}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
