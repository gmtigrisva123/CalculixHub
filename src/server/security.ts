/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Transport-level security decisions: response hardening headers and the
 * cross-origin access policy.
 *
 * These are implemented directly rather than via `helmet`, for two reasons.
 * Helmet is Express middleware and cannot decorate the Web-standard `Response`
 * objects this API returns, so adopting it would force the whole handler layer
 * back into a Node-only shape. And a header policy is roughly thirty lines of
 * declarative data that every reviewer should be able to read in full -- a
 * dependency here would hide the policy rather than explain it.
 */

import type { AppConfig } from './config';
import { problem } from './http';

/**
 * Content-Security-Policy for API responses.
 *
 * A JSON document has no legitimate reason to load a script, a style or an
 * image, so everything is denied. This matters because a browser navigated
 * directly to an API URL renders the response, and `default-src 'none'` plus
 * `X-Content-Type-Options: nosniff` removes the entire class of attacks that
 * depend on a JSON body being interpreted as markup.
 */
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * Content-Security-Policy for the application document.
 *
 * Notable decisions:
 *
 * - `script-src 'self'` with no `'unsafe-inline'`. This is the directive that
 *   actually stops cross-site scripting, so it is kept absolute. It holds only
 *   because `vite.config.ts` disables the module-preload polyfill, which would
 *   otherwise emit an inline bootstrap script into `index.html`.
 * - `style-src` does permit `'unsafe-inline'`, unavoidably: KaTeX emits inline
 *   `style` attributes in the markup it generates, and that markup is inserted
 *   as HTML by `MathText`. The residual risk is CSS-based exfiltration, which
 *   `img-src` and `connect-src` bound to `'self'` already contain.
 * - `connect-src 'self'` keeps a compromised bundle from beaconing learner data
 *   to an arbitrary host.
 * - `frame-ancestors 'none'` prevents clickjacking, superseding the legacy
 *   `X-Frame-Options` header for browsers that support it.
 */
const DOCUMENT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * Headers applied to every response, hardening the browser's handling of it.
 *
 * `Strict-Transport-Security` is emitted only in production: sending it from a
 * development server would pin `localhost` to HTTPS in the developer's browser
 * for two years, breaking every other local project on that host.
 */
export function securityHeaders(
  kind: 'api' | 'document',
  options: { isProduction: boolean },
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-security-policy': kind === 'api' ? API_CSP : DOCUMENT_CSP,
    // Stops MIME sniffing, without which a browser may execute a JSON or text
    // response as script if it looks close enough.
    'x-content-type-options': 'nosniff',
    // Legacy clickjacking defence for browsers predating frame-ancestors.
    'x-frame-options': 'DENY',
    // Never leak the full URL -- which can carry problem identifiers and
    // navigation state -- to third-party hosts.
    'referrer-policy': 'strict-origin-when-cross-origin',
    // Powerful capabilities this application never uses. Denying them here
    // means a future dependency cannot quietly start asking for them.
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    // Isolate the browsing context from cross-origin windows and popups.
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };

  if (options.isProduction) {
    headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

/** The outcome of evaluating a request's `Origin` against the allowlist. */
export type OriginDecision =
  | { kind: 'no-origin' }
  | { kind: 'allowed'; origin: string }
  | { kind: 'denied'; origin: string };

/**
 * Evaluate the `Origin` header against the configured allowlist.
 *
 * A request with no `Origin` is *not* denied. Non-browser clients omit the
 * header entirely, and rejecting them would break the iOS shell and every
 * health check while stopping no attack -- `curl` can send any origin it likes,
 * so an origin check is a same-origin-policy control, not an authentication
 * one. Unattributed traffic is instead bounded by the rate limiter and the AI
 * budget, which are the controls that actually apply to it.
 *
 * A request that *does* present a disallowed origin is refused outright rather
 * than merely having the CORS response header withheld. Withholding is enough
 * to make a browser discard the response, but the handler would still have
 * run -- and for the AI routes, running the handler is the expensive part.
 */
export function evaluateOrigin(request: Request, config: AppConfig): OriginDecision {
  const origin = request.headers.get('origin');
  if (!origin) return { kind: 'no-origin' };
  if (config.allowedOrigins.includes(origin)) return { kind: 'allowed', origin };
  return { kind: 'denied', origin };
}

/**
 * CORS headers for an allowed origin.
 *
 * The allowed origin is echoed rather than wildcarded so that credentialed
 * requests remain possible when Supabase-backed sessions arrive, and `Vary:
 * Origin` is set so a shared cache never serves one origin's CORS decision to
 * another.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

/** Response to a rejected cross-origin request. */
export function originDeniedResponse(): Response {
  return problem(403, 'origin-not-allowed', 'Origin not allowed', 'This origin may not call the CalculixHub API.');
}

/**
 * Copy headers onto a response without discarding what the handler already set.
 *
 * A new `Response` is returned instead of mutating the original because the
 * `headers` of a constructed `Response` are immutable in some runtimes.
 * Handler-set headers win, so a route can still override a default.
 */
export function withHeaders(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(headers);
  response.headers.forEach((value, key) => merged.set(key, value));

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}
