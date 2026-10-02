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

export const initialEmailConfirmation = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('auth') === 'confirm';

export const initialPasswordRecovery = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('recovery') === '1';

export function clearSocialCallback(): void {
  const url = new URL(window.location.href);
  if (!initialSocialCallback.returning && !initialSocialCallback.error && !initialEmailConfirmation && !initialPasswordRecovery) return;
  for (const name of ['auth', 'code', 'error', 'error_code', 'error_description']) url.searchParams.delete(name);
  if (url.hash.includes('error=')) url.hash = '';
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
