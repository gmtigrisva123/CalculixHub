/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, HelpCircle, GraduationCap, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Award, Sparkles, BookOpenCheck } from 'lucide-react';
import { Problem, Topic, Level, SmartFeedback, UserStats } from '../types';

interface LearnProps {
  problems: Problem[];
  completedProblems: string[];
  userStats: UserStats;
  onSolveProblem: (id: string, isCorrect: boolean, scorePoints: number) => void;
  // Deep navigation overrides
  initialFilters?: { topic?: Topic; level?: Level };
}

export default function Learn({
  problems,
  completedProblems,
  userStats,
  onSolveProblem,
  initialFilters,
}: LearnProps) {
  // Filters state
  const [selectedTopic, setSelectedTopic] = useState<Topic | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<Level | 'All'>('All');

  // Active problem workspace
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [smartFeedback, setSmartFeedback] = useState<SmartFeedback | null>(null);
  const [showFullSolution, setShowFullSolution] = useState(false);

  // Apply deep link overrides
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.topic) setSelectedTopic(initialFilters.topic);
      if (initialFilters.level) setSelectedLevel(initialFilters.level);
    }
  }, [initialFilters]);

  // Filtered problems list
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

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !activeProblem || evaluating) return;

    setEvaluating(true);
    setSmartFeedback(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: activeProblem.id,
          userAnswer: answerInput,
        }),
      });

      if (response.ok) {
        const data: SmartFeedback = await response.json();
        setSmartFeedback(data);

        if (data.correct) {
          // If correct and student hadn't completed it before
          const isFresh = !completedProblems.includes(activeProblem.id);
          onSolveProblem(activeProblem.id, true, isFresh ? activeProblem.points : 0);
          setShowFullSolution(true);
        } else {
          // If incorrect, deduct nothing or feedback
          onSolveProblem(activeProblem.id, false, 0);
        }
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Translate topic identifiers to user-friendly English titles
  const translateTopic = (topic: Topic) => {
    switch (topic) {
      case 'Algebra': return 'Algebra';
      case 'Geometry': return 'Geometry';
      case 'Combinatorics': return 'Combinatorics & Graphs';
      case 'Number Theory': return 'Number Theory';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* (1) Grid Overview when workspace is closed */}
      {!activeProblem ? (
        <div className="space-y-6">
          
          {/* Main Title & Nav Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <GraduationCap className="w-7 h-7 text-blue-600" /> Adaptive Learning System (Learning Engine)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Deep practice by mathematical subtopics with adaptive difficulty from foundation to national Olympiad level.
              </p>
            </div>

            {/* Quick Summary Banner */}
            <div className="bg-slate-50 border border-slate-150 px-3.5 py-1.5 rounded-xl flex items-center gap-3 self-start">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Completed:</span>
              <span className="text-sm font-extrabold text-slate-900">
                {completedProblems.length} / {problems.length} Problems
              </span>
            </div>
          </div>

          {/* Filters Rail */}
          <div className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center">
            
            {/* Topic Filter */}
            <div className="space-y-1.5 flex-1 select-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Topic</span>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {['All', 'Algebra', 'Geometry', 'Combinatorics', 'Number Theory'].map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setSelectedTopic(topic as Topic | 'All')}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                      selectedTopic === topic
                        ? 'bg-slate-900 border border-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {topic === 'All' ? '⚡ All' : translateTopic(topic as Topic)}
                  </button>
                ))}
              </div>
            </div>

            {/* Level Filter */}
            <div className="space-y-1.5 select-none shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Difficulty</span>
              <div className="flex gap-2 pt-0.5">
                {['All', 'Foundation', 'Advanced', 'Olympiad'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl as Level | 'All')}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                      selectedLevel === lvl
                        ? 'bg-slate-900 border border-slate-800 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lvl === 'All' ? 'All' : lvl}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Problems List Grid */}
          {filteredProblems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No problems match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProblems.map((prob) => {
                const isCompleted = completedProblems.includes(prob.id);
                return (
                  <div
                    key={prob.id}
                    className={`bg-white border rounded-2xl p-5 hover:border-slate-300 hover:shadow-xs transition-all relative flex flex-col justify-between group ${
                      isCompleted ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100'
                    }`}
                  >
                    <div>
                      {/* Meta Rail */}
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          prob.level === 'Olympiad'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : prob.level === 'Advanced'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {prob.level}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                          {translateTopic(prob.topic)}
                        </span>
                      </div>

                      {/* Header Title */}
                      <h3 className="font-extrabold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                        {prob.title}
                      </h3>

                      {/* Snippet Quest */}
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {prob.question.replace(/\$(.*?)\$/g, '$1')}
                      </p>
                    </div>

                    {/* Bottom Status */}
                    <div className="mt-5 pt-3.5 border-t border-slate-100/50 flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">
                        🏆 +{prob.points} Points
                      </span>
                      {isCompleted ? (
                        <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Solved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectProblem(prob)}
                          className="bg-slate-900 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl hover:bg-black transition-all cursor-pointer flex items-center gap-1 group-hover:translate-x-0.5 group-hover:scale-102"
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
        /* Workspace Active View */
        <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-200 pb-16">
          
          {/* Back Action Header */}
            <button
            onClick={handleCloseWorkspace}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold cursor-pointer border border-slate-200/80 bg-white px-3.5 py-2 rounded-xl hover:shadow-2xs self-start"
          >
            <ArrowLeft className="w-4 h-4" /> Back to problem list
          </button>

          {/* Problem Card Main */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden">
            
            {/* Header metadata layout */}
            <div className="bg-slate-900 text-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex gap-2 items-center">
                  <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                    {activeProblem.level}
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                    {translateTopic(activeProblem.topic)}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-black tracking-tight mt-1.5">{activeProblem.title}</h2>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400 block font-medium">Bản thưởng</span>
                <span className="text-sm font-extrabold text-amber-400 tracking-wide block">🏆 {activeProblem.points} Points</span>
              </div>
            </div>

            {/* Problem Details Body */}
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Question Text block */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150/70">
                <p className="text-sm md:text-base text-slate-800 leading-relaxed font-semibold whitespace-pre-line font-serif">
                  {activeProblem.question.split('\n').map((line, idx) => {
                    // Let's replace LaTeX syntax easily for user viewing
                    let cleanLine = line.replace(/\$(.*?)\$/g, '$1');
                    return (
                      <span key={idx} className="block mt-1 first:mt-0">
                        {cleanLine}
                      </span>
                    );
                  })}
                </p>
              </div>

              {/* Submit Area & Response Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Submission Form */}
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest">Auto-evaluate Answer</h4>

                  <form onSubmit={handleSubmitAnswer} className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <input
                        id="field-user-answer"
                        type="text"
                        placeholder="Enter your answer value..."
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        disabled={evaluating || completedProblems.includes(activeProblem.id)}
                        className="flex-1 border border-slate-200 focus:border-slate-900 rounded-xl px-4 py-3 text-sm font-bold outline-hidden transition-all text-slate-800 bg-slate-50/50 disabled:opacity-55 disabled:cursor-not-allowed"
                      />
                      <button
                        id="btn-submit-answer"
                        type="submit"
                        disabled={evaluating || !answerInput.trim() || completedProblems.includes(activeProblem.id)}
                        className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-3 h-11 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {evaluating ? (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking...
                          </span>
                        ) : (
                          'Submit Answer'
                        )}
                      </button>
                    </div>

                    {/* Helper buttons */}
                    <div className="flex gap-2">
                      <button
                        id="btn-show-hint"
                        type="button"
                        onClick={() => setShowHint(!showHint)}
                        className="text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-4 py-2 rounded-lg border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <HelpCircle className="w-4 h-4 text-slate-500" />
                        {showHint ? 'Hide Hint' : 'Show Hint'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowFullSolution(!showFullSolution)}
                        className="text-xs bg-blue-50/60 hover:bg-blue-100/60 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 transition-all cursor-pointer flex items-center gap-1.5 font-semibold"
                      >
                        <BookOpenCheck className="w-4 h-4 text-blue-500" />
                        View Full Solution
                      </button>
                    </div>

                    {/* Render Hint Block */}
                    {showHint && (
                      <div className="p-4.5 bg-yellow-50/60 border border-yellow-200 rounded-xl text-xs text-yellow-800 leading-relaxed font-medium animate-in slide-in-from-top-3 duration-200">
                        💡 <strong>Study tip:</strong> {activeProblem.hint}
                      </div>
                    )}
                  </form>
                </div>

                {/* Right Side: Smart AI Feedback */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      EduReach AI Feed
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Automated Feedback</span>
                  </div>

                  {smartFeedback ? (
                    <div className="space-y-3.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        {smartFeedback.correct ? (
                          <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-1 rounded-full flex items-center justify-center shrink-0">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="bg-rose-50 text-rose-700 border border-rose-100 p-1 rounded-full flex items-center justify-center shrink-0">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        )}
                        <span className={`text-xs font-black uppercase tracking-wider ${
                          smartFeedback.correct ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                            {smartFeedback.correct ? 'Accurate' : 'Needs Improvement'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-slate-850 text-xs leading-relaxed font-semibold italic">
                          "{smartFeedback.explanation}"
                        </p>
                        <p className="text-slate-600 text-[11px] leading-relaxed border-t border-slate-200 pt-2 font-medium">
                          🔔 <strong>Practice guidance:</strong> {smartFeedback.guidance}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs space-y-1">
                      <Sparkles className="w-5 h-5 text-slate-300 mx-auto animate-pulse" />
                      <p className="font-semibold">EduReach is waiting for an answer submission</p>
                      <p className="text-[9px]">Submit an answer to receive targeted improvement guidance from the AI support system.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Unlocked Model Solution Block */}
              {showFullSolution && (
                <div className="border-t border-slate-100 pt-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 text-indigo-800">
                    <Award className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">Unlocked Full Solution</h3>
                  </div>

                  <div className="p-5 md:p-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-850 shadow-inner font-serif leading-relaxed text-sm space-y-3.5">
                    <p className="whitespace-pre-line font-medium text-slate-300">
                      {activeProblem.solution.split('\n').map((line, idx) => {
                        let cleanLine = line.replace(/\$(.*?)\$/g, '$1');
                        return (
                          <span key={idx} className="block mt-1.5 first:mt-0">
                            {cleanLine}
                          </span>
                        );
                      })}
                    </p>
                    <div className="pt-2 bg-slate-850 p-3 rounded-xl border border-slate-800 text-xs text-indigo-300 font-medium">
                      🎯 <strong>Thought Treasure:</strong> What did you learn from this solution? Save it to your personal thinking notes to build the habit of analyzing mathematical structure.
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
