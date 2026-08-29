/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { m } from 'motion/react';
import React, { useMemo } from 'react';
import { FlaskConical, Download, ShieldCheck, Layers, Users2, AlertTriangle } from 'lucide-react';
import { ITEM_BANK } from '../domain/itemBank';
import { ItemSource, Domain, probCorrect } from '../domain/irt';
import { duration, ease, spring, staggerDelay } from '../lib/motion';
import { AnimatedNumber, SpringBar, StaggerItem } from './motion';

/**
 * Research & Analytics dashboard — the "internal view" from the blueprint.
 *
 * Everything here is aggregate and anonymized: item-level psychometrics from
 * the calibrated bank and cohort-level distributions. No individual learner
 * record is exposed, and nothing is attributable to a named student.
 */

const SOURCES: ItemSource[] = ['AMC 8', 'AMC 10', 'AIME', 'USAMO', 'IMO'];
const DOMAINS: Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

export default function ResearchAnalytics() {
  // --- Item bank psychometrics -------------------------------------------
  const bySource = useMemo(() => {
    return SOURCES.map((source) => {
      const items = ITEM_BANK.filter((i) => i.source === source);
      const meanB = items.length ? items.reduce((s, i) => s + i.b, 0) / items.length : 0;
      const meanA = items.length ? items.reduce((s, i) => s + i.a, 0) / items.length : 0;
      return { source, count: items.length, meanB, meanA };
    });
  }, []);

  const byDomain = useMemo(() => {
    return DOMAINS.map((domain) => {
      const items = ITEM_BANK.filter((i) => i.domain === domain);
      const meanB = items.length ? items.reduce((s, i) => s + i.b, 0) / items.length : 0;
      return { domain, count: items.length, meanB };
    });
  }, []);

  // --- Simulated cohort ability distribution ------------------------------
  // A normal reference population, used to show where the item bank provides
  // the most measurement information.
  const distribution = useMemo(() => {
    const buckets: { theta: number; density: number; info: number }[] = [];
    for (let t = -3; t <= 3.001; t += 0.5) {
      const density = Math.exp(-(t * t) / 2);
      // Total test information available at this ability level.
      const info = ITEM_BANK.reduce((sum, item) => {
        const p = probCorrect(t, item);
        if (p <= 0 || p >= 1) return sum;
        const q = 1 - p;
        const num = (p - item.c) / (1 - item.c);
        return sum + Math.pow(1.7 * item.a, 2) * (q / p) * num * num;
      }, 0);
      buckets.push({ theta: t, density, info });
    }
    const maxDensity = Math.max(...buckets.map((b) => b.density));
    const maxInfo = Math.max(...buckets.map((b) => b.info));
    return buckets.map((b) => ({
      ...b,
      densityPct: (b.density / maxDensity) * 100,
      infoPct: (b.info / maxInfo) * 100,
    }));
  }, []);

  // --- Concept coverage ---------------------------------------------------
  const concepts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of ITEM_BANK) {
      counts.set(item.concept, (counts.get(item.concept) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const exportDataset = () => {
    // Item-level psychometric export — no learner data of any kind.
    const rows = [
      ['item_id', 'domain', 'source', 'concept', 'discrimination_a', 'difficulty_b', 'guessing_c'].join(','),
      ...ITEM_BANK.map((i) =>
        [i.id, i.domain, i.source, `"${i.concept}"`, i.a, i.b, i.c].join(','),
      ),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calculixhub-item-psychometrics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/*
        The bank readout.

        Four figures on one hairline rule rather than four bordered tiles. It is
        the same band the profile opens with, which is the point: these are the
        same kind of thing — a set of measurements taken at one moment — and
        they should look like a table of results, not like four buttons.
      */}
      <section className="cx-band-stats">
        <StaggerItem index={0}>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Calibrated items</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block"><AnimatedNumber value={ITEM_BANK.length} /></span>
          <span className="mt-2 block text-[13px] text-content-subtle">Each with a, b, c and a concept tag</span>
        </StaggerItem>
        <StaggerItem index={1}>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Contest sources</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block"><AnimatedNumber value={SOURCES.length} /></span>
          <span className="mt-2 block text-[13px] text-content-subtle">AMC 8 through IMO</span>
        </StaggerItem>
        <StaggerItem index={2}>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Domains</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block"><AnimatedNumber value={DOMAINS.length} /></span>
          <span className="mt-2 block text-[13px] text-content-subtle">Balanced by the selector</span>
        </StaggerItem>
        <StaggerItem index={3}>
          <span className="type-eyebrow block text-content-subtle tracking-[0.18em]">Concepts tagged</span>
          <span className="cx-figure cx-figure-lg mt-2.5 block"><AnimatedNumber value={concepts.length} /></span>
          <span className="mt-2 block text-[13px] text-content-subtle">What remediation dispatches on</span>
        </StaggerItem>
      </section>

      {/*
        The privacy posture is a stated rule, not a tinted alert. It is always
        true and never changes, so styling it as a notification would make the
        page cry wolf on every visit.
      */}
      <p className="flex items-start gap-2.5 border-l-2 border-proof/40 pl-4 text-[13.5px] leading-[1.75] text-content-muted">
        <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-proof" />
        <span>
          <span className="text-content">Anonymised by construction.</span> This view exposes only item-level
          psychometrics and cohort-level distributions. No individual learner record, name or identifier is included
          in anything shown or exported here.
        </span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Difficulty calibration by source */}
        <div className="lg:col-span-7 cx-card p-6.5 space-y-5">
          <div className="space-y-1">
            <h2 className="type-title text-[23px] flex items-center gap-2">
              <Layers className="w-5 h-5 text-azure-600" /> Difficulty Calibration by Source
            </h2>
            <p className="type-caption mt-1.5 leading-[1.7] text-content-subtle">
              Mean IRT difficulty (b) and discrimination (a) per competition tier.
            </p>
          </div>

          <div className="space-y-3">
            {bySource.map((row) => (
              <div key={row.source} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[15px]">{row.source}</span>
                  <span className="text-[13px] text-accent-text tnum">
                    n={row.count} &middot; b&#772;={row.meanB.toFixed(2)} &middot; a&#772;={row.meanA.toFixed(2)}
                  </span>
                </div>
                <SpringBar
                  value={((row.meanB + 3) / 6) * 100}
                  track="w-full bg-line-strong h-0.5 relative overflow-hidden"
                  fill="bg-accent h-0.5"
                  label={`Mean difficulty for ${row.source}`}
                />
              </div>
            ))}
            <div className="flex justify-between pt-1 text-[11px] text-content-subtle tnum">
              <span>&theta; = -3 (easiest)</span><span>0</span><span>+3 (hardest)</span>
            </div>
          </div>
        </div>

        {/* Domain coverage */}
        <div className="lg:col-span-5 cx-card p-6.5 space-y-5">
          <div className="space-y-1">
            <h2 className="type-title text-[23px] flex items-center gap-2">
              <Users2 className="w-5 h-5 text-violet-600" /> Domain Coverage
            </h2>
            <p className="type-caption mt-1.5 leading-[1.7] text-content-subtle">Item counts and mean difficulty per domain.</p>
          </div>

          <div className="space-y-3">
            {byDomain.map((row) => (
              <div key={row.domain} className="flex items-center justify-between gap-4 border-b border-line-faint py-3.5 last:border-b-0">
                <span className="text-[15px]">{row.domain}</span>
                <span className="text-[13px] text-accent-text tnum">
                  {row.count} items &middot; b&#772;={row.meanB.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test information curve */}
      <div className="cx-card p-6.5 space-y-5">
        <div className="space-y-1">
          <h2 className="type-title text-[23px]">Test Information vs. Population Density</h2>
          <p className="type-caption mt-1.5 leading-[1.7] text-content-subtle">
            Where the bank measures most precisely (bars) against the assumed N(0,1) learner distribution (line).
            Gaps indicate ability ranges needing more calibrated items.
          </p>
        </div>

        <div className="flex items-end gap-1.5 h-40 border-b border-l border-stone-200 pl-2 pb-1">
          {distribution.map((b, index) => (
            <div key={b.theta} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 group relative">
              {/*
                Bars scale up from the axis rather than animating their height,
                so the whole histogram is one composited transform instead of a
                row of simultaneous layout writes. `origin-bottom` is what makes
                that read as growing out of the baseline.
              */}
              <m.div
                className="w-full bg-proof-500/70 rounded-t origin-bottom transition-colors duration-160 ease-standard group-hover:bg-proof-600"
                style={{ height: `${b.infoPct}%` }}
                initial={{ scaleY: 0, opacity: 0 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ ...spring.smooth, delay: staggerDelay(index, 0.02, 0.3) }}
                title={`theta ${b.theta.toFixed(1)}: information ${b.info.toFixed(1)}`}
              />
              {/* The density marker fades in once the bars have landed. */}
              <m.div
                className="absolute w-1.5 h-1.5 rounded-full bg-azure-500"
                style={{ bottom: `${b.densityPct}%` }}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ ...spring.snappy, delay: 0.32 + staggerDelay(index, 0.02, 0.3) }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-stone-400 font-mono px-2">
          {distribution.filter((_, i) => i % 2 === 0).map((b) => (
            <span key={b.theta}>{b.theta.toFixed(1)}</span>
          ))}
        </div>
        <div className="flex gap-4 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-proof-500/70 rounded-sm" /> Test information</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-azure-500 rounded-full" /> Population density</span>
        </div>
      </div>

      {/* Concept frequency */}
      <div className="cx-card p-6.5 space-y-5">
        <div className="space-y-1">
          <h2 className="type-title text-[23px] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Concept Coverage Map
          </h2>
          <p className="type-caption mt-1.5 leading-[1.7] text-content-subtle">
            Tagged concepts across the bank. Thinly covered concepts are candidates for curriculum expansion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {concepts.map(([concept, count]) => (
            <span
              key={concept}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                count >= 2 ? 'bg-proof-50 border-proof-150 text-proof-700' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {concept} <span className="font-mono opacity-70">&times;{count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-ink-950 border border-ink-800 rounded-panel p-6 shadow-e1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white font-serif">Export research dataset</h3>
          <p className="text-[12px] text-stone-400 leading-relaxed max-w-md">
            Item-level psychometric parameters in CSV, suitable for replication studies and independent
            calibration analysis. Contains no learner data.
          </p>
        </div>
        <m.button
          onClick={exportDataset}
          whileTap={{ scale: 0.96 }}
          transition={spring.press}
          className="cx-btn cx-btn-fill shrink-0"
        >
          <Download className="w-4 h-4" /> Download CSV
        </m.button>
      </div>
    </div>
  );
}
