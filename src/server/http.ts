/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Web-standard HTTP primitives shared by every route.
 *
 * Handlers in this directory are plain `(Request) => Promise<Response>`
 * functions built on the Fetch API rather than on Express's `(req, res)`. That
 * choice buys three things:
 *
 * - **Portability.** The same handler runs under Vercel's Node runtime, under
 *   the local Express bridge, and would run unchanged on Workers or Deno. No
 *   framework migration is implied by a future hosting decision.
 * - **Testability.** A test calls `handler(new Request(url, init))` and asserts
 *   on the returned `Response`. No server to start, no socket, no mocking.
 * - **A single response path.** Every exit from a handler is a `Response`
 *   value, so the security wrapper in `pipeline.ts` can decorate all of them --
 *   including error paths -- without a middleware ordering hazard.
 */

/** RFC 9457 problem document. The only error shape this API emits. */
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

/** Machine-readable error identifiers, used as the problem `type` suffix. */
export type ProblemCode =
  | 'invalid-request'
  | 'payload-too-large'
  | 'unsupported-media-type'
  | 'origin-not-allowed'
  | 'rate-limited'
  | 'not-found'
  | 'method-not-allowed'
  | 'internal-error';

const PROBLEM_BASE = 'https://calculixhub.dev/problems/';

/** JSON response with no-store caching, the correct default for an API. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  });
}

/**
 * RFC 9457 error response.
 *
 * `detail` is written for the client and must never carry internal state --
 * no stack traces, no upstream error text, no configuration values. Callers
 * that have diagnostic context log it server-side and pass a generic string
 * here. Volunteering internals to an unauthenticated caller is how an error
 * handler becomes a reconnaissance endpoint.
 */
export function problem(
  status: number,
  code: ProblemCode,
  title: string,
  detail?: string,
  init: ResponseInit = {},
): Response {
  const body: ProblemDocument = { type: `${PROBLEM_BASE}${code}`, title, status, ...(detail ? { detail } : {}) };

  return new Response(JSON.stringify(body), {
    ...init,
    status,
    headers: {
      'content-type': 'application/problem+json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  });
}

/** Outcome of reading a request body, as a value rather than an exception. */
export type BodyResult<T> = { ok: true; value: T } | { ok: false; response: Response };

/**
 * Read and parse a JSON request body under a hard byte ceiling.
 *
 * The declared `Content-Length` is checked first so an oversized upload is
 * refused before it is buffered, and the decoded body is measured again
 * afterwards because that header is client-supplied and may lie. Both checks
 * are required: the first protects memory, the second protects correctness.
 *
 * A missing or non-JSON `Content-Type` is rejected rather than sniffed. Beyond
 * being correct, this keeps the endpoint outside the set of "simple requests"
 * that a browser will issue cross-origin without a preflight, so the origin
 * allowlist in `security.ts` is consulted before any cross-site request with a
 * body can reach a handler.
 *
 * @param request Incoming request.
 * @param maxBytes Ceiling for the encoded body.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult<unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.split(';')[0]?.trim().toLowerCase().endsWith('json')) {
    return {
      ok: false,
      response: problem(415, 'unsupported-media-type', 'Unsupported media type', 'Send application/json.'),
    };
  }

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      response: problem(413, 'payload-too-large', 'Payload too large', `Body must not exceed ${maxBytes} bytes.`),
    };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: problem(400, 'invalid-request', 'Malformed request', 'Body could not be read.') };
  }

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return {
      ok: false,
      response: problem(413, 'payload-too-large', 'Payload too large', `Body must not exceed ${maxBytes} bytes.`),
    };
  }

  try {
    return { ok: true, value: raw.length === 0 ? {} : JSON.parse(raw) };
  } catch {
    return { ok: false, response: problem(400, 'invalid-request', 'Malformed request', 'Body is not valid JSON.') };
  }
}

/**
 * Identify the calling client for rate-limiting purposes.
 *
 * `x-forwarded-for` is trusted only when the deployment declares that a proxy
 * it controls rewrites the header (`TRUST_PROXY`). Believing it unconditionally
 * would let any caller mint a fresh identity per request and walk straight past
 * every per-client limit, which is the most common way rate limiting is
 * defeated in practice.
 *
 * When the header is not trusted, the transport-level peer address supplied by
 * the adapter is used. That value cannot be forged by the client, though it is
 * shared by everyone behind the same NAT.
 *
 * @param request Incoming request.
 * @param options.trustProxy Whether forwarding headers are authoritative here.
 * @param options.peerAddress Transport-level source address, if the adapter knows it.
 * @returns A stable client key, or `'unknown'` when no identity is available.
 */
export function clientKey(
  request: Request,
  options: { trustProxy: boolean; peerAddress?: string },
): string {
  if (options.trustProxy) {
    // Vercel sets this itself and strips any client-supplied copy, so it is the
    // more trustworthy of the two when running there.
    const vercel = request.headers.get('x-vercel-forwarded-for');
    if (vercel) return vercel.split(',')[0]!.trim();

    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]!.trim();
  }

  return options.peerAddress?.trim() || 'unknown';
}
