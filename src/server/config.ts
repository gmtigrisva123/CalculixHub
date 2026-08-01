/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Environment configuration, parsed and validated once at boot.
 *
 * Every security control in this directory reads its limits from here rather
 * than hardcoding them, so the whole posture of a deployment is described by
 * one object that can be printed, diffed and tested.
 *
 * Two rules govern this file:
 *
 * 1. **Fail fast, not silently.** A malformed limit must stop the process at
 *    boot, not degrade a control to "off" under load. A rate limiter that
 *    silently became `Infinity` because someone typo'd an env var is worse than
 *    no rate limiter, because it is believed.
 *
 * 2. **Secure by default.** Every default is the safe value. Loosening a limit
 *    requires a deliberate, visible act of configuration.
 */

import { z } from 'zod';

/** Origins the native shells present. Capacitor serves the bundle from these. */
const NATIVE_ORIGINS = ['capacitor://localhost', 'ionic://localhost'] as const;

/** Origins allowed automatically outside production, for local development. */
const DEV_ORIGINS = [
  'http://localhost:8000',
  'http://localhost:5173',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:5173',
] as const;

/**
 * Coerce a decimal env string to a bounded integer.
 *
 * `z.coerce.number()` is deliberately not used: it accepts `""`, `"0x10"` and
 * `" 12 "` via JavaScript's numeric coercion, none of which a reader would
 * expect a limit to accept.
 */
const intInRange = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    // Zod 4 `.default()` supplies the *output* value and short-circuits parsing,
    // so the fallback is the number itself rather than its string form.
    .default(fallback);

const boolFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .default(fallback);

/**
 * Comma-separated absolute origins, e.g. "https://a.com,https://b.com".
 *
 * Each entry is parsed as a URL and reduced to its origin, so a trailing slash
 * or a stray path in configuration cannot produce an allowlist entry that never
 * matches the `Origin` header (which is always bare).
 */
const originList = z
  .string()
  .default('')
  .transform((raw, ctx) => {
    const entries = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return entries.map((entry) => {
      let parsed: URL;
      try {
        parsed = new URL(entry);
      } catch {
        ctx.addIssue({ code: 'custom', message: `"${entry}" is not an absolute URL` });
        return entry;
      }
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        ctx.addIssue({ code: 'custom', message: `"${entry}" must use https outside localhost` });
      }
      return parsed.origin;
    });
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Absent or placeholder means the deterministic fallback engine serves every
   * AI route. That is a supported, tested mode, not an error -- the app is
   * fully usable without a key, and GitHub Pages runs exactly this way.
   */
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (!v || v === 'MY_GEMINI_API_KEY' ? undefined : v)),

  /** Browser origins permitted to call the API. Required in production. */
  ALLOWED_ORIGINS: originList,

  /**
   * Whether `x-forwarded-for` may be believed.
   *
   * This is the single most abusable input in the request pipeline. If the
   * process is reachable directly, a client sets a fresh forwarded IP per
   * request and every per-client limit becomes decorative. It is therefore off
   * by default and must be turned on only when a trusted proxy (Vercel's edge)
   * is known to overwrite the header.
   */
  TRUST_PROXY: boolFlag(false),

  /** Per-client request allowance for AI routes, which cost money per call. */
  RATE_LIMIT_AI_MAX: intInRange(1, 10_000, 20),
  RATE_LIMIT_AI_WINDOW_S: intInRange(1, 86_400, 60),

  /** Per-client allowance for cheap read routes. */
  RATE_LIMIT_READ_MAX: intInRange(1, 100_000, 120),
  RATE_LIMIT_READ_WINDOW_S: intInRange(1, 86_400, 60),

  /**
   * Hard ceiling on upstream model calls per rolling day, across all clients.
   *
   * Per-client limits bound how fast one attacker spends the key; only a global
   * ceiling bounds the total. Past it the deterministic fallback serves every
   * request, so exhaustion degrades quality rather than availability.
   */
  AI_DAILY_CALL_BUDGET: intInRange(0, 1_000_000, 1_000),

  /** Largest accepted request body. Bounds memory and upstream prompt size. */
  MAX_BODY_BYTES: intInRange(1_024, 1_048_576, 16_384),

  /** Largest accepted free-text field, in characters. Bounds prompt cost. */
  MAX_TEXT_CHARS: intInRange(16, 100_000, 4_000),

  /** Upstream response cap. Bounds the cost and latency of one model call. */
  AI_MAX_OUTPUT_TOKENS: intInRange(64, 8_192, 1_024),

  /**
   * Model identifier.
   *
   * Configurable because the previous hardcoded value, `gemini-3.5-flash`, does
   * not correspond to a published model. Every call against it would have
   * failed and silently taken the fallback path, so the AI layer would appear
   * "implemented but always degraded" -- indistinguishable, from the outside,
   * from a missing key. The default below is a long-lived, generally available
   * identifier; set this to whatever the deployment's project actually has
   * access to.
   */
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),

  /**
   * Deadline for one upstream call.
   *
   * Without it a hung upstream holds a serverless invocation open until the
   * platform kills it, which converts an upstream slowdown into exhausted
   * concurrency here. The deterministic fallback makes the timeout cheap: a
   * slow model degrades to an instant local answer instead of a spinner.
   */
  AI_TIMEOUT_MS: intInRange(1_000, 60_000, 12_000),
});

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  geminiApiKey?: string;
  allowedOrigins: readonly string[];
  trustProxy: boolean;
  rateLimit: {
    ai: { max: number; windowSeconds: number };
    read: { max: number; windowSeconds: number };
  };
  aiDailyCallBudget: number;
  maxBodyBytes: number;
  maxTextChars: number;
  aiMaxOutputTokens: number;
  geminiModel: string;
  aiTimeoutMs: number;
}>;

/**
 * Build a validated configuration from a raw environment.
 *
 * Exported as a pure function so tests can exercise every branch without
 * mutating `process.env`.
 *
 * @throws {Error} with every validation failure listed, when the environment is
 *   invalid or a production deployment omits its origin allowlist.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === 'production';

  // A production deployment with an empty allowlist would either reject its own
  // front end or, if defaulted open, expose the paid AI routes to every origin
  // on the internet. Neither is an acceptable default, so refuse to boot.
  if (isProduction && raw.ALLOWED_ORIGINS.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS must list at least one origin in production. ' +
        'Set it to the deployed front-end origin, e.g. "https://calculixhub.vercel.app".',
    );
  }

  const allowedOrigins = [
    ...new Set([
      ...raw.ALLOWED_ORIGINS,
      ...NATIVE_ORIGINS,
      ...(isProduction ? [] : DEV_ORIGINS),
    ]),
  ];

  return Object.freeze({
    nodeEnv: raw.NODE_ENV,
    isProduction,
    geminiApiKey: raw.GEMINI_API_KEY,
    allowedOrigins: Object.freeze(allowedOrigins),
    trustProxy: raw.TRUST_PROXY,
    rateLimit: {
      ai: { max: raw.RATE_LIMIT_AI_MAX, windowSeconds: raw.RATE_LIMIT_AI_WINDOW_S },
      read: { max: raw.RATE_LIMIT_READ_MAX, windowSeconds: raw.RATE_LIMIT_READ_WINDOW_S },
    },
    aiDailyCallBudget: raw.AI_DAILY_CALL_BUDGET,
    maxBodyBytes: raw.MAX_BODY_BYTES,
    maxTextChars: raw.MAX_TEXT_CHARS,
    aiMaxOutputTokens: raw.AI_MAX_OUTPUT_TOKENS,
    geminiModel: raw.GEMINI_MODEL,
    aiTimeoutMs: raw.AI_TIMEOUT_MS,
  });
}

let cached: AppConfig | undefined;

/** The process-wide configuration, parsed on first use and memoised. */
export function config(): AppConfig {
  return (cached ??= loadConfig());
}

/** Drops the memoised configuration. Test-only. */
export function resetConfigForTests(): void {
  cached = undefined;
}
