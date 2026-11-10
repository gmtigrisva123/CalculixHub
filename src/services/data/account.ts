/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The things a learner can do to their own account: edit how they appear, take
 * a copy of everything stored about them, clear their practice record, and
 * leave. The two destructive ones are database functions that act on the
 * caller's own id and nothing else (supabase/account-billing-setup.sql); the
 * browser can ask for them and has no way to aim them at anyone.
 */

import { AUTH_STORAGE_KEY, supabase } from '../supabase';

export type AccountResult = { ok: true } | { ok: false; error: string };

const UNAVAILABLE: AccountResult = { ok: false, error: 'Accounts are unavailable in this build.' };

export interface ProfileEdit {
  displayName: string;
  bio: string;
  country: string;
}

export async function updateProfile(userId: string, edit: ProfileEdit): Promise<AccountResult> {
  if (!supabase) return UNAVAILABLE;
  const displayName = edit.displayName.trim();
  if (displayName.length < 1 || displayName.length > 60) return { ok: false, error: 'Your name needs to be between 1 and 60 characters.' };
  if (edit.bio.length > 280) return { ok: false, error: 'Keep your bio to 280 characters.' };
  if (edit.country.trim().length > 56) return { ok: false, error: 'That country name is too long.' };
  const { error } = await supabase.from('profiles').update({
    display_name: displayName,
    bio: edit.bio.trim() || null,
    country: edit.country.trim() || null,
  }).eq('id', userId);
  return error ? { ok: false, error: 'Could not save your profile. Please try again.' } : { ok: true };
}

/** Ends every session this account has, on every device. */
export async function signOutEverywhere(): Promise<AccountResult> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  return error ? { ok: false, error: 'Could not sign out of your other devices. Please try again.' } : { ok: true };
}

export async function resetMyProgress(): Promise<AccountResult> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.rpc('reset_my_progress');
  return error ? { ok: false, error: 'Could not reset your progress. Nothing was changed.' } : { ok: true };
}

export async function deleteMyAccount(): Promise<AccountResult> {
  if (!supabase) return UNAVAILABLE;
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // P0001 is the function's own refusal, written to be shown as it stands.
    return { ok: false, error: error.code === 'P0001' ? error.message : 'Could not delete your account. Nothing was changed.' };
  }
  // The account no longer exists; this only clears the token this browser holds.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  // Belt and braces: a token for an account that no longer exists must not be left behind.
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* storage is unavailable */ }
  clearLocalData();
  return { ok: true };
}

/**
 * Which of this browser's stored keys are CalculixHub's own preferences and
 * working data.
 *
 * Those all start `calculix_`. The sign-in session is deliberately not among
 * them: it is stored under a different name, and it is a credential. It must
 * never be written into an export file, and "forget this device" clears
 * preferences without signing anyone out. Anything that looks like a key or
 * token is left out as well, so a future setting cannot leak one by accident.
 */
export function ownDeviceKeys(keys: readonly string[]): string[] {
  return keys.filter(key => key.startsWith('calculix_'));
}
export const exportableDeviceKeys = (keys: readonly string[]): string[] =>
  ownDeviceKeys(keys).filter(key => !/key|token|auth|secret|session/i.test(key));

/** Clears what this browser remembers for CalculixHub. The account, and the session, are untouched. */
export function clearLocalData(): void {
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const key of ownDeviceKeys(Object.keys(store))) store.removeItem(key);
    } catch { /* storage is unavailable; there is nothing to clear */ }
  }
}

const OWN_TABLES: readonly { name: string; column: string }[] = [
  { name: 'profiles', column: 'id' },
  { name: 'learner_preferences', column: 'user_id' },
  { name: 'user_stats', column: 'user_id' },
  { name: 'skill_mastery', column: 'user_id' },
  { name: 'problem_attempts', column: 'user_id' },
  { name: 'exam_archive_progress', column: 'user_id' },
  { name: 'arena_entries', column: 'user_id' },
  { name: 'posts', column: 'author_id' },
  { name: 'comments', column: 'author_id' },
  { name: 'messages', column: 'sender_id' },
  { name: 'follows', column: 'follower_id' },
  { name: 'saved_posts', column: 'user_id' },
  { name: 'notifications', column: 'user_id' },
  { name: 'subscriptions', column: 'user_id' },
  { name: 'plan_interest', column: 'user_id' },
];

export interface DataExport {
  exported_at: string;
  account: { id: string; email: string | null };
  /** One entry per table. A table this project does not have is recorded as unavailable, not dropped. */
  tables: Record<string, unknown[] | { unavailable: true }>;
  this_device: Record<string, string>;
}

/**
 * Everything stored about the signed-in learner, read through the same
 * row-level security as the rest of the app, so the copy can only ever contain
 * rows this learner was already allowed to see.
 */
export async function exportMyData(userId: string, email: string | null): Promise<DataExport | null> {
  if (!supabase) return null;
  const client = supabase;
  const results = await Promise.all(OWN_TABLES.map(async ({ name, column }) => {
    const { data, error } = await client.from(name).select('*').eq(column, userId).limit(10_000);
    return [name, error ? { unavailable: true as const } : data ?? []] as const;
  }));
  const device: Record<string, string> = {};
  try {
    // Secrets stay out: a file that may get emailed around is no place for an API key or a session.
    for (const key of exportableDeviceKeys(Object.keys(localStorage))) device[key] = localStorage.getItem(key) ?? '';
  } catch { /* storage is unavailable */ }
  return { exported_at: new Date().toISOString(), account: { id: userId, email }, tables: Object.fromEntries(results), this_device: device };
}

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
