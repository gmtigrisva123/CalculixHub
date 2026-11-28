/**
 * Landing v2, Phase 0 acceptance (docs/landing-v2-brief.md §17): `/` is still
 * the current landing page, and `/?landing=v2` is the eleven scene shells at
 * the heights the registry gives them, on a desktop and on a phone.
 *
 *   npm run build
 *   NODE_ENV=production ALLOWED_ORIGINS=http://localhost:8000 npm start
 *   node qa/landing-v2/shells.mjs
 *
 * Playwright comes from qa/ (`cd qa && npm ci`). BASE_URL overrides the
 * address, CHROMIUM_PATH the browser. Screenshots go to qa/landing-v2/shots/.
 * Exits non-zero if any check fails.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(SHOTS, { recursive: true });

// The scenes of §9.4, in page order.
const SCENE_IDS = ['top', 'how-it-works', 'try', 'why', 'tutor', 'map', 'archive', 'arena', 'plans', 'faq', 'begin'];

const VIEWPORTS = [
  { name: 'desktop-1440', options: { viewport: { width: 1440, height: 900 } }, mobile: false },
  { name: 'phone-390', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, mobile: true },
  { name: 'desktop-1440-reduced-motion', options: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, mobile: false },
];

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

/*
 * src/main.tsx mounts Vercel's Analytics and Speed Insights, whose scripts are
 * served only by Vercel at /_vercel/…; anywhere else the SPA fallback answers
 * with index.html and the browser refuses it. That happens on every page of
 * the app, so it is not counted against the landing.
 */
const VERCEL_ONLY = ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'];

/** Console errors, uncaught exceptions and failed requests, per page. */
function watch(page) {
  const problems = [];
  page.on('console', message => {
    if (message.type() === 'error' && !VERCEL_ONLY.some(path => message.text().includes(path))) problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => problems.push(`exception: ${error.message}`));
  page.on('requestfailed', request => problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));
  return problems;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// The current landing page is still the default, and still the old one.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lx', { timeout: 15_000 });
  check(await page.locator('.lx2').count() === 0, '/ renders the current landing (.lx), not v2');
  await page.waitForTimeout(3000); // let the hero's entrance finish
  await page.screenshot({ path: join(SHOTS, 'phase0-current-landing-1440.jpg'), quality: 80 });
  console.log(`     problems on /: ${problems.length ? `\n       ${problems.join('\n       ')}` : 'none'}`);
  await page.close();
}

for (const { name, options, mobile } of VIEWPORTS) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', event => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  const page = await context.newPage();
  const problems = watch(page);
  await page.goto(`${BASE}/?landing=v2`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lx2 section', { timeout: 15_000 });
  check(await page.locator('.lx').count() === 0, `${name}: /?landing=v2 renders v2 only`);

  const layout = await page.evaluate(() => ({
    vh: window.innerHeight,
    vw: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    sections: [...document.querySelectorAll('.lx2 section')].map(section => ({
      id: section.id,
      top: section.offsetTop,
      height: section.offsetHeight,
      budget: section.dataset.budget,
      pinned: section.hasAttribute('data-pinned'),
      world: section.dataset.world,
      desktop: Number(section.style.getPropertyValue('--budget-desktop')),
      mobile: Number(section.style.getPropertyValue('--budget-mobile')),
      dawn: Number(section.style.getPropertyValue('--dawn') || 0),
      children: section.childElementCount,
      stages: section.querySelectorAll(':scope > .lx2-stage').length,
    })),
  }));

  check(JSON.stringify(layout.sections.map(section => section.id)) === JSON.stringify(SCENE_IDS), `${name}: 11 shells in the order of §9.4`);
  for (const section of layout.sections) {
    const svh = section.budget === 'fixed' ? (mobile ? section.mobile : section.desktop) : 100 + section.dawn;
    const expected = (svh * layout.vh) / 100;
    const exact = section.budget === 'fixed' ? Math.abs(section.height - expected) <= 1 : section.height >= expected - 1;
    check(exact, `${name}: #${section.id} is ${section.height}px, expected ${section.budget === 'fixed' ? '' : 'at least '}${Math.round(expected)}px (${svh}svh${section.budget === 'content' ? ', by content' : ''})`);
    check(section.stages === (section.pinned ? 1 : 0) && section.children === section.stages, `${name}: #${section.id} is empty${section.pinned ? ' but for its sticky stage' : ''}`);
  }
  check(layout.scrollWidth <= layout.vw, `${name}: no horizontal scroll (${layout.scrollWidth} ≤ ${layout.vw})`);

  // A pinned scene's stage holds the screen while the scene scrolls past.
  const pinned = layout.sections.find(section => section.id === 'how-it-works');
  await page.evaluate(y => window.scrollTo(0, y), pinned.top + Math.round((pinned.height - layout.vh) / 2));
  await page.waitForTimeout(100);
  const stageTop = await page.evaluate(() => document.querySelector('#how-it-works > .lx2-stage').getBoundingClientRect().top);
  check(Math.abs(stageTop) <= 1, `${name}: the sticky stage of #how-it-works stays at the top mid-scene (top = ${stageTop.toFixed(1)}px)`);
  await page.evaluate(() => window.scrollTo(0, 0));

  const csp = await page.evaluate(() => window.__csp);
  check(csp.length === 0, `${name}: no CSP violations${csp.length ? `: ${csp.join(', ')}` : ''}`);
  check(problems.length === 0, `${name}: no console errors, exceptions or failed requests${problems.length ? `:\n       ${problems.join('\n       ')}` : ''}`);
  console.log(`     ${name}: viewport ${layout.vw}×${layout.vh}, page ${layout.scrollHeight}px = ${(layout.scrollHeight / layout.vh).toFixed(2)} screens`);
  await context.close();

  // An overview of the whole page, scaled down, with each shell outlined and labelled.
  if (name.includes('reduced')) continue;
  const scale = mobile ? 0.5 : 0.2;
  const overview = await browser.newContext({ ...options, deviceScaleFactor: scale });
  const map = await overview.newPage();
  await map.goto(`${BASE}/?landing=v2`, { waitUntil: 'networkidle' });
  await map.waitForSelector('.lx2 section');
  await map.addStyleTag({ content: `
    .lx2 section { outline: ${mobile ? 4 : 10}px solid #80bdfb; outline-offset: -${mobile ? 4 : 10}px; }
    .lx2 section[data-world='day'] { outline-color: #f8bf6c; }
    .qa-tag { position: absolute; left: 4%; top: ${mobile ? 24 : 60}px; font: 600 ${mobile ? 26 : 64}px/1.2 ui-monospace, monospace; color: #f2f3f8; }
    .lx2-stage { outline: ${mobile ? 3 : 8}px dashed #a7aebe; outline-offset: -${mobile ? 12 : 30}px; }
  ` });
  // Label each shell with what the registry asked for: id, height in svh, and whether it is pinned.
  await map.evaluate(isPhone => {
    for (const section of document.querySelectorAll('.lx2 section')) {
      const svh = section.dataset.budget === 'fixed'
        ? `${section.style.getPropertyValue(isPhone ? '--budget-mobile' : '--budget-desktop')}svh`
        : `content ≥ ${100 + Number(section.style.getPropertyValue('--dawn') || 0)}svh`;
      const tag = document.createElement('div');
      tag.className = 'qa-tag';
      tag.textContent = `#${section.id} · ${svh}${section.hasAttribute('data-pinned') ? ' · pinned' : ''} · ${section.dataset.world}`;
      section.append(tag);
    }
  }, mobile);
  await map.screenshot({ path: join(SHOTS, `phase0-v2-overview-${name}.png`), fullPage: true });
  await overview.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
