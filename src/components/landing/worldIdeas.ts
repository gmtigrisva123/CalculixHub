/**
 * One idea per domain for the "Four worlds" chapter, and the form each is drawn as.
 *
 * The mathematics was derived for this page rather than copied from a contest:
 * Schur's degree-three inequality and its p, q, r rewrite; Ptolemy's theorem
 * with its cyclic-order hypothesis; the roots-of-unity filter for binomial
 * sums; and the odd-prime lifting-the-exponent lemma with every hypothesis it
 * needs. Level labels describe a style of study, not an official classification.
 */

import type { Topic } from '../../../shared/types';

export interface WorldIdea {
  topic: Topic;
  symbol: string;
  theorem: string;
  level: string;
  title: string;
  formula: string;
  condition: string;
  question: string;
  thought: string;
  insight: string;
  /** What the particle form beside it is, in a sentence. */
  form: string;
}

export const WORLD_IDEAS: WorldIdea[] = [
  {
    topic: 'Algebra',
    symbol: '∑',
    theorem: 'Schur’s inequality',
    level: 'USAMO-style algebra',
    title: 'Symmetry hides a bound.',
    formula: String.raw`$$a^3+b^3+c^3+3abc$$
$$\geq\sum_{\mathrm{sym}}a^2b$$`,
    condition: String.raw`For $a,b,c\geq0$. The symmetric sum runs over all six terms such as $a^2b$ and $ab^2$.`,
    question: 'What becomes possible when three variables share a fixed sum?',
    thought: 'A symmetric expression can look untidy until you rewrite it in terms of its sum, its pairwise products and its product.',
    insight: String.raw`Write $p=a+b+c$, $q=ab+bc+ca$ and $r=abc$. Schur becomes $p^3+9r\geq4pq$: with $p$ fixed, a problem in three variables becomes a relation between just $q$ and $r$.`,
    form: 'The monkey saddle z = Re (x + iy)³: three ridges, three valleys, one cubic.',
  },
  {
    topic: 'Geometry',
    symbol: '◯',
    theorem: 'Ptolemy’s theorem',
    level: 'AIME geometry',
    title: 'The circle ties it together.',
    formula: String.raw`$$AC\cdot BD$$
$$=AB\cdot CD+AD\cdot BC$$`,
    condition: String.raw`For $A, B, C, D$ on one circle, in that cyclic order.`,
    question: 'Can the diagonals reveal a length the sides cannot?',
    thought: 'Four points on a circle carry more structure than four points on a page. Draw the diagonals and a hidden relation appears.',
    insight: String.raw`Ptolemy ties both diagonals to the four sides. Combine it with equal chords or an angle condition before reaching for coordinates — and keep the cyclic order: it is essential.`,
    form: 'The icosahedron’s thirty edges, drawn on the sphere that circumscribes it.',
  },
  {
    topic: 'Combinatorics',
    symbol: '⋮',
    theorem: 'Roots-of-unity filter',
    level: 'AIME counting',
    title: 'Count what the pattern keeps.',
    formula: String.raw`$$\sum_{k\equiv r\; (\mathrm{mod}\;m)}\binom nk$$
$$=\frac1m\sum_{j=0}^{m-1}\omega^{-rj}(1+\omega^j)^n$$`,
    condition: String.raw`$\omega=e^{2\pi i/m}$, with integers $n\geq0$, $m\geq2$ and $0\leq r<m$; on the left, $0\leq k\leq n$.`,
    question: 'How many subsets of a 60-element set have a size divisible by three?',
    thought: 'Sometimes the fastest way to count is to let the unwanted cases cancel themselves. Complex numbers make a surprisingly practical sieve.',
    insight: String.raw`Take $m=3$ and $r=0$ with the cube roots of unity. Since $(1+\omega)^{60}=(1+\omega^2)^{60}=1$, the count is $(2^{60}+2)/3$.`,
    form: 'Q₄ turning through four dimensions: the 16 subsets of {1, 2, 3, 4}, joined when they differ by one element.',
  },
  {
    topic: 'Number Theory',
    symbol: '≡',
    theorem: 'Lifting the exponent',
    level: 'USAMO-style number theory',
    title: 'A huge power. A small clue.',
    formula: String.raw`$$v_p(a^n-b^n)$$
$$=v_p(a-b)+v_p(n)$$`,
    condition: String.raw`For distinct positive integers $a,b$, an odd prime $p$ with $p\mid a-b$ and $p\nmid ab$, and $n\geq1$. Here $v_p$ counts factors of $p$.`,
    question: String.raw`What is the largest power of three dividing $10^{2025}-1$?`,
    thought: 'You never need to expand the number. Understand the prime factors of the difference of the bases, and of the exponent, instead.',
    insight: String.raw`Take $p=3$, $a=10$, $b=1$ and $n=2025$. Then $v_3(9)=2$ and $v_3(2025)=4$, so the valuation is $6$: $3^6$ divides the number and $3^7$ does not.`,
    form: 'The times table, read modulo 240: join k to 2k around the circle and a cardioid appears. The multiplier drifts towards 3, and it becomes a nephroid.',
  },
];
