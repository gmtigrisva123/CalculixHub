import { describe, expect, it } from 'vitest';
import { emailConfirmationRedirect, isEmailConfirmationLanding, passwordRecoveryRedirect, safeAuthorizationUrl, socialCallbackError, socialRedirect } from './socialAuth';

describe('social sign-in boundaries', () => {
  it('returns to this deployment, including localhost and a subpath', () => {
    expect(socialRedirect('http://localhost:8000')).toBe('http://localhost:8000/?auth=callback');
    expect(socialRedirect('https://calculixhub.com','/study/')).toBe('https://calculixhub.com/study/?auth=callback');
  });
  it('rejects external or script-based callback destinations', () => {
    for (const path of ['//evil.example','https://evil.example/','javascript:alert(1)']) {
      expect(()=>socialRedirect('https://calculixhub.com',path)).toThrow();
    }
  });
  it('returns email confirmation to a distinct first-party callback', () => {
    expect(emailConfirmationRedirect('https://www.calculixhub.com')).toBe('https://www.calculixhub.com/?auth=confirm');
    expect(() => emailConfirmationRedirect('https://www.calculixhub.com', '//evil.example')).toThrow();
  });
  it('recognises a confirmation landing, including the bare Site URL fallback', () => {
    expect(isEmailConfirmationLanding('https://calculixhub.com/?auth=confirm&code=abc')).toBe(true);
    expect(isEmailConfirmationLanding('https://calculixhub.com/?code=abc')).toBe(true);
    expect(isEmailConfirmationLanding('https://calculixhub.com/#access_token=x&type=signup')).toBe(true);
    expect(isEmailConfirmationLanding('https://calculixhub.com/?auth=callback&code=abc')).toBe(false);
    expect(isEmailConfirmationLanding('https://calculixhub.com/?recovery=1&code=abc')).toBe(false);
    expect(isEmailConfirmationLanding('https://calculixhub.com/?tab=learn')).toBe(false);
  });
  it('keeps password recovery on the same deployment', () => {
    expect(passwordRecoveryRedirect('https://www.calculixhub.com')).toBe('https://www.calculixhub.com/?recovery=1');
    expect(passwordRecoveryRedirect('http://localhost:8000', '/study/')).toBe('http://localhost:8000/study/?recovery=1');
    expect(() => passwordRecoveryRedirect('https://www.calculixhub.com', '//evil.example')).toThrow();
  });
  it('does not reflect untrusted provider error descriptions', () => {
    expect(socialCallbackError('https://calculixhub.com/?error=access_denied&error_description=SECRET')).toContain('not completed');
    expect(socialCallbackError('https://calculixhub.com/#error=server_error&error_description=SECRET')).not.toContain('SECRET');
    expect(socialCallbackError('https://calculixhub.com/?code=secret')).toBeNull();
  });
  it('only navigates to the configured project authorization endpoint', () => {
    const base='https://example.supabase.co';
    expect(safeAuthorizationUrl(base+'/auth/v1/authorize?provider=google&code_challenge=test',base)).toContain('provider=google');
    for (const value of ['https://evil.example/auth/v1/authorize',base+'/storage/v1/object', 'https://user:password@example.supabase.co/auth/v1/authorize']) {
      expect(()=>safeAuthorizationUrl(value,base)).toThrow();
    }
  });
});
