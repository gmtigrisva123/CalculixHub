/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Daily streak reminders.
 *
 * Scheduled on the device, not sent from a server. Real push notification
 * delivery on iOS requires an Apple Developer account and APNs credentials,
 * which this project does not have; local scheduling needs neither and is the
 * right mechanism regardless, because the reminder is a fixed daily time rather
 * than a server-side event.
 *
 * Two backends behind one interface:
 *   native -- Capacitor LocalNotifications, which survives the app being closed.
 *   web    -- the Notification API, which only fires while a tab is open. That
 *             limitation is stated in the UI rather than papered over.
 */

import { isNativePlatform } from './apiBase';

const ENABLED_KEY = 'calculix_reminders_enabled';
const HOUR_KEY = 'calculix_reminders_hour';

/** Stable id so rescheduling replaces the reminder instead of stacking copies. */
const NOTIFICATION_ID = 1;

const DEFAULT_HOUR = 18;

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/** Lazily imported so the web bundle does not pull in the native plugin. */
async function localNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

export function remindersEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

export function reminderHour(): number {
  const stored = Number(localStorage.getItem(HOUR_KEY));
  return Number.isInteger(stored) && stored >= 0 && stored <= 23 ? stored : DEFAULT_HOUR;
}

/** Current notification permission, without prompting. */
export async function permissionState(): Promise<PermissionState> {
  if (isNativePlatform()) {
    try {
      const result = await (await localNotifications()).checkPermissions();
      return result.display === 'prompt' ? 'default' : (result.display as PermissionState);
    } catch {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

/**
 * Request permission, prompting the user.
 *
 * Must be called from a user gesture. Browsers reject unsolicited permission
 * prompts, and iOS additionally refuses them outside an installed PWA -- which
 * is one of the reasons the install sheet exists.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (isNativePlatform()) {
    try {
      const result = await (await localNotifications()).requestPermissions();
      return result.display === 'prompt' ? 'default' : (result.display as PermissionState);
    } catch {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';

  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'unsupported';
  }
}

/** Next occurrence of `hour` — today if it is still ahead, otherwise tomorrow. */
function nextOccurrence(hour: number): Date {
  const at = new Date();
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= Date.now()) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

/**
 * Enable the daily reminder.
 *
 * @returns the resulting permission state, so the caller can explain a refusal
 *          rather than silently showing the toggle as on.
 */
export async function enableReminders(hour: number = DEFAULT_HOUR): Promise<PermissionState> {
  const permission = await requestPermission();
  if (permission !== 'granted') return permission;

  localStorage.setItem(ENABLED_KEY, 'true');
  localStorage.setItem(HOUR_KEY, String(hour));

  if (isNativePlatform()) {
    const plugin = await localNotifications();

    // Cancel first: scheduling over an existing id is not defined to replace it
    // on every platform, and duplicates would mean two reminders a day.
    await plugin.cancel({ notifications: [{ id: NOTIFICATION_ID }] }).catch(() => undefined);

    await plugin.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: 'Keep your streak alive',
          body: 'One problem is enough to hold today. Your weakest domain is waiting.',
          schedule: {
            at: nextOccurrence(hour),
            // Repeats daily at the same wall-clock time, so the reminder tracks
            // the user's routine across DST rather than drifting by an hour.
            repeats: true,
            every: 'day',
          },
        },
      ],
    });
  }

  return 'granted';
}

export async function disableReminders(): Promise<void> {
  localStorage.setItem(ENABLED_KEY, 'false');

  if (isNativePlatform()) {
    const plugin = await localNotifications();
    await plugin.cancel({ notifications: [{ id: NOTIFICATION_ID }] }).catch(() => undefined);
  }
}

/**
 * Re-arm the reminder on launch.
 *
 * iOS keeps scheduled notifications across restarts, so this is a no-op in the
 * common case; it matters after a reinstall or a permission reset, where the
 * stored preference says enabled but no notification is actually scheduled.
 */
export async function syncReminders(): Promise<void> {
  if (!remindersEnabled()) return;
  if ((await permissionState()) !== 'granted') return;
  await enableReminders(reminderHour());
}
