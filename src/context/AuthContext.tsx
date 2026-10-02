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
import { isBackendConfigured, supabase } from '../services/supabase';
import { useRealtimeSubscription } from '../services/data/realtime';
import { deriveSignupUsername } from '../services/authInput';
import type { Level, ProfileRow } from '../services/database.types';
import { clearSocialCallback, emailConfirmationRedirect, initialEmailConfirmation, initialPasswordRecovery, initialSocialCallback, passwordRecoveryRedirect, safeAuthorizationUrl, socialRedirect, type SocialProvider } from '../services/socialAuth';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export interface AuthResult {
  ok: boolean;
  /** Message safe to show a learner. Never carries a provider error verbatim. */
  error?: string;
  /** True when sign-up succeeded but the address still needs confirming. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  authError: string | null;
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  recoveringPassword: boolean;
  /** True once placement is complete. Read from the profile, not from storage. */
  hasOnboarded: boolean;

  signUp(input: { email: string; password: string; displayName: string }): Promise<AuthResult>;
  resendConfirmation(email: string): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signInWithSocial(provider: SocialProvider): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;

  /** Records placement results and marks onboarding complete, server-side. */
  completeOnboarding(input: { level: Level }): Promise<AuthResult>;
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

  if (message.includes('email address not authorized')) {
    return 'Confirmation email is temporarily unavailable. Please contact support.';
  }
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
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialSocialCallback.error);
  const socialInFlight = useRef(false);

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
   * The SDK emits INITIAL_SESSION after restoring storage or exchanging a
   * callback code. Later events cover refreshes and sign-out in another tab.
   */
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    let revision = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const apply = async (next: Session | null, currentRevision: number) => {
      if (cancelled || currentRevision !== revision) return;
      const previousUserId = activeUserId.current;
      setSession(next);
      activeUserId.current = next?.user.id ?? null;

      if (next?.user) {
        if (previousUserId !== next.user.id) {
          setProfile(null);
          setStatus('loading');
        }
        const loaded = await loadProfile(next.user.id);
        if (cancelled || currentRevision !== revision || activeUserId.current !== next.user.id) return;
        setProfile(loaded);
        setStatus('authenticated');
      } else {
        setProfile(null);
        setStatus('anonymous');
      }
    };

    // The client initializes itself. INITIAL_SESSION arrives after it has
    // exchanged an OAuth, email confirmation, or recovery URL code. Querying
    // Supabase inside this callback can deadlock its auth lock, so defer work.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
      if (event === 'SIGNED_OUT') setRecoveringPassword(false);
      if (next && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) setAuthError(null);
      if (event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') {
        if ((initialSocialCallback.returning || initialEmailConfirmation || initialPasswordRecovery) && !next) {
          setAuthError(initialSocialCallback.error ?? 'Your sign-in link expired or could not be verified. Please start again in this browser.');
        }
        clearSocialCallback();
      }
      const currentRevision = ++revision;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { void apply(next, currentRevision); }, 0);
    });

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const userId = activeUserId.current;
    if (!userId) return;
    const loaded = await loadProfile(userId);
    if (activeUserId.current === userId) setProfile(loaded);
  }, [loadProfile]);

  useRealtimeSubscription({table:'profiles',filter:session?.user.id?`id=eq.${session.user.id}`:undefined,enabled:Boolean(session?.user.id),onReconnect:refreshProfile},()=>void refreshProfile());

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ email, password, displayName }) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    setAuthError(null);

    if (!displayName.trim() || displayName.trim().length > 60) return { ok: false, error: 'Enter a display name of 1–60 characters.' };
    if (password.length < 8) {
      return { ok: false, error: 'Choose a password of at least 8 characters.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The trigger creates the profile and resolves duplicate handles.
          data: { username: deriveSignupUsername(displayName, email), display_name: displayName.trim() },
          emailRedirectTo: emailConfirmationRedirect(window.location.origin, import.meta.env.BASE_URL),
        },
      });
      if (error) return { ok: false, error: friendlyAuthError(error.message, 'signUp') };
      return { ok: true, needsEmailConfirmation: !data.session };
    } catch {
      return { ok: false, error: 'Could not connect to sign-up. Check your connection and try again.' };
    }
  }, []);

  const resendConfirmation = useCallback<AuthContextValue['resendConfirmation']>(async (email) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: emailConfirmationRedirect(window.location.origin, import.meta.env.BASE_URL) },
      });
      if (error) return { ok: false, error: friendlyAuthError(error.message, 'signUp') };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not request another link. Check your connection and try again.' };
    }
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async ({ email, password }) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error?.code === 'email_not_confirmed' || error?.message.toLowerCase().includes('email not confirmed')) {
        return { ok: false, needsEmailConfirmation: true };
      }
      if (error) return { ok: false, error: friendlyAuthError(error.message, 'signIn') };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not connect to sign-in. Check your connection and try again.' };
    }
  }, []);

  const signInWithSocial = useCallback<AuthContextValue['signInWithSocial']>(async (provider) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    if (provider !== 'google' && provider !== 'facebook') return { ok: false, error: 'Unsupported sign-in provider.' };
    if (socialInFlight.current) return { ok: false, error: 'Sign-in is already opening.' };
    socialInFlight.current = true;
    setAuthError(null);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL.trim();
      const response = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        signal: AbortSignal.timeout(10000), cache: 'no-store',
      });
      if (!response.ok) throw new Error('Sign-in is temporarily unavailable. Please try again.');
      const settings = await response.json();
      if (!settings.external?.[provider]) {
        return { ok: false, error: `${provider === 'google' ? 'Google' : 'Facebook'} sign-in is not available yet. Please use email for now.` };
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: socialRedirect(window.location.origin, import.meta.env.BASE_URL),
          skipBrowserRedirect: true,
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : { scopes: 'email' }),
        },
      });
      if (error || !data.url) throw new Error('Could not start sign-in. Please try again.');
      const destination = safeAuthorizationUrl(data.url, url);
      // OAuth providers must open at the top level, including from the phone preview.
      (window.top ?? window).location.assign(destination);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not open sign-in. Check your connection and try again from the full website.' };
    } finally { socialInFlight.current = false; }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return { ok: false, error: 'Could not sign out. Please try again.' };
      setProfile(null);
      setSession(null);
      setStatus('anonymous');
      setRecoveringPassword(false);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not sign out. Check your connection and try again.' };
    }
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(async (email) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: passwordRecoveryRedirect(window.location.origin, import.meta.env.BASE_URL),
      });
      // Unknown addresses already get a successful response from Supabase.
      // An actual error means the request failed, so do not claim it was sent.
      if (error) return { ok: false, error: friendlyAuthError(error.message, 'reset') };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not request a reset link. Check your connection and try again.' };
    }
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (newPassword) => {
    if (!supabase) return { ok: false, error: 'Accounts are unavailable in this build.' };
    if (newPassword.length < 8) return { ok: false, error: 'Choose a password of at least 8 characters.' };

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: friendlyAuthError(error.message, 'reset') };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not update your password. Check your connection and try again.' };
    }
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
      authError,
      session,
      user: session?.user ?? null,
      profile,
      recoveringPassword,
      hasOnboarded: Boolean(profile?.onboarded_at),
      signUp,
      resendConfirmation,
      signIn,
      signInWithSocial,
      signOut,
      requestPasswordReset,
      updatePassword,
      completeOnboarding,
      refreshProfile,
    }),
    [status, authError, session, profile, recoveringPassword, signUp, resendConfirmation, signIn, signInWithSocial, signOut, requestPasswordReset, updatePassword, completeOnboarding, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
