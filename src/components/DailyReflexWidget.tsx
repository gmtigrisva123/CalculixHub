/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Zap, CheckCircle2, XCircle, Award, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import MathText from './MathText';
import { spring, duration, ease } from '../lib/motion';

interface DailyRiddle {
  id: string;
  topic: string;
  title: string;
  latexProblem: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const DAILY_RIDDLES: DailyRiddle[] = [
  {
    id: 'riddle-1',
    topic: 'Number Theory',
    title: 'A long power, reduced',
    latexProblem: 'What is the remainder when $7^{2026}$ is divided by $1000$?',
    options: ['349', '549', '649', '749'],
    correctIdx: 2,
    explanation: 'Because $7^{100} \\equiv 1 \\pmod{1000}$, reduce to $7^{26}$. Repeated squaring gives $7^{16}\\cdot7^8\\cdot7^2 \\equiv 601\\cdot801\\cdot49 \\equiv 649 \\pmod{1000}$.',
  },
  {
    id: 'riddle-2',
    topic: 'Algebra',
    title: 'A recurrence in disguise',
    latexProblem: 'If $r,s$ are roots of $t^2-7t+1=0$, what is $r^6+s^6$ modulo $1000$?',
    options: ['482', '682', '582', '782'],
    correctIdx: 1,
    explanation: 'Set $S_n=r^n+s^n$. The roots give $S_n=7S_{n-1}-S_{n-2}$, with $S_0=2$ and $S_1=7$. The sequence ends at $S_6=103682$, so the remainder is $682$.',
  },
  {
    id: 'riddle-3',
    topic: 'Combinatorics',
    title: 'Digit sets and permutations',
    latexProblem: 'How many four-digit integers have distinct digits and digit sum divisible by $9$?',
    options: ['516', '486', '504', '540'],
    correctIdx: 0,
    explanation: 'There are 14 valid digit sets without zero and 10 with zero. They contribute $14\\cdot4!$ and $10\\cdot(4!-3!)$, for $336+180=516$.',
  },
];

interface DailyReflexWidgetProps {
  onRewardXP?: (pts: number) => void;
}

export default function DailyReflexWidget({ onRewardXP }: DailyReflexWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);

  const riddle = DAILY_RIDDLES[currentIndex];
  const isAnswered = selectedIdx !== null;
  const isCorrect = selectedIdx === riddle.correctIdx;

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
    if (idx === riddle.correctIdx && !claimed) {
      setClaimed(true);
      if (onRewardXP) {
        onRewardXP(15);
      }
    }
  };

  const handleNext = () => {
    setSelectedIdx(null);
    setClaimed(false);
    setCurrentIndex((prev) => (prev + 1) % DAILY_RIDDLES.length);
  };

  return (
    <div className="cx-card relative overflow-hidden bg-surface-raised/90 p-6 md:p-7 border border-line rounded-card shadow-e2">
      {/* Background glow orb */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(225,173,102,0.8), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line-faint">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="type-eyebrow text-accent-text tracking-[0.16em]">Daily Math Reflex</span>
            <h3 className="font-serif text-[18px] text-content font-medium">{riddle.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="cx-tag cx-tag-accent text-[9.5px]">{riddle.topic}</span>
          <span className="cx-tag cx-tag-neutral text-[9.5px] text-accent-text">+15 PTS</span>
        </div>
      </div>

      <div className="my-5">
        <div className="text-[16px] leading-[1.6] text-content">
          <MathText text={riddle.latexProblem} />
        </div>
      </div>

      {/* Answer options */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {riddle.options.map((opt, idx) => {
          let state: 'selected' | 'correct' | 'wrong' | undefined = undefined;
          if (isAnswered) {
            if (idx === riddle.correctIdx) state = 'correct';
            else if (idx === selectedIdx) state = 'wrong';
          }

          return (
            <m.button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(idx)}
              whileTap={!isAnswered ? { scale: 0.97 } : undefined}
              transition={spring.press}
              data-state={state}
              className="cx-option py-3.5 px-4 text-[15px]"
            >
              <span className="cx-option__letter">{String.fromCharCode(65 + idx)}.</span>
              <span className="flex-1 font-serif text-[17px] tnum">
                <MathText text={opt} />
              </span>
              {state === 'correct' && <CheckCircle2 className="h-4 w-4 text-proof shrink-0" />}
              {state === 'wrong' && <XCircle className="h-4 w-4 text-accent shrink-0" />}
            </m.button>
          );
        })}
      </div>

      {/* Result feedback */}
      <AnimatePresence mode="wait">
        {isAnswered && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.smooth}
            className={`mt-4.5 rounded-control p-4 border text-[13.5px] ${
              isCorrect
                ? 'border-proof/40 bg-proof/10 text-proof-800 dark:text-proof-100'
                : 'border-line-strong bg-surface-sunken text-content-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-[16px] font-medium mb-1.5 flex items-center gap-2">
                  {isCorrect ? (
                    <>
                      <Sparkles className="h-4 w-4 text-proof shrink-0" />
                      <span>Brilliant! +15 points added to your streak.</span>
                    </>
                  ) : (
                    <span>Not quite, review the solution step below:</span>
                  )}
                </p>
                <div className="text-[13px] leading-[1.6] text-content-muted">
                  <MathText text={riddle.explanation} />
                </div>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="cx-btn cx-btn-secondary py-1.5 px-3 text-[12px] shrink-0"
              >
                <span>Next riddle</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
