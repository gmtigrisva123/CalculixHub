/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, ArrowRight, Brain, RotateCcw } from 'lucide-react';
import MathText from '../MathText';
import { spring } from '../../lib/motion';

interface DemoQuestion {
  id: string;
  topic: string;
  source: string;
  latexProblem: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: 'demo-1',
    topic: 'Algebra',
    source: 'AMC 10A / IRT b=+0.8',
    latexProblem: 'For how many real numbers $x$ does $(x^2 - 5x + 5)^{x^2 - 9x + 20} = 1$ hold?',
    options: ['3', '4', '5', '6'],
    correctIdx: 2, // 5 solutions: base=1 (x=1,4), exp=0 & base!=0 (x=5), base=-1 & exp even (x=2,3). Total 5!
    explanation: 'Check three cases. (1) Base $= 1$ gives $x = 1, 4$. (2) Exponent $= 0$ gives $x = 5$ (the base is $-5 \\neq 0$). (3) Base $= -1$ gives $x = 2, 3$ (the exponent is even for both). Total: $5$ solutions.',
  },
  {
    id: 'demo-2',
    topic: 'Geometry',
    source: 'AIME I / IRT b=+1.4',
    latexProblem: 'In $\\triangle ABC$, $AB=13$, $BC=14$, $AC=15$. What is the radius $r$ of the inscribed circle?',
    options: ['3', '4', '5', '6'],
    correctIdx: 1, // Area = sqrt(21 * 8 * 7 * 6) = 84. s = 21. r = 84 / 21 = 4.
    explanation: 'By Heron\'s formula, semiperimeter $s = \\frac{13+14+15}{2} = 21$. Area $K = \\sqrt{21 \\times 8 \\times 7 \\times 6} = 84$. Inradius $r = \\frac{K}{s} = \\frac{84}{21} = 4$.',
  },
];

interface InteractiveRiddleStageProps {
  onRegister: () => void;
}

export default function InteractiveRiddleStage({ onRegister }: InteractiveRiddleStageProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const item = DEMO_QUESTIONS[currentIdx];
  const isAnswered = selectedIdx !== null;
  const isCorrect = selectedIdx === item.correctIdx;

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
  };

  const handleNext = () => {
    setSelectedIdx(null);
    setCurrentIdx((prev) => (prev + 1) % DEMO_QUESTIONS.length);
  };

  return (
    <div className="rounded-card border border-[rgba(231,226,217,0.18)] bg-[rgba(20,17,14,0.7)] p-6 md:p-8 backdrop-blur-md shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(231,226,217,0.14)] pb-4">
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-azure-400" />
          <span className="type-eyebrow text-stone-400 tracking-[0.18em]">Interactive Demo Problem</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="cx-tag cx-tag-accent text-[9px]">{item.topic}</span>
          <span className="text-[11px] text-azure-400 font-mono tnum">{item.source}</span>
        </div>
      </div>

      <div className="my-6">
        <p className="type-eyebrow text-stone-500 mb-2">Problem {currentIdx + 1} of {DEMO_QUESTIONS.length}</p>
        <div className="text-[17px] leading-[1.65] text-stone-100">
          <MathText text={item.latexProblem} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {item.options.map((opt, idx) => {
          let stateClass = 'border-[rgba(231,226,217,0.2)] bg-stone-900/40 text-stone-200 hover:border-azure-400';
          if (isAnswered) {
            if (idx === item.correctIdx) {
              stateClass = 'border-proof-400 bg-proof-900/40 text-proof-300';
            } else if (idx === selectedIdx) {
              stateClass = 'border-rose-500 bg-rose-950/40 text-rose-300';
            } else {
              stateClass = 'border-[rgba(231,226,217,0.1)] opacity-50 text-stone-400';
            }
          }

          return (
            <m.button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(idx)}
              whileTap={!isAnswered ? { scale: 0.97 } : undefined}
              transition={spring.press}
              className={`flex items-center gap-3 rounded-control border p-3.5 text-left font-serif text-[18px] transition-colors duration-160 ${stateClass}`}
            >
              <span className="text-[14px] text-stone-500 font-sans">{String.fromCharCode(65 + idx)}.</span>
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
                ? 'border-proof-500/40 bg-proof-950/40 text-proof-200'
                : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-serif text-[17px] font-medium mb-1 flex items-center gap-2 text-stone-100">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-4.5 w-4.5 text-proof-400 shrink-0" />
                      <span>Correct! This question calibrated your initial ability estimate.</span>
                    </>
                  ) : (
                    <span>Nice attempt! Here is how the 3PL model breaks down the solution:</span>
                  )}
                </p>
                <div className="text-[13px] leading-[1.6] text-stone-300 mt-1">
                  <MathText text={item.explanation} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleNext}
                  className="cx-btn cx-btn-on-dark py-2 px-3.5 text-[13px]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Try another</span>
                </button>
                <button
                  type="button"
                  onClick={onRegister}
                  className="cx-btn cx-btn-fill py-2 px-3.5 text-[13px]"
                >
                  <span>Full Placement</span>
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
