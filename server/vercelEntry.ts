import { buildApp } from './app';

/**
 * Vercel's Web Handler entry point for the shared API router.
 *
 * A plain default function receives Node's relative-url request object on
 * Vercel. Our router consumes the Web Request API, so use the explicit fetch
 * handler shape instead of treating a Node request as a Web Request.
 */
export const config = { runtime: 'nodejs' };

type ServerApp = (request: Request) => Promise<Response>;

let app: ServerApp | undefined;

function load(): ServerApp {
  app ??= buildApp();
  return app;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await load()(request);
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
