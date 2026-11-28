#!/usr/bin/env node
/**
 * Bundle budgets for the landing (SPEC §9.2, §16.3), checked against a built dist/.
 *
 * Run from qa/, after `npx vite build` at the repository root:
 *
 *   node landing/budgets.mjs
 *
 * Measures the gzip size (level 9) of each piece in budgets.json, prints a
 * table of the budgets (name, size, limit, status) and writes
 * <report>/budgets.json. Exits 1 only when LX_ENFORCE=1 and a budget that
 * applies at LX_STAGE (default M0) is over; 2 when there is no build to read.
 *
 * Environment:
 *   LX_ROOT        the checkout whose dist/ is read (default: this repository)
 *   LX_DIST        a dist/ folder, directly (overrides LX_ROOT)
 *   LX_STAGE       the milestone the build is at, M0 to M11 (default M0)
 *   LX_ENFORCE     1 to fail on an over budget that applies at LX_STAGE
 *   LX_REPORT_DIR  where budgets.json is written (default qa/landing/report)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { formatTable, kB, writeReport } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.LX_ROOT || resolve(HERE, '..', '..'));
const DIST = resolve(process.env.LX_DIST || join(ROOT, 'dist'));
const STAGE = (process.env.LX_STAGE || 'M0').toUpperCase();
const ENFORCE = process.env.LX_ENFORCE === '1';

/** "M4" -> 4. */
function stageNumber(stage, what) {
  const match = /^M(\d{1,2})$/i.exec(String(stage || '').trim());
  if (!match || Number(match[1]) > 11) throw new Error(`budgets: ${what} must be a milestone M0 to M11, got ${JSON.stringify(stage)}`);
  return Number(match[1]);
}

/** Files in dist/ matching a glob relative to it ("*" within one path segment only). */
function glob(pattern) {
  const parts = pattern.split('/');
  const directory = join(DIST, ...parts.slice(0, -1));
  if (!existsSync(directory)) return [];
  const name = parts[parts.length - 1];
  const re = new RegExp(`^${name.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  return readdirSync(directory)
    .filter(file => re.test(file) && statSync(join(directory, file)).isFile())
    .sort()
    .map(file => posix.join(...parts.slice(0, -1), file));
}

/** A URL from dist/index.html as a path in dist/, whatever base the build used (/ or /CalculixHub/). */
function distPath(url) {
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0].replace(/^\/+/, '');
  const segments = path.split('/');
  for (let skip = 0; skip < segments.length; skip += 1) {
    const candidate = segments.slice(skip).join('/');
    if (candidate && existsSync(join(DIST, candidate))) return candidate;
  }
  return null;
}

function attributes(tag) {
  const found = {};
  for (const [, name, , value = ''] of tag.matchAll(/([^\s=<>/]+)(\s*=\s*"([^"]*)")?/g)) found[name.toLowerCase()] = value;
  return found;
}

/** What dist/index.html links and holds: its module script, its stylesheet and its inline blocks by id. */
function readIndex(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(match => attributes(match[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0]));
  const entry = scripts.find(attrs => attrs.type === 'module' && attrs.src);
  const css = links.find(attrs => (attrs.rel || '').split(/\s+/).includes('stylesheet') && attrs.href);
  const inline = id => {
    const match = new RegExp(`<([a-z]+)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`, 'i').exec(html);
    return match ? match[2] : null;
  };
  return { entry: entry ? entry.src : null, css: css ? css.href : null, inline };
}

const gzip = buffer => gzipSync(buffer, { level: 9 }).length;

function main() {
  const config = JSON.parse(readFileSync(join(HERE, 'budgets.json'), 'utf8'));
  const stage = stageNumber(STAGE, 'LX_STAGE');
  const indexFile = join(DIST, 'index.html');
  if (!existsSync(indexFile)) {
    console.error(`budgets: no build at ${DIST} (dist/index.html is missing). Run \`npx vite build\` at the repository root first.`);
    process.exit(2);
  }
  const index = readIndex(readFileSync(indexFile, 'utf8'));

  // Every piece: its files, raw and gzip bytes. A piece not marked optional must be there.
  const problems = [];
  const pieces = {};
  for (const [name, piece] of Object.entries(config.pieces)) {
    const files = [];
    let raw = 0;
    let gz = 0;
    for (const spec of piece.files) {
      let entries = [];
      if (spec === '@entry-js' || spec === '@entry-css') {
        const url = spec === '@entry-js' ? index.entry : index.css;
        const path = url ? distPath(url) : null;
        if (path) entries = [{ file: path, buffer: readFileSync(join(DIST, path)) }];
      } else if (spec.startsWith('@inline:')) {
        const text = index.inline(spec.slice('@inline:'.length));
        if (text !== null) entries = [{ file: `index.html ${spec.slice(1)}`, buffer: Buffer.from(text) }];
      } else {
        entries = glob(spec).map(file => ({ file, buffer: readFileSync(join(DIST, file)) }));
      }
      for (const { file, buffer } of entries) {
        const size = { file, raw: buffer.length, gzip: gzip(buffer) };
        files.push(size);
        raw += size.raw;
        gz += size.gzip;
      }
    }
    const present = files.length > 0;
    if (!present && !piece.optional) problems.push(`${name}: nothing in ${relative(process.cwd(), DIST) || '.'} matches ${piece.files.join(', ')}`);
    pieces[name] = { what: piece.what, files, raw, gzip: gz, present };
  }

  const results = config.budgets.map(budget => {
    const names = budget.formula ? budget.formula.split('+').map(part => part.trim()).filter(Boolean) : null;
    for (const name of names || []) if (!pieces[name]) throw new Error(`budgets: ${budget.name} sums an unknown piece "${name}"`);
    const own = budget.files ? budget.files.flatMap(spec => glob(spec).map(file => readFileSync(join(DIST, file)))) : [];
    const bytes = names ? names.reduce((sum, name) => sum + pieces[name].gzip, 0) : own.reduce((sum, buffer) => sum + gzip(buffer), 0);
    const measured = names ? names.some(name => pieces[name].present) : own.length > 0;
    const from = stageNumber(budget.from, `${budget.name}.from`);
    const until = budget.until ? stageNumber(budget.until, `${budget.name}.until`) : Infinity;
    const applies = from <= stage && stage <= until;
    const over = measured && bytes / 1000 > budget.limitKB;
    let status;
    if (!measured) status = applies ? 'not built' : 'n/a';
    else if (applies) status = over ? 'OVER' : 'ok';
    else if (stage > until) status = `retired after ${budget.until}`;
    else status = `${over ? 'over' : 'ok'} (applies from ${budget.from})`;
    return {
      name: budget.name,
      sum: names ? names.join(' + ') : budget.files.join(', '),
      gzipBytes: bytes,
      sizeKB: kB(bytes),
      limitKB: budget.limitKB,
      from: budget.from,
      until: budget.until || null,
      applies,
      over,
      status,
      spec: budget.spec,
    };
  });

  const failing = results.filter(result => result.applies && result.over);
  const table = formatTable(
    ['budget', 'size', 'limit', 'from', 'status', 'pieces'],
    results.map(result => [result.name, `${result.sizeKB.toFixed(1)} kB`, `${result.limitKB} kB`, result.until ? `${result.from}-${result.until}` : result.from, result.status, result.sum]),
  );
  const sizes = formatTable(
    ['piece', 'gzip', 'raw', 'files'],
    Object.entries(pieces).map(([name, piece]) => [name, piece.present ? `${kB(piece.gzip).toFixed(1)} kB` : 'absent', piece.present ? `${kB(piece.raw).toFixed(1)} kB` : '-', piece.files.map(file => file.file).join(', ')]),
  );
  const file = writeReport('budgets.json', {
    measuredAt: new Date().toISOString(),
    dist: DIST,
    stage: STAGE,
    enforce: ENFORCE,
    unit: 'kB = 1000 bytes, gzip level 9',
    index: { entry: index.entry, css: index.css },
    pieces,
    budgets: results,
    problems,
  });

  console.log(`Landing budgets at ${STAGE} (${DIST}), gzip level 9, 1 kB = 1000 bytes:\n\n${table}\n\n${sizes}\n`);
  for (const problem of problems) console.log(`problem: ${problem}`);
  console.log(`Wrote ${file}`);
  if (failing.length) {
    console.log(`\n${failing.length} budget${failing.length === 1 ? '' : 's'} over at ${STAGE}: ${failing.map(result => `${result.name} ${result.sizeKB.toFixed(1)} > ${result.limitKB} kB`).join('; ')}${ENFORCE ? '' : ' (reported only: LX_ENFORCE is not 1)'}`);
  }
  if (ENFORCE && (failing.length || problems.length)) process.exit(1);
}

main();
