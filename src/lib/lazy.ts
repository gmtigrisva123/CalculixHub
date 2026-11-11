/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Loader<T> = () => Promise<{ default: T }>;

export type Preloadable<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  /** Start fetching the chunk now. Safe to call any number of times. */
  preload: () => Promise<unknown>;
};

/**
 * `React.lazy`, plus a way to ask for the code before it is rendered.
 *
 * A lazy component normally starts downloading at the moment it is first
 * drawn, which is the moment the person is already waiting for it. `preload`
 * moves that earlier: to when the pointer reaches a link, or to a quiet moment
 * after the page has settled. A failed preload is forgotten, so the next
 * attempt (or the render itself) tries the network again.
 */
export function lazyWithPreload<T extends ComponentType<any>>(loader: Loader<T>): Preloadable<T> {
  let pending: Promise<{ default: T }> | null = null;
  const load = () => {
    pending ??= loader().catch((error) => { pending = null; throw error; });
    return pending;
  };
  const Component = lazy(load) as Preloadable<T>;
  Component.preload = () => load().catch(() => undefined);
  return Component;
}

/**
 * Run `task` when the browser has nothing more urgent to do, and no later than
 * `timeout` ms from now. Returns a function that cancels it.
 */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, Math.min(timeout, 300));
  return () => window.clearTimeout(id);
}
