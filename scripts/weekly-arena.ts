/**
 * Weekly Arena generator.
 *
 *   npx tsx scripts/weekly-arena.ts [--start YYYY-MM-DD] [--days 7] [--count 10] [--dry]
 *
 * Builds a fresh, randomly drawn arena of freshly generated numeric questions
 * (every answer is computed or brute-forced here, never typed by hand) and
 * writes it as an idempotent SQL migration. The ledger in
 * supabase/weekly-arenas/ledger.json records every question fingerprint and
 * statement already used, so a new week never repeats an old question.
 */
import { createHash, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { problemScore } from '../shared/problemScore';

type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';
interface Draft { key: string; params: unknown[]; title: string; question: string; answer: number; hint: string; solution: string; topic: Topic; level: 'Foundation' | 'Intermediate' | 'Advanced'; steps: number; abstraction: number }
interface Ledger { weeks: Record<string, { title: string; fingerprints: string[]; statements: string[] }> }

const ri = (a: number, b: number) => randomInt(a, b + 1);
const pick = <T,>(xs: T[]): T => xs[randomInt(0, xs.length)];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
const modpow = (b: number, e: number, m: number) => { let r = 1n, x = BigInt(b) % BigInt(m); let k = BigInt(e); const M = BigInt(m); while (k > 0n) { if (k & 1n) r = (r * x) % M; x = (x * x) % M; k >>= 1n; } return Number(r); };

const templates: Array<() => Draft | null> = [
  // ---- Algebra
  () => { const p = ri(3, 9), q = ri(1, 4), n = ri(5, 8); let a = 2n, b = BigInt(p); const P = BigInt(p), Q = BigInt(q); if (n === 0) return null; const s = [a, b]; for (let i = 2; i <= n; i++) s.push(P * s[i - 1] - Q * s[i - 2]); return { key: 'alg-powersum', params: [p, q, n], title: 'Powers of the Roots', topic: 'Algebra', level: 'Advanced', steps: 4, abstraction: 3,
    question: `Let $r$ and $s$ be the roots of $t^2 - ${p}t + ${q} = 0$. Find the remainder when $r^{${n}} + s^{${n}}$ is divided by $1000$.`, answer: Number(s[n] % 1000n),
    hint: `Let $S_k=r^k+s^k$. Then $S_k=${p}S_{k-1}-${q}S_{k-2}$, with $S_0=2$, $S_1=${p}$.`, solution: `Using $S_k=${p}S_{k-1}-${q}S_{k-2}$ from $S_0=2$, $S_1=${p}$ gives $S_{${n}}=${s[n]}$, whose remainder modulo $1000$ is $${s[n] % 1000n}$.` }; },
  () => { const N = ri(200, 999), a = ri(3, 13); let b = ri(3, 13); if (gcd(a, b) !== 1 || a === b) return null; let sum = 0; for (let i = 1; i <= N; i++) if (i % a === 0 || i % b === 0) sum += i; return { key: 'alg-incl-excl-sum', params: [N, a, b], title: 'Multiples of Two Numbers', topic: 'Algebra', level: 'Intermediate', steps: 4, abstraction: 2,
    question: `Find the sum of all positive integers not exceeding $${N}$ that are divisible by $${a}$ or by $${b}$ (or both).`, answer: sum,
    hint: 'Add the sum of multiples of each number, then subtract the multiples of their product that were counted twice.', solution: `Inclusion-exclusion over multiples of $${a}$, $${b}$ and $${a * b}$ gives $${sum}$.` }; },
  () => { const k = ri(3, 6), n = ri(4, 6); let a = 2, b = k; for (let i = 2; i <= n; i++) [a, b] = [b, k * b - a]; return { key: 'alg-reciprocal-power', params: [k, n], title: 'Reciprocal Powers', topic: 'Algebra', level: 'Intermediate', steps: 3, abstraction: 2,
    question: `A positive real number $x$ satisfies $x + \\dfrac{1}{x} = ${k}$. Find $x^{${n}} + \\dfrac{1}{x^{${n}}}$.`, answer: b,
    hint: `Set $T_m=x^m+x^{-m}$; then $T_m=${k}T_{m-1}-T_{m-2}$.`, solution: `With $T_0=2$, $T_1=${k}$ the recurrence gives $T_{${n}}=${b}$.` }; },
  () => { const N = ri(25, 70), a = ri(2, 9), b = ri(a + 1, 14); if (gcd(a, b) !== 1) return null; let s = 0; for (let i = 1; i <= N; i++) s += Math.floor((i * a) / b); return { key: 'alg-floor-sum', params: [N, a, b], title: 'A Floor Sum', topic: 'Algebra', level: 'Advanced', steps: 4, abstraction: 3,
    question: `Compute $\\displaystyle\\sum_{k=1}^{${N}} \\left\\lfloor \\frac{${a}k}{${b}} \\right\\rfloor$.`, answer: s,
    hint: `Write $${a}k=${b}q+r$ and track how the remainder cycles with period $${b}$.`, solution: `Evaluating each floor term and adding gives $${s}$.` }; },
  // ---- Geometry
  () => { const p = ri(2, 14), q = ri(1, 13), r = ri(1, 14), s = ri(2, 14); const twice = Math.abs(p * s - q * r); if (twice < 12) return null; const B = gcd(p, q) + gcd(r, s) + gcd(p - r, q - s); const I = (twice - B + 2) / 2; if (!Number.isInteger(I) || I < 3) return null; return { key: 'geo-pick', params: [p, q, r, s], title: 'Lattice Points Inside', topic: 'Geometry', level: 'Advanced', steps: 4, abstraction: 3,
    question: `A triangle has vertices $(0,0)$, $(${p},${q})$ and $(${r},${s})$ in the coordinate plane. How many points with integer coordinates lie strictly inside the triangle?`, answer: I,
    hint: "Use Pick's theorem: $A=I+B/2-1$, with $B$ counted by gcds along each side.", solution: `Twice the area is $${twice}$ and the boundary has $B=${B}$ lattice points, so $I=(${twice}-${B}+2)/2=${I}$.` }; },
  () => { const n = ri(8, 24); const t = (n * (n - 4) * (n - 5)) / 6; return { key: 'geo-diagonal-triangles', params: [n], title: 'Triangles From Diagonals Only', topic: 'Geometry', level: 'Intermediate', steps: 4, abstraction: 3,
    question: `Three vertices of a convex $${n}$-gon are chosen so that none of the three sides of the resulting triangle is a side of the polygon. How many such triangles are there?`, answer: t,
    hint: 'Count all triangles and remove those that use at least one polygon side, by inclusion-exclusion.', solution: `The count is $\\dfrac{n(n-4)(n-5)}{6}$ with $n=${n}$, i.e. $${t}$.` }; },
  () => { const [d, h, L] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [10, 24, 26]]); const b2 = ri(4, 20); const b1 = b2 + 2 * d; const area = ((b1 + b2) * h) / 2; return { key: 'geo-trapezoid', params: [b1, b2, L], title: 'The Isosceles Trapezoid', topic: 'Geometry', level: 'Foundation', steps: 3, abstraction: 2,
    question: `An isosceles trapezoid has parallel sides of lengths $${b1}$ and $${b2}$ and each non-parallel side has length $${L}$. Find its area.`, answer: area,
    hint: `Drop perpendiculars from the shorter base; each cuts off a right triangle with base $${d}$ and hypotenuse $${L}$.`, solution: `The height is $\\sqrt{${L}^2-${d}^2}=${h}$, so the area is $\\tfrac12(${b1}+${b2})(${h})=${area}$.` }; },
  () => { const t = ri(6, 40); const divs: number[] = []; for (let a = 1; a < t; a++) if ((t * t) % a === 0 && (t * t) / a > a) divs.push(a); if (!divs.length) return null; const a = pick(divs); const far = (t * t) / a; return { key: 'geo-tangent-secant', params: [t, a], title: 'Tangent and Secant', topic: 'Geometry', level: 'Intermediate', steps: 3, abstraction: 3,
    question: `From an external point $P$, a tangent $PT$ of length $${t}$ and a secant meeting the circle at $A$ and $B$ are drawn, with $PA < PB$ and $PA=${a}$. Find $PA + PB + PT$.`, answer: a + far + t,
    hint: 'Apply the power of a point: $PT^2=PA\\cdot PB$.', solution: `$PB=${t}^2/${a}=${far}$, so the sum is $${a}+${far}+${t}=${a + far + t}$.` }; },
  // ---- Combinatorics
  () => { const n = ri(9, 25); let a = 1, b = 2; for (let i = 1; i < n; i++) [a, b] = [b, a + b]; return { key: 'com-no-adjacent-ones', params: [n], title: 'No Neighbouring Ones', topic: 'Combinatorics', level: 'Intermediate', steps: 4, abstraction: 3,
    question: `How many binary strings of length $${n}$ contain no two consecutive $1$s?`, answer: b,
    hint: 'Condition on the last digit to get a Fibonacci-type recurrence.', solution: `Let $f(n)=f(n-1)+f(n-2)$ with $f(1)=2$, $f(2)=3$; then $f(${n})=${b}$.` }; },
  () => { const k = ri(3, 5), n = ri(9, 20), m = ri(4, 8); if (k * m < n) return null; let ways = new Array(n + 1).fill(0); ways[0] = 1; for (let i = 0; i < k; i++) { const nx = new Array(n + 1).fill(0); for (let s = 0; s <= n; s++) for (let x = 0; x <= m && x <= s; x++) nx[s] += ways[s - x]; ways = nx; } return { key: 'com-bounded-sums', params: [k, n, m], title: 'Bounded Distributions', topic: 'Combinatorics', level: 'Advanced', steps: 5, abstraction: 3,
    question: `How many ordered ${k}-tuples $(x_1,\\dots,x_${k})$ of non-negative integers satisfy $x_1+\\cdots+x_${k}=${n}$ with every $x_i\\le ${m}$?`, answer: ways[n],
    hint: 'Count unrestricted solutions by stars and bars, then use inclusion-exclusion on variables exceeding the bound.', solution: `Inclusion-exclusion (verified by dynamic programming) gives $${ways[n]}$.` }; },
  () => { const letters = 'ABCDEFGHJKLMNPRSTW'.split(''); const kinds = ri(3, 4); const set: string[] = []; while (set.length < kinds) { const c = pick(letters); if (!set.includes(c)) set.push(c); } const counts = set.map(() => ri(1, 3)); const total = counts.reduce((x, y) => x + y, 0); if (total < 7 || total > 9 || counts.every(c => c === 1)) return null; const rem = [...counts]; let good = 0; const go = (last: number, left: number) => { if (!left) { good++; return; } for (let i = 0; i < rem.length; i++) if (rem[i] && i !== last) { rem[i]--; go(i, left - 1); rem[i]++; } }; go(-1, total);
    const word = set.map((c, i) => c.repeat(counts[i])).join(''); return { key: 'com-no-adjacent-equal', params: [word], title: 'Rearranging a Word', topic: 'Combinatorics', level: 'Advanced', steps: 5, abstraction: 4,
    question: `In how many distinct ways can the letters of $\\text{${word}}$ be rearranged so that no two identical letters are adjacent?`, answer: good,
    hint: 'Count all arrangements, then use inclusion-exclusion by gluing identical letters together.', solution: `Inclusion-exclusion (confirmed by exhaustive enumeration) gives $${good}$.` }; },
  () => { const a = ri(5, 9), b = ri(5, 9), c = ri(1, a - 1), d = ri(1, b - 1); const paths = (x: number, y: number) => choose(x + y, x); const ans = paths(a, b) - paths(c, d) * paths(a - c, b - d); return { key: 'com-grid-avoid', params: [a, b, c, d], title: 'A Blocked Lattice Path', topic: 'Combinatorics', level: 'Intermediate', steps: 4, abstraction: 3,
    question: `A path from $(0,0)$ to $(${a},${b})$ moves only one unit right or one unit up at each step. How many such paths avoid the point $(${c},${d})$?`, answer: ans,
    hint: 'Subtract the paths that pass through the forbidden point from the total.', solution: `$\\binom{${a + b}}{${a}}-\\binom{${c + d}}{${c}}\\binom{${a + b - c - d}}{${a - c}}=${ans}$.` }; },
  // ---- Number Theory
  () => { const a = pick([3, 7, 9, 11, 13, 17, 19, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43, 47, 49, 53, 57, 61, 63, 67, 69, 71, 73, 77, 79, 83, 87, 89, 91, 93, 97]); const e = ri(60, 600); return { key: 'nt-last-digits', params: [a, e], title: 'The Last Three Digits', topic: 'Number Theory', level: 'Advanced', steps: 4, abstraction: 3,
    question: `Find the remainder when $${a}^{${e}}$ is divided by $1000$.`, answer: modpow(a, e, 1000),
    hint: 'Work modulo $8$ and modulo $125$ separately and combine, or use the order of the unit in $(\\mathbb Z/1000)^\\times$.', solution: `Modular exponentiation gives $${a}^{${e}}\\equiv ${modpow(a, e, 1000)} \\pmod{1000}$.` }; },
  () => { const primes = [2, 3, 5, 7, 11, 13]; const ps = [...primes].sort(() => randomInt(0, 3) - 1).slice(0, ri(2, 3)).sort((x, y) => x - y); const M = ps.reduce((x, y) => x * y, 1); const N = ri(300, 999); let cnt = 0; for (let i = 1; i <= N; i++) if (gcd(i, M) === 1) cnt++; return { key: 'nt-coprime-count', params: [N, ...ps], title: 'Coprime Count', topic: 'Number Theory', level: 'Intermediate', steps: 3, abstraction: 2,
    question: `How many integers $n$ with $1\\le n\\le ${N}$ are relatively prime to $${M}$?`, answer: cnt,
    hint: `Remove multiples of ${ps.join(', ')} using inclusion-exclusion.`, solution: `Inclusion-exclusion over the primes ${ps.join(', ')} leaves $${cnt}$ integers.` }; },
  () => { const ps = [2, 3, 5, 7].sort(() => randomInt(0, 3) - 1).slice(0, 3); const es = ps.map(() => ri(1, 4)); const N = ps.reduce((x, p, i) => x * p ** es[i], 1); if (N > 20000) return null; let sg = 0; for (let d = 1; d <= N; d++) if (N % d === 0) sg += d; if (sg > 999999) return null; return { key: 'nt-divisor-sum', params: [N], title: 'Sum of Divisors', topic: 'Number Theory', level: 'Foundation', steps: 3, abstraction: 2,
    question: `Find the sum of all positive divisors of $${N}$.`, answer: sg,
    hint: 'Factor $N$ into primes; the divisor sum is multiplicative.', solution: `$${N}=${ps.map((p, i) => `${p}^{${es[i]}}`).join('\\cdot ')}$, so the divisor sum is $${sg}$.` }; },
  () => { const ms = [5, 7, 9, 11, 13].sort(() => randomInt(0, 3) - 1).slice(0, 3); const P = ms.reduce((x, y) => x * y, 1); const rs = ms.map(m => ri(1, m - 1)); let n = 1; while (n <= P && !ms.every((m, i) => n % m === rs[i])) n++; if (n > P) return null; return { key: 'nt-crt', params: [...ms, ...rs], title: 'Three Remainders', topic: 'Number Theory', level: 'Intermediate', steps: 4, abstraction: 3,
    question: `Find the smallest positive integer $n$ such that ${ms.map((m, i) => `$n\\equiv ${rs[i]} \\pmod{${m}}$`).join(', ')}.`, answer: n,
    hint: 'The moduli are pairwise coprime, so the Chinese Remainder Theorem gives a unique residue class.', solution: `Combining the congruences gives the residue class of $${n}$ modulo $${P}$, and $${n}$ is its smallest positive member.` }; },
];

function parseArgs() {
  const a = process.argv.slice(2); const get = (f: string) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  return { start: get('--start'), days: Number(get('--days') ?? 7), count: Number(get('--count') ?? 10), dry: a.includes('--dry') };
}
function isoWeek(d: Date) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((+t - +new Date(Date.UTC(y, 0, 1))) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`; }
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

const opt = parseArgs();
const start = opt.start ? new Date(`${opt.start}T00:00:00Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const end = new Date(+start + opt.days * 864e5);
const week = isoWeek(start); const title = `Weekly Arena ${week}`;
const ledgerPath = new URL('../supabase/weekly-arenas/ledger.json', import.meta.url).pathname;
const ledger: Ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { weeks: {} };
if (ledger.weeks[week]) { console.log(`${title} already generated; nothing to do.`); process.exit(0); }
const usedFp = new Set(Object.values(ledger.weeks).flatMap(w => w.fingerprints));
const usedQ = new Set(Object.values(ledger.weeks).flatMap(w => w.statements));

// Balanced draw: cycle topics so each is represented, new questions only.
const order: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
const chosen: Draft[] = []; const fps = new Set<string>(); const qs = new Set<string>(); const tplUse = new Map<number, number>();
let guard = 0;
while (chosen.length < opt.count && guard++ < 20000) {
  const want = order[chosen.length % order.length];
  const idx = randomInt(0, templates.length); if ((tplUse.get(idx) ?? 0) >= 1 && guard < 5000) continue;
  const d = templates[idx](); if (!d || d.topic !== want) continue;
  if (d.answer < 0 || d.answer > 999999 || !Number.isInteger(d.answer)) continue;
  const fp = sha(d.key + JSON.stringify(d.params)); const sq = sha(d.question);
  if (usedFp.has(fp) || usedQ.has(sq) || fps.has(fp) || qs.has(sq)) continue;
  fps.add(fp); qs.add(sq); tplUse.set(idx, (tplUse.get(idx) ?? 0) + 1); chosen.push(d);
}
if (chosen.length < opt.count) throw new Error('Could not draw enough unused questions');
chosen.sort((a, b) => ({ Foundation: 0, Intermediate: 1, Advanced: 2 }[a.level] - { Foundation: 0, Intermediate: 1, Advanced: 2 }[b.level]));

const questions = chosen.map((d, i) => {
  const answer = String(d.answer); const base = { estimatedSteps: d.steps, abstraction: d.abstraction, answerMode: 'numeric-grid' as const };
  const points = problemScore(base);
  return { id: `wk-${week.toLowerCase()}-${String(i + 1).padStart(2, '0')}-${sha(d.question).slice(0, 4)}`, title: d.title, topic: d.topic, level: d.level, question: d.question, type: 'text', correctAnswer: answer, hint: d.hint, solution: d.solution,
    answerMode: 'numeric-grid', answerDigits: Math.max(3, answer.length), maxAttempts: 3, estimatedSteps: d.steps, abstraction: d.abstraction, points, difficulty: Math.max(-2.5, Math.min(2.5, (points - 60) / 25)) };
});
const description = `Fresh weekly set of ${questions.length} numeric questions across Algebra, Geometry, Combinatorics and Number Theory. Each question allows three submissions. New questions every week, none repeated from earlier arenas.`;
const tag = 'WK' + sha(week);
const sql = `-- ${title}: generated by scripts/weekly-arena.ts. Safe to rerun (skips if the title already exists).
insert into public.arenas(title, description, starts_at, ends_at, duration_minutes, status, questions)
select '${title}', '${description}', '${start.toISOString()}', '${end.toISOString()}', 60, 'published', $${tag}$${JSON.stringify(questions)}$${tag}$::jsonb
where not exists (select 1 from public.arenas where title = '${title}');
`;
console.log(`${title}: ${questions.map(q => `${q.topic[0]}${q.correctAnswer}`).join(' ')}`);
if (opt.dry) process.exit(0);
const stamp = start.toISOString().slice(0, 10).replace(/-/g, '');
writeFileSync(new URL(`../supabase/migrations/${stamp}000100_weekly_arena_${week.toLowerCase()}.sql`, import.meta.url), sql);
ledger.weeks[week] = { title, fingerprints: [...fps], statements: [...qs] };
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1) + '\n');
