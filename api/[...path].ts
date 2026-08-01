/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel entry point for every `/api/*` route.
 *
 * A single catch-all rather than one file per route, for two reasons: the
 * routing table already exists in `src/server/app.ts` and should not be
 * duplicated in the filesystem layout, and one function means one warm
 * instance, so the rate-limit and budget counters in process memory are shared
 * across routes instead of fragmenting per endpoint.
 *
 * The module is deliberately tiny. Everything here is Vercel-specific; anything
 * that is not belongs in `src/server/`.
 */

import { buildApp } from '../src/server/app';

/**
 * Node runtime, not Edge.
 *
 * `@google/genai` targets Node, and the Supabase service-role client that
 * arrives with authentication will too. Edge would buy lower cold-start latency
 * on routes whose dominant cost is an upstream model call measured in seconds.
 */
export const config = { runtime: 'nodejs' };

/**
 * Built once per instance, at module scope.
 *
 * Configuration is parsed and the model client constructed on cold start and
 * reused across invocations, so a warm instance does neither again. It also
 * means a misconfigured environment fails the deployment's first request
 * loudly, rather than degrading quietly on every request thereafter.
 */
const app = buildApp();

export default function handler(request: Request): Promise<Response> {
  // Vercel's edge terminates the connection and rewrites `x-forwarded-for`, so
  // there is no meaningful peer address at this layer -- client identity comes
  // from the forwarding headers, which is exactly what `TRUST_PROXY=true`
  // authorises. Deploying without that flag set is safe but degrades rate
  // limiting to a single shared bucket.
  return app(request);
}
