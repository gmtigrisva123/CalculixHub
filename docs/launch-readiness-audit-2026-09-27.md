# CalculixHub — localhost launch readiness audit

Date: 2026-09-27. Environment: localhost:8000, development server, Chrome plus an independent in-app browser session. Branch: vietanhho/redesignall.

## Verdict

**Not ready for a broad public launch yet.** The core practice flow saves real account data and updates a second tab live, but there are reproducible UX defects and important production flows that remain unverified. Passing unit tests does not certify every production integration.

This was a browser audit using the Computer Use skill, supplemented with source inspection and project checks. No deployment, merge, provider configuration, access grants, public posts, or messages to other users were performed. Existing source changes were preserved. This report and build outputs remain inside CalculixHub.

## Browser coverage

| Area | Result | Evidence / limits |
| --- | --- | --- |
| Landing | Passed sampled interactions | Correct and incorrect chord answers, worked reasoning, all four mathematics tabs, keyboard tab navigation, plan expansion, mobile menu. No KaTeX errors in the sampled idea tabs. |
| Responsive landing | Passed sampled widths | 320, 390, 768 and 1280 px; no document horizontal overflow. This is not a full cross-browser or physical-device certification. |
| Sign up / sign in UI | Partial | Forms switch correctly; malformed email is blocked. Registration password has no native minimum length despite the 8-character placeholder. No new account was created. |
| Google / Facebook | Kickoff only | Both buttons reached their respective sign-in pages without a visible redirect error. Consent, new-account creation, return callback and ordinary-user Facebook availability remain untested. |
| Placement | Partial | Live IRT panel remains visible, Intermediate is shown at the initial estimate; correct and skipped responses update the estimate and coverage. Full completion and production migration state were not verified in this audit. |
| Learn — guest | Passed sampled rules | Solutions stay hidden on early wrong responses; third wrong response opens solutions and disables answers. AIME digit columns include zero; correct 840 is accepted. Proof submission remains Pro locked. |
| Learn — authenticated | Passed sampled persistence | Correct, wrong, reload, second-attempt correct and forfeit all tested on the explicitly authorized test account. Forfeit state persists after reload. |
| Realtime learner statistics | Passed | A second Chrome tab updated points, solved count and accuracy without reload after saved attempts. This does not prove every other feature is realtime. |
| Arena | Empty-state only | No scheduled arena exists. Registration, timed play, rankings and cross-user realtime cannot be validated without a published test arena. |
| Community | Partial | Empty state and guest restrictions checked. Public posting, reactions and cross-account delivery were not exercised. |
| Inbox | Partial | Guest access is restricted; signed-in empty notifications/conversations render. No messages were sent; delivery and notification realtime remain unverified. |
| Profile / Progress / Settings | Partial | Navigation, zero-data states and guest save restriction inspected. Personal settings were not changed. Progress incorrectly interprets absence of evidence as a weakness. |
| Admin | Gate only | Guest sign-in gate and signed-in security-code gate render. No elevated membership was granted, no security code changed, no administrator mutation tested. |
| AI tutor | UI only | Key panel opens after forfeit. No key was entered and no paid/provider request was submitted. Duplicate tutor instances were found. |
| iPhone prototype | Partial | iPhone 16 frame hosts an interactive workspace; practice navigation works. This is a web prototype, not a verified native iOS release. |

## Issues to address

### P1 — duplicate AI tutor instances

Reproduction: signed-in Learn → A Recurrence in Disguise → “I can't solve this — show me”. The tutor opens, while another global tutor launcher remains present. The DOM contains **two `#btn-ai-tutor-toggle` elements**, both named “Ask Math Assistant”. A semantic click becomes ambiguous.

Source: `src/components/Learn.tsx:567` renders a contextual `AITutorChat`, and `src/App.tsx:385` renders another global instance. Use one shared tutor instance with problem context, or give separate instances a deliberate, non-overlapping UI and unique identifiers. Recheck key configuration and conversation state after the change.

### P1 — production authentication remains unproven

The OAuth entry pages were reached, but a completed Google/Facebook callback was not tested. The earlier Meta setup was awaiting deployed policy/data-deletion URLs; publication status was not independently rechecked in this audit. Landing/auth UI currently exposes no policy, terms or account-data-deletion links. These need working published destinations and ordinary-user OAuth validation before launch.

### P2 — Intermediate route has no content

Learn → Intermediate returns no questions and no explanatory empty state. After a successful saved answer, feedback can recommend Intermediate, directing the learner toward an empty tier. Assign appropriate existing questions based on reviewed difficulty, and provide a useful empty state if a filter has no results. Do not simply relabel arbitrary questions to populate the tier.

### P2 — Arena sign-in link returns to landing

Guest Arena → “Sign in or create an account” navigates to `/` and shows the landing page rather than the authentication form. Confirmed by UI. Source: `src/components/Arena.tsx:64`. Link directly to the appropriate auth route.

### P2 — explicit home route can be overridden by onboarding

At the beginning of the audit, the signed-in, not-yet-onboarded account opened placement when visiting `/?home=1`. “Back home” returned to landing. Check the intended precedence between an explicit home request and automatic onboarding; keep returning visitors' navigation predictable.

### P2 — Progress overstates zero-data conclusions

An account/session without saved answers displays Algebra as its weakness with 0% mastery and a recommended path. `ProgressView.tsx` sorts zero defaults and selects the first topic; `analytics.ts` describes defaults as “measured mastery”. Render an insufficient-data state before deriving weaknesses or personalized recommendations.

### P2 — question labels and scoring need an academic review

The catalogue correctly says these are training variants, not official contest papers. Nevertheless, sampled AIME/IMO-labelled material includes elementary tasks such as evaluating a quadratic sequence, selecting a 2-person team, or proving the basic Euclidean algorithm. Competition labels and point values alone are not evidence of calibrated difficulty. An item-by-item mathematical and difficulty review, then calibration against actual learner responses, remains necessary before claiming contest-level or psychometrically validated measurement. This audit did not check all 124 solutions or calibrate IRT parameters.

### P2 — accessibility and form details

- Several AI panel close/send/key-visibility buttons and the reminders toggle have no accessible name.
- Some key fields depend on placeholders rather than associated labels.
- `WelcomeScreen.tsx:770` has a required password input but no `minLength`; the UI promises at least 8 characters. Check server-side policy separately and align browser validation with it.
- On the narrow workspace preview, floating AI UI crowds filter/content controls; check unobstructed access with the panel open and the on-screen keyboard visible.

### P2 — unsupported unlimited-AI copy

`Settings.tsx:220–230` promises “Unlimited AI Assistant” and “zero daily limits”. The audit did not validate provider quota, billing or rate-limit behavior. Replace this with accurate personal-key usage copy and test quota/key failures without presenting a blanket unlimited promise.

### P2 — Community filter overwhelms the empty feed

The problem selector presents a very long list of catalogue buttons, including repeated variant titles. Use searchable selection and distinguish similarly named variants so the feed stays easy to reach.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed; Vite reports a large frontend chunk, approximately 1,087.98 KB (323.12 KB gzip), plus CSS approximately 265.73 KB (52.43 KB gzip).
- `npm test -- --hookTimeout=30000 --maxWorkers=2`: 143/143 tests passed across 11 files.
- The initial default test invocation hit a 10-second schema setup hook timeout, not an assertion failure. The bounded-worker rerun with a longer hook timeout passed. Investigate test setup variability if CI reproduces it.
- Captured guest and authenticated console samples contained no error/warning entries. This is a sampled observation, not a guarantee that every route is error-free.
- The dev backend was restarted to load current source; it does not run in watch mode. Saved stats survived the restart, and feedback then used the current Intermediate tier.

## Real-data test effects

The user explicitly confirmed the signed-in account was a test account and allowed saved practice attempts.

| Sequence | Points | Solved | Accuracy |
| --- | ---: | ---: | ---: |
| Baseline | 0 | 0 | — |
| The Hidden Pair — correct first attempt | 31 | 1 | 100% |
| Heron in One Move — wrong first attempt | 31 | 1 | 50% |
| Heron in One Move — correct second attempt | 77 | 2 | 66.7% |
| A Recurrence in Disguise — forfeit | 77 | 2 | 50% |

The final streak was one day. Forfeit added no points and did not count as solved; it affected accuracy. Answers were disabled after completion. Heron's first-attempt count and the recurrence's no-points state persisted after reload. The second tab observed these updates without reload.

A Forgot Password interaction returned its generic acknowledgment while Chrome's password manager had populated the form; a reset email may have been requested for the test account. Delivery and reset completion were not tested. No password was changed.

No secrets, email addresses, OAuth states, or private messages are included in this report. No test records were deleted.

## Remaining release validation

Complete ordinary-user Google/Facebook sign-in and callback on the deployed HTTPS domain; test registration email confirmation, reset delivery and session recovery; confirm the Intermediate database migration is applied; exercise a disposable published Arena with two test accounts; test private messaging/notifications and community realtime across accounts; verify live authorization boundaries and admin workflows; test Gemini success, invalid key and quota failures; run production performance, keyboard/screen-reader, reduced-motion, offline/reconnection and physical-mobile checks. Deployment, production monitoring and rollback were outside this localhost audit.
