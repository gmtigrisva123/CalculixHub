/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication state for the whole application.
 *
 * Replaces `sessionStorage.getItem('calculix_is_logged_in') === 'true'`, which
 * was not authentication: it was a string the browser owned, so anyone could
 * set it in a console and be "signed in", and it conveyed no identity the
 * server could act on. Here the source of truth is a server-signed JWT that
 * Supabase verifies on every request and that every RLS policy reads.
 *
 * Three things this file is responsible for getting right:
 *
 *   1. **Restoration.** On load the session is rehydrated before anything
 *      renders a signed-out view, so a refresh does not bounce a signed-in
 *      learner back to the landing page.
 *   2. **A single loading state.** `status` distinguishes "still checking" from
 *      "definitely signed out". Collapsing those two is what produces the
 *      flash of the login screen on every refresh.
 *   3. **Onboarding exactly once.** Completion is a column on the profile, so
 *      it survives a new device and cannot be replayed by clearing storage.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isBackendConfigured, supabase } from '../lib/supabase';
import type { Level, ProfileRow, Topic } from '../lib/database.types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export interface AuthResult {
  ok: boolean;
  /** Message safe to show a learner. Never carries a provider error verbatim. */
  error?: string;
  /** True when sign-up succeeded but the address still needs confirming. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  /** True once placement is complete. Read from the profile, not from storage. */
  hasOnboarded: boolean;

  signUp(input: { email: string; password: string; username: string; displayName: string }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;

  /** Records placement results and marks onboarding complete, server-side. */
  completeOnboarding(input: { level: Level; skills?: Partial<Record<Topic, number>> }): Promise<AuthResult>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Map a provider error to something a learner can act on.
 *
 * Supabase messages are written for developers and occasionally reveal whether
 * an address exists. Sign-in failures are deliberately collapsed into one
 * message so this form cannot be used to enumerate registered accounts.
 */
function friendlyAuthError(raw: string | undefined, context: 'signIn' | 'signUp' | 'reset'): string {
  const message = (raw ?? '').toLowerCase();

  if (message.includes('rate') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (context === 'signIn') {
    return 'That email and password combination is not correct.';
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account already exists for that email. Try signing in instead.';
  }
  if (message.includes('password')) {
    return 'Choose a password of at least 8 characters.';
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'That email address does not look valid.';
  }

  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isBackendConfigured ? 'loading' : 'unavailable');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // Guards against a state update after unmount, and against an in-flight
  // profile fetch for a previous user landing on the next one.
  const activeUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string): Promise<ProfileRow | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, country, level, follower_count, following_count, onboarded_at, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[CalculixHub] Could not load profile', error.message);
      return null;
    }

    return (data as ProfileRow | null) ?? null;
  }, []);

  /**
   * Rehydrate on mount, then follow every subsequent auth change.
   *
   * `getSession` reads the persisted session and refreshes it if needed;
   * `onAuthStateChange` then keeps this state in step with token refreshes,
   * sign-out in another tab, and the redirect back from a recovery email.
   */
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    const apply = async (next: Session | null) => {
      if (cancelled) return;

      setSession(next);
      activeUserId.current = next?.user.id ?? null;

      if (next?.user) {
        const loaded = await loadProfile(next.user.id);
        if (cancelled || activeUserId.current !== next.user.id) return;
        setProfile(loaded);
        setStatus('authenticated');
      } else {
        setProfile(null);
        setStatus('anonymous');
      }
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      void apply(next);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const userId = activeUserId.current;
    if (!userId) return;
    const loaded = await loadProfile(userId);
    if (activeUserId.current === userId) setProfile(loaded);
  }, [loadProfile]);

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ email, password, username, displayName }) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };

    // Checked here for a fast, clear message. The database enforces both the
    // format and case-insensitive uniqueness regardless of what is sent.
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9_]*[A-Za-z0-9])?$/.test(username) || username.length < 3 || username.length > 24) {
      return { ok: false, error: 'Usernames are 3-24 characters: letters, numbers and underscores.' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Choose a password of at least 8 characters.' };
    }

    // Best-effort pre-check so the learner is told before submitting. It is a
    // race, not a guarantee -- the unique index is what actually decides -- so
    // the insert path below still has to handle a collision.
    const { data: taken } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle();
    if (taken) return { ok: false, error: 'That username is taken. Try another.' };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Read by the `handle_new_user` trigger, which creates the profile in
        // the same transaction as the account.
        data: { username, display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`,
      },
    });

    if (error) return { ok: false, error: friendlyAuthError(error.message, 'signUp') };

    // No session means the project requires email confirmation first.
    return { ok: true, needsEmailConfirmation: !data.session };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async ({ email, password }) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: friendlyAuthError(error.message, 'signIn') };

    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setStatus('anonymous');
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(async (email) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}?recovery=1`,
    });

    // Deliberately reports success either way. Distinguishing "sent" from "no
    // such account" turns this form into an account-enumeration oracle.
    if (error) console.warn('[CalculixHub] Password reset request failed', error.message);
    return { ok: true };
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (newPassword) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    if (newPassword.length < 8) return { ok: false, error: 'Choose a password of at least 8 characters.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: friendlyAuthError(error.message, 'reset') };

    return { ok: true };
  }, []);

  const completeOnboarding = useCallback<AuthContextValue['completeOnboarding']>(
    async ({ level }) => {
      if (!supabase || !activeUserId.current) {
        return { ok: false, error: 'You need to be signed in.' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ level, onboarded_at: new Date().toISOString() })
        .eq('id', activeUserId.current);

      if (error) return { ok: false, error: 'Could not save your placement. Try again.' };

      await refreshProfile();
      return { ok: true };
    },
    [refreshProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      hasOnboarded: Boolean(profile?.onboarded_at),
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      completeOnboarding,
      refreshProfile,
    }),
    [status, session, profile, signUp, signIn, signOut, requestPasswordReset, updatePassword, completeOnboarding, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
