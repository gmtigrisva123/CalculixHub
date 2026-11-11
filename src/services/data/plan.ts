/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The learner's plan, and what it lets them do.
 *
 * Two facts decide it. Whether checkout is switched on comes from the server
 * (`/api/billing/config`), because only the server knows if payment keys are
 * configured. Which plan this learner holds comes from their own row in
 * `subscriptions`, which row-level security lets them read and nobody but the
 * billing webhook write. Until checkout is on, the app is in preview: nothing
 * is held back, because a feature nobody can buy should not be locked.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { apiFetch, apiUrl } from '../apiBase';
import { hasEntitlement, planFromSubscription, type BillingCycle, type Entitlement, type PlanId } from '../../../shared/plans';
import { useLiveQuery } from './liveQuery';

export interface SubscriptionRow {
  plan: string;
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface BillingConfig { checkout: boolean }

let configRequest: Promise<BillingConfig> | null = null;

/** Asked once per page load; a failure is read as "checkout is not on". */
export function billingConfig(): Promise<BillingConfig> {
  configRequest ??= fetch(apiUrl('/api/billing/config'))
    .then(async response => (response.ok ? { checkout: Boolean((await response.json()).checkout) } : { checkout: false }))
    .catch(() => ({ checkout: false }));
  return configRequest;
}

export interface PlanState {
  plan: PlanId;
  /** True while nobody can buy Pro yet; every entitlement is open. */
  preview: boolean;
  checkout: boolean;
  loading: boolean;
  subscription: SubscriptionRow | null;
  /** Whether this learner has asked to be told when the plan opens. */
  interested: readonly PlanId[];
  can(entitlement: Entitlement): boolean;
  reload(): Promise<void>;
}

const EMPTY = { subscription: null as SubscriptionRow | null, interested: [] as PlanId[] };

export function usePlan(userId: string | null): PlanState {
  const [checkout, setCheckout] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; void billingConfig().then(config => { if (alive) setCheckout(config.checkout); }); return () => { alive = false; }; }, []);

  const load = useCallback(async () => {
    if (!userId || !supabase) return EMPTY;
    // Either table may not exist yet on a project that has not run the billing
    // setup. That is the Free plan, not an error worth showing anyone.
    const [subscription, interest] = await Promise.all([
      supabase.from('subscriptions').select('plan,status,billing_cycle,current_period_end,cancel_at_period_end').eq('user_id', userId).maybeSingle(),
      supabase.from('plan_interest').select('plan').eq('user_id', userId),
    ]);
    return {
      subscription: subscription.error ? null : (subscription.data as SubscriptionRow | null),
      interested: interest.error ? [] : (interest.data ?? []).map(row => row.plan as PlanId),
    };
  }, [userId]);
  const state = useLiveQuery('plan:' + (userId ?? 'guest'), EMPTY, load);

  const plan = planFromSubscription(state.data.subscription);
  const preview = checkout !== true;
  return {
    plan,
    preview,
    checkout: checkout === true,
    loading: state.loading || checkout === null,
    subscription: state.data.subscription,
    interested: state.data.interested,
    can: entitlement => hasEntitlement(plan, entitlement, preview),
    reload: state.reload,
  };
}

export type BillingResult = { ok: true; url: string } | { ok: false; error: string };

async function redirectFrom(path: string, body: unknown): Promise<BillingResult> {
  try {
    const response = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && typeof data.url === 'string') return { ok: true, url: data.url };
    return { ok: false, error: typeof data.error === 'string' ? data.error : 'Could not reach checkout. Please try again.' };
  } catch {
    return { ok: false, error: 'Could not reach checkout. Check your connection and try again.' };
  }
}

/** Pro is the plan sold by self-service; Team is arranged by conversation. */
export const startCheckout = (cycle: BillingCycle) => redirectFrom('/api/billing/checkout', { plan: 'pro', cycle });

export const openBillingPortal = () => redirectFrom('/api/billing/portal', {});

/** Put this learner on the list to hear when a plan opens. Safe to repeat. */
export async function registerInterest(userId: string, plan: Exclude<PlanId, 'free'>, note?: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sign in to join the list.' };
  const { error } = await supabase.from('plan_interest').upsert({ user_id: userId, plan, note: note?.trim() ? note.trim().slice(0, 500) : null }, { onConflict: 'user_id,plan' });
  return error ? { ok: false, error: 'Could not save that just now. Please try again.' } : { ok: true };
}
