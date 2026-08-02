/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { m } from 'motion/react';
import React, { useMemo } from 'react';
import { FlaskConical, Download, ShieldCheck, Layers, Users2, AlertTriangle } from 'lucide-react';
import { ITEM_BANK } from '../lib/itemBank';
import { ItemSource, Domain, probCorrect } from '../lib/irt';
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
      <div className="border-b border-stone-100 pb-4">
        <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2 font-serif">
          <FlaskConical className="w-7 h-7 text-proof-600" /> Research Analytics
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Aggregated, anonymized platform intelligence for educational research institutions.
        </p>
      </div>

      {/* Privacy posture */}
      <div className="bg-proof-50 border border-proof-150 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-proof-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-xs font-extrabold text-proof-800">Anonymized by construction</h3>
          <p className="text-[11px] text-proof-700 leading-relaxed">
            This view exposes only item-level psychometrics and cohort-level distributions. No individual learner
            record, name, or identifier is included in anything shown or exported here.
          </p>
        </div>
      </div>

      {/* Bank summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StaggerItem index={0} className="bg-surface-raised border border-stone-200 p-5 rounded-2xl shadow-e1">
          <span className="text-[10px] text-stone-400 font-bold uppercase block">Calibrated items</span>
          <span className="text-2xl font-black text-stone-900 font-mono"><AnimatedNumber value={ITEM_BANK.length} /></span>
        </StaggerItem>
        <StaggerItem index={1} className="bg-surface-raised border border-stone-200 p-5 rounded-2xl shadow-e1">
          <span className="text-[10px] text-stone-400 font-bold uppercase block">Contest sources</span>
          <span className="text-2xl font-black text-stone-900 font-mono"><AnimatedNumber value={SOURCES.length} /></span>
        </StaggerItem>
        <StaggerItem index={2} className="bg-surface-raised border border-stone-200 p-5 rounded-2xl shadow-e1">
          <span className="text-[10px] text-stone-400 font-bold uppercase block">Domains</span>
          <span className="text-2xl font-black text-stone-900 font-mono"><AnimatedNumber value={DOMAINS.length} /></span>
        </StaggerItem>
        <StaggerItem index={3} className="bg-surface-raised border border-stone-200 p-5 rounded-2xl shadow-e1">
          <span className="text-[10px] text-stone-400 font-bold uppercase block">Concepts tagged</span>
          <span className="text-2xl font-black text-stone-900 font-mono"><AnimatedNumber value={concepts.length} /></span>
        </StaggerItem>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Difficulty calibration by source */}
        <div className="lg:col-span-7 bg-surface-raised border border-stone-200 rounded-3xl p-6 shadow-e1 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brass-600" /> Difficulty Calibration by Source
            </h2>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Mean IRT difficulty (b) and discrimination (a) per competition tier.
            </p>
          </div>

          <div className="space-y-3">
            {bySource.map((row) => (
              <div key={row.source} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-800">{row.source}</span>
                  <span className="font-mono text-stone-500 text-[10px]">
                    n={row.count} &middot; b&#772;={row.meanB.toFixed(2)} &middot; a&#772;={row.meanA.toFixed(2)}
                  </span>
                </div>
                <SpringBar
                  value={((row.meanB + 3) / 6) * 100}
                  track="w-full bg-stone-100 rounded-full h-2 relative overflow-hidden"
                  fill="bg-brass-500 h-2 rounded-full"
                  label={`Mean difficulty for ${row.source}`}
                />
              </div>
            ))}
            <div className="flex justify-between text-[9px] text-stone-400 font-mono pt-1">
              <span>&theta; = -3 (easiest)</span><span>0</span><span>+3 (hardest)</span>
            </div>
          </div>
        </div>

        {/* Domain coverage */}
        <div className="lg:col-span-5 bg-surface-raised border border-stone-200 rounded-3xl p-6 shadow-e1 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
              <Users2 className="w-5 h-5 text-violet-600" /> Domain Coverage
            </h2>
            <p className="text-[11px] text-stone-500 leading-relaxed">Item counts and mean difficulty per domain.</p>
          </div>

          <div className="space-y-3">
            {byDomain.map((row) => (
              <div key={row.domain} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-xs font-bold text-stone-800">{row.domain}</span>
                <span className="text-[10px] font-mono text-stone-500">
                  {row.count} items &middot; b&#772;={row.meanB.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test information curve */}
      <div className="bg-surface-raised border border-stone-200 rounded-3xl p-6 shadow-e1 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-stone-950">Test Information vs. Population Density</h2>
          <p className="text-[11px] text-stone-500 leading-relaxed">
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
                className="absolute w-1.5 h-1.5 rounded-full bg-brass-500"
                style={{ bottom: `${b.densityPct}%` }}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ ...spring.snappy, delay: 0.32 + staggerDelay(index, 0.02, 0.3) }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-stone-400 font-mono px-2">
          {distribution.filter((_, i) => i % 2 === 0).map((b) => (
            <span key={b.theta}>{b.theta.toFixed(1)}</span>
          ))}
        </div>
        <div className="flex gap-4 text-[10px] text-stone-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-proof-500/70 rounded-sm" /> Test information</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-brass-500 rounded-full" /> Population density</span>
        </div>
      </div>

      {/* Concept frequency */}
      <div className="bg-surface-raised border border-stone-200 rounded-3xl p-6 shadow-e1 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-stone-950 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Concept Coverage Map
          </h2>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Tagged concepts across the bank. Thinly covered concepts are candidates for curriculum expansion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {concepts.map(([concept, count]) => (
            <span
              key={concept}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
                count >= 2 ? 'bg-proof-50 border-proof-150 text-proof-700' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {concept} <span className="font-mono opacity-70">&times;{count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-ink-950 border border-ink-800 rounded-3xl p-6 shadow-e1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white font-serif">Export research dataset</h3>
          <p className="text-[11px] text-stone-400 leading-relaxed max-w-md">
            Item-level psychometric parameters in CSV, suitable for replication studies and independent
            calibration analysis. Contains no learner data.
          </p>
        </div>
        <m.button
          onClick={exportDataset}
          whileTap={{ scale: 0.96 }}
          transition={spring.press}
          className="bg-brass-600 hover:bg-brass-500 text-ink-950 font-extrabold text-xs px-5 py-3 rounded-xl transition-colors duration-160 ease-standard cursor-pointer shadow-e2 flex items-center gap-2 shrink-0"
        >
          <Download className="w-4 h-4" /> Download CSV
        </m.button>
      </div>
    </div>
  );
}
