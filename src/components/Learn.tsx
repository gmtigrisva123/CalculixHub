/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle, HelpCircle, GraduationCap, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Award, Sparkles, BookOpenCheck, Filter } from 'lucide-react';
import { Problem, Topic, Level, SmartFeedback, UserStats } from '../../shared/types';
import { TOPIC_META, TOPIC_LIST, LEVEL_LIST, LEVEL_META } from '../lib/topics';
import MathText from './MathText';
import { apiUrl, apiFetch } from '../services/apiBase';
import { gradeLocally, queueGrade } from '../platform/offline';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { Collapse, StaggerItem } from './motion';
import AITutorChat from './AITutorChat';

interface LearnProps {
  problems: Problem[];
  completedProblems: string[];
  userStats: UserStats;
  onSolveProblem: (id: string, isCorrect: boolean, scorePoints: number) => void;
  initialFilters?: { topic?: Topic; level?: Level };
}

export default function Learn({
  problems,
  completedProblems,
  onSolveProblem,
  initialFilters,
}: LearnProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<Level | 'All'>('All');

  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [smartFeedback, setSmartFeedback] = useState<SmartFeedback | null>(null);
  const [showFullSolution, setShowFullSolution] = useState(false);
  const [showAITutor, setShowAITutor] = useState(false);

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.topic) setSelectedTopic(initialFilters.topic);
      if (initialFilters.level) setSelectedLevel(initialFilters.level);
    }
  }, [initialFilters]);

  const filteredProblems = problems.filter((prob) => {
    const matchTopic = selectedTopic === 'All' || prob.topic === selectedTopic;
    const matchLevel = selectedLevel === 'All' || prob.level === selectedLevel;
    return matchTopic && matchLevel;
  });

  const handleSelectProblem = (prob: Problem) => {
    setActiveProblem(prob);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setShowFullSolution(completedProblems.includes(prob.id));
  };

  const handleCloseWorkspace = () => {
    setActiveProblem(null);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setShowFullSolution(false);
  };

  const applyVerdict = (feedback: SmartFeedback, correct: boolean) => {
    if (!activeProblem) return;

    setSmartFeedback(feedback);

    if (correct) {
      const isFresh = !completedProblems.includes(activeProblem.id);
      onSolveProblem(activeProblem.id, true, isFresh ? activeProblem.points : 0);
      setShowFullSolution(true);
    } else {
      onSolveProblem(activeProblem.id, false, 0);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !activeProblem || evaluating) return;

    setEvaluating(true);
    setSmartFeedback(null);

    try {
      const response = await apiFetch('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ problemId: activeProblem.id, userAnswer: answerInput }),
      });

      if (response.ok) {
        const data: SmartFeedback = await response.json();
        applyVerdict(data, data.correct);
      }
    } catch (err) {
      console.warn('Grading offline; queueing for explanation:', err);
      const correct = gradeLocally(answerInput, activeProblem.correctAnswer);
      queueGrade(activeProblem.id, answerInput);

      applyVerdict(
        {
          correct,
          explanation: correct
            ? 'Correct! Your answer matches the worked solution.'
            : 'Not quite. Review the worked solution below and check your steps.',
          guidance:
            "Device offline — answer recorded locally. Detailed AI analysis will sync once reconnected.",
        },
        correct,
      );
    } finally {
      setEvaluating(false);
    }
  };

  const idleSparkleRef = useAmbient<SVGSVGElement>();

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait" initial={false}>
        {!activeProblem ? (
          /* Catalog List View */
          <m.div
            key="problem-list"
            initial={{ opacity: 0, y: travel.sm }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -travel.sm }}
            transition={spring.smooth}
            className="space-y-6"
          >
            {/* Header */}
            <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="type-eyebrow text-indigo-500 font-mono text-xs uppercase">Adaptive Problem Engine</p>
                <h1 className="type-title text-2xl font-bold text-content mt-1">Problem Catalog</h1>
              </div>
              <span className="text-xs font-mono text-content-subtle">
                {completedProblems.length} of {problems.length} solved
              </span>
            </header>

            {/* Filter Bar */}
            <div className="cx-glass-panel p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-content-subtle tracking-wider">
                <Filter className="w-4 h-4 text-indigo-500" /> Filter Problems
              </div>

              {/* Topics */}
              <div className="space-y-2">
                <span className="text-xs text-content-subtle font-semibold">Domain Topic</span>
                <div className="flex flex-wrap gap-2">
                  <m.button
                    onClick={() => setSelectedTopic('All')}
                    whileTap={{ scale: 0.95 }}
                    className={`cx-chip text-xs px-3.5 py-1.5 rounded-lg border font-medium ${
                      selectedTopic === 'All'
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                        : 'border-line bg-surface-sunken/40 text-content-muted hover:border-line-strong'
                    }`}
                  >
                    All Topics
                  </m.button>

                  {TOPIC_LIST.map((topic) => (
                    <m.button
                      key={topic}
                      onClick={() => setSelectedTopic(topic)}
                      whileTap={{ scale: 0.95 }}
                      className={`cx-chip text-xs px-3.5 py-1.5 rounded-lg border font-medium ${
                        selectedTopic === topic
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                          : 'border-line bg-surface-sunken/40 text-content-muted hover:border-line-strong'
                      }`}
                    >
                      {TOPIC_META[topic].label}
                    </m.button>
                  ))}
                </div>
              </div>

              {/* Tiers */}
              <div className="space-y-2">
                <span className="text-xs text-content-subtle font-semibold">Tier Difficulty</span>
                <div className="flex flex-wrap gap-2">
                  <m.button
                    onClick={() => setSelectedLevel('All')}
                    whileTap={{ scale: 0.95 }}
                    className={`cx-chip text-xs px-3.5 py-1.5 rounded-lg border font-medium ${
                      selectedLevel === 'All'
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                        : 'border-line bg-surface-sunken/40 text-content-muted hover:border-line-strong'
                    }`}
                  >
                    All Tiers
                  </m.button>

                  {LEVEL_LIST.map((level) => (
                    <m.button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      whileTap={{ scale: 0.95 }}
                      className={`cx-chip text-xs px-3.5 py-1.5 rounded-lg border font-medium ${
                        selectedLevel === level
                          ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                          : 'border-line bg-surface-sunken/40 text-content-muted hover:border-line-strong'
                      }`}
                    >
                      {LEVEL_META[level].label}
                    </m.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Problem Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProblems.map((prob, index) => {
                const isSolved = completedProblems.includes(prob.id);
                return (
                  <div key={prob.id} onClick={() => handleSelectProblem(prob)}>
                    <StaggerItem
                      index={index}
                      className="cx-card-quantum p-5 space-y-3 flex flex-col justify-between hover:border-indigo-500/50 cursor-pointer transition-colors h-full"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="cx-tag cx-tag-accent text-[10px]">{prob.topic}</span>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-sunken border border-line text-content-subtle">
                              {prob.level}
                            </span>
                          </div>
                          {isSolved && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                              <CheckCircle className="w-4 h-4" /> Solved
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-content text-base line-clamp-1">{prob.title}</h3>
                        <div className="text-xs text-content-muted line-clamp-2">
                          <MathText text={prob.question} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-line text-xs font-mono text-content-subtle">
                        <span>{prob.points} Points</span>
                        <span className="flex items-center gap-1 text-indigo-500 hover:underline font-semibold">
                          Solve Problem <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </StaggerItem>
                  </div>
                );
              })}
            </div>
          </m.div>
        ) : (
          /* Focus-Mode Problem Workspace */
          <m.div
            key="problem-workspace"
            initial={{ opacity: 0, y: travel.sm }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -travel.sm }}
            transition={spring.smooth}
            className="space-y-6"
          >
            {/* Top Workspace Bar */}
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <m.button
                onClick={handleCloseWorkspace}
                whileTap={{ scale: 0.95 }}
                className="cx-btn cx-btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Problem List
              </m.button>

              <div className="flex items-center gap-2">
                <span className="cx-tag cx-tag-accent text-xs">{activeProblem.topic}</span>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-sunken border border-line text-content-subtle">
                  {activeProblem.level}
                </span>
                <span className="text-xs font-bold font-mono text-amber-500">{activeProblem.points} Pts</span>
              </div>
            </div>

            {/* Main Problem View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Problem Canvas */}
              <div className="lg:col-span-7 space-y-5 cx-glass-panel p-6 sm:p-8">
                <h2 className="text-xl font-bold text-content font-serif">{activeProblem.title}</h2>
                
                <div className="text-sm leading-relaxed text-content space-y-4">
                  <MathText text={activeProblem.question} />
                </div>

                {/* Hint Drawer */}
                {activeProblem.hint && (
                  <div className="pt-4 border-t border-line space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="text-xs font-semibold text-amber-500 hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" /> {showHint ? 'Hide Hint' : 'Need a Hint?'}
                    </button>

                    <Collapse open={showHint}>
                      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        <MathText text={activeProblem.hint} />
                      </div>
                    </Collapse>
                  </div>
                )}
              </div>

              {/* Response & Grading Panel */}
              <div className="lg:col-span-5 space-y-5">
                <form onSubmit={handleSubmitAnswer} className="cx-glass-panel p-6 space-y-4">
                  <h3 className="font-semibold text-sm text-content">Submit Your Answer</h3>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Enter numerical or algebraic answer..."
                      disabled={evaluating}
                      className="w-full px-4 py-3 rounded-xl border border-line bg-surface-sunken text-content font-mono text-sm focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <m.button
                    type="submit"
                    disabled={!answerInput.trim() || evaluating}
                    whileTap={{ scale: 0.96 }}
                    className="w-full cx-btn cx-btn-fill py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
                  >
                    {evaluating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Evaluating...
                      </>
                    ) : (
                      'Submit Answer'
                    )}
                  </m.button>
                </form>

                {/* Smart Feedback Banner */}
                {smartFeedback && (
                  <div
                    className={`p-6 rounded-2xl border space-y-3 ${
                      smartFeedback.correct
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {smartFeedback.correct ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-500" /> Correct!
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-500" /> Not quite correct
                        </>
                      )}
                    </div>
                    <MathText
                      as="p"
                      className="text-xs leading-relaxed font-medium"
                      text={smartFeedback.explanation}
                    />
                    {smartFeedback.guidance && (
                      <MathText
                        as="p"
                        className="text-[11px] opacity-80 leading-relaxed font-mono"
                        text={smartFeedback.guidance}
                      />
                    )}
                  </div>
                )}

                {/* Solution View */}
                {showFullSolution && activeProblem.solution && (
                  <div className="cx-glass-panel p-6 space-y-3">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-content-subtle">
                      Worked Solution
                    </h4>
                    <div className="text-xs leading-relaxed text-content font-mono">
                      <MathText text={activeProblem.solution} />
                    </div>
                  </div>
                )}

                {/* AI Tutor Trigger Button */}
                <m.button
                  type="button"
                  onClick={() => setShowAITutor(true)}
                  whileTap={{ scale: 0.96 }}
                  className="w-full p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 font-semibold text-xs flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles ref={idleSparkleRef} className="w-4 h-4 text-indigo-500" />
                    <span>Ask Socratic AI Tutor about this problem</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </m.button>
              </div>
            </div>

            {/* AI Tutor Overlay Modal */}
            {showAITutor && (
              <AITutorChat />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
