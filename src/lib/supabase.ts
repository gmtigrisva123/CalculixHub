/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The browser Supabase client.
 *
 * Only the **anon** key is ever used here. It is a public credential by design:
 * it identifies the project and nothing more, and every request made with it is
 * still evaluated against row-level security using the caller's own JWT. The
 * service-role key, which bypasses RLS entirely, must never reach this file or
 * anything it imports -- it lives only in server environment variables.
 *
 * Session handling is delegated to the SDK rather than reimplemented:
 *
 *   - `persistSession` keeps the session across reloads and app restarts, which
 *     is what makes "still signed in tomorrow" work.
 *   - `autoRefreshToken` renews the access token before it expires, so a long
 *     session does not end mid-use.
 *   - `detectSessionInUrl` completes the email-confirmation and password-reset
 *     redirects, which arrive as URL fragments.
 *
 * Storage is the SDK's default (localStorage). That is not a violation of "do
 * not use localStorage as the database": what is stored is a short-lived,
 * server-signed JWT plus a refresh token, and the server verifies its signature
 * on every request. No user data and no authorization decision lives there.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * Whether the app was built with backend credentials.
 *
 * Deliberately not an exception. The client bundle is also published to GitHub
 * Pages with no backend, where the IRT engine, practice and analytics all still
 * work offline. Callers check this and degrade rather than crash, and the UI
 * tells the learner that accounts are unavailable instead of showing a login
 * form that cannot succeed.
 */
export const isBackendConfigured = Boolean(url && anonKey);

if (!isBackendConfigured && import.meta.env.PROD) {
  console.warn(
    '[CalculixHub] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Accounts, the community feed and the leaderboard are disabled in this build.',
  );
}

/**
 * A guard against the most damaging possible misconfiguration.
 *
 * A service-role JWT carries `"role":"service_role"` and bypasses every RLS
 * policy in the project. Pasting it into the anon-key variable would ship a
 * skeleton key for the entire database inside a public JavaScript bundle. It is
 * cheap to detect and catastrophic to miss, so it fails the build-time client
 * outright rather than warning.
 */
function assertNotServiceRole(key: string): void {
  try {
    const payload = key.split('.')[1];
    if (!payload) return;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };

    if (claims.role === 'service_role') {
      throw new Error(
        'VITE_SUPABASE_ANON_KEY holds a service_role key. That key bypasses all ' +
          'row-level security and must never be exposed to a browser. Use the anon key.',
      );
    }
  } catch (error) {
    // Rethrow only our own assertion; a key we cannot parse is not proof of
    // anything and must not break a working deployment.
    if (error instanceof Error && error.message.includes('service_role')) throw error;
  }
}

if (isBackendConfigured) assertNotServiceRole(anonKey);

/**
 * The shared client, or `null` when no backend is configured.
 *
 * Nullable rather than a throwing proxy so that every consumer is forced by the
 * type system to handle the unconfigured build, instead of discovering it at
 * runtime on a page the learner is already looking at.
 */
export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'calculixhub.auth',
      },
      realtime: {
        // Caps how fast this client will process broadcasts. Without it a busy
        // thread can push more updates than the UI can render.
        params: { eventsPerSecond: 10 },
      },
      global: {
        headers: { 'x-application-name': 'calculixhub-web' },
      },
    })
  : null;

/**
 * The client, or a thrown error.
 *
 * For call sites that only run behind an authenticated route, where an
 * unconfigured backend is already impossible and threading a null check through
 * would add noise without adding safety.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured in this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
