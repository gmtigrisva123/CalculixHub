/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { m } from 'motion/react';
import { FlaskConical, BarChart2, Calculator, Info, LineChart, Sparkles } from 'lucide-react';
import { probCorrect, itemInformation } from '../domain/irt';
import MathText from './MathText';
import { useAuth } from '../context/AuthContext';
import { useLearnerSnapshot } from '../services/data/people';

export default function ResearchAnalytics() {
  const {user}=useAuth();const saved=useLearnerSnapshot(user?.id??null);
  const [theta, setTheta] = useState<number>(0.5);
  const [paramA, setParamA] = useState<number>(1.2);
  const [paramB, setParamB] = useState<number>(0.0);
  const [paramC, setParamC] = useState<number>(0.2);

  const currentProb = probCorrect(theta, { a: paramA, b: paramB, c: paramC });
  const currentInfo = itemInformation(theta, { a: paramA, b: paramB, c: paramC });

  // Generate ICC plot points
  const points: { theta: number; prob: number }[] = [];
  for (let t = -3; t <= 3; t += 0.25) {
    const p = probCorrect(t, { a: paramA, b: paramB, c: paramC });
    points.push({ theta: t, prob: p });
  }

  return (
    <div className="space-y-8">
      {saved.error&&<p role="alert">{saved.error}</p>}
      <p className="arena-note">Your saved record: {saved.data.stats?.attempts_total??0} attempts · {saved.data.accuracyPct===null?'No measured accuracy yet':saved.data.accuracyPct+'% accuracy'}. The explorer below is a mathematical sandbox; its sliders are not measured learner ability.</p>
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="type-eyebrow text-cyan-500 font-mono text-xs uppercase">Psychometrics Laboratory</p>
        <h1 className="type-title text-2xl font-bold text-content mt-1 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-cyan-500" /> 3PL Item Response Theory Explorer
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Parameter Controls Panel */}
        <div className="lg:col-span-5 cx-glass-panel p-6 space-y-6">
          <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-500" /> 3PL Model Parameters
          </h2>

          <div className="space-y-5 text-xs font-mono">
            {/* Theta slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-content font-semibold">
                  Ability Parameter <MathText text="\(\theta\)" />:
                </label>
                <span className="font-bold text-indigo-500">{theta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={theta}
                onChange={(e) => setTheta(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Discrimination a */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-content font-semibold">
                  Discrimination <MathText text="\(a_i\)" />:
                </label>
                <span className="font-bold text-cyan-500">{paramA.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                value={paramA}
                onChange={(e) => setParamA(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Difficulty b */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-content font-semibold">
                  Difficulty <MathText text="\(b_i\)" />:
                </label>
                <span className="font-bold text-amber-500">{paramB.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2.5"
                max="2.5"
                step="0.1"
                value={paramB}
                onChange={(e) => setParamB(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Pseudo-guessing c */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-content font-semibold">
                  Pseudo-Guessing <MathText text="\(c_i\)" />:
                </label>
                <span className="font-bold text-emerald-500">{paramC.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.4"
                step="0.05"
                value={paramC}
                onChange={(e) => setParamC(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Real-time Computed Values */}
          <div className="p-4 rounded-xl border border-line bg-surface-sunken/40 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-content-subtle">
                Prob. Correct <MathText text="\(P_i(\theta)\)" />:
              </span>
              <span className="font-bold text-emerald-500">{(currentProb * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-subtle">
                Fisher Information <MathText text="\(I_i(\theta)\)" />:
              </span>
              <span className="font-bold text-indigo-500">{currentInfo.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Model Explanation & Formulas */}
        <div className="lg:col-span-7 cx-glass-panel p-6 space-y-5">
          <h2 className="type-title text-lg font-bold text-content flex items-center gap-2">
            <LineChart className="w-5 h-5 text-cyan-500" /> Mathematical Formulation
          </h2>

          <div className="p-5 rounded-xl border border-line bg-surface-sunken/30 space-y-4 text-xs font-mono leading-relaxed text-content">
            <p className="font-semibold text-indigo-500">3-Parameter Logistic (3PL) Response Model:</p>
            <div className="p-3 bg-surface-raised rounded-lg border border-line text-center text-sm font-serif">
              <MathText text="\[P_i(\theta) = c_i + \frac{1 - c_i}{1 + e^{-D a_i (\theta - b_i)}}\]" />
            </div>

            <p className="font-semibold text-cyan-500 pt-2">
              Fisher Information Function <MathText text="\(I_i(\theta)\)" />:
            </p>
            <div className="p-3 bg-surface-raised rounded-lg border border-line text-center text-sm font-serif">
              <MathText text="\[I_i(\theta) = D^2 a_i^2 \frac{1 - P_i(\theta)}{P_i(\theta)} \left[ \frac{P_i(\theta) - c_i}{1 - c_i} \right]^2\]" />
            </div>

            <p className="text-content-subtle text-[11px] leading-normal pt-2">
              CalculixHub uses Expected A Posteriori (EAP) ability estimation to update learner skill{' '}
              <MathText text="\(\theta\)" /> dynamically after each item response.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
