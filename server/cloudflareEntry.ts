import { buildApp } from './app';
import { securityHeaders } from './security';

/**
 * Cloudflare Workers entry point for the shared API router.
 *
 * Workers static assets answer every request that matches a file in `dist/`,
 * with the headers `scripts/build-cloudflare.mjs` writes to `dist/_headers`, so
 * this script never sees them. It handles `/api/*`, which `wrangler.jsonc`
 * routes here first, and every path that matched no file.
 */

interface Env {
  /** The static assets binding declared in `wrangler.jsonc`. */
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type ServerApp = ReturnType<typeof buildApp>;

let app: ServerApp | undefined;

/**
 * Paths answered with the application document: the same rewrite `vercel.json`
 * declares.
 *
 * Build output, icons, the manifest and the service worker are left out on
 * purpose. A missing hashed bundle must stay a 404: served as `index.html` with
 * a 200, `public/sw.js` would cache the HTML under the bundle's URL and keep
 * serving it after the next deploy.
 */
const SPA_ROUTE = /^\/(?!api\/|assets\/|icons\/|_vercel\/|manifest\.webmanifest|sw\.js|favicon\.ico)/;

/**
 * `_headers` rules are not applied to responses a Worker returns, so the
 * document and the 404 carry the same policy here explicitly. A deployed Worker
 * is always production, which is also what `dist/_headers` is generated for.
 */
const DOCUMENT_HEADERS = securityHeaders('document', { isProduction: true });

function withDocumentHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(DOCUMENT_HEADERS)) headers.set(key, value);

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleApi(request: Request): Promise<Response> {
  try {
    app ??= buildApp();
    // Cloudflare sets cf-connecting-ip itself and overwrites any copy the
    // client sent, so it is the transport-level peer address on this platform.
    return await app(request, { peerAddress: request.headers.get('cf-connecting-ip') ?? undefined });
  } catch (error) {
    // Keep operational details in Workers logs. Never return a stack,
    // configuration value, or database error to a public API caller.
    console.error('[CalculixHub] API request failed', error);
    return new Response('Service unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) return handleApi(request);

    if (!SPA_ROUTE.test(pathname)) {
      return withDocumentHeaders(new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }));
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withDocumentHeaders(new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } }));
    }

    // "/" rather than "/index.html": asset serving redirects the latter to the
    // former. The request headers travel along so conditional requests still
    // get a 304.
    const document = await env.ASSETS.fetch(
      new Request(new URL('/', request.url), { method: request.method, headers: request.headers }),
    );
    return withDocumentHeaders(document);
  },
};
