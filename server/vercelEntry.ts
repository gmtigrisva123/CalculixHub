import { buildApp } from './app';

/**
 * Vercel's Web Handler entry point for the shared API router.
 *
 * A plain default function receives Node's relative-url request object on
 * Vercel. Our router consumes the Web Request API, so use the explicit fetch
 * handler shape instead of treating a Node request as a Web Request.
 */
export const config = { runtime: 'nodejs' };

type ServerApp = ReturnType<typeof buildApp>;

let app: ServerApp | undefined;

function load(): ServerApp {
  app ??= buildApp();
  return app;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      // Vercel's edge writes x-vercel-forwarded-for itself and discards any
      // copy the client sent, so it is the transport-level peer address here,
      // as cf-connecting-ip is on Cloudflare. Without it every visitor shared
      // one rate-limit bucket, and a busy minute 429'd everyone's answers.
      const peer = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
      return await load()(request, { peerAddress: peer || undefined });
    } catch (error) {
      // Keep operational details in Vercel logs. Never return a stack,
      // configuration value, or database error to a public API caller.
      console.error('[CalculixHub] API request failed', error);
      return new Response('Service unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
  },
};
