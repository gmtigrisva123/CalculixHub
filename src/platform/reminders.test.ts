/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reminderHour } from './reminders';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
});

describe('reminderHour', () => {
  beforeEach(() => store.clear());

  it('falls back to the evening default when no hour has been stored', () => {
    expect(reminderHour()).toBe(18);
  });

  it('keeps a stored hour, midnight included', () => {
    store.set('calculix_reminders_hour', '7');
    expect(reminderHour()).toBe(7);
    store.set('calculix_reminders_hour', '0');
    expect(reminderHour()).toBe(0);
  });

  it('ignores anything that is not an hour of the day', () => {
    for (const value of ['', '24', '-1', '6.5', 'evening']) {
      store.set('calculix_reminders_hour', value);
      expect(reminderHour()).toBe(18);
    }
  });
});
