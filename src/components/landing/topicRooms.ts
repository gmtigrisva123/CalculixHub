/**
 * The four topics of the "Topics" chapter: one room each.
 *
 * Every room carries a real problem from the archive — copied verbatim, with
 * its answer choices — so a visitor can try one before they have signed up for
 * anything. The test beside archiveSamples checks each one against the paper
 * it came from, and that the right choice really is the archive's answer.
 *
 * The chalk drawing in each room is of that very problem (TopicBoards.tsx),
 * so what is on the board is what is being asked.
 */

import type { Topic } from '../../../shared/types';

export interface TopicRoom {
  topic: Topic;
  /** The glyph the topic wears in the page's display type. */
  symbol: string;
  /** What it feels like to work in this room, said by a person. */
  feel: string;
  /** A line about what the topic covers. */
  covers: string;
  problem: {
    /** The archive's question id. */
    id: string;
    /** How the page labels it. */
    ref: string;
    prompt: string;
    options: string[];
    /** Index into `options`. */
    answer: number;
  };
  /** A nudge that does not give the answer away. */
  hint: string;
  /** Shown once the right choice is made: the idea, in a few words. */
  reason: string;
}

export const TOPIC_ROOMS: TopicRoom[] = [
  {
    topic: 'Algebra',
    symbol: '∑',
    feel: 'Rearrange it until it clicks.',
    covers: 'Equations, inequalities and clever substitutions.',
    problem: {
      id: 'amc12-2013b-p6',
      ref: 'AMC 12B 2013 · Problem 6',
      prompt: 'Real numbers $x$ and $y$ satisfy the equation $x^2 + y^2 = 10x - 6y - 34$. What is $x + y$?',
      options: ['$1$', '$2$', '$3$', '$6$', '$8$'],
      answer: 1,
    },
    hint: 'Bring everything to one side, then complete both squares.',
    reason: 'It becomes $(x-5)^2+(y+3)^2=0$. Two squares only add to zero if each is zero, so $x=5$, $y=-3$.',
  },
  {
    topic: 'Geometry',
    symbol: '△',
    feel: 'One extra line, and the picture opens up.',
    covers: 'Circles, triangles and the lengths hidden in them.',
    problem: {
      id: 'amc12-2018b-p4',
      ref: 'AMC 12B 2018 · Problem 4',
      prompt: 'A circle has a chord of length $10$, and the distance from the center of the circle to the chord is $5$. What is the area of the circle?',
      options: ['$25\\pi$', '$50\\pi$', '$75\\pi$', '$100\\pi$', '$125\\pi$'],
      answer: 1,
    },
    hint: 'Draw a radius to one end of the chord. Do you see a right triangle?',
    reason: 'Half the chord is $5$ and the distance is $5$, so $r^2=5^2+5^2=50$ and the area is $50\\pi$.',
  },
  {
    topic: 'Combinatorics',
    symbol: '!',
    feel: 'Counting, without counting everything.',
    covers: 'Counting, arrangements and probability, without listing it all.',
    problem: {
      id: 'amc12-2018b-p5',
      ref: 'AMC 12B 2018 · Problem 5',
      prompt: 'How many subsets of $\\{2,3,4,5,6,7,8,9\\}$ contain at least one prime number?',
      options: ['$128$', '$192$', '$224$', '$240$', '$256$'],
      answer: 3,
    },
    hint: 'The sets you want are hard to count. The ones you don’t want are easy.',
    reason: 'There are $2^8=256$ subsets in all, and $2^4=16$ of them use only $4,6,8,9$. So $256-16=240$.',
  },
  {
    topic: 'Number Theory',
    symbol: '≡',
    feel: 'Primes, remainders, and the odd surprise.',
    covers: 'Primes, remainders and very large powers.',
    problem: {
      id: 'amc12-2024a-p4',
      ref: 'AMC 12A 2024 · Problem 4',
      prompt: 'What is the least value of $n$ such that $n!$ is a multiple of $2024$?',
      options: ['$11$', '$21$', '$22$', '$23$', '$253$'],
      answer: 3,
    },
    hint: 'Break $2024$ into primes first. Then ask where each prime first shows up in $n!$.',
    reason: 'Since $2024=2^3\\cdot 11\\cdot 23$, the prime $23$ has to appear, and it first does in $23!$. The $2^3$ and $11$ are already there.',
  },
];
