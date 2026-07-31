/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CalculixHub service worker.
 *
 * Deliberately hand-written rather than generated: the app is a single HTML
 * entry plus hashed Vite assets, which needs far less machinery than a plugin
 * would bring, and the caching rules here are shaped by two app-specific facts.
 *
 *   1. The worker is served from the deployment root, so its own URL carries the
 *      base path. Everything below derives scope from `self.registration.scope`
 *      instead of assuming "/", which is what lets one file work unchanged on
 *      Vercel and Cloudflare (root) and GitHub Pages (/CalculixHub/).
 *
 *   2. /api/* is never cached. Those routes are Gemini-backed grading, tutoring
 *      and recommendation calls -- personalised, non-idempotent, and wrong to
 *      replay from a cache. They are network-only and fail loudly offline so the
 *      UI can surface its offline state rather than serve a stale answer.
 */

const VERSION = 'v1';
const SHELL_CACHE = `calculix-shell-${VERSION}`;
const ASSET_CACHE = `calculix-assets-${VERSION}`;

/** Deployment root, e.g. "/" on Vercel or "/CalculixHub/" on GitHub Pages. */
const SCOPE_PATH = new URL(self.registration.scope).pathname;

/**
 * Precached app shell.
 *
 * Only the entry document and the icons are listed. Vite's JS/CSS bundles carry
 * content hashes that change every build, so enumerating them here would mean
 * regenerating this file on each build; they are cached on first request by the
 * stale-while-revalidate branch below instead.
 */
const SHELL_URLS = [
  SCOPE_PATH,
  `${SCOPE_PATH}manifest.webmanifest`,
  `${SCOPE_PATH}icons/icon-180.png`,
  `${SCOPE_PATH}icons/icon-192.png`,
  `${SCOPE_PATH}icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll() is atomic: one 404 would reject the whole install and leave the
      // app with no worker. Precaching is best-effort, so failures are tolerated
      // per-URL and simply mean that entry gets cached on first use instead.
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('calculix-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * The app is a single-page app with no server-side routes, so any navigation
 * inside scope resolves to the same entry document.
 *
 * Network-first: a stale shell would pin users to an old JS bundle whose hashed
 * asset URLs may already be gone. The cache is the offline fallback only.
 */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(SCOPE_PATH, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(SCOPE_PATH)) ?? Response.error();
  }
}

/**
 * Hashed build assets and icons: stale-while-revalidate.
 *
 * The filename changes whenever the content does, so a cache hit is always
 * correct to serve immediately; the background revalidation exists to pick up
 * unhashed files such as the icons and the manifest.
 */
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await network) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave other origins (Google Fonts, analytics) to the browser's own cache.
  if (url.origin !== self.location.origin) return;

  // Never serve Gemini-backed routes from cache -- see the file header.
  if (url.pathname.startsWith(`${SCOPE_PATH}api/`) || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

/** Lets the page trigger activation of a waiting worker after an update. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
