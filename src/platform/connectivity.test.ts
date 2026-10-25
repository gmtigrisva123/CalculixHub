/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConnectivityMonitor,
  OFFLINE_GRACE_MS,
  OFFLINE_RECHECK_MS,
  reachNetwork,
  type ConnectivityDeps,
} from './connectivity';

function setup(options: { reachable: boolean; browserOnline?: boolean }) {
  let reachable = options.reachable;
  const probe = vi.fn(async () => reachable);
  const deps: ConnectivityDeps = {
    probe,
    browserOnline: () => options.browserOnline ?? true,
    setTimer: (callback, ms) => setTimeout(callback, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  const changes: boolean[] = [];
  const monitor = createConnectivityMonitor(deps, (online) => changes.push(online));
  return { monitor, probe, changes, setReachable: (value: boolean) => (reachable = value) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('connectivity monitor', () => {
  it('starts online and does not probe when the browser agrees', async () => {
    const { monitor, probe } = setup({ reachable: false });
    monitor.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(monitor.online).toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it('ignores a browser that wrongly reports offline while the network works', async () => {
    const { monitor, changes } = setup({ reachable: true, browserOnline: false });
    monitor.start();
    monitor.suspect();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(monitor.online).toBe(true);
    expect(changes).toEqual([]);
  });

  it('rides out a blip shorter than the grace period', async () => {
    const { monitor, setReachable, changes } = setup({ reachable: false });
    monitor.suspect();
    await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS - 1000);
    setReachable(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(changes).toEqual([]);
  });

  it('goes offline only after a real request fails', async () => {
    const { monitor, probe } = setup({ reachable: false });
    monitor.suspect();
    await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS - 1);
    expect(monitor.online).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(monitor.online).toBe(false);
  });

  it('comes back by itself even if no online event ever fires', async () => {
    const { monitor, setReachable, changes } = setup({ reachable: false });
    monitor.suspect();
    await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS);
    expect(monitor.online).toBe(false);
    setReachable(true);
    await vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS);
    expect(monitor.online).toBe(true);
    expect(changes).toEqual([false, true]);
  });

  it('rechecks at once on focus or an online event', async () => {
    const { monitor, setReachable } = setup({ reachable: false });
    monitor.suspect();
    await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS);
    setReachable(true);
    monitor.recheck();
    await vi.advanceTimersByTimeAsync(0);
    expect(monitor.online).toBe(true);
  });

  it('stops checking once disposed', async () => {
    const { monitor, probe } = setup({ reachable: false });
    monitor.suspect();
    monitor.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('reachNetwork', () => {
  it('counts any HTTP answer, even an error status, as reachable', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(reachNetwork('/manifest.webmanifest', fetchImpl)).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^\/manifest\.webmanifest\?connectivity=\d+$/);
    expect(init).toMatchObject({ method: 'HEAD', cache: 'no-store' });
  });

  it('reports unreachable when the request cannot be made', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(reachNetwork('/manifest.webmanifest', fetchImpl)).resolves.toBe(false);
  });

  it('gives up on a request that hangs', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const result = reachNetwork('/manifest.webmanifest', fetchImpl as unknown as typeof fetch, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBe(false);
  });
});
