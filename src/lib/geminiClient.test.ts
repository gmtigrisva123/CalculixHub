import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateWithKey, normalizeGeminiKey } from './geminiClient';

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => vi.unstubAllGlobals());

describe('geminiClient', () => {
  it('cleans pasted keys', () => {
    expect(normalizeGeminiKey('  "AIzaABC 123"\n')).toBe('AIzaABC123');
    expect(normalizeGeminiKey('GEMINI_API_KEY=AIzaXYZ')).toBe('AIzaXYZ');
  });

  it('falls through retired models and sends the key only to Google', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true);
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaKEY');
      if (url.includes('gemini-flash-latest')) return json(404, { error: { code: 404, message: 'models/x is not found', status: 'NOT_FOUND' } });
      return json(200, { candidates: [{ content: { parts: [{ text: 'Hi' }] } }] });
    });
    const out = await generateWithKey('AIzaKEY', [{ role: 'user', text: 'hello' }]);
    expect(out).toEqual({ text: 'Hi', model: 'gemini-2.5-flash' });
    expect(calls).toHaveLength(2);
  });

  it('stops immediately on an invalid key with an actionable message', async () => {
    const fetchMock = vi.fn(() =>
      json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateWithKey('bad', [{ role: 'user', text: 'x' }])).rejects.toThrow(/invalid or expired/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
