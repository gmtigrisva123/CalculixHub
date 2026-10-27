/**
 * Real problems from the archive, for the landing page's slow counter-current.
 *
 * Copied verbatim from the paper files (their math delimiters included) so the
 * band can render them without loading a paper. The test beside this file
 * checks each one against the archive, character for character.
 */

export interface ArchiveSample {
  /** The archive's question id. */
  id: string;
  /** How the band labels it. */
  ref: string;
  prompt: string;
}

export const ARCHIVE_SAMPLES: ArchiveSample[] = [
  {
    id: 'imo-1959-1',
    ref: 'IMO 1959 · Problem 1',
    prompt: 'Prove that the fraction \\(\\frac{21n+4}{14n+3}\\) is irreducible for every natural number \\(n\\).',
  },
  {
    id: 'amc12-2024a-p4',
    ref: 'AMC 12A 2024 · Problem 4',
    prompt: 'What is the least value of $n$ such that $n!$ is a multiple of $2024$?',
  },
  {
    id: 'aime-2010-i-p2',
    ref: 'AIME I 2010 · Problem 2',
    prompt: "Find the remainder when $9 \\times 99 \\times 999 \\times \\cdots \\times \\underbrace{99\\cdots9}_{\\text{999 9's}}$ is divided by $1000$.",
  },
  {
    id: 'usamo-2022-4',
    ref: 'USAMO 2022 · Problem 4',
    prompt: 'Find all pairs of primes \\((p, q)\\) for which \\(p-q\\) and \\(pq-q\\) are both perfect squares.',
  },
  {
    id: 'imo-1988-6',
    ref: 'IMO 1988 · Problem 6',
    prompt: 'Let \\(a\\) and \\(b\\) be positive integers such that \\(ab + 1\\) divides \\(a^{2} + b^{2}\\). Show that \\(\\frac {a^{2} + b^{2}}{ab + 1}\\) is the square of an integer.',
  },
  {
    id: 'amc12-2018b-p5',
    ref: 'AMC 12B 2018 · Problem 5',
    prompt: 'How many subsets of $\\{2,3,4,5,6,7,8,9\\}$ contain at least one prime number?',
  },
  {
    id: 'aime-2014-ii-p9',
    ref: 'AIME II 2014 · Problem 9',
    prompt: 'Ten chairs are arranged in a circle. Find the number of subsets of this set of chairs that contain at least three adjacent chairs.',
  },
  {
    id: 'imo-2000-5',
    ref: 'IMO 2000 · Problem 5',
    prompt: 'Does there exist a positive integer \\(n\\) such that \\(n\\) has exactly 2000 prime divisors and \\(n\\) divides \\(2^n + 1\\)?',
  },
];
