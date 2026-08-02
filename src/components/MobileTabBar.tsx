/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { TAB_BAR_ITEMS, type TabKey } from '../lib/navigation';
import { duration, ease, spring } from '../lib/motion';

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
 *
 * The rail is frosted rather than opaque. Content scrolling underneath stays
 * faintly visible through it, which is what tells the eye the page continues
 * past the rail instead of ending at it — the same reason iOS frosts its own tab
 * bars. It also means the rail no longer has to be a fixed dark slab that fights
 * whichever theme is active; it takes the colour of whatever it is sitting on.
 */
export default function MobileTabBar({ activeTab, onSelect }: MobileTabBarProps) {
  return (
    <nav
      id="mobile-tab-bar"
      aria-label="Workspace navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-0.5 material-glass border-t border-line px-2 pt-2.5 select-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {TAB_BAR_ITEMS.map((item) => {
        const ItemIcon = item.icon;
        const isActive = activeTab === item.key;

        return (
          /*
            `layout` is what makes the rail's width change survivable as
            motion. The active tab grows from flex 1 to 1.6, which is a layout
            property no amount of CSS transition can animate smoothly across
            eight siblings. Motion measures before and after and projects the
            difference through transforms, so the reflow happens in a single
            frame and everything the user sees is composited.
          */
          <m.button
            key={item.key}
            type="button"
            layout
            transition={spring.snappy}
            onClick={() => onSelect(item.key)}
            aria-current={isActive ? 'page' : undefined}
            // The icon carries the label for inactive tabs, whose text is not
            // rendered -- so the accessible name has to come from the button.
            aria-label={item.label}
            style={{ flex: isActive ? 1.6 : 1 }}
            className={`relative min-w-0 h-11.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 px-1.5 cursor-pointer transition-colors duration-160 ease-standard ${
              isActive ? 'text-ink-950' : 'text-content-subtle active:bg-surface-sunken'
            }`}
          >
            {/*
              One brass pill shared by all eight tabs, rather than a background
              switched on per button. Selecting a tab slides the indicator
              across the rail, which is the same gesture language as the
              desktop sidebar and as iOS's own tab bars.
            */}
            {isActive && (
              <m.span
                layoutId="tabbar-active-pill"
                className="absolute inset-0 bg-brass-600 rounded-2xl"
                transition={spring.snappy}
              />
            )}

            <ItemIcon className="w-[17px] h-[17px] shrink-0 relative z-10" strokeWidth={2} />

            {/*
              The label fades rather than appearing instantly, so it arrives
              with the pill instead of popping in ahead of it. `layout` keeps it
              centred while the button around it is still resizing.
            */}
            <AnimatePresence initial={false}>
              {isActive && (
                <m.span
                  key="label"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.fast, ease: ease.standard }}
                  className="relative z-10 text-[8px] font-extrabold tracking-wide whitespace-nowrap leading-none"
                >
                  {item.shortLabel}
                </m.span>
              )}
            </AnimatePresence>
          </m.button>
        );
      })}
    </nav>
  );
}
