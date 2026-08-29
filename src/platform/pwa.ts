/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Install and service-worker plumbing for the installable app.
 */

/**
 * The `beforeinstallprompt` event, which TypeScript's DOM lib does not declare
 * because it is not in any standard -- it is a Chromium extension.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Deployment root the app is served from, e.g. "/" or "/CalculixHub/".
 *
 * Vite substitutes BASE_URL at build time from the --base flag, which is how the
 * worker registers at the right path on GitHub Pages without a second config.
 */
const BASE_URL = import.meta.env.BASE_URL;

/**
 * Register the service worker.
 *
 * Registration is deferred to the load event so the worker's own install-time
 * precaching never competes for bandwidth with the first paint.
 *
 * A service worker's scope cannot rise above its own directory, so serving it
 * from the deployment root is what allows it to control the whole app.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // A worker registered from a dev server would cache Vite's unhashed module
  // URLs and shadow later edits, so it is production-only.
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_URL}sw.js`, { scope: BASE_URL }).catch((error) => {
      // A failed registration costs offline support, not the app. Report and move on.
      console.error('[CalculixHub] Service worker registration failed:', error);
    });
  });
}

/** True when running as an installed app rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari's non-standard flag, still the only signal on iOS.
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/**
 * True on iOS/iPadOS Safari, which never fires `beforeinstallprompt`.
 *
 * Installing there is a manual Share -> Add to Home Screen gesture, so the UI
 * has to show instructions instead of an install button. iPadOS 13+ reports a
 * desktop platform string, hence the touch-point check.
 */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;

  // Chrome and Firefox on iOS are WebKit shells that cannot install to the home
  // screen at all, so the Safari-specific instructions would be misleading.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
