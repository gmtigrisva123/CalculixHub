/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  readPreference,
  resolve,
  runThemeTransition,
  subscribeToSystemTheme,
  writePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme';

interface ThemeContextValue {
  /** What the user chose. `system` is a real, persisted answer, not a fallback. */
  preference: ThemePreference;
  /** What is on screen right now. */
  resolved: ResolvedTheme;
  /** `origin` anchors the reveal to the control that was pressed. */
  setPreference: (preference: ThemePreference, origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /*
   * Seeded from storage rather than from the DOM.
   *
   * `data-theme` holds the *resolved* theme, so reading it back would turn a
   * `system` preference into a hard `light` or `dark` the moment React mounted —
   * the switch would show the wrong segment and the app would stop following the
   * OS. Storage is the only place the distinction survives.
   */
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPreference()));

  /*
   * The boot script has already written the correct attribute, so on first mount
   * this is a no-op that costs one attribute assignment. It earns its place on
   * every subsequent change, and it is what makes the provider the single writer
   * of the DOM's theme state.
   */
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  /*
   * Follow the OS, but only while asked to.
   *
   * Subscribing unconditionally would let the OS flipping at sunset overwrite a
   * learner's explicit choice of daylight — a bug that only ever reproduces once
   * a day, at dusk, which is a memorably difficult one to be handed.
   */
  useEffect(() => {
    if (preference !== 'system') return;
    return subscribeToSystemTheme(setResolved);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference, origin?: { x: number; y: number }) => {
      const nextResolved = resolve(next);
      writePreference(next);

      // Both writes happen inside the transition callback so the snapshot the
      // browser takes contains the finished state rather than a half-applied one.
      runThemeTransition(() => {
        setPreferenceState(next);
        setResolved(nextResolved);
        applyTheme(nextResolved);
      }, origin);
    },
    [],
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
