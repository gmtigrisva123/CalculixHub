/**
 * The four topics of the "Four worlds" chapter, and the form each is drawn as.
 *
 * Each card says what the topic is about in one line and shows one result
 * most students meet early, so the page can be taken in at a glance.
 */

import type { Topic } from '../../../shared/types';

export interface WorldIdea {
  topic: Topic;
  symbol: string;
  /** What the topic is about, in a line. */
  line: string;
  /** A well-known result from the topic, shown on the card. */
  name: string;
  formula: string;
  /** What the particle form beside it is, in a few words. */
  form: string;
}

export const WORLD_IDEAS: WorldIdea[] = [
  {
    topic: 'Algebra',
    symbol: '∑',
    line: 'Equations, inequalities and clever substitutions.',
    name: 'AM–GM inequality',
    formula: String.raw`$$\frac{a+b}{2}\geq\sqrt{ab}$$`,
    form: 'A monkey saddle: three hills, three valleys.',
  },
  {
    topic: 'Geometry',
    symbol: '◯',
    line: 'Circles, triangles and the lengths hidden in them.',
    name: 'Pythagoras’ theorem',
    formula: String.raw`$$a^2+b^2=c^2$$`,
    form: 'An icosahedron: twenty triangles on a sphere.',
  },
  {
    topic: 'Combinatorics',
    symbol: '⋮',
    line: 'Counting, without listing everything.',
    name: 'Pascal’s rule',
    formula: String.raw`$$\binom{n}{k}=\binom{n-1}{k-1}+\binom{n-1}{k}$$`,
    form: 'A cube in four dimensions, turning.',
  },
  {
    topic: 'Number Theory',
    symbol: '≡',
    line: 'Primes, remainders and very large powers.',
    name: 'Fermat’s little theorem',
    formula: String.raw`$$a^{p}\equiv a\pmod{p}$$`,
    form: 'A times table, drawn around a circle.',
  },
];
