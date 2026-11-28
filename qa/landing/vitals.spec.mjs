/**
 * @perf: load vitals on the two profiles of SPEC §16.3 / Appendix A.
 *
 * Phone: the reference phone (412 x 823, mobile, touch), Slow 4G (150 ms,
 * 1.6 Mbit/s down, 750 kbit/s up) and the CPU 4x slower; three cold loads,
 * each in a fresh context with its own CDP session, measured for 9 s after
 * `load`. Desktop: 1440 x 900, 10 Mbit/s and 40 ms, no CPU throttle; one cold
 * load.
 *
 * Writes <report>/vitals.json and prints a table. Report only, unless
 * LX_ENFORCE=1: then the phone's median LCP must be <= 2,500 ms and the CLS of
 * both profiles <= 0.05 (SPEC §16.3, the M1 definition of done).
 */
import { expect, test } from '@playwright/test';
import { ENFORCE, PROFILES, SETTLE_AFTER_LOAD_MS, VITALS_CONTEXT, formatTable, measureVitals, median, readReport, round, spread, writeReport } from './helpers.mjs';

const RUNS = { phone: 3, desktop: 1 };

/** Median of each figure over the runs (max for CLS), its spread, and the LCP element of the median run. */
function summarise(runs) {
  const byLcp = [...runs].sort((a, b) => (a.lcp ?? Infinity) - (b.lcp ?? Infinity));
  const middle = byLcp[Math.floor((byLcp.length - 1) / 2)];
  const of = key => runs.map(run => run[key]);
  const range = (key, digits = 0) => {
    const values = spread(of(key));
    return values ? values.map(value => round(value, digits)) : null;
  };
  return {
    runs: runs.length,
    fcp: round(median(of('fcp'))),
    lcp: round(median(of('lcp'))),
    lcpElement: middle.lcpElement,
    lcpInStatic: middle.lcpInStatic,
    lcpText: middle.lcpText,
    lcpUrl: middle.lcpUrl,
    lcpElements: runs.map(run => run.lcpElement),
    cls: round(Math.max(...of('cls')), 4),
    longTasks: median(of('longTasks')),
    longestTask: round(median(of('longestTask'))),
    totalLongTask: round(median(of('totalLongTask'))),
    transferKB: round(median(of('transferKB')), 1),
    requests: median(of('requests')),
    loadMs: round(median(of('loadMs'))),
    spread: {
      fcp: range('fcp'),
      lcp: range('lcp'),
      cls: range('cls', 4),
      longTasks: range('longTasks'),
      longestTask: range('longestTask'),
      totalLongTask: range('totalLongTask'),
      transferKB: range('transferKB', 1),
      loadMs: range('loadMs'),
    },
  };
}

const ms = value => (value === null || value === undefined ? null : `${round(value)} ms`);
const row = (label, v) => [label, ms(v.fcp), ms(v.lcp), round(v.cls, 4), v.longTasks, ms(v.longestTask), ms(v.totalLongTask), `${round(v.transferKB, 1)} kB`, v.lcpElement];

for (const profile of ['phone', 'desktop']) {
  test(`${profile} profile: load vitals @perf`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== profile, `measured once, in the ${profile} project`);

    const runs = [];
    for (let index = 0; index < RUNS[profile]; index += 1) runs.push(await measureVitals(browser, profile));
    const summary = summarise(runs);

    const report = readReport('vitals.json');
    report[profile] = {
      measuredAt: new Date().toISOString(),
      baseURL: testInfo.project.use.baseURL,
      profile: { ...PROFILES[profile], ...VITALS_CONTEXT[profile] },
      waitAfterLoadMs: SETTLE_AFTER_LOAD_MS,
      summary,
      runs,
    };
    const file = writeReport('vitals.json', report);

    const header = ['run', 'FCP', 'LCP', 'CLS', 'long tasks', 'longest', 'total', 'transfer', 'LCP element'];
    const rows = runs.map((run, index) => row(`${profile} #${index + 1}`, run));
    if (runs.length > 1) {
      rows.push(row(`${profile} median`, summary));
      const s = summary.spread;
      const span = (pair, unit = '') => (pair ? `${pair[0]}-${pair[1]}${unit}` : null);
      rows.push(['spread', span(s.fcp, ' ms'), span(s.lcp, ' ms'), span(s.cls), span(s.longTasks), span(s.longestTask, ' ms'), span(s.totalLongTask, ' ms'), span(s.transferKB, ' kB'), null]);
    }
    console.log(`\nLoad vitals, ${profile} profile (${file}):\n${formatTable(header, rows)}\n`);

    testInfo.annotations.push({
      type: `${profile} vitals`,
      description: `FCP ${summary.fcp} ms, LCP ${summary.lcp} ms (${summary.lcpElement}), CLS ${summary.cls}, `
        + `${summary.longTasks} long tasks (longest ${summary.longestTask} ms, ${summary.totalLongTask} ms in all), transfer ${summary.transferKB} kB`
        + (runs.length > 1 ? `; LCP spread ${summary.spread.lcp?.join('-')} ms over ${runs.length} runs` : ''),
    });

    if (ENFORCE) {
      if (profile === 'phone') expect.soft(summary.lcp, 'phone median LCP, ms (SPEC §16.3: <= 2,500)').toBeLessThanOrEqual(2500);
      expect.soft(summary.cls, `${profile} CLS (SPEC §16.3: <= 0.05)`).toBeLessThanOrEqual(0.05);
    }
  });
}
