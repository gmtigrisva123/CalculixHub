# Turning checkout on

Until every step here is done the app runs in "Pro preview": no one can be charged, every account gets Pro's features, and the Plan screen says so. Read `docs/business-model.md` ("Before charging anyone") first.

## 1. Database

Run `supabase/account-billing-setup.sql` in the Supabase SQL Editor, after `email-delivery-setup.sql`. It is transactional and safe to rerun. It adds:

- `subscriptions`: one row per paying learner. A learner can read their own row. Nothing but the service role can write it.
- `plan_interest`: learners who asked to hear when a plan opens, with an optional note (used by the Team card).
- `reset_my_progress()` and `delete_my_account()`: the two functions behind the danger zone in Settings. Each acts only on the caller. `delete_my_account()` refuses while a subscription is still renewing.

The danger zone and the data export work as soon as this file is applied, whether or not Stripe is configured.

## 2. Stripe

1. In Stripe, create one product, "CalculixHub Pro", with two recurring prices that match `shared/plans.ts` exactly: **$9.00 per month** and **$72.00 per year**. If the amounts differ, the webhook logs `Stripe price does not match shared/plans.ts` on every payment.
2. Enable the customer portal (Settings → Billing → Customer portal) and allow cancelling at the end of the period.
3. Add a webhook endpoint at `https://<your-site>/api/billing/webhook` for these events only: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

## 3. Server environment

Set all four. If any one is missing or has the wrong prefix, checkout stays off:

```
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_PRO_MONTHLY="price_..."
STRIPE_PRICE_PRO_YEARLY="price_..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must already be set (the webhook writes with the service role). `APP_URL` is used for the pages Stripe returns the learner to; without it the request's own origin is used.

Webhook bodies must fit inside `MAX_BODY_BYTES` (16 KB by default). The four events above do. If you subscribe to more, raise it.

## 4. Check it

1. `GET /api/billing/config` returns `{"checkout":true}`.
2. With test keys, upgrade from the Plan screen using card `4242 4242 4242 4242`. You should land back on the Plan screen and see "You're on Pro" within a few seconds.
3. Cancel from "Manage billing". The Plan screen should say when Pro ends, and Pro should stay on until then.
4. Try deleting that account from Settings before cancelling: it should refuse and say why.

## What happens to everyone when checkout turns on

The preview ends for accounts without a subscription: the full training plan beyond two weeks, the printable report and the extra share-card designs lock, each with a link to the Plan screen. Nothing else changes. Everyone on the `plan_interest` list asked to be told; email them before you flip it.
