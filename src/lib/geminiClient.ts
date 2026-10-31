/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser-side Gemini client for a learner's own ("bring your own") API key.
 *
 * Why this exists: the key used to be sent straight to hardcoded model ids
 * (`gemini-2.0-flash`, `gemini-1.5-flash`). Google retires model ids on a
 * schedule, and once both were shut down every request with a perfectly valid
 * key came back 404 and the tutor quietly fell back to canned replies. So:
 *
 * - The model is never assumed. A preferred list is tried in order, and if all
 *   of them are gone the key's own `models.list` is asked which text models it
 *   can actually call; the first one that answers is remembered.
 * - Google's error responses are translated into an actionable sentence
 *   (invalid key, API not enabled, quota, unsupported region, network/CSP).
 *
 * The key is only ever sent to generativelanguage.googleapis.com, never to our
 * own server.
 */

export const GEMINI_KEY_STORAGE = 'calculix_gemini_api_key';
const MODEL_CACHE_STORAGE = 'calculix_gemini_model';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/** Tried in order. `*-latest` aliases follow Google's current GA model. */
const PREFERRED_MODELS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest',
  'gemini-2.5-pro',
];

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export class GeminiKeyError extends Error {
  constructor(
    message: string,
    /** True when retrying with another model cannot help. */
    readonly fatal: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiKeyError';
  }
}

/** Strips whitespace, quotes and an accidental `key=` prefix from a pasted key. */
export function normalizeGeminiKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(GEMINI_API_KEY|GOOGLE_API_KEY|key)\s*[=:]\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
}

export function readStoredGeminiKey(): string {
  try {
    return normalizeGeminiKey(localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  } catch {
    return '';
  }
}

export function storeGeminiKey(key: string): void {
  try {
    const clean = normalizeGeminiKey(key);
    if (clean) localStorage.setItem(GEMINI_KEY_STORAGE, clean);
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
    localStorage.removeItem(MODEL_CACHE_STORAGE);
  } catch {
    /* storage unavailable: the key just won't persist */
  }
}

function readCachedModel(): string | null {
  try {
    return localStorage.getItem(MODEL_CACHE_STORAGE);
  } catch {
    return null;
  }
}

function cacheModel(model: string | null): void {
  try {
    if (model) localStorage.setItem(MODEL_CACHE_STORAGE, model);
    else localStorage.removeItem(MODEL_CACHE_STORAGE);
  } catch {
    /* ignore */
  }
}

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{ reason?: string }>;
  };
}

/** Turns a Google error response into a sentence the learner can act on. */
function describeError(status: number, body: GoogleErrorBody): GeminiKeyError {
  const err = body.error ?? {};
  const raw = err.message ?? `HTTP ${status}`;
  const reasons = (err.details ?? []).map((d) => d.reason ?? '').join(' ');
  const text = `${raw} ${reasons} ${err.status ?? ''}`;

  if (/API_KEY_INVALID|API key not valid|API_KEY_EXPIRED|expired/i.test(text)) {
    return new GeminiKeyError(
      'The API key is invalid or expired. Create a new key at https://aistudio.google.com/apikey and paste it again (it normally starts with "AIza").',
      true,
      status,
    );
  }
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(text)) {
    return new GeminiKeyError(
      'The "Generative Language API" is not enabled for this key\'s Google Cloud project. Enable it, or create the key from https://aistudio.google.com/apikey instead.',
      true,
      status,
    );
  }
  if (/API_KEY_HTTP_REFERRER_BLOCKED|referer|referrer|API_KEY_.*BLOCKED|are blocked/i.test(text)) {
    return new GeminiKeyError(
      `This key has application/API restrictions that block this website (${typeof location !== 'undefined' ? location.origin : 'this site'}). In Google Cloud Console → Credentials, allow this site or remove the restriction.`,
      true,
      status,
    );
  }
  if (/location is not supported|FAILED_PRECONDITION/i.test(text)) {
    return new GeminiKeyError(
      'Google does not offer the Gemini API free tier in your region. Enable billing on the key\'s project or use a supported region.',
      true,
      status,
    );
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) {
    // Quota can be per model, so another model may still work.
    return new GeminiKeyError(
      'The key has run out of quota (rate limit or daily limit). Wait a minute and try again, or check usage at https://aistudio.google.com.',
      false,
      status,
    );
  }
  if (status === 404 || /NOT_FOUND|is not found|not supported for generateContent/i.test(text)) {
    return new GeminiKeyError(`Model unavailable: ${raw}`, false, status);
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(text)) {
    return new GeminiKeyError(`Google refused the key: ${raw}`, true, status);
  }
  if (status >= 500) {
    return new GeminiKeyError(`Gemini is temporarily unavailable (${raw}). Please try again shortly.`, false, status);
  }
  return new GeminiKeyError(raw, status === 400 || status === 401, status);
}

async function postJson(url: string, key: string, body: unknown, signal?: AbortSignal) {
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new GeminiKeyError(
      'Could not reach generativelanguage.googleapis.com. Check your internet connection, VPN or ad-blocker.',
      true,
    );
  }
  const data = (await resp.json().catch(() => ({}))) as GoogleErrorBody & {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  return { resp, data };
}

/** Asks the key which models it may call with generateContent. */
async function discoverModels(key: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const resp = await fetch(`${API_ROOT}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': key },
      signal,
    });
    const data = (await resp.json().catch(() => ({}))) as GoogleErrorBody & {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    if (!resp.ok) throw describeError(resp.status, data);
    const names = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((n) => /^gemini/i.test(n) && !/(embedding|image|tts|audio|live|vision|aqa|computer)/i.test(n));
    const score = (n: string) =>
      (/flash/.test(n) ? 0 : 10) + (/lite/.test(n) ? 1 : 0) + (/preview|exp/.test(n) ? 5 : 0);
    return names.sort((a, b) => score(a) - score(b));
  } catch (e) {
    if (e instanceof GeminiKeyError && e.fatal) throw e;
    return [];
  }
}

export interface GenerateOptions {
  systemInstruction?: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

/**
 * Sends a conversation to Gemini with the learner's key and returns the reply.
 * Throws {@link GeminiKeyError} with a human-readable message on failure.
 */
export async function generateWithKey(
  rawKey: string,
  turns: GeminiTurn[],
  opts: GenerateOptions = {},
): Promise<{ text: string; model: string }> {
  const key = normalizeGeminiKey(rawKey);
  if (!key) throw new GeminiKeyError('No Gemini API key has been entered.', true);

  // Gemini requires the conversation to start with a user turn and alternate.
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const t of turns) {
    if (!t.text.trim()) continue;
    if (contents.length === 0 && t.role !== 'user') continue;
    const last = contents[contents.length - 1];
    if (last && last.role === t.role) last.parts[0].text += `\n\n${t.text}`;
    else contents.push({ role: t.role, parts: [{ text: t.text }] });
  }
  if (contents.length === 0) throw new GeminiKeyError('Nothing to send.', true);

  const body = {
    ...(opts.systemInstruction ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } } : {}),
    contents,
    generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 8192, temperature: 0.7 },
  };

  const tried = new Set<string>();
  let lastError: GeminiKeyError | null = null;

  const attempt = async (model: string): Promise<{ text: string; model: string } | null> => {
    if (tried.has(model)) return null;
    tried.add(model);
    const { resp, data } = await postJson(`${API_ROOT}/models/${model}:generateContent`, key, body, opts.signal);
    if (!resp.ok) {
      const err = describeError(resp.status, data);
      if (err.fatal) throw err;
      lastError = err;
      if (readCachedModel() === model) cacheModel(null);
      return null;
    }
    if (data.promptFeedback?.blockReason) {
      throw new GeminiKeyError(`Gemini blocked this request (${data.promptFeedback.blockReason}). Try rephrasing.`, true);
    }
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      lastError = new GeminiKeyError(`Gemini returned an empty reply${reason ? ` (${reason})` : ''}.`, false);
      return null;
    }
    cacheModel(model);
    return { text, model };
  };

  const cached = readCachedModel();
  for (const model of [...(cached ? [cached] : []), ...PREFERRED_MODELS]) {
    const ok = await attempt(model);
    if (ok) return ok;
  }
  for (const model of (await discoverModels(key, opts.signal)).slice(0, 6)) {
    const ok = await attempt(model);
    if (ok) return ok;
  }
  throw lastError ?? new GeminiKeyError('No Gemini model accepted this key.', true);
}

/** Cheap end-to-end check used by the Settings "Test" button. */
export async function testGeminiKey(rawKey: string): Promise<{ model: string }> {
  const { model } = await generateWithKey(rawKey, [{ role: 'user', text: 'Reply with the single word: OK' }], {
    maxOutputTokens: 1024,
  });
  return { model };
}
