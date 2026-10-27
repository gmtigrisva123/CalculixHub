export type SocialProvider = 'google' | 'facebook';

export function socialRedirect(origin: string, basePath = '/'): string {
  const base = new URL(basePath, origin);
  if (base.origin !== new URL(origin).origin || !['http:', 'https:'].includes(base.protocol)) {
    throw new Error('Invalid sign-in destination.');
  }
  base.search = '?auth=callback';
  base.hash = '';
  return base.href;
}

export function emailConfirmationRedirect(origin: string, basePath = '/'): string {
  const url = new URL(socialRedirect(origin, basePath));
  url.searchParams.set('auth', 'confirm');
  return url.href;
}

export function passwordRecoveryRedirect(origin: string, basePath = '/'): string {
  const url = new URL(socialRedirect(origin, basePath));
  url.search = '?recovery=1';
  return url.href;
}

export function socialCallbackError(href: string): string | null {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get('error') ?? hash.get('error');
  const code = url.searchParams.get('error_code') ?? hash.get('error_code');
  if (!error && !code) return null;
  if (error === 'access_denied' || code === 'access_denied') {
    return 'Sign-in was not completed. You can try again or use your email.';
  }
  return 'We could not complete your sign-in. Please try again in the same browser.';
}

export function safeAuthorizationUrl(value: string, supabaseUrl: string): string {
  const target = new URL(value);
  const expected = new URL(supabaseUrl);
  if (target.origin !== expected.origin || target.pathname !== '/auth/v1/authorize' || target.username || target.password) {
    throw new Error('Invalid authentication destination.');
  }
  return target.href;
}

// Capture callback state before the Supabase SDK exchanges and removes the code.
export const initialSocialCallback = typeof window !== 'undefined'
  ? { returning: new URLSearchParams(window.location.search).get('auth') === 'callback', error: socialCallbackError(window.location.href) }
  : { returning: false, error: null };

/**
 * Whether a URL is the landing of a sign-up confirmation link.
 *
 * `?auth=confirm` is what the app asks for. Supabase falls back to the bare Site
 * URL when a redirect is not allow-listed, which arrives as a PKCE `?code=` (or
 * an implicit `#type=signup`) with no marker, so those count too unless the
 * code belongs to a social or recovery redirect.
 */
export function isEmailConfirmationLanding(href: string): boolean {
  const url = new URL(href);
  const auth = url.searchParams.get('auth');
  if (auth === 'confirm') return true;
  if (auth === 'callback' || url.searchParams.get('recovery') === '1') return false;
  const hashType = new URLSearchParams(url.hash.slice(1)).get('type');
  return url.searchParams.has('code') || hashType === 'signup' || hashType === 'email';
}

export const initialEmailConfirmation = typeof window !== 'undefined'
  && isEmailConfirmationLanding(window.location.href);

/*
 * The browser a learner signed up in remembers it, so a confirmation link can
 * tell whether it was opened where the sign-up is waiting or on another device
 * (most often a phone's mail app). Only the latter is sent back to the first
 * device instead of being signed in on the spot.
 */
const PENDING_SIGNUP_KEY = 'calculix_pending_signup';

export function markPendingSignup(): void {
  try { localStorage.setItem(PENDING_SIGNUP_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}

export function clearPendingSignup(): void {
  try { localStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* storage unavailable */ }
}

function hasPendingSignup(): boolean {
  try { return localStorage.getItem(PENDING_SIGNUP_KEY) !== null; } catch { return false; }
}

/** A confirmation link opened somewhere other than the browser that signed up. */
export const initialConfirmationElsewhere = initialEmailConfirmation
  && !initialSocialCallback.error
  && !hasPendingSignup();

export const initialPasswordRecovery = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('recovery') === '1';

export function clearSocialCallback(): void {
  const url = new URL(window.location.href);
  if (!initialSocialCallback.returning && !initialSocialCallback.error && !initialEmailConfirmation && !initialPasswordRecovery) return;
  for (const name of ['auth', 'code', 'error', 'error_code', 'error_description']) url.searchParams.delete(name);
  if (url.hash.includes('error=')) url.hash = '';
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
