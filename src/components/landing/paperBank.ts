/**
 * The paper on the landing page: sixteen real problems the engine may ask.
 *
 * The front page is a contest paper a visitor can actually sit. The engine
 * that marks it is the product's own (src/domain/irt.ts), but the problems are
 * not the placement test's. A visitor who meets a problem here and then signs
 * up would meet it again in their real placement, already knowing the answer,
 * and that placement would flatter them. So this paper has its own questions:
 * sixteen from the AMC 12 papers in the archive, none of them in
 * src/domain/itemBank.ts. The test beside this file holds both promises: every
 * problem matches the archive character for character, and none is shared
 * with the placement bank.
 *
 * Four topics, four steps of difficulty in each. The difficulty of a problem
 * (`b`) follows the bank's own convention, read off its place in the paper it
 * came from: an AMC 12 opens gently and ends hard. Like the bank's, these
 * values are provisional estimates, not fitted calibrations, and the page says
 * so where it shows them.
 *
 * `hint` is the nudge a tutor would give; `reason` is the idea in a line or
 * two, shown once the problem has been marked.
 */

import { recommendedSource, type Domain, type IRTItem } from '../../domain/irt';

export interface PaperItem extends IRTItem {
  /** How the page cites it: the paper it was set in, and its number there. */
  ref: string;
  /** Shown after marking: why the answer is what it is. */
  reason: string;
}

interface Entry {
  id: string;
  ref: string;
  domain: Domain;
  concept: string;
  question: string;
  options: string[];
  correctIdx: number;
  a: number;
  b: number;
  hint: string;
  reason: string;
}

const FIVE_CHOICES = 0.2;

const ENTRIES: Entry[] = [
  // --- Algebra ---------------------------------------------------------------
  {
    id: 'amc12-2017a-p2',
    ref: 'AMC 12A 2017 · Problem 2',
    domain: 'Algebra',
    concept: 'Sums of reciprocals',
    question: 'The sum of two nonzero real numbers is 4 times their product. What is the sum of the reciprocals of the two numbers?',
    options: ['$1$', '$2$', '$4$', '$8$', '$12$'],
    correctIdx: 2,
    a: 1.2,
    b: -1.7,
    hint: 'Write the sum of the two reciprocals as a single fraction.',
    reason: 'Since $\\tfrac1x+\\tfrac1y=\\tfrac{x+y}{xy}$ and the problem says $x+y=4xy$, the fraction is $4$.',
  },
  {
    id: 'amc12-2013a-p8',
    ref: 'AMC 12A 2013 · Problem 8',
    domain: 'Algebra',
    concept: 'Factoring a symmetric equation',
    question: 'Given that $x$ and $y$ are distinct nonzero real numbers such that $x+\\tfrac{2}{x} = y + \\tfrac{2}{y}$, what is $xy$?',
    options: ['$\\frac{1}{4}$', '$\\frac{1}{2}$', '$1$', '$2$', '$4$'],
    correctIdx: 3,
    a: 1.4,
    b: -0.8,
    hint: 'Move $x$ and $y$ to one side and the two fractions to the other. Something cancels.',
    reason: 'Rearranged, $x-y=\\tfrac{2(x-y)}{xy}$. The numbers are distinct, so divide by $x-y$: $xy=2$.',
  },
  {
    id: 'amc12-2015a-p10',
    ref: 'AMC 12A 2015 · Problem 10',
    domain: 'Algebra',
    concept: 'Completing a product',
    question: 'Integers $x$ and $y$ with $x>y>0$ satisfy $x+y+xy=80$. What is $x$?',
    options: ['$8$', '$10$', '$15$', '$18$', '$26$'],
    correctIdx: 4,
    a: 1.6,
    b: -0.1,
    hint: 'Add $1$ to both sides. The left side becomes a product.',
    reason: 'It becomes $(x+1)(y+1)=81$. With $x>y>0$ the only way to split $81$ is $27\\cdot 3$, so $x=26$.',
  },
  {
    id: 'amc12-2018b-p18',
    ref: 'AMC 12B 2018 · Problem 18',
    domain: 'Algebra',
    concept: 'Recurrences',
    question: 'A function $f$ is defined recursively by $f(1)=f(2)=1$ and $$\nf(n)=f(n-1)-f(n-2)+n\n$$for all integers $n \\geq 3$. What is $f(2018)$?',
    options: ['$2016$', '$2017$', '$2018$', '$2019$', '$2020$'],
    correctIdx: 1,
    a: 1.7,
    b: 0.7,
    hint: 'Write the rule for $f(n)$ and again for $f(n-1)$, then add the two lines.',
    reason: 'Adding them gives $f(n)+f(n-3)=2n-1$, and so $f(n)=f(n-6)+6$. Then $f(2018)=f(2)+6\\cdot 336=2017$.',
  },

  // --- Geometry --------------------------------------------------------------
  {
    id: 'amc12-2018b-p4',
    ref: 'AMC 12B 2018 · Problem 4',
    domain: 'Geometry',
    concept: 'Chords and radii',
    question: 'A circle has a chord of length $10$, and the distance from the center of the circle to the chord is $5$. What is the area of the circle?',
    options: ['$25\\pi$', '$50\\pi$', '$75\\pi$', '$100\\pi$', '$125\\pi$'],
    correctIdx: 1,
    a: 1.2,
    b: -1.5,
    hint: 'Draw a radius to one end of the chord. Do you see a right triangle?',
    reason: 'Half the chord is $5$ and the distance is $5$, so $r^2=5^2+5^2=50$ and the area is $50\\pi$.',
  },
  {
    id: 'amc12-2015a-p8',
    ref: 'AMC 12A 2015 · Problem 8',
    domain: 'Geometry',
    concept: 'Similar rectangles',
    question: 'The ratio of the length to the width of a rectangle is $4$: $3$. If the rectangle has diagonal of length $d$, then the area may be expressed as $kd^2$ for some constant $k$. What is $k$?',
    options: ['$\\frac27$', '$\\frac37$', '$\\frac{12}{25}$', '$\\frac{16}{25}$', '$\\frac34$'],
    correctIdx: 2,
    a: 1.4,
    b: -0.9,
    hint: 'Call the sides $4t$ and $3t$. How long is the diagonal?',
    reason: 'The diagonal is $5t$, so $t=\\tfrac d5$ and the area is $12t^2=\\tfrac{12}{25}d^2$.',
  },
  {
    id: 'amc12-2015b-p11',
    ref: 'AMC 12B 2015 · Problem 11',
    domain: 'Geometry',
    concept: 'Altitudes of a right triangle',
    question: 'The line $12x+5y=60$ forms a triangle with the coordinate axes. What is the sum of the lengths of the altitudes of this triangle?',
    options: ['$20$', '$\\dfrac{360}{17}$', '$\\dfrac{107}{5}$', '$\\dfrac{43}{2}$', '$\\dfrac{281}{13}$'],
    correctIdx: 4,
    a: 1.6,
    b: 0,
    hint: 'It is a right triangle. Two of its altitudes are its own legs.',
    reason: 'The legs are $5$ and $12$ and the hypotenuse is $13$. The third altitude is $\\tfrac{5\\cdot 12}{13}$, so the sum is $17+\\tfrac{60}{13}=\\tfrac{281}{13}$.',
  },
  {
    id: 'amc12-2023b-p17',
    ref: 'AMC 12B 2023 · Problem 17',
    domain: 'Geometry',
    concept: 'Law of cosines',
    question: 'Triangle $ABC$ has side lengths in arithmetic progression, and the smallest side has length $6$. If the triangle has an angle of $120^\\circ,$ what is the area of $ABC$?',
    options: ['$12\\sqrt{3}$', '$8\\sqrt{6}$', '$14\\sqrt{2}$', '$20\\sqrt{2}$', '$15\\sqrt{3}$'],
    correctIdx: 4,
    a: 1.7,
    b: 0.7,
    hint: 'Call the sides $6$, $6+d$ and $6+2d$. Which one faces the $120^\\circ$ angle?',
    reason: 'The longest side faces it: $(6+2d)^2=6^2+(6+d)^2+6(6+d)$ gives $d=4$. The area is $\\tfrac12\\cdot 6\\cdot 10\\cdot\\sin 120^\\circ=15\\sqrt3$.',
  },

  // --- Combinatorics ---------------------------------------------------------
  {
    id: 'amc12-2020a-p4',
    ref: 'AMC 12A 2020 · Problem 4',
    domain: 'Combinatorics',
    concept: 'Counting digit by digit',
    question: 'How many $4$-digit positive integers (that is, integers between $1000$ and $9999$, inclusive) having only even digits are divisible by $5?$',
    options: ['$80$', '$100$', '$125$', '$200$', '$500$'],
    correctIdx: 1,
    a: 1.2,
    b: -1.5,
    hint: 'Which even digit can a multiple of $5$ end in?',
    reason: 'It must end in $0$. The first digit is $2$, $4$, $6$ or $8$ and each middle digit is one of five, so $4\\cdot 5\\cdot 5=100$.',
  },
  {
    id: 'amc12-2011b-p9',
    ref: 'AMC 12B 2011 · Problem 9',
    domain: 'Combinatorics',
    concept: 'Probability by cases',
    question: 'Two real numbers are selected independently and at random from the interval $[-20,10]$. What is the probability that the product of those numbers is greater than zero?',
    options: ['$\\frac{1}{9}$', '$\\frac{1}{3}$', '$\\frac{4}{9}$', '$\\frac{5}{9}$', '$\\frac{2}{3}$'],
    correctIdx: 3,
    a: 1.4,
    b: -0.6,
    hint: 'The product is positive exactly when the two numbers have the same sign.',
    reason: 'A number is negative with probability $\\tfrac23$ and positive with probability $\\tfrac13$. Same sign: $\\tfrac49+\\tfrac19=\\tfrac59$.',
  },
  {
    id: 'amc12-2019b-p11',
    ref: 'AMC 12B 2019 · Problem 11',
    domain: 'Combinatorics',
    concept: 'Counting the complement',
    question: 'How many unordered pairs of edges of a given cube determine a plane?',
    options: ['$12$', '$28$', '$36$', '$42$', '$66$'],
    correctIdx: 3,
    a: 1.6,
    b: 0.1,
    hint: 'Two edges lie in one plane unless they are skew. Count the skew pairs instead.',
    reason: 'There are $\\binom{12}{2}=66$ pairs. Each edge is skew to $4$ others, which makes $\\tfrac{12\\cdot 4}{2}=24$ skew pairs, and $66-24=42$.',
  },
  {
    id: 'amc12-2012a-p17',
    ref: 'AMC 12A 2012 · Problem 17',
    domain: 'Combinatorics',
    concept: 'Residue classes',
    question: 'Let $S$ be a subset of $\\{1,2,3,\\dots,30\\}$ with the property that no pair of distinct elements in $S$ has a sum divisible by $5$. What is the largest possible size of $S$?',
    options: ['$10$', '$13$', '$15$', '$16$', '$18$'],
    correctIdx: 1,
    a: 1.7,
    b: 0.6,
    hint: 'Sort the numbers by their remainder on division by $5$. Which remainders cannot share the set?',
    reason: 'Each remainder has six numbers. Remainders $1$ and $4$ cannot mix, nor can $2$ and $3$, and only one multiple of $5$ fits: $6+6+1=13$.',
  },

  // --- Number Theory ---------------------------------------------------------
  {
    id: 'amc12-2011b-p5',
    ref: 'AMC 12B 2011 · Problem 5',
    domain: 'Number Theory',
    concept: 'Least common multiples',
    question: 'Let $N$ be the second smallest positive integer that is divisible by every positive integer less than $7$. What is the sum of the digits of $N$?',
    options: ['$3$', '$4$', '$5$', '$6$', '$9$'],
    correctIdx: 0,
    a: 1.2,
    b: -1.4,
    hint: 'Find the smallest such number first. What comes after it?',
    reason: 'The smallest is $\\operatorname{lcm}(1,\\dots,6)=60$, so the second is $120$, and $1+2+0=3$.',
  },
  {
    id: 'amc12-2014b-p7',
    ref: 'AMC 12B 2014 · Problem 7',
    domain: 'Number Theory',
    concept: 'Divisors',
    question: 'For how many positive integers $n$ is $\\frac{n}{30-n}$ also a positive integer?',
    options: ['$4$', '$5$', '$6$', '$7$', '$8$'],
    correctIdx: 3,
    a: 1.4,
    b: -0.7,
    hint: 'Call the quotient $k$ and solve for $n$.',
    reason: 'Then $n=\\tfrac{30k}{k+1}$, so $k+1$ must divide $30$. Its divisors above $1$ are $2,3,5,6,10,15,30$: seven of them.',
  },
  {
    id: 'amc12-2024b-p14',
    ref: 'AMC 12B 2024 · Problem 14',
    domain: 'Number Theory',
    concept: 'Euler’s theorem',
    question: 'How many different remainders can result when the $100$th power of an integer is divided by $125$?',
    options: ['$1$', '$2$', '$5$', '$25$', '$125$'],
    correctIdx: 1,
    a: 1.6,
    b: 0.2,
    hint: 'Split the integers into the multiples of $5$ and all the rest.',
    reason: 'A multiple of $5$ leaves $0$. Every other integer leaves $1$, by Euler’s theorem, because $\\varphi(125)=100$. Two remainders.',
  },
  {
    id: 'amc12-2016b-p16',
    ref: 'AMC 12B 2016 · Problem 16',
    domain: 'Number Theory',
    concept: 'Sums of consecutive integers',
    question: 'In how many ways can $345$ be written as the sum of an increasing sequence of two or more consecutive positive integers?',
    options: ['$1$', '$3$', '$5$', '$6$', '$7$'],
    correctIdx: 4,
    a: 1.7,
    b: 0.6,
    hint: 'The sum of $k$ terms starting at $a$ is $\\tfrac{k(2a+k-1)}{2}$. Set it equal to $345$ and factor.',
    reason: 'So $k(2a+k-1)=690$, and the two factors differ in parity. Each odd divisor of $345=3\\cdot 5\\cdot 23$ except $1$ gives one run: $8-1=7$.',
  },
];

/** The problems the landing page's paper is drawn from, as the engine reads them. */
export const PAPER_BANK: PaperItem[] = ENTRIES.map(entry => ({
  ...entry,
  c: FIVE_CHOICES,
  // The level band the engine files a problem under, by the same rule it recommends one.
  source: recommendedSource(entry.b),
}));

export const PAPER_DOMAINS: readonly Domain[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
