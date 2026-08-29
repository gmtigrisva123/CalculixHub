/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Sliders, Sparkles, RefreshCw, Check, Info } from 'lucide-react';
import MathText from '../MathText';
import { spring } from '../../lib/motion';

export default function InteractiveFormulaLab() {
  const [activeTab, setActiveTab] = useState<'quadratic' | 'modular'>('quadratic');
  
  // Quadratic parameters: ax^2 + bx + c = 0
  const [a, setA] = useState<number>(1);
  const [b, setB] = useState<number>(-5);
  const [c, setC] = useState<number>(6);

  // Modular parameters: a mod m
  const [modVal, setModVal] = useState<number>(17);
  const [modDiv, setModDiv] = useState<number>(5);

  // Discriminant calculation
  const discriminant = b * b - 4 * a * c;
  const root1 = discriminant >= 0 ? ((-b + Math.sqrt(discriminant)) / (2 * a)).toFixed(2) : null;
  const root2 = discriminant >= 0 ? ((-b - Math.sqrt(discriminant)) / (2 * a)).toFixed(2) : null;

  // Modular calculations
  const remainder = ((modVal % modDiv) + modDiv) % modDiv;
  const quotient = Math.floor(modVal / modDiv);

  return (
    <div className="cx-card bg-surface-raised border border-line rounded-card p-6 md:p-8 shadow-e3 my-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-faint pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Sliders className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-serif text-[20px] font-medium text-content">Live Concept & Formula Lab</h3>
            <p className="text-[13px] text-content-subtle">Adjust variables below to see real-time mathematical proof derivations.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 text-[13px]">
          <button
            type="button"
            onClick={() => setActiveTab('quadratic')}
            className={`px-3.5 py-1 rounded-full font-serif transition-colors duration-160 ${
              activeTab === 'quadratic' ? 'bg-indigo-600 text-white font-bold' : 'text-content-muted hover:text-content'
            }`}
          >
            Algebra (Roots & $\Delta$)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('modular')}
            className={`px-3.5 py-1 rounded-full font-serif transition-colors duration-160 ${
              activeTab === 'modular' ? 'bg-indigo-600 text-white font-bold' : 'text-content-muted hover:text-content'
            }`}
          >
            Number Theory ($\pmod m$)
          </button>
        </div>
      </div>

      {activeTab === 'quadratic' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Sliders column */}
          <div className="md:col-span-6 space-y-5">
            <div>
              <div className="flex justify-between text-[13.5px] font-serif mb-1.5">
                <span className="text-content-subtle">Coefficient $a$:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tnum">{a}</span>
              </div>
              <input
                type="range"
                min={-3}
                max={3}
                step={1}
                value={a}
                onChange={(e) => setA(Number(e.target.value) || 1)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[13.5px] font-serif mb-1.5">
                <span className="text-content-subtle">Coefficient $b$:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tnum">{b}</span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={b}
                onChange={(e) => setB(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[13.5px] font-serif mb-1.5">
                <span className="text-content-subtle">Constant $c$:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tnum">{c}</span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={c}
                onChange={(e) => setC(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Live Derivation Column */}
          <div className="md:col-span-6 rounded-control border border-line bg-surface p-5 space-y-4">
            <div className="text-[17px] font-serif leading-[1.6]">
              <span className="text-content-subtle text-[13px] block uppercase tracking-wider mb-1">Active Polynomial</span>
              <MathText text={`$$${a === 1 ? '' : a === -1 ? '-' : a}x^2 ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}x ${c >= 0 ? '+ ' + c : '- ' + Math.abs(c)} = 0$$`} />
            </div>

            <div className="border-t border-line-faint pt-3 text-[14.5px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-content-muted">Discriminant $\\Delta = b^2 - 4ac$:</span>
                <span className={`font-serif font-bold tnum ${discriminant > 0 ? 'text-emerald-600' : discriminant === 0 ? 'text-amber-600' : 'text-rose-500'}`}>
                  {discriminant}
                </span>
              </div>
              <p className="text-[13px] text-content-subtle">
                {discriminant > 0
                  ? 'Two distinct real roots exist.'
                  : discriminant === 0
                  ? 'One repeated real root.'
                  : 'Two complex conjugate roots.'}
              </p>
            </div>

            <div className="border-t border-line-faint pt-3">
              <span className="text-content-subtle text-[12.5px] block uppercase tracking-wider mb-1">Calculated Roots</span>
              {discriminant >= 0 ? (
                <div className="font-serif text-[16px] text-indigo-600 dark:text-indigo-400 space-x-4 tnum">
                  <span>$x_1 = {root1}$</span>
                  <span>$x_2 = {root2}$</span>
                </div>
              ) : (
                <div className="font-serif text-[15px] text-content-muted">
                  <MathText text={`$x = \\frac{-(${b}) \\pm i\\sqrt{${Math.abs(discriminant)}}}{${2 * a}}$`} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-6 space-y-5">
            <div>
              <div className="flex justify-between text-[13.5px] font-serif mb-1.5">
                <span className="text-content-subtle">Integer $N$:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tnum">{modVal}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={modVal}
                onChange={(e) => setModVal(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[13.5px] font-serif mb-1.5">
                <span className="text-content-subtle">Modulus $m$:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tnum">{modDiv}</span>
              </div>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={modDiv}
                onChange={(e) => setModDiv(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="md:col-span-6 rounded-control border border-line bg-surface p-5 space-y-4">
            <div className="text-[17px] font-serif leading-[1.6]">
              <span className="text-content-subtle text-[13px] block uppercase tracking-wider mb-1">Modular Congruence</span>
              <MathText text={`$$${modVal} \\equiv ${remainder} \\pmod{${modDiv}}$$`} />
            </div>

            <div className="border-t border-line-faint pt-3 text-[14px] text-content-muted leading-[1.6]">
              <p>Quotient form: ${modVal} = {modDiv} \times {quotient} + {remainder}$</p>
              <p className="mt-1 text-[13px] text-content-subtle">
                Remainder $r = {remainder}$ satisfies $0 \le r &lt; {modDiv}$.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
