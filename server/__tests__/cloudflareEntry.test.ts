import { describe, expect, it } from 'vitest';
import worker from '../cloudflareEntry';
import { securityHeaders } from '../security';

const DOCUMENT_CSP = securityHeaders('document', { isProduction: true })['content-security-policy'];

/** A stand-in for the static assets binding that records what it was asked for. */
function assets() {
  const requested: string[] = [];
  return {
    requested,
    env: {
      ASSETS: {
        async fetch(request: Request) {
          requested.push(new URL(request.url).pathname);
          return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
        },
      },
    },
  };
}

describe('Cloudflare entry point', () => {
  it('answers an app route with index.html under the document policy', async () => {
    const { env, requested } = assets();
    const response = await worker.fetch(new Request('https://calculixhub.example/practice/alg-f01'), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<!doctype html>');
    expect(requested).toEqual(['/']);
    expect(response.headers.get('content-security-policy')).toBe(DOCUMENT_CSP);
  });

  it('keeps a missing bundle a 404, so the service worker never caches HTML as script', async () => {
    for (const path of ['/assets/index-gone.js', '/icons/gone.png', '/_vercel/insights/script.js', '/sw.js.map']) {
      const { env, requested } = assets();
      const response = await worker.fetch(new Request(`https://calculixhub.example${path}`), env);

      expect(response.status, path).toBe(404);
      expect(requested, path).toEqual([]);
    }
  });

  it('refuses to answer a non-read request with the document', async () => {
    const { env, requested } = assets();
    const response = await worker.fetch(new Request('https://calculixhub.example/practice', { method: 'POST' }), env);

    expect(response.status).toBe(405);
    expect(requested).toEqual([]);
  });

  it('routes /api/ to the API router', async () => {
    const { env, requested } = assets();
    const response = await worker.fetch(new Request('https://calculixhub.example/api/no-such-route'), env);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(requested).toEqual([]);
  });
});
