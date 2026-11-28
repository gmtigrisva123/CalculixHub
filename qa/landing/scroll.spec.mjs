/**
 * @perf: the scroll trace of SPEC §16.3 / Appendix A, desktop only.
 *
 * 1440 x 900, every chapter mounted (6 s, then mountAllChapters), the CPU 4x
 * slower, then the mouse wheel 100 px every 40 ms from the top to the bottom
 * of the page with a long-task observer and a requestAnimationFrame interval
 * log. Writes qa/landing/report/scroll.json.
 *
 * Report only: the thresholds arrive in M2 (<= 10 long tasks over 50 ms, none
 * over 100 ms) and M10 (none over 50 ms). LX_TRACE=1 also records a Chrome
 * trace (devtools.timeline) into qa/landing/report/scroll-trace.json; tracing
 * is itself main-thread work (about 80 MB of events), so the numbers of a
 * traced run are not comparable with an untraced one.
 */
import { join } from 'node:path';
import { test } from '@playwright/test';
import { REPORT_DIR, formatTable, mountAllChapters, percentile, round, writeReport } from './helpers.mjs';

const WHEEL_PX = 100;
const WHEEL_EVERY_MS = 40;
const MAX_WHEELS = 2500;

test('desktop: wheel through the whole page at 4x CPU @perf', async ({ page, context, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only (SPEC §16.3)');

  await page.goto('/');
  await page.waitForTimeout(6000);
  await mountAllChapters(page);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const tracePath = process.env.LX_TRACE === '1' ? join(REPORT_DIR, 'scroll-trace.json') : null;
  if (tracePath) {
    await browser.startTracing(page, {
      path: tracePath,
      categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'blink.user_timing', 'latencyInfo'],
    });
  }

  await page.evaluate(() => {
    const log = (window.__lxScroll = { longtasks: [], intervals: [], stopped: false, startedAt: performance.now() });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) log.longtasks.push({ startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask' });
    let last = null;
    const frame = now => {
      if (last !== null) log.intervals.push(now - last);
      last = now;
      if (!log.stopped) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  const started = Date.now();
  let wheels = 0;
  let reachedBottom = false;
  while (wheels < MAX_WHEELS) {
    await page.mouse.wheel(0, WHEEL_PX);
    wheels += 1;
    await page.waitForTimeout(WHEEL_EVERY_MS);
    // Checked every tenth notch only, so the check itself does not stretch the cadence.
    if (wheels % 10 === 0) {
      reachedBottom = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
      if (reachedBottom) break;
    }
  }
  const wheelMs = Date.now() - started;
  await page.waitForTimeout(1500);

  const log = await page.evaluate(() => {
    const scroll = window.__lxScroll;
    scroll.stopped = true;
    return { ...scroll, endedAt: performance.now(), pageHeight: document.documentElement.scrollHeight, scrollY: window.scrollY, innerHeight: window.innerHeight };
  });
  if (tracePath) await browser.stopTracing();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const durations = log.longtasks.map(task => task.duration);
  const intervals = log.intervals;
  const result = {
    measuredAt: new Date().toISOString(),
    baseURL: testInfo.project.use.baseURL,
    viewport,
    cpuThrottle: 4,
    wheel: { px: WHEEL_PX, everyMs: WHEEL_EVERY_MS, notches: wheels, wallMs: wheelMs, reachedBottom },
    pageHeight: log.pageHeight,
    finalScrollY: round(log.scrollY),
    longTasks: {
      count: durations.length,
      over50: durations.filter(duration => duration > 50).length,
      over100: durations.filter(duration => duration > 100).length,
      longest: round(durations.length ? Math.max(...durations) : 0),
      total: round(durations.reduce((sum, duration) => sum + duration, 0)),
    },
    frames: {
      count: intervals.length,
      p50: round(percentile(intervals, 50), 1),
      p95: round(percentile(intervals, 95), 1),
      p99: round(percentile(intervals, 99), 1),
      over50: intervals.filter(interval => interval > 50).length,
      longest: round(intervals.length ? Math.max(...intervals) : 0, 1),
    },
    trace: tracePath,
    longtasks: log.longtasks.map(task => ({ startTime: round(task.startTime), duration: round(task.duration) })),
  };
  const file = writeReport('scroll.json', result);

  const table = formatTable(
    ['notches', 'page', 'long tasks > 50 ms', '> 100 ms', 'longest', 'frames', 'p50', 'p95', 'p99', 'frames > 50 ms'],
    [[
      `${wheels}${reachedBottom ? '' : ' (bottom not reached)'}`,
      `${result.pageHeight} px`,
      result.longTasks.over50,
      result.longTasks.over100,
      `${result.longTasks.longest} ms`,
      result.frames.count,
      `${result.frames.p50} ms`,
      `${result.frames.p95} ms`,
      `${result.frames.p99} ms`,
      result.frames.over50,
    ]],
  );
  console.log(`\nScroll trace, desktop at 4x CPU (${file}):\n${table}\n`);
  testInfo.annotations.push({
    type: 'scroll trace',
    description: `${result.longTasks.over50} long tasks over 50 ms (${result.longTasks.over100} over 100 ms, longest ${result.longTasks.longest} ms); `
      + `frame interval p50 ${result.frames.p50} / p95 ${result.frames.p95} / p99 ${result.frames.p99} ms, ${result.frames.over50} over 50 ms`,
  });
});
