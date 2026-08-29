/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Behavioural tests for the request pipeline.
 *
 * These assert the security controls actually hold, rather than that the code
 * that implements them exists. Every test drives the real handler through a
 * real `Request` and inspects the real `Response`; nothing is mocked except the
 * model client, which is the only collaborator that would otherwise cost money.
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig, type AppConfig } from '../config';
import { MemoryCounterStore } from '../counters';
import type { ModelClient } from '../gemini';
import { resetLiveStatsForTests } from '../routes/liveStats';

const ORIGIN = 'https://calculixhub.example';

function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: ORIGIN,
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** An app with a fresh counter store and no model, unless one is supplied. */
function makeApp(options: { config?: AppConfig; model?: ModelClient | null } = {}) {
  resetLiveStatsForTests();
  return buildApp({
    config: options.config ?? testConfig(),
    store: new MemoryCounterStore(),
    model: options.model ?? null,
  });
}

/**
 * Headers are merged last, deliberately. Spreading `init` over an already-built
 * header object silently replaces the whole set rather than merging it, which
 * drops `content-type` and turns every test that overrides one header into an
 * assertion about 415s.
 */
function post(path: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...(init.headers as Record<string, string>) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function get(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { origin: ORIGIN, ...(init.headers as Record<string, string>) },
  });
}

describe('the crash this pipeline was built to fix', () => {
  it('answers POST /api/chat with an empty body instead of throwing', async () => {
    const app = makeApp();

    // Before validation existed this reached `message.toLowerCase()`, rejected
    // asynchronously past Express's reach, and terminated the process. The
    // assertion that matters is simply that a Response comes back at all.
    const response = await app(post('/api/chat', {}));

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({ status: 400, title: 'Invalid request' });
  });

  it.each([
    ['null message', { message: null }],
    ['numeric message', { message: 42 }],
    ['array message', { message: ['a'] }],
    ['object message', { message: { toLowerCase: 'nope' } }],
    ['empty string', { message: '   ' }],
    ['history of the wrong shape', { message: 'hi', history: [{ role: 'admin', content: 'x' }] }],
  ])('rejects %s with 400 and stays alive', async (_label, body) => {
    const app = makeApp();
    const response = await app(post('/api/chat', body));
    expect(response.status).toBe(400);
  });

  it('surfaces an unexpected handler throw as 500 rather than an unhandled rejection', async () => {
    const exploding: ModelClient = {
      generate: () => {
        throw new Error('upstream exploded in an unexpected way');
      },
    };
    const app = makeApp({ model: exploding });

    const response = await app(post('/api/chat', { message: 'hello' }));

    expect(response.status).toBe(500);
    // The caller learns nothing about the failure beyond that it happened.
    await expect(response.json()).resolves.toEqual({
      type: expect.stringContaining('internal-error'),
      title: 'Internal server error',
      status: 500,
      detail: 'The request could not be completed.',
    });
  });
});

describe('origin policy', () => {
  it('allows a configured origin and echoes it', async () => {
    const response = await makeApp()(get('/api/problems'));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('refuses an unlisted origin before the handler runs', async () => {
    const response = await makeApp()(
      get('/api/problems', { headers: { origin: 'https://evil.example' } }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows the Capacitor origin without configuration, so the iOS app works', async () => {
    const response = await makeApp()(get('/api/problems', { headers: { origin: 'capacitor://localhost' } }));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
  });

  it('serves a request with no Origin header, as non-browser clients send', async () => {
    const response = await makeApp()(new Request('http://localhost/api/problems'));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight for a known route and 404s for an unknown one', async () => {
    const app = makeApp();

    const known = await app(new Request('http://localhost/api/chat', { method: 'OPTIONS', headers: { origin: ORIGIN } }));
    expect(known.status).toBe(204);
    expect(known.headers.get('access-control-allow-methods')).toContain('POST');

    const unknown = await app(new Request('http://localhost/api/nope', { method: 'OPTIONS', headers: { origin: ORIGIN } }));
    expect(unknown.status).toBe(404);
  });
});

describe('security headers', () => {
  it.each([
    ['a success', () => get('/api/problems'), 200],
    ['a validation failure', () => post('/api/chat', {}), 400],
    ['a missing route', () => get('/api/nope'), 404],
    ['a rejected origin', () => get('/api/problems', { headers: { origin: 'https://evil.example' } }), 403],
  ])('are present on %s', async (_label, makeRequest, status) => {
    const response = await makeApp()(makeRequest());

    expect(response.status).toBe(status);
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=63072000');
  });

  it('omits HSTS outside production, so localhost is not pinned to HTTPS', async () => {
    const app = makeApp({ config: testConfig({ NODE_ENV: 'development', ALLOWED_ORIGINS: ORIGIN }) });
    const response = await app(get('/api/problems'));

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('routing', () => {
  it('rejects a wrong method with 405 and an Allow header', async () => {
    const response = await makeApp()(get('/api/chat'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('POST');
  });

  it('rejects a non-JSON content type rather than sniffing the body', async () => {
    const response = await makeApp()(
      post('/api/chat', '{"message":"hi"}', { headers: { 'content-type': 'text/plain' } }),
    );

    expect(response.status).toBe(415);
  });

  it('rejects a body over the configured ceiling', async () => {
    const app = makeApp({ config: testConfig({ MAX_BODY_BYTES: '1024' }) });
    const response = await app(post('/api/chat', { message: 'x'.repeat(4_000) }));

    expect(response.status).toBe(413);
  });
});

describe('rate limiting', () => {
  it('refuses AI requests past the allowance with 429 and Retry-After', async () => {
    const app = makeApp({ config: testConfig({ RATE_LIMIT_AI_MAX: '3', RATE_LIMIT_AI_WINDOW_S: '60' }) });

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await app(post('/api/chat', { message: 'hello' }))).status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);

    const refused = await app(post('/api/chat', { message: 'hello' }));
    expect(refused.headers.get('retry-after')).toBeTruthy();
    expect(refused.headers.get('ratelimit-remaining')).toBe('0');
  });

  it('keeps cheap reads working when the AI allowance is spent', async () => {
    const app = makeApp({ config: testConfig({ RATE_LIMIT_AI_MAX: '1' }) });

    await app(post('/api/chat', { message: 'one' }));
    expect((await app(post('/api/chat', { message: 'two' }))).status).toBe(429);

    // Separate counter namespaces: exhausting the paid routes must not lock a
    // learner out of loading the item bank.
    expect((await app(get('/api/problems'))).status).toBe(200);
  });

  it('does not let a forged x-forwarded-for mint a fresh allowance', async () => {
    // TRUST_PROXY defaults to false, so the header is ignored and every one of
    // these requests shares the single 'unknown' bucket.
    const app = makeApp({ config: testConfig({ RATE_LIMIT_AI_MAX: '2' }) });

    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push(
        (await app(post('/api/chat', { message: 'hi' }, { headers: { 'x-forwarded-for': `10.0.0.${i}` } }))).status,
      );
    }

    expect(statuses).toEqual([200, 200, 429, 429]);
  });
});
