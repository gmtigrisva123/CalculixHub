/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Outgoing mail: rendering and transport.
 *
 * Rendering is pure -- a claimed outbox row in, a subject and two bodies out --
 * so every template is tested without a network. Transport is chosen from the
 * environment:
 *
 *   EMAIL_PROVIDER=smtp    any SMTP server. For Gmail: SMTP_HOST=smtp.gmail.com,
 *                          SMTP_PORT=465, SMTP_USER=<address>, SMTP_PASS=<app
 *                          password>. Needs Node (Vercel, Express).
 *   EMAIL_PROVIDER=resend  Resend's HTTP API with RESEND_API_KEY. Works on every
 *                          runtime, Cloudflare Workers included.
 *
 * Without a provider nothing is sent and the outbox simply waits, so a
 * deployment that has not configured mail loses nothing.
 */

export interface ClaimedEmail {
  id: number;
  kind: 'notification' | 'new_post';
  attempts: number;
  recipient_email: string | null;
  recipient_name: string | null;
  payload: Record<string, unknown> | null;
}

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSettings {
  provider: 'smtp' | 'resend' | null;
  from: string;
  siteUrl: string;
  smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
  resendKey?: string;
}

export function mailSettings(env: NodeJS.ProcessEnv = process.env, fallbackOrigin?: string): MailSettings {
  const provider = env.EMAIL_PROVIDER === 'smtp' || env.EMAIL_PROVIDER === 'resend' ? env.EMAIL_PROVIDER : null;
  const siteUrl = (env.APP_URL || fallbackOrigin || 'http://localhost:8000').replace(/\/+$/, '');
  const port = Number(env.SMTP_PORT || 465);
  return {
    provider,
    from: env.EMAIL_FROM || (env.SMTP_USER ? `CalculixHub <${env.SMTP_USER}>` : 'CalculixHub <onboarding@resend.dev>'),
    siteUrl,
    smtp: env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
      ? { host: env.SMTP_HOST, port, secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465, user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
    resendKey: env.RESEND_API_KEY || undefined,
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

/** The sentence a notification email leads with. Mirrors describeNotification in the app. */
export function notificationHeadline(payload: Record<string, unknown>): string {
  const who = str(payload.actor) || 'Someone';
  switch (payload.type) {
    case 'follow': return `${who} started following you`;
    case 'post_like': return `${who} reacted to your post`;
    case 'comment_like': return `${who} reacted to your comment`;
    case 'post_comment': return `${who} commented on your post`;
    case 'comment_reply': return `${who} replied to your comment`;
    case 'mention': return payload.entity_type === 'comment' ? `${who} mentioned you in a comment` : `${who} mentioned you in a post`;
    case 'post_share': return `${who} shared your post`;
    case 'message': return `${who} sent you a message`;
    case 'system': return str(payload.body) || 'Update from CalculixHub';
    default: return 'You have a new notification';
  }
}

function notificationLink(siteUrl: string, payload: Record<string, unknown>): string {
  const post = str(payload.post_id) || (payload.entity_type === 'post' ? str(payload.entity_id) : '');
  if (post) {
    const params = new URLSearchParams({ tab: 'community', post });
    if (str(payload.comment_id)) params.set('comment', str(payload.comment_id));
    return `${siteUrl}/?${params}`;
  }
  return `${siteUrl}/?tab=inbox`;
}

/* One layout for every message: table-based and inline-styled, because that is
 * what Gmail, Outlook and Apple Mail all render the same way. */
function layout({ preheader, eyebrow, headline, quote, cta, href, footnote }: { preheader: string; eyebrow: string; headline: string; quote?: string; cta: string; href: string; footnote: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(headline)}</title></head>
<body style="margin:0;padding:0;background:#f3f1ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17201f">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ec;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e4e0d6">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eeeae1"><span style="font:600 15px/1 Georgia,serif;color:#0f1d23">Calculix<span style="color:#b07d2a">Hub</span></span></td></tr>
<tr><td style="padding:28px 28px 8px"><p style="margin:0 0 10px;font:600 11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a8577">${escape(eyebrow)}</p>
<h1 style="margin:0;font:400 24px/1.3 Georgia,serif;color:#0f1d23">${escape(headline)}</h1></td></tr>
${quote ? `<tr><td style="padding:14px 28px 0"><div style="border-left:3px solid #e6bd73;padding:10px 14px;background:#faf8f3;color:#3c4543;font-size:15px;line-height:1.55;white-space:pre-wrap">${escape(quote)}</div></td></tr>` : ''}
<tr><td style="padding:24px 28px 30px"><a href="${escape(href)}" style="display:inline-block;background:#0f1d23;color:#f1ece2;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:9px">${escape(cta)}</a></td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8a8577">${escape(footnote)}</p>
</td></tr></table></body></html>`;
}

/** Turn a claimed outbox row into a message, or null when there is nothing to send. */
export function renderEmail(job: ClaimedEmail, siteUrl: string): RenderedEmail | null {
  if (!job.recipient_email || !job.payload) return null;
  const name = job.recipient_name || 'there';
  const payload = job.payload;

  if (job.kind === 'notification') {
    const headline = notificationHeadline(payload);
    const quote = payload.type !== 'system' && str(payload.body) ? clip(str(payload.body), 400) : undefined;
    const href = notificationLink(siteUrl, payload);
    const cta = payload.type === 'message' ? 'Open your inbox' : payload.type === 'follow' ? 'See your notifications' : 'View it on CalculixHub';
    return {
      to: job.recipient_email,
      subject: clip(headline, 120),
      html: layout({ preheader: quote ?? headline, eyebrow: 'New notification', headline, quote, cta, href, footnote: `Hi ${name}, you are receiving this because it happened on your CalculixHub account.` }),
      text: `${headline}\n\n${quote ? `"${quote}"\n\n` : ''}${cta}: ${href}\n\nHi ${name}, you are receiving this because it happened on your CalculixHub account.`,
    };
  }

  if (payload.deleted) return null;
  const author = str(payload.author) || 'A learner';
  const body = clip(str(payload.body).trim(), 600);
  const href = `${siteUrl}/?${new URLSearchParams({ tab: 'community', post: str(payload.post_id) })}`;
  const headline = `${author} posted in Community`;
  return {
    to: job.recipient_email,
    subject: clip(body ? `${author}: ${body.split('\n')[0]}` : headline, 120),
    html: layout({ preheader: body || headline, eyebrow: 'New post', headline, quote: body || undefined, cta: 'Read the post', href, footnote: `Hi ${name}, every new post on CalculixHub is sent to all members.` }),
    text: `${headline}\n\n${body ? `${body}\n\n` : ''}Read the post: ${href}\n\nHi ${name}, every new post on CalculixHub is sent to all members.`,
  };
}

export type SendResult = { ok: true } | { ok: false; error: string };
export type Mailer = (message: RenderedEmail) => Promise<SendResult>;

const failure = (error: unknown) => ({ ok: false as const, error: clip(error instanceof Error ? error.message : String(error), 480) });

/** A transport for the configured provider, or null when mail is not set up. */
export async function createMailer(settings: MailSettings, fetcher: typeof fetch = fetch): Promise<Mailer | null> {
  if (settings.provider === 'resend' && settings.resendKey) {
    const key = settings.resendKey;
    return async message => {
      try {
        const response = await fetcher('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: settings.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        });
        return response.ok ? { ok: true } : failure(`Resend ${response.status}: ${await response.text()}`);
      } catch (error) {
        return failure(error);
      }
    };
  }

  if (settings.provider === 'smtp' && settings.smtp) {
    const smtp = settings.smtp;
    // Loaded only when chosen, through a computed specifier so bundlers for
    // runtimes without TCP sockets (Workers) never try to include it.
    const specifier = 'nodemailer';
    const nodemailer = (await import(/* @vite-ignore */ specifier)) as typeof import('nodemailer');
    const transport = (nodemailer.default ?? nodemailer).createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass }, pool: true, maxConnections: 3 });
    return async message => {
      try {
        await transport.sendMail({ from: settings.from, to: message.to, subject: message.subject, html: message.html, text: message.text });
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    };
  }

  return null;
}
