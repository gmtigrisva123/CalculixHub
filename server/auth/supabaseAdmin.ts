/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side Supabase access.
 *
 * Two clients, with very different powers, kept apart on purpose:
 *
 *   - `verifyAccessToken` uses the **anon** key to ask Supabase who a bearer
 *     token belongs to. It is the identity check.
 *   - `adminClient` uses the **service-role** key, which bypasses every
 *     row-level security policy in the project. It exists for exactly one
 *     reason: writing graded attempts, which no client may write.
 *
 * The service-role key is the most dangerous credential in the system. It is
 * read only from a server environment variable, never prefixed `VITE_` (which
 * would inline it into the browser bundle), and never returned or logged.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let admin: SupabaseClient | null | undefined;
let identity: SupabaseClient | null | undefined;

/**
 * Client that bypasses row-level security. Use only where a policy deliberately
 * denies all clients and the server is the sole legitimate writer.
 *
 * Returns `null` when unconfigured, so callers degrade rather than crash --
 * the app is still fully usable for practice without a backend.
 */
export function adminClient(): SupabaseClient | null {
  if (admin !== undefined) return admin;

  const { supabaseUrl, supabaseServiceRoleKey } = config();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    admin = null;
    return admin;
  }

  admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return admin;
}

function identityClient(): SupabaseClient | null {
  if (identity !== undefined) return identity;

  const { supabaseUrl, supabaseAnonKey } = config();
  if (!supabaseUrl || !supabaseAnonKey) {
    identity = null;
    return identity;
  }

  identity = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return identity;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Resolve the caller's identity from an `Authorization: Bearer <jwt>` header.
 *
 * The token is verified by Supabase rather than merely decoded here. Decoding a
 * JWT tells you what it claims; only checking the signature tells you whether
 * the claim is true, and a `sub` taken from an unverified token is an
 * impersonation vector -- an attacker can write any user id they like.
 *
 * @returns the user, or `null` for absent, malformed, expired or forged tokens.
 */
export async function verifyAccessToken(authorizationHeader: string | null): Promise<AuthenticatedUser | null> {
  if (!authorizationHeader) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) return null;

  const client = identityClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(match[1]!);

  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/** Drops memoised clients. Test-only. */
export function resetSupabaseClientsForTests(): void {
  admin = undefined;
  identity = undefined;
}
