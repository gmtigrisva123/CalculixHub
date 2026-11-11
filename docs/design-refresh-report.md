# Landing and placement design refresh

- Clarified the opening description: CalculixHub is a competition mathematics workspace with adaptive placement, practice, and worked solutions.
- Added an editorial product journey, competition-level explanation, code-drawn mathematics illustration, Free/Pro/Max overview, feature comparison, and interactive FAQ.
- Connected calls to action to existing registration, Learn, and Arena routes.
- Marked Pro and Max as in development. No payment flow, invented paid prices, activation, or AI credit allowance was added. Planned features are explicitly distinguished from available features.
- Refined placement with a paper working surface, quiet grid texture, stronger answer selection, and a styled live IRT panel. Adaptive logic and the absence of fixed question counts are preserved.
- Verified desktop presentation, Pro disclosure, registration navigation, and mobile width. The comparison table scrolls within its region instead of widening the page.
- TypeScript checks and production build passed. The build retains the existing large-bundle warning.

All changes are inside CalculixHub, on the existing non-main branch. This refresh has not been deployed.

## AIME-style geometry and reading comfort

Replaced the landing triangle demo with an original intersecting-chord problem: PA=9, PB=21, PC=7, PD=27, cos(angle APC)=3/5; find the squared radius (289). The diagram uses exact circle-line intersections and supports dragging point C, a keyboard-accessible rotation slider, integer answer checks, reset, and worked reasoning. Moving the chord is explicitly an exploration; the given problem refers to its starting figure.

Raised navigation, body, feature, plan, FAQ, footer, and supporting text sizes, generally to 14–18px. Important numbers and controls are larger. Verified the geometry across the full rotation range and checked answer entry, keyboard rotation, mathematical rendering, and mobile width in Chrome.

## Surface and interaction polish

- Added distinct surface treatments for landing exploration, notebook questions, membership plans, comparison table, placement, dashboard, and shared in-app cards.
- Added subtle, once-only scroll reveals to selected landing and dashboard surfaces, hover feedback on selectable cards, press feedback on primary controls, and soft entry transitions for expanded notes and tab content.
- Used transform and opacity for reveals; preserved resting transforms on the drawn working sheet. Content remains visible if animation APIs are unavailable.
- Cancels animations when reduced-motion preference changes and skips motion for keyboard input. Hover movement is restricted to pointer devices.
- Verified membership disclosures and keyboard behavior in Chrome, and checked the mobile page width. Dashboard visual testing was limited by the current account's unfinished onboarding; its styles and types passed the build checks.
- TypeScript and production build passed. No scoring, authentication, database, or billing behavior was changed by this surface polish.

## Mathematical folio and editorial typography

Rebuilt “What’s on your mind?” with keyboard-accessible subject tabs, properly rendered display equations, theorem hypotheses, custom SVG sketches, an expandable worked insight, and real Learn links. The subjects now introduce Schur, Ptolemy, a roots-of-unity filter for binomial coefficients, and the odd-prime LTE lemma. Level labels describe the intended style of study, not an official contest classification of a theorem. Mathematical examples were derived for this interface rather than copied from a contest problem.

Newsreader gives the landing headings a distinct editorial voice; Manrope handles navigation and controls, DM Sans handles sustained reading, and KaTeX continues to handle formulas. Responsive type sizes preserve legibility.

Reference checks:
- Roots-of-unity filtering: original handout by Dylan Yu and Raymond Feng, https://yu-dylan.github.io/files/handouts/filter.pdf
- Ptolemy: https://mathshistory.st-andrews.ac.uk/Extras/Ptolemy_theorem/
- Formalized LTE: https://isa-afp.org/entries/Lifting_the_Exponent.html

The algebra identity is Schur’s degree-three form for nonnegative variables; its p,q,r rewrite is an algebraic expansion. LTE states its distinct-positive-integer, odd-prime and divisibility hypotheses explicitly.


## Closing invitation refresh

Replaced the sparse “Pull up a chair” strip with a concrete next-step section: an editorial introduction and two offset interactive paths for practice and adaptive placement. Both retain their existing destinations. Larger text, responsive stacked layout, keyboard focus, subtle hover/press feedback, and reduced-motion support are included. Verified desktop and 390px mobile rendering with no horizontal overflow. TypeScript lint and production build pass.


## Registration before placement

Landing placement actions lead to the registration form, with copy explaining that a free account comes first. Removed Continue as guest from authentication forms. Placement rendering and answer submission now require an authenticated Supabase session. Email confirmation remains required when configured. Verified the closing placement CTA opens Create account, with no guest bypass; TypeScript lint passes.


## Authentication visual consistency

Updated login and registration presentation only: warm paper background, blue ink, the landing mark, Newsreader display headings, readable DM Sans body text, a soft blue editorial panel, responsive form layout, larger controls, keyboard focus and autofill colors. All existing copy, social providers, fields, reset-password control, validation/status messages, submit handlers and navigation remain intact. Verified login and registration rendering and 390px mobile layout without overflow. TypeScript lint and production build pass.


## Landing registration routing repair

Replaced marketing workspace/practice links that reloaded into automatic placement with explicit `auth=signup` destinations. The app honors registration intent, and session restoration cannot override that intent with placement. Successful onboarding clears the registration URL flag before opening the workspace. Existing in-page mathematics exploration remains available. Verified direct registration URL and landing navigation in Chrome; TypeScript lint passes.


## First load, workspace frame and page system

### Why the landing page stuttered on arrival

Measured on the production build with the CPU slowed four times, on a 10 Mbit connection. "Before" is one run; "after" is the range over three:

| | Before | After |
| --- | --- | --- |
| Entry script | 1,521 kB | 569 kB |
| Largest contentful paint | 4,980 ms | 2,000 to 2,300 ms |
| Time in long tasks before the hero is drawn | about 3,700 ms | 500 to 800 ms |
| Worst single frame after first paint | 1,883 ms | 300 to 500 ms |
| A frame of the hero in software rendering | 400 ms | 67 ms |
| Layout shift | 0.013 | 0 |

Four causes, each fixed where it started:

- **One bundle for everything.** A first visit downloaded and ran the whole app before drawing anything. The entry is now React, the session and a gate; the landing page, the forms, the workspace and each workspace page are separate bundles (`src/App.tsx`, `src/lib/screens.ts`, `src/lib/lazy.ts`).
- **A white page, then a line of text, then the hero.** `index.html` now paints the first frame itself: the landing's night stage for a new visitor, the workspace's desk and sheet for a returning one (`src/boot/boot.ts`). A visitor who cannot be signed in no longer waits for the session check.
- **The entrance started while the browser was busy.** The hero now waits for a painted frame and its two fonts, the chapters below are mounted one per idle moment once it has landed, and three.js is requested after that (`Opening.tsx`, `LandingChapters.tsx`, `chapters.ts`).
- **The frame round the hero repainted the screen on every frame.** It was six masked, blurred rings and two gradients animated by `background-position`. It is now one turning layer and a still veil (`HeroGlow.tsx`, `landing-frame.css`).

Fonts are served from this origin (`src/styles/fonts.css`, generated by `scripts/generate-fonts-css.mjs`) and the two hero faces are preloaded. The content security policy no longer allows any Google font host. DM Sans and Manrope are gone; the app is set in Geist, Newsreader and Geist Mono throughout.

Editing the inline script in `index.html` changes its CSP hash. `server/__tests__/guarantees.test.ts` fails until `THEME_BOOT_SCRIPT_HASH` in `server/security.ts` and the policy in `vercel.json` carry the new one.

### The workspace

Navigation is Home, then three groups in the order a session runs: **Train** (Learn, Exam Archive, Progress), **Compete** (Arena, Leaderboard), **Connect** (Community, Inbox). Profile, Plan and Settings are in the menu under the learner's name. `src/lib/navigation.ts` is still the one list everything renders from.

The frame is `WorkspaceShell.tsx` and `styles/shell.css`: a desk, a sheet, a sidebar that folds to its icons, a sticky top bar. Keys: Ctrl/⌘ K for the palette, G then a letter for a page, S for scratch paper, [ to fold the sidebar. The address follows the page and the open question, so Back, Forward and reload behave.

Pages open the same way through `PageHead` and `styles/page.css`, which also holds the toolbar, chips, segmented control and empty state. Anything that sticks below the top bar should use `top: var(--ws-sticky)`.

### Not verified here

This environment has no Supabase project and no GPU. Signed-in states (the live Inbox, the Community feed, the Arena lobby, the leaderboard table) were checked for layout in the new frame but not with real data, and the frame-time figures are from software rendering, which overstates what painting costs on a real GPU.
