/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, ArrowRight, BookOpen, RotateCcw, Lightbulb } from 'lucide-react';
import MathText from '../MathText';
import { spring } from '../../lib/motion';

interface MathPlaygroundItem {
  id: string;
  topic: string;
  source: string;
  questionText: string;
  latexProblem: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const PLAYGROUND_ITEMS: MathPlaygroundItem[] = [
  {
    id: 'pg-1',
    topic: 'Algebra',
    source: 'AMC 10A / Intermediate',
    questionText: 'Test your algebraic reasoning:',
    latexProblem: 'If $x + \\frac{1}{x} = 3$, what is the exact value of $x^3 + \\frac{1}{x^3}$?',
    options: ['18', '21', '24', '27'],
    correctIdx: 0, // (x + 1/x)^3 - 3(x + 1/x) = 27 - 9 = 18.
    explanation: 'Cube both sides: $(x + \\frac{1}{x})^3 = x^3 + \\frac{1}{x^3} + 3(x + \\frac{1}{x}) = 27$. Substituting $x + \\frac{1}{x} = 3$ gives $x^3 + \\frac{1}{x^3} = 27 - 3(3) = 18$.',
  },
  {
    id: 'pg-2',
    topic: 'Geometry',
    source: 'AIME I / Advanced',
    questionText: 'Test your geometric intuition:',
    latexProblem: 'In a right triangle with legs $a=6$ and $b=8$, what is the length of the altitude drawn to the hypotenuse?',
    options: ['4.0', '4.8', '5.0', '5.2'],
    correctIdx: 1, // Hypotenuse c = 10. Area = 1/2 * 6 * 8 = 24. Altitude h = 2 * 24 / 10 = 4.8.
    explanation: 'The hypotenuse $c = \\sqrt{6^2 + 8^2} = 10$. The area of the triangle is $\\frac{1}{2} \\times 6 \\times 8 = 24$. Using area with hypotenuse as base: $\\frac{1}{2} \\times 10 \\times h = 24 \\implies h = 4.8$.',
  },
  {
    id: 'pg-3',
    topic: 'Combinatorics',
    source: 'AMC 12B / Intermediate',
    questionText: 'Test your counting strategy:',
    latexProblem: 'How many positive integers less than $1000$ are divisible by neither $5$ nor $7$?',
    options: ['684', '686', '714', '720'],
    correctIdx: 1, // 999 - floor(999/5) - floor(999/7) + floor(999/35) = 999 - 199 - 142 + 28 = 686.
    explanation: 'There are $999$ positive integers under $1000$. By Inclusion-Exclusion: $199$ are multiples of $5$, $142$ are multiples of $7$, and $28$ are multiples of $35$. Total excluded = $199 + 142 - 28 = 313$. Remaining = $999 - 313 = 686$.',
  },
];

interface HumanHeroPlaygroundProps {
  onRegister: () => void;
}

export default function HumanHeroPlayground({ onRegister }: HumanHeroPlaygroundProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const item = PLAYGROUND_ITEMS[activeIdx];
  const isAnswered = selectedIdx !== null;
  const isCorrect = selectedIdx === item.correctIdx;

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
  };

  const handleNextProblem = () => {
    setSelectedIdx(null);
    setActiveIdx((prev) => (prev + 1) % PLAYGROUND_ITEMS.length);
  };

  return (
    <div className="cx-card bg-surface-raised border border-line rounded-card p-6 md:p-8 shadow-e3 relative overflow-hidden">
      {/* Warm ambient corner tint */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-line-faint pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <span className="type-eyebrow text-indigo-600 dark:text-indigo-400 tracking-[0.16em]">Test Your Contest Instinct Live</span>
            <p className="text-[13px] text-content-subtle font-medium">Can you spot the proof pattern below?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="cx-tag cx-tag-accent text-[9.5px]">{item.topic}</span>
          <span className="text-[11.5px] font-serif text-accent-text">{item.source}</span>
        </div>
      </div>

      <div className="my-6">
        <div className="text-[17px] leading-[1.65] text-content font-serif">
          <MathText text={item.latexProblem} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {item.options.map((opt, idx) => {
          let stateClass = 'border-line bg-surface hover:border-accent hover:bg-surface-raised text-content';
          if (isAnswered) {
            if (idx === item.correctIdx) {
              stateClass = 'border-proof-500 bg-proof-50 text-proof-900 font-bold';
            } else if (idx === selectedIdx) {
              stateClass = 'border-accent bg-accent/10 text-accent-text font-bold';
            } else {
              stateClass = 'border-line-faint opacity-45 text-content-subtle';
            }
          }

          return (
            <m.button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelectOption(idx)}
              whileTap={!isAnswered ? { scale: 0.97 } : undefined}
              transition={spring.press}
              className={`flex items-center gap-3 rounded-control border p-3.5 text-left font-serif text-[17px] transition-colors duration-160 ${stateClass}`}
            >
              <span className="text-[13.5px] text-content-subtle font-sans">{String.fromCharCode(65 + idx)}.</span>
              <span className="flex-1 tnum">
                <MathText text={opt} />
              </span>
            </m.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {isAnswered && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.smooth}
            className={`mt-5 rounded-control border p-4.5 text-[14px] ${
              isCorrect
                ? 'border-proof-400 bg-proof-50/80 text-proof-900'
                : 'border-amber-300 bg-amber-50/80 text-amber-900'
            }`}
          >
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-serif text-[17px] font-medium mb-1 flex items-center gap-2">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-4.5 w-4.5 text-proof-600 shrink-0" />
                      <span>Excellent reasoning! You spotted the pattern right away.</span>
                    </>
                  ) : (
                    <span>Good try! Here is the clear step-by-step breakdown:</span>
                  )}
                </p>
                <div className="text-[13.5px] leading-[1.65] text-content-muted mt-1.5">
                  <MathText text={item.explanation} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleNextProblem}
                  className="cx-btn cx-btn-secondary py-2 px-3.5 text-[13px]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Try another</span>
                </button>
                <button
                  type="button"
                  onClick={onRegister}
                  className="cx-btn cx-btn-primary py-2 px-3.5 text-[13px]"
                >
                  <span>Take Placement Test</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
