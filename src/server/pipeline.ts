/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The request pipeline: one ordered path that every API request takes.
 *
 * Ordering is a security property here, not a style choice. Controls run
 * cheapest-and-most-decisive first, so an abusive request is rejected before it
 * costs anything:
 *
 *   1. Preflight        - answered without touching a handler
 *   2. Origin           - a disallowed origin never reaches routing
 *   3. Routing          - unknown path or method resolved before any limit is spent
 *   4. Rate limit       - per client, per cost class
 *   5. Handler          - the only stage permitted to be expensive
 *   6. Decoration       - security headers applied to every outcome, including errors
 *
 * Stage 6 is why handlers return `Response` values rather than writing to a
 * socket: a single wrapper decorates success, validation failure and unhandled
 * exception alike. There is no path out of this function that skips it, which
 * is the failure mode of ordinary middleware chains -- an early `return
 * res.status(400)` that quietly bypasses the hardening registered after it.
 */

import type { AppConfig } from './config';
import type { CounterStore } from './counters';
import { clientKey as deriveClientKey, problem } from './http';
import { checkRateLimit, type RouteClass } from './rateLimit';
import {
  corsHeaders,
  evaluateOrigin,
  originDeniedResponse,
  securityHeaders,
  withHeaders,
} from './security';

/** Everything a handler is allowed to depend on. Dependencies are injected. */
export interface RouteContext {
  request: Request;
  config: AppConfig;
  store: CounterStore;
  /** Stable caller identifier, already resolved against the proxy trust policy. */
  clientKey: string;
}

export type Handler = (context: RouteContext) => Response | Promise<Response>;

export interface RouteDefinition {
  method: 'GET' | 'POST';
  /** Exact pathname, e.g. `/api/chat`. */
  path: string;
  /** Cost class, selecting which rate-limit policy applies. */
  routeClass: RouteClass;
  handler: Handler;
}

/** Per-request facts the adapter knows and the Fetch API does not carry. */
export interface AdapterContext {
  /** Transport-level peer address, used when forwarding headers are untrusted. */
  peerAddress?: string;
}

export interface AppDependencies {
  config: AppConfig;
  store: CounterStore;
  routes: readonly RouteDefinition[];
}

/**
 * Build the API request handler.
 *
 * Returns a plain `(Request) => Promise<Response>` function, which is what every
 * adapter in this codebase consumes: the Express bridge for local development,
 * and the Vercel function in production.
 */
export function createApp({ config, store, routes }: AppDependencies) {
  const byPath = new Map<string, RouteDefinition[]>();
  for (const route of routes) {
    const existing = byPath.get(route.path);
    if (existing) existing.push(route);
    else byPath.set(route.path, [route]);
  }

  return async function handleRequest(
    request: Request,
    adapter: AdapterContext = {},
  ): Promise<Response> {
    const origin = evaluateOrigin(request, config);
    const baseHeaders = securityHeaders('api', { isProduction: config.isProduction });
    const cors = origin.kind === 'allowed' ? corsHeaders(origin.origin) : {};
    const decorate = (response: Response) => withHeaders(response, { ...baseHeaders, ...cors });

    if (origin.kind === 'denied') {
      // Logged because a denial is either a misconfigured deployment or an
      // attempt worth seeing. The origin is attacker-controlled, so it is
      // reported as a discrete field rather than interpolated into prose.
      console.warn('[CalculixHub] Rejected cross-origin request', { origin: origin.origin });
      return decorate(originDeniedResponse());
    }

    const url = new URL(request.url);
    const candidates = byPath.get(url.pathname);

    // Preflight is answered here rather than in a route so that adding a route
    // can never accidentally omit OPTIONS support. A preflight for an unknown
    // path still gets a 404, so this does not become a path oracle.
    if (request.method === 'OPTIONS') {
      if (!candidates) return decorate(notFound());
      return decorate(new Response(null, { status: 204 }));
    }

    if (!candidates) return decorate(notFound());

    const route = candidates.find((candidate) => candidate.method === request.method);
    if (!route) {
      const allowed = [...new Set(candidates.map((c) => c.method)), 'OPTIONS'].join(', ');
      return decorate(
        problem(405, 'method-not-allowed', 'Method not allowed', undefined, { headers: { allow: allowed } }),
      );
    }

    const key = deriveClientKey(request, { trustProxy: config.trustProxy, peerAddress: adapter.peerAddress });
    const limit = await checkRateLimit(store, key, route.routeClass, config.rateLimit[route.routeClass]);

    if (!limit.allowed) {
      return withHeaders(
        problem(429, 'rate-limited', 'Too many requests', 'Slow down and retry shortly.'),
        { ...baseHeaders, ...cors, ...limit.headers },
      );
    }

    try {
      const response = await route.handler({ request, config, store, clientKey: key });
      return withHeaders(response, { ...baseHeaders, ...cors, ...limit.headers });
    } catch (error) {
      // The backstop. Validation should mean no handler ever throws, but a
      // handler that does must still produce a response: an unhandled rejection
      // under Node's default policy terminates the process, turning one
      // malformed request into an outage. The cause is logged in full and
      // reported to the caller as nothing at all.
      console.error('[CalculixHub] Unhandled error in route handler', {
        method: request.method,
        path: url.pathname,
        error,
      });

      return withHeaders(
        problem(500, 'internal-error', 'Internal server error', 'The request could not be completed.'),
        { ...baseHeaders, ...cors },
      );
    }
  };
}

function notFound(): Response {
  return problem(404, 'not-found', 'Not found', 'No such API route.');
}
