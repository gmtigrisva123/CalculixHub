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
    source: 'AIME-style / Power sums',
    questionText: 'Test your algebraic reasoning:',
    latexProblem: 'A positive $x$ satisfies $x + \\frac{1}{x} = 3$. What are the last three digits of $\\left(x^5 + \\frac{1}{x^5}\\right)^2$?',
    options: ['109', '119', '129', '139'],
    correctIdx: 2,
    explanation: 'Let $T_n=x^n+x^{-n}$. The recurrence $T_n=3T_{n-1}-T_{n-2}$ gives $T_5=123$. Thus $T_5^2=15129$, so the last three digits are $129$.',
  },
  {
    id: 'pg-2',
    topic: 'Geometry',
    source: 'AIME-style / Euler centers',
    questionText: 'Test your geometric intuition:',
    latexProblem: 'A triangle has sides $10$, $17$, and $21$. If $O$ and $I$ are its circumcenter and incenter, what is the numerator remainder of $OI^2$ modulo $1000$?',
    options: ['365', '465', '435', '495'],
    correctIdx: 1,
    explanation: 'Heron gives $K=84$, so $r=7/2$. Also $R=abc/(4K)=85/8$. Euler’s formula gives $OI^2=R(R-2r)=2465/64$, whose numerator remainder is $465$.',
  },
  {
    id: 'pg-3',
    topic: 'Combinatorics',
    source: 'AIME-style / Catalan paths',
    questionText: 'Test your counting strategy:',
    latexProblem: 'A path from $(0,0)$ to $(10,10)$ stays on or below $y=x$ and avoids $(5,5)$. What is the path count modulo $1000$?',
    options: ['12', '24', '32', '42'],
    correctIdx: 2,
    explanation: 'The Catalan count is $C_{10}=16796$. Paths through $(5,5)$ number $C_5^2=42^2=1764$. Their difference is $15032$, giving remainder $32$.',
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
