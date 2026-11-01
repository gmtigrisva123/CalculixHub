// Weekly Arena generator: picks a fresh random set of numeric-answer problems
// from the bank, avoiding anything used in earlier weeks (manifest.json), and
// writes a Supabase migration that publishes the arena.
// Usage: npx tsx scripts/weekly-arena/generate.ts [--start=ISO] [--count=10] [--minutes=60]
import { createHash, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problems } from '../../server/data';
import { problemScore } from '../../shared/problemScore';

const dir = dirname(fileURLToPath(import.meta.url));
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const count = Number(arg('count', '10')), minutes = Number(arg('minutes', '60'));
const manifestPath = join(dir, 'manifest.json');
type Entry = { week: string; title: string; ids: string[] };
const manifest: Entry[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];

// Next Monday 00:00 UTC (or --start); the arena stays open 7 days.
const next = new Date(); next.setUTCHours(0, 0, 0, 0); next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7));
const start = new Date(arg('start', next.toISOString())), end = new Date(start.getTime() + 7 * 864e5);
const week = start.toISOString().slice(0, 10);
if (manifest.some(m => m.week === week)) { console.error(`Arena for ${week} already generated.`); process.exit(1); }

const pool = problems.filter(p => !p.proOnly && /^\d{1,6}$/.test(p.correctAnswer));
const lastUsed = new Map<string, number>(); manifest.forEach((m, i) => m.ids.forEach(id => lastUsed.set(id, i)));
// Never-used first, then least recently used; shuffle inside each tier.
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fresh = shuffle(pool.filter(p => !lastUsed.has(p.id)));
const stale = shuffle(pool.filter(p => lastUsed.has(p.id))).sort((a, b) => lastUsed.get(a.id)! - lastUsed.get(b.id)!);
// Balance topics: round-robin across the four topics.
const ordered = [...fresh, ...stale], picked: typeof pool = [];
const topics = shuffle([...new Set(pool.map(p => p.topic))]);
for (let r = 0; picked.length < Math.min(count, pool.length) && r < pool.length; r++) {
  const t = topics[r % topics.length], c = ordered.find(p => p.topic === t && !picked.includes(p));
  if (c) picked.push(c); else if (r > topics.length * 20) break;
}
for (const p of ordered) if (picked.length < Math.min(count, pool.length) && !picked.includes(p)) picked.push(p);
const questions = shuffle(picked).map(p => {
  const points = problemScore({ ...p, answerMode: 'numeric-grid' } as never);
  return { id: p.id, title: p.title, question: p.question, correctAnswer: p.correctAnswer, solution: p.solution, hint: p.hint ?? '', topic: p.topic, level: p.level, competition: p.competition, estimatedSteps: p.estimatedSteps, abstraction: p.abstraction, type: 'text', answerMode: 'numeric-grid', answerDigits: Math.max(3, p.correctAnswer.length), maxAttempts: 3, points, difficulty: Math.max(-2.5, Math.min(2.5, (points - 60) / 25)) };
});
const title = `Weekly Arena — ${week}`;
const id = createHash('sha1').update(`weekly-arena-${week}`).digest('hex').replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12}).*$/, '$1-$2-4$3-8$4-$5');
const q = JSON.stringify(questions).replace(/'/g, "''");
const sql = `-- Weekly Arena ${week}: ${questions.length} questions, ${fresh.length >= count ? 'all unseen' : 'recycled least-recent'}.\ninsert into public.arenas(id,title,description,starts_at,ends_at,duration_minutes,status,questions)\nvalues('${id}','${title}','A fresh weekly set of ${questions.length} problems across Algebra, Geometry, Combinatorics and Number Theory. Open for 7 days; ${minutes} minutes once you begin.','${start.toISOString()}','${end.toISOString()}',${minutes},'published','${q}'::jsonb)\non conflict(id) do nothing;\n`;
const file = join(dir, '../../supabase/migrations', `${start.toISOString().slice(0, 10).replace(/-/g, '')}000500_weekly_arena.sql`);
writeFileSync(file, sql);
manifest.push({ week, title, ids: questions.map(x => x.id) });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(`Wrote ${file}\n${questions.map(x => `${x.topic}/${x.level}: ${x.id}`).join('\n')}`);
