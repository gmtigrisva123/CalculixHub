# Live user QA — 2026-09-29

## Realtime evidence

- Kept an unauthenticated `localhost:8000` Leaderboard tab open while a separate Chrome session used a signed-in test account.
- Before submission, the signed-in learner had 31 points and rank #2; the other learner had 77 points and rank #1.
- Submitted the correct three-digit answer `840` for **A Cyclic Quadrilateral** in Learn. The server awarded 55 points. The signed-in account showed 86 points and two solved problems.
- Without refreshing the guest tab, the Leaderboard changed to 86 points / rank #1 and 77 points / rank #2. Navigating to the signed-in Leaderboard showed the same order and its personal rank card showed #1.

## Flows checked and fixes made

- Leaderboard Top 10 / Top 50, limited-range search, no-results state, and **Find my place** worked.
- Guest Leaderboard CTAs now go to sign-up/sign-in instead of unsaved practice; the guest Arena registration link now goes there directly too.
- Narrow Leaderboard layouts stack the personal card and explanation so their text remains readable; search now states which rank range it covers.
- The leading-learner grid now fills its width correctly with one or two learners. At a 390px Chrome viewport, the cards stack and the Math Assistant launcher becomes a compact accessible icon above the bottom navigation.
- Community's 124-problem thread filter now has title search; a `Ptolemy` query narrowed the list to the two relevant problems.
- Progress no longer labels an untouched domain a measured weakness. With no activity it shows an empty state; with activity it suggests an area to explore without claiming an unmeasured 0% is proven weakness.
- Settings saved a test goal to the database and then saved the original goal again. The test account and its 86 points survived reload.
- Inbox learner search found the other real account. No message was sent.
- Achievement toasts replayed on reload; the shown-toast IDs are now stored per user. A second reload produced no repeated toast. The 50-point badge title now matches its points-based unlock condition.
- Learn and the global workspace now share one Math Assistant. Opening it from a solved problem produced exactly one launcher and one panel; its icon-only controls have accessible labels.
- Learn's Intermediate filter currently has no catalogue questions. It now explains the empty selection and offers a one-click reset instead of showing a blank page.
- Sign-up now enforces the displayed eight-character password minimum in the browser. Gemini-key copy no longer promises unlimited use beyond Google's actual quota.

## Limits of this session

- Arena had zero published matches, so match entry, timer, grading, and Arena ranking could not be exercised against a live match.
- Intermediate still needs reviewed, published questions; the UI fix does not populate or reclassify the live catalogue.
- Messaging send/reply, social OAuth sign-in, admin mutations, payments, and production deployment were not exercised in this pass.
- The practice submission is saved on the test account. Its leaderboard score is now 86. The temporary Settings change was restored.
