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
/*
 * TEMPORARY DIAGNOSTIC -- remove once the production 500 is identified.
 *
 * Every /api/* route on the deployed site returns FUNCTION_INVOCATION_FAILED,
 * which is Vercel's generic wrapper for "the function threw". The throw happens
 * here, at module scope, and the actual error only exists in the runtime log.
 *
 * The same entry point returns 200 locally under NODE_ENV=production, with the
 * real environment and with each Supabase variable removed in turn, so the
 * cause is specific to how the function is built or run on Vercel rather than
 * to this code or its configuration.
 *
 * Capturing the error instead of letting it escape turns an opaque 500 into a
 * readable one. It is gated behind a token so the detail is never served to the
 * public: without it the response is the same generic 500 as before.
 */
const DIAG_TOKEN = 'c8b41f6e-init-probe';

let app: ReturnType<typeof buildApp> | null = null;
let initError: unknown = null;

try {
  app = buildApp();
} catch (error) {
  initError = error;
  // Still emitted for the runtime log, which remains the proper channel.
  console.error('[CalculixHub] Function init failed', error);
}

export default function handler(request: Request): Promise<Response> {
  if (!app) {
    const wanted = new URL(request.url).searchParams.get('diag') === DIAG_TOKEN;

    if (wanted) {
      const error = initError as Error | undefined;
      const body = [
        `name:    ${error?.name ?? typeof initError}`,
        `message: ${error?.message ?? String(initError)}`,
        '',
        (error?.stack ?? '').split('\n').slice(0, 12).join('\n'),
      ].join('\n');

      return Promise.resolve(
        new Response(body, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }),
      );
    }

    return Promise.resolve(
      new Response('Service unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    );
  }

  // Vercel's edge terminates the connection and rewrites `x-forwarded-for`, so
  // there is no meaningful peer address at this layer -- client identity comes
  // from the forwarding headers, which is exactly what `TRUST_PROXY=true`
  // authorises. Deploying without that flag set is safe but degrades rate
  // limiting to a single shared bucket.
  return app(request);
}
