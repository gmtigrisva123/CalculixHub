/**
 * Folds a run into one report.
 *
 *   node qa/report/build.mjs
 *
 * Reads qa/out/bots/*.json and qa/out/agents/<id>/findings.json, and writes
 * qa/out/report.json (everything, merged) and qa/out/report.md (the summary).
 * Findings that several people reported are merged and counted, because "eight
 * people hit this" is the most useful number a QA report can carry.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, outPath } from '../lib/config.mjs';

const SEVERITY = ['blocker', 'major', 'minor', 'polish'];
const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };

const words = (text) => new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
const similar = (a, b) => {
  const x = words(a); const y = words(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.max(1, Math.min(x.size, y.size)) >= 0.6;
};
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
// Ids and numbers vary per request; the endpoint is what repeats.
const endpoint = (request = '') => request.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').replace(/=\d+/g, '=:n').replace(/\?.*$/, (q) => q.slice(0, 80));

function bots() {
  const dir = join(OUT, 'bots');
  if (!existsSync(dir)) return { runs: [], steps: [], events: [] };
  const runs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(join(dir, f))).filter(Boolean);
  const byStep = new Map();
  for (const run of runs) for (const s of run.steps) {
    const entry = byStep.get(s.name) ?? { name: s.name, ok: 0, failed: 0, ms: [], errors: [] };
    entry[s.ok ? 'ok' : 'failed'] += 1;
    entry.ms.push(s.ms);
    if (!s.ok) entry.errors.push({ bot: run.id, error: s.error, screenshot: s.screenshot });
    byStep.set(s.name, entry);
  }
  const steps = [...byStep.values()].map((s) => ({ name: s.name, ok: s.ok, failed: s.failed, p50: quantile(s.ms, 0.5), p95: quantile(s.ms, 0.95), errors: s.errors }));
  const grouped = new Map();
  for (const run of runs) for (const e of run.events) {
    const key = `${e.kind}|${e.status ?? ''}|${endpoint(e.request ?? e.text)}`;
    const entry = grouped.get(key) ?? { kind: e.kind, status: e.status ?? null, what: endpoint(e.request ?? e.text), count: 0, bots: new Set(), ms: [], example: e };
    entry.count += 1;
    entry.bots.add(run.id);
    if (e.ms) entry.ms.push(e.ms);
    grouped.set(key, entry);
  }
  const events = [...grouped.values()].map((e) => ({ ...e, bots: [...e.bots], p50: quantile(e.ms, 0.5) })).sort((a, b) => b.bots.length - a.bots.length || b.count - a.count);
  const vitals = runs.map((r) => r.vitals?.landing).filter(Boolean);
  return {
    runs: runs.map((r) => ({ id: r.id, displayName: r.displayName, device: r.device, ok: r.steps.filter((s) => s.ok).length, total: r.steps.length })),
    steps,
    events,
    landing: vitals.length ? { lcpP50: quantile(vitals.map((v) => v.lcp), 0.5), lcpP95: quantile(vitals.map((v) => v.lcp), 0.95), clsMax: Math.max(...vitals.map((v) => v.cls)), ttfbP50: quantile(vitals.map((v) => v.ttfb), 0.5) } : null,
  };
}

function agents() {
  const dir = join(OUT, 'agents');
  if (!existsSync(dir)) return { reports: [], findings: [], scores: null, fixes: [] };
  const reports = readdirSync(dir).map((id) => readJson(join(dir, id, 'findings.json'))).filter(Boolean);
  const clusters = [];
  for (const report of reports) for (const f of report.findings ?? []) {
    const match = clusters.find((c) => c.area === f.area && similar(c.title, f.title));
    const reporter = { id: report.id, persona: report.persona, device: report.device, screenshot: f.screenshot, actual: f.actual, steps: f.steps, url: f.url };
    if (match) {
      match.reporters.push(reporter);
      if (SEVERITY.indexOf(f.severity) < SEVERITY.indexOf(match.severity)) match.severity = f.severity;
    } else {
      clusters.push({ title: f.title, area: f.area, severity: SEVERITY.includes(f.severity) ? f.severity : 'minor', expected: f.expected, reporters: [reporter] });
    }
  }
  clusters.sort((a, b) => SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity) || b.reporters.length - a.reporters.length);

  const keys = ['first_impression', 'clarity', 'visual_polish', 'speed', 'delight'];
  const scored = reports.filter((r) => r.ux_scores);
  const scores = scored.length ? Object.fromEntries(keys.map((k) => [k, Number((scored.reduce((sum, r) => sum + Number(r.ux_scores[k] ?? 0), 0) / scored.length).toFixed(1))])) : null;

  const fixes = [];
  for (const report of reports) (report.top_interface_fixes ?? []).forEach((text, rank) => {
    const match = fixes.find((f) => similar(f.text, text));
    if (match) { match.votes += 1; match.weight += 3 - Math.min(rank, 2); match.by.push(report.id); } else fixes.push({ text, votes: 1, weight: 3 - Math.min(rank, 2), by: [report.id] });
  });
  fixes.sort((a, b) => b.weight - a.weight);

  return {
    reports: reports.map((r) => ({ id: r.id, persona: r.persona, device: r.device, focus: r.focus, completed: r.completed, ux_scores: r.ux_scores, best_moment: r.best_moment, worst_moment: r.worst_moment })),
    findings: clusters,
    scores,
    fixes: fixes.slice(0, 15),
  };
}

const report = { generatedAt: new Date().toISOString(), bots: bots(), agents: agents() };
writeFileSync(outPath('report.json'), JSON.stringify(report, null, 2));

const { bots: b, agents: a } = report;
const lines = [
  `# CalculixHub QA run (${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC)`,
  '',
  `${b.runs.length} bot runs, ${a.reports.length} agent reports, ${a.findings.length} distinct findings.`,
  '',
  '## Findings',
  ...SEVERITY.flatMap((sev) => {
    const list = a.findings.filter((f) => f.severity === sev);
    return list.length ? [`### ${sev} (${list.length})`, ...list.map((f) => `- **${f.title}** (${f.area}; ${f.reporters.length} reporter${f.reporters.length > 1 ? 's' : ''}): ${f.reporters[0].actual ?? ''}`), ''] : [];
  }),
  '## Bot journey',
  '| Step | OK | Failed | p50 ms | p95 ms |',
  '|---|---:|---:|---:|---:|',
  ...b.steps.map((s) => `| ${s.name} | ${s.ok} | ${s.failed} | ${s.p50 ?? ''} | ${s.p95 ?? ''} |`),
  '',
  '## Errors and slow calls seen by bots',
  ...b.events.slice(0, 25).map((e) => `- ${e.kind}${e.status ? ` ${e.status}` : ''} ${e.what} (${e.count}x, ${e.bots.length} bot${e.bots.length > 1 ? 's' : ''}${e.p50 ? `, p50 ${e.p50} ms` : ''})`),
  '',
  '## Interface fixes people asked for most',
  ...a.fixes.map((f, i) => `${i + 1}. ${f.text} (${f.votes} vote${f.votes > 1 ? 's' : ''})`),
  '',
  a.scores ? `## UX scores (mean, 1-10)\n${Object.entries(a.scores).map(([k, v]) => `- ${k.replace('_', ' ')}: ${v}`).join('\n')}` : '',
];
writeFileSync(outPath('report.md'), lines.join('\n'));
console.log(`Report: ${OUT}/report.md and report.json (${a.findings.length} findings, ${b.runs.length} bot runs).`);
