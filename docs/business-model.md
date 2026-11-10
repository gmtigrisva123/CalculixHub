# Business model

How CalculixHub earns money, what is built, and what still has to be true before it earns a million dollars. The prices and features below are read from `shared/plans.ts`; change them there and the landing page, the Plan screen and this document's numbers move together (this file is the only one you have to edit by hand).

## What is sold

| Plan | Price | Who pays | What they get |
| --- | --- | --- | --- |
| Free | $0 | nobody | Placement, adaptive practice with solutions, the whole exam archive, Arena, leaderboard, community, scratch paper, the contest countdown |
| Pro | $9 a month, or $72 a year | a student or their parent | The week-by-week plan up to a contest date, printable progress reports, every share-card design. Proof feedback and mistake review are listed as "in the works" |
| Team | $7 a month or $60 a year, per student, from 5 students | a coach, club or school | Pro for every student. The coach view, private Arenas and seat management are listed as "in the works" |

Two rules are built into the product, and both are worth keeping:

- **Free is not a trial.** Nothing that is free today moves behind Pro. The free product is the marketing.
- **Nothing is sold as finished before it is.** Every unfinished feature is marked "in the works" wherever it is listed. Team has no self-service checkout until its coach tools exist; the card collects a note and the learner's interest instead.

## What is built, and what is switched off

Built and tested:

- Plans, prices and entitlements in one file (`shared/plans.ts`).
- Stripe Checkout, the customer billing portal and a signature-verified webhook (`server/routes/billing.ts`, `server/billing.ts`).
- A `subscriptions` table that only the webhook can write, and a `plan_interest` table for people who ask to be told when a plan opens (`supabase/account-billing-setup.sql`).
- The Plan screen in the workspace, the pricing section on the landing page, and the gates on the three Pro features.

Switched off until you turn it on: **checkout**. With no Stripe keys configured the server reports `checkout: false`, the app runs in "Pro preview" (every account gets Pro's features, and says so), and the upgrade button becomes "Tell me when Pro opens". `docs/billing-setup.md` is the list of steps to turn it on.

## The arithmetic of one million dollars

These are sums, not forecasts. The inputs marked *assumed* are guesses that only real data can replace.

What one customer is worth, after Stripe's standard card fee of 2.9% + $0.30:

| | Gross | After fees |
| --- | --- | --- |
| Pro, yearly | $72.00 | $69.61 |
| Pro, monthly, kept for 5 months *(assumed)* | $45.00 | $42.20 |
| Team, per student, yearly, 20 seats on one invoice | $60.00 | about $58.25 |

One million dollars of total revenue is therefore about **14,400 Pro-years**, or **16,700 Team seat-years**, or a mix. One illustrative mix, over three years:

| Year | Pro (yearly) | Team seats | Revenue |
| --- | --- | --- | --- |
| 1 | 800 | 300 | $75,600 |
| 2 | 3,500 | 2,000 | $372,000 |
| 3 | 6,000 | 4,500 | $702,000 |
| Total | | | **$1,149,600** |

What has to be true for that table:

- **Enough free learners.** If 3% of registered learners pay *(assumed; a common rule of thumb for freemium products, unmeasured here)*, 6,000 Pro subscribers need about 200,000 registered learners. The site does not produce those by existing. They come from being found: search pages for individual past problems, coaches recommending it, students sharing cards.
- **Coaches.** 4,500 seats is about 225 clubs of 20. One coach is worth twenty students and renews as a group, which is why Team matters more than its price suggests. It needs the coach view built first.
- **Parents.** The person with the card is usually a parent, not the student. The printable report exists for them. A parent-facing email ("here is this week's report") is the obvious next step.
- **Renewal.** Contest practice is seasonal, roughly November to March for the US contests. Yearly billing is discounted by a third for that reason: a monthly subscriber is likely to leave in April.

## Costs to watch

- **AI.** The tutor uses the learner's own Gemini key, or a server key under a daily call budget (`AI_DAILY_CALL_BUDGET`). If proof feedback ships as a Pro feature it will be the first cost that grows with each paying user; price it in before launch.
- **Email.** Every new community post is mailed to every member (`docs/sql-editor-setup.md`). That is fine at hundreds of members and expensive, and unwelcome, at tens of thousands. It needs a digest or an opt-in before growth.
- **Database and hosting.** Modest at this scale; Supabase and Vercel both have usage-based tiers.

## Before charging anyone

These are decisions and paperwork, not code. None of them has been done.

1. **Rights to the exam problems.** The archive contains AMC, AIME and USA(J)MO problems, which the Mathematical Association of America publishes and holds copyright in. Running a free study site with them is one thing; running a paid product around them is another. Get permission or advice before checkout opens. The plans were designed with this in mind: Pro and Team charge for planning, reports and tools, and every past paper stays free. That lowers the risk; it does not settle it.
2. **Children.** Many learners are under 18 and some are under 13. Selling to them means a privacy policy, terms of service, a refund policy, and for under-13s in the US a parental-consent flow (COPPA). Stripe also requires the first three to activate an account.
3. **A business to receive the money.** A Stripe account needs a legal entity or sole proprietor, a bank account and tax details. Sales tax or VAT applies in many places; Stripe Tax can collect it.
4. **A support address.** People who pay expect to be able to reach someone. The Team card currently promises a reply by email to whoever registers interest; those rows are in `plan_interest`.
5. **The prices.** $9, $72 and $60 are a reasoned starting point, not a tested one. The founding list (`plan_interest`) is the cheapest test available: see how many people ask before deciding.
