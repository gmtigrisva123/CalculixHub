/**
 * Shared pieces of the landing QA harness (qa/landing/README.md).
 *
 * Everything here drives the page from the outside: nothing in src/ knows
 * about it. When the page gains its own test hooks (`window.__LX_TEST__`,
 * SPEC §2.4.6, from M2), the fixed waits below can give way to them.
 *
 * Plain JavaScript on purpose: see the note in playwright.config.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));

/** Where the specs and budgets.mjs write their numbers (and the takeover's evidence). Gitignored. */
export const REPORT_DIR = resolve(process.env.LX_REPORT_DIR || join(HERE, 'report'));

/** LX_ENFORCE=1 turns the reported numbers into assertions (SPEC §16.3). Unset, every perf spec only reports. */
export const ENFORCE = process.env.LX_ENFORCE === '1';

/** The nine chapters mounted below the first two screens, in page order (their section ids). */
export const CHAPTER_IDS = ['engine', 'playground', 'topics', 'archive', 'workspace', 'desk', 'plans', 'faq', 'begin'];

/**
 * Context options for the vitals. The phone is SPEC Appendix A's reference
 * phone (412 x 823, mobile and touch), not the 390 x 844 screenshot viewport,
 * so the numbers stay comparable with the baseline in SPEC §0.5.
 *
 * Service workers are blocked: the page's worker claims the page once it has
 * installed (public/sw.js), and every request it then answers is invisible to
 * the page's own network log, so the transfer would be undercounted.
 */
export const VITALS_CONTEXT = {
  phone: { viewport: { width: 412, height: 823 }, screen: { width: 412, height: 823 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' },
  desktop: { viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, serviceWorkers: 'block' },
};

/** Network and CPU of each profile (SPEC §16.3, Appendix A). Throughputs are in bytes per second. */
export const PROFILES = {
  phone: { latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 },
  desktop: { latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (10 * 1024 * 1024) / 8, cpu: 1 },
};

/** How long a vitals run watches the page after `load` (SPEC Appendix A: 9 s). */
export const SETTLE_AFTER_LOAD_MS = 9000;

export const sleep = ms => new Promise(done => setTimeout(done, ms));

/**
 * Mount all nine chapters now. The page mounts them on the first wheel, touch
 * or keydown (window listeners, once each), or once the hero has landed. A
 * keydown sent before the live page has attached its listeners (its chunk
 * still on the way) is lost, so it is sent again on every poll until the
 * chapters are in. Only #root is searched: the static reading version beside
 * it (#lx-static, M1) carries the same ids until the live page takes over.
 */
export async function mountAllChapters(page, { timeout = 60_000 } = {}) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown')));
  await page.waitForFunction(ids => {
    const root = document.getElementById('root');
    const done = Boolean(root) && ids.every(id => root.querySelector(`[id="${id}"]`)) && !root.querySelector('.lx-chapters-hold');
    if (!done) window.dispatchEvent(new KeyboardEvent('keydown'));
    return done;
  }, CHAPTER_IDS, { timeout, polling: 250 });
  await page.waitForTimeout(500);
}

/**
 * Jump to a fraction of the page's scroll range, then give the springs time
 * to settle: two animation frames for the scroll to be seen, then 1200 ms
 * (longer than the slowest spring, until M2's `__LX_TEST__.settled()`).
 * The jump is instant even where the stylesheet asks for smooth scrolling.
 */
export async function scrollToProgress(page, progress) {
  await page.evaluate(async p => {
    const range = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.round(p * range), left: 0, behavior: 'instant' });
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  }, progress);
  await page.waitForTimeout(1200);
}

/** Store the theme before any page script runs, the way a returning visitor's choice is stored. */
export async function withTheme(context, theme) {
  if (theme !== 'light' && theme !== 'dark') throw new Error(`withTheme: expected 'light' or 'dark', got ${theme}`);
  await context.addInitScript(value => {
    try { window.localStorage.setItem('calculix_theme', value); } catch { /* an opaque origin (about:blank) has no storage */ }
  }, theme);
}

/** A browser without WebGL: every WebGL context request returns null, before any page script runs. */
export async function noWebGL(context) {
  await context.addInitScript(() => {
    const blocked = new Set(['webgl', 'webgl2', 'experimental-webgl']);
    for (const Canvas of [window.HTMLCanvasElement, window.OffscreenCanvas]) {
      if (!Canvas) continue;
      const original = Canvas.prototype.getContext;
      Canvas.prototype.getContext = function getContext(type, ...rest) {
        return blocked.has(String(type).toLowerCase()) ? null : original.call(this, type, ...rest);
      };
    }
  });
}

/** Apply a network and CPU profile through a CDP session of the page (context.newCDPSession(page)). */
export async function applyProfile(cdp, name) {
  const profile = PROFILES[name];
  if (!profile) throw new Error(`applyProfile: unknown profile ${name}`);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latency,
    downloadThroughput: profile.downloadThroughput,
    uploadThroughput: profile.uploadThroughput,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
}

/**
 * Buffered PerformanceObservers, registered before any page script runs:
 * largest-contentful-paint, layout shifts without recent input, long tasks,
 * paint, and Event Timing (the longest event of each interaction).
 *
 * An LCP entry's element is described when the entry arrives, because a node
 * removed later (the static hero, at takeover) reads back as null. `inStatic`
 * says whether it was part of the static first frame (#lx-static), and
 * `inHero` whether it was part of that frame's hero.
 */
export async function installVitals(page) {
  await page.addInitScript(() => {
    if (window.__lxVitals) return;
    const describe = element => {
      if (!element || !element.tagName) return null;
      const id = element.id ? `#${element.id}` : '';
      const classes = (element.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).map(name => `.${name}`).join('');
      return `${element.tagName.toLowerCase()}${id}${classes}`.slice(0, 160);
    };
    const vitals = (window.__lxVitals = { lcp: [], cls: 0, shifts: [], longtasks: [], fcp: null, fp: null, interactions: {}, unsupported: [] });
    const observe = (type, options, handle) => {
      try {
        new PerformanceObserver(list => { for (const entry of list.getEntries()) handle(entry); }).observe({ type, buffered: true, ...options });
      } catch {
        vitals.unsupported.push(type);
      }
    };
    observe('largest-contentful-paint', {}, entry => {
      const element = entry.element;
      vitals.lcp.push({
        startTime: entry.startTime,
        size: entry.size,
        element: describe(element) || (entry.id ? `#${entry.id}` : null),
        inStatic: element ? Boolean(element.closest && element.closest('#lx-static')) : null,
        inHero: element ? Boolean(element.closest && element.closest('#lx-static .lx-hero')) : null,
        text: element && !entry.url ? (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
        url: entry.url ? String(entry.url).slice(0, 120) : null,
      });
    });
    observe('layout-shift', {}, entry => {
      if (entry.hadRecentInput) return;
      vitals.cls += entry.value;
      if (vitals.shifts.length < 50) {
        vitals.shifts.push({ startTime: entry.startTime, value: entry.value, sources: (entry.sources || []).map(source => describe(source.node)).filter(Boolean).slice(0, 3) });
      }
    });
    observe('longtask', {}, entry => { vitals.longtasks.push({ startTime: entry.startTime, duration: entry.duration }); });
    observe('paint', {}, entry => {
      if (entry.name === 'first-contentful-paint') vitals.fcp = entry.startTime;
      if (entry.name === 'first-paint') vitals.fp = entry.startTime;
    });
    observe('event', { durationThreshold: 16 }, entry => {
      if (!entry.interactionId) return;
      const seen = vitals.interactions[entry.interactionId];
      if (!seen || entry.duration > seen.duration) vitals.interactions[entry.interactionId] = { name: entry.name, duration: entry.duration, startTime: entry.startTime };
    });
  });
}

/** What installVitals recorded, with the LCP taken from its last entry. */
export async function readVitals(page) {
  return page.evaluate(() => {
    const vitals = window.__lxVitals;
    if (!vitals) return null;
    const last = vitals.lcp[vitals.lcp.length - 1] || null;
    const durations = vitals.longtasks.map(task => task.duration);
    const interactions = Object.values(vitals.interactions);
    return {
      fcp: vitals.fcp,
      fp: vitals.fp,
      lcp: last ? last.startTime : null,
      lcpSize: last ? last.size : null,
      lcpElement: last ? last.element : null,
      lcpInStatic: last ? last.inStatic : null,
      lcpInHero: last ? last.inHero : null,
      lcpText: last ? last.text : null,
      lcpUrl: last ? last.url : null,
      lcpEntries: vitals.lcp,
      cls: vitals.cls,
      shifts: vitals.shifts,
      longTasks: durations.length,
      longestTask: durations.length ? Math.max(...durations) : 0,
      totalLongTask: durations.reduce((sum, value) => sum + value, 0),
      longtasks: vitals.longtasks,
      inp: interactions.length ? Math.max(...interactions.map(interaction => interaction.duration)) : null,
      interactions,
      unsupported: vitals.unsupported,
    };
  });
}

/** Median of the finite numbers in a list; null when there are none. */
export function median(list) {
  const values = list.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/** Nearest-rank percentile (0-100) of the finite numbers in a list; null when there are none. */
export function percentile(list, p) {
  const values = list.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return null;
  const rank = Math.min(values.length, Math.max(1, Math.ceil((p / 100) * values.length)));
  return values[rank - 1];
}

/** [smallest, largest] of the finite numbers in a list; null when there are none. */
export function spread(list) {
  const values = list.filter(value => typeof value === 'number' && Number.isFinite(value));
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

export const round = (value, digits = 0) => (typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(digits)) : value);

/** kB as Vite and Chrome DevTools print them: 1 kB = 1000 bytes. */
export const kB = (bytes, digits = 1) => round(bytes / 1000, digits);

/**
 * One cold load: a fresh context with the profile's viewport, a CDP session
 * for its network and CPU, the observers, `load`, then `settle` ms of quiet.
 * Transfer is the sum of Network.loadingFinished encodedDataLength.
 */
export async function measureVitals(browser, profile, { settle = SETTLE_AFTER_LOAD_MS, path = '/' } = {}) {
  const context = await browser.newContext(VITALS_CONTEXT[profile]);
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    let transfer = 0;
    let requests = 0;
    cdp.on('Network.loadingFinished', event => { transfer += event.encodedDataLength || 0; requests += 1; });
    await applyProfile(cdp, profile);
    await installVitals(page);
    const started = Date.now();
    await page.goto(path, { waitUntil: 'load', timeout: 120_000 });
    const loadMs = Date.now() - started;
    await page.waitForTimeout(settle);
    const vitals = await readVitals(page);
    if (!vitals) throw new Error('The vitals observers did not run (window.__lxVitals is missing).');
    return { ...vitals, loadMs, requests, transferBytes: transfer, transferKB: kB(transfer) };
  } finally {
    await context.close();
  }
}

/** Write <report>/<name> as pretty JSON and return its path. */
export function writeReport(name, data) {
  const file = join(REPORT_DIR, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

/** Write a binary file (a screenshot, a diff) into the report folder and return its path. */
export function writeReportFile(name, buffer) {
  const file = join(REPORT_DIR, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
  return file;
}

/** Read <report>/<name>, or the fallback when it is missing or unreadable. */
export function readReport(name, fallback = {}) {
  try {
    return JSON.parse(readFileSync(join(REPORT_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

/** Render rows (arrays of cells) as an aligned plain-text table. */
export function formatTable(header, rows) {
  const cells = [header, ...rows].map(row => row.map(cell => (cell === null || cell === undefined ? '-' : String(cell))));
  const widths = header.map((_, column) => Math.max(...cells.map(row => row[column].length)));
  const line = row => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();
  return [line(cells[0]), widths.map(width => '-'.repeat(width)).join('  '), ...cells.slice(1).map(line)].join('\n');
}
