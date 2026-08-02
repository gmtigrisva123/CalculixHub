/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Theme resolution.
 *
 * Two distinct ideas share the word "theme" and keeping them apart is what makes
 * the rest of the system simple:
 *
 *   preference — what the user asked for: `light`, `dark`, or `system`. Lives in
 *                localStorage, survives reloads, and is what the switch shows.
 *   resolved   — what is actually on screen: only ever `light` or `dark`. Lives
 *                in `data-theme` on <html>, and is what CSS selects on.
 *
 * Collapsing the two — writing `system` into the DOM and letting a media query
 * sort it out — is the common shortcut, and it costs a duplicate copy of every
 * token under `@media (prefers-color-scheme: dark)`. Resolving in JavaScript
 * means styles/tokens.css describes each theme exactly once.
 *
 * The inline boot script in index.html performs this same resolution before
 * first paint. It is duplicated there on purpose: this module is part of the
 * app bundle and therefore cannot run early enough to prevent a flash.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Shared with the boot script in index.html. Changing it requires changing both. */
export const THEME_STORAGE_KEY = 'calculix_theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Browser chrome colour per theme, mirroring `--sf` in styles/tokens.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#faf7f1',
  dark: '#17130f',
};

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

/**
 * The stored preference, defaulting to following the OS.
 *
 * Every storage access in this module is wrapped: Safari throws on
 * localStorage in private browsing rather than returning null, and a theme
 * switch is never important enough to take the app down with it.
 */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Preference is lost on reload; the current session still honours it.
  }
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Writes the resolved theme to the document.
 *
 * The `theme-color` meta goes with it, which is what stops iOS painting the
 * status bar and the rubber-band overscroll area in the previous theme's colour
 * — the most conspicuous seam in a WebView app that themes only its own DOM.
 */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

/**
 * Subscribes to OS theme changes. Returns an unsubscribe function.
 *
 * Only meaningful while the preference is `system`; the provider unsubscribes
 * otherwise, so an explicit choice is never overwritten by the OS changing
 * underneath it.
 */
export function subscribeToSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};

  const list = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light');
  list.addEventListener('change', handler);
  return () => list.removeEventListener('change', handler);
}

/**
 * Runs a theme change as a circular wipe from a point on screen.
 *
 * The origin is passed to CSS as a pair of custom properties that the
 * `theme-wipe` keyframes in index.css read, so the reveal grows out of the
 * control the user actually pressed rather than from an arbitrary corner. That
 * connection between cause and effect is the whole reason to animate this at
 * all.
 *
 * Three ways out, all landing on the same final state:
 *   - no View Transitions support (Firefox, older Safari) — swap immediately
 *   - reduced motion — swap immediately, because a 150%-radius expanding edge is
 *     precisely the kind of large-area movement the preference asks to remove
 *   - anything thrown inside the transition — the swap has already been applied
 *
 * `startViewTransition` snapshots the document, so `swap` must do the DOM write
 * synchronously; anything asynchronous inside it would be captured mid-flight.
 */
export function runThemeTransition(swap: () => void, origin?: { x: number; y: number }): void {
  const root = document.documentElement;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  type WithViewTransition = Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };
  const start = (document as WithViewTransition).startViewTransition;

  if (typeof start !== 'function' || prefersReducedMotion) {
    swap();
    return;
  }

  if (origin) {
    root.style.setProperty('--theme-origin-x', `${origin.x}px`);
    root.style.setProperty('--theme-origin-y', `${origin.y}px`);
  }

  start.call(document, swap);
}
