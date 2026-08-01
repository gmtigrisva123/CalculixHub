/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Request schemas: the single validation boundary for the API.
 *
 * Every handler receives a parsed, typed value and no handler touches raw
 * `req.body`. That inversion is the fix for an entire bug class rather than one
 * bug -- including the crash where `POST /api/chat` with body `{}` reached
 * `message.toLowerCase()`, rejected asynchronously past Express's reach, and
 * terminated the process.
 *
 * Two properties are load-bearing here:
 *
 * - **Everything is bounded.** Numbers have ranges, strings have lengths,
 *   arrays have sizes. Unbounded input that reaches a paid model call is a cost
 *   amplifier: one accepted megabyte becomes upstream tokens the operator pays
 *   for.
 * - **Unknown keys are stripped.** Zod objects are non-strict by default, so
 *   additional properties are dropped rather than forwarded. Nothing the client
 *   invents can reach a prompt.
 */

import { z } from 'zod';
import type { Level, Topic } from '../types';

export const TOPICS = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'] as const satisfies readonly Topic[];
export const LEVELS = ['Foundation', 'Advanced', 'Olympiad'] as const satisfies readonly Level[];

/**
 * Free text destined for a model prompt.
 *
 * The length ceiling is supplied by configuration rather than fixed, so an
 * operator can tighten prompt cost without a code change. C0 control characters
 * are stripped: they are never meaningful in a maths answer or a chat message,
 * and they are a standard way to smuggle instructions past a reviewer reading
 * logs.
 */
const promptText = (maxChars: number) =>
  z
    .string()
    .trim()
    .min(1, 'must not be empty')
    .max(maxChars, `must be at most ${maxChars} characters`)
    // Strip C0 controls and DEL while keeping tab, newline and carriage
    // return, which are legitimate in a worked solution. The rest never
    // carry meaning in maths input, and are a standard way to smuggle
    // content past a human reading a log line.
    .transform((value) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));

/** A bounded, finite number. Rejects NaN and Infinity, which JSON can smuggle. */
const boundedNumber = (min: number, max: number) => z.number().finite().min(min).max(max);

/**
 * A single prior turn of tutor conversation.
 *
 * History is echoed back to the model, so each turn is length-capped exactly
 * like a fresh message -- otherwise the cap on `message` would be trivially
 * bypassed by stuffing the payload into `history`.
 */
const chatTurn = (maxChars: number) =>
  z.object({
    role: z.enum(['user', 'tutor']),
    content: promptText(maxChars),
  });

/**
 * Most recent turns retained for context.
 *
 * Bounded because prompt cost grows linearly with history and the client is the
 * one supplying it. Ten turns is ample for a tutoring exchange and keeps the
 * worst-case prompt an order of magnitude below the model's window.
 */
const MAX_HISTORY_TURNS = 10;

export const chatRequestSchema = (maxChars: number) =>
  z.object({
    message: promptText(maxChars),
    history: z
      .array(chatTurn(maxChars))
      .max(MAX_HISTORY_TURNS * 4, 'too many turns')
      .default([])
      // Keep the tail: recent turns carry the context, older ones are noise.
      .transform((turns) => turns.slice(-MAX_HISTORY_TURNS)),
  });

export type ChatRequest = z.infer<ReturnType<typeof chatRequestSchema>>;

/**
 * Problem identifiers are drawn from a fixed server-side bank, so the format is
 * pinned rather than left as a free string. A caller cannot use this field to
 * probe for path traversal or injection in any future storage layer.
 */
const problemId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'must be a lowercase identifier');

export const evaluateRequestSchema = (maxChars: number) =>
  z.object({
    problemId,
    userAnswer: promptText(maxChars),
    // How long the learner spent, reported by the client and therefore
    // advisory. Bounded so it cannot poison the aggregate time-spent figure:
    // the column accepts up to 24 hours and a single item cannot legitimately
    // take that long.
    durationMs: z.number().int().min(0).max(4 * 60 * 60 * 1000).optional(),
  });

export type EvaluateRequest = z.infer<ReturnType<typeof evaluateRequestSchema>>;

/**
 * Learner metrics driving a recommendation.
 *
 * These are client-reported and therefore advisory: the current architecture
 * keeps learner state in the browser, so a caller can claim any figure. Bounding
 * them stops the values from being used as an injection or cost vector, which is
 * all validation can achieve here. Making them *trustworthy* requires
 * server-side progress, which arrives with the Supabase integration.
 */
export const recommendRequestSchema = z.object({
  points: boundedNumber(0, 1_000_000).default(0),
  completedCount: boundedNumber(0, 100_000).default(0),
  accuracy: boundedNumber(0, 100).default(0),
  // Spelled out per domain rather than as `z.record(z.enum(TOPICS), ...)`:
  // in Zod 4 a record keyed by an enum requires *every* member to be present,
  // so a learner who has not yet touched a domain would have the whole request
  // rejected. Optional keys with a normalising transform express the intent --
  // a partial profile is normal, an unknown domain is not.
  skills: z
    .object({
      Algebra: boundedNumber(0, 100).optional(),
      Geometry: boundedNumber(0, 100).optional(),
      Combinatorics: boundedNumber(0, 100).optional(),
      'Number Theory': boundedNumber(0, 100).optional(),
    })
    .default({})
    .transform((skills) => {
      // Normalise to a complete profile so prompt construction never has to
      // reason about absent domains. 50 is the neutral prior: it asserts
      // neither strength nor weakness for a domain with no evidence yet.
      const complete = {} as Record<Topic, number>;
      for (const topic of TOPICS) complete[topic] = skills[topic] ?? 50;
      return complete;
    }),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;

/** Activity events the landing page reports. A closed set, not free text. */
export const LIVE_EVENTS = ['test-completed', 'problem-solved', 'user-joined'] as const;

export const liveStatsEventSchema = z.object({
  event: z.enum(LIVE_EVENTS),
});

export type LiveStatsEvent = z.infer<typeof liveStatsEventSchema>;
