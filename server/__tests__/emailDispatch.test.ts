/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The dispatcher's rendering and bookkeeping, with a stub database and mailer.
 */

import { describe, expect, it } from 'vitest';
import { mailSettings, renderEmail, type ClaimedEmail, type RenderedEmail } from '../email';
import { bearerMatches, drainOutbox } from '../routes/email';

const job = (over: Partial<ClaimedEmail>): ClaimedEmail => ({
  id: 1, kind: 'notification', attempts: 1, recipient_email: 'ada@example.com', recipient_name: 'Ada',
  payload: { type: 'post_comment', actor: 'Bob', body: 'Nice <b>proof</b>', post_id: 'p1', comment_id: 'c1' }, ...over,
});

describe('renderEmail', () => {
  it('writes a notification email that links to the exact comment and escapes user text', () => {
    const mail = renderEmail(job({}), 'https://calculixhub.test')!;
    expect(mail.to).toBe('ada@example.com');
    expect(mail.subject).toBe('Bob commented on your post');
    expect(mail.html).toContain('https://calculixhub.test/?tab=community&amp;post=p1&amp;comment=c1');
    expect(mail.html).toContain('Nice &lt;b&gt;proof&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>proof</b>');
    expect(mail.text).toContain('"Nice <b>proof</b>"');
  });

  it('writes a broadcast for a new post, and nothing for a deleted one or a missing address', () => {
    const post = job({ kind: 'new_post', payload: { post_id: 'p9', author: 'Eve', body: 'Telescoping trick\nmore lines', deleted: false } });
    const mail = renderEmail(post, 'https://x.test')!;
    expect(mail.subject).toBe('Eve: Telescoping trick');
    expect(mail.text).toContain('https://x.test/?tab=community&post=p9');
    expect(renderEmail({ ...post, payload: { ...post.payload, deleted: true } }, 'https://x.test')).toBeNull();
    expect(renderEmail({ ...post, recipient_email: null }, 'https://x.test')).toBeNull();
  });

  it('sends direct messages to the inbox', () => {
    const mail = renderEmail(job({ payload: { type: 'message', actor: 'Bob', body: 'hi', entity_type: 'conversation', entity_id: 'k' } }), 'https://x.test')!;
    expect(mail.subject).toBe('Bob sent you a message');
    expect(mail.text).toContain('https://x.test/?tab=inbox');
  });
});

describe('settings and authorisation', () => {
  it('reads Gmail SMTP settings and derives the sender', () => {
    const settings = mailSettings({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'app-pass', APP_URL: 'https://site.test/' });
    expect(settings.provider).toBe('smtp');
    expect(settings.smtp).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
    expect(settings.from).toBe('CalculixHub <me@gmail.com>');
    expect(settings.siteUrl).toBe('https://site.test');
  });

  it('accepts only the configured bearer secret', () => {
    const secret = 'a'.repeat(32);
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
    expect(bearerMatches('Bearer wrong', secret)).toBe(false);
    expect(bearerMatches(`Bearer ${secret}`, undefined)).toBe(false);
    expect(bearerMatches(`Bearer short`, 'short')).toBe(false);
  });
});

describe('drainOutbox', () => {
  it('marks sent, skipped and failed rows, retrying failures until the last attempt', async () => {
    const batches: ClaimedEmail[][] = [[
      job({ id: 1 }),
      job({ id: 2, recipient_email: null }),
      job({ id: 3, recipient_email: 'bounce@example.com', attempts: 2 }),
      job({ id: 4, recipient_email: 'bounce@example.com', attempts: 5 }),
    ]];
    const updates: Array<{ id: number; patch: Record<string, unknown> }> = [];
    const client = {
      rpc: async () => ({ data: batches.shift() ?? [], error: null }),
      from: () => ({ update: (patch: Record<string, unknown>) => ({ eq: async (_: string, id: number) => { updates.push({ id, patch }); return { error: null }; } }) }),
    };
    const sent: RenderedEmail[] = [];
    const mailer = async (message: RenderedEmail) => {
      if (message.to.startsWith('bounce')) return { ok: false as const, error: 'mailbox full' };
      sent.push(message);
      return { ok: true as const };
    };

    const summary = await drainOutbox(client as never, mailer, 'https://x.test');
    expect(summary).toEqual({ sent: 1, failed: 2, skipped: 1 });
    expect(sent.map(m => m.to)).toEqual(['ada@example.com']);
    const status = Object.fromEntries(updates.map(u => [u.id, u.patch.status]));
    expect(status).toEqual({ 1: 'sent', 2: 'skipped', 3: 'pending', 4: 'failed' });
  });
});
