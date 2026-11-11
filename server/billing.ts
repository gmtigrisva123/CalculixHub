/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing: the parts that can be reasoned about without a network.
 *
 * Stripe is called over plain HTTPS with `fetch` rather than through its SDK.
 * The API handlers here run unchanged on Node, Vercel and Cloudflare Workers,
 * and three form-encoded requests do not justify a dependency that would have
 * to work on all three.
 *
 * Checkout is off until every piece it needs is configured. A deployment with
 * a secret key but no webhook secret could take a payment and never learn that
 * it had, so "partly configured" is treated as "not configured".
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLANS, type BillingCycle } from '../shared/plans';

export interface BillingSettings {
  secretKey: string;
  webhookSecret: string;
  prices: Record<BillingCycle, string>;
  /** Public site address for the pages Stripe sends the learner back to. */
  siteUrl?: string;
}

const present = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

/**
 * The billing configuration, or `null` when checkout cannot work.
 *
 * Each value is checked for its Stripe prefix. A publishable key or a product
 * id pasted into the wrong variable is the usual mistake, and it should read
 * as "billing is off" at boot rather than as a failed charge later.
 */
export function billingSettings(env: NodeJS.ProcessEnv = process.env): BillingSettings | null {
  const secretKey = present(env.STRIPE_SECRET_KEY);
  const webhookSecret = present(env.STRIPE_WEBHOOK_SECRET);
  const monthly = present(env.STRIPE_PRICE_PRO_MONTHLY);
  const yearly = present(env.STRIPE_PRICE_PRO_YEARLY);
  if (!secretKey || !webhookSecret || !monthly || !yearly) return null;
  if (!/^(sk|rk)_(test|live)_/.test(secretKey) || !webhookSecret.startsWith('whsec_')) return null;
  if (!monthly.startsWith('price_') || !yearly.startsWith('price_')) return null;
  return { secretKey, webhookSecret, prices: { monthly, yearly }, siteUrl: present(env.APP_URL)?.replace(/\/+$/, '') };
}

/** Stripe's API takes nested parameters as bracketed form fields. */
export function formEncode(fields: Record<string, string | number | boolean | undefined>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) body.set(key, String(value));
  return body.toString();
}

/** How old a webhook may be before it is treated as a replay. */
const TOLERANCE_SECONDS = 300;

/**
 * Check a `Stripe-Signature` header against the exact bytes that were sent.
 *
 * The signature covers `<timestamp>.<raw body>`, so the body must be verified
 * before it is parsed: re-serialising parsed JSON does not reproduce the bytes.
 * The timestamp is inside the signed text, which is what makes the age check
 * meaningful; an attacker who replays an old delivery cannot refresh it.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some(signature => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
  });
}

/** The fields of a Stripe subscription this app reads. Everything else is ignored. */
export interface StripeSubscription {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  /** Present at the top level on older API versions, on each item on newer ones. */
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: { quantity?: number; current_period_end?: number; price?: { id?: string; unit_amount?: number | null; recurring?: { interval?: string } | null } }[] };
}

export interface SubscriptionRecord {
  user_id: string;
  plan: 'pro' | 'team';
  status: string;
  billing_cycle: BillingCycle | null;
  seats: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

/** Turn what Stripe reports into the row `subscriptions` stores. */
export function subscriptionRecord(subscription: StripeSubscription, userId: string): SubscriptionRecord {
  const item = subscription.items?.data?.[0];
  const interval = item?.price?.recurring?.interval;
  const periodEnd = subscription.current_period_end ?? item?.current_period_end;
  return {
    user_id: userId,
    plan: subscription.metadata?.plan === 'team' ? 'team' : 'pro',
    status: subscription.status.slice(0, 40),
    billing_cycle: interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : null,
    seats: Math.min(5000, Math.max(1, item?.quantity ?? 1)),
    current_period_end: typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
  };
}

/**
 * Whether the amount Stripe charges matches the price the site displays.
 * A mismatch does not stop the subscription (the learner has already paid);
 * it is logged, loudly, because one of the two numbers is wrong.
 */
export function chargedAmountMatches(subscription: StripeSubscription, record: SubscriptionRecord): boolean {
  const amount = subscription.items?.data?.[0]?.price?.unit_amount;
  if (typeof amount !== 'number' || !record.billing_cycle) return true;
  return amount === PLANS[record.plan].price[record.billing_cycle];
}
