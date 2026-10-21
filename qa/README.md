# Live-site QA

Everything needed to exercise the deployed site with real browsers:

- 15 scripted **bots** that walk the same journey in parallel and measure it.
- 50 **agent personas** that use the site the way their person would, then
  critique it, the interface above all.

All of these accounts belong to the **QA cohort**
(`supabase/migrations/20261021000100_qa_cohort.sql`). Learners never see a QA
account or anything it writes: not in the feed, rankings, arenas,
notifications, messages, presence or platform totals. QA accounts never see or
touch learners either. Nothing on screen marks an account as QA; the two
cohorts simply never meet.

An account joins the cohort by signing up with a `+cxqa-` plus-address:
`team+cxqa-linh.pham@gmail.com`. Plus-addressing delivers every QA mail to the
one inbox the team owns, so no mail reaches a stranger.

## Before the first run

1. Merge and deploy the branch.
2. Run `supabase/qa-cohort-setup.sql` in the Supabase SQL Editor. Run it after
   every other setup file, and again whenever `admin-arena-setup.sql` or
   `realtime-setup.sql` is rerun.
3. Install the QA tools: `cd qa && npm ci`. Playwright uses the Chromium
   already installed for it.

## A run

From the repository root:

```sh
export QA_EMAIL_BASE=team@gmail.com   # the inbox QA mail reaches (no plus tag)
export QA_ADMIN_CODE=…                # only for the administrator personas

node qa/identities.mjs                # 65 people: qa/out/identities.json + agent briefs
node qa/preflight.mjs                 # deploy carries this branch, migration applied

node qa/bots/run.mjs --only B01       # the canary
node qa/preflight.mjs --canary B01    # proves, from outside, that the canary is hidden

# Agents: one Claude Code subagent per brief in qa/out/agents/<id>/brief.md,
# in waves of eight (wave 1 = the administrators, who create the arenas).

node qa/bots/run.mjs                  # all 15 bots, 8 at a time, sign-ups 15 s apart
node qa/report/build.mjs              # qa/out/report.md + report.json
```

If the project requires email confirmation, whoever can read the QA inbox
passes each link on with `node qa/confirm.mjs <email> <link>`. The waiting bot or
agent opens it within seconds.

## Afterwards

Run `qa/cleanup.sql` in the SQL Editor. It deletes every QA account and
everything it created: posts, comments, reactions, arenas, entries, messages,
stats and audit rows. Learners' data is untouched; every statement is scoped
to `cohort.qa_accounts`. If Storage refuses SQL deletion, the notices name the
image folders to delete by hand.

## Files

| Path | What it is |
|---|---|
| `identities.mjs` | Faker-generated people across 20 locales, seeded, with personas and focus areas |
| `preflight.mjs` | Safety checks against the live site and database |
| `bots/run.mjs` | The scripted journey: sign-up, placement, Learn, Community, Arena, every screen, sign-out |
| `agent/browser.mjs` | The browser CLI agents drive; `agent/daemon.mjs` keeps each page alive |
| `agent/BRIEF.md` | The agent brief template |
| `report/build.mjs` | Merges bot runs and agent findings into one report |
| `confirm.mjs` | Hands confirmation links to waiting bots and agents |
| `cleanup.sql` | Removes the QA cohort |
| `out/` | Everything a run writes (git-ignored: it holds passwords) |
