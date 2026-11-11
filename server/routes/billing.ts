/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing routes.
 *
 *   GET  /api/billing/config    whether checkout is switched on
 *   POST /api/billing/checkout  start a Stripe Checkout session for Pro
 *   POST /api/billing/portal    open Stripe's own page for managing a subscription
 *   POST /api/billing/webhook   Stripe telling us a subscription changed
 *
 * The browser never tells this server which plan a learner holds. The only
 * writer of `subscriptions` is the webhook, and it writes what Stripe reports
 * after the delivery's signature has been checked. Events can arrive late or
 * out of order, so the webhook does not trust the event's copy of the
 * subscription: it uses the event only as a prompt to read the subscription
 * back from Stripe, which is always current.
 *
 * The service-role client is used here for the same reason as in the email
 * dispatcher: the caller is another server, there is no learner session, and
 * no client is permitted to write these rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ACTIVE_STATUSES } from '../../shared/plans';
import { adminClient, verifyAccessToken, type AuthenticatedUser } from '../auth/supabaseAdmin';
import { billingSettings, chargedAmountMatches, formEncode, subscriptionRecord, verifyStripeSignature, type BillingSettings, type StripeSubscription } from '../billing';
import { json, readJsonBody } from '../http';
import type { Handler, RouteDefinition } from '../pipeline';

const STRIPE_API = 'https://api.stripe.com/v1';

export interface BillingDependencies {
  settings: () => BillingSettings | null;
  database: () => Pick<SupabaseClient, 'from'> | null;
  verify: (authorization: string | null) => Promise<AuthenticatedUser | null>;
  /** `fetch`, replaceable so tests never reach Stripe. */
  http: typeof fetch;
}

const defaults: BillingDependencies = {
  settings: () => billingSettings(),
  database: () => adminClient(),
  verify: verifyAccessToken,
  http: (...args) => fetch(...args),
};

const checkoutInput = z.object({ plan: z.literal('pro'), cycle: z.enum(['monthly', 'yearly']) });

const off = () => json({ error: 'Checkout is not open yet.' }, { status: 503 });

/** Where Stripe sends the learner afterwards: this site, never an address the request supplied in its body. */
function siteOrigin(request: Request, settings: BillingSettings): string | null {
  if (settings.siteUrl) return settings.siteUrl;
  // The pipeline has already refused any Origin that is not this site or on the allowlist.
  const origin = request.headers.get('origin');
  return origin && /^https?:\/\//.test(origin) ? origin : null;
}

export function billingRoutes(overrides: Partial<BillingDependencies> = {}): RouteDefinition[] {
  const deps = { ...defaults, ...overrides };

  async function stripe<T>(settings: BillingSettings, method: 'GET' | 'POST', path: string, fields?: Record<string, string | number | boolean | undefined>): Promise<T | null> {
    const response = await deps.http(`${STRIPE_API}${path}`, {
      method,
      headers: { authorization: `Bearer ${settings.secretKey}`, ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      ...(fields ? { body: formEncode(fields) } : {}),
    });
    if (!response.ok) {
      // Stripe's error text can name internal objects; it is logged, never returned.
      console.error('[CalculixHub] Stripe request failed', { path: path.split('/')[1], status: response.status });
      return null;
    }
    return (await response.json()) as T;
  }

  const config: Handler = () => json({ checkout: Boolean(deps.settings() && deps.database()) });

  const checkout: Handler = async ctx => {
    const settings = deps.settings();
    const database = deps.database();
    if (!settings || !database) return off();

    const user = await deps.verify(ctx.request.headers.get('authorization'));
    if (!user) return json({ error: 'Sign in to upgrade.' }, { status: 401 });

    const body = await readJsonBody(ctx.request, ctx.config.maxBodyBytes);
    if (!body.ok) return body.response;
    const input = checkoutInput.safeParse(body.value);
    if (!input.success) return json({ error: 'Choose monthly or yearly.' }, { status: 400 });

    const origin = siteOrigin(ctx.request, settings);
    if (!origin) return json({ error: 'Checkout could not be started from here.' }, { status: 400 });

    const { data: existing } = await database.from('subscriptions').select('status,cancel_at_period_end,stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (existing && ACTIVE_STATUSES.includes(existing.status) && !existing.cancel_at_period_end) {
      return json({ error: 'You already have Pro. Manage it from the Plan page.' }, { status: 409 });
    }

    const session = await stripe<{ url?: string }>(settings, 'POST', '/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': settings.prices[input.data.cycle],
      'line_items[0][quantity]': 1,
      success_url: `${origin}/?tab=plan&checkout=success`,
      cancel_url: `${origin}/?tab=plan&checkout=cancelled`,
      client_reference_id: user.id,
      // A returning customer keeps one Stripe record, so their invoices stay together.
      ...(existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: user.email }),
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan]': input.data.plan,
      allow_promotion_codes: true,
    });
    return session?.url ? json({ url: session.url }) : json({ error: 'Checkout is unavailable right now. Please try again shortly.' }, { status: 502 });
  };

  const portal: Handler = async ctx => {
    const settings = deps.settings();
    const database = deps.database();
    if (!settings || !database) return off();

    const user = await deps.verify(ctx.request.headers.get('authorization'));
    if (!user) return json({ error: 'Sign in to manage your plan.' }, { status: 401 });

    const origin = siteOrigin(ctx.request, settings);
    const { data: row } = await database.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (!origin || !row?.stripe_customer_id) return json({ error: 'There is no subscription to manage.' }, { status: 404 });

    const session = await stripe<{ url?: string }>(settings, 'POST', '/billing_portal/sessions', { customer: row.stripe_customer_id, return_url: `${origin}/?tab=plan` });
    return session?.url ? json({ url: session.url }) : json({ error: 'The billing page is unavailable right now. Please try again shortly.' }, { status: 502 });
  };

  const webhook: Handler = async ctx => {
    const settings = deps.settings();
    const database = deps.database();
    if (!settings || !database) return off();

    const raw = await ctx.request.text();
    if (!verifyStripeSignature(raw, ctx.request.headers.get('stripe-signature'), settings.webhookSecret)) {
      return json({ error: 'Signature check failed.' }, { status: 400 });
    }

    let event: { type?: string; data?: { object?: Record<string, unknown> } };
    try { event = JSON.parse(raw); } catch { return json({ error: 'Malformed event.' }, { status: 400 }); }
    const object = event.data?.object ?? {};

    let subscriptionId: string | undefined;
    let userId: string | undefined;
    if (event.type === 'checkout.session.completed') {
      if (object.mode !== 'subscription') return json({ received: true });
      subscriptionId = typeof object.subscription === 'string' ? object.subscription : undefined;
      userId = typeof object.client_reference_id === 'string' ? object.client_reference_id : undefined;
    } else if (event.type?.startsWith('customer.subscription.')) {
      subscriptionId = typeof object.id === 'string' ? object.id : undefined;
    } else {
      // An event type this app does not act on. Acknowledged so Stripe stops retrying it.
      return json({ received: true });
    }
    if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return json({ received: true });

    const subscription = await stripe<StripeSubscription>(settings, 'GET', `/subscriptions/${subscriptionId}`);
    // A 5xx asks Stripe to deliver again later, which is right when Stripe itself could not be read.
    if (!subscription) return json({ error: 'Could not read the subscription.' }, { status: 502 });

    userId ??= subscription.metadata?.user_id;
    if (!userId || !z.string().uuid().safeParse(userId).success) {
      const { data: known } = await database.from('subscriptions').select('user_id').eq('stripe_subscription_id', subscription.id).maybeSingle();
      userId = known?.user_id;
    }
    if (!userId) {
      console.error('[CalculixHub] Subscription event with no learner attached', { subscription: subscription.id });
      return json({ received: true });
    }

    const record = subscriptionRecord(subscription, userId);
    if (!chargedAmountMatches(subscription, record)) {
      console.error('[CalculixHub] Stripe price does not match shared/plans.ts', { plan: record.plan, cycle: record.billing_cycle });
    }
    const { error } = await database.from('subscriptions').upsert(record, { onConflict: 'user_id' });
    if (error) {
      console.error('[CalculixHub] Could not record subscription', { code: error.code });
      return json({ error: 'Could not record the subscription.' }, { status: 500 });
    }
    return json({ received: true });
  };

  return [
    { method: 'GET', path: '/api/billing/config', routeClass: 'read', handler: config },
    { method: 'POST', path: '/api/billing/checkout', routeClass: 'read', handler: checkout },
    { method: 'POST', path: '/api/billing/portal', routeClass: 'read', handler: portal },
    { method: 'POST', path: '/api/billing/webhook', routeClass: 'read', handler: webhook },
  ];
}
