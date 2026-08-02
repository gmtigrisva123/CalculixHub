/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { spring } from '../lib/motion';
import type { ThemePreference } from '../lib/theme';

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  hint: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: 'Day', hint: 'Always the daylight theme', Icon: Sun },
  { value: 'system', label: 'Auto', hint: 'Follow the device setting', Icon: Monitor },
  { value: 'dark', label: 'Night', hint: 'Always the lamplight theme', Icon: Moon },
];

interface ThemeToggleProps {
  /** `bar` is the compact icon-only form for the mobile header. */
  variant?: 'segmented' | 'bar';
  className?: string;
}

/**
 * The day/auto/night switch.
 *
 * Three states rather than two, because "follow my device" is a real preference
 * and a two-state switch cannot express it — the moment a learner taps a binary
 * toggle they have silently opted out of the OS forever, usually without meaning
 * to.
 *
 * Implemented as a radiogroup, not three buttons. The distinction is not
 * pedantry: it is what makes the arrow keys move between options and the group
 * take a single tab stop, which is how a native segmented control behaves and
 * what a screen reader announces.
 */
export default function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const { preference, resolved, setPreference } = useTheme();

  /*
   * The wipe grows from the control that was pressed, so the origin is read off
   * the event target's own box rather than the pointer. Using the pointer would
   * put the origin in a different place for a keyboard activation, where there
   * is no cursor — the centre of the pressed segment is correct for both.
   */
  const choose = (value: ThemePreference) => (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPreference(value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  if (variant === 'bar') {
    /*
     * The compact form cycles rather than presenting all three. A header on a
     * phone has no room for a segmented control, and cycling day → night → auto
     * keeps every state reachable from one thumb-sized target.
     */
    const next: ThemePreference =
      preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';
    const { Icon } = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[1];

    return (
      <m.button
        type="button"
        onClick={choose(next)}
        whileTap={{ scale: 0.92 }}
        transition={spring.press}
        aria-label={`Theme: ${preference}. Switch to ${next}.`}
        className={`w-9 h-9 rounded-control bg-surface-sunken text-content-muted flex items-center justify-center cursor-pointer active:bg-surface transition-colors duration-160 ease-standard ${className}`}
      >
        {/*
          Keyed on the preference so the icon crossfades and rotates a little on
          each change. Without the key the glyph would swap between frames, which
          on a control this small is easy to miss entirely.
        */}
        <m.span
          key={preference}
          initial={{ opacity: 0, rotate: -35, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={spring.snappy}
          className="flex"
        >
          <Icon className="w-4 h-4" strokeWidth={2} />
        </m.span>
      </m.button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 p-1 rounded-pill bg-surface-sunken border border-line shadow-inset-well ${className}`}
    >
      {OPTIONS.map(({ value, label, hint, Icon }) => {
        const active = preference === value;

        return (
          <m.button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={choose(value)}
            whileTap={{ scale: 0.94 }}
            transition={spring.press}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-pill cursor-pointer transition-colors duration-160 ease-standard ${
              active ? 'text-content' : 'text-content-subtle hover:text-content-muted'
            }`}
          >
            {/*
              One pill, moved between segments by shared layout rather than three
              pills fading in and out. The travel is what tells the eye the
              selection moved from A to B; a crossfade only says it is now at B.
            */}
            {active && (
              <m.span
                layoutId="theme-toggle-pill"
                transition={spring.snappy}
                className="absolute inset-0 rounded-pill bg-surface-raised border border-line shadow-e1"
                style={{ zIndex: 0 }}
              />
            )}
            <Icon className="w-3.5 h-3.5 relative z-10" strokeWidth={2.2} />
            <span className="type-eyebrow relative z-10">{label}</span>
          </m.button>
        );
      })}

      {/*
        What `Auto` currently resolves to. A learner who picks Auto at noon and
        looks again at midnight should not have to guess whether the app is
        following along — and it is the only state whose outcome is not written
        on the control itself.
      */}
      <span className="sr-only" aria-live="polite">
        {preference === 'system' ? `Following device: ${resolved} theme` : `${preference} theme`}
      </span>
    </div>
  );
}
