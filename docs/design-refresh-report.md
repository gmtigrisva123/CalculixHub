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
