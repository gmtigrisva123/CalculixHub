/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The email dispatcher: drains `email_outbox` (supabase/email-delivery-setup.sql).
 *
 * Called by the database itself (pg_net after each enqueue, pg_cron once a
 * minute) or by any scheduler, with `Authorization: Bearer EMAIL_DISPATCH_SECRET`.
 * It never takes a recipient or a message from the request: everything it sends
 * comes from rows the database queued, so the endpoint cannot be used to mail
 * arbitrary people even by someone holding the secret.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '../auth/supabaseAdmin';
import { json } from '../http';
import type { Handler, RouteDefinition } from '../pipeline';
import { createMailer, mailSettings, renderEmail, type ClaimedEmail, type Mailer } from '../email';

const MAX_ATTEMPTS = 5;
/** Bounded so one invocation stays well inside a serverless time limit. */
const MAX_BATCHES = 6;
const BATCH_SIZE = 50;
const CONCURRENCY = 5;

const digest = (value: string) => createHash('sha256').update(value).digest();
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 24 || !header?.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(header.slice(7).trim()), digest(secret));
}

export interface DispatchSummary { sent: number; failed: number; skipped: number }

/** One pass over the queue. Exported for tests, which pass a stub client and mailer. */
export async function drainOutbox(client: Pick<SupabaseClient, 'rpc' | 'from'>, mailer: Mailer, siteUrl: string): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, failed: 0, skipped: 0 };
  const settle = async (id: number, patch: Record<string, unknown>) => {
    await client.from('email_outbox').update({ locked_at: null, ...patch }).eq('id', id);
  };

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data, error } = await client.rpc('claim_email_outbox', { batch_size: BATCH_SIZE });
    if (error) throw Error(`claim_email_outbox failed: ${error.message}`);
    const jobs = (data ?? []) as ClaimedEmail[];
    if (!jobs.length) break;

    for (let start = 0; start < jobs.length; start += CONCURRENCY) {
      await Promise.all(jobs.slice(start, start + CONCURRENCY).map(async job => {
        const message = renderEmail(job, siteUrl);
        if (!message) {
          summary.skipped++;
          return settle(job.id, { status: 'skipped', last_error: job.recipient_email ? 'Nothing to send.' : 'No email address.' });
        }
        const result = await mailer(message);
        if (result.ok) {
          summary.sent++;
          return settle(job.id, { status: 'sent', sent_at: new Date().toISOString(), last_error: null });
        }
        summary.failed++;
        return settle(job.id, { status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', last_error: result.error });
      }));
    }
    if (jobs.length < BATCH_SIZE) break;
  }
  return summary;
}

let cachedMailer: { key: string; mailer: Mailer | null } | null = null;

const dispatch: Handler = async ({ request, config }) => {
  const secret = process.env.EMAIL_DISPATCH_SECRET;
  // Vercel Cron authenticates with CRON_SECRET; accept it too, so a cron entry
  // needs no extra configuration.
  const header = request.headers.get('authorization');
  if (!bearerMatches(header, secret) && !bearerMatches(header, process.env.CRON_SECRET)) {
    return json({ error: 'Not authorised.' }, { status: 401 });
  }

  const client = adminClient();
  if (!client) return json({ error: 'Supabase service credentials are not configured.' }, { status: 503 });

  const origin = config.allowedOrigins.find(o => o.startsWith('https://'));
  const settings = mailSettings(process.env, origin);
  const key = JSON.stringify([settings.provider, settings.from, settings.smtp?.host, settings.smtp?.user, Boolean(settings.resendKey)]);
  if (cachedMailer?.key !== key) cachedMailer = { key, mailer: await createMailer(settings) };
  if (!cachedMailer.mailer) return json({ error: 'No email provider configured. Set EMAIL_PROVIDER and its credentials.' }, { status: 503 });

  try {
    return json({ ok: true, ...(await drainOutbox(client, cachedMailer.mailer, settings.siteUrl)) });
  } catch (error) {
    console.error('[CalculixHub] Email dispatch failed', error);
    return json({ error: 'Email dispatch failed. Apply supabase/email-delivery-setup.sql.' }, { status: 503 });
  }
};

export function emailRoutes(): RouteDefinition[] {
  return [
    { method: 'POST', path: '/api/email/dispatch', routeClass: 'read', handler: dispatch },
    { method: 'GET', path: '/api/email/dispatch', routeClass: 'read', handler: dispatch },
  ];
}
