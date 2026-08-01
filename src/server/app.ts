/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The composition root: the one place where concrete dependencies are chosen.
 *
 * Everything below this file takes its collaborators as arguments -- the store,
 * the model client, the configuration. Nothing reaches for a singleton. That is
 * what makes the whole pipeline testable without a network, a key, or a clock,
 * and it is why `buildApp` accepts overrides rather than reading the
 * environment from inside each module.
 *
 * The result is a plain `(Request) => Promise<Response>`. Adapters are thin by
 * construction: `server.ts` bridges Node's Express server to it for local
 * development, and `api/[...path].ts` hands it Vercel's request directly.
 */

import { config as defaultConfig, type AppConfig } from './config';
import { defaultCounterStore, type CounterStore } from './counters';
import { createModelClient, type ModelClient } from './gemini';
import { createApp, type RouteDefinition } from './pipeline';
import { createChatHandler, createEvaluateHandler, createRecommendHandler } from './routes/ai';
import { problemsHandler, statisticsSeedHandler } from './routes/content';
import { liveStatsEventHandler, liveStatsHandler } from './routes/liveStats';

export interface BuildAppOptions {
  config?: AppConfig;
  store?: CounterStore;
  /**
   * Explicit `null` forces the deterministic engine; omitting it builds a
   * client from configuration. Tests use `null` to assert fallback behaviour
   * and a stub to assert the model path, without ever reaching the network.
   */
  model?: ModelClient | null;
}

export function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? defaultConfig();
  const store = options.store ?? defaultCounterStore;
  const model = options.model !== undefined ? options.model : createModelClient(config, store);

  const routes: RouteDefinition[] = [
    // Paid routes. The `ai` class carries the tighter allowance.
    { method: 'POST', path: '/api/chat', routeClass: 'ai', handler: createChatHandler({ model }) },
    { method: 'POST', path: '/api/evaluate', routeClass: 'ai', handler: createEvaluateHandler({ model }) },
    { method: 'POST', path: '/api/recommend', routeClass: 'ai', handler: createRecommendHandler({ model }) },

    // Local data only.
    { method: 'GET', path: '/api/problems', routeClass: 'read', handler: problemsHandler },
    { method: 'GET', path: '/api/statistics-seed', routeClass: 'read', handler: statisticsSeedHandler },
    { method: 'GET', path: '/api/live-stats', routeClass: 'read', handler: liveStatsHandler },
    { method: 'POST', path: '/api/live-stats/event', routeClass: 'read', handler: liveStatsEventHandler },
  ];

  return createApp({ config, store, routes });
}

export type App = ReturnType<typeof buildApp>;
