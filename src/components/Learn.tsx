/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, HelpCircle, GraduationCap, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Award, Sparkles, BookOpenCheck } from 'lucide-react';
import { Problem, Topic, Level, SmartFeedback, UserStats } from '../types';
import { TOPIC_META, TOPIC_LIST, LEVEL_LIST } from '../lib/topics';
import MathText from './MathText';
import { apiUrl } from '../lib/apiBase';
import { gradeLocally, queueGrade } from '../lib/offline';

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

  /**
   * Apply a verdict from either grading path.
   *
   * Shared so that an offline result awards points, marks completion and
   * reveals the solution on exactly the same terms as an online one — a learner
   * without a connection should not quietly lose progress.
   */
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
      const response = await fetch(apiUrl('/api/evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: activeProblem.id, userAnswer: answerInput }),
      });

      if (response.ok) {
        const data: SmartFeedback = await response.json();
        applyVerdict(data, data.correct);
      }
    } catch (err) {
      // The request never reached the server. Rather than dropping work the
      // learner has already done, grade offline and defer the AI explanation.
      //
      // The verdict itself is not degraded: server.ts decides correctness with
      // the same normalised comparison, and correctAnswer is present in the
      // cached item bank. Only the personalised wording needs the network.
      console.warn('Grading offline; queueing for explanation:', err);

      const correct = gradeLocally(answerInput, activeProblem.correctAnswer);
      queueGrade(activeProblem.id, answerInput);

      applyVerdict(
        {
          correct,
          explanation: correct
            ? 'Correct. Your answer matches — the full solution is below.'
            : 'Not quite. The worked solution is below; compare it against your approach.',
          guidance:
            "You're offline, so this was graded on your device. Your answer is saved and the AI tutor will add a personalised explanation once you reconnect.",
        },
        correct,
      );
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {!activeProblem ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2 font-serif">
                <GraduationCap className="w-7 h-7 text-brass-600" /> Learning Engine
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Deep practice across each domain, adapting from Foundation basics to full Olympiad difficulty.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-150 px-3.5 py-1.5 rounded-xl flex items-center gap-3 self-start">
              <span className="text-[10px] text-stone-400 font-bold block uppercase">Completed:</span>
              <span className="text-sm font-extrabold text-stone-900">{completedProblems.length} / {problems.length}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center">
            <div className="space-y-1.5 flex-1 select-none">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">Topic</span>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  onClick={() => setSelectedTopic('All')}
                  className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                    selectedTopic === 'All' ? 'bg-ink-950 border border-ink-950 text-white shadow-xs' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  All topics
                </button>
                {TOPIC_LIST.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setSelectedTopic(topic)}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                      selectedTopic === topic ? 'bg-ink-950 border border-ink-950 text-white shadow-xs' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {TOPIC_META[topic].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 select-none shrink-0">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">Difficulty</span>
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => setSelectedLevel('All')}
                  className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                    selectedLevel === 'All' ? 'bg-ink-950 border border-ink-800 text-white shadow-xs' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  All
                </button>
                {LEVEL_LIST.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                      selectedLevel === lvl ? 'bg-ink-950 border border-ink-800 text-white shadow-xs' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredProblems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-sm">
              <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              No problems match your current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProblems.map((prob) => {
                const isCompleted = completedProblems.includes(prob.id);
                return (
                  <div
                    key={prob.id}
                    className={`bg-white border rounded-2xl p-5 hover:border-stone-300 hover:shadow-xs transition-all relative flex flex-col justify-between group ${
                      isCompleted ? 'border-proof-100 bg-proof-50/10' : 'border-stone-100'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          prob.level === 'Olympiad' ? 'bg-violet-50 text-violet-700 border border-violet-100'
                          : prob.level === 'Advanced' ? 'bg-brass-100 text-brass-700 border border-brass-200'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}>
                          {prob.level}
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold whitespace-nowrap">{TOPIC_META[prob.topic].label}</span>
                      </div>

                      <h3 className="font-extrabold text-stone-800 text-sm leading-snug group-hover:text-brass-700 transition-colors">{prob.title}</h3>

                      <MathText text={prob.question} as="p" className="text-xs text-stone-500 mt-2 line-clamp-3 leading-relaxed" />
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-stone-100 flex justify-between items-center text-xs">
                      <span className="text-stone-400 font-semibold">+{prob.points} pts</span>
                      {isCompleted ? (
                        <span className="text-proof-600 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-proof-500 shrink-0" /> Solved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectProblem(prob)}
                          className="bg-ink-950 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl hover:bg-black transition-all cursor-pointer flex items-center gap-1 group-hover:translate-x-0.5"
                        >
                          Practice <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6 pb-16">
          <button
            onClick={handleCloseWorkspace}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors text-xs font-bold cursor-pointer border border-stone-200 bg-white px-3.5 py-2 rounded-xl hover:shadow-2xs self-start"
          >
            <ArrowLeft className="w-4 h-4" /> Back to problem list
          </button>

          <div className="bg-white border border-stone-100 rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-ink-950 text-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-800">
              <div className="space-y-1">
                <div className="flex gap-2 items-center">
                  <span className="bg-brass-600 text-ink-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">{activeProblem.level}</span>
                  <span className="text-[10px] text-stone-300 font-bold uppercase tracking-wider">{TOPIC_META[activeProblem.topic].label}</span>
                </div>
                <h2 className="text-base md:text-lg font-black tracking-tight mt-1.5 font-serif">{activeProblem.title}</h2>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-stone-400 block font-medium">Reward</span>
                <span className="text-sm font-extrabold text-brass-400 tracking-wide block">+{activeProblem.points} pts</span>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="p-5 bg-stone-50 rounded-2xl border border-stone-150">
                <MathText text={activeProblem.question} as="div" className="text-sm md:text-base text-stone-800 leading-relaxed font-semibold" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="font-bold text-xs text-stone-500 uppercase tracking-widest">Submit your answer</h4>

                  <form onSubmit={handleSubmitAnswer} className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <input
                        id="field-user-answer"
                        type="text"
                        placeholder="Enter your answer..."
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        disabled={evaluating || completedProblems.includes(activeProblem.id)}
                        className="flex-1 border border-stone-200 focus:border-stone-900 rounded-xl px-4 py-3 text-sm font-bold outline-hidden transition-all text-stone-800 bg-stone-50/50 disabled:opacity-55 disabled:cursor-not-allowed"
                      />
                      <button
                        id="btn-submit-answer"
                        type="submit"
                        disabled={evaluating || !answerInput.trim() || completedProblems.includes(activeProblem.id)}
                        className="bg-ink-950 hover:bg-black text-white font-bold text-xs px-5 py-3 h-11 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {evaluating ? (<span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Grading...</span>) : ('Submit answer')}
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        id="btn-show-hint"
                        type="button"
                        onClick={() => setShowHint(!showHint)}
                        className="text-xs bg-stone-100 hover:bg-stone-200/80 text-stone-700 px-4 py-2 rounded-lg border border-stone-200 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <HelpCircle className="w-4 h-4 text-stone-500" />
                        {showHint ? 'Hide hint' : 'Show hint'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowFullSolution(!showFullSolution)}
                        className="text-xs bg-brass-50 hover:bg-brass-100 text-brass-700 px-4 py-2 rounded-lg border border-brass-100 transition-all cursor-pointer flex items-center gap-1.5 font-semibold"
                      >
                        <BookOpenCheck className="w-4 h-4 text-brass-600" />
                        View full solution
                      </button>
                    </div>

                    {showHint && (
                      <div className="p-4.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed font-medium">
                        <strong>Hint:</strong> <MathText text={activeProblem.hint} />
                      </div>
                    )}
                  </form>
                </div>

                <div className="lg:col-span-5 bg-stone-50 border border-stone-150 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-extrabold text-brass-700 bg-brass-50 border border-brass-100 px-2 py-0.5 rounded-md">EduReach AI Feed</span>
                    <span className="text-[10px] text-stone-400 font-bold">Automatic feedback</span>
                  </div>

                  {smartFeedback ? (
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2">
                        {smartFeedback.correct ? (
                          <div className="bg-proof-50 text-proof-700 border border-proof-100 p-1 rounded-full flex items-center justify-center shrink-0"><CheckCircle className="w-4 h-4" /></div>
                        ) : (
                          <div className="bg-rose-50 text-rose-700 border border-rose-100 p-1 rounded-full flex items-center justify-center shrink-0"><AlertCircle className="w-4 h-4" /></div>
                        )}
                        <span className={`text-xs font-black uppercase tracking-wider ${smartFeedback.correct ? 'text-proof-700' : 'text-rose-700'}`}>
                          {smartFeedback.correct ? 'Correct' : 'Not quite'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-stone-850 text-xs leading-relaxed font-semibold italic">&ldquo;{smartFeedback.explanation}&rdquo;</p>
                        <p className="text-stone-600 text-[11px] leading-relaxed border-t border-stone-200 pt-2 font-medium">
                          <strong>Next step:</strong> {smartFeedback.guidance}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-stone-400 text-xs space-y-1">
                      <Sparkles className="w-5 h-5 text-stone-300 mx-auto animate-pulse" />
                      <p className="font-semibold">Waiting for your answer</p>
                      <p className="text-[9px]">Submit an answer to get AI-guided feedback.</p>
                    </div>
                  )}
                </div>
              </div>

              {showFullSolution && (
                <div className="border-t border-stone-100 pt-6 space-y-4">
                  <div className="flex items-center gap-2 text-violet-800">
                    <Award className="w-5 h-5 text-violet-600" />
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">Full Solution</h3>
                  </div>

                  <div className="p-5 md:p-6 bg-ink-950 text-stone-100 rounded-2xl border border-ink-850 shadow-inner leading-relaxed text-sm space-y-3.5">
                    <MathText text={activeProblem.solution} as="div" className="font-medium text-stone-300" />
                    <div className="pt-2 bg-ink-850 p-3 rounded-xl border border-ink-800 text-xs text-violet-300 font-medium">
                      What did this solution teach you? Save the key idea to your personal notebook to build the habit of dissecting structure.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
