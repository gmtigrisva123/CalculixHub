# Deploying to Cloudflare Workers

The site runs on Cloudflare Workers with static assets. The front end is the
same `vite build` output Vercel served, unchanged. Nothing under `src/`,
`public/` or `index.html` is Cloudflare-specific.

## How it is put together

| Piece | File | Role |
| --- | --- | --- |
| Wrangler config | `wrangler.jsonc` | Names the Worker, points it at `dist/`, sends `/api/*` to the Worker first |
| Worker | `server/cloudflareEntry.ts` | Runs the same API router as `server/vercelEntry.ts`; serves `index.html` for app routes |
| Static headers | `scripts/build-cloudflare.mjs` | Writes `dist/_headers` from `server/security.ts`: CSP, HSTS and the cache rules from `vercel.json` |

Requests for a file in `dist/` never run the Worker: Cloudflare serves them
directly with the `_headers` policy, and they are free and unmetered. The Worker
runs only for `/api/*` and for paths with no file behind them. It mirrors the
`vercel.json` rewrite: app routes get `index.html`, and a missing file under
`/assets/`, `/icons/` or `/_vercel/` stays a 404, so `public/sw.js` never caches
HTML in place of a script.

## One-time setup (Workers Builds, deploys on every push)

1. In the Cloudflare dashboard, open **Workers & Pages → Create → Import a
   repository**, connect GitHub and pick `gmtigrisva123/CalculixHub`.
2. Fill in the build settings:
   - **Project name:** `calculixhub`. It must match `name` in `wrangler.jsonc`.
   - **Build command:** `npm run build:cloudflare`
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Root directory:** `/` (the default)
3. Under **Build variables**, add:
   - `NODE_VERSION` = `22`. Wrangler needs Node 22 or newer, and `.nvmrc` pins
     20 for the rest of the tooling. Check that the first lines of the build log
     report Node 22.
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, with the same values as
     on Vercel. They are compiled into the browser bundle, so they must be
     present at build time. Leave `VITE_API_BASE_URL` unset for the web build.
4. Save and deploy. The site comes up at
   `https://calculixhub.<your-subdomain>.workers.dev`.
5. Under **Settings → Variables and Secrets**, add the runtime configuration,
   copying the values from the Vercel project:

   | Name | Type | Notes |
   | --- | --- | --- |
   | `ALLOWED_ORIGINS` | Text | **Required.** The site's origin, e.g. `https://calculixhub.<your-subdomain>.workers.dev`, plus any custom domain, comma-separated. Without it every API route returns 503. |
   | `GEMINI_API_KEY` | Secret | Optional; without it the AI routes use the deterministic engine. |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Secret | Accounts, leaderboard, community. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret | Admin API. |
   | `ADMIN_ACCESS_CODE_HASH`, `ADMIN_SESSION_SECRET` | Secret | Admin sign-in. |
   | `GEMINI_MODEL`, `AI_DAILY_CALL_BUDGET`, `RATE_LIMIT_*`, ... | Text | Only if they were changed from the defaults on Vercel. |

   Do not set `NODE_ENV` or `TRUST_PROXY`; `wrangler.jsonc` fixes both on every
   deploy. `TRUST_PROXY` must stay `false` here: Cloudflare appends to a
   client-supplied `x-forwarded-for` instead of replacing it. The Worker
   identifies clients by `cf-connecting-ip`, which Cloudflare sets itself.
   `keep_vars` in `wrangler.jsonc` keeps the variables set in the dashboard
   across deploys.
6. In Supabase, open **Authentication → URL Configuration** and add the new
   origin (and any custom domain) to the redirect URLs. Sign-up confirmation,
   social sign-in and password recovery redirect to `window.location.origin`,
   and Supabase refuses origins that are not on that list.

To use a custom domain, add it under **Settings → Domains & Routes**, then add
it to `ALLOWED_ORIGINS` and to the Supabase redirect URLs.

## Deploying from your own machine

```bash
npx wrangler login
```

```bash
npm run deploy:cloudflare
```

This builds with the `VITE_*` values in your local `.env` and deploys the
result. Runtime variables still come from the dashboard.

To try the Worker locally first, put `ALLOWED_ORIGINS="http://localhost:8787"`
in a `.dev.vars` file (git-ignored), then run:

```bash
npm run build:cloudflare && npx wrangler dev
```

## Retiring Vercel

Once the Cloudflare site works, disconnect the repository from the Vercel
project, or delete the project, so pushes stop deploying there. `vercel.json`,
`api/` and `server/vercelEntry.ts` have no effect on Cloudflare and can stay
until you no longer need to roll back.

## Differences from Vercel

- **Workers plan limits.** The free plan allows 100,000 Worker requests a day
  and 10 ms of CPU per request. Static files do not count. Most API routes spend
  their time waiting on Gemini or Supabase, which does not count as CPU, but the
  admin access-code check runs `scrypt` and takes about 45 ms of CPU. That
  check needs the Workers Paid plan.
- **Vercel Analytics.** `src/main.tsx` mounts Vercel's `<Analytics />` and
  `<SpeedInsights />`, which only collect data on Vercel. On Cloudflare their
  `/_vercel/*` script requests return 404 and they record nothing. The front
  end is unchanged, so they stay mounted.
- **Rate limits** are counted in memory per Worker instance, as they were per
  serverless instance on Vercel (see `server/counters.ts`).
- **iOS build.** When the iOS app is next rebuilt, set `VITE_API_BASE_URL` to
  the Cloudflare origin.
