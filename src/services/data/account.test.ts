import { describe, expect, it, vi } from 'vitest';

// The module under test only needs the client to exist as an import.
vi.mock('../supabase', () => ({ supabase: null, AUTH_STORAGE_KEY: 'calculixhub.auth' }));

import { exportableDeviceKeys, ownDeviceKeys } from './account';

const STORED = [
  'calculixhub.auth',
  'calculix_theme',
  'calculix_scratch_v1',
  'calculix_race_day_v1',
  'calculix_gemini_api_key',
  'calculix_gemini_model',
  'calculix_guest_access',
  'some_other_site',
];

describe('what this browser stores', () => {
  it('never puts the sign-in session or an API key into an export', () => {
    const exported = exportableDeviceKeys(STORED);
    expect(exported).not.toContain('calculixhub.auth');
    expect(exported).not.toContain('calculix_gemini_api_key');
    expect(exported).toEqual(['calculix_theme', 'calculix_scratch_v1', 'calculix_race_day_v1', 'calculix_gemini_model', 'calculix_guest_access']);
  });

  it('forgets preferences and saved keys, but leaves the session and other sites alone', () => {
    const cleared = ownDeviceKeys(STORED);
    expect(cleared).toContain('calculix_gemini_api_key');
    expect(cleared).not.toContain('calculixhub.auth');
    expect(cleared).not.toContain('some_other_site');
  });
});
