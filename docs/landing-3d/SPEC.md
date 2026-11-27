# One Thread: build spec for the 3D landing page

> **Status.** Specification only. This step writes no website code.
> **Scope.** The public landing page: `src/components/landing/`, `src/styles/landing-*.css` (except `landing-refresh.css`, which belongs to the sign-in screens), the landing parts of `index.html`, and the few app files the page's first load depends on. Owner decisions are collected in [§18](#18-assumptions-and-open-questions).
> **Reference sizes.** Every number refers to a 1440 × 900 CSS px desktop, or a 390 × 844 phone where a row says so. `vh` means 1 % of the viewport height (9 px on the reference desktop). "S" is the scroll position in vh.
> **Numbering.** Sections 1 to 18 follow the brief's list in order. Section 0 records what exists and what was measured before any decision was made.

## Contents

0. [Starting point](#0-starting-point)
1. [Tech stack](#1-tech-stack)
2. [Architecture](#2-architecture)
3. [Scroll timeline](#3-scroll-timeline)
4. [Hand-offs](#4-hand-offs)
5. [Reversal](#5-reversal)
6. [Page sections and exact copy](#6-page-sections-and-exact-copy)
7. [Interaction design](#7-interaction-design)
8. [Motion system](#8-motion-system)
9. [Performance rules](#9-performance-rules)
10. [Mobile plan](#10-mobile-plan)
11. [Fallbacks](#11-fallbacks)
12. [Accessibility](#12-accessibility)
13. [3D asset list](#13-3d-asset-list)
14. [Loading strategy](#14-loading-strategy)
15. [SEO and sharing](#15-seo-and-sharing)
16. [QA and acceptance criteria](#16-qa-and-acceptance-criteria)
17. [Build order](#17-build-order)
18. [Assumptions and open questions](#18-assumptions-and-open-questions)
- [Appendix A: how the numbers were measured](#appendix-a-how-the-numbers-were-measured)
- [Appendix B: contrast tables](#appendix-b-contrast-tables)

---

## 0. Starting point

### 0.1 The product and the concept

**The product.** CalculixHub is practice for competition mathematics, from AMC to IMO. An adaptive placement engine (IRT, `src/domain/irt.ts`) finds the student's level. After that, every problem fits the level and comes with a hint and a full solution. Around it are an archive of real past papers, live timed contests (the Arena), a tutor that asks guiding questions instead of giving the answer, scratch paper on every screen, and a countdown to race day. The plans are Free, Pro and Team (`shared/plans.ts`).

**The concept, "One Thread".** The page is one continuous scroll in which a single thread of light never breaks. It begins as chaos, the Lorenz attractor. Each scene re-forms that same thread into the next piece of mathematics: a line on paper, the engine's belief curve, the chord problem's circle, chalk dust, the edges of a staircase of exam papers, a pencil line around the card in play, the line a pencil draws, the light round the Pro card, a margin rule, and finally a pencil line that climbs away and blooms into a small butterfly. *Chaos, but it never gets lost.* One fixed WebGL canvas carries the thread. The DOM holds every word and every control.

### 0.2 What exists today

- **Two parts, loaded in turn.** `LandingPage.tsx` renders the nav, `Opening` (hero plus the sheet that slides over it), the ground tones and the footer. `LandingChapters.tsx` mounts the nine chapters below, one per idle moment: Engine, Playground, Topics, Archive, Workspace (`JourneyStack`), Desk, Plans, FAQ, Final. `chapters.ts` lets a link ask for them and wait.
- **Files the brief did not list:** `LandingChapters.tsx`; the data modules `archiveFigures.ts`, `archiveSamples.ts`, `topicRooms.ts`, `chords.ts`, `engineRun.ts`, `particleShapes.ts`, `marginFigures.ts`; seven test files with 25 cases, all passing at the start of this work (`npx vitest run src/components/landing`).
- **Styles.** Six stylesheets are imported in cascade order: margins, experience, frame, desk, plans, motion. `landing-motion.css` loads last and wins.
- **The placement the engine scene replays** (`ENGINE_RUN`, recomputed at import from the real engine and item bank): 13 answers, stopping on precision (`sem` 0.305 ≤ `TARGET_SEM` 0.32), tier **Advanced**, recommended source **AIME**. Three answers are misses (Q6, Q7 and Q9). The estimate briefly reaches Olympiad at Q4 and Q5 before settling.
- **Prices** (`shared/plans.ts`): Pro $9 a month or $72 a year ($6 a month equivalent; yearly saves 33 %); Team $7 a month or $60 a year per student ($5 equivalent), from 5 students.

### 0.3 What stays

These already work and are kept in substance. The 3D serves them and never covers them:

1. **The real engine replay.** Every curve, marker and verdict comes from `simulatePlacement()` over `ITEM_BANK` and the IRT functions. Nothing is drawn by hand.
2. **The interactive chord problem** (drag C or turn the slider; PC × PD stays 189; answer 289; the worked solution).
3. **The four topic rooms**, each with a real archive problem copied verbatim and checked by `archiveSamples.test.ts`.
4. **The scratch paper**, running the workspace's own drawing code (`domain/scratch.ts`).
5. **The countdown**, running the dashboard's own planner (`domain/raceDay.ts`).
6. **Prices and features from `shared/plans.ts`** only; "in the works" for planned features; the checkout-state wording.
7. **The honesty rule.** `ARCHIVE_FIGURES` is checked against the catalogue by `archiveFigures.test.ts`: 2,195 problems, 233 exams, 1959–2026; AMC 12 580, AIME 550, USAMO 540, IMO 525. No user counts, testimonials, logos, press quotes or awards.
8. **The staged loading** (hero first, chapters one per idle moment, three.js last).
9. **The tone-aware nav island** with its sliding pill, its hide-on-scroll-down and its reading line.
10. **The footer reveal**, uncovered rather than scrolled to.
11. **The margin rails** on wide screens, with their ten figures.
12. **The ground tones** and their cross-fade rule.
13. **The motion vocabulary in `kit.tsx`** (GLIDE, the four springs, the pencil underline for `*…*`).
14. **The copy**, word for word (§6).
15. **The brand.** Paper sheets are the ground, ink (night) stages hold the parts that move, and mathematics is drawn as light. The tokens stay as declared in `landing-experience.css`: paper `oklch(96.9% 0.011 84)`, ink `oklch(24.5% 0.028 228)`, accent `oklch(46.5% 0.075 222)`, cyan `oklch(85% 0.095 208)`, brass `oklch(83% 0.12 76)`, cream `oklch(94% 0.055 92)`. The topic colours stay: Algebra `#f3b65b`, Geometry `#46d0b9`, Combinatorics `#a78bfa`, Number Theory `#3dbcf5`. So do the fonts: Geist for display and UI, Newsreader for the serif, Geist Mono for labels and readouts, Caveat for handwritten notes. The only token changes are the contrast fixes in §12.2: five new tokens (one pencil-text colour and four paper-safe topic colours), and the paper-tone nav label made opaque.

### 0.4 Lessons already in the code, and what happens to each

The brief requires every lesson to survive, or to be replaced with a reason. Each one is listed here.

| Lesson (where it lives) | In this spec | Why the change, where there is one |
| --- | --- | --- |
| The hero waits for its display font (capped at 900 ms) and two painted frames before it moves (`Opening.tsx`, `useHeroCue`). | **Kept, and moved earlier.** The same wait runs in the inline boot script in `index.html`, which sets `html[data-cue]`. The entrance is CSS keyed on that attribute (§2.6, §3.3). | The entrance no longer waits for 188 KB gzip of JavaScript. It starts from the HTML, which is what brings LCP under 2.5 s on 4G (§0.6). |
| The chapters mount a moment after the hero lands, one per idle moment, or at once on any sign of leaving the first screen (`LandingPage.tsx`, `LandingChapters.tsx`, `chapters.ts`). | **Kept exactly.** `AFTER_ENTRANCE` (1,350 ms) is now counted from the cue time the boot script records. | — |
| three.js is only requested after the headline has landed and the chapters are in (`useFieldCue`, 5 s patience, `whenIdle` 800 ms). | **Kept exactly**, and extended. Shaders compile with `renderer.compileAsync` in a still moment. Scene props are built one per idle callback, nearest scene first (§13, §14). | — |
| Never animate `background-position` (`HeroGlow.tsx`, `MarginRails.tsx`). | **Kept**, and widened into the full list of what is forbidden during scroll (§9.6). That list now also covers per-frame `mask-image` strings, which the rails write today. | A changed mask string repaints the whole rail. It is the same class of cost as `background-position`. |
| At most two ground washes are visible at a time, as `visibility: hidden` layers, and only opacity changes (`GroundTones.tsx`). | **Kept verbatim.** `toneAt` and its test stay. Only the caller changes: the director (§2.4) replaces `useScroll`. | — |
| Values that change every frame go to the DOM from a single rAF loop (`EngineStory.tsx`, `MarginRails.tsx`). | **Kept, and enforced page-wide.** Today there are six schedulers: Lenis `autoRaf`, motion's batcher, ParticleField's loop, MarginRails' loop, EngineStory's rAF, and the spotlight's rAF. The director (§2.4) makes them one loop, on motion's `frame` batcher. Lenis is driven from its read phase. | One loop gives one read-then-write order per frame. WebGL and DOM then show the same scroll position in the same frame. |
| Software rasterisers (SwiftShader, llvmpipe) are detected and given the 2D fallback (`ParticleField.tsx`, `isSoftwareRenderer`). | **Kept.** Extended with `failIfMajorPerformanceCaveat: true` and a `gl.RENDERER` check (Firefox exposes no debug extension). The 2D fallback now covers every scene (§11.1). | — |
| Render loops pause off screen and when the tab is hidden. | **Kept, and generalised to render-on-demand.** The loop sleeps whenever nothing changes: no scroll, no pointer, no running spring, no idle animation in view (§2.3.6). | A still page now costs no frames at all, not merely no frames while hidden. |
| A device that cannot hold ~30 fps steps down through three quality levels, then throttles (`QUALITY`, `sampleFrame`). | **Kept, and refined** (§9.4). Frames capped at 30 Hz by iOS Low Power Mode are recognised and are not treated as overload. | A low-power iPhone reports steady 33 ms frames. Today's rule would wrongly cut its quality to the floor. |
| Entrances never scale panels that hold SVG, and never blur (`kit.tsx`, `Rise`). | **Kept.** The playground card's tilt is a rotation on a layer promoted only while the pointer is on it (§7.1). | — |
| The final line's tip is only placed while on screen, because `getPointAtLength` forces layout (`FinalStage.tsx`). | **Replaced.** The tip comes from a precomputed arc-length table of the spline (§13). No SVG geometry is read at runtime. | There is no layout read left to schedule around. |
| The rails read `getBoundingClientRect()` on about sixteen elements every frame (`MarginRails.tsx`). | **Replaced** by the director's layout cache (§2.4.3). | A per-frame layout read is cheap only while nothing has dirtied layout. On a busy frame it becomes a forced synchronous layout. |
| Lenis is not created under reduced motion (`smoothScroll.ts`). | **Kept.** Also not created on touch-first devices (`(hover: none)`). | Lenis does nothing for touch (`syncTouch: false`), yet it costs a listener set and a loop. |
| Panels hold their place while counting (`CountUp` reserves the settled width). | **Kept.** | — |

### 0.5 Baseline, measured in this session

Production build (`vite build`), served by `vite preview`, driven by the container's Chromium through Playwright. Method in [Appendix A](#appendix-a-how-the-numbers-were-measured).

**Bundle**

| Piece | Minified | Gzip | Notes |
| --- | ---: | ---: | --- |
| Entry chunk `index-*.js` | 569.6 KB | 170.8 KB | react-dom + react + scheduler ≈ 60.8; Supabase ≈ 59.0 (auth 23.9, realtime 9.7, phoenix 7.7, storage 5.7, postgrest 5.0, client 4.1, iceberg 1.6, functions 1.3); motion ≈ 39.1 (motion-dom 30.6, framer-motion 7.6, utils 0.9); app gate 9.8; Vercel analytics 2.3. The sub-figures are isolated gzip sizes, so they do not add up exactly to the chunk's size. |
| `LandingPage-*.js` | 53.7 KB | 17.5 KB | Lenis 5.5 of it. |
| `LandingChapters-*.js` | 83.9 KB | 28.7 KB | MarginRails 5.6, EngineStory 3.2, ChordPlayground 3.4, TopicBoards 2.9, DeskSection 3.0, JourneyStack 2.7. |
| `MathText-*.js` (KaTeX) | 262.3 KB | 78.3 KB | Pulled in by the chapters for formulas that are all constant strings. |
| `itemBank-*.js` (bank + IRT) | 18.0 KB | 6.4 KB | Shared with the forms. |
| `three.module-*.js` | 518.0 KB | 131.2 KB | Named imports do not tree-shake much: today's 15 classes cost 118.8 KB gzip in an esbuild bundle. |
| `ParticleField-*.js` | 11.6 KB | 5.3 KB | |
| CSS: `index-*.css` / `LandingPage-*.css` | 154.6 / 100.4 KB | 32.3 / 21.2 KB | |
| Fonts | | | Geist latin 29.4 KB (preloaded); **Newsreader italic 146.9 KB (preloaded, but the hero no longer uses it)**; Geist Mono 23.1 KB; Caveat 74.9 KB. |

**Vitals**

| Profile | FCP | LCP | CLS | Long tasks | Transfer |
| --- | ---: | ---: | ---: | --- | ---: |
| Phone: 412 × 823, Slow 4G (150 ms RTT, 1.6 Mbps down), CPU 4× slower | 1,636 ms | **3,588 ms** (element `.lx-hero-grain`, a data-URI noise background) | 0 | 19 in the first 12 s; longest 381 ms; 3.9 s in total | 577 KB |
| Desktop: 1440 × 900, 10 Mbps / 40 ms, no CPU throttle | 648 ms | 948 ms | 0 | 9; longest 74 ms | 554 KB |

**While scrolling** (1440 × 900, CPU 4× slower, after every chapter had mounted; mouse wheel 100 px every 40 ms over the whole 19,723 px page): 67 long tasks, the longest 108 ms. Frame interval p50 33 ms, p95 67 ms, p99 100 ms. This container rasterises on the CPU (SwiftShader), so the hero ran its 2D fallback and the frame times are pessimistic. The long-task count is a main-thread fact.

### 0.6 Problems found, and where each is fixed

| # | Problem | Evidence | Fixed in |
| --- | --- | --- | --- |
| P1 | LCP fails on 4G. | 3,588 ms on the phone profile, against a 2,500 ms target. The hero cannot paint until 188 KB gzip of JS and 53 KB gzip of CSS have arrived and run. | M1: static first frame (§2.6) |
| P2 | A 146.9 KB font is preloaded for nothing. | `index.html` preloads Newsreader italic "for *question*". `.lx-hero-title em` is now Geist, cyan, with a pencil stroke. | M1 |
| P3 | Supabase (≈ 59 KB gzip) sits on the critical path of visitors who cannot be signed in. | `AuthProvider` already knows such a visitor is `anonymous` synchronously (`sessionMayExist()`), yet the client is in the entry chunk. | M11 (needs the owner's agreement, §18) |
| P4 | KaTeX's 78.3 KB gzip is loaded for constant formulas. | Every formula on the landing is a literal in `topicRooms.ts`, `archiveSamples.ts`, `ChordPlayground.tsx`, `JourneyStack.tsx` or `MarginRails.tsx`. | M3: typeset at build (§14.3) |
| P5 | Six schedulers, and layout reads during scroll. | `MarginRails` calls `getBoundingClientRect()` about sixteen times per frame and writes `mask-image` strings. `useSpotlight` reads a rect on every pointer move. `FinalStage` calls `getPointAtLength`. | M2: director |
| P6 | Three contrast failures. | `pencil` text reaches 4.24–4.46:1 on parchment, dusk and lamplight. Paper-tone nav labels reach 4.18:1 (3.71:1 over a stage edge). The topic colours used as marks on paper reach 1.65–2.49:1, against 3:1 for non-text. ([Appendix B](#appendix-b-contrast-tables)) | M2: tokens (§12.2) |
| P7 | With JS off, a visitor or crawler sees only the night cover. | `#root` ships empty, and `#boot` never lifts without script. | M1: static reading copy (§11.4) |
| P8 | A finger that lands on the scratch paper cannot scroll the page. | `.lx-desk-canvas { touch-action: none }` across the whole sheet. | M8: arm-to-draw (§7.4) |
| P9 | Covered workspace cards keep looping. | `useLoop` uses `useInView(…, { amount: 0.4 })`, which is still true under the pile. | M8 |
| P10 | The three.js types are ahead of the runtime. | `@types/three` 0.185.4 against `three` 0.180.0. | M4: pin the types to 0.180.x |

---

## The concept, as rules

The brief's section 1 is the creative direction. These rules turn it into decisions that can be checked.

1. **One thread, one canvas.** A single particle thread (`Thread`, §2.3.4) lives for the whole visit. It changes shape. It is never destroyed and rebuilt between scenes, except for a deliberate fade on a long jump (§5.3).
2. **The DOM owns meaning.** Every word, number and control is DOM text or a DOM control. WebGL draws light, paper and objects. If WebGL fails, nothing a visitor must read or press is lost (§11).
3. **Points are matched by their place along the thread.** Each particle keeps its parameter *u* ∈ [0, 1) for life. Every shape is a curve *C(u)*, so a morph is the thread being pulled into a new shape, never particles swapping places (§4.1).
4. **Light on ink, graphite on paper.** On a night stage the thread is additive light. On paper it is graphite or ink. The change is continuous, per fragment, inside one draw call (§4.1.4).
5. **Every effect has a reason in the story.** The table below lists them. Anything without a reason is cut, and the cuts are listed too.

| Effect | Its reason in the story |
| --- | --- |
| Lorenz thread, warm where fast, cool where slow | The hardest question is chaotic but bounded. It never leaves the butterfly. |
| Assembly out of a wide shell | A thought gathering itself as you arrive. |
| Pointer swirl and parallax in the hero | You can stir the problem, but you cannot knock it off its path. |
| Page curl and contact shadow on the sheet | The paper is a real sheet laid over the work. |
| The butterfly drained onto the sheet as one straight line | A messy first attempt becomes a straight line: the axis of difficulty. |
| Belief ribbon, falling beads, glass tier slabs | The engine's own state: belief narrowing, evidence landing, tiers. |
| Camera tilt at the verdict | Looking along the axis to where you stand on it. |
| The peak bending into a circle in light | The answer to one question becomes the next problem. |
| Card tilt and sheen | The problem card is an object in your hands. |
| Chalk dust, the glyph's shudder and ring | The board answers your attempt, kindly. |
| Ghost formulas on three depth layers | The board has a history: earlier lessons were rubbed out, and they sit behind today's chalk. |
| Exam stacks as a staircase | Difficulty is a climb, and every sheet on it is a real paper. |
| Marquee speed and skew | The archive is vast: the faster you go, the more rushes past. |
| The pile's tip-back | Paper under paper: earlier work stays under the new. |
| Pencil outline round the top card | It marks the card in play, the only one whose picture moves. |
| The pencil riding the triangle | The thread is the pencil's line. Scratch paper is where the thread gets drawn. |
| Lamp cone | The desk the night before a contest. It also points the eye at the paper. |
| The sheet flattening when you draw | Function: exact pointer mapping. |
| Pro raised, with the hero's light round its edge | The light that framed the question now frames the season's plan. |
| FAQ margin line with a loop | On ruled paper, the margin marks your place: here, the open answer. |
| Final tube receding, dipping, ending higher | Progress goes into the distance and is rarely straight. |
| Mini butterfly at the tip | The page ends where it began: with the next question. |
| Footer curl | The sheet lifts, and under the work is the signature. |

**Cut, because each would only be decoration:** bloom and every post-processing pass, a custom or trailing cursor, particle trails on the pointer, WebGL text of any kind, ambient floating shapes, gyroscope parallax, sound, and a preloader screen.

---

## 1. Tech stack

The starting point is what `package.json` already ships: React 19.2, Vite 6.4, TypeScript 5.8, three r180, motion 12.42 and Lenis 1.3.26. **This spec adds no runtime dependency.** It adds one dev dependency (`@playwright/test`, §16) and pins one dev dependency (`@types/three`).

Every size below was measured in this session: a minified esbuild bundle of only the APIs the spec would use, gzip level 9, with packages the page already ships (three, react) marked external ([Appendix A](#appendix-a-how-the-numbers-were-measured)).

| Layer | Recommendation | Why, in one line | Added to the bundle (gzip) |
| --- | --- | --- | --- |
| UI framework | React 19.2 and TypeScript 5.8 (keep). | Already the app; the landing must share its runtime with the sign-in flow it opens. | 0 |
| 3D | **three r180, imperative**, one renderer (keep the version). | The thread is driven by uniforms on every frame. Imperative three keeps that loop outside React's render cycle, the way `ParticleField.tsx` already works. | 0 for the classes used today (131.2 KB gzip is already shipped). The extra classes this spec needs add **≈ 11.7 KB**: `InstancedMesh`, `InstancedBufferAttribute`, `ExtrudeGeometry`, `Shape`, `TubeGeometry`, `CatmullRomCurve3`, `PlaneGeometry`, `BoxGeometry`, `HalfFloatType` (esbuild: 118.8 → 130.5 KB). |
| 3D, rejected | @react-three/fiber 9.8.2 | It reconciles a scene graph we already drive imperatively, and brings its own reconciler. | would add 56.6 KB |
| 3D, rejected | @react-three/drei 10.7.9 `MeshTransmissionMaterial` for the glass slabs | Needs R3F, and renders a transmission target every frame (a second scene pass). | would add 4.8 KB, plus R3F |
| Scroll orchestration | **The in-house director** (§2.4) on motion's `frame` batcher (`frame.read / update / render`, exported by `motion/react`). | One loop with one read-then-write order: Lenis, DOM and WebGL see the same scroll value in the same frame. Pins stay native CSS `position: sticky`. | ≈ 4 KB (estimate; within the landing-shell budget in §9.2) |
| Scroll, rejected | GSAP 3.15.1 with ScrollTrigger | It pins with `position: fixed` and pin-spacers, which fights sticky, Lenis and the mobile address bar. Its own ticker would be a second loop. | would add 44.4 KB (core alone 27.2) |
| Smooth scroll | **Lenis 1.3.26** (keep), with `autoRaf: false`, driven from the director's read phase. `syncTouch: false`. Not created for reduced motion or on `(hover: none)` devices. | It smooths the wheel and keeps native scrolling, so find-in-page, the keyboard and the scrollbar keep working. | 0 (5.5 KB gzip as bundled today) |
| DOM animation | **motion 12.42** (keep), with `LazyMotion` + `domMax` as `MotionProvider` sets up. | Springs, `AnimatePresence` and shared layout (the nav pill, the billing thumb) are already written on it. | 0 (≈ 39 KB gzip already in the entry) |
| Text in 3D | **None.** All text is DOM. Labels that must sit on 3D objects are DOM elements placed by projection (§2.4.4). | The brief requires nothing readable to live only in WebGL. DOM labels stay crisp, selectable, translatable and accessible. | 0 |
| Text, rejected | troika-three-text 0.52.5 | It builds SDF glyphs in a `blob:` worker, which the site's CSP (`worker-src 'self'`) refuses, and it fetches font files at runtime. | would add 42.5 KB, plus fonts |
| Text, rejected | Geist converted to MSDF | Nothing on the page needs to be read inside WebGL, so an atlas of 200 KB or more buys nothing. | would add ≥ 200 KB |
| Post-processing | **None.** Glow is the point shader's own halo on additive blending. Grain and vignette stay CSS. | Bloom would cost 5–7 full-screen passes per frame at a DPR of up to 2. That fill rate is the single biggest risk to mid-range phones. | 0 |
| Post, rejected | postprocessing 6.39.6 (composer, bloom, noise, vignette) | As above. | would add 16.5 KB |
| Post, rejected | three's `EffectComposer` + `UnrealBloomPass` + `OutputPass` | As above. | would add 4.4 KB |
| Math typesetting | **KaTeX 0.18.1 at build time** for every landing formula, served as prebaked HTML. Only `katex.min.css` ships (fonts load on demand). | Every landing formula is a constant string. | **−78.3 KB** JS from the landing path; +3.4 KB gzip CSS |
| Shaders | GLSL files imported with Vite's `?raw`. | Readable shaders, no tooling. | 0 |
| Build tool | **Vite 6.4** (keep), plus two build steps: the static first frame (§2.6) and the math prebake (§14.3). Both run in Node on React's own `react-dom/server`. | No new tool; the steps are ordinary scripts in `scripts/`. | 0 |
| Unit tests | vitest 3.2 (keep, `environment: 'node'`). | Every new pure function (`engineFrame`, `threadState`, paths, layout maths) is tested here. | 0 |
| Browser tests | **@playwright/test**, pinned to the `playwright` version `qa/` uses (^1.56). | Visual, vitals, fallback and accessibility passes (§16). | 0 (dev only) |
| Types | Pin **`@types/three` to 0.180.x**. | Today the types are 0.185.4 against a 0.180.0 runtime, so code can type-check against APIs that do not exist at runtime. | 0 (dev only) |

---

## 2. Architecture

### 2.1 Component and file map

```text
src/components/landing/
├── LandingPage.tsx         shell: takes over the static first frame, staged mounting, hosts <Stage/>   (changed)
├── LandingChapters.tsx     one chapter per idle moment                                              (kept)
├── chapters.ts             chapter demand and arrival promises                                       (kept)
├── smoothScroll.ts         Lenis, now ticked by the director; scrollToTarget, setScrollLocked       (changed)
├── kit.tsx                 motion vocabulary; adds DURATION, STAGGER, SPRING.tilt, useTilt;          (changed)
│                           static-mode and CSS-entrance paths; SIGNUP_HREF, linkAction
├── staticMode.tsx          NEW (M1): the static-render context the build renders the first frame in
├── entrance.ts             NEW (M1): the cue, the takeover's resume point, the count-up rule
├── copy.ts                 NEW: every visible string; one source for the live page, the static
│                           page, JSON-LD and the honesty test
├── Opening.tsx             hero + sheet, split into surface and content layers (§2.5)                (changed)
├── HeroGlow.tsx            the pearl frame, CSS                                                      (kept)
├── EngineStory.tsx         engine DOM; the SVG chart becomes the fallback and the a11y image         (changed)
├── ChordPlayground.tsx     card tilt and sheen, live readout                                         (changed)
├── TopicsChapter.tsx       glyph slots, ghost depth layers                                           (changed)
├── TopicBoards.tsx         chalk drawings                                                            (kept)
├── ArchiveLadder.tsx       marquees + the pinned staircase track; vertical ladder ≤ 900 px           (changed)
├── JourneyStack.tsx        the pile: CSS 3D tip-back; visuals loop on the top card only              (changed)
├── DeskSection.tsx         three-quarter desk, flatten-on-draw, arm-to-draw on touch                 (changed)
├── PlansSection.tsx        Pro raised, pearl tube in CSS                                             (changed)
├── FaqSection.tsx          margin-line anchor                                                        (lightly changed)
├── FinalStage.tsx          the SVG line becomes the fallback of the 3D tube                          (changed)
├── LandingFooter.tsx       curl anchor                                                               (lightly changed)
├── LandingNav.tsx          tone, pill and hiding from the director                                   (changed)
├── MarginRails.tsx         on the director; no per-frame layout reads or mask strings                (changed)
├── GroundTones.tsx         on the director; toneAt kept                                              (changed)
├── ParticleField.tsx       RETIRED in M4: absorbed by stage/thread
├── archiveFigures.ts, archiveSamples.ts, topicRooms.ts, chords.ts,
│   engineRun.ts, particleShapes.ts, marginFigures.ts      data, with their tests                   (kept)
├── director/
│   ├── director.ts         the one loop: read → update → render; wake and sleep
│   ├── layout.ts           cached geometry of scenes and anchors; the svh probe
│   ├── scenes.ts           the scene table: ranges, tones, nav tone, idle flags (§3)
│   ├── engineFrame.ts      pure: playhead → curve step, YOU, meter, tier, beat, answered
│   ├── threadState.ts      pure: page progress → thread uniforms (§4)
│   └── useScene.ts         React bridge: MotionValues the director feeds
├── stage/
│   ├── Stage.tsx           mounts the one canvas, lazy-loads the engine
│   ├── capability.ts       WebGL2, software rasteriser, Save-Data, reduced motion → mode and tier
│   ├── renderer.ts         renderer, DOM-matched camera, governor, compile, context loss
│   ├── projection.ts       DOM rect ↔ world; 3D anchor → DOM transform
│   ├── fallback2d.ts       the 2D painter (from today's drawFallback)
│   ├── thread/             thread.ts, paths.ts (pure, tested), thread.vert.glsl, thread.frag.glsl
│   └── props/              sheetCurl.ts, belief.ts, chalk.ts, stacks.ts, desk.ts, finale.ts
├── static/
│   ├── LandingReading.tsx  the reading version, for no-JS visitors and non-JS crawlers
│   ├── jsonLd.ts           the page's structured data, from copy.ts and PLANS (§15.4)
│   └── entry-static.tsx    build entry: the first frame + the reading version
└── math/
    └── prebaked.ts         consumes virtual:landing-math; <PrebakedMath/> replaces MathText here

scripts/landing-static-plugin.mjs  Vite plugin: writes the static first frame into dist/index.html (§2.6)
scripts/landing-math-plugin.mjs    Vite plugin: typesets every landing formula at build (§14.3)
qa/landing/                        Playwright: visual, vitals, fallbacks, a11y; budgets.json (§16)
```

### 2.2 Scenes and the files they live in

| # | Scene | DOM (existing file) | Stage module | What changes |
| --- | --- | --- | --- | --- |
| 1 | Hero, "The Butterfly" | `Opening.tsx` (`Hero`), `HeroGlow.tsx` | `thread` (Lorenz, shell intro) | Surface and content split; CSS entrance; parallax ±5° / ±3°; curl-noise swirl. |
| 2 | The Idea, "The Sheet" | `Opening.tsx` (`Manifesto`) | `props/sheetCurl`, `thread` (rule line) | Page-curl lip and contact shadow; the thread becomes the foot rule. |
| 3 | Engine, "The Curve" | `EngineStory.tsx`, `engineRun.ts` | `props/belief` (ribbon fill, beads, slabs), `thread` (curve) | Pinned 400 vh; DOM labels by projection; the SVG becomes the fallback. |
| 4 | Playground, "The Circle" | `ChordPlayground.tsx`, `chords.ts` | `thread` (circle) | Light circle beneath the SVG circle; card tilt and sheen; "always 189" pulse. |
| 5 | Topics, "The Chalkboard" | `TopicsChapter.tsx`, `TopicBoards.tsx`, `topicRooms.ts` | `props/chalk` (glyphs, ring), `thread` (dust) | 3D glyphs; dust bursts and swirl; ghost depth layers. |
| 6 | Archive, "The Staircase" | `ArchiveLadder.tsx`, `archiveFigures.ts`, `archiveSamples.ts` | `props/stacks`, `thread` (stair edges) | Pinned horizontal track; top-sheet lift; DOM sample cards. |
| 7 | Workspace, "The Pile" | `JourneyStack.tsx` | `thread` (arrives at card 1, leaves from card 4) | CSS 3D tip-back; the DOM pencil outline on the top card; visuals loop on the top card only. |
| 8 | Desk, "Lamplight" | `DeskSection.tsx` | `props/desk` (pencil, lamp cone), `thread` (into the pencil) | Three-quarter view; flatten-on-draw; arm-to-draw on touch; track FLIP. |
| 9 | Plans, "Three Sheets" | `PlansSection.tsx` | `thread` (Pro perimeter) | Pro raised; CSS pearl tube; the thread's arrival. |
| 10 | FAQ | `FaqSection.tsx` | `thread` (margin line) | The margin line loops at the open answer. |
| 11 | Final, "The Line" | `FinalStage.tsx` | `props/finale` (tube, tip light), `thread` (mini Lorenz) | The 3D tube replaces the SVG line (kept as the fallback). |
| 12 | Footer, "Uncovered" | `LandingFooter.tsx`, `LandingPage.tsx` (`.lx-content`) | `props/sheetCurl` (bottom lip) | The lower edge curls as it lifts. |
| — | Nav, rails, ground | `LandingNav.tsx`, `MarginRails.tsx`, `GroundTones.tsx` | — | All three are fed by the director. The left rail gains the chapter number (§6.14). The right rail's ten figures (Lorenz → Gaussian bell → hyperboloid → circle and chords → trefoil knot → double helix → Möbius strip → tesseract → torus → sphere) are kept. |

### 2.3 One renderer, one canvas

#### 2.3.1 The canvas

- One `<canvas class="lx-stage" aria-hidden="true">`. It is created once by `Stage.tsx` as a child of `.lx-content`, with `position: fixed; inset: 0; z-index: 3; pointer-events: none`, and it lives for the whole visit (§2.5).
- Context: `new WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false, powerPreference: 'default', failIfMajorPerformanceCaveat: true })`.
  - `powerPreference: 'default'` replaces today's `'high-performance'`. On dual-GPU laptops, `'high-performance'` wakes the discrete GPU for a landing page. That costs battery, and on macOS the GPU switch can lose the context. The tier-A budget (§9.2) is set for integrated GPUs (M1, Iris Xe) anyway.
  - `antialias: false`: points and thin lines carry their own soft edges, and MSAA would multiply fill cost.
- Clear colour transparent. `renderer.autoClear = true`. The canvas clears once and stops drawing when no scene shows the thread.
- three r180 requires WebGL2, so a browser without WebGL2 gets the 2D fallback (§11.1).

#### 2.3.2 The camera: one DOM-matched perspective

There is a single `PerspectiveCamera` whose world unit is one CSS pixel.

- The plane `z = 0` is the screen. A DOM point at viewport `(x, y)` is world `(x, −y, 0)` exactly.
- Distance `D = max(1000, 1.25 × innerHeight)` px. `fov = 2 · atan((innerHeight / 2) / D)`. Position `(vw/2, −vh/2, D)`, looking at `(vw/2, −vh/2, 0)`. Recomputed only on resize.
- **"Camera moves" are rig transforms on a scene's group, never moves of the camera.** The engine's dolly, the archive's climb and the hero's orbit parallax rotate or translate their own group. Because the camera never moves, DOM-attached objects (the circle under the SVG, the stacks under their DOM labels, the pencil on the sheet) stay aligned at no extra cost. DOM labels on rigged objects follow by projection (§2.4.4).

#### 2.3.3 Scene graph

```text
scene
├── thread           Points: the one thread, always present (one draw call)
├── props.sheet      the curl lip and contact shadow, top edge (scene 2) and bottom edge (scene 12)
├── props.belief     ribbon fill mesh, beads (instanced quads), tier slabs (instanced boxes)   scene 3
├── props.chalk      four extruded glyphs and the ring                                        scene 5
├── props.stacks     instanced sheets, four top sheets                                        scene 6
├── props.desk       pencil, lamp cone                                                        scene 8
└── props.finale     tube, tip light                                                          scene 11
```

A prop group is `visible` only while its scene, or a hand-off that involves it, intersects the viewport (§3). Hidden groups cost nothing per frame. Programs: thread, ribbon fill, bead, slab, chalk, paper (stacks and the curl lip share it, with a mode uniform), pencil, cone, tube: nine in all, compiled together (§9.5).

#### 2.3.4 The thread and its state machine

**Particles.** Today's layout, kept. `flowLayout(threads, dust)` gives each particle `aParam = (u, speed k, seed s, stray r)` and `aOffset` (a unit vector). The records are shuffled, so any prefix is an even sample: the governor can draw fewer without the form thinning unevenly. Counts per tier are in §9.2.

**Shapes are curves.** Every scene's form is a curve `C(u)`, stored as a **path texture**: P samples of RGBA, with xyz plus a scalar (speed, weight or heat). Particle *i* sits at `C(u_eff,i) + aOffset·stray`. The two shapes of a hand-off are bound together as `uPathA` and `uPathB`.

| Path | Samples | Format | Built from |
| --- | ---: | --- | --- |
| Lorenz | 16,384 | RGBA32F (256 KB GPU) | `lorenzPath()` (kept) |
| rule, circle, stair edges, card outline, Pro perimeter, margin line, final tube, mini Lorenz | 2,048 each | RGBA16F (16 KB each) | `stage/thread/paths.ts` (pure, tested) |
| belief | 81 × 14 | R32F (4.5 KB) | every posterior step of `ENGINE_RUN`, uploaded once; the shader blends rows *k* and *k + 1* |

Three shapes are procedural in the shader, with no texture: the **shell** (today's intro scatter), **dust** (board-plane scatter from the seed), and **rest-at-point** (gathered into a pencil tip).

**Flow.** `u_eff = fract(u + φ · k)`. The flow phase φ is integrated on the CPU (φ += dt · flowSpeed). When a shape stops flowing, φ simply stops growing. Nothing jumps, and the next shape receives the same `u_eff` (§4.1.1).

**States.** The state is a pure function of page progress *p*, plus time for the three time-based states:

```text
Intro      ── time, 2.6 s from the first rendered frame (today's assembly) ──► Rest(1)
Rest(k)    ── p enters hand-off window k→k+1 ──► HandOff(k, k+1, m), where m = window-local progress
HandOff    ── m reaches 1 ──► Rest(k+1)        ── m back to 0 ──► Rest(k)
Teleport(k)── a journey across more than one hand-off: fade out 250 ms, set A = B = k, fade in 600 ms
```

**Uniforms** (all written by the director in the update phase):

| Group | Uniforms |
| --- | --- |
| Shapes | `uPathA`, `uPathB`, `uKindA`, `uKindB` (0 path, 1 shell, 2 belief, 3 dust, 4 rest-at-point), `uXformA`, `uXformB` (mat4: path space → world, so a unit path can sit on any DOM rect), `uRevealA`, `uRevealB` (0–1: particles with *u* beyond it wait, faded, at `C(reveal)`; used for the stairs and the final tube) |
| Morph | `uMorph` (0–1), `uOrder` (0 by *u*, 1 by seed, 2 by distance from `uOrigin`), `uSpread` (stagger width, default 0.35), `uCarry` (vec3 amplitude of the mid-flight lift), `uOrigin` |
| Flow and time | `uFlowPhase`, `uFlowA`, `uFlowB`, `uTime`, `uIntro`, `uFade` |
| Pointer | `uPointer` (NDC), `uPointerPower`, `uAspect` |
| Light vs graphite | `uAdditiveA`, `uAdditiveB` (1 light, 0 graphite), `uPaperRects[2]` with `uPaperRadius` (fragments over these rects turn graphite) |
| Masks | `uOccluders[2]` with `uLip` (stage-layer fragments inside are discarded), `uClip` with `uClipRadius` (stage panel), `uSafe[2]` (text-safe zones, §12.2) |
| Belief | `uBelief` (sampler), `uBeliefStep` (*k* + *t*), `uChart` (rect), `uThetaRange`, `uPeak`, `uCurveH` |
| Burst | `uBurstOrigin`, `uBurstTime`, `uBurstShare` (the share of particles, by seed, that take part) |
| Palette | `uCool`, `uWarm`, `uEdge`, `uGraphite`, `uAccent`, `uChalk`, `uPearl[5]`, read once from CSS custom properties (as `readColor` does today) |

#### 2.3.5 Clipping and occlusion

- **Scissor.** The canvas is scissored to the visible part of `.lx-content` (it starts lifting at S = 2,620), plus the height of the bottom curl lip. The thread never paints over the footer.
- **Stage clip.** While the thread is "on a stage", fragments outside the stage's rounded rect (`uClip`, from the cached rect and the stage's current transform) are discarded. In a hand-off, the clip is the union of the source and target regions.
- **Occluders.** When paper slides over a stage (the sheet over the hero), the sheet's screen rect and its curl lip are passed as occluders. A fragment discards inside an occluder in proportion to `1 − t_i`: particles still in the hero vanish under the paper, and particles already pulled onto the paper stay.
- **Text-safe zones.** `uSafe` rects (the hero copy column, the engine copy column) multiply fragment alpha by 0.25, so light behind text never lifts the background above the contrast limit in §12.2.

#### 2.3.6 Render-on-demand

The director renders a WebGL frame only when one of these is true:

1. the scroll value changed this frame (Lenis animating or native scrolling);
2. the pointer moved inside a scene with pointer response (hero, topics glyphs, desk lamp);
3. a spring is unsettled (stage arrival, the final line, glyph tilt), or a timed effect is running (intro, burst, ring, teleport fade);
4. the visible scene has idle motion (`idle: true` in `scenes.ts`: the hero's flow, the chalk glyphs' bob, the Pro perimeter flow, the mini butterfly) and reduced motion is off.

When none is true for two frames, the loop stops scheduling itself. It wakes on `scroll`, `wheel`, `pointermove`, `resize`, Lenis's `scroll` callback, `visibilitychange` and interaction events. Idle-only scenes on tier C render at 30 fps (every other frame). When the tab is hidden, nothing runs.

### 2.4 The director: one loop for DOM and WebGL

#### 2.4.1 One loop, three phases

The director registers on motion's `frame` batcher, so its work and motion's own animations share the same phases of the same animation frame:

| Phase | Work | Allowed DOM access |
| --- | --- | --- |
| `frame.read` | `lenis.raf(timestamp)` when Lenis is on; read `lenis.animatedScroll` (or `window.scrollY` once when native); fold in the pointer samples cached by passive listeners. | One `scrollY` read. No geometry reads. |
| `frame.update` | Per-scene local progress from the layout cache; `engineFrame()`; `threadState()`; springs; nav state (tone, active chapter, hidden); ground-tone opacities; rail values; label projections; `MotionValue.set()` for React consumers. | None (pure computation). |
| `frame.render` | Writes, each only when its rounded value changed: CSS custom properties, transforms, opacities, `textContent`. Then one `renderer.render()` if the WebGL frame is dirty. | Writes only. |

Lenis is constructed with `autoRaf: false` and ticked in the read phase, before any write, so its `scrollTo` never forces a layout.

#### 2.4.2 Inputs

- **Scroll:** one value per frame. Velocity is smoothed with the existing spring (damping 40, stiffness 300) and feeds the marquee skew and speed (§3.3).
- **Pointer:** `pointermove` (passive) stores `clientX`, `clientY`, `pointerType` and a timestamp. Mouse only for parallax; any pointer type for drag.
- **Time:** motion's `frameData.delta`, clamped to 50 ms (as today).
- **Layout:** the cache (§2.4.3).
- **Pulses:** interaction events posted by components: `topic:wrong`, `topic:right`, `chord:drag`, `desk:draw`, `plans:enter`. The director starts the timed effects for them.

#### 2.4.3 The layout cache

- Every scene's geometry is measured on its `<section>`, which is never sticky: `top = rect.top + scrollY`, plus `height`. Anchors (the chart rect, the SVG circle, the stack slots, the card rects, the FAQ list, the tube box) are measured relative to their section.
- **Re-measured** when a `ResizeObserver` on `main` fires (chapters mounting, an FAQ answer opening, fonts arriving); on `document.fonts.ready`; on `chaptersMounted()`; and on `resize`, debounced 150 ms. On coarse-pointer devices, a resize that only changes `innerHeight` by less than 15 % is the address bar: it updates the viewport height used for progress offsets and nothing else.
- **svh probe.** A hidden element of `height: 100svh` is measured on resize. All `vh` offsets in scene ranges use the small-viewport height, so progress does not jump when the address bar moves.
- The rails' "stage bands" and the nav's "ground under the island" are derived from this cache. Neither reads the DOM during scroll.

#### 2.4.4 Outputs

1. **MotionValues for React.** `useScene(id)` returns `{ progress, arrival, cover, … }` MotionValues set by the director. Existing components keep their `useTransform` code: `useScroll({ target, offset })` is replaced by `useScene` with the same offset semantics. This keeps the rewrite of `Opening`, `EngineStory`, `JourneyStack`, `FinalStage` and `LandingFooter` small.
2. **CSS custom properties** on a scene root (`--p`, `--arrive`, `--tone`) for the CSS that reads them.
3. **Uniforms** (§2.3.4).
4. **Projected DOM labels.** A label anchored to a 3D point (the engine's YOU marker, the axis ends, the tier names, an archive stack's label block) gets `transform: translate3d(x, y, 0)` from `projection.ts`. Its 3D point is projected with the same camera and rig matrices used to render that frame. Text and object therefore move together, frame for frame.

#### 2.4.5 Attached and floating objects under native scroll

With Lenis (wheel, trackpad), scrolling happens on the main thread inside the director's read phase, so DOM and WebGL are exactly in step. With native scrolling (touch momentum, the scrollbar, the keyboard, find-in-page), the compositor can show a scroll offset one frame before the main thread draws WebGL for it. The spec therefore sorts every 3D object into one of two kinds:

- **Floating** objects have no hard edge against the DOM: the thread in flight, the butterfly, dust, the glyphs, the lamp cone, the tube. A one-frame lag is invisible on them, and they run everywhere.
- **Attached** objects must line up with a DOM edge: the circle under the SVG circle, the curl lips, the card outline, the Pro perimeter, the stacks. They are attached only while their scene is **pinned** (sticky, so stationary on screen) or while Lenis is driving the scroll. Otherwise (a touch device scrolling an unpinned scene) the attached shape fades out over 150 ms and the DOM version carries the moment alone. §3.3 and §4.2 say which applies where.

#### 2.4.6 Test hooks

`window.__LX_TEST__` (set by Playwright's `addInitScript`, never by the page) can do five things: freeze the clock (time derived from progress); seed every random source (the rails use `Math.random` today and move to `mulberry32`); skip the entrance to its end state; mount all chapters at once; and resolve `settled()` after two frames with no unsettled spring. The production cost is one property check at start-up.

### 2.5 The layer contract

Inside `.lx-content` (`position: relative; z-index: 1; isolation: isolate`, the only stacking context between `.lx` and the layers):

| z-index | Layer | Members |
| ---: | --- | --- |
| auto | Sheet paper | `.lx-content`'s own background |
| −1 | Ground | `.lx-ground` tones (sticky, as today) |
| 0 | Paper surfaces | each section's paper and the sheet's paper; **the hero's night surface** (the one ink stage at 0, so the sheet can cover it in DOM order) |
| 1 | Margin rails | `.mr` (sticky). Above paper, below ink stages, so the stages cover the rails with no mask at all. During the opening the rails sit in a moving clip whose top is the sheet's edge. |
| 2 | Ink surfaces | the engine, topics, desk and final stage panels; the paper of objects that the 3D must sit on (the scratch sheet's paper) |
| 3 | **Stage canvas** | `canvas.lx-stage` (fixed) |
| 4 | Content | all text, controls, SVG figures, DOM labels, and the hero's vignette, grain and shade overlays |

Outside `.lx-content`: the nav (50), the mobile menu (60), the film grain `.lx::after` (90), the skip link (100). The footer sits below `.lx-content` (z 0 in `.lx`).

The brief puts the canvas "fixed behind the DOM". Here, that means behind every element that carries content (text, controls, figures, labels), which is all of layer 4. It sits in front of the surfaces it lights, because a canvas behind an opaque night panel could not be seen at all. Surfaces are backgrounds, never content, so nothing a reader needs is ever under the thread.

**Rules**

1. No element between `.lx-content` and a layer element may create a stacking context. That rules out `transform`, `filter`, `opacity < 1`, `will-change`, `isolation`, `contain: paint`, `mix-blend-mode`, and `z-index` on a positioned element. Sections are plain containers.
2. A stage that is sticky or transformed is split into a **surface** element and a **content** element. They are siblings, each sticky with `top: 0; height: 100svh`, the content pulled up with `margin-top: -100svh`. The director writes the same transform to both.
3. Where paper must cover content that sits higher in the z-order (the sheet over the hero's words), that content lives in a **moving clip**: a window with `overflow: clip`, translated by −d, whose inner layer is translated by +d. The clip edge then moves using transforms alone, with no clip-path and no repaint.
4. The canvas never draws stage light over paper that covers the stage (occluders, §2.3.5), and it never draws below `.lx-content` (scissor).
5. **Surface twins.** Any transform, including a `Rise` entrance or a tilt, makes an element a stacking context, which keeps its background and its content together on one side of the canvas. A card whose face must sit *under* the thread while its content sits *over* it is therefore rendered as two elements. Its **face** sits in the surface layer (z 2) at the card's cached rect, and its **content** sits in the content layer (z 4) with a transparent background. Both get their `y`, `rotateX`, `rotateY` and `transformPerspective` from the same MotionValues, so motion writes identical transforms to both in the same frame. Two cards need it: the playground's problem card (the light circle lies beneath its SVG circle) and the desk's scratch sheet (the pencil lies above its paper and below its strokes). Every other card stays whole in the content layer. The thread then passes behind it, or hands its shape to a DOM twin (the Pro tube, the workspace outline).

A split stage, as markup:

```html
<section id="engine" class="lx-engine" aria-labelledby="lx-engine-title">     <!-- plain: no z-index, no transform -->
  <div class="lx-engine-surface" aria-hidden="true"></div>                     <!-- sticky; z-index: 2; night panel -->
  <div class="lx-engine-layer"> … heading, beats, readouts, labels, CTA … </div> <!-- sticky; margin-top: -100svh; z-index: 4 -->
</section>
```

The opening, as markup (the hero is sticky within `.lx-opening`, as today):

```html
<div class="lx-opening">
  <div class="lx-hero-surface" aria-hidden="true">sky, pearl back</div>          <!-- sticky top 0; z 0 -->
  <section id="top" class="lx-hero" data-tone="ink" aria-labelledby="lx-hero-title">
    <div class="lx-hero-window"><div class="lx-hero-layer">vignette, grain, copy, foot, shade, pearl front</div></div>
  </section>                                                                     <!-- sticky top 0; margin-top -100svh; z 4 -->
  <section id="idea" class="lx-sheet" data-tone="paper">
    <div class="lx-sheet-paper" aria-hidden="true"></div>                        <!-- absolute; z 0; paper, radius, shadow -->
    <div class="lx-wrap lx-sheet-layer"> … </div>                                <!-- relative; z 4 -->
  </section>
</div>
```

### 2.6 The static first frame, and the live takeover

**Why.** The phone profile's LCP is 3,588 ms because nothing can paint before the entry bundle, the landing bundle and both stylesheets have arrived and run (§0.5). The first frame must come from the HTML.

**Build.** `scripts/landing-static-plugin.mjs`, a Vite plugin in `vite.config.ts`, runs in `writeBundle` on every client build, so every build path gets it with no extra step: `build`, `build:vercel`, `build:cloudflare`, `ios:sync` and the Pages workflow's `vite build --base=…`. Anything wrong fails the build, rather than shipping a page that silently lost its first frame. It:

1. loads `static/entry-static.tsx` in a Vite SSR server with the build's own mode, environment, aliases and constants, and renders the real `LandingPage` (nav, hero, sheet, the chapters' placeholder and the footer) in **static mode** (`staticMode.tsx`) with `react-dom/server`'s `renderToStaticMarkup`. The reading version of every chapter (`LandingReading`, §11.4) goes into the page's `readingVersion` slot. Static mode means no effects run, settled values are shown (words in place, figures at their values, drawings drawn), and every control that would open the forms is a plain `<a href>`. The copy comes from `copy.ts`, so the static page cannot drift from the live one;
2. writes that markup into `dist/index.html` as `<div id="lx-static">…</div>` **immediately before** `<div id="root"></div>`, not inside it. The app's first commit is often a Suspense fallback while the landing chunk downloads; inside `#root` that commit would wipe the static frame and leave nothing on screen. As a sibling, the static frame stays until the landing itself commits (see Takeover);
3. inlines the **critical CSS** as one `<style id="lx-static-css">` at the end of `<head>`, after the entry stylesheet, so the cascade is the live page's. It holds `landing-static.css` (who sees the static frame), the rules of the landing chunk's own emitted stylesheet that the static markup uses, picked by beasties, and the reading styles. Selectors on the boot state (`data-js`, `data-cue`, `data-landing`, `data-entrance`) are always kept, since they match nothing at build time. The Geist `@font-face` arrives with the entry stylesheet, which stays linked as before;
4. writes the JSON-LD (§15.4) into `<head>` as data blocks.

`index.html` itself drops the stale Newsreader preload (only Geist latin is preloaded), carries the canonical link (§15.1), and adds `<noscript><style>html #boot { display: none; }</style></noscript>` after the boot styles. The reading version's formulas are MathML typeset at build time, so no KaTeX stylesheet is needed without script.

**Boot.** The inline boot script in `index.html` gains about ten lines (the CSP hash changes: §14.5):

- `html[data-js]` is set at once. CSS hides the reading version under it, so JS visitors never see it.
- `html[data-landing]` is set for a landing boot without a `?preview=` parameter, and under it `#boot` is not shown. **The static hero is the first paint: no cover, no preloader.** For every other boot (a stored session, a sign-in link, a preview), `html[data-js]:not([data-landing]) #lx-static { display: none }`, so the static landing costs no layout under the cover, and `src/boot/boot.ts` removes it as soon as the app's code runs.
- `html[data-t0]` records the first animation frame, the phase of the hero's endless loops.
- The **cue**: `new FontFace('Geist', 'url(<the preload's href>)').load()` raced against 900 ms, then two `requestAnimationFrame`s. Then `html[data-cue]`, `html[data-cue-at]` (`performance.now()`) and an `lx-cue` event. Not `document.fonts.load()`: the boot script runs before the stylesheet that declares the face is parsed, and with no matching `@font-face` that promise resolves at once. The hero's entrance is CSS keyed on `html[data-cue] .lx[data-entrance]` (§3.3, scene 1), so it plays even while the bundles are still downloading.

**Takeover.** React renders the live page into `#root`. `Welcome` mounts `LandingPage` and `BootLift` in one Suspense boundary, and `BootLift`'s layout effect removes `#lx-static` in the same commit that inserts the live page, before the next paint: no frame is blank, and none shows both. Because the live nav, hero and sheet render **the same markup and classes**, the frame after the swap is pixel-identical, with three provisions:

1. **Animations resume where they are.** The live root sets `--lx-elapsed: <now − cueAt> ms` and `--lx-since: <now − t0> ms` before its first paint. Every entrance keyframe uses `animation-delay: calc(var(--d) - var(--lx-elapsed))`, so a word half-way up its rise continues from half-way, and the endless loops subtract `--lx-since` the same way, so they keep their phase.
2. **Numbers never reset.** The hero's count-ups run only if the live hero commits before `cueAt + 650 ms`, 50 ms before the stats begin to appear (`STATS_APPEAR`, 700 ms). Otherwise they keep the settled figures already on screen.
3. **No shift.** The swapped elements occupy identical boxes, so CLS stays 0. The LCP entry is the static `h1` at first paint. An identical replacement is not larger, so it does not create a later LCP entry.

Before the takeover, every button is a working link (`Find your level` → `/?auth=signup`; `Try a problem` → `#playground`; `Scroll` → `#idea`). A click during download navigates rather than waiting for code.

### 2.7 Staged loading order

From the first byte to the last prop, on the reference phone:

| Step | When | What |
| ---: | --- | --- |
| 1 | HTML parse | Boot script (theme, boot variant, `data-js`, cue timer). Inline critical CSS. Static nav, hero and sheet. Geist latin preloaded. |
| 2 | First paint | The static hero: night stage, pearl frame, words held in their masks. **LCP candidate.** |
| 3 | Cue (font ready, or 900 ms; then 2 frames) | CSS entrance: headline word by word, then eyebrow, lead, buttons, stats, caption, cue line (§3.3). |
| 4 | Entry JS | React, motion and the app gate (Supabase too until M11). The landing chunk (asked for at once, as `Welcome` does today). |
| 5 | Takeover | The landing's first commit swaps in the live first two screens (§2.6). The director starts; Lenis starts on fine pointers. |
| 6 | cueAt + 1,350 ms, or the first wheel, touch or key | Chapters mount, one per idle moment (`whenIdle(…, 400)`), all at once for a hash or reduced motion (today's rule). |
| 7 | Chapters mounted (or 5 s), then `whenIdle(…, 800)` | `import('./stage/Stage')`: three, renderer, capability check. Hero thread built; `compileAsync` of all nine programs in a still moment (no scroll for 300 ms); path textures uploaded with `initTexture`, one per idle callback. |
| 8 | Programs ready | The thread's intro: assembly out of the shell, 2.6 s, on the wall clock from its first frame (today's rule). |
| 9 | Idle, nearest scene first | Props built one per idle callback, each at least one screen before its scene: belief → chalk → stacks → desk → finale → lips. A nav jump builds the target scene's props first. |
| 10 | 5 s after load, or hover or focus on a sign-up control | `AuthFlow.preload()` (today's rule, plus the hover trigger). |

---

## 3. Scroll timeline

### 3.1 Reference geometry

Desktop reference, 1440 × 900. Section heights are set in `svh` in CSS. Their tops follow from the content, and the director measures the real values at runtime (§2.4.3). The fractions are of the total scroll, S_max = 2,710 vh (document 2,810 vh, minus one screen). They will shift a little with text wrapping. The vh columns are the design intent.

| Section (id) | Top (vh) | Height (vh) | On screen, S (vh) | On screen, fraction | Pinned span |
| --- | ---: | ---: | --- | --- | --- |
| Hero (`top`) | 0 | 100 | 0–100 | 0.000–0.037 | sticky inside `.lx-opening` while the sheet covers it |
| Idea sheet (`idea`) | 100 | 130 | 0–230 | 0.000–0.085 | — |
| Engine (`engine`) | 230 | 500 | 130–730 | 0.048–0.269 | **S 230–630 (0.085–0.232): 400 vh, four screens** |
| Playground (`playground`) | 730 | 160 | 630–890 | 0.232–0.328 | — |
| Topics (`topics`) | 890 | 330 | 790–1,220 | 0.292–0.450 | — |
| Archive head and marquees (`archive`) | 1,220 | 120 | 1,120–1,340 | 0.413–0.494 | — |
| Archive staircase (`archive-track`) | 1,340 | 380 | 1,240–1,720 | 0.458–0.635 | **S 1,340–1,620 (0.494–0.598): 280 vh, 70 per stack** |
| Workspace (`workspace`) | 1,720 | 380 | 1,620–2,100 | 0.598–0.775 | cards stick one by one (desktop > 900 px) |
| Desk (`desk`) | 2,100 | 150 | 2,000–2,250 | 0.738–0.830 | — |
| Plans (`plans`) | 2,250 | 160 | 2,150–2,410 | 0.793–0.889 | — |
| FAQ (`faq`) | 2,410 | 150 | 2,310–2,560 | 0.852–0.945 | the heading sticks (top 120 px) |
| Final (`begin`) | 2,560 | 160 | 2,460–2,720 | 0.908–1.000 | — |
| Footer (under the sheet) | — | 90 | lift S 2,620–2,710 | 0.967–1.000 | sticky to the bottom, uncovered |

Today's page is 19,723 px tall, about 21.9 screens. This plan is 28.1 screens, about 28 % longer. Most of the added length is pinned and carries a scene: the engine's fourth screen and the archive's 2.8-screen staircase. Whether to shorten the staircase is open question Q7 (§18).

### 3.2 The timeline

| # | Scene | Scroll: S in vh (fraction) | Pinned | Camera (rig on the scene's group) | 3D objects | DOM text | Ground tone / nav tone | Easing |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero, "The Butterfly" | 0–100 (0.000–0.037); hand-off to 2 over 10–130 | Yes: sticky while the sheet covers it | Lorenz group at rest: tilt 0.22 rad, turn 0.36 rad + 0.28·sin(0.09 t). Pointer orbit **±5° yaw, ±3° pitch** on `follow`. The group follows the stage's recede: scale 1 → 0.9, y 0 → −4 vh. | The thread as a flowing Lorenz, warm where fast and cool where slow. Assembly from a wide shell, 2.6 s. Inside the pointer's radius (0.3 NDC), curl-noise swirl and brightening. A text-safe zone over the copy column. | CSS entrance at the cue: headline word by word, then eyebrow, lead, buttons, stats (three count-ups), caption with its self-drawing arrow, the scroll cue's endless line. On scroll: copy y 0 → −16 vh (cover 0–0.8) and opacity 1 → 0 (cover 0.05–0.6); shade 0 → 0.55. | The stage fills the screen inside the pearl frame / **ink** | Entrance: the `arrive` spring sampled into `linear()`, fades on GLIDE. Scroll: linear maps. Parallax: `follow`. |
| 2 | The Idea, "The Sheet" | 0–230 (0.000–0.085); covers the hero over 0–100; the thread rests on it 130–140 | No | None (flat paper) | A curl lip along the sheet's top edge (height 1.6 vh, curl 25° at rest up to 55° with scroll speed). A contact shadow on the stage (24 px gaussian). The thread becomes the **foot rule**, in graphite, breathing ±1.5 px. | Words light from 0.14 to 1 as they are read (the h2's range "start 0.85" → "end 0.5"). "easy" floats, "hard" thuds and squashes, "right" is underlined. Sub-headline and link rise. | **paper** / **paper** | Linear scrub. Acted words: their own springs (§8.2). |
| 3 | Engine, "The Curve" | 130–730 (0.048–0.269) | **Yes, 230–630 (400 vh)** | Arrival: scale 0.9 → 1 over S 130–230 (a direct, linear map, as today). Dolly: group z −140 → 0 px over playhead 0–0.85. Rise: rotateX 4° → 12°. At the verdict (playhead 0.87–1): rotateX → 28°, rotateY → −16°, z +40 px, to look down along the axis. | The thread as the **belief curve**, a ribbon 36 px deep; a ribbon fill (cyan gradient); **beads** that drop onto the axis with a spring bounce, in topic colours, with a tick or cross, stacking at similar difficulty; four **glass slabs**, one per tier, the current one lit. | Heading, note. Beats change state at k = 0.6, 5.6 and 12.6. Readouts: Questions, Level, How sure. YOU, the axis ends and the tier names are placed by projection. The ticker. The verdict card at beat 4. The CTA. | paper around the stage / **ink** | Playhead: linear, with holds of 7 % at the start and 13 % at the end. Between answers, smoothstep over [0.12, 0.88] of each step. Beads: spring 0.6 / 0.32. Verdict: GLIDE 0.7 s. Rig: smoothstep. |
| 4 | Playground, "The Circle" | 630–890 (0.232–0.328) | No | None. The card tilts toward the pointer, up to **4°**, on `tilt`, with a sheen that follows. | The thread as a **circle in light** exactly beneath the SVG circle (attached while Lenis drives). It fades to a glow as the SVG draws itself. While C is dragged, the glow brightens 1.2×. | Heading and lead rise; the card settles. The SVG draws in (circle, then chords, then points). Answer form, solution toggle, slider, readout; "always 189" pulses while C moves. | **morning** / **paper** | Draw-in: GLIDE 1.4 s. Points: pop spring 0.5 / 0.4. Tilt: `tilt` spring. |
| 5 | Topics, "The Chalkboard" | 790–1,220 (0.292–0.450) | No (the stage is about three screens tall) | Board plane at z −30 px. Per room, the glyph group bobs ±3 px over 4 s and tilts toward the pointer, up to **10°**, on `tilt`. Ghost formulas: DOM parallax at 0.06, 0.12 and 0.20 of the scroll offset. | The thread as **chalk dust** settling on the board (S 820–940). Four **extruded glyphs** (∑ △ ! ≡) in a chalk material. A wrong choice: shudder (420 ms) and a puff of 24 dust particles. A right choice: a chalk ring (900 ms), then dust swirls into the slip's explanation (700 ms). | Heading, lead, hand note. Rooms rise. Boards draw once. Slips: choices, the nudge, the status line, the explanation. Foot. Ledge. | **dusk**, gathering into the ink stage / **ink** over the stage | Dust settle: ease-out cubic by scroll. Bursts: ease-out by time. Ring: GLIDE. |
| 6 | Archive, "The Staircase" | 1,120–1,720 (0.413–0.635) | **Yes, the track over 1,340–1,620 (280 vh)** | Track group rotateY **12°**; x = −progress × (track width − viewport width). The climb: the group drops by the step height as each stack passes, and pitches 6° → 10°. | Four **instanced paper stacks** at heights 0.44, 0.61, 0.80 and 1.00 (of 54 sheets). Each top sheet lifts (rotateX 0 → −72° about its back edge, ending square to the camera) as its stack passes the centre. The thread runs along the **stair edges**, in graphite. | Heading, lead. Two marquees (speed 1 + min(5, \|v\|/700); skew ±5°, clamped at 2,600 px/s). The stack labels by projection: family; format label fading in with the lift; a count-up, once, at lift > 0.6. The sample card when the lift completes. Axis "easier → harder". Button. | **parchment** / **paper** | Track: linear. Lift: smoothstep of distance from the centre. Climb: smoothstep between steps. Count-up: GLIDE 1.9 s. |
| 7 | Workspace, "The Pile" | 1,620–2,100 (0.598–0.775) | Cards stick one at a time (top 96 + 26 i px) | None. CSS 3D, perspective 1,600 px on the pile, transform-origin 50 % 0. | Covered cards (CSS): rotateX 6° / 7° / 8° by level, translateZ −40 px per level, scale −4 % per level, and the existing dim (0.12 per level). The thread arrives round card 1 and hands its shape to a **DOM pencil outline** on the top card: four composited strokes (§3.3). The outline is redrawn on each newly stuck card, and the thread itself rests hidden in the pile. | Heading. Card copy and links. Each card's picture loops only while it is on top. | **sage** / **paper** (ink while the ink card is under the island) | Pile: scrubbed, linear on pile progress. Outline: `HAND` 0.8 s, fade-out 0.25 s. |
| 8 | Desk, "Lamplight" | 2,000–2,250 (0.738–0.830) | No | Stage arrival: scale 0.94 → 1, y 56 → 0 (`follow`, as `useStageArrival`). CSS perspective 1,400 px: the sheet rotateX(24°) rotateZ(−7°); the card rotateX(24°) rotateZ(5°). Both flatten to 0 when drawing starts (`settle`). The lamp head tilts toward the pointer, up to **4°**. | A **pencil** whose tip rides the end of the live demo stroke, its body 35° off the sheet's normal. A warm **lamp cone** (additive). A few dust motes in the cone (thread particles). The thread streams into the pencil tip over S 2,040–2,100. | Heading, lead, the three points. The sheet: the triangle draws itself once (2.6 s, at 50 % in view); tools; Fresh sheet; the nudge. The card: date, count (aria-live), the Build / Sharpen / Taper track (re-laid out by FLIP when the date changes), the week line, the button. | **lamplight** / **ink** | Arrival: `follow`. Flatten: `settle`. Demo stroke: ease-out quad (today's). |
| 9 | Plans, "Three Sheets" | 2,150–2,410 (0.793–0.889) | No | None. The Pro card is raised: translateZ 24 px (perspective 1,200 px) and a deeper shadow. | The thread traces the **Pro card's perimeter** in the pearl colours (S 2,250–2,300, attached while Lenis drives), then hands its light to the **CSS pearl tube** (S 2,300–2,330). | Heading. The Monthly / Yearly control: the thumb slides between options as a shared layout; the price swaps with a small lift. Cards rise, with a spotlight under the cursor. Feature lists from `plans.ts`. Promises. | **cream** / **paper** | Thumb: `press`. Price: `press` with a 0.2 s fade. Perimeter flow: linear. |
| 10 | FAQ | 2,310–2,560 (0.852–0.945) | The heading sticks (top 120 px) while the list scrolls | None | The thread as a **margin line** 20 px left of the list, with a small loop at the open question. The loop travels when another question opens (0.5 s, GLIDE). | Heading, link. Items stagger in (0.07 s). An answer opens by easing its height while its text fades up. The plus turns into a minus. | **morning** / **paper** | GLIDE. |
| 11 | Final, "The Line" | 2,460–2,720 (0.908–1.000) | No | Stage arrival (`follow`). The tube recedes from z 0 to −900 px along its path. | A **3D tube** drawn by scroll through a spring (offsets "start 0.9" → "end 0.75"; drawn 0.02 → 1 over the eased range 0–0.85), with a point of light at its tip (halo 22 px, core 5.5 px). The thread rides the drawn part, and blooms at the tip into a **mini Lorenz** (radius 60 px) over drawn 0.92–1. | Heading, lead. Two path cards (Magnetic 0.06, spotlight). The caption. | **dusk** around the stage / **ink** | Draw: `follow` spring. Bloom: smoothstep. |
| 12 | Footer, "Uncovered" | 2,620–2,710 (0.967–1.000) | The footer is sticky under the sheet | None | A **curl lip** on the sheet's lower edge as it lifts (attached while Lenis drives), with a shadow onto the footer. The canvas is scissored to the sheet. | The wordmark "calculixhub." rises letter by letter (each over lift [0.04 + 0.012 i, +0.2]); the footer drifts −18 % → 0 over lift 0–0.35. | the footer is ink / **ink** | Linear scrub. |

The ground sequence this produces is the brief's: ink → paper → ink → morning → dusk → parchment → sage → lamplight → cream → morning → ink. The ink stages (hero, engine, topics, desk, final) hold the moving parts, and the paper tones sit around them. Ground tones keep today's rule exactly. Each tone fades in over the first fifth of its chapter's passage and out over the last fifth (`toneAt`), with at most two visible at once. The hero and the idea sheet keep the plain paper ground.

### 3.3 Scene notes

**1. Hero.** The entrance is CSS keyed on `html[data-cue]`, with delays counted from the cue and resumed by `--lx-elapsed` (§2.6):

| Element | Delay (s) | Motion |
| --- | ---: | --- |
| Headline words ("Stay", "with", "the", "question.") | 0.08 + 0.07 i | Rise from y 112 %, rotate 2.5° → 0, out of each word's mask, on `arrive` (`linear()` sample, 0.8 s). Masks lift at the end of the last word (a 0 s `overflow: visible` keyframe). |
| "question." pencil stroke | 1.15 | `clip-path` inset 100 % → 0 over 1.2 s, GLIDE (today's keyframe). |
| Eyebrow | 0.30 | y 14 → 0, opacity on GLIDE 0.55 s. |
| Lead | 0.40 | y 18 → 0. |
| Buttons | 0.48 | y 18 → 0. They work from the first frame, as links before takeover. |
| Stats | 0.70 + 0.07 i | y 16 → 0. The count-ups (2,195; 233; and the end year 1959 → 2026, so the range "opens") run over 1.9 s on GLIDE, only if the live hero committed before the stats appeared (§2.6). |
| Caption | 1.30 | Opacity over 1 s. Arrow stroke at 1.5 s (1.1 s) and its head at 2.4 s (0.4 s). |
| Scroll cue | — | The line keeps drawing (today's `lx-scroll-line` loop). |

The brief orders the headline first, then the eyebrow. That reverses today's order, where the eyebrow appears 0.08 s before the first word. The buttons stay on screen inside the first second.

Pointer behaviour (fine pointer, motion allowed). The particle field reads the window's `pointermove`, because the words sit above it. Yaw target = (x − 0.5) × 2 × 5°; pitch target = (y − 0.5) × 2 × 3°. Both are followed on `follow`. Inside the radius, particles are pushed along a 2D curl-noise field (amplitude 0.05 clip units, as today's lean) and brighten (+20 % alpha). The swirl replaces today's straight lean-away.

**2. Sheet.** The lip is a strip of `PlaneGeometry(1, 1, 1, 24)` along the sheet's top edge, bent in the vertex shader around a cylinder of radius 1.1 vh. It shows the paper's underside (paper-shade, with a 1 px highlight). Its angle eases from 25° to at most 55° with the scroll speed (`follow`), the way a sheet's edge lifts when it is pulled. The contact shadow is a quad above the edge with an analytic gaussian falloff (24 px, `oklch(10 % 0.03 230 / 0.45)`). It replaces today's `box-shadow` while the stage is live, and the box-shadow remains for the fallback. **The bend:** the brief asks for "a slightly bent 3D plane", but the sheet is DOM and cannot bend. The canvas sits above the sheet's paper and below its words (§2.5), so it lays one shading quad over the sheet's top 18 vh: a cylinder-normal lighting gradient, darkening the paper by at most 4 % toward the curl. The flat sheet then reads as gently bent into its lip. On touch (native scroll) neither the lip nor the bend is drawn, and the CSS shadow carries the edge alone.

**3. Engine.** `engineFrame(progress)` is a pure function holding today's maths, moved out of `EngineStory.draw`: `k = clamp(((p − 0.07) / 0.8) × 13, 0, 13)`; step blend `t = smoothstep(clamp((frac(k) − 0.12) / 0.76))`, or `round(frac(k))` under reduced motion. It returns the curve step `k + t`, θ, sem, the YOU height, the meter scale, the tier, `answered = floor(k + 0.88)` and `beat = beatAt(k)`. The DOM writer and the WebGL uniforms consume the same frame object. The SVG chart stays in the DOM at `opacity: 0` while the stage is live. It remains the accessible image (`role="img"` and its label), and it is the visible fallback. The axis line becomes a separate 1 px DOM line, so it stays when the SVG is hidden.

**4. Playground.** The problem card is a surface twin (§2.5, rule 5). Its paper face is in layer 2 and its content in layer 4, both on the same entrance and tilt MotionValues, so the light circle can lie between them. The light circle's world centre and radius come from the figure's cached rect: SVG `cx 300, cy 190, r 136` in a 600 × 390 viewBox, mapped to screen pixels. The card's current tilt matrix is applied to the circle's transform (`uXformB`), so it stays exactly beneath the SVG circle while the card tilts. The SVG's draw-in stays triggered (`whileInView`, once, 40 %). When it starts, the light circle eases from full to a 0.35 glow beneath the ink circle over the same 1.4 s. Scrolling back raises it again (scrubbed).

**5. Topics.** Each room's DOM symbol (`.lx-topic-symbol`, aria-hidden) is the glyph's anchor. It goes to `opacity: 0` while its 3D glyph is visible, and shows again in the fallback. The ghost formulas keep their DOM text and positions and move on three layers (6 of them: 2 per layer). They live in the stage's surface layer, so the dust settles in front of them.

**6. Archive.** The track is a sticky 100 svh viewport inside a 380 svh section. It holds four DOM slots (label blocks) in a row 4 × 64 vw wide, translated by the director. The 3D stacks are positioned from the slots' cached offsets and the current translation. A stack is "at the centre" when its slot's centre is within 15 vw of the viewport's centre. lift = 1 − |dx| / 15 vw, clamped, which makes it scrubbed and reversible. The sample cards use existing archive samples, so `archiveSamples.test.ts` already checks them: AMC 12 → "AMC 12A 2024 · Problem 4"; AIME → "AIME I 2010 · Problem 2"; USAMO → "USAMO 2022 · Problem 4"; IMO → "IMO 1988 · Problem 6". The stack heights show the order of difficulty, not the number of problems (580, 550, 540, 525 run the other way), exactly as today's `STEP` comment says. The DOM keeps the axis "easier → harder" so the heights are not read as counts.

**7. Workspace.** The top card is the last card whose slot has reached its sticky top. The director computes it from the cached slot offsets, the same arithmetic the CSS sticky does. The cards' pictures loop only while `topCard === index` (fix P9).

The outline is DOM, not WebGL. The pile's cards are content (layer 4), and the covered cards peek 26 px above the top card. A WebGL line round the top card would vanish under them along its top edge. So the thread hands over: it reaches card 1's perimeter at the end of hand-off 6 → 7 and fades in 150 ms. The top card's own outline then draws itself: four absolutely positioned 1.5 px graphite strokes 6 px outside the card's edge (a hand wobble baked into each as a static SVG), each revealed by `scaleX` or `scaleY` from its starting corner (top → right → bottom → left, `HAND`, 0.8 s together), with quarter-circle corners fading in. It is transform only, so nothing repaints. When a card stops being the top one, its outline fades out (0.25 s) and the new top card's outline draws. At the pile's end, the WebGL thread takes the shape back from card 4's outline for hand-off 7 → 8.

**8. Desk.** The demo stroke's live end point is known from `demoUpTo(shown)` in the sheet's unit coordinates. Its screen position comes from the sheet's own CSS transform: the director writes it, so the matrix is known without reading the DOM. The pencil's tip is placed there at z = 0, and its body extends toward the camera. The sheet is a surface twin (§2.5, rule 5), and its tilt is `transform: perspective(1400px) rotateX(…) rotateZ(…)` on each twin rather than a shared `perspective` parent (which would make one stacking context of both). The pencil is drawn above the sheet's paper (layer 2) and below the 2D canvas strokes (layer 4). The stroke trails behind the tip and the body points away from it, so they never visibly cross. The FLIP track: each `<li>` of `.lx-desk-track` uses motion's `layout` with `transition: SPRING.settle`, as transforms. This fixes today's "animating flex-grow laid the card out again on every frame".

**9. Plans.** The CSS pearl tube is today's `HeroGlow` technique at card size: one square of conic gradient rotating behind the card (`transform` only), a veil with a 2 px gap, and a border-radius that matches the card. Its opacity is a variable the director writes (S 2,300–2,330), and on touch it is a triggered 0.6 s fade.

**10. FAQ.** The loop sits on the open question's button row. When another question opens, the loop moves on GLIDE 0.5 s. When all are closed, the line runs straight. Not drawn on touch (§2.4.5): the DOM sign marks the open answer there.

**11. Final.** The tube's spline is today's `PATH` (viewBox 1240 × 700), sampled into 400 points and mapped onto the stage rect. Its depth z(u) = −900 × u^1.4 px makes the line recede while its screen path still dips, loops back and ends higher than it started. The radius tapers 2.6 → 1.2 px with *u*. "Drawn" is the follow-spring value. The tube shows `drawRange` up to `drawn`, and the tip light rides `C(drawn)` from the arc-length table. On ≤ 960 px the tube is hidden, as the SVG line is today ("stacked, there is no floor beneath the words"). The mini butterfly still blooms above the heading, so a phone too ends where it began.

**12. Footer.** The bottom lip uses the sheet program in reverse (it curls away from the viewer). On ≤ 760 px or ≤ 640 px tall, the footer follows the page (today's rule) and no lip is drawn.

---

## 4. Hand-offs

### 4.1 How every hand-off works

**4.1.1 Points are matched by *u*.** A particle's thread parameter *u* never changes. The source and target are both curves, so particle *i* travels from `A(u_i)` to `B(u_i)`. Neighbours on the thread stay neighbours, and the morph reads as one thread pulled into a new shape. Two exceptions are named in the table: the shatter into dust, matched by seed, and the gathering into a point.

**4.1.2 Timing per particle.** Each particle has an order value `o_i` ∈ [0, 1]: its *u* (`uOrder = 0`, so the new shape is drawn from one end), its seed (`1`, a random dissolve), or its normalised distance from `uOrigin` (`2`, a bloom). With the window W = `uSpread`:

```text
t_i = smoothstep(0, 1, (m − W · o_i) / (1 − W))        m = the hand-off's local progress, 0 → 1
p_i = mix(A(u_i), B(u_i), t_i) + aOffset_i · |uCarry| · sin(π · t_i) + uCarryDir · sin(π · t_i)
```

At m = 0 every t_i is 0, and at m = 1 every t_i is 1, so both ends are exact, and the hand-off is a pure function of scroll.

**4.1.3 Flow.** A flowing source (the Lorenz, the Pro perimeter, the mini butterfly) has its flow speed eased to 0 at the start of the hand-off, before t_i moves. Because φ stops rather than resets, `u_eff` is continuous (§2.3.4).

**4.1.4 Light and graphite in one draw call.** The blend is premultiplied: `ONE, ONE_MINUS_SRC_ALPHA`. The fragment writes `rgb = colour × α` and `alpha = α × (1 − additive)`. With additive = 1 that is pure additive light, and with 0 it is ordinary "over" compositing, which is how graphite and ink read on paper. Per fragment:

```text
additive = mix(uAdditiveA, uAdditiveB, t_i) × (1 − insideAny(uPaperRects))
colour   = mix(lightPalette(u, speed), inkPalette(mode), 1 − additive)
```

So a particle crossing from a stage onto paper turns from light to graphite exactly at the paper's edge.

**4.1.5 Masks follow t_i.** Occluder discard (§2.3.5) is weighted by `1 − t_i`. The stage clip applies to a particle in proportion to how much it still belongs to a stage.

**4.1.6 Attached targets under native scroll.** Where the target is attached (§2.4.5) and the scroll is native, the hand-off runs the same, except the last 15 % of m fades `uFade` to 0. The DOM element (the rule, the SVG circle, the card's border) carries the final shape.

### 4.2 The hand-off table

| Hand-off | Scroll range: S in vh (fraction) | Source buffer → target buffer | How points are matched | Morph uniforms | Light ↔ graphite | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Intro (shell → hero) | Time: 2.6 s from the stage's first frame | `shell` (procedural scatter, radius 5.5–10.5 units by seed) → **Lorenz** path (16,384 × RGBA32F) | By seed: `t = clamp(uIntro × 1.5 − 0.5 s_i)`, ease-out cubic (today's) | `uIntro` on the wall clock | Light | Not scroll-driven. Under reduced motion, the shape appears at once with a 600 ms fade. |
| 1 → 2 Hero → Idea | 10–130 (0.004–0.048): release 10–70, morph 70–130 | **Lorenz** → **rule**: a 2,048-sample line on the idea foot's rule (`.lx-idea-foot` border-top), in sheet space so it scrolls with the sheet | By *u*; ordered by *u*, so the line draws itself from its left end | 10–70: flow → 0 (smoothstep 10–60); `uRelease` 0 → 1 loosens the form and flattens it (y × (1 − 0.85 r), z × (1 − r)). 70–130: `uMorph` 0 → 1, `uSpread` 0.5, `uCarry` (0, −40 px, 0), a downward sag. | Light → graphite. The sheet is a paper rect, so particles turn graphite as they cross its edge. | The sheet and its top lip are occluders, weighted by 1 − t_i. Attached at the end (the rule): under native scroll, `uFade` → 0 over m 0.85–1 and the DOM rule carries the line. |
| 2 → 3 Idea → Engine | 140–262 (0.052–0.097): detach 140–200, carry 200–230, lift 230–262 | **rule** → **belief**, step 0 (the prior; R32F rows) | By *u*: x(u) = chart.x0 + u × chart.w, the same x as the axis at that θ. Each particle rises straight up to the curve. Ordered by distance from the chart's centre (`uOrder 2`), so the middle lifts first. | 140–200: `uXformA` eases from sheet space to screen space (the line holds at the axis's on-screen height, ≈ 62 vh). 200–230: held while the stage scrolls up under it. 230–262: `uMorph` 0 → 1, `uSpread` 0.25. | Graphite → light as the stage passes under: only the sheet is a paper rect. | The axis is the DOM's 1 px line (§3.3). The ribbon fill mesh fades in with m. |
| within 3 | 262–630 (0.097–0.232) | belief step k → k + 1 | Same particle, same *u* (same θ) | `uBeliefStep = k + t` from `engineFrame()` | Light | Beads, slabs, YOU and the meter come from the same frame. |
| 3 → 4 Engine → Playground | 640–760 (0.236–0.280): bend 640–700, close and attach 700–760 | **belief** (final step) → **circle**: centre and radius from the SVG circle's cached screen rect | By *u*, with the circle parametrised so the curve's peak (θ = 0.925) lands at the top: angle(u) = π/2 + 2π (u − u_peak) | `uMorph` 0 → 0.6 over 640–700, with `uCarry` (0, 60, 120) px, lifting off and toward the viewer. Then 0.6 → 1 over 700–760. The stage clip releases at m = 0.2. | Light → ink-light: additive 1 → 0, colour cyan → accent with an accent-soft halo | Attached at the end, under Lenis only (§4.1.6). The SVG draw-in then fades the circle to a 0.35 glow (§3.3). |
| 4 → 5 Playground → Topics | 790–940 (0.292–0.347) | **circle** → **dust** (procedural: board plane z −30 px; x from hash(seed), y from hash₂(seed)^0.6 × 0.9 of the board) | **By seed**: the circle shatters | `uMorph` 0 → 1, `uSpread` 0.6. Carry along the radial direction from the circle's centre, 80 px, then a gravity sag. | Ink-light → chalk light (additive 1, chalk white, size × 0.8, alpha 0.35) | Floating: works everywhere. Dust is in the stage's space and scrolls with the board. |
| 5 → 6 Topics → Archive | 1,180–1,360 (0.435–0.502): lift 1,180–1,240, carry 1,240–1,340, settle 1,340–1,360 | **dust** → **stair edges** (2,048 samples along the stacks' top-front edges and risers, in track space) | By *u*: the chalk is pulled back into one thread | 1,180–1,240: the dust lifts off the ledge and condenses into a loose line at 70 vh (screen space). 1,240–1,340: carried beneath the marquees. 1,340–1,360: `uMorph` 0 → 1 onto the stairs. Then `uRevealB` follows the track, so the thread runs only as far as the stacks shown. | Light → graphite once outside the stage clip (parchment is paper) | Attached to the stacks, which are pinned, so this holds everywhere on desktop. ≤ 900 px: the thread rests on the DOM ladder's top edge instead (fade at the end). |
| 6 → 7 Archive → Workspace | 1,600–1,750 (0.590–0.646) | **stair edges** → **outline (card 1)**: a rounded rect 6 px outside card 1, clockwise from its top-left | By *u*, head first: the line peels off the stairs and wraps the card | `uMorph` by S. The stacks leave with the track after S 1,620; card 1 sticks at about S 1,750. At m = 1, `uFade` → 0 over 150 ms and card 1's DOM outline draws (§3.3). | Graphite → graphite (sage) | Attached: under Lenis it tracks the moving card. Native: the WebGL line fades before the card sticks, and the DOM outline draws when it does. |
| within 7 | ≈ 1,750–2,010 (0.646–0.742) | — (the DOM outline passes from card to card) | — | Triggered as each card becomes the top one | Graphite (DOM) | The WebGL thread rests hidden. |
| 7 → 8 Workspace → Desk | 2,010–2,100 (0.742–0.775) | **outline (card 4)** → **rest-at-point**: the pencil's tip | By *u*, head first: the thread takes the shape back from card 4's DOM outline (which fades in 150 ms), and the outline unravels into a stream into the tip | `uMorph` by S, with `uCarry` (0, 30, 60) px, an arc | Graphite → warm light over the dark desk; graphite over the sheet's paper (the sheet's projected rect is a paper rect) | Floating stream: works everywhere. |
| 8 → 9 Desk → Plans | 2,200–2,330 (0.812–0.860): unspool 2,200–2,250, trace 2,250–2,300, hand to CSS 2,300–2,330 | **rest-at-point** (pencil tip) → **Pro perimeter** (rounded rect, radius 16 px, flowing) | By *u*: the thread unspools from the pencil, head first | `uMorph` 0 → 1 over 2,200–2,300 with an arcing carry. Then `uFade` 1 → 0 while the CSS tube's opacity goes 0 → 1. | Warm light → pearl: normal blend on cream, additive over the dark Pro card's own face (it is a paper rect with additive 1) | Attached at the perimeter: under Lenis only. Native: the thread fades at the end of the unspool, and the CSS tube lights when the card enters (0.6 s). |
| 9 → 10 Plans → FAQ | 2,360–2,440 (0.871–0.900) | **Pro perimeter** (re-emerging from the tube's lower-left corner, alpha from 0) → **margin line** (x = list.left − 20 px, list top to bottom, with a 6 px loop at the open question) | By *u* | `uMorph` by S | Pearl → graphite (morning paper) | Attached: under Lenis only. Not drawn under native scroll. |
| 10 → 11 FAQ → Final | 2,480–2,560 (0.915–0.945) | **margin line** → **final tube** (the drawn part, u ≤ drawn) | By *u*: the line runs down into the stage and becomes the start of the tube | `uMorph` by S. Then `uRevealB = drawn` from the follow spring. | Graphite → light as it enters the stage | Floating: the tube has no DOM edge. |
| within 11 | drawn 0.92–1.00 (≈ S 2,670–2,710) | **tube** → **mini Lorenz** at the tube's end (radius 60 px, flowing) | By *u*, ordered by distance from the tip (`uOrder 2`): the bloom spreads back from the tip | `uMorph = smoothstep(0.92, 1, drawn)` | Light | The tube mesh stays drawn: the line remains, and the thread blooms off it. |
| 11 → 12 Final → Footer | 2,620–2,710 (0.967–1.000) | No morph: the mini Lorenz keeps flowing on the final stage as the sheet lifts | — | Scissor to the sheet; bottom lip | Light | The footer itself has no thread. |
| Teleport (any long jump) | Time: 250 ms out, 600 ms in | current → the destination scene's rest shape | — | `uFade` 1 → 0; set A = B = destination; `uFade` 0 → 1 | Destination's mode | Used for nav jumps, `/#id` arrivals and back/forward restores that cross more than one hand-off (§5.3). |

---

## 5. Reversal

### 5.1 Two kinds of animation

- **Scrubbed** animations are a pure function of scroll: `value = f(progress)`. They reverse by construction, because scrolling back gives the earlier progress and so the earlier value. Springs that follow scroll (`follow`) are still functions of progress at rest. They only add a moment of lag, never a different end state.
- **Triggered** animations play on a threshold crossing or an interaction. Each one is declared **once** (plays the first time and stays finished) or **rewind** (plays forward on the way down and back on the way up). Every threshold has a hysteresis band of 1 % of its scene's range: it enters at ≥ t + 0.01 and exits at < t − 0.01, so a reader resting on the line never sees it flicker.

### 5.2 Every animated element, by kind

| Element | Kind | Scrolling back up |
| --- | --- | --- |
| Hero entrance (words, eyebrow, lead, buttons, stats, caption, arrow) | Once per page load | Stays finished. |
| Hero recede (stage scale and y, copy lift and fade, shade, pearl fade) | Scrubbed | Returns to rest. |
| Thread: every hand-off, every rest shape, the engine's steps, the stair reveal, the tube's drawn length, the bloom | Scrubbed | Re-forms backwards through the same shapes. |
| Workspace DOM outline | Rewind, keyed on the top card | Fades from the card that stops being on top; draws on the card that becomes the top one again. |
| Thread intro (shell assembly) | Once | Stays finished. |
| Idea words' light | Scrubbed | Words dim again ahead of the reader. |
| Idea acted words ("easy", "hard", "right") | Rewind at half-lit (today's rule) | "easy" sinks back, "hard" lifts back up, the underline withdraws. |
| Section headings (`SplitText`), `Rise`, `Stagger` | Once (at 50 % / 25 % / 20 % in view) | Stay finished. |
| Count-ups (hero, archive) | Once | The settled figure stays. A number the reader has seen never resets. |
| Engine curve, YOU, meter, tier, beats, slab light | Scrubbed | Exact reverse. |
| Engine beads | Rewind, keyed on `answered` | A bead lifts away (y −40 px, opacity 0, 0.25 s) when its answer is un-counted (today's exit). |
| Engine verdict | Rewind with beat 4 | Exits (y 16, scale 0.98, 0.7 s, GLIDE). |
| Engine ticker | Rewind | The previous line comes back. |
| Rig moves (engine dolly and tilt, archive climb) | Scrubbed | Exact reverse. |
| Chord figure draw-in | Once | Stays drawn. The light circle beneath rises again, scrubbed. |
| Topic board drawings | Once | Stay drawn. |
| Dust settle, ghost parallax | Scrubbed | Exact reverse. |
| Dust bursts, glyph shudder, ring, swirl | Triggered by a choice (not by scroll) | Not affected. A solved room stays solved. |
| Marquee speed and skew | Velocity-driven | Follows the current velocity in either direction. |
| Archive track, stack lift, format label | Scrubbed | Exact reverse. |
| Archive sample card | Rewind with lift ≥ 0.98 | Fades out when the sheet lowers. |
| Workspace tip-back and dim | Scrubbed | Exact reverse. |
| Workspace pictures | State: they loop while their card is on top | Restart when their card is on top again. |
| Desk stage arrival | Scrubbed through `follow` | Exact reverse. |
| Desk demo triangle | Once | Stays drawn. The pencil rests at the triangle's last point. |
| Desk flatten | Interaction state | Tilts back 1.2 s after the last stroke, or when the sheet leaves the screen. |
| Plans thumb and price swap | Interaction | Not affected. |
| Pro perimeter hand-over | Scrubbed under Lenis; once (0.6 s) on touch | Under Lenis, the thread retraces it. On touch, the tube stays lit. |
| FAQ open and close | Interaction | Not affected. |
| Final line, tip light | Scrubbed through `follow` | The line withdraws to its start. |
| Footer lift, wordmark letters | Scrubbed | Letters sink back as the sheet comes down. |
| Ground tones, nav tone, nav pill, reading line, rails spine and comet | Scrubbed | Exact reverse. |
| Rails figure morph | Rewind, keyed on the chapter | Morphs back to the previous chapter's figure. |
| Nav hide and show | Direction of scroll | Shows on any upward scroll. |

### 5.3 Jumping straight into a chapter

`/#plans`, a nav link, or "See how it works":

1. If the chapters are not all mounted, mount them all at once (`onChapterDemand` → `all`, today's behaviour). Wait for `whenChapters()` and one frame.
2. The director re-measures the layout cache, then computes every scrubbed value for the destination in that same frame. They are pure, so there is nothing to replay.
3. Scroll: an arrival with a hash uses `scrollToTarget(target, { immediate: true })` (today's). A nav link travels (expo in-out, 0.9 s + distance / 5,200 px, capped at 2.2 s, today's).
4. The thread: if the journey crosses more than one hand-off, the director runs **Teleport** (fade out 250 ms, set the shape, fade in 600 ms) instead of fast-forwarding through every morph. A journey within one hand-off simply scrubs.
5. Triggered "once" animations of the chapters jumped over are not marked done. Each plays the first time it is actually seen, exactly as if the reader had come from above.
6. The destination's 3D props are built first, if not built yet (§2.7, step 9). If they are not ready when the journey ends, the scene shows its DOM fallback until they are, then cross-fades (300 ms).

### 5.4 Resize and orientation

- The `ResizeObserver` on `main` and the 150 ms debounced `resize` both re-measure (§2.4.3). Before re-measuring, the director records an **anchor**: the scene under the reading line (45 % of the screen, as the rails use) and its local progress. After re-measuring, it restores `scrollY` so that the same scene shows the same local progress. A reflow above the reader therefore never moves what they are reading.
- Pins need nothing: they are CSS `position: sticky`.
- The renderer resizes its drawing buffer, the camera recomputes D and fov (§2.3.2), and every attached shape is rebuilt from the new rects in the same frame.
- Crossing a layout breakpoint (900 px: the archive track ↔ the vertical ladder; the workspace pile ↔ the column) re-registers the affected scenes, then restores the anchor.

### 5.5 Restoring scroll and pins

- `history.scrollRestoration = 'manual'` while the landing is mounted (restored to `'auto'` on unmount). On `pagehide`, the anchor is saved to `sessionStorage` (`lx:anchor`, holding the scene id and local progress).
- **Reload or back/forward without bfcache:** after the chapters are whole (`afterChapters()`), the anchor is restored (`immediate`) and the thread teleports (§5.3). With a hash, the hash wins.
- **bfcache:** no `unload` handler is used (it would disable bfcache). On `pageshow` with `persisted`, the director re-measures, resumes, and renders once.
- **Pins after restoration** are correct with no work, being sticky. The scrubbed state is recomputed from the restored position.

---

## 6. Page sections and exact copy

**Rules.** The copy below is the copy of the page. Strings already on the page are reproduced from the code, which is the source of truth. That includes its typographic apostrophes (’) and dashes, where the brief's section 4 uses straight ones. Every string is moved into `copy.ts` (§2.1) and imported from there by the live page, the static page and the tests. Strings marked **[NEW]** do not exist today. They follow the house voice: calm, short, second person, no hype, British spelling ("practise", "maths", "centre"). Numbers are never typed into copy. They are interpolated from `ARCHIVE_FIGURES`, `PLANS` or `ENGINE_RUN`, and a test fails on any digit in `copy.ts` outside an allow-listed problem statement (§16.1).

### 6.1 Navigation (`LandingNav.tsx`)

| Element | Copy |
| --- | --- |
| Skip link (first focusable; target `#idea`) | Skip to the content |
| Brand link (aria-label) | CalculixHub, back to the top |
| Wordmark | calculix**hub** |
| Section links (nav aria-label "Sections") | How it works · Try one · Topics · Past papers · Pricing |
| Buttons | Sign in · Start free |
| Menu toggle (aria-label) | Open menu / Close menu |
| Mobile menu (dialog aria-label "Menu") | the five section links; button "Start free"; link "I already have an account"; close button aria-label "Close menu" |

### 6.2 Hero (`Opening.tsx`)

| Element | Copy |
| --- | --- |
| Eyebrow | Competition mathematics · AMC to IMO |
| H1 | Stay with / the *question*. |
| Lead | Contest problems chosen to fit your level, each with a hint and a full solution. |
| Buttons | Find your level · Try a problem |
| Stats (value / label) | 2,195 / past problems · 233 / real exams · 1959–2026 / years of contests |
| Caption | Three short equations draw this one path. It never repeats, never crosses itself — *chaos, but it never gets lost.* |
| Cue | Scroll |

### 6.3 The idea (`Opening.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Not too easy. / Not too hard. / Just right. |
| Sub-headline | CalculixHub finds your level, then gives you problems that *fit.* |
| Link | See how it works |

### 6.4 Engine (`EngineStory.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Watch it find *your level.* |
| Note | Scroll to watch one student’s placement, answer by answer. |
| Beats (list aria-label "How placement works") | 01 It starts open-minded. / Before the first answer, any level is possible. · 02 Each answer narrows it down. / Right answers move the guess up. Misses move it down. · 03 Each question fits. / Not too easy, not too hard. · 04 It stops when it’s sure. / This time, after 13 questions. (13 = `ENGINE_RUN.steps.length − 1`) |
| Readouts | Questions · Level · How sure (screen-reader text: "Not sure yet" / "Sure enough to stop") |
| Level values | Foundation · Intermediate · Advanced · Olympiad |
| Axis and marker | easier · harder · YOU |
| Chart (aria-label) | The guess of one student’s level, after each answer. It was sure after 13 questions: Advanced. |
| Ticker | Q0 No answers yet; then "Q{n} {source} {domain} Right/Missed", with the domain in lower case. This run's lines: Q1 AMC 10 combinatorics Right · Q2 AMC 10 geometry Right · Q3 AIME number theory Right · Q4 AIME algebra Right · Q5 AIME combinatorics Right · Q6 AIME number theory Missed · Q7 AIME geometry Missed · Q8 AIME algebra Right · Q9 AIME number theory Missed · Q10 AMC 10 combinatorics Right · Q11 AMC 10 geometry Right · Q12 AMC 10 algebra Right · Q13 AIME combinatorics Right |
| Verdict | Level found / Advanced / Start with AIME problems. |
| CTA and note | Find your own level · Free account |
| Live announcement, after the scroll settles **[NEW]** | Question {n}: {source} {domain}, right. Level: {tier}. / …, missed. Level: {tier}. At the end: Level found: {tier}. Start with {source} problems. |

All values in braces come from `ENGINE_RUN` at build time, so the copy changes if the engine or the item bank changes.

### 6.5 Playground (`ChordPlayground.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Two chords. / One *hidden radius.* |
| Lead | Drag the chord wherever you like. One number refuses to move, and that is the way in. |
| Tag | The problem |
| Statement | Two chords of a circle meet at a point *P* inside it. |
| Givens (KaTeX) | $PA=9$, $PB=21$, $PC=7$, $PD=27$ · $\cos\angle APC=\tfrac{3}{5}$ |
| Ask | What is the square of the circle’s radius? |
| Answer field | label "Your answer for *r*²", placeholder "0 to 999", button "Check" |
| Feedback | Right: 289. Compare with the solution below. / Not quite. Hint: find the centre from the midpoints of the chords. |
| Toggle | Show the solution / Hide the solution |
| Solution steps (KaTeX) | 1. The intersecting-chord theorem gives $PA\cdot PB=PC\cdot PD=189$. Put $P$ at the origin with $PA$ along the vertical axis. 2. The perpendicular from the centre bisects each chord, so $O$ projects to $-6$ on line $PA$ and to $-10$ on line $PC$. 3. With $\cos\angle APC=3/5$, line $PC$ points along $(4/5,\,3/5)$. So $O_y=-6$, and $\tfrac45 O_x+\tfrac35(-6)=-10$ gives $O_x=-8$. 4. Then $OP^2=8^2+6^2=100$, and $r^2=OP^2+189=\boxed{289}$. |
| Figure bar | Move *C*. Watch what stays. (reset button aria-label "Reset to the problem’s starting figure") |
| Figure (aria-label) | Two chords AB and CD meet at P inside a circle. Turn chord CD with the slider, or drag point C. |
| Figure labels | A · B · P · C · D · 9 · 21 · O (with the solution) |
| Slider | label "Turn chord *CD*", aria-valuetext "{angle} degrees" |
| Readout | PC × PD · {near} × {far} · ≈ · always · 189 |
| Notes | Drag C, or use the slider. / The lengths change. Their product never does. |
| Live announcement, 500 ms after the chord stops **[NEW]** | PC × PD = {near} × {far}, still 189. |

### 6.6 Topics (`TopicsChapter.tsx`, `topicRooms.ts`, `TopicBoards.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Four kinds of problem. / Which one is *yours?* |
| Lead | Contest problems fall into four topics. Try one real problem from the archive in each. |
| Hand note | no sign-up, no timer — just have a go |
| Ghost formulas (aria-hidden) | a² + b² = c² · e^{iπ} + 1 = 0 · ∑ 1/n² = π²/6 · n! ≡ ? · (n choose k) · ∠ABC = 90° |
| Room: Algebra ∑ | "Rearrange it until it clicks." / "Equations, inequalities and clever substitutions." Problem "AMC 12B 2013 · Problem 6": Real numbers $x$ and $y$ satisfy the equation $x^2 + y^2 = 10x - 6y - 34$. What is $x + y$? Choices A $1$ · B $2$ · C $3$ · D $6$ · E $8$ (answer B). Hint: Bring everything to one side, then complete both squares. Reason: It becomes $(x-5)^2+(y+3)^2=0$. Two squares only add to zero if each is zero, so $x=5$, $y=-3$. |
| Room: Geometry △ | "One extra line, and the picture opens up." / "Circles, triangles and the lengths hidden in them." Problem "AMC 12B 2018 · Problem 4": A circle has a chord of length $10$, and the distance from the center of the circle to the chord is $5$. What is the area of the circle? Choices $25\pi$ · $50\pi$ · $75\pi$ · $100\pi$ · $125\pi$ (answer B). Hint: Draw a radius to one end of the chord. Do you see a right triangle? Reason: Half the chord is $5$ and the distance is $5$, so $r^2=5^2+5^2=50$ and the area is $50\pi$. |
| Room: Combinatorics ! | "Counting, without counting everything." / "Counting, arrangements and probability, without listing it all." Problem "AMC 12B 2018 · Problem 5": How many subsets of $\{2,3,4,5,6,7,8,9\}$ contain at least one prime number? Choices $128$ · $192$ · $224$ · $240$ · $256$ (answer D). Hint: The sets you want are hard to count. The ones you don’t want are easy. Reason: There are $2^8=256$ subsets in all, and $2^4=16$ of them use only $4,6,8,9$. So $256-16=240$. |
| Room: Number Theory ≡ | "Primes, remainders, and the odd surprise." / "Primes, remainders and very large powers." Problem "AMC 12A 2024 · Problem 4": What is the least value of $n$ such that $n!$ is a multiple of $2024$? Choices $11$ · $21$ · $22$ · $23$ · $253$ (answer D). Hint: Break $2024$ into primes first. Then ask where each prime first shows up in $n!$. Reason: Since $2024=2^3\cdot 11\cdot 23$, the prime $23$ has to appear, and it first does in $23!$. The $2^3$ and $11$ are already there. |
| Slip | choices group aria-label "Answer choices", letters A–E; "Need a nudge?"; status "Not quite — have another go." / "Only one left…" / "Yes — that’s it." |
| Room link | Start with {topic} / More {topic} (lower case: "Start with number theory") |
| Board drawings (aria-labels) | the four existing descriptions in `TopicBoards.tsx`, unchanged; the in-board lettering ("the missing piece!", "find the triangle first", "in or out?", "…and again, for all eight", "circle every prime", "then ask: when does n! have all of them?") unchanged |
| Foot | Can’t pick one? / Start with a short placement and we’ll find your level. · button "Find your level" |

The prompts are verbatim archive text ("center" in the geometry problem is the archive's own spelling) and are checked by `archiveSamples.test.ts`.

### 6.7 Archive (`ArchiveLadder.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Every past paper, / from *AMC to IMO.* |
| Lead | 2,195 problems from 233 past exams, 1959 to 2026. Take a whole paper, or one problem at a time. |
| Contest marquee (aria-label "Contests in the archive") | AMC 12A · AMC 12B · AIME I · AIME II · USAJMO · USAMO · USA TSTST · USA TST · IMO · IMO Shortlist (glyphs ∑ ∫ ≡ π ∞ √ ∂ ≅ ℤ ∴, aria-hidden) |
| Problem marquee | IMO 1959 · Problem 1 · AMC 12A 2024 · Problem 4 · AIME I 2010 · Problem 2 · USAMO 2022 · Problem 4 · IMO 1988 · Problem 6 · AMC 12B 2018 · Problem 5 · AIME II 2014 · Problem 9 · IMO 2000 · Problem 5, each with its verbatim prompt from `archiveSamples.ts` |
| Staircase (list aria-label "The archive, from easier contests to harder ones") | AMC 12 · Multiple choice · 580 problems — AIME · Answers 0 to 999 · 550 problems — USAMO · Written proofs · 540 problems — IMO · Written proofs · 525 problems |
| Sample card on each lifted top sheet | AMC 12A 2024 · Problem 4 · AIME I 2010 · Problem 2 · USAMO 2022 · Problem 4 · IMO 1988 · Problem 6, with their prompts |
| Axis | easier → harder |
| Note under the pinned track, desktop only **[NEW]** | Scroll to climb, one contest at a time. |
| Button | Open the archive |

### 6.8 Workspace (`JourneyStack.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Practise, compete, / get *unstuck.* |
| Card 1 | Find your level. / A quiz that adapts to every answer you give. / Find my level |
| Card 2 | Practise with hints and solutions. / Try a problem, take a hint, then read the full solution. / Start practising |
| Card 3 | Compete in timed contests. / Live, timed contests against other students. / See the Arena |
| Card 4 | A nudge, not the answer. / Stuck? The tutor asks a guiding question. You can also post the problem in the community. / Ask in the community |
| Pictures (aria-hidden) | Placement: "Before the first answer" / "Question {n}", the tier pill, caption "Each answer narrows it down." · Practice: tag "Algebra"; "If $x+y+z=0$, why does $x^3+y^3+z^3=3xyz$?"; "Look for a factor before you expand."; steps "$x^3+y^3+z^3-3xyz$", "$=(x+y+z)(x^2+y^2+z^2-xy-yz-zx)$", "$=0$", "✓ so the two sides agree" · Arena: "Live", "You" · Tutor: "I’m stuck on the two chords." / "What do you know about where two chords cross?" / "PA × PB = PC × PD?" / "Exactly. Now, where could the centre be?", label "Tutor" |

### 6.9 Desk (`DeskSection.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Pen, paper, / and *a date.* |
| Lead | Contest maths is done by hand, toward a day on the calendar. So every page has scratch paper under it, and your practice counts down to the day that matters. |
| Points | **Scratch paper** on every screen. Press S and it slides in beside the problem. · **A countdown** to your contest, with the weeks before it planned: build, sharpen, taper. · **A card to share** when a streak or a rank is worth showing someone. |
| Sheet (aria-label) | Scratch paper with a right triangle drawn on it. You can draw on it with a mouse, finger or stylus. |
| Sheet labels (aria-hidden) | 12 · 5 · 13 · h = ? |
| Tools (radiogroup "Tool") | Pen · Red pen · Highlighter · Eraser · button "Fresh sheet" |
| Nudge | go on, draw on it (fine pointer) · **[NEW]** tap the sheet to draw (touch, before the sheet is armed) |
| Disarm button, touch, while armed **[NEW]** | Done |
| Card | My contest is on · "{n} days to go" ("1 day to go") or "—" with "pick a day ahead of today" · track aria-label "{weeks} weeks: build, sharpen, taper" · legend "Build · Sharpen · Taper" · "**This week: {phase}.** {n} problems a day, your weakest topic first." · button "Start my countdown" |

### 6.10 Plans (`PlansSection.tsx`, `shared/plans.ts`)

| Element | Copy |
| --- | --- |
| H2 | Free to practise. / *Pro* for the season. |
| Billing (radiogroup "Billing period") | Monthly · Yearly *save 33%* (the saving = `yearlySaving(PLANS.pro)`) |
| Free | Free · **$0** for as long as you like · Everything you need to practise seriously. · features: Placement that finds your level · Adaptive practice with full solutions · Every past paper in the archive · Live Arena contests and the leaderboard · Scratch paper on every screen · Race-day countdown and today’s target · button "Create a free account" |
| Pro | Pro · yearly **$6** a month, billed $72 a year / monthly **$9** a month · For the season you are training for something. · Everything in Free, and · A week-by-week plan up to your contest date · Printable progress reports for parents and coaches · Every share-card design · Feedback on written proofs *in the works* · Mistake review that brings old errors back *in the works* · button "Start with Pro" (checkout on) / "Try Pro in the preview" (checkout off) · fine print: "Cancel any time. You keep Pro until the period you paid for ends." (on) / "Checkout isn’t open yet. Until it is, every account gets Pro’s features at no charge, and you’ll hear before that changes." (off) |
| Team | Team · yearly **$5** per student, a month, billed $60 a year / monthly **$7** per student, a month · For clubs, coaches and schools. · Everything in Pro, and · Pro for every student · A coach’s view of the whole group *in the works* · Private Arena contests for your club *in the works* · One invoice, seats you can reassign *in the works* · link "Tell us about your group" · "From 5 students, arranged with you directly." |
| Promises | **Free is not a trial.** Placement, practice, the archive and the Arena don’t expire. · **No adverts, no data for sale.** Pro and Team are what pay for the servers. · **Leave with your work.** Download everything, or delete your account, from Settings. |

Every name, price, unit and feature is read from `shared/plans.ts` at render (and at build for the static page and JSON-LD). Nothing in this table is typed into the page.

### 6.11 FAQ (`FaqSection.tsx`)

| Element | Copy |
| --- | --- |
| H2 | Questions, / answered. |
| Link | Ask in the community |
| 1 | What is CalculixHub? — A place to practise contest maths: find your level, solve real past problems, and learn from full solutions. |
| 2 | Do I need to be an Olympiad student? — No. The quiz finds a good starting point for you, from AMC up to IMO. |
| 3 | Is Free really free? — Yes. Placement, practice, every past paper and the Arena are free, with no trial clock and no adverts. |
| 4 | What does Pro add, and what does it cost? — $9 a month, or $72 a year. It adds a week-by-week plan up to your contest date, printable progress reports and every share-card design. Anything still being built is marked on the pricing table. (prices from `PLANS.pro`) |
| 5 | Can I cancel? — Any time, from the Plan page. You keep Pro until the period you paid for ends. |
| 6 | What if I get stuck? — Take a hint first. When you’re ready, read the full solution. You can come back to any problem. |
| 7 | How do the AI explanations work? — The tutor answers with Google’s Gemini. In Settings, under Live tutor, three steps walk you through getting a free key from your own Google account. Google’s free allowance covers normal practice, and anything beyond it is between you and Google, not us. |
| 8 | Can I take my data with me, or delete it? — Both. Settings has a download of everything stored about you, and a delete-account button that removes it for good. |

### 6.12 Final (`FinalStage.tsx`)

| Element | Copy |
| --- | --- |
| H2 | You’re allowed / to *not know yet.* |
| Lead | Cross things out. Try a smaller case. Come back tomorrow. |
| Card 1 | Try a problem / Pick one and give it a go. / Open practice |
| Card 2 (featured) | Find your level / A quiz that adapts as you answer. / Create a free account |
| Caption (aria-hidden, hand) | progress is rarely a straight line. |

### 6.13 Footer (`LandingFooter.tsx`)

| Element | Copy |
| --- | --- |
| Lede | Competition mathematics practice, AMC to IMO. |
| Wordmark | calculixhub. (screen-reader text "CalculixHub") |
| Links | iPhone preview · MacBook preview · Back to top |

### 6.14 Margin rails (`MarginRails.tsx`, aria-hidden)

The copy is unchanged; one element is added. The brief asks the left rail to show **the chapter number**, its name, and a spine with a comet. Today's rail shows only the name: its own comment says "the chapters themselves are not" numbered, and the header still mentions "a big rolling numeral" that is no longer drawn. **[NEW]** The left rail gains the numeral "01" to "10" above the chapter's title. It rolls to the next value when the chapter changes (y 0.6 em → 0 on `arrive`, the old value leaving upward), in Geist Mono with tabular figures. The right rail's plate keeps "Fig. 01" to "Fig. 10", so the number and the plate always agree.

Ten chapters, each as label / title / figure / note:

Opening / Stay with the question / Lorenz attractor / never repeats, never gets lost · The idea / Just right / A Gaussian bell / the sweet spot sits in the middle · How it works / Finding your level / Hyperboloid / straight lines, curved surface · Try one / Two chords / Circle & two chords / PA · PB = PC · PD · Topics / Four topics / Trefoil knot / the simplest knot that won’t undo · Past papers / Since 1959 / Double helix / one more rung every year · Practise / Get unstuck / Möbius strip / one side, one edge — keep going · Pricing / Free to practise / Tesseract / a cube, one dimension further · Questions / Answered / Torus / every loop comes back around · Begin / You’re allowed / Sphere / start anywhere, it’s all the same.

The plate tag reads "Fig. 01" to "Fig. 10". The readout is a three-digit percentage. The sixteen drifting formulas are unchanged.

### 6.15 Static reading version, for no-JS visitors and non-JS crawlers (§11.4)

Everything above, as plain semantic HTML in reading order, with these additions:

| Element | Copy |
| --- | --- |
| Note at the top of the reading version **[NEW]** | The moving figures and signing up need JavaScript. Everything to read is here. |
| Engine replay as a list (heading) **[NEW]** | One student’s placement, answer by answer. (then the 13 ticker lines and the verdict) |
| Topic room: answer, in a `<details>` **[NEW]** | Show the answer (opens to "{letter}: {choice}" and the reason) |
| Topic room: hint, in a `<details>` | Need a nudge? (existing copy, now a summary) |
| Chord problem: solution, in a `<details>` | Show the solution (existing copy) |
| Pro price, without the toggle **[NEW]** | $9 a month, or $72 a year. (the FAQ's own phrasing, from `PLANS`) |
| Team price, without the toggle **[NEW]** | $7 a month, or $60 a year, per student. |

The desk's live sheet and countdown are omitted from the static version, because both need script to mean anything. Its heading, lead and three points remain.

### 6.16 Page metadata **[NEW]** (§15)

| Element | Copy |
| --- | --- |
| Title | CalculixHub — Competition maths practice, AMC to IMO |
| Meta description | Practise contest maths from AMC to IMO. A short placement finds your level, and every problem comes with a hint and a full solution. |
| OG / Twitter title | CalculixHub — Stay with the question. |
| OG / Twitter description | 2,195 past problems from 233 real exams, 1959 to 2026. A short placement finds your level. (numbers from `ARCHIVE_FIGURES`, at build) |
| OG image alt | calculixhub, with its lowercase e logo: Stay with the question. A thread of light loops through the Lorenz butterfly on a night-blue stage. |

---

## 7. Interaction design

### 7.1 Magnetic buttons and spotlight cards

- **Magnetic** (kept from `kit.tsx`). The child moves toward the pointer by `strength × offset from centre`, on the magnetic spring (stiffness 260, damping 20, mass 0.5), and springs back on leave. Strength is 0.28 for primary buttons, 0.12 on the countdown card's button, and 0.06 on the final path cards. Fine pointer only (`(hover: hover) and (pointer: fine)`), and off under reduced motion. Change: the button's rect is read **once on `pointerenter`** and offset by the director's scroll delta after that. Today it is read on every `pointermove`, which is a layout read during a wheel scroll.
- **Spotlight** (kept: `useSpotlight`). A radial light at `(--sx, --sy)` across the card and along its border. Used on the plan cards, the final path cards and the topic rooms. Same change: the rect is cached on `pointerenter`. The properties are still written at most once per frame, now in the director's render phase.
- **Card tilt** (playground card, **[NEW] behaviour**): rotateX/rotateY toward the pointer, up to **4°**, on `SPRING.tilt`. A specular sheen (a soft white radial gradient at 7 % opacity, blended `soft-light`) follows the same point. While the pointer is on the card, both of its twins (§2.5, rule 5) have `will-change: transform`, so the compositor turns cached rasters. It is removed 300 ms after leave, so the SVG re-rasterises crisply at rest. This is the lesson of `Rise`'s "no scale on SVG panels", applied to rotation.

### 7.2 The cursor: native

There is no custom cursor. A JS-driven cursor lags the real one by at least a frame. It ignores the OS's cursor size and high-contrast settings. It hides the precise system cursors that two interactions here depend on: dragging C and drawing on the sheet. And it is decoration (cut, see [the concept rules](#the-concept-as-rules)). CSS cursors carry the meaning: `pointer` on controls; `grab` / `grabbing` on C (kept); `crosshair` on the sheet, `cell` with the eraser (kept); `ew-resize` on the chord slider (kept).

### 7.3 Pointer parallax limits

All of these are mouse-only and off under reduced motion. They return to rest on `pointerleave` of the window. None reads the DOM per move.

| Scene | What moves | Limit | Spring |
| --- | --- | --- | --- |
| Hero | the Lorenz group | ±5° yaw, ±3° pitch | `follow` |
| Hero | particles within 0.3 NDC of the pointer | curl-noise displacement of at most 0.05 clip units; +20 % alpha | `follow` (pointer power) |
| Playground | the problem card | ±4° tilt | `tilt` |
| Topics | each 3D glyph | ±10° tilt toward the pointer | `tilt` |
| Topics | ghost formula layers | 0.06 / 0.12 / 0.20 of the pointer's offset from centre, at most 24 px | `follow` |
| Desk | the lamp head and cone | ±4° | `tilt` |
| Rails (≥ 1,480 px) | the margin figure's lean | today's (yaw toward the pointer, tilt by its height) | today's |

No device-orientation parallax: iOS needs a permission prompt for it, and it is a vestibular trigger.

### 7.4 Drag

- **Chord C** (kept). `pointerdown` on the handle (hit radius 30 viewBox units) captures the pointer. The angle comes from `atan2` of the pointer against P, through the SVG's inverse screen matrix, clamped to −25°…155°. `touch-action: none` applies on the handle only and `pan-y` on the rest of the figure, so a finger can still scroll past it. The slider is the keyboard and single-pointer alternative (WCAG 2.5.7). Change: `getScreenCTM()` is read once on `pointerdown`, not on every move.
- **Scratch paper** (kept: `extendStroke`, `drawPage`, coalesced events, pointer capture). Changes:
  - **Mapping through the tilt.** Points use the event's `offsetX` / `offsetY`. Browsers give those in the target's local, untransformed space, so the three-quarter tilt does not distort the stroke. Today's code instead maps `clientX` through `getBoundingClientRect()`, which only works while the sheet is flat.
  - **Flatten on draw.** `pointerdown` flattens the sheet to face the camera, on `settle` (§3.2, scene 8). It tilts back 1.2 s after the last stroke ends, or when the sheet leaves the screen.
  - **Arm-to-draw on touch (fixes P8).** On a coarse pointer the sheet starts at `touch-action: pan-y`: a finger scrolls the page. A tap arms it. Then `touch-action: none` applies, the tools light up, "Done" appears, and strokes draw. It disarms on "Done", 4 s after the last stroke, or when it scrolls out of view. A pen (`pointerType === 'pen'`) draws at once, unarmed, because a stylus is never a scrolling gesture.

### 7.5 Hover, focus and pressed states

| Control | Hover (fine pointer only) | Focus (`:focus-visible`) | Pressed |
| --- | --- | --- | --- |
| Primary button (`.lx-btn`) | Magnetic pull; the icon circle fills; the colour fades over 0.35 s | 2 px ring, offset 4 px: accent on paper, cyan on ink; on glass, the dual ring (§12.3) | scale 0.965 in 0.1 s, released on `--lx-spring-snap` 0.6 s (kept) |
| Text link (`.lx-link`) | underline draws (kept) | ring | translate 0 1px (kept) |
| Nav link | the pill previews under the hovered link at 40 % opacity [NEW] | ring inside the island | the pill moves on `pill` |
| Card (plan, path, topic room) | spotlight; plan card rises 5 px (Pro 7 px, kept) | ring on the card's action, which is the focus target | scale 0.985 in 0.12 s (kept) |
| Answer choice (`.lx-opt`) | the paper lightens; the letter's circle inks in | ring | scale 0.97 |
| Toggle (billing, desk tools) | colour; tools scale 1.1 (kept) | ring on the checked radio | scale 0.96 / 0.88 (kept) |
| FAQ question | the sign scales 1.08 (kept) | ring on the whole row | the sign scales 0.9 (kept) |
| Chord handle | the halo grows (kept) | — (the slider carries focus) | `grabbing`; the halo holds |
| Slider | thumb grows | ring around the track | — |

### 7.6 Keyboard paths

| Scene | Tab order and keys |
| --- | --- |
| Nav | Skip link → brand → How it works → Try one → Topics → Past papers → Pricing → Sign in → Start free. On narrow screens: brand → Start free → menu toggle. The menu is a dialog: focus moves to its first link, Tab is trapped, Esc closes it and returns focus to the toggle (kept). `scroll-padding-top: 96px` on `html`, so a focused element never lands under the island (WCAG 2.4.11). |
| Hero | Find your level → Try a problem (to `#playground`) → Scroll (to `#idea`). |
| Idea | See how it works (to `#engine`). |
| Engine | No stops inside the replay: Space, Page Down, the arrows and the scrollbar scrub it, because the playhead is scroll. Each settled step is announced (§12.5). Find your own level is reachable while pinned. |
| Playground | Answer field (Enter submits) → Check → Show the solution → Reset → Turn chord CD (←/→ by 1°, which changes today's 0.1° step so a keyboard can cross the range; Home/End go to the limits). |
| Topics | In each room: the five choices → Need a nudge? → Start with {topic}. A struck choice stays focusable with `aria-disabled` and its status is announced. |
| Archive | Open the archive. Space and the arrows scroll the staircase, and the stack text is in reading order in the DOM. `beforematch` handling covers find-in-page (§12.7). |
| Workspace | The four card actions. Focus inside a card scrolls the page so that card is the top of the pile (`scrollToTarget` to the card's sticky position), so focus is never under a covering card. |
| Desk | Tools are one tab stop with arrows inside (roving tabindex, the ARIA radio pattern; a fix: today each tool is a separate stop) → Fresh sheet → date field (native) → Start my countdown. The sheet is pointer-only: drawing has no keyboard equivalent, and its label describes it. |
| Plans | Billing period, one tab stop with ←/→ (roving; a fix) → Create a free account → Start with Pro / Try Pro in the preview → Tell us about your group. |
| FAQ | Ask in the community → the eight questions (Enter/Space toggles; `aria-expanded`, `aria-controls`; the answer is a `region` labelled by its question, kept). |
| Final | Try a problem → Find your level. |
| Footer | iPhone preview → MacBook preview → Back to top. Back to top now also moves focus to the brand link once the scroll ends (a fix), so the next Tab starts at the top. |

### 7.7 Touch equivalents for anything hover-dependent

| Hover behaviour | On touch |
| --- | --- |
| Magnetic pull | None. The press state carries the feedback (a control that slides under a finger is one the finger misses: `kit.tsx`). |
| Spotlight on cards | A still, soft light at the card's top-left (the default `--sx` / `--sy`), plus the press glow. |
| Hero parallax and swirl | None. The thread's own flow is the motion. |
| Playground card tilt and sheen | None. The sheen rests at the top-left. |
| Glyph tilt | None. The idle bob remains. |
| Lamp parallax | None. |
| Nav pill preview | None. The pill marks the chapter in view. |
| Brand mark redraw on hover | The mark draws once on load (kept). |
| Desk tool `title` tooltips | Each tool has a visible shape and an `aria-label`. No information lives in the tooltip alone. |

---

## 8. Motion system

The base is `kit.tsx` and `landing-motion.css`. New tokens are marked [NEW].

### 8.1 Easing tokens

| Token | Value | Used for |
| --- | --- | --- |
| `GLIDE` / `--lx-glide` | `cubic-bezier(0.16, 1, 0.3, 1)` | Arrivals, fades, draw-ins: a fast departure that glides into place. |
| `SWEEP` / `--lx-sweep` | `cubic-bezier(0.65, 0, 0.35, 1)` | Things crossing the screen (the frame's sheen). |
| `--lx-press` | `cubic-bezier(0.2, 0.9, 0.3, 1)` | CSS press scales. |
| `EXIT` [NEW name; existing value] | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits (the menu closing). |
| `HAND` [NEW name; existing value] | `cubic-bezier(0.45, 0, 0.2, 1)` | Handwriting reveals (pencil notes, margin notes). |
| `TRAVEL` | expo in-out (`smoothScroll.ts`) | Page journeys, 0.9 s + distance / 5,200 px, capped at 2.2 s. |
| `SMOOTH` | smoothstep t²(3 − 2t) | Scrubbed blends: the engine's steps, the hand-offs' t_i. |
| `--lx-spring` | `linear(…)`: a damped spring, ratio 0.62, 8 % overshoot | CSS arrivals, including the whole hero entrance. |
| `--lx-spring-snap` | `linear(…)`: ratio 0.5, 16 % overshoot | CSS releases from a press. |
| linear | — | Marquee drift; direct scroll maps (the hero recede, word light, the track). |

Every CSS rule that uses `linear()` is declared twice: first with `--lx-glide`, then with the spring, for browsers without `linear()` (kept).

### 8.2 Springs

| Name | Parameters | Used for |
| --- | --- | --- |
| `arrive` | visualDuration 0.8, bounce 0.12 | Text coming to rest. |
| `settle` | visualDuration 0.9, bounce 0.06 | Cards, panels, the desk flatten, the FLIP track. |
| `press` | visualDuration 0.28, bounce 0.28 | Under a pointer or a finger: the billing thumb, the price swap, the ticker. |
| `follow` | stiffness 170, damping 26, mass 0.5 | Values chasing scroll or the pointer: stage arrival, the final line, parallax. |
| `tilt` [NEW] | stiffness 210, damping 24, mass 0.6 (damping ratio ≈ 1.07, so no wobble) | Tilt toward the pointer: the card, glyphs, the lamp. |
| magnetic | stiffness 260, damping 20, mass 0.5 | The magnetic pull (kept). |
| bead | visualDuration 0.6, bounce 0.32 | An answer landing (kept). |
| pop | visualDuration 0.5, bounce 0.4 | Points appearing (kept). |
| pill | visualDuration 0.45, bounce 0.18 | The nav pill (kept). |
| row | visualDuration 0.55, bounce 0.2 | Arena rows re-ordering (kept). |
| reading line | stiffness 140, damping 26, mass 0.4 | The nav's progress line (kept). |
| velocity | stiffness 300, damping 40 | Smoothing scroll velocity for the marquees (kept). |
| easy / hard | 46 / 7 / 1.3, and y 520 / 17 / 1.6 with scaleY [1.08, 0.86, 1] over 0.5 s at times [0, 0.32, 1] | The idea's acted words (kept). |

### 8.3 Duration scale (timed curves only; everything that moves through space is on a spring)

| Step | Seconds | Examples |
| --- | ---: | --- |
| instant | 0.10 | press down |
| quick | 0.25 | exits, a bead lifting away, the teleport fade-out |
| short | 0.35 | feedback swaps, FAQ text fade |
| base | 0.55 | `fade()`: the default opacity curve |
| medium | 0.80 | short draws, the FLIP settle's visual length |
| long | 1.10 | the hero's arrow |
| draw | 1.40 | figure draw-ins, the topic boards' strokes up to 0.9 each |
| count | 1.90 | count-ups |
| story | 2.60 | the thread's intro; the desk triangle |

### 8.4 Stagger rules

1. Words: 0.055 s in section headings and 0.07 s in the hero (kept).
2. List items: 0.07–0.1 s (stats, FAQ, points, promises).
3. A group's whole stagger never exceeds 0.6 s. With more than eight items, the gap becomes 0.6 / (n − 1).
4. Stagger only things that arrive together. A scrubbed value is never staggered in time: its spread lives in space (the hand-off's `uSpread`).
5. Within a scene, order follows reading order: heading → lead → the object → its controls.

### 8.5 Motion grammar

| Kind | What it is for | Values |
| --- | --- | --- |
| **Arrive** | Text and blocks entering the reading view | From y 14–44 px below (words: from 112 % below, out of a mask, rotate 2.5° → 0) on `arrive` (text) or `settle` (panels). Opacity on `fade()`. Never blurred; panels holding SVG are never scaled. |
| **Travel** | Things crossing the screen or the page | Page journeys on `TRAVEL`. The sheen on `SWEEP` 9 s. The marquee linear. The thread in a hand-off, scrubbed with SMOOTH per particle. |
| **Settle** | Heavy objects coming to rest | `settle` for cards, the desk flatten, the FLIP track. `follow` for stage arrival (scale 0.9–0.94 → 1, y 56 → 0). |
| **Follow** | A value chasing an input | `follow` for scroll-linked springs and parallax; `tilt` for tilt; the reading line's spring for the nav line. |
| **Press** | Under a finger | CSS scale 0.96–0.985 in 0.1–0.12 s, released on `--lx-spring-snap`; `press` for JS-driven swaps. |
| **Act** | Words that act out their meaning | The easy, hard and right springs (§8.2). Rewind on scroll back. |
| **Draw** | Pencil and chalk lines | `pathLength` 0 → 1 or clip 100 % → 0 on GLIDE, 0.9–1.4 s; handwriting on `HAND` 1.3–1.6 s. |

### 8.6 Under reduced motion

`MotionConfig reducedMotion="user"` drops transforms and keeps fades (kept). Beyond it: no Lenis; no idle motion (the thread's flow stops, the marquees and the frame's spin stand still, no bob); scrubbed scenes snap (the engine steps by whole answers, as today; hand-offs switch at their midpoint with a 200 ms opacity cross-fade; the archive uses the vertical ladder; the pile does not tip); no parallax or tilt; count-ups show their final figure; the final line is drawn whole; the footer letters stand; one paper ground (no tones). Every interaction still works.

---

## 9. Performance rules

### 9.1 Targets

| Target | Pass mark | Measured how (§16.3) |
| --- | --- | --- |
| Modern laptop (M1, Iris Xe; Chrome and Safari) | **60 fps** while scrolling the whole page: p95 frame interval ≤ 18 ms; ≤ 2 % of frames over 25 ms | Recorded trace on the device |
| Mid-range phone (Pixel 6a, iPhone 12, Galaxy A54) | **No long task over 50 ms while scrolling**; p95 frame ≤ 20 ms | Recorded trace on the device; CI proxy: 4× CPU throttle |
| LCP | **< 2.5 s** on 4G (pass); target 1.6 s | Phone profile: 412 × 823, Slow 4G, 4× CPU |
| CLS | **< 0.05** (pass); target 0 | Same, plus a full scroll |
| INP | **< 200 ms** (pass); target < 100 ms on desktop | Event Timing over scripted interactions |

### 9.2 Budgets

| Budget | Limit | Today |
| --- | ---: | ---: |
| HTML (gzip), including the static first frame, the reading version, inline critical CSS, the boot script and JSON-LD | ≤ 32 KB | 4.7 KB (empty `#root`) |
| Inline critical CSS (gzip) | ≤ 9 KB | 0 |
| Fonts requested before LCP | 1 file: Geist latin, 29.4 KB | 2 files (+ Newsreader italic, 146.9 KB) |
| JS before takeover (gzip): entry + landing shell | ≤ 200 KB until M11; **≤ 145 KB after M11** (entry ≤ 115) | 188 KB |
| Landing shell chunk (gzip) | ≤ 25 KB | 17.5 KB |
| Chapters (gzip): JS + KaTeX CSS | ≤ 40 KB + 3.4 KB | 28.7 + 78.3 KB (KaTeX JS) |
| Total 3D payload (gzip) | ≤ 180 KB: three ≤ 145, stage code and shaders ≤ 35; binary assets 0 | 136.4 KB (three + ParticleField) |
| Everything for a full read: all chapters, 3D, fonts (transfer) | ≤ 700 KB | — |
| Draw calls per frame | ≤ 8 in a scene; ≤ 12 during a hand-off | 1 |
| Triangles per frame | ≤ 150 k | — |
| Particles (thread + dust) | tier A 46,000 + 1,800 · tier B 28,000 + 1,100 · tier C 18,000 + 600 | high 46,000 + 1,800 · low 20,000 + 700 |
| Texture memory | ≤ 1.5 MB (planned ≈ 0.4 MB: Lorenz 256 KB, eight paths × 16 KB, belief 4.5 KB) | 256 KB |
| GPU buffers | ≤ 3 MB (particles ≈ 1.3 MB at tier A, using `RawShaderMaterial` with the vec4 as `position`, which drops today's 552 KB dummy position attribute) | ≈ 1.9 MB |
| DPR cap | tier A 2.0 · B 1.75 · C 1.5 · governor floor 1.0 | 2.0 / 1.5 |
| Main-thread work per frame (director + Lenis + motion + DOM writes) | ≤ 3 ms on an M1 at 1× · ≤ 8 ms on a Pixel 6a-class phone | — |
| GPU time per frame | ≤ 8 ms at tier A, 1440 × 900 at DPR 2, on M1 or Iris Xe | — |
| One chapter mount (one idle callback) | ≤ 50 ms on the phone profile | up to 381 ms (the longest load task) |
| Stage initialisation | split into ≤ 50 ms slices (renderer, thread, compile, each prop) | one block |

### 9.3 Device tiers

Decided once, at stage start-up (`capability.ts`):

- **S (2D)**: no WebGL2; a software rasteriser; `failIfMajorPerformanceCaveat` refused the context; Save-Data or a slow connection (§11.3); or the governor hit its floor twice in one visit.
- **C**: `(pointer: coarse)`, or viewport width < 760, or `hardwareConcurrency ≤ 4`, or `deviceMemory ≤ 4`.
- **A**: `(pointer: fine)` and `hardwareConcurrency ≥ 8` and the shorter screen side ≥ 800 and (`deviceMemory ≥ 8`, or unknown).
- **B**: everything else.

### 9.4 Adaptive quality: the governor

1. It samples frame intervals only during continuous rendering (at least 30 rendered frames in a row), and ignores gaps over 400 ms, as today.
2. It works in windows of 60 intervals and uses the median of the last 40.
3. **Overload**: a median above 20 ms for two windows in a row.
4. **A capped display is not overload.** If at least 90 % of intervals sit within ±1.5 ms of 33.3 ms (or 16.7 ms), the display is capped: iOS Low Power Mode, or a 30 Hz panel. It does not step down unless the GPU timer (`EXT_disjoint_timer_query_webgl2`, where it exists) shows GPU time above 80 % of the interval.
5. **What to lower.** If the GPU timer shows GPU time under 50 % of a slow interval, the frame is CPU-bound, so it lowers the particle share. Otherwise it lowers the DPR first.
6. **Steps.**

| Step | Particle share | DPR ceiling | Point size × | Idle animation |
| ---: | ---: | ---: | ---: | --- |
| Q0 | 1.00 | the tier's cap | 1.00 | full rate |
| Q1 | 0.75 | 1.5 | 1.08 | full rate |
| Q2 | 0.50 | 1.25 | 1.18 | full rate |
| Q3 | 0.36 | 1.0 | 1.30 | full rate |
| Q4 | 0.36 | 1.0 | 1.30 | 30 fps |
| Q5 | 0.36 | 1.0 | 1.30 | none: render on demand only |

7. **Stepping up.** After 10 s with a median under 11 ms and no scrolling, it climbs one step at a time, never above the tier's start. The level is kept in `sessionStorage`, so a reload starts where the last visit settled.
8. Changing DPR resizes the drawing buffer only when the step changes, never during a scroll gesture: a pending change waits for 300 ms without scroll.

### 9.5 Shaders compiled before they are needed

When the stage chunk arrives (§2.7, step 7), the renderer builds every material: the thread program plus the eight prop programs. Each prop group is made visible with `uFade = 0`. Then, at a moment when nothing on screen moves (no scroll for 300 ms, and not within cueAt + 1.5 s), it awaits `renderer.compileAsync(scene, camera)`, the non-blocking form of the brief's `renderer.compile`. That uses `KHR_parallel_shader_compile` where present, so compiling never blocks the main thread. Where the extension is missing, `compileAsync` still returns, and the stall happens in that same still moment rather than during scroll. Groups then return to hidden, and textures upload with `renderer.initTexture`, one per idle callback. No scene is ever the first to use a program, so no frame stalls on a compile during scroll.

### 9.6 Forbidden while scrolling

**Layout reads**, in any scroll-time path (the director's phases, scroll and pointer handlers, motion `onUpdate`): `getBoundingClientRect`, `getClientRects`, any `offset*` / `client*` / `scroll*` size (the single `scrollY` read in the read phase is the exception), `getComputedStyle`, `innerText`, `scrollIntoView`, `focus()` without `{ preventScroll: true }`, and SVG `getBBox` / `getTotalLength` / `getPointAtLength` / `getScreenCTM`.

**Paint-heavy writes**: `background-position`; `background-size` (one exception: a heading's pencil underline grows once, ≤ 0.9 s, ≤ 20 px tall); `box-shadow`; `filter` or `backdrop-filter` values; `border-radius`; `width`, `height`, `top`, `left`, margins and paddings; `clip-path` or `mask-image` strings on large elements (the rails' masks go: §0.4); writing an SVG path's `d` on a large SVG (the engine's SVG is written only in fallback mode); toggling `will-change`; adding or removing layers.

**React** state changes per frame. Only discrete changes set state: a new answer, a beat, a chapter, the nav tone.

**Allowed**: `transform` and its longhands (`translate`, `scale`, `rotate`), `opacity`, custom properties that only feed those, `visibility` on change, `textContent` on change, and WebGL uniforms.

### 9.7 Pausing

The director stops when the tab is hidden and sleeps when nothing changes (§2.3.6). A prop group is hidden whenever its scene is off screen. The marquees pause off screen (today's observer is kept; it reads nothing during scroll). The rails' canvases draw only while the rails are visible and not covered by a stage.

---

## 10. Mobile plan

### 10.1 Breakpoints

The existing breakpoints are kept and named:

| Name | Width | What changes |
| --- | --- | --- |
| XL | ≥ 1,480 px | The margin rails appear (kept). |
| L | 1,101–1,479 | The full desktop layouts. |
| M | 961–1,100 | The engine's columns narrow (kept); topics go to two columns (≤ 1,060, kept); plans go to one column (≤ 1,020, kept). |
| S | 901–960 | The final 3D tube is hidden; the mini butterfly blooms above the heading (§3.3). |
| XS | 761–900 | The engine goes to one column with only the active beat (kept). **The workspace pile unpins (kept). The archive's track becomes the vertical ladder, unpinned and without 3D stacks; the thread rests on the ladder's top edge. The desk stacks.** |
| Phone | 561–760 | The hero's form sits above the words (kept). The idea lines lose their indent (kept). **The desk sheet is flat: no three-quarter tilt; the lamp cone is smaller.** The footer follows the page (kept). No curl lips. |
| Small phone | 361–560 | Topics go to one column (kept); chord figure at full width (kept). |
| XXS | ≤ 360 | The nav CTA shows its icon only (kept). |
| Short screens | height ≤ 560 (or ≤ 660 on desktop widths) | The hero and the engine stop pinning and scroll past (kept). |

The engine stays pinned on phones, at 400 svh (300 vh of pinned scroll, as today), because the replay is the scroll.

### 10.2 Touch scrolling

Native momentum, always. Lenis is not created on `(hover: none)` devices. Even where it exists (a touch laptop), `syncTouch: false` leaves every touch to the platform. No scroll snapping, no `overscroll-behavior` overrides, no wheel or touch hijacking. `touch-action` is narrowed only on the chord handle and on an armed sheet (§7.4).

### 10.3 Particles and quality on phones

Tier C: 18,000 + 600 particles, DPR cap 1.5, idle-only scenes at 30 fps, and the governor (§9.4). Attached shapes need Lenis, so on phones they fall back to their DOM edges (§2.4.5).

### 10.4 Safe areas

`viewport-fit=cover` stays (`index.html`). The nav island's top is `max(12px, env(safe-area-inset-top))`. The hero frame insets by `max(var(--lx-frame), env(safe-area-inset-left / right))` in landscape. The menu pads by all four insets. The footer's bottom padding keeps `max(24px, env(safe-area-inset-bottom))` (kept). The fixed canvas covers the whole viewport, insets included.

### 10.5 The address bar

Pinned heights are in `svh` (kept), the ground layer in `lvh` (kept), and `dvh` is used only for the menu overlay. The director measures `100svh` with a probe and uses it for every offset. A height-only resize under 15 % on a coarse pointer is treated as the bar moving: no re-measure, no anchor restore (§2.4.3).

### 10.6 Low-power mode

iOS Low Power Mode caps `requestAnimationFrame` at 30 Hz. The governor's cadence test stops that from being mistaken for overload (§9.4, point 4). Idle-only scenes already run at 30 fps on tier C. Tested on an iPhone 12 with Low Power Mode on and off, and on a Pixel 6a with Battery Saver on (§16.5).

---

## 11. Fallbacks

### 11.1 No WebGL, or a software rasteriser

**Detection order:**

1. No WebGL2 context, or `failIfMajorPerformanceCaveat` refusal.
2. A renderer string matching `/swiftshader|llvmpipe|softpipe|software|basic render/i`, read from `gl.getParameter(gl.RENDERER)` first and from `WEBGL_debug_renderer_info` otherwise. On a match: `dispose()` and `forceContextLoss()`. A canvas that has held a WebGL context can never give a 2D one, so a fresh canvas is used (as today).

**What the page shows instead.** Every thread shape gets a 2D canvas or a static SVG drawing, painted once per scene change and on resize, never per frame. The rest of each scene is today's DOM:

| Scene | The thread's shape, without WebGL | The rest of the scene |
| --- | --- | --- |
| Hero | **Lorenz**: 9,000 points painted once in 2D from the same angle and framing (today's `drawFallback`). | The pearl frame (CSS). |
| Idea | **Rule**: the DOM rule itself, the foot's top border. | The CSS shadow at the sheet's edge; no curl. |
| Engine | **Belief curve**: the SVG chart's own area, line and glow, redrawn once per answer (step-snapped, as under reduced motion). | Bands and rug dots in the SVG (today's); DOM labels. |
| Playground | **Circle**: the SVG circle, over the figure's existing accent-soft radial glow. | The SVG figure (today's). |
| Topics | **Chalk dust**: 600 seeded specks painted once in 2D on the board's surface layer. | The DOM symbols; the CSS shake on a wrong choice. |
| Archive | **Stair edges**: a static SVG polyline in graphite along the tops of the ladder's bars. | The vertical ladder (today's bars and figures). |
| Workspace | **Card outline**: the same DOM outline as the live page (§3.3), which needs no WebGL. | The CSS 3D pile. |
| Desk | **Into the pencil**: the demo triangle on the 2D sheet is the line (today's). | The CSS tilt and flatten; no pencil or cone. |
| Plans | **Pro perimeter**: the CSS pearl tube. | — |
| FAQ | **Margin line**: a CSS `border-left` on the list, with a dot at the open question. | — |
| Final | **Tube**: the SVG line and its tip (today's), placed from the arc-length table. **Mini Lorenz**: 600 points painted once in 2D at the line's end, once drawn ≥ 0.92. | — |
| Footer | — | The CSS reveal (today's). |

### 11.2 `prefers-reduced-motion: reduce`

No smooth scroll (Lenis is not created). Nothing moves on its own. Scrubbed scenes snap to their states, and every interaction works (§8.6 lists each case). The stage still renders, but only when the scroll changes what it shows, with no flow, no intro assembly (a 600 ms fade instead), no parallax and no camera moves.

### 11.3 Save-Data or a slow connection

Triggered by `navigator.connection.saveData`, an `effectiveType` of `slow-2g`, `2g` or `3g`, a `downlink` under 1.5 Mbps, or `prefers-reduced-data: reduce`. Then: tier S, so three.js is never requested (−180 KB gzip). The rails' flow fields stay off. Fonts are unchanged, because the math and the hand notes need them. The static first frame means such a visitor still gets a 1.x-second hero.

### 11.4 JavaScript disabled

- The static first frame (nav, hero, sheet) and the reading version of every chapter are real HTML in `#lx-static`, beside `#root` (§2.6). Without script, `html[data-js]` is never set, so the reading version shows and the hero sits in its settled state: the hidden entrance state applies only under `html[data-js]:not([data-cue])`.
- `<noscript><style>html #boot { display: none; }</style></noscript>`, after the boot styles and more specific than them, keeps the night cover from sitting over the page.
- Every link is a real `href`. Answers that need a click become `<details>` (§6.15). The reading version's formulas are MathML, typeset at build time, which browsers render natively, so no stylesheet is needed.
- The reading version's note says what needs JavaScript (§6.15).

### 11.5 WebGL context loss and recovery

- `webglcontextlost`: `preventDefault()`, stop the loop, and paint the current scene's 2D fallback on a fresh 2D canvas laid over the stage's place. The DOM fallbacks of §11.1 switch on for the visible scene.
- `webglcontextrestored`: three re-initialises its state. Path textures, belief data and geometry are re-uploaded from their CPU copies, which are always kept. Shaders recompile with `compileAsync`. On the first good frame the 2D overlay fades out (300 ms).
- More than two losses in five minutes: tier S for the rest of the visit.
- On unmount, `dispose()` and `forceContextLoss()` (kept).

Older browsers: without `linear()`, the GLIDE fallback applies (kept). Without `svh`, the `vh` declared first applies. Without `FontFace`, the cue fires two frames after the boot script runs; a face that never loads is cued at 900 ms.

---

## 12. Accessibility

### 12.1 Text stays real DOM text

- No word, number, label or control exists only in WebGL. The canvas is `aria-hidden="true"`, has no role, and takes no pointer events.
- 3D objects that carry meaning keep a DOM twin in the accessibility tree. The engine's SVG chart stays at `opacity: 0` (still exposed, unlike `visibility: hidden`) with its `role="img"` and label. The archive's staircase is an `<ol>`. The beads' ticks and crosses repeat what the ticker already says in words.
- Headings, landmarks and lists as in §15.3.

### 12.2 Contrast on every ground tone (WCAG 2.2 AA)

Computed from the tokens (OKLCH → sRGB, gamut-clipped). Full tables in [Appendix B](#appendix-b-contrast-tables).

- **Body text passes everywhere.** Ink, body, muted and accent on paper, paper-raised, morning, parchment, sage, cream, dusk and lamplight: the lowest is muted on dusk at 4.82:1. On the night stages every on-night token and the cyan, brass, cream and coral accents score 6.05:1 or better.
- **Fix 1, pencil text.** `--lx-pencil` (oklch 55 % 0.13 40) reaches only 4.24:1 on dusk and lamplight and 4.46:1 on parchment. Add **`--lx-pencil-text: oklch(52% 0.13 40)`** (#a54a28: ≥ 4.82:1 on every paper ground) for pencil-coloured text under 24 px (18.66 px bold): the chord lengths, the countdown label, the tutor tag, the wrong-answer feedback. The 55 % pencil stays for strokes and large hand notes (3:1 suffices there).
- **Fix 2, the paper-tone nav labels.** `--nav-dim` on paper (oklch 40 % at 86 % alpha) reaches 4.18:1 over paper and 3.71:1 over a stage edge. Make it the opaque `--lx-body`: 8.50:1 over paper, 6.50:1 over a stage edge.
- **Fix 3, topic colours as marks on paper.** #f3b65b, #46d0b9, #a78bfa and #3dbcf5 reach 1.65–2.49:1 on paper, against 3:1 for non-text marks. On ink they score 5.27:1 or better, so keep them for ink stages. Add paper variants at L 56 %: `--lx-w1-ink` oklch(56 % 0.12 70) #a06604 · `--lx-w2-ink` oklch(56 % 0.10 180) #098777 · `--lx-w3-ink` oklch(56 % 0.14 295) #7c60bd · `--lx-w4-ink` oklch(56 % 0.11 235) #1c7eab. All are ≥ 3.65:1 on the darkest paper ground. Use them wherever a topic colour marks something on paper (the placement picture's dots, any chip).
- **Light behind text.** Inside a text-safe zone the thread's alpha is multiplied by 0.25 (§2.3.5). The rule it enforces: the composited background behind hero or engine copy must keep relative luminance ≤ 0.10. That keeps `--lx-on-night-body` at ≥ 4.5:1 (and the title far above). A Playwright check renders the stage with the DOM text hidden, samples the canvas under every copy box, and fails above 0.10 (§16.3).
- **The nav's ink glass is only correct over ink.** At 42 % alpha over paper, its text would fall to 1.63:1. The director therefore decides the tone from the 34 px band under the island with a 1 % hysteresis and switches it in the same frame the band changes. A test scrolls across every tone boundary and samples the island's text contrast at each frame (§16.3).

### 12.3 Focus visible on glass

The ring is 2 px solid, offset 4 px (kept): accent on paper, cyan on ink. **On glass** (the nav island, frosted surfaces), a dual ring: `outline: 2px solid var(--ring); outline-offset: 3px; box-shadow: 0 0 0 5px var(--ring-halo)`. Here `--ring-halo` is paper at 85 % on ink glass and ink at 70 % on paper glass, so the ring stays ≥ 3:1 against whatever is blurred behind it (WCAG 2.4.11 and 1.4.11). `scroll-padding-top: 96px` keeps focused elements clear of the island. The island never hides while it holds focus (kept).

### 12.4 Skip link, landmarks and order

The skip link "Skip to the content" (to `#idea`) stays the first focusable element (kept). The DOM order is the reading order in every scene, including the pinned ones and the horizontal track. The track moves its row with transforms only, so its DOM order stays family by family, easier to harder.

### 12.5 Live readouts

| Region | Politeness | When it speaks |
| --- | --- | --- |
| Engine ticker | polite | Once the scroll has been still for 400 ms: "Question {n}: {source} {domain}, right/missed. Level: {tier}." (§6.4). Never on every frame of a scrub. |
| Engine verdict | polite | Once, when beat 4 is reached: "Level found: {tier}. Start with {source} problems." |
| Playground feedback | `role="status"` (kept) | On Check. |
| Playground invariant | polite | 500 ms after the chord stops moving: "PC × PD = {near} × {far}, still 189." |
| Topic slips | polite (kept) | On each choice. |
| Countdown | polite (kept) | On a date change. |

### 12.6 Motion and vestibular safety

Reduced motion as §8.6 and §11.2. Without that preference, the largest scroll-linked movements are still bounded: no full-screen rotation, no horizontal motion opposite to the scroll except the archive track (a 12° plane moving sideways at reading speed), no zoom past 0.9 → 1, and no flashing (the brightest change, the hero's spark, is a few pixels and well under three flashes a second).

### 12.7 Scrolling stays native

Lenis keeps the browser's own scrolling, so the scrollbar, keyboard scrolling, find-in-page, anchor links, pinch-zoom and 200 % text zoom all work. Pins are CSS sticky. Nothing listens to the wheel to cancel it, and no element sets `overflow: hidden` on the page except the mobile menu's scroll lock (kept). **Find-in-page on the horizontal track:** each stack's text block carries `hidden="until-found"` only while it is off screen to the side. On `beforematch` (Chrome, Edge), the director scrolls the page to that stack's progress before the browser reveals it. Safari does not support `until-found` yet; there the text stays matchable, and the director checks the find selection on `selectionchange` to scroll to the stack that holds it.

### 12.8 Forced colours and higher contrast

Under `forced-colors: active`, the canvas, grain, pearl frame and ground tones are hidden (`display: none`), controls keep system colours and borders, and SVG strokes use `currentColor` (kept). Under `prefers-contrast: more`, the grain and the ground tones are dropped, `--lx-muted` takes the body colour, and the nav glass becomes opaque.

---

## 13. 3D asset list

Every asset is made in code. **The page downloads no 3D asset, texture or model.** No sourced asset is needed for v1. If art direction later wants a scanned paper grain, the sources allowed are CC0 (Poly Haven, ambientCG), at ≤ 64 KB as KTX2, and it would be listed here first.

| Asset | How it is made | Download | GPU memory | Licence |
| --- | --- | ---: | ---: | --- |
| Lorenz path | `lorenzPath(16384)`: RK4 on Lorenz's σ 10, ρ 28, β 8/3, after a warm-up of 25 time units (kept, tested) | 0 | 256 KB (RGBA32F) | own code |
| Thread layout | `flowLayout(threads, dust)`, shuffled (kept, tested) | 0 | ≈ 1.3 MB at tier A | own code |
| Rule, circle, stair edges, card outline, Pro perimeter, margin line, final tube path, mini Lorenz | `stage/thread/paths.ts`, from cached DOM rects and known constants (pure, tested) | 0 | 16 KB each (RGBA16F, 2,048 samples) | own code |
| Belief data | every posterior step of `ENGINE_RUN`, 81 × 14 | 0 | 4.5 KB (R32F) | own code |
| Sheet curl lip (top and bottom) | `PlaneGeometry(1, 1, 1, 24)`, bent around a cylinder in the vertex shader; paper-shade underside with a 1 px highlight | 0 | < 2 KB | own code |
| Contact shadow | one quad, analytic gaussian in the fragment shader | 0 | — | own code |
| Belief ribbon fill | `PlaneGeometry(80, 1)` displaced from the belief data; vertical cyan gradient | 0 | < 8 KB | own code |
| Beads | instanced quads (13), billboarded; sphere shading and the tick or cross as SDFs in the fragment shader; topic colour per instance | 0 | < 2 KB | own code |
| Glass tier slabs | `BoxGeometry` instanced × 4; fake frost: fresnel rim + low-alpha fill + hash-noise grain; no transmission target | 0 | < 2 KB | own code |
| Circle in light | the thread itself on the circle path | 0 | 0 | — |
| Chalk dust | the thread itself in dust mode, plus burst and swirl subsets; a soft disc with hash grain in the shader | 0 | 0 | — |
| Four glyphs ∑ △ ! ≡ | `Shape` outlines built procedurally from strokes (∑ five bars, △ a triangle ring, ! a bar and a dot, ≡ three bars), with rounded joins, then `ExtrudeGeometry` (depth 0.18 em, bevel 0.02, 6 curve segments; about 2–4 k triangles each). Chalk material: value noise in the shader, a fixed key light, a soft rim. No font outlines are used, so no font licence applies. | 0 | < 200 KB | own code |
| Chalk ring | a `TubeGeometry` loop following today's hand-drawn `ring()` path, drawn by `drawRange` | 0 | < 20 KB | own code |
| Exam stacks | `BoxGeometry` sheet (1 × 0.005 × 1.4) as one `InstancedMesh`: 24 / 33 / 43 / 54 sheets (0.44 / 0.61 / 0.80 / 1.00 × 54), per-instance jitter ±0.6 % offset and ±0.8° turn; the four top sheets as separate instances with a lift rotation; paper shader with edge darkening | 0 | < 50 KB | own code |
| Pencil | merged geometry: a hexagonal `CylinderGeometry` body (6 segments) in brass, a cone of cream wood, a graphite tip, a ferrule and an eraser; vertex colours; about 600 triangles | 0 | < 40 KB | own code |
| Lamp cone | open `CylinderGeometry` (top radius 0.05, bottom 1, 32 segments), additive; radial and height falloff with a hash-noise shimmer | 0 | < 20 KB | own code |
| Final tube and tip light | `TubeGeometry` on a `CatmullRomCurve3` through 400 points sampled from today's `PATH`, z(u) = −900 u^1.4 px; radius tapered 2.6 → 1.2 px in the shader; arc-length table for the tip; tip = one point sprite | 0 | < 300 KB | own code |
| Pearl edge (hero) and pearl tube (Pro) | CSS: one rotating conic gradient behind a still veil (`HeroGlow.tsx`, kept, and its card-sized copy) | 0 | — | own code |
| Noise | procedural (hash and value noise in GLSL); no texture | 0 | 0 | — |
| Matcaps, HDRIs | none: lighting is analytic | 0 | 0 | — |
| Fonts (DOM only) | Geist, Geist Mono, Newsreader, Caveat via `@fontsource-variable` (already shipped) | as today | — | SIL OFL 1.1 |
| KaTeX stylesheet and fonts (DOM only) | `katex.min.css` 24.1 KB (3.4 KB gzip); fonts loaded on demand by it (already shipped) | as today | — | MIT (the `katex` package) |
| Libraries | three 0.180.0, Lenis 1.3.26, motion 12.42.0, KaTeX 0.18.1 | — | — | MIT |

---

## 14. Loading strategy

### 14.1 The first response and the first chunk

| What | Contents | Budget | Priority |
| --- | --- | ---: | --- |
| `index.html` | boot script (theme, boot variant, `data-js`, cue); inline critical CSS; Geist `@font-face`; the static nav, hero and sheet; the reading version; `<noscript>` block; JSON-LD; canonical | ≤ 32 KB gzip | the document |
| Geist latin (woff2) | the only preloaded font | 29.4 KB | `preload`, high |
| Entry chunk | React, motion, the app gate (and Supabase until M11) | ≤ 171 KB → ≤ 115 KB after M11 | module, high |
| Landing shell chunk | `LandingPage`, `LandingNav`, `Opening`, `LandingFooter`, `GroundTones`, the director, Lenis, `copy.ts` | ≤ 25 KB gzip | asked for by `Welcome` as today |
| Landing CSS (non-critical part) | everything not inlined | ≤ 20 KB gzip | with the landing shell |

### 14.2 Lazy-loaded, and when

| Chunk | Asked for | Mounted or used |
| --- | --- | --- |
| Chapters (`LandingChapters` and the nine chapters, prebaked math, KaTeX CSS) | as soon as the landing shell runs (today's `chaptersCode` import, so the download overlaps the first paint) | one chapter per idle moment from cueAt + 1,350 ms, or at the first wheel, touch or key; all at once for a hash, a nav link or reduced motion |
| Margin rails | with the chapters | after every chapter is in (today's `whole`), on XL only |
| Item bank and IRT (6.4 KB) | with the chapters, since `engineRun.ts` imports them | at import (the replay is computed once) |
| Stage (three, renderer, thread, props, shaders) | after the chapters are in (or 5 s), at `whenIdle(…, 800)`; never on tier S | renderer and thread first; compile at a still moment; props one per idle callback, nearest scene first; a nav jump's target first |
| Forms (`WelcomeScreen`) | at 5 s + idle (kept), or on hover or focus of any sign-up control [NEW trigger] | on click |

### 14.3 Formulas typeset at build

`scripts/landing-math-plugin.mjs` is a Vite plugin providing `virtual:landing-math`. At build it collects every formula string the landing uses: the exports of `topicRooms.ts`, `archiveSamples.ts`, `copy.ts` (solution steps, givens, the placement picture's lines) and the rails' `FORMULAS`. It splits each with `MathText`'s own segment pattern (moved to `src/lib/mathSegments.ts` and shared), renders every math segment with `katex.renderToString` at the installed KaTeX version, and emits a map from source string to HTML. `<PrebakedMath text="…"/>` looks the string up and renders the HTML. In development, a miss falls back to `MathText`. In production, a miss fails the build. A unit test checks that the map covers every landing string and that each entry matches a fresh `renderToString`.

### 14.4 Chapters, one per idle moment

Kept exactly (`LandingChapters.tsx`): `count` starts at 1 and grows by one per `whenIdle(…, 400)`, inside `startTransition`, with the blank `lx-chapters-hold` paper below. New: a chapter whose mount exceeds 50 ms on the phone profile (§9.2) is split. The topics chapter mounts its rooms in two idle steps (two rooms each). The desk mounts the sheet and the card separately. The director re-measures once per mounted chapter (the `ResizeObserver` on `main`), never per frame.

### 14.5 The content security policy

- The inline boot script grows (§2.6), so its hash changes. It is pinned in three places, all of which must change together: `THEME_BOOT_SCRIPT_HASH` in `server/security.ts`, the `Content-Security-Policy` header in `vercel.json`, and the generated `api/*.mjs` bundles (rebuilt by `npm run build:vercel`). `server/__tests__/guarantees.test.ts` fails until they agree (documented in `docs/design-refresh-report.md`).
- JSON-LD is a data block, not a script the browser runs, and it is injected into `dist/index.html` at build. The source `index.html` the guarantees test reads therefore keeps a single inline script.
- `img-src 'self' data:` and `worker-src 'self'` allow no `blob:` URLs. Every texture is a `DataTexture`, and nothing runs in a blob worker (another reason troika is rejected).
- `style-src 'unsafe-inline'` already permits the inline critical CSS.

---

## 15. SEO and sharing

### 15.1 Title, description, canonical

The title and description are in §6.16 (both [NEW], pending the owner's choice in §18 Q1). Add `<link rel="canonical" href="https://calculixhub.com/">` [NEW], because `?home=1` and the preview parameters create duplicate URLs. Add `public/robots.txt` (allow all, point to the sitemap) and a one-URL `public/sitemap.xml` [NEW]. Both are static files naming the production origin. A crawler reads `robots.txt` only at a host's root, and the canonical link and the sitemap point a GitHub Pages mirror (served under a sub-path) at `calculixhub.com` rather than competing with it, so nothing is rewritten for `--base`.

### 15.2 OG image direction

1200 × 630 PNG, ≤ 300 KB, regenerated by `scripts/og-image.mjs`, a Playwright script that renders the real stage. The night stage inside the pearl frame. The Lorenz thread at rest at a fixed seed and time, no pointer, framed right of the words as on desktop. The headline "Stay with the question." in Geist 560 with the pencil stroke under "question". The wordmark bottom-left. No figures that could date: the archive numbers appear in the OG description, built from `ARCHIVE_FIGURES`, not in the image. Bump `og-image.png?v=` to 3 (the comment in `index.html` explains why).

### 15.3 Semantic structure

One `h1` (the hero). One `h2` per section. `h3` for the engine's beats, the topic rooms, the workspace cards, the plan names and the FAQ questions (kept). Landmarks: `header` (nav) → `main` → `footer`. Every section is labelled by its heading (`aria-labelledby`, kept). Lists stay lists: hero stats `dl`, beats `ol`, staircase `ol`, FAQ articles, features `ul`.

### 15.4 Structured data (JSON-LD, written at build from source data)

- `Organization` (name, url, logo) and `WebSite` (name, url).
- `WebApplication`: `applicationCategory: "EducationalApplication"`, `operatingSystem: "Web, iOS"`, and `offers` built from `PLANS`: Free $0; Pro $9 a month and $72 a year; Team $7 a month and $60 a year per student, `eligibleQuantity` min 5.
- `FAQPage` from the eight questions in `copy.ts`. Since August 2023, Google shows FAQ rich results only for well-known government and health sites, so this is semantic data with no rich result expected (§18 Q8).
- Nothing the page cannot stand behind: no `AggregateRating`, no `Review`, no user counts.

### 15.5 Crawlers and the 3D layer

The canvas holds no content. Crawlers that do not run JavaScript read the static first frame and the reading version (§11.4). Crawlers that do run it (Googlebot) see the live DOM: the chapters mount on idle callbacks within a few seconds (nine callbacks with a 400 ms timeout each, so at most about 3.6 s). The static markup is removed from the DOM on takeover, so no hidden duplicate remains.

---

## 16. QA and acceptance criteria

### 16.1 Unit tests (vitest, node)

Kept: all 25 cases. New:

- `engineFrame`: holds at both ends; `answered` and `beat` match today's thresholds; step blends are monotone; snapping under reduced motion.
- `threadState`: every hand-off gives exactly A at m = 0 and B at m = 1; it is continuous in *p*; no NaN anywhere on a 0–1 sweep.
- `paths.ts`: each path is finite, sits inside its rect, and has the sample count stated.
- Layout maths: scene progress for each offset form; the anchor round-trips on resize.
- The prebaked math covers every landing formula (§14.3).
- **Honesty.** `copy.ts` contains no digit outside an allow-list of problem statements (each already checked against the archive). Every displayed figure is traced to `ARCHIVE_FIGURES`, `PLANS` or `ENGINE_RUN`.
- The CSP guarantees test (kept), with the new hash.
- **The entrance** (`entrance.test.ts`, M1): the takeover's resume point and the count-up rule; the figures' CSS delay equals `STATS_APPEAR`; the CSS waits for the face as long as the boot script; the CSS rise is motion's `arrive` spring, sampled.
- **The static first frame** (`static/entry-static.test.ts`, M1): the headline as real text, nothing readable hidden by an inline style, settled figures, sign-up links, no inline script or handler, unique ids, the same HTML on every build.
- **The reading version and the JSON-LD** (`static/reading.test.ts`, `static/jsonLd.test.ts`, `copy.test.ts`, M1): against `copy.ts`, `PLANS` and `ENGINE_RUN`, and every chapter renders its `copy.ts` strings.

### 16.2 Checklist per scene

Each scene passes in live, reduced-motion and no-WebGL modes, at desktop and phone.

| Scene | Must be true |
| --- | --- |
| Hero | First paint from HTML, with no cover. The entrance starts at the cue, even with JS blocked. Takeover is pixel-identical (≤ 0.2 % of pixels differ). The buttons work before and after takeover. Parallax stays within ±5° / ±3°. The swirl only within the radius. The thread assembles in 2.6 s. Count-ups never reset. The canvas luminance under the copy is ≤ 0.10. |
| Sheet | The lip follows the edge on desktop and is absent on touch. The butterfly never shows through the paper. The line lands on the rule. The acted words rewind. |
| Engine | 13 answers; beats at the right answers; the ticker matches `ENGINE_RUN`; the verdict reads Advanced and AIME; DOM labels sit on their 3D points (≤ 1 px); reversing gives identical frames; announcements debounced; the SVG fallback is equivalent. |
| Playground | The light circle sits under the SVG circle (≤ 1 px, desktop). The card tilt stays ≤ 4°. Dragging C keeps 189. The slider moves 1° per key. 289 is accepted. The solution toggles. The live readout is spoken. |
| Topics | Dust settles behind the slips. Glyphs tilt ≤ 10°. Wrong → shudder and puff. Right → ring and swirl, then the explanation. Every choice is keyboard-operable. The board drawings play once. |
| Archive | The track pins for 280 vh. The stacks are tilted 12°. Each top sheet lifts at the centre, scrubbed. Counts up once; format labels appear. The sample cards show the archive's text. The marquee skew stays ≤ 5°. ≤ 900 px gives the vertical ladder. Find-in-page reaches each stack. |
| Workspace | The tip-back uses the stated angles. Only the top card's picture runs. The outline passes from card to card. Focus never lands under a covering card. |
| Desk | The three-quarter tilt; flatten on pointer down; strokes land under the pen at any tilt. On touch, a finger scrolls until the sheet is armed. The pencil rides the triangle. The track re-lays itself out on a date change. |
| Plans | Prices exactly as `plans.ts` for both periods. The thumb slides; the price lifts. Pro raised, with the tube. Checkout wording for both states. |
| FAQ | The heading sticks. Answers open by easing their height and fading their text up. The plus turns into a minus. The loop marks the open answer (desktop). |
| Final | The line follows the scroll through the spring. The tube recedes. The tip rides the end. The butterfly blooms at 92 %. A phone shows the butterfly above the heading. |
| Footer | The lip curls on lift (desktop). Letters rise. Back to top moves focus to the brand. |
| Nav | The tone is correct at every boundary (contrast ≥ 4.5:1 per frame). The pill tracks the chapter. It hides on scroll down and returns on scroll up. The menu traps focus. |

### 16.3 Playwright: screenshots, vitals and traces (`qa/landing/`)

- **Screenshots** at fixed progress **0, 0.1, 0.2 … 1.0** (eleven points): `scrollTo(p × (docHeight − innerHeight))`, then `await __LX_TEST__.settled()` (from M2, when the director provides it; until then a fixed wait longer than the slowest spring). At **desktop 1440 × 900** and **phone 390 × 844**. In the **light and dark themes** (`localStorage.calculix_theme`): the landing must look the same in both, and the dark run catches any app-level dark token leaking in and checks the `theme-color`. In three modes: **live** (WebGL; on CI, SwiftShader is allowed in test mode so the live path renders), **reduced motion**, **no WebGL**. That is 11 × 2 × 2 × 3 = 132 images, named `{mode}-{viewport}-{theme}-p{00..10}.png`. Tolerance: `maxDiffPixelRatio` 0.002 for DOM-only frames, 0.01 where the canvas draws.
- **Vitals** (blocking): the phone profile (412 × 823, Slow 4G 150 ms / 1.6 Mbps, 4× CPU), median of three runs. **LCP ≤ 2,500 ms, CLS ≤ 0.05**, and the LCP element must be the static `h1` (or its words).
- **Scroll trace** (blocking): desktop 1440 × 900 at 4× CPU, the full page by wheel (100 px every 40 ms), with a Chrome trace (`devtools.timeline`) and a long-task observer. Pass: **0 long tasks over 50 ms after M10** (≤ 10 and none over 100 ms at M2); p95 main-thread work per frame ≤ 8 ms.
- **INP proxy** (blocking): Event Timing over Check, a topic choice, an FAQ toggle, the billing toggle and a date change. The longest interaction must stay ≤ 200 ms at 4× CPU.
- **Bundle budgets** (blocking): `budgets.json` against the gzip sizes in the build manifest (§9.2).
- **Contrast probes**: the luminance under the copy (§12.2) and the nav's per-frame contrast across tone boundaries.

### 16.4 Fallback passes

| Pass | How | Must be true |
| --- | --- | --- |
| Reduced motion | `emulateMedia({ reducedMotion: 'reduce' })` | No Lenis instance. At most 2 rAF callbacks in any idle 2 s. Every scene readable and every interaction working. Screenshots match their snapshot set. |
| No WebGL | Chromium with `--disable-webgl --disable-3d-apis`, and a software-renderer string injected | 2D fallbacks shown. No three.js chunk requested. No console errors. |
| JS off | `javaScriptEnabled: false` | No cover. The hero settled. Every section heading, the problems, the prices and all eight FAQ answers readable. Every link resolves. |
| Save-Data | `Save-Data: on` header plus a `navigator.connection` override | No three.js chunk requested. |
| Context loss | `WEBGL_lose_context.loseContext()` mid-scroll, then `restoreContext()` | The 2D overlay appears in the same frame. The stage returns within 1 s of restore, with no console errors. |

### 16.5 Device lab (M10, manual, with recorded traces)

M1 MacBook Air (Chrome, Safari); an Intel Iris Xe laptop (Chrome, Edge); Pixel 6a (Chrome; Battery Saver on and off); Galaxy A54 (Chrome, Samsung Internet); iPhone 12 (Safari; Low Power Mode on and off); an iPad (Safari, touch and trackpad). Pass marks from §9.1. Each trace is saved with the release.

### 16.6 Accessibility pass

axe-core on every scene, in each mode, with no serious or critical issue. Optional dev dependency: `@axe-core/playwright`. A manual pass with VoiceOver (macOS, iOS) and NVDA (Windows) covers the reading order, every live region, the menu dialog, the billing radios and the desk tools, at 200 % zoom and in Windows forced colours.

---

## 17. Build order

Every milestone ends with a page that can ship. A scene not yet rebuilt keeps today's DOM behaviour. `scenes.ts` marks it `built: false`, and the thread fades out at the last built scene's exit and teleports back when the reader scrolls up into built scenes. Each milestone also **deletes the parts of today's landing it replaces**, listed as "Retires". The old page is removed piece by piece, never left half-working.

| Milestone | Scope | Definition of done | Retires |
| --- | --- | --- | --- |
| **M0** Harness and baseline | `qa/landing/` (Playwright, the vitals, trace and budget scripts; the page side of `__LX_TEST__` arrives with the director in M2, since M0 changes no product code); snapshot today's page at all 132 points; a CI job, not yet blocking | The baseline numbers of §0.5 reproduced in CI. No product change. | — |
| **M1** The first frame | Static first frame and reading version (§2.6, §11.4), with `copy.ts` as their single source; boot cue; CSS hero entrance in the brief's order; drop the Newsreader preload; `#boot` off for landing boots; noscript block; JSON-LD, canonical, robots, sitemap; the new CSP hash in all three places | **LCP ≤ 2,500 ms** on the phone profile. JS-off pass. CLS 0. Takeover pixel-identical. The guarantees test green. | the hero's motion-driven entrance (`useHeroCue` moves into the boot script) |
| **M2** The director and the tokens | The one loop; `useScene` for every former `useScroll`; ground tones, nav, rails and spotlight on the director; the left rail's chapter numeral (§6.14); the layout cache; the contrast fixes (§12.2); roving tabindex on the two radio groups; `scroll-padding-top` | Screenshots ≤ 0.2 % different from M1. Scroll trace: ≤ 10 long tasks over 50 ms and none over 100 ms (today 67 and 108 ms). No layout read in a scroll path (a lint rule plus a trace check). | the rails' own rAF and per-frame rects and mask strings; the nav's two IntersectionObservers; Lenis `autoRaf` |
| **M3** Copy and math | `virtual:landing-math` and `<PrebakedMath/>`; the honesty test (`copy.ts` itself arrives in M1) | No KaTeX JS on the landing's network log. Chapters ≤ 40 KB gzip. | `MathText` and the `katex` import in landing code |
| **M4** The stage | One canvas, the layer contract (§2.5) across every section, capability and tiers, the governor, render-on-demand, context loss, the 2D fallback, the DOM-matched camera; the hero's thread in the stage (±5° / ±3°, curl-noise swirl, text-safe zone); `@types/three` pinned | Hero parity or better. No-WebGL and context-loss passes. 3D payload ≤ 180 KB gzip. | `ParticleField.tsx` and `useFieldCue`'s field |
| **M5** Sheet and engine | Curl lip and contact shadow; hand-offs 1 → 2 and 2 → 3; ribbon, beads, slabs, rig, projected labels; the SVG becomes the fallback; the engine's live region | The scene 2–3 checklists. Reversal frames identical. `engineFrame` and `threadState` tests. | `EngineStory`'s own rAF and per-frame SVG writes in live mode |
| **M6** Playground and topics | Hand-offs 3 → 4 and 4 → 5; the light circle; card tilt and sheen; dust, glyphs, bursts, ring and swirl; ghost depth layers | The scene 4–5 checklists. | the DOM symbols' role as the primary glyph (they remain as the fallback) |
| **M7** Archive | The pinned track, stacks, lift, sample cards, the thread on the stairs; the vertical ladder ≤ 900 px; find-in-page | The scene 6 checklist. | the desktop bar ladder (kept as the narrow and fallback layout) |
| **M8** Workspace and desk | Tip-back; top-card-only pictures (P9); the outline; pencil and lamp; flatten; arm-to-draw (P8); the FLIP track; `offsetX/Y` mapping | The scene 7–8 checklists. | `useLoop`'s in-view looping; `getBoundingClientRect` mapping on the sheet |
| **M9** Plans, FAQ, final and footer | Pro raised and the CSS tube; hand-offs 8 → 9, 9 → 10 and 10 → 11; the 3D tube and the bloom; the footer lip; Back to top moving focus | The scene 9–12 checklists. | `FinalStage`'s `getPointAtLength` tip (the SVG line stays as the fallback) |
| **M10** Hardening | The device lab (§16.5); WebKit pass; low-power checks; governor tuning; the OG image; the axe and screen-reader pass; every CI gate blocking | All of §9.1 passes on the devices; all of §16 is green. | — |
| **M11** Auth off the critical path (needs the owner's agreement, §18 Q2) | For an `anonymous` landing boot, the Supabase client is imported only on the first sign-in or sign-up intent, or at idle after 5 s | Entry ≤ 115 KB gzip; JS before takeover ≤ 145 KB gzip; no auth regression in the forms' tests. | Supabase in the entry chunk |

---

## 18. Assumptions and open questions

### Assumptions (decisions taken so the spec could be complete)

| # | Assumption |
| ---: | --- |
| A1 | This step is the spec only, as the brief says ("Do not write any website code yet"). The request to replace today's landing is delivered by §17, where every milestone deletes the code it replaces and the page stays shippable throughout. |
| A2 | The house voice and British spelling ("practise", "maths", "centre"). Typographic apostrophes, as the code has them. |
| A3 | The landing stays one light, printed page in every app theme (`color-scheme: light`; no `data-theme` rule in any landing stylesheet). Dark-theme screenshots exist to catch leaks, not to show a second design. |
| A4 | The geometry in §3.1 is the design intent at 1440 × 900. At runtime the director measures real values, so the fractions move with wrapping. |
| A5 | The engine's numbers (13 answers, Advanced, AIME) are computed from the real engine; every place that shows them interpolates, so they follow any change to the engine or the bank. |
| A6 | The brief gives the thread no shape in the Workspace and the FAQ. This spec chooses the pencil outline round the card in play and the margin line at the open answer, each with a reason (see [the concept rules](#the-concept-as-rules)). Both are quiet, and either can be cut without touching another scene. |
| A7 | The hero entrance follows the brief's order (headline, then eyebrow, lead, buttons). Today the eyebrow comes first. |
| A8 | "Three stats count up": the third stat counts its end year from 1959 to 2026, so the range opens. |
| A9 | The sample problems on the lifted sheets come from `ARCHIVE_SAMPLES`, which the existing test already checks against the archive. |
| A10 | The Pro card's pearl tube is CSS. The WebGL thread arrives and hands its light to it. A WebGL tube would detach from the card under native touch scrolling. |
| A11 | The pencil is drawn above the sheet's paper and below its 2D strokes. The stroke trails behind the tip and the pencil's body points away from it, so the two never visibly cross. |
| A12 | The rails' turning figure stays a 2D canvas. It is drawn only on wide screens, and keeping it out of the stage keeps the stage's layering simple. |
| A13 | `powerPreference: 'default'` replaces `'high-performance'` (§2.3.1). |
| A14 | The static first frame is replaced by the landing's first commit, not hydrated. The app's providers (auth, theme, motion) therefore need no server-rendering work, and only landing components render at build time. |
| A15 | No downloaded 3D assets: everything is procedural (§13). |
| A16 | The new dependencies are dev-only and never ship to the browser: `beasties` (the build's critical CSS), and in `qa/` `@playwright/test`, `pixelmatch` and `pngjs`. `@axe-core/playwright` is optional. |

### Open questions for the owner

| # | Question | Default if not answered |
| ---: | --- | --- |
| Q1 | Change the page title and description to the ones in §6.16, or keep "CalculixHub — A place to think" and today's description? | Keep today's until approved. |
| Q2 | M11 moves the Supabase client off the landing's critical path (≈ 59 KB gzip). It touches `AuthContext` and `App`, outside the landing. Approve? | Not done. The JS budget stays at ≤ 200 KB gzip before takeover. |
| Q3 | Should the landing have a night edition for dark-theme visitors? | No (A3). |
| Q4 | Who runs the device-lab traces (Pixel 6a, Galaxy A54, iPhone 12, an Iris Xe laptop), and on what hardware? | M10 waits for access. |
| Q5 | Regenerate the OG image in CI, or by hand when the hero changes? | By hand, with the script. |
| Q6 | The engine's item bank labels some AMC 12 problems by an "AMC 10" source (for example `amc12-2022a-p10` appears in the ticker as "AMC 10 combinatorics"). That is the engine's own data and is kept. Is it intended? | Kept as is. |
| Q7 | The page grows from about 21.9 to about 28.1 screens, mostly from the engine's fourth screen and the archive's track. Shorten the track to 200 vh? | Keep 280 vh. |
| Q8 | `FAQPage` structured data earns no rich result for this site (§15.4). Include it anyway? | Include it. |
| Q9 | There is no `?auth=signin` route. Before takeover, "Sign in" therefore links to `/?auth=signup`, where signing in is one tap away. Add a sign-in route? | No; link to the forms. |

---

## Appendix A: how the numbers were measured

All measurements were taken in this session, in this repository's cloud container, on 27 November 2026. Node 22, Chromium from Playwright 1.63 (headless).

1. **Build.** `npx vite build` into a scratch folder (exit 0), and again with `--sourcemap` for attribution. Sizes are the build's own minified and gzip figures.
2. **Attribution.** A script walked each chunk's source map, gave every generated byte to its source module, and grouped the modules by package. Group sizes are gzipped in isolation, so they slightly overstate a group's share of the chunk's gzip.
3. **Libraries.** Each candidate was installed in an isolated folder (three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, postprocessing 6.39.6, troika-three-text 0.52.5, gsap 3.15.1). Each was bundled with esbuild 0.25 (ESM, minified, browser, es2020) importing only the APIs this spec would use, with `three`, `react` and `react-dom` external where the page already ships them; for three's addons, only the bare `three` specifier was external. Gzip level 9.
4. **Vitals.** `vite preview` of the production build, loaded by Playwright with PerformanceObservers for LCP, CLS, long tasks and paint. Phone profile: viewport 412 × 823, mobile and touch on, CDP network 150 ms latency, 1,638.4 kbit/s down and 750 kbit/s up, CPU throttle 4×; waited 9 s after `load`. Desktop: 1440 × 900, 40 ms, 10 Mbit/s, no CPU throttle.
5. **Scroll trace.** 1440 × 900, every chapter mounted (6 s wait), then CPU throttle 4×. Mouse wheel 100 px every 40 ms down the whole page, with a long-task observer and an rAF interval log.
6. **Caveat.** The container has no GPU. Chromium used SwiftShader, so the hero took its 2D fallback and composited on the CPU. Frame intervals are therefore pessimistic. Long tasks are main-thread work and are comparable.
7. **Engine run.** `simulatePlacement()` replayed with `tsx`, printing each step (§0.2, §6.4).
8. **Contrast.** OKLCH → OKLab → linear sRGB (gamut-clipped), then WCAG 2.x relative luminance. Gradient grounds are measured at their darkest stop.

## Appendix B: contrast tables

**Text tokens on the paper grounds** (AA: 4.5:1 for body text, 3:1 for large text and marks):

| Ground (darkest stop) | hex | ink | body | muted | accent | pencil |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| paper | #f8f4ed | 14.76 | 8.19 | 5.34 | 6.22 | 4.69 |
| paper-raised | #fdfbf7 | 15.64 | 8.68 | 5.65 | 6.59 | 4.97 |
| morning | #e9f3f4 | 14.25 | 7.91 | 5.15 | 6.01 | 4.53 |
| parchment | #f8eedc | 14.02 | 7.78 | 5.07 | 5.91 | **4.46** |
| sage | #e9f3e9 | 14.20 | 7.88 | 5.13 | 5.99 | 4.51 |
| cream | #f8f0da | 14.22 | 7.89 | 5.14 | 5.99 | 4.52 |
| dusk | #e2ebf0 | 13.33 | 7.40 | 4.82 | 5.62 | **4.24** |
| lamplight | #f1e8e1 | 13.34 | 7.41 | 4.83 | 5.63 | **4.24** |

The fixed `--lx-pencil-text` (oklch 52 % 0.13 40, #a54a28) measures 4.82 on dusk and lamplight, 5.07 on parchment and 5.33 on paper.

**On the night stages:**

| Token | night-0 #000c15 | night-1 #001822 | night-2 #002f39 |
| --- | ---: | ---: | ---: |
| on-night | 17.85 | 16.45 | 12.96 |
| on-night-body | 12.98 | 11.96 | 9.42 |
| on-night-muted | 8.33 | 7.68 | 6.05 |
| cyan | 12.90 | 11.88 | 9.36 |
| brass | 11.55 | 10.64 | 8.38 |
| cream | 16.60 | 15.29 | 12.05 |
| coral | 8.47 | 7.80 | 6.15 |
| Algebra #f3b65b | 10.97 | 10.10 | 7.96 |
| Geometry #46d0b9 | 10.33 | 9.52 | 7.50 |
| Combinatorics #a78bfa | 7.26 | 6.69 | 5.27 |
| Number Theory #3dbcf5 | 9.14 | 8.42 | 6.63 |

**Topic colours as marks on paper:** 1.65 / 1.75 / 2.49 / 1.98 (fail 3:1). The paper variants at L 56 % measure 3.95 / 3.65 / 4.06 / 3.76 on dusk and 4.37 / 4.04 / 4.49 / 4.17 on paper.

**Nav glass (worst cases):**

| Case | Text | Contrast |
| --- | --- | ---: |
| ink glass (42 %) over ink | on-night / dim | 16.06 / 12.41 |
| ink glass (42 %) over paper, if the tone were wrong | on-night / dim | 1.63 / 1.55 |
| paper glass (74 %) over paper | ink / today's dim / fixed dim (opaque body) | 15.31 / **4.18** / 8.50 |
| paper glass (74 %) over a stage edge | ink / today's dim / fixed dim | 11.70 / **3.71** / 6.50 |

**Focus rings:** accent on paper 6.22:1; cyan on night-1 11.88:1.
