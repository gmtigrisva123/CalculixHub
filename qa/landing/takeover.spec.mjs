/**
 * @m1: the live page takes over the static first frame (SPEC §2.6, §16.2 "Hero").
 *
 * The contract under test, as M1 built it:
 *   - index.html's inline boot script sets data-js, data-landing (a landing
 *     boot without ?preview=), data-t0 (the first frame) and, once the display
 *     face has loaded (capped at 900 ms) and two frames have passed, data-cue
 *     and data-cue-at, with a window `lx-cue` event;
 *   - the build writes the first two screens into dist/index.html as
 *     <div id="lx-static"> just before <div id="root">;
 *   - React renders the live page into #root, and BootLift's layout effect
 *     removes #lx-static in that same commit (src/boot/BootLift.tsx);
 *   - the landing's code is dist/assets/LandingPage-<hash>.js.
 *
 * (i)   the frame after the swap is the frame before it (<= 0.2 % of pixels);
 * (ii)  no frame is painted between the live insertion and the static removal;
 * (iii) on the phone profile the LCP is the static hero's headline or lead.
 */
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { ENFORCE, measureVitals, readReport, round, sleep, writeReport, writeReportFile } from './helpers.mjs';

const LANDING_CHUNK = '**/assets/LandingPage-*.js';
/** The landing chunk is held at least this long, and in (i) until the static frame has been photographed. */
const HOLD_MS = 4000;
/** How long after the cue the static frame's entrance has certainly finished (the last stroke lands at 2.8 s). */
const AFTER_CUE_MS = 3000;
const AFTER_TAKEOVER_MS = 800;
const MAX_DIFF_RATIO = 0.002;
/** Safety cap on any hold, so a failed test never leaves a request hanging. */
const HOLD_CAP_MS = 90_000;
const KEEP_SHOTS = process.env.LX_KEEP_SHOTS === '1';

/** Hold every request for the landing chunk until `release()` and at least `minimum` ms. */
async function holdLandingChunk(page, minimum) {
  let release = () => {};
  const released = new Promise(resolve => { release = resolve; });
  const requests = [];
  await page.route(LANDING_CHUNK, async route => {
    requests.push({ url: route.request().url(), at: Date.now() });
    await Promise.all([sleep(minimum), Promise.race([released, sleep(HOLD_CAP_MS)])]);
    try { await route.continue(); } catch { /* the page closed while the request was held */ }
  });
  return { release, requests };
}

/** The bounding box of pixelmatch's diff colour (pure red) in its output image. */
function diffBox(png) {
  let [left, top, right, bottom] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] === 255 && png.data[i + 1] === 0 && png.data[i + 2] === 0) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

test('the swap is pixel-identical: static frame, then live page @m1', async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  // Blocked so that nothing between the page and the network can answer the held request.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const hold = await holdLandingChunk(page, HOLD_MS);
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.cue !== undefined, null, { timeout: 30_000 });
    await page.waitForFunction(after => performance.now() >= Number(document.documentElement.dataset.cueAt) + after, AFTER_CUE_MS, { polling: 100, timeout: 30_000 });

    const boot = await page.evaluate(() => ({ ...document.documentElement.dataset, statics: document.querySelectorAll('#lx-static').length, live: Boolean(document.querySelector('#root .lx')) }));
    expect(hold.requests.length, 'the landing chunk was requested, and is held').toBeGreaterThan(0);
    expect(boot, 'the boot state before the swap').toMatchObject({ js: '', landing: '', cue: '', statics: 1, live: false });

    const staticShot = await page.screenshot({ animations: 'disabled' });
    const shownStatic = await page.evaluate(() => Boolean(document.getElementById('lx-static')) && !document.querySelector('#root .lx'));
    expect(shownStatic, 'screenshot A shows the static frame: the live page had not arrived').toBe(true);

    hold.release();
    await page.waitForFunction(() => !document.getElementById('lx-static') && Boolean(document.querySelector('#root .lx')), null, { timeout: 60_000 });
    const tookOverAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(AFTER_TAKEOVER_MS);
    const liveShot = await page.screenshot({ animations: 'disabled' });

    const a = PNG.sync.read(staticShot);
    const b = PNG.sync.read(liveShot);
    expect([b.width, b.height], 'both screenshots are the same size').toEqual([a.width, a.height]);
    const diff = new PNG({ width: a.width, height: a.height });
    const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const ratio = differing / (a.width * a.height);
    const box = diffBox(diff);

    const failed = ratio > MAX_DIFF_RATIO;
    const files = {};
    if (failed || KEEP_SHOTS) {
      files.static = writeReportFile(`takeover-${project}-static.png`, staticShot);
      files.live = writeReportFile(`takeover-${project}-live.png`, liveShot);
      files.diff = writeReportFile(`takeover-${project}-diff.png`, PNG.sync.write(diff));
    }
    const result = {
      measuredAt: new Date().toISOString(),
      viewport: page.viewportSize(),
      cueAt: Number(boot.cueAt),
      t0: Number(boot.t0),
      tookOverAt: round(tookOverAt),
      differingPixels: differing,
      ratio: round(ratio, 5),
      limit: MAX_DIFF_RATIO,
      diffBox: box,
      files,
    };
    const report = readReport('takeover.json');
    report[`pixels-${project}`] = result;
    writeReport('takeover.json', report);
    testInfo.annotations.push({ type: 'takeover diff', description: `${differing} px differ (${(ratio * 100).toFixed(3)} %, limit ${MAX_DIFF_RATIO * 100} %)${box ? `, within ${JSON.stringify(box)}` : ''}` });
    if (failed) {
      // By path, so the JSON report stays small.
      await testInfo.attach('static frame (A)', { path: files.static, contentType: 'image/png' });
      await testInfo.attach('live page (B)', { path: files.live, contentType: 'image/png' });
      await testInfo.attach('diff', { path: files.diff, contentType: 'image/png' });
    }
    expect(ratio, `share of pixels that differ across the swap (box ${JSON.stringify(box)}; files ${JSON.stringify(files)})`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  } finally {
    hold.release();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
});

test('no frame is painted between the live insertion and the static removal @m1', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  // Before any page script: count animation frames, and watch #root fill and #lx-static go.
  await context.addInitScript(() => {
    const state = (window.__lxTakeover = {
      frames: 0,
      staticSeen: false,
      rootFirstAt: null, framesAtRootFirst: null,
      liveAt: null, framesAtLive: null,
      removedAt: null, framesAtRemoval: null,
      liveAtRemoval: null, sameBatch: null,
    });
    const tick = () => { state.frames += 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const inRoot = node => Boolean(node && node.nodeType === Node.ELEMENT_NODE && node.closest && node.closest('#root'));
    const holdsLive = node => node.nodeType === Node.ELEMENT_NODE && (node.matches('.lx') || Boolean(node.querySelector('.lx')));
    const holdsStatic = node => node.nodeType === Node.ELEMENT_NODE && (node.id === 'lx-static' || Boolean(node.querySelector('#lx-static')));
    new MutationObserver(records => {
      const now = performance.now();
      let liveInBatch = false;
      // Records arrive in the order the DOM changed, so the order says whether the live page was in before the static frame left.
      for (const record of records) {
        if (record.type !== 'childList') continue;
        const intoRoot = record.target.id === 'root' || inRoot(record.target);
        if (intoRoot && state.rootFirstAt === null && record.addedNodes.length) {
          state.rootFirstAt = now;
          state.framesAtRootFirst = state.frames;
        }
        if (intoRoot && state.liveAt === null && [...record.addedNodes].some(holdsLive)) {
          state.liveAt = now;
          state.framesAtLive = state.frames;
          liveInBatch = true;
        }
        if (state.staticSeen && state.removedAt === null && [...record.removedNodes].some(holdsStatic)) {
          state.removedAt = now;
          state.framesAtRemoval = state.frames;
          state.liveAtRemoval = state.liveAt !== null;
          state.sameBatch = liveInBatch;
        }
      }
      if (!state.staticSeen && document.getElementById('lx-static')) state.staticSeen = true;
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  // The static frame on screen for a while first, as on a real connection, so frames are being painted when the swap comes.
  const hold = await holdLandingChunk(page, 1500);
  hold.release();
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__lxTakeover && window.__lxTakeover.removedAt !== null, null, { timeout: 60_000 });
    const record = await page.evaluate(() => {
      const { frames, ...rest } = window.__lxTakeover;
      return { ...rest, framesNow: frames, cueAt: Number(document.documentElement.dataset.cueAt) };
    });
    const framesBetween = record.framesAtLive === null ? null : record.framesAtRemoval - record.framesAtLive;
    const framesSinceRootFilled = record.framesAtRootFirst === null ? null : record.framesAtRemoval - record.framesAtRootFirst;
    const report = readReport('takeover.json');
    report[`frames-${testInfo.project.name}`] = { measuredAt: new Date().toISOString(), ...record, framesBetween, framesSinceRootFilled };
    writeReport('takeover.json', report);
    testInfo.annotations.push({ type: 'takeover frames', description: `live in at ${round(record.liveAt)} ms, static out at ${round(record.removedAt)} ms, ${framesBetween} frames between (${record.framesAtRemoval} frames painted before the swap)` });

    expect(record.staticSeen, 'the static frame was in the document').toBe(true);
    expect(record.liveAtRemoval, "'#root .lx' existed when #lx-static was removed").toBe(true);
    expect(framesBetween, 'animation frames between the live insertion and the static removal').toBe(0);
    expect(framesSinceRootFilled, 'animation frames between the first content in #root and the static removal').toBe(0);
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
});

test('phone profile: the LCP is the static hero @m1', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'measured on the phone profile');
  const vitals = await measureVitals(browser, 'phone');
  const element = vitals.lcpElement || '';
  // The static h1, one of its words, its text, or the hero lead.
  const hero = /#lx-hero-title(?![\w-])|\.lx-hero-title(?![\w-])|\.lx-wi(?![\w-])|\.lx-w(?![\w-])|\.lx-hero-lead(?![\w-])/.test(element);
  const report = readReport('takeover.json');
  report.lcp = { measuredAt: new Date().toISOString(), lcp: round(vitals.lcp), element: vitals.lcpElement, inStatic: vitals.lcpInStatic, text: vitals.lcpText, url: vitals.lcpUrl, entries: vitals.lcpEntries, fcp: round(vitals.fcp), cls: round(vitals.cls, 4) };
  writeReport('takeover.json', report);
  testInfo.annotations.push({ type: 'phone LCP', description: `${round(vitals.lcp)} ms, ${vitals.lcpElement} (in #lx-static: ${vitals.lcpInStatic})` });

  expect.soft(hero, `the LCP element is the static hero's headline or lead (it was ${element || 'none'}; entries ${JSON.stringify(vitals.lcpEntries)})`).toBe(true);
  expect.soft(vitals.lcpInStatic, 'the LCP element belonged to the static first frame (#lx-static)').toBe(true);
  if (ENFORCE) expect.soft(vitals.lcp, 'phone LCP, ms (SPEC M1: <= 2,500)').toBeLessThanOrEqual(2500);
});
