/**
 * Playwright configuration for the landing QA harness (SPEC §16.3, milestone M0).
 *
 * Run from qa/, after `npx vite build` at the repository root:
 *
 *   npx playwright test -c landing/playwright.config.mjs [--grep @perf] [--project desktop]
 *
 * qa/landing/README.md says what each spec measures and lists the environment
 * variables read here and in the specs.
 *
 * Plain JavaScript on purpose: the root tsconfig type-checks every .ts file it
 * is not told to exclude, and qa's dependencies are not installed in the root
 * lint job, so a TypeScript file under qa/ would break `npm run lint`.
 */
import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/*
 * The checkout whose dist/ is served. Defaults to the repository this file
 * lives in. The two-pass visual job keeps this harness (the head's) and points
 * LX_ROOT at the base checkout for its first pass, so one harness compares two
 * builds even when the base has no harness of its own.
 */
const ROOT = resolve(process.env.LX_ROOT || resolve(HERE, '..', '..'));
const PORT = Number(process.env.LX_PORT || 4173);
const BASE_URL = process.env.LX_BASE_URL || `http://localhost:${PORT}`;
const SNAPSHOTS = resolve(process.env.LX_SNAPSHOT_DIR || resolve(HERE, '.snapshots'));
// The same folder helpers.mjs writes the specs' numbers into.
const REPORT = resolve(process.env.LX_REPORT_DIR || resolve(HERE, 'report'));

export default defineConfig({
  testDir: HERE,
  testMatch: '*.spec.mjs',
  outputDir: resolve(HERE, '..', 'test-results'),
  // Performance runs must never share the machine with each other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(REPORT, 'results.json') }],
    ['html', { outputFolder: resolve(REPORT, 'html'), open: 'never' }],
  ],
  // Snapshots are never committed: the visual job writes them from the base build, then compares the head build with them.
  snapshotPathTemplate: `${SNAPSHOTS}/{projectName}/{arg}{ext}`,
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      // A Chromium already on the machine (a container without a GPU rasterises with SwiftShader). Unset on CI, where `playwright install` provides one.
      executablePath: process.env.PW_CHROMIUM || undefined,
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
      // DPR 1 keeps the snapshots small. The vitals use SPEC Appendix A's reference phone instead (VITALS_CONTEXT in helpers.mjs).
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
    },
  ],
  // `vite preview` serves an already-built dist/: run `npx vite build` at the repository root first.
  webServer: process.env.LX_BASE_URL
    ? undefined
    : {
        command: `npx vite preview --port ${PORT} --strictPort`,
        cwd: ROOT,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
