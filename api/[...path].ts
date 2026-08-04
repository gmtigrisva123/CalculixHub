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

// Deliberately no static import of `../src/server/app`. See `load()` below:
// the whole point of this revision is that the import must sit inside a
// try/catch, and a top-level one cannot.

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

type ServerApp = (request: Request) => Promise<Response>;

let app: ServerApp | null = null;
let initError: unknown = null;

/**
 * Loaded on first request, not at module scope.
 *
 * The previous revision of this diagnostic wrapped `buildApp()` in a try/catch
 * and production did not change: `/api/*` still answered
 * FUNCTION_INVOCATION_FAILED rather than the 503 that catch produces. Verified
 * against the deployment that contained it — the commit was live, the response
 * was unchanged.
 *
 * That result is the finding. If the catch never ran, the throw happened before
 * any statement in this file did, which means it came from evaluating the module
 * graph rather than from calling anything. A static `import` cannot be guarded;
 * moving it inside the function is what puts the whole chain — resolution,
 * evaluation and construction — inside the try.
 */
async function load(): Promise<void> {
  if (app || initError) return;

  try {
    const mod = await import('../src/server/app');
    app = mod.buildApp();
  } catch (error) {
    initError = error;
    console.error('[CalculixHub] Function init failed', error);
  }
}

export default async function handler(request: Request): Promise<Response> {
  await load();

  if (!app) {
    const error = initError as Error | undefined;

    if (new URL(request.url).searchParams.get('diag') === DIAG_TOKEN) {
      const body = [
        `name:    ${error?.name ?? typeof initError}`,
        `message: ${error?.message ?? String(initError)}`,
        // A module-resolution failure names the specifier it could not find
        // here and nowhere else, so the cause is usually one line in.
        `code:    ${(initError as { code?: string } | undefined)?.code ?? '(none)'}`,
        '',
        (error?.stack ?? '(no stack)').split('\n').slice(0, 14).join('\n'),
      ].join('\n');

      return new Response(body, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    return new Response('Service unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Vercel's edge terminates the connection and rewrites `x-forwarded-for`, so
  // there is no meaningful peer address at this layer -- client identity comes
  // from the forwarding headers, which is exactly what `TRUST_PROXY=true`
  // authorises. Deploying without that flag set is safe but degrades rate
  // limiting to a single shared bucket.
  return app(request);
}
