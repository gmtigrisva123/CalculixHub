/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Whether the app can actually reach the network.
 *
 * `navigator.onLine` and the browser's `offline` event are not evidence of
 * being offline. They report the operating system's view of its network
 * interfaces, which is wrong in ordinary situations: a VPN reconnecting, Wi-Fi
 * roaming between access points, a laptop waking from sleep, some proxy and
 * hotspot setups. Trusting them showed the offline banner to learners whose
 * connection was working, and left it up when no `online` event followed.
 *
 * So the browser's signal only raises a suspicion. The banner appears once a
 * real request has failed after a short grace period, and goes away as soon as
 * one succeeds, whatever the browser claims.
 */

/** How long a suspected outage must last before it is confirmed. */
export const OFFLINE_GRACE_MS = 4_000;
/** How often an outage is re-checked while the banner is showing. */
export const OFFLINE_RECHECK_MS = 10_000;
/** A probe slower than this counts as unreachable. */
export const PROBE_TIMEOUT_MS = 8_000;

export interface ConnectivityDeps {
  /** Resolves true when a request reached a server, whatever it answered. */
  probe: () => Promise<boolean>;
  /** The browser's own claim, consulted only to decide whether to check at start. */
  browserOnline: () => boolean;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface ConnectivityMonitor {
  readonly online: boolean;
  /** Run once listeners are attached. Checks immediately if the browser already reports offline. */
  start(): void;
  /** The browser reported going offline: confirm it after the grace period. */
  suspect(): void;
  /** Something suggests the connection is back (online event, focus): check now if offline. */
  recheck(): void;
  dispose(): void;
}

export function createConnectivityMonitor(deps: ConnectivityDeps, onChange: (online: boolean) => void): ConnectivityMonitor {
  let online = true;
  let timer: unknown = null;
  let checking = false;
  let disposed = false;

  const clear = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };

  const schedule = (ms: number) => {
    clear();
    timer = deps.setTimer(() => {
      timer = null;
      void check();
    }, ms);
  };

  const set = (next: boolean) => {
    if (next === online) return;
    online = next;
    onChange(next);
  };

  async function check(): Promise<void> {
    if (disposed || checking) return;
    checking = true;
    let reached = false;
    try {
      reached = await deps.probe();
    } catch {
      reached = false;
    }
    checking = false;
    if (disposed) return;

    if (reached) {
      clear();
      set(true);
      return;
    }
    set(false);
    schedule(OFFLINE_RECHECK_MS);
  }

  return {
    get online() {
      return online;
    },
    start() {
      if (!deps.browserOnline()) schedule(OFFLINE_GRACE_MS);
    },
    suspect() {
      // Already confirming, or already offline and re-checking on a timer.
      if (timer !== null || checking) return;
      schedule(OFFLINE_GRACE_MS);
    },
    recheck() {
      if (online) return;
      clear();
      void check();
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}

/**
 * Ask a server something and report whether any answer came back.
 *
 * HEAD, so the service worker (which only handles GET) never answers from its
 * cache, and `no-store` plus a unique query so no HTTP cache does either. The
 * status is irrelevant: a 404 proves the network works as well as a 200 does.
 */
export async function reachNetwork(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const separator = url.includes('?') ? '&' : '?';
    await fetchImpl(`${url}${separator}connectivity=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
