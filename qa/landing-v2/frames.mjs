/**
 * Frame times while wheel-scrolling the whole landing page, with the CPU slowed
 * four times (docs/landing-v2-brief.md §14.3). The rAF loop that measures
 * lives only in this QA script, never in the product code.
 *
 *   node qa/landing-v2/frames.mjs                    # /?landing=v2&forceGl=1
 *   PAGE_PATH=/ node qa/landing-v2/frames.mjs        # the current landing, for comparison
 *
 * Playwright comes from qa/ (`cd qa && npm ci`). BASE_URL overrides the
 * address, CHROMIUM_PATH the browser. Figures from a container without a GPU
 * only compare runs with each other; acceptance against §1.1 is measured on
 * real devices.
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const PATH = process.env.PAGE_PATH ?? '/?landing=v2&forceGl=1';

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.__frames = [];
  window.__long = 0;
  let last = performance.now();
  const tick = now => { window.__frames.push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new PerformanceObserver(list => { window.__long += list.getEntries().length; }).observe({ type: 'longtask' });
});
const height = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < height; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
const { frames, long } = await page.evaluate(() => ({ frames: window.__frames, long: window.__long }));
const sorted = [...frames].sort((a, b) => a - b);
const pct = q => sorted[Math.floor(q * (sorted.length - 1))].toFixed(1);
console.log({
  path: PATH,
  frames: frames.length,
  p50: pct(0.5),
  p95: pct(0.95),
  p99: pct(0.99),
  over16: `${((frames.filter(f => f > 16.7).length / frames.length) * 100).toFixed(1)}%`,
  longTasks: long,
});
await browser.close();
