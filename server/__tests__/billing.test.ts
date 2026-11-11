/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing, without a network: Stripe is a stub that records what it was asked,
 * and the database is a stub that records what it was told to store.
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PLANS, hasEntitlement, monthlyEquivalent, planFromSubscription, yearlySaving } from '../../shared/plans';
import { billingSettings, subscriptionRecord, verifyStripeSignature, type BillingSettings } from '../billing';
import { loadConfig } from '../config';
import { MemoryCounterStore } from '../counters';
import { createApp } from '../pipeline';
import { billingRoutes, type BillingDependencies } from '../routes/billing';

const ORIGIN = 'https://calculixhub.example';
const USER = '8f6f3c1e-2a54-4c5e-9d2b-6a1f0e7b9c11';
const SETTINGS: BillingSettings = { secretKey: 'sk_test_abc', webhookSecret: 'whsec_test', prices: { monthly: 'price_m', yearly: 'price_y' } };

const sign = (body: string, secret = SETTINGS.webhookSecret, at = Math.floor(Date.now() / 1000)) =>
  `t=${at},v1=${createHmac('sha256', secret).update(`${at}.${body}`).digest('hex')}`;

const SUBSCRIPTION = {
  id: 'sub_123', customer: 'cus_9', status: 'active', cancel_at_period_end: false,
  metadata: { user_id: USER, plan: 'pro' },
  items: { data: [{ quantity: 1, current_period_end: 1_800_000_000, price: { id: 'price_y', unit_amount: PLANS.pro.price.yearly, recurring: { interval: 'year' } } }] },
};

/** A database stub: one optional existing row, and a log of what was upserted. */
function fakeDatabase(existing: Record<string, unknown> | null = null) {
  const upserts: Record<string, unknown>[] = [];
  const database = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      upsert: async (row: Record<string, unknown>) => { upserts.push(row); return { error: null }; },
    }),
  } as unknown as NonNullable<ReturnType<BillingDependencies['database']>>;
  return { database, upserts };
}

function harness(options: { settings?: BillingSettings | null; existing?: Record<string, unknown> | null; signedIn?: boolean } = {}) {
  const calls: { url: string; method: string; body: URLSearchParams }[] = [];
  const { database, upserts } = fakeDatabase(options.existing ?? null);
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: new URLSearchParams(String(init?.body ?? '')) });
    return String(url).includes('/subscriptions/')
      ? Response.json(SUBSCRIPTION)
      : Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  }) as typeof fetch;
  const app = createApp({
    config: loadConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: ORIGIN } as NodeJS.ProcessEnv),
    store: new MemoryCounterStore(),
    routes: billingRoutes({
      settings: () => (options.settings === undefined ? SETTINGS : options.settings),
      database: () => database,
      verify: async () => (options.signedIn === false ? null : { id: USER, email: 'ada@example.com' }),
      http,
    }),
  });
  const post = (path: string, body: string, headers: Record<string, string> = {}) =>
    app(new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body }));
  return { app, post, calls, upserts };
}

describe('billing configuration', () => {
  const full = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_PRO_MONTHLY: 'price_1', STRIPE_PRICE_PRO_YEARLY: 'price_2' };

  it('is off unless every piece is present', () => {
    expect(billingSettings({} as NodeJS.ProcessEnv)).toBeNull();
    for (const missing of Object.keys(full)) {
      expect(billingSettings({ ...full, [missing]: '' } as NodeJS.ProcessEnv), missing).toBeNull();
    }
    expect(billingSettings(full as NodeJS.ProcessEnv)).toMatchObject({ prices: { monthly: 'price_1', yearly: 'price_2' } });
  });

  it('treats a value pasted into the wrong variable as off', () => {
    expect(billingSettings({ ...full, STRIPE_SECRET_KEY: 'pk_live_x' } as NodeJS.ProcessEnv)).toBeNull();
    expect(billingSettings({ ...full, STRIPE_PRICE_PRO_YEARLY: 'prod_2' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('tells the client whether checkout is open, and nothing else', async () => {
    const closed = await harness({ settings: null }).app(new Request('http://localhost/api/billing/config'));
    expect(await closed.json()).toEqual({ checkout: false });
    const open = await harness().app(new Request('http://localhost/api/billing/config'));
    expect(await open.json()).toEqual({ checkout: true });
  });
});

describe('webhook signatures', () => {
  const body = '{"type":"x"}';

  it('accepts the exact bytes that were signed', () => {
    expect(verifyStripeSignature(body, sign(body), SETTINGS.webhookSecret)).toBe(true);
  });

  it.each([
    ['a changed body', () => verifyStripeSignature(body + ' ', sign(body), SETTINGS.webhookSecret)],
    ['another secret', () => verifyStripeSignature(body, sign(body, 'whsec_other'), SETTINGS.webhookSecret)],
    ['a delivery replayed ten minutes later', () => verifyStripeSignature(body, sign(body, SETTINGS.webhookSecret, Math.floor(Date.now() / 1000) - 600), SETTINGS.webhookSecret)],
    ['no header', () => verifyStripeSignature(body, null, SETTINGS.webhookSecret)],
    ['a header with no signature', () => verifyStripeSignature(body, 't=123', SETTINGS.webhookSecret)],
    ['a signature that is not hex', () => verifyStripeSignature(body, `t=${Math.floor(Date.now() / 1000)},v1=zz`, SETTINGS.webhookSecret)],
  ])('rejects %s', (_label, check) => {
    expect(check()).toBe(false);
  });
});

describe('checkout', () => {
  it('is refused while billing is off, before anything else is looked at', async () => {
    const { post, calls } = harness({ settings: null });
    expect((await post('/api/billing/checkout', '{"plan":"pro","cycle":"yearly"}')).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('needs a signed-in learner', async () => {
    const { post, calls } = harness({ signedIn: false });
    expect((await post('/api/billing/checkout', '{"plan":"pro","cycle":"yearly"}')).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('sells Pro only, on the two cycles that exist', async () => {
    const { post } = harness();
    expect((await post('/api/billing/checkout', '{"plan":"team","cycle":"yearly"}')).status).toBe(400);
    expect((await post('/api/billing/checkout', '{"plan":"pro","cycle":"weekly"}')).status).toBe(400);
  });

  it('opens a session tied to the caller, returning to this site', async () => {
    const { post, calls } = harness();
    const response = await post('/api/billing/checkout', '{"plan":"pro","cycle":"yearly"}');
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    const sent = calls[0]!.body;
    expect(calls[0]!.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(sent.get('mode')).toBe('subscription');
    expect(sent.get('line_items[0][price]')).toBe('price_y');
    expect(sent.get('client_reference_id')).toBe(USER);
    expect(sent.get('subscription_data[metadata][user_id]')).toBe(USER);
    expect(sent.get('customer_email')).toBe('ada@example.com');
    expect(sent.get('success_url')).toBe(`${ORIGIN}/?tab=plan&checkout=success`);
  });

  it('does not sell a second subscription to someone who has one', async () => {
    const { post, calls } = harness({ existing: { status: 'active', cancel_at_period_end: false, stripe_customer_id: 'cus_9' } });
    expect((await post('/api/billing/checkout', '{"plan":"pro","cycle":"monthly"}')).status).toBe(409);
    expect(calls).toHaveLength(0);
  });
});

describe('the webhook', () => {
  const event = JSON.stringify({ type: 'customer.subscription.updated', data: { object: { id: 'sub_123' } } });

  it('stores nothing from a delivery it cannot verify', async () => {
    const { post, upserts, calls } = harness();
    const response = await post('/api/billing/webhook', event, { 'stripe-signature': sign(event, 'whsec_forged') });
    expect(response.status).toBe(400);
    expect(upserts).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('records what Stripe reports for the subscription, not what the event claims', async () => {
    const forged = JSON.stringify({ type: 'customer.subscription.updated', data: { object: { id: 'sub_123', status: 'canceled', metadata: { user_id: 'someone-else' } } } });
    const { post, upserts, calls } = harness();
    const response = await post('/api/billing/webhook', forged, { 'stripe-signature': sign(forged) });

    expect(response.status).toBe(200);
    expect(calls[0]!.url).toBe('https://api.stripe.com/v1/subscriptions/sub_123');
    expect(upserts).toEqual([{
      user_id: USER, plan: 'pro', status: 'active', billing_cycle: 'yearly', seats: 1,
      current_period_end: new Date(1_800_000_000_000).toISOString(), cancel_at_period_end: false,
      stripe_customer_id: 'cus_9', stripe_subscription_id: 'sub_123',
    }]);
  });

  it('acknowledges event types it does not act on without touching anything', async () => {
    const other = JSON.stringify({ type: 'invoice.paid', data: { object: { id: 'in_1' } } });
    const { post, upserts, calls } = harness();
    expect((await post('/api/billing/webhook', other, { 'stripe-signature': sign(other) })).status).toBe(200);
    expect(upserts).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe('plans', () => {
  it('reads period ends from either place Stripe puts them', () => {
    expect(subscriptionRecord({ ...SUBSCRIPTION, current_period_end: 1_700_000_000 }, USER).current_period_end).toBe(new Date(1_700_000_000_000).toISOString());
    expect(subscriptionRecord(SUBSCRIPTION, USER).current_period_end).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it('prices yearly below twelve months, and says by how much', () => {
    expect(PLANS.pro.price.yearly).toBeLessThan(PLANS.pro.price.monthly * 12);
    expect(yearlySaving(PLANS.pro)).toBe(33);
    expect(monthlyEquivalent(PLANS.pro)).toBe(600);
  });

  it('keeps a cancelled plan until the period that was paid for ends', () => {
    const now = Date.parse('2026-11-10T00:00:00Z');
    expect(planFromSubscription(null, now)).toBe('free');
    expect(planFromSubscription({ plan: 'pro', status: 'active' }, now)).toBe('pro');
    expect(planFromSubscription({ plan: 'pro', status: 'canceled', current_period_end: '2026-12-01T00:00:00Z' }, now)).toBe('pro');
    expect(planFromSubscription({ plan: 'pro', status: 'canceled', current_period_end: '2026-11-01T00:00:00Z' }, now)).toBe('free');
    expect(planFromSubscription({ plan: 'pro', status: 'unpaid' }, now)).toBe('free');
  });

  it('holds nothing back while nobody can buy it', () => {
    expect(hasEntitlement('free', 'training-plan', true)).toBe(true);
    expect(hasEntitlement('free', 'training-plan', false)).toBe(false);
    expect(hasEntitlement('pro', 'training-plan', false)).toBe(true);
  });
});
