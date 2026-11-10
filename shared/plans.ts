/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plans and prices: the one place they are written down.
 *
 * The landing page, the workspace Plan screen and the billing routes all read
 * this file, so a price cannot say one thing on the front page and another at
 * checkout. Amounts are whole US cents. What Stripe actually charges is set by
 * the Price objects named in the server environment (see .env.example), so
 * those must be created with these amounts; the webhook logs an error whenever
 * a charge does not match the figure written here.
 *
 * A feature is listed as `ready` only when it exists in this codebase today.
 * Anything still being built is `planned` and is drawn differently everywhere
 * it appears, so nobody pays for a promise without being told it is one.
 */

export type PlanId = 'free' | 'pro' | 'team';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanFeature {
  label: string;
  state: 'ready' | 'planned';
}

export interface Plan {
  id: PlanId;
  name: string;
  /** One line: who this is for. */
  audience: string;
  /** Cents per billing period. Team is per seat. */
  price: Record<BillingCycle, number>;
  /** "per student" for Team; absent otherwise. */
  unit?: string;
  features: readonly PlanFeature[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    audience: 'Everything you need to practise seriously.',
    price: { monthly: 0, yearly: 0 },
    features: [
      { label: 'Placement that finds your level', state: 'ready' },
      { label: 'Adaptive practice with full solutions', state: 'ready' },
      { label: 'Every past paper in the archive', state: 'ready' },
      { label: 'Live Arena contests and the leaderboard', state: 'ready' },
      { label: 'Scratch paper on every screen', state: 'ready' },
      { label: 'Race-day countdown and today’s target', state: 'ready' },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    audience: 'For the season you are training for something.',
    price: { monthly: 900, yearly: 7900 },
    features: [
      { label: 'A week-by-week plan up to your contest date', state: 'ready' },
      { label: 'Printable progress reports for parents and coaches', state: 'ready' },
      { label: 'Every share-card design', state: 'ready' },
      { label: 'Feedback on written proofs', state: 'planned' },
      { label: 'Mistake review that brings old errors back', state: 'planned' },
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    audience: 'For clubs, coaches and schools.',
    price: { monthly: 700, yearly: 6000 },
    unit: 'per student',
    features: [
      { label: 'Pro for every student', state: 'ready' },
      { label: 'A coach’s view of the whole group', state: 'planned' },
      { label: 'Private Arena contests for your club', state: 'planned' },
      { label: 'One invoice, seats you can reassign', state: 'planned' },
    ],
  },
};

export const PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'team'];

/** Team is sold by conversation until the coach tools exist. */
export const TEAM_MIN_SEATS = 5;

export const dollars = (cents: number): string =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

/** What a yearly plan costs per month, in cents, rounded to the nearest cent. */
export const monthlyEquivalent = (plan: Plan): number => Math.round(plan.price.yearly / 12);

/** Whole-percent saving of paying yearly rather than twelve monthly payments. */
export const yearlySaving = (plan: Plan): number =>
  plan.price.monthly === 0 ? 0 : Math.round((1 - plan.price.yearly / (plan.price.monthly * 12)) * 100);

/**
 * Entitlements. `preview` is true while checkout is not switched on: until a
 * learner can actually buy Pro, nothing is held back from them.
 */
export type Entitlement = 'training-plan' | 'progress-report' | 'share-designs';

const PRO_ENTITLEMENTS: readonly Entitlement[] = ['training-plan', 'progress-report', 'share-designs'];

export function hasEntitlement(plan: PlanId, entitlement: Entitlement, preview: boolean): boolean {
  if (preview) return true;
  return plan !== 'free' && PRO_ENTITLEMENTS.includes(entitlement);
}

/** Subscription states Stripe reports that still mean "paid up". */
export const ACTIVE_STATUSES: readonly string[] = ['active', 'trialing', 'past_due'];

export function planFromSubscription(row: { plan?: string | null; status?: string | null; current_period_end?: string | null } | null | undefined, now = Date.now()): PlanId {
  if (!row || !row.plan || !row.status) return 'free';
  if (row.plan !== 'pro' && row.plan !== 'team') return 'free';
  if (ACTIVE_STATUSES.includes(row.status)) return row.plan;
  // A cancelled subscription keeps what was paid for until the period ends.
  if (row.status === 'canceled' && row.current_period_end && Date.parse(row.current_period_end) > now) return row.plan;
  return 'free';
}
