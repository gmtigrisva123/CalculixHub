/**
 * Deterministic, topic-balanced competition bank.
 *
 * Rewards use the shared editorial rubric. They are provisional and require
 * human-response calibration before being interpreted as measured difficulty.
 */

import { problemScore } from '../shared/problemScore';
import { olympiadExtension } from './olympiadExtension';
import type { AnswerMode, CompetitionLevel, GeometryFigure, Level, Problem, Topic } from '../shared/types';

const CONTESTS: CompetitionLevel[] = ['AMC', 'AIME', 'USAMO', 'IMO'];
const SETTINGS: Record<CompetitionLevel, { level: Level }> = {
  AMC: { level: 'Foundation' },
  AIME: { level: 'Advanced' },
  USAMO: { level: 'Olympiad' },
  IMO: { level: 'Olympiad' },
};
const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

function modeFor(contest: CompetitionLevel): AnswerMode {
  return contest === 'AMC' ? 'choice' : contest === 'AIME' ? 'numeric-grid' : 'proof';
}

function numeric(value: number, digits = 3): string {
  const modulus = 10 ** digits;
  return String(((Math.trunc(value) % modulus) + modulus) % modulus).padStart(digits, '0');
}

function choices(answer: number, variant: number): string[] {
  const options = [-2, 0, 1, 4, 7].map((offset) => String(answer + offset));
  const rotation = variant % options.length;
  return [...options.slice(rotation), ...options.slice(0, rotation)];
}

function choose(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function catalan(n: number): number {
  return Math.round(choose(2 * n, n) / (n + 1));
}

function fibonacci(n: number): number {
  let a = 1;
  let b = 2;
  for (let i = 0; i < n; i += 1) [a, b] = [b, a + b];
  return a;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function powMod(base: number, exponent: number, modulus: number): number {
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  let result = 1 % modulus;
  while (e > 0) {
    if (e % 2 === 1) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e = Math.floor(e / 2);
  }
  return result;
}

function factors(n: number): Map<number, number> {
  const result = new Map<number, number>();
  let value = n;
  for (let p = 2; p * p <= value; p += 1) {
    while (value % p === 0) {
      result.set(p, (result.get(p) || 0) + 1);
      value /= p;
    }
  }
  if (value > 1) result.set(value, (result.get(value) || 0) + 1);
  return result;
}

function phi(n: number): number {
  let result = n;
  for (const p of factors(n).keys()) result = (result / p) * (p - 1);
  return result;
}

function divisorCount(n: number): number {
  let result = 1;
  for (const exponent of factors(n).values()) result *= exponent + 1;
  return result;
}

function heron(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2;
  return Math.round(Math.sqrt(s * (s - a) * (s - b) * (s - c)));
}

function area(points: Array<[number, number]>): number {
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    twice += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(twice) / 2;
}

function distinctDigitCount(length: number): number {
  let count = 0;
  const visit = (prefix: string, used: Set<number>) => {
    if (prefix.length === length) {
      if (Number(prefix) % 3 === 0) count += 1;
      return;
    }
    for (let digit = 0; digit <= 9; digit += 1) {
      if (used.has(digit) || (prefix.length === 0 && digit === 0)) continue;
      used.add(digit);
      visit(prefix + digit, used);
      used.delete(digit);
    }
  };
  visit('', new Set<number>());
  return count;
}

interface Draft {
  title: string;
  question: string;
  answer: string;
  hint: string;
  solution: string;
  steps: number;
  abstraction: number;
  numeric?: boolean;
  figure?: GeometryFigure;
}

function makeProblem(contest: CompetitionLevel, topic: Topic, variant: number, draft: Draft): Problem {
  const mode = modeFor(contest);
  const proof = mode === 'proof' || draft.numeric === false;
  const numericGrid = mode === 'numeric-grid' && draft.numeric !== false;
  const code = topic === 'Number Theory' ? 'num' : topic.slice(0, 3).toLowerCase();
  const digits = contest === 'AIME' && /remainder|modulo/.test(draft.question) ? 3 : Math.max(contest === 'AIME' ? 3 : 1, draft.answer.length);
  const answer = proof ? 'PROOF' : numericGrid && /^\d+$/.test(draft.answer) ? draft.answer.padStart(digits, '0') : draft.answer;
  return {
    id: 'gen-' + contest.toLowerCase() + '-' + code + '-' + String(variant + 1).padStart(3, '0'),
    title: draft.title,
    topic,
    level: SETTINGS[contest].level,
    competition: contest,
    question: draft.question,
    type: proof ? 'text' : mode === 'choice' ? 'multiple-choice' : 'text',
    options: !proof && mode === 'choice' ? choices(Number(draft.answer), variant) : undefined,
    correctAnswer: answer,
    hint: draft.hint,
    solution: proof ? draft.solution + ' This extended response is reserved for the future Pro tier.' : draft.solution,
    points: problemScore({ estimatedSteps: draft.steps, abstraction: draft.abstraction, answerMode: proof ? 'proof' : mode, figure: draft.figure }),
    answerMode: proof ? 'proof' : numericGrid && /^\d+$/.test(draft.answer) ? 'numeric-grid' : mode === 'choice' ? 'choice' : undefined,
    answerDigits: numericGrid && !proof && /^\d+$/.test(draft.answer) ? digits : undefined,
    proOnly: proof,
    maxAttempts: 3,
    figure: draft.figure,
    estimatedSteps: draft.steps,
    abstraction: draft.abstraction,
  };
}

function algebra(variant: number, ci: number): Draft {
  const shift = variant + ci;
  if (variant === 0) {
    const sum = 5 + shift;
    const product = 4 + ci;
    const answer = sum * sum - 2 * product;
    return { title: 'A symmetric pair', question: 'Positive reals $a,b$ satisfy $a+b=' + sum + '$ and $ab=' + product + '$. Find $a^2+b^2$.', answer: String(answer), hint: 'Expand $(a+b)^2$ and isolate $a^2+b^2$.', solution: '$a^2+b^2=' + sum + '^2-2(' + product + ')=' + answer + '$.', steps: 2, abstraction: 1 };
  }
  if (variant === 1) {
    const k = 3 + shift;
    const answer = k * k - 2;
    return { title: 'Reciprocal echoes', question: 'A positive real $x$ satisfies $x+\\frac1x=' + k + '$. Find $x^2+\\frac1{x^2}$.', answer: String(answer), hint: 'Square the relation and remove the middle term.', solution: '$(x+x^{-1})^2=x^2+2+x^{-2}=' + k + '^2$, so the answer is $' + answer + '$.', steps: 2, abstraction: 2 };
  }
  if (variant === 2) {
    const p = 4 + shift;
    const n = 4 + (ci % 3);
    const sequence = [2, p];
    for (let i = 2; i <= n; i += 1) sequence.push(p * sequence[i - 1] - sequence[i - 2]);
    const answer = sequence[n] % 1000;
    return { title: 'Power sums in disguise', question: 'Let $r,s$ be roots of $t^2-' + p + 't+1=0$. Find the remainder of $r^' + n + '+s^' + n + '$ modulo $1000$.', answer: String(answer), hint: 'Use $S_n=(r+s)S_{n-1}-rsS_{n-2}$ with $S_0=2$.', solution: 'The recurrence gives $S_' + n + '=' + sequence[n] + '$, whose final three digits are ' + numeric(answer) + '.', steps: 4, abstraction: 3 };
  }
  if (variant === 3) {
    const n = 8 + shift;
    const coefficient = 2 + (variant % 3);
    const constant = 1 + ci;
    const answer = n * n + coefficient * n + constant;
    return { title: 'A sequence with a footprint', question: 'A sequence is defined by $u_n=n^2+' + coefficient + 'n+' + constant + '$. Find $u_{' + n + '}$.', answer: String(answer), hint: 'Substitute the index and keep the quadratic and linear terms separate.', solution: '$u_{' + n + '}=' + n + '^2+' + coefficient + '(' + n + ')+' + constant + '=' + answer + '$.', steps: 2, abstraction: 1 };
  }
  if (variant === 4) {
    const sum = 7 + shift;
    const pair = 8 + variant + ci;
    const answer = sum * sum - 2 * pair;
    return { title: 'Three variables, one invariant', question: 'If $x+y+z=' + sum + '$ and $xy+yz+zx=' + pair + '$, find $x^2+y^2+z^2$.', answer: String(answer), hint: 'Expand $(x+y+z)^2$ and compare the cross terms.', solution: '$x^2+y^2+z^2=' + sum + '^2-2(' + pair + ')=' + answer + '$.', steps: 2, abstraction: 2 };
  }
  if (variant === 5) {
    const x = 2 + (ci % 3);
    const a = 2 + shift;
    const b = 3 + variant;
    const c = 1 + ci;
    const answer = x ** 3 + a * x ** 2 - b * x + c;
    return { title: 'Evaluate without expanding blindly', question: 'Find $P(' + x + ')$ for $P(t)=t^3+' + a + 't^2-' + b + 't+' + c + '$.', answer: String(answer), hint: 'Evaluate each power at the requested input before combining terms.', solution: '$P(' + x + ')=' + answer + '$ after substitution.', steps: 3, abstraction: 2 };
  }
  return { title: 'The equality case', question: 'For positive reals $a,b,c$ with $abc=1$, prove $(a+b+c)^2\\ge3(ab+bc+ca)$ and determine equality.', answer: 'PROOF', hint: 'Rewrite the difference as a sum of squares.', solution: 'The difference is $\\frac12((a-b)^2+(b-c)^2+(c-a)^2)\\ge0$. Equality gives $a=b=c=1$.', steps: 5, abstraction: 5, numeric: false };
}

function geometry(variant: number, ci: number): Draft {
  const triangles: Array<[number, number, number]> = [[13, 14, 15], [5, 5, 6], [6, 8, 10], [9, 10, 17], [10, 10, 12], [7, 15, 20], [20, 21, 29]];
  if (variant === 0) {
    const sides = triangles[(ci + variant) % triangles.length];
    const answer = heron(sides[0], sides[1], sides[2]);
    return { title: 'Heron, carefully', question: 'A triangle has side lengths ' + sides.join(', ') + '. Find its area.', answer: String(answer), hint: 'Use Heron’s formula with the semiperimeter.', solution: 'Heron’s formula gives area ' + answer + '.', steps: 3, abstraction: 2, figure: { kind: 'triangle', labels: sides.map(String), values: sides } };
  }
  if (variant === 1) {
    const sets: Array<[number, number, number, number]> = [[4, 5, 6, 7], [3, 4, 5, 6], [2, 3, 4, 5], [5, 6, 7, 8], [4, 6, 8, 10], [3, 5, 7, 9], [6, 7, 8, 9]];
    const sides = sets[(ci + variant) % sets.length];
    const s = sides.reduce((a, b) => a + b, 0) / 2;
    const answer = (s - sides[0]) * (s - sides[1]) * (s - sides[2]) * (s - sides[3]);
    return { title: 'A cyclic quadrilateral', question: 'A cyclic quadrilateral has sides $' + sides.join(',') + '$. Find the square of its area.', answer: String(answer), hint: 'Use Brahmagupta’s formula with the semiperimeter.', solution: '$K^2=' + answer + '$.', steps: 3, abstraction: 3, figure: { kind: 'quadrilateral', labels: sides.map(String), values: sides } };
  }
  if (variant === 2) {
    const triples: Array<[number, number, number]> = [[6, 8, 10], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20], [20, 21, 29]];
    const sides = triples[(ci + variant) % triples.length];
    const numerator = sides[0] * sides[1];
    const divisor = gcd(numerator, sides[2]);
    const answer = numerator / divisor;
    return { title: 'Altitude from area', question: 'A right triangle has legs ' + sides[0] + ' and ' + sides[1] + ', with hypotenuse ' + sides[2] + '. Write the altitude as a reduced fraction and find its numerator.', answer: String(answer), hint: 'Compute the area in two ways, then reduce the fraction.', solution: 'Equating the two area formulas gives altitude $' + numerator + '/' + sides[2] + '=' + answer + '/' + sides[2] / divisor + '$. Its numerator is ' + answer + '.', steps: 3, abstraction: 2, figure: { kind: 'triangle', labels: sides.map(String), values: sides } };
  }
  if (variant === 3) {
    const offset = ci + variant;
    const points: Array<[number, number]> = [[0, 0], [5 + offset, 0], [7 + offset, 4], [2, 6]];
    const answer = area(points);
    return { title: 'Coordinates with area', question: 'The vertices are $(0,0)$, $(' + (5 + offset) + ',0)$, $(' + (7 + offset) + ',4)$, and $(2,6)$. Find the area.', answer: String(answer), hint: 'Apply the shoelace formula.', solution: 'The shoelace sum gives area ' + answer + '.', steps: 4, abstraction: 3, figure: { kind: 'coordinate-grid', labels: points.map((p) => '(' + p[0] + ',' + p[1] + ')'), values: points.flat() } };
  }
  if (variant === 4) {
    const radius = 4 + ci + variant;
    const answer = radius * radius;
    return { title: 'A circle in disguise', question: 'A circle has circumference $' + (2 * radius) + '\\pi$. Find its area divided by $\\pi$.', answer: String(answer), hint: 'Recover the radius from $C=2\\pi r$.', solution: 'The radius is ' + radius + ', so area divided by pi is ' + answer + '.', steps: 2, abstraction: 1, figure: { kind: 'circle', labels: ['r=' + radius], values: [radius] } };
  }
  if (variant === 5) {
    const base = 4 + ci;
    const scale = 2 + (variant % 3);
    const answer = base * scale;
    return { title: 'Similarity carries the length', question: 'Two equilateral triangles have side ratio $1:' + scale + '$. If the smaller side is ' + base + ', find the larger side.', answer: String(answer), hint: 'Multiply by the scale factor once.', solution: 'The larger side is ' + scale + ' times ' + base + ', or ' + answer + '.', steps: 2, abstraction: 2, figure: { kind: 'triangle', labels: [String(base), String(base), String(base)], values: [base, base, base] } };
  }
  return { title: 'A proof about a circle', question: 'Prove that the perpendicular from the center of a circle to a chord bisects the chord.', answer: 'PROOF', hint: 'Join the center to both endpoints and compare right triangles.', solution: 'The two radii are equal and the perpendicular creates congruent right triangles, so the two half-chords are equal.', steps: 5, abstraction: 5, numeric: false, figure: { kind: 'circle', labels: ['O', 'A', 'B'], values: [5] } };
}

function combinatorics(variant: number, ci: number): Draft {
  const shift = ci + variant;
  if (variant === 0) {
    const n = 8 + shift;
    const k = 2 + (variant % 3);
    const answer = choose(n, k);
    return { title: 'Choose without order', question: 'How many ' + k + '-person teams can be chosen from ' + n + ' distinct people?', answer: String(answer), hint: 'Use a binomial coefficient.', solution: '$\\binom{' + n + '}{' + k + '}=' + answer + '$.', steps: 2, abstraction: 1 };
  }
  if (variant === 1) {
    const n = 8 + shift;
    const answer = fibonacci(n);
    return { title: 'Binary strings with breathing room', question: 'How many binary strings of length ' + n + ' contain no two consecutive $1$s?', answer: String(answer), hint: 'Split by the first symbol; the recurrence is Fibonacci-like.', solution: 'The recurrence $F_n=F_{n-1}+F_{n-2}$ gives ' + answer + '.', steps: 3, abstraction: 3 };
  }
  if (variant === 2) {
    const n = 6 + shift;
    const raw = 2 * factorial(n - 2);
    const answer = raw % 1000;
    return { title: 'A circular block', question: n + ' distinct people sit around a circle, with two specified people together. Find the count modulo $1000$.', answer: String(answer), hint: 'Treat the pair as one block with two orientations.', solution: 'The count is $2(' + (n - 2) + ')!=' + raw + '$, giving remainder ' + answer + '.', steps: 3, abstraction: 2 };
  }
  if (variant === 3) {
    const n = 4 + (shift % 4);
    const answer = catalan(n);
    return { title: 'A diagonal boundary', question: 'How many paths from $(0,0)$ to $(' + n + ',' + n + ')$ using east and north steps never go above $y=x$?', answer: String(answer), hint: 'This is the Catalan number $C_n$.', solution: '$C_' + n + '=' + answer + '$.', steps: 3, abstraction: 3 };
  }
  if (variant === 4) {
    const length = 4 + (shift % 2);
    const answer = distinctDigitCount(length);
    return { title: 'Distinct digits, one residue', question: 'How many ' + length + '-digit integers have distinct digits and are divisible by $3$?', answer: String(answer), hint: 'Group digit sets by their sum modulo 3 and handle a leading zero separately.', solution: 'Enumerating residue-compatible digit sets and valid leading digits gives ' + answer + '.', steps: 5, abstraction: 4 };
  }
  if (variant === 5) {
    const n = 500 + shift * 23;
    const a = 4 + (ci % 3);
    const b = 6 + (variant % 3);
    const answer = Math.floor(n / a) + Math.floor(n / b) - Math.floor(n / lcm(a, b));
    return { title: 'Inclusion–exclusion in a crowd', question: 'How many integers from $1$ through ' + n + ' are divisible by ' + a + ' or ' + b + '?', answer: String(answer), hint: 'Add both multiples and subtract the overlap.', solution: 'The inclusion–exclusion count is ' + answer + '.', steps: 3, abstraction: 2 };
  }
  return { title: 'An invariant of a colouring', question: 'Prove that every finite graph has two vertices of the same degree whenever it has at least two vertices.', answer: 'PROOF', hint: 'There are fewer possible degrees than vertices.', solution: 'Degrees range from 0 to n−1, but degree 0 and degree n−1 cannot coexist. Hence at most n−1 degree values occur among n vertices, forcing a repeat.', steps: 5, abstraction: 5, numeric: false };
}

function numberTheory(variant: number, ci: number): Draft {
  const shift = ci + variant;
  if (variant === 0) {
    const base = 3 + (shift % 7);
    const exponent = 2026 + shift * 17;
    const answer = powMod(base, exponent, 1000);
    return { title: 'A long power, reduced', question: 'Find the remainder when $' + base + '^{' + exponent + '}$ is divided by $1000$.', answer: String(answer), hint: 'Reduce the exponent with a period, then use repeated squaring.', solution: '$' + base + '^{' + exponent + '}\\equiv' + answer + '\\pmod{1000}$.', steps: 4, abstraction: 3 };
  }
  if (variant === 1) {
    const n = [60, 72, 84, 90][ci];
    const answer = phi(n);
    return { title: 'Coprime choices', question: 'How many positive integers less than ' + n + ' are coprime to ' + n + '?', answer: String(answer), hint: 'Use Euler’s product over distinct prime factors.', solution: '$\\varphi(' + n + ')=' + answer + '$.', steps: 3, abstraction: 2 };
  }
  if (variant === 2) {
    const a = 2 + (ci % 3);
    const b = 3 + (variant % 3);
    const c = 1 + (shift % 3);
    const n = 2 ** a * 3 ** b * 5 ** c;
    const answer = divisorCount(n);
    return { title: 'Counting divisors by exponents', question: 'How many positive divisors does $' + n + '$ have?', answer: String(answer), hint: 'Factor the number and multiply one more than each exponent.', solution: '$' + n + '=2^{' + a + '}3^{' + b + '}5^{' + c + '}$, so the count is ' + answer + '.', steps: 3, abstraction: 2 };
  }
  if (variant === 3) {
    const limit = 400 + shift * 37;
    const answer = Array.from({ length: limit }, (_, i) => i + 1).filter((n) => (n - powMod(2, n, 7)) % 7 === 0).length;
    return { title: 'A periodic congruence', question: 'How many integers $n$ with $1\\le n\\le' + limit + '$ satisfy $n\\equiv2^n\\pmod7$?', answer: String(answer), hint: 'The condition repeats with period $\\operatorname{lcm}(7,3)=21$.', solution: 'The valid residues in one period are 11, 15, and 16; counting them through ' + limit + ' gives ' + answer + '.', steps: 4, abstraction: 4 };
  }
  if (variant === 4) {
    const m = 5 + ci;
    const n = [11, 13, 17, 19][ci];
    const first = (2 + shift) % m;
    const second = (3 + shift) % n;
    let answer = first;
    while (answer % n !== second) answer += m;
    return { title: 'Two clocks, one residue', question: 'Find the least nonnegative $x$ with $x\\equiv' + first + '\\pmod{' + m + '}$ and $x\\equiv' + second + '\\pmod{' + n + '}$.' , answer: String(answer), hint: 'Substitute the first congruence into the second.', solution: 'The least compatible residue is ' + answer + '.', steps: 4, abstraction: 4 };
  }
  if (variant === 5) {
    const n = 20 + shift * 5;
    let value = n;
    let answer = 0;
    while (value > 0) { value = Math.floor(value / 5); answer += value; }
    return { title: 'Powers of five inside a factorial', question: 'Find the exponent of $5$ in the prime factorization of $' + n + '!$.', answer: String(answer), hint: 'Add the quotients by 5, 25, 125, and so on.', solution: 'Legendre’s formula gives exponent ' + answer + '.', steps: 3, abstraction: 2 };
  }
  return { title: 'A proof with residues', question: 'Prove that there are infinitely many primes congruent to 1 modulo 4 or 3 modulo 4.', answer: 'PROOF', hint: 'Assume a finite list and construct a number whose factors escape it.', solution: 'A Euclid-style number built from the finite list has a prime divisor in one of the two nontrivial residue classes, contradicting completeness.', steps: 6, abstraction: 5, numeric: false };
}

export function buildGeneratedProblems(): Problem[] {
  const result: Problem[] = [];
  for (const [ci, contest] of CONTESTS.entries()) {
    for (const [topicIndex, topic] of TOPICS.entries()) {
      for (let variant = 0; variant < 7; variant += 1) {
        let draft = topicIndex === 0 ? algebra(variant, ci)
          : topicIndex === 1 ? geometry(variant, ci)
            : topicIndex === 2 ? combinatorics(variant, ci)
              : numberTheory(variant, ci);
        if (ci === 3) {
          draft = olympiadExtension(topic, variant);
          if (topic === 'Geometry') draft.figure = { kind: variant === 4 ? 'quadrilateral' : 'triangle', values: variant === 4 ? [4, 5, 6, 7] : [13, 14, 15], illustrative: true,
            construction: variant === 4 ? 'diagonals' : variant === 0 ? 'centers' : variant === 6 ? 'median' : undefined };
        }
        else if (ci === 2) draft = proofDraft(topic, variant, ci);
        else if (variant === 6) draft = numericFinal(topic, ci);
        result.push(makeProblem(contest, topic, variant + topicIndex * 7, draft));
      }
    }
  }
  return result;
}

function numericFinal(topic: Topic, ci: number): Draft {
  const n = ci === 0 ? 8 : 12;
  if (topic === 'Algebra') return { title: 'A telescoping square sum', question: 'Find $\\sum_{k=1}^{' + n + '}(2k-1)$.', answer: String(n * n), hint: 'Recognize consecutive square differences.', solution: '$2k-1=k^2-(k-1)^2$, so the sum telescopes to $' + n * n + '$.', steps: 2, abstraction: 2 };
  if (topic === 'Geometry') return { title: 'A regular hexagon', question: 'A regular hexagon has side ' + n + '. Find its area divided by $\\sqrt3$.', answer: String(3 * n * n / 2), hint: 'Split the hexagon into six equilateral triangles.', solution: '$K=6(\\sqrt3/4)' + n + '^2$, so $K/\\sqrt3=' + 3 * n * n / 2 + '$.', steps: 3, abstraction: 2, figure: { kind: 'regular-polygon', values: [n, 6], labels: Array(6).fill(String(n)) } };
  if (topic === 'Combinatorics') return { title: 'Unordered triples', question: 'How many subsets of size 3 can be selected from ' + n + ' labelled objects?', answer: String(choose(n, 3)), hint: 'Divide ordered selections by $3!$.', solution: '$\\binom{' + n + '}{3}=' + choose(n, 3) + '$.', steps: 2, abstraction: 1 };
  const answer = powMod(3, n * 100 + 2, 1000);
  return { title: 'The exponent returns', question: 'Find $3^{' + (n * 100 + 2) + '}$ modulo 1000.', answer: String(answer), hint: 'Use the period of 3 modulo 1000.', solution: '$3^{100}\\equiv1\\pmod{1000}$, so the remainder is $9$.', steps: 3, abstraction: 3 };
}

function proofDraft(topic: Topic, variant: number, ci: number): Draft {
  const n = ci === 2 ? 5 + variant : 11 + variant;
  const base = { answer: 'PROOF', numeric: false, steps: [5, 4, 5, 4, 3, 4, 6][variant], abstraction: [4, 3, 4, 3, 2, 3, 5][variant] };
  const statements: Record<Topic, Array<[string, string, string, string]>> = {
    Algebra: [
      ['Nesbitt’s inequality', 'For positive $a,b,c$, prove $\\frac a{b+c}+\\frac b{c+a}+\\frac c{a+b}\\ge\\frac32$.', 'Use Engel-form Cauchy–Schwarz.', 'Cauchy gives $\\sum a/(b+c)\\ge(a+b+c)^2/[2(ab+bc+ca)]\\ge3/2$. The last inequality is $a^2+b^2+c^2\\ge ab+bc+ca$. Equality holds when $a=b=c$.'],
      ['Schur’s inequality', 'For nonnegative $a,b,c$, prove $a(a-b)(a-c)+b(b-c)(b-a)+c(c-a)(c-b)\\ge0$.', 'Order the variables.', 'Assume $a\\ge b\\ge c$. The first two summands combine to $(a-b)[a(a-c)-b(b-c)]=(a-b)^2(a+b-c)\\ge0$, and $c(c-a)(c-b)\\ge0$.'],
      ['A polynomial at consecutive integers', 'A polynomial $P$ with integer coefficients takes values 1 or −1 at ' + n + ' distinct integers. Prove that if $\\deg P<' + n + '/2$, then $P$ is constant.', 'Consider $P^2-1$.', '$P^2-1$ has ' + n + ' distinct roots and degree at most $2\\deg P<' + n + '$, so it is the zero polynomial. Thus $(P-1)(P+1)=0$ and $P$ is constant.'],
      ['A functional equation', 'Determine all continuous $f:\\mathbb R\\to\\mathbb R$ satisfying $f(x+y)=f(x)+f(y)$ and $f(1)=' + n + '$.', 'First prove the result on rational inputs.', 'Additivity implies $f(0)=0$, $f(-x)=-f(x)$, and $f(p/q)=' + n + 'p/q$. Density of rationals and continuity give $f(x)=' + n + 'x$ for all reals, which satisfies the equation.'],
      ['A product at fixed sum', 'Nonnegative reals $x_1,\\ldots,x_{' + n + '}$ sum to ' + n + '. Prove $\\prod(1+x_i)\\le2^{' + n + '}$ and characterize equality.', 'Apply AM–GM to $1+x_i$.', 'The arithmetic mean of $1+x_i$ is 2. AM–GM bounds their product by $2^{' + n + '}$. Equality requires all $x_i=1$.'],
      ['The reciprocal barrier', 'For positive $a,b,c$ with $abc=1$, prove $a^2+b^2+c^2\\ge a+b+c$.', 'Use the sum of squares bound and AM–GM.', 'Let $s=a+b+c\\ge3$. Cauchy gives $a^2+b^2+c^2\\ge s^2/3\\ge s$. Equality holds only at $a=b=c=1$.'],
      ['A quadratic form', 'Determine the least real $k$ such that $a^2+b^2+c^2+k(ab+bc+ca)\\ge0$ for all real $a,b,c$, and its full allowable range.', 'Test equal variables and a zero-sum triple.', 'Equal variables force $k\\ge-1$; $(1,-1,0)$ forces $k\\le2$. For $-1\\le k\\le2$, write the form as $((2-k)/3)(a^2+b^2+c^2-ab-bc-ca)+((k+1)/3)(a+b+c)^2$. Both coefficients and both forms are nonnegative. Thus the range is $[-1,2]$, and the least is −1.'],
    ],
    Geometry: [
      ['Euler’s relation', 'In a nondegenerate triangle, prove $OI^2=R(R-2r)$ for circumcenter $O$ and incenter $I$.', 'Use the midpoint of arc BC opposite A.', 'Let D be that arc midpoint. Angle chasing gives $DB=DI$. Since $AI=r/\\sin(A/2)$ and $DB=2R\\sin(A/2)$, one obtains $AI\\cdot ID=2Rr$. Power of I along AD gives $IA\\cdot ID=R^2-OI^2$, yielding the formula.'],
      ['The median identity', 'Prove $AB^2+AC^2=2(AM^2+BM^2)$ when $M$ is the midpoint of $BC$.', 'Place the midpoint at the coordinate origin.', 'Set $B=(-t,0)$, $C=(t,0)$ and $A=(u,v)$. The left side is $(u+t)^2+v^2+(u-t)^2+v^2=2(u^2+v^2+t^2)$, which equals the right side.'],
      ['Ceva’s theorem', 'Points D,E,F lie on sides BC,CA,AB of a triangle. Prove AD,BE,CF are concurrent exactly when $(BD/DC)(CE/EA)(AF/FB)=1$.', 'Use area ratios through the concurrency point, then prove the converse.', 'If the cevians meet at P, the side ratios equal ratios of paired triangle areas; multiplying cancels to 1. Conversely, intersect AD and BE at P and let CP meet AB at F′. The forward direction forces AF′/F′B=AF/FB, so F′=F.'],
      ['A cyclic angle test', 'For a convex quadrilateral ABCD, prove that it is cyclic exactly when $\\angle A+\\angle C=180^\\circ$.', 'Compare inscribed angles subtending the same chord.', 'For a cyclic quadrilateral, opposite angles subtend complementary arcs, so sum to 180°. Conversely draw the circle through A,B,D; the inscribed angle condition places C on its opposite arc by the locus of points subtending chord BD at the prescribed angle.'],
      ['The angle-bisector ratio', 'Prove $BD/DC=AB/AC$ if AD bisects angle BAC and D lies on BC.', 'Compare areas with shared altitude and with sine formulas.', 'Triangles ABD and ACD have shared altitude to BC, so their area ratio is BD/DC. Their sine-area formulas and equal angles at A give the same ratio AB/AC.'],
      ['A homothety of centers', 'Prove that the centroid G lies on the line through circumcenter O and orthocenter H with $\\overrightarrow{OH}=3\\overrightarrow{OG}$.', 'Use vectors with origin at O.', 'Write vertex vectors a,b,c of equal length R. The vector h=a+b+c satisfies $(h-a)\\cdot(b-c)=(b+c)\\cdot(b-c)=0$, hence is the orthocenter. The centroid is g=(a+b+c)/3, so h=3g.'],
      ['Ptolemy’s equality', 'Prove $AC\\cdot BD=AB\\cdot CD+AD\\cdot BC$ for a cyclic convex quadrilateral.', 'Construct K on AC with angle ABK equal to angle DBC.', 'Inscribed-angle equalities give $\\triangle ABK\\sim\\triangle DBC$, hence $AK=AB\\cdot CD/BD$. They also give $\\triangle BKC\\sim\\triangle BDA$, hence $KC=BC\\cdot AD/BD$. Adding AK+KC=AC and multiplying by BD proves the identity.'],
    ],
    Combinatorics: [
      ['A monochromatic triangle', 'Prove that any red/blue colouring of the edges of $K_6$ has a monochromatic triangle.', 'Look at the five edges at one vertex.', 'At least three incident edges share a colour. If any edge among their three endpoints has that colour it completes a triangle; otherwise all three endpoint edges have the other colour.'],
      ['An increasing or decreasing subsequence', 'Prove any sequence of ' + (n * n + 1) + ' distinct real numbers contains an increasing or decreasing subsequence of length ' + (n + 1) + '.', 'Assign each position two subsequence lengths.', 'Assign position i the pair (length of longest increasing subsequence ending there, length of longest decreasing subsequence ending there). Two positions cannot have the same pair: whichever value is larger extends the corresponding subsequence. If both lengths are at most ' + n + ', there are only ' + n * n + ' pairs, a contradiction.'],
      ['A diagonal path count', 'Prove the number of east/north paths from (0,0) to (' + n + ',' + n + ') staying below y=x is $\\binom{' + 2 * n + '}{' + n + '}/' + (n + 1) + '$.', 'Reflect the prefix ending at the first forbidden step.', 'There are $\\binom{2n}{n}$ unrestricted paths. Reflecting the prefix at the first point on y=x+1 bijects bad paths with paths having n+1 east and n−1 north steps, counted by $\\binom{2n}{n-1}$. Their difference is $\\binom{2n}{n}/(n+1)$.'],
      ['A graph degree constraint', 'Prove that any simple graph on ' + n + ' vertices has two vertices of equal degree.', 'Degree 0 and degree n−1 cannot coexist.', 'All degrees lie in 0 through n−1. If a vertex has degree n−1 no degree 0 occurs. Otherwise n−1 never occurs. In either case at most n−1 degree values are available for n vertices, so pigeonhole gives a repeat.'],
      ['A subset sum divisible by n', 'Prove that any ' + n + ' integers have a nonempty consecutive block whose sum is divisible by ' + n + '.', 'Use prefix sums modulo n.', 'If a prefix sum is zero modulo n, it gives the block. Otherwise n prefix sums occupy only n−1 nonzero residues, so two match; their difference is the sum of a nonempty consecutive block.'],
      ['A parity invariant', 'Prove that a chessboard with opposite corners removed cannot be tiled by dominoes covering two adjacent squares.', 'Colour the board in the usual alternating pattern.', 'The removed opposite corners have the same colour, leaving different counts of black and white squares. Every domino covers one square of each colour, so no tiling exists.'],
      ['A tree’s edge count', 'Prove every finite tree with ' + n + ' vertices has ' + (n - 1) + ' edges.', 'Remove an endpoint of a longest path.', 'An endpoint of a longest simple path has degree 1, since another neighbour would extend the path or create a cycle. Remove it and its incident edge. The remaining graph is a tree, so induction from the one-vertex case proves the count.'],
    ],
    'Number Theory': [
      ['Infinitely many primes in a residue class', 'Prove infinitely many primes are congruent to 3 modulo 4.', 'Consider four times the product of a purported finite list minus 1.', 'Suppose the list is p₁,…,pₖ and set N=4p₁···pₖ−1. No listed prime divides N. Since N is 3 modulo 4 and odd, at least one prime factor is 3 modulo 4 (a product of factors all 1 modulo 4 would be 1). This contradicts the list.'],
      ['Fermat through permutations', 'Prove $a^{p-1}\\equiv1\\pmod p$ for prime p not dividing a.', 'Multiply a complete set of nonzero residues by a.', 'Multiplication by a permutes the nonzero residues modulo p. Multiplying all gives $a^{p-1}(p-1)!\\equiv(p-1)!$. The factorial is invertible modulo p, so cancel it.'],
      ['Wilson’s theorem', 'Prove $(p-1)!\\equiv-1\\pmod p$ for prime p.', 'Pair nonzero residues with their inverses.', 'Every nonzero residue has an inverse. Only 1 and −1 are self-inverse for an odd prime, since x²−1 factors. All other pairs multiply to 1, leaving −1. For p=2 the conclusion follows directly.'],
      ['Consecutive coprimality', 'Prove $\\gcd(n^2+n+1,n^2-n+1)$ divides 3 for every integer n.', 'A common divisor divides 2n and is coprime to n.', 'A common divisor d is odd because both numbers are odd, and divides their difference 2n. Thus d divides n. But n²+n+1 is 1 modulo any divisor of n, forcing d=1. In fact these two numbers are always coprime, which is stronger than the claim.'],
      ['A square-free obstruction', 'Prove that if positive coprime integers a,b have ab a square, then both a and b are squares.', 'Use unique prime factorization.', 'Every prime occurs in at most one of a,b because their gcd is 1. Its exponent in the product is even, hence its exponent in that factor is even. Both factors are squares.'],
      ['The valuation of a factorial', 'Prove the exponent of prime p in $' + n + '!$ is $\\sum_{j\\ge1}\\lfloor' + n + '/p^j\\rfloor$.', 'Count the multiples of each power of p.', 'Each integer k contributes one count for every power pʲ dividing it. Summing over k from 1 to n and reversing these finite counts gives the stated floors.'],
      ['A Euclidean descent', 'Determine all positive integer solutions of $x^2-y^2=' + (2 * n + 1) + '$.', 'Factor the difference of squares.', 'Set u=x−y and v=x+y, so uv=' + (2 * n + 1) + ', with 0<u<v and both odd. Each positive divisor pair u<v gives x=(u+v)/2,y=(v−u)/2. These and only these are the positive solutions.'],
    ],
  };
  const [title, question, hint, solution] = statements[topic][variant];
  const figure: GeometryFigure | undefined = topic !== 'Geometry' ? undefined : variant === 3 || variant === 6 ? { kind: 'quadrilateral', values: [4, 5, 6, 7], construction: 'diagonals', illustrative: true } : { kind: 'triangle', values: [13, 14, 15], construction: (['centers', 'median', 'ceva', 'median', 'bisector', 'euler-line', 'median'] as const)[variant], illustrative: true };
  return { ...base, title, question, hint, solution, figure };
}
