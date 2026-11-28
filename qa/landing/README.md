# Landing QA harness

The checks of `docs/landing-3d/SPEC.md` §16 for the public landing page, built as milestone M0 (§17): Playwright specs for screenshots, load vitals, the scroll trace, the fallbacks and the M1 takeover, plus a bundle budget script. M0 changes no product code: everything here drives the built page from outside. The page's own test hooks (`window.__LX_TEST__`, §2.4.6) arrive with the director in M2; until then the specs use fixed waits.

Every file is plain JavaScript (`*.mjs`): the root `tsconfig.json` type-checks every `.ts` file it does not exclude, and qa's dependencies are not installed in the root lint job, so a TypeScript file here would break `npm run lint`.

## Running it

```sh
# 1. Build the page at the repository root (the specs serve dist/ with `vite preview`).
npm ci
npx vite build            # prints "static first frame: ..." and writes it into dist/index.html

# 2. Install the harness, once.
cd qa
npm ci
npx playwright install --with-deps chromium   # not needed with PW_CHROMIUM (below)

# 3. Run.
LX_STAGE=M1 node landing/budgets.mjs
npx playwright test -c landing/playwright.config.mjs --grep "@perf|@fallback|@m1"
npx playwright test -c landing/playwright.config.mjs --grep @visual --project desktop
```

`npm run landing` in `qa/` is the same as `npx playwright test -c landing/playwright.config.mjs`. Playwright starts `npx vite preview --port $LX_PORT --strictPort` at the repository root unless `LX_BASE_URL` is set, and reuses a server already listening on that port. It serves whatever `dist/` holds, so build first.

The tests run one at a time (`workers: 1`): performance runs must never share the machine. Even so, timings move with whatever else the machine is doing, which is why the phone vitals take the median of three runs and report their spread.

## The specs

Each test is tagged in its title, so a run can pick them with `--grep`.

| File | Tag | What it does |
| --- | --- | --- |
| `visual.spec.mjs` | `@visual` | Screenshots at scroll progress 0, 0.1 ... 1.0, in the light and dark themes (`localStorage.calculix_theme`), in three modes: `default`, `reduced` (`prefers-reduced-motion: reduce`) and `nowebgl` (every WebGL context request returns null). A fresh context per mode and theme: load, wait 4 s for the hero's entrance, mount every chapter, then for each point jump there, wait two frames and 1.2 s, and compare. 11 x 2 x 3 = 66 per project, 132 in all, named `{project}/{mode}-{theme}-p{00..10}.png`. Tolerance: `maxDiffPixelRatio` 0.01 in the default mode (the canvas draws), 0.002 in the other two. Soft assertions, so one diff does not hide the rest. |
| `vitals.spec.mjs` | `@perf` | Cold loads with PerformanceObservers for LCP (time, size, element), CLS, long tasks, paint and Event Timing, plus the transfer (CDP `Network.loadingFinished`). Phone: SPEC Appendix A's reference phone (412 x 823, mobile, touch), 150 ms / 1.6 Mbit/s down / 750 kbit/s up, CPU 4x slower, three runs. Desktop: 1440 x 900, 40 ms / 10 Mbit/s, one run. Each watches the page for 9 s after `load`. Writes `report/vitals.json` (every run, the medians, the spread) and prints a table. |
| `scroll.spec.mjs` | `@perf` | Desktop only. Load, 6 s, every chapter mounted, CPU 4x slower, then the mouse wheel 100 px every 40 ms from the top to the bottom, with a long-task observer and a requestAnimationFrame interval log. Writes `report/scroll.json`: long tasks (count, over 100 ms, longest) and frame intervals (p50, p95, p99, count over 50 ms). `LX_TRACE=1` also records a Chrome trace (`devtools.timeline`) into `report/scroll-trace.json` (about 80 MB); tracing is main-thread work of its own, so compare numbers from untraced runs only. Report only: the thresholds come in M2 and M10. |
| `fallbacks.spec.mjs` | `@fallback`, `@m1` | Reduced motion: no Lenis (`html.lenis` absent) and the headline shown. No WebGL: no page errors and the hero's 2D fallback canvas (`.lx-hero-field canvas`). JavaScript off (`@m1`), two tests: **first screen** (no `#boot` cover, `#lx-static` present, the static h1 "Stay with the question." visible with every word at `transform: none`, the lead and the hero buttons visible at opacity 1; at 760 px and below the stylesheet drops "Try a problem", so there only the sign-up button is required) and **reading version** (sections `#engine` ... `#begin` inside `#lx-static .lx-reading`, each visible; the nine chapter headings, the eight FAQ questions and the two prices readable; no raw TeX; every in-page link resolves). A `test.fixme` holds the place of "no three.js chunk without WebGL" (M4). |
| `takeover.spec.mjs` | `@m1` | The live page taking over the static first frame (SPEC §2.6). **Pixel identity** (both projects): the landing chunk (`assets/LandingPage-*.js`) is held, the static frame is photographed once the entrance has finished (cue + 3 s), the chunk is let through, and the live page is photographed 800 ms after `#lx-static` has gone; pixelmatch (threshold 0.1) must find at most 0.2 % of pixels different. On failure both screenshots and the diff go to `report/takeover-{project}-{static,live,diff}.png` (always, with `LX_KEEP_SHOTS=1`). **No blank frame** (both projects): a MutationObserver and a self-rescheduling rAF counter, installed before any page script, record when the live page enters `#root` and when `#lx-static` leaves; the static frame must leave in the same frame the live page arrives (zero animation frames between). **LCP** (phone): one cold load on the phone profile; the LCP element must be the static hero's h1, a word of it or the lead, and with `LX_ENFORCE=1` LCP <= 2,500 ms. All write `report/takeover.json`. |
| `budgets.mjs` | | Not a Playwright spec: `node landing/budgets.mjs` (below). |

`helpers.mjs` holds what the specs share: `mountAllChapters` (a keydown, repeated until all nine chapters are in `#root` and no `.lx-chapters-hold` remains), `scrollToProgress`, `withTheme`, `noWebGL`, `applyProfile` (CDP network and CPU), `installVitals` / `readVitals`, `measureVitals` (one cold load), `median`, `percentile`, `spread` and the report writers.

Two choices worth knowing when reading the numbers:

- **Service workers are blocked in the vitals and takeover contexts.** The page's worker (`public/sw.js`) claims the page once installed and then answers requests itself, which the page's network log does not count as transfer (and which `page.route` cannot hold). With the worker allowed, a desktop load reports about 543 kB; with it blocked, every byte the page fetches in the window is counted: about 1,031 kB at M1, including three.js, KaTeX, both Newsreader faces and Caveat. SPEC §0.5's 577 kB / 554 kB baseline was probably taken with the worker allowed.
- **kB are 1000 bytes**, as Vite and Chrome DevTools print them, in the budgets and the transfer alike.

## The two-pass visual comparison

Snapshots are never committed (`qa/landing/.snapshots/` is gitignored). A comparison is two runs of the same harness over two builds:

```sh
# From qa/ of the head checkout, with both checkouts built (npm ci && npx vite build in each).
export LX_SNAPSHOT_DIR=/tmp/landing-snapshots      # shared by both passes

# Pass 1: the base build writes the snapshots (its report kept apart).
LX_ROOT=/path/to/base LX_PORT=4173 LX_REPORT_DIR="$PWD/landing/report/base" \
  npx playwright test -c landing/playwright.config.mjs --grep @visual --update-snapshots --output=landing/report/base/test-results

# Pass 2: the head build (this checkout) is compared with them.
LX_PORT=4174 npx playwright test -c landing/playwright.config.mjs --grep @visual
```

`LX_ROOT` points the web server at another checkout's `dist/`, so the head's harness can photograph a base that has no harness of its own. Each pass serves on its own port, so the second never reuses the first's server. Pass 2 fails where a screenshot moved by more than its tolerance, or where the base had no snapshot to compare with. The `landing-visual` CI job does exactly this for every pull request and uploads the report with the diffs (`qa/test-results/`).

## Bundle budgets

`node landing/budgets.mjs` (from `qa/`, after the build) measures the gzip size (level 9) of each piece listed in `budgets.json` (`dist/index.html`, its inline critical CSS, the entry chunk and stylesheet that `index.html` links, `LandingPage-*.js` and its CSS, `LandingChapters-*.js`, `MathText-*.js`, `three.module-*.js`, `ParticleField-*.js`, and the stage chunk M4 will add), prints the budgets of SPEC §9.2 (name, size, limit, status) and writes `report/budgets.json`.

Each budget names the milestone it applies from (and, for the 200 kB "JS before takeover", the one after which it gives way to 145 kB). `LX_STAGE` says which milestone the build is at (default `M0`). A budget that applies at `LX_STAGE` reads `ok` or `OVER`; one that applies later is still measured and shown (`over (applies from M3)`), never enforced. The script exits 1 only with `LX_ENFORCE=1`, when a budget that applies at `LX_STAGE` is over or a required piece is missing from the build, and 2 when there is no `dist/index.html` to read.

Not measured here: fonts requested before LCP and the transfer for a full read (both runtime figures; see the vitals), the KaTeX CSS allowance of the chapters budget, and the GPU budgets.

## Environment variables

| Variable | Read by | Meaning |
| --- | --- | --- |
| `LX_PORT` | config | Port for `vite preview` (default 4173). |
| `LX_BASE_URL` | config | Test a server that is already running (no web server is started). |
| `LX_ROOT` | config, budgets | The checkout whose `dist/` is served and measured (default: this repository). |
| `LX_DIST` | budgets | A `dist/` folder, directly. |
| `PW_CHROMIUM` | config | A Chromium executable to use instead of Playwright's own (for example `/opt/pw-browsers/chromium` in a container that has one). |
| `LX_SNAPSHOT_DIR` | config | Where the visual snapshots live (default `qa/landing/.snapshots`). |
| `LX_REPORT_DIR` | config, specs, budgets | Where the reports go (default `qa/landing/report`). |
| `LX_STAGE` | budgets | The milestone the build is at, `M0` to `M11` (default `M0`). |
| `LX_ENFORCE` | vitals, takeover, budgets | `1` turns the reported numbers into assertions: phone median LCP <= 2,500 ms, CLS <= 0.05, budgets. Unset in M0 CI. |
| `LX_TRACE` | scroll | `1` records a Chrome trace of the scroll. |
| `LX_KEEP_SHOTS` | takeover | `1` keeps the takeover screenshots even when they match. |

## Output

All of it is gitignored: `qa/landing/report/` (`results.json`, the HTML report in `html/`, `vitals.json`, `scroll.json`, `takeover.json`, `budgets.json`, the takeover screenshots), `qa/landing/.snapshots/` and `qa/test-results/` (Playwright's per-test files: failure screenshots, and for a visual diff the expected, actual and diff images).

## CI

`.github/workflows/landing-qa.yml` runs on pull requests and on pushes to `main` and `claude/**` that touch the landing, the boot, the build or this harness. `landing-qa` builds, checks the budgets (`LX_STAGE=M1`) and runs `--grep "@perf|@fallback|@m1"`; `landing-visual` (pull requests only) runs the two passes above. Both upload their reports, and both are `continue-on-error` in M0: they report and do not block. A CI runner has no GPU either, so the hero draws its 2D fallback there too.
