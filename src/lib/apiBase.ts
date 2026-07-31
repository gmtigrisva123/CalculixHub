/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolves the base URL for backend calls.
 *
 * On the web the app and the API share an origin, so relative paths are correct
 * and are what should be used -- they follow the deployment automatically and
 * need no configuration.
 *
 * Inside the native WebView there is no such origin. The bundle is served from
 * the app container, so a relative "/api/chat" resolves against that local
 * scheme and never reaches the server. The native build therefore needs an
 * absolute URL, supplied at build time.
 */

/**
 * Absolute backend origin for the native build, e.g. "https://calculixhub.vercel.app".
 *
 * Set VITE_API_BASE_URL when building for iOS. Left empty for web builds, where
 * same-origin relative paths are correct. No default is baked in on purpose: a
 * guessed domain would produce an app that fails at runtime with a confusing
 * network error instead of an obvious misconfiguration.
 */
const CONFIGURED_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

/** True when running inside the Capacitor native shell rather than a browser. */
export const isNativePlatform = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/**
 * Build a URL for a backend route.
 *
 * @param path Root-relative API path, e.g. "/api/chat".
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (CONFIGURED_BASE) return `${CONFIGURED_BASE}${normalized}`;

  if (isNativePlatform() && import.meta.env.PROD) {
    // Fail loudly rather than issuing a request that cannot succeed. Reaching
    // here means the iOS build was produced without VITE_API_BASE_URL, so the
    // AI tutor, grading and recommendations would all silently break.
    console.error(
      '[CalculixHub] VITE_API_BASE_URL is not set. The native app cannot reach ' +
        '/api/* without an absolute backend URL — set it and rebuild.',
    );
  }

  return normalized;
}
