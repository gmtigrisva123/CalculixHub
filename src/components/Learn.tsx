/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle, HelpCircle, GraduationCap, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Award, Sparkles, BookOpenCheck, Filter } from 'lucide-react';
import { Problem, Topic, Level, CompetitionLevel, SmartFeedback, UserStats } from '../../shared/types';
import { TOPIC_META, TOPIC_LIST, LEVEL_LIST, LEVEL_META, COMPETITION_LIST } from '../lib/topics';
import NumericAnswerGrid from './NumericAnswerGrid';
import GeometryDiagram from './GeometryDiagram';
import { useAuth } from '../context/AuthContext';
import MathText from './MathText';
import { apiUrl, apiFetch } from '../services/apiBase';
import { gradeLocally } from '../platform/offline';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { Collapse, StaggerItem } from './motion';
import { EMPTY_PRACTICE, submitPractice } from '../../shared/practiceRules';

interface LearnProps {
  problems: Problem[];
  completedProblems: string[];
  userStats: UserStats;
  onSolveProblem: (id: string, isCorrect: boolean, scorePoints: number) => void;
  onOpenTutor: (prompt?: string) => void;
  savedAttempts?: Record<string,{count:number;finished:boolean;forfeited:boolean}>;
  initialFilters?: { topic?: Topic; level?: Level };
}

export default function Learn({
  problems,
  completedProblems,
  onSolveProblem,
  onOpenTutor,
  initialFilters,
  savedAttempts,
}: LearnProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<Level | 'All'>('All');
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionLevel | 'All'>('All');
  const { user } = useAuth();
  const started=useRef(performance.now());
  const currentUser=useRef(user?.id);currentUser.current=user?.id;
  const submissionLock = useRef(false);
  const [practiceSession] = useState(() => {
    const key = 'calculix_practice_session';
    const current = localStorage.getItem(key);
    if (current) return current;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  });
  const attemptKey = 'calculix_learn_attempts_v2:' + (user?.id ?? 'guest');
  const [attempts, setAttempts] = useState<Record<string, { count: number; finished: boolean; forfeited: boolean }>>({});
  useEffect(() => {
    if(user){setAttempts(savedAttempts??{});return;}
    try { setAttempts(JSON.parse(localStorage.getItem(attemptKey) ?? '{}')); }
    catch { setAttempts({}); }
  }, [attemptKey,savedAttempts,user?.id]);
  const saveAttempt = (id: string, state: { count: number; finished: boolean; forfeited: boolean }) => {
    setAttempts(previous => {
      const next = { ...previous, [id]: state };
      if(!user)localStorage.setItem(attemptKey, JSON.stringify(next));
      return next;
    });
  };
  useEffect(()=>{setActiveProblem(null);setShowFullSolution(false);},[user?.id]);
  const maxAttempts = 3;

  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const attempt = activeProblem ? attempts[activeProblem.id] : undefined;
  const locked = Boolean(activeProblem?.proOnly || attempt?.finished || completedProblems.includes(activeProblem?.id ?? ''));
  const [answerInput, setAnswerInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [smartFeedback, setSmartFeedback] = useState<SmartFeedback | null>(null);
  const [showFullSolution, setShowFullSolution] = useState(false);
  const [revealedWithoutScore, setRevealedWithoutScore] = useState(false);

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.topic) setSelectedTopic(initialFilters.topic);
      if (initialFilters.level) setSelectedLevel(initialFilters.level);
    }
  }, [initialFilters]);

  const filteredProblems = problems.filter((prob) => {
    const matchTopic = selectedTopic === 'All' || prob.topic === selectedTopic;
    const matchLevel = selectedLevel === 'All' || prob.level === selectedLevel;
    return matchTopic && matchLevel && (selectedCompetition === 'All' || prob.competition === selectedCompetition);
  });

  const handleSelectProblem = (prob: Problem) => {
    started.current=performance.now();
    setActiveProblem(prob);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setShowFullSolution(Boolean(attempts[prob.id]?.finished || completedProblems.includes(prob.id)) && !prob.proOnly);
    setRevealedWithoutScore(Boolean(attempts[prob.id]?.forfeited));
  };

  const handleCloseWorkspace = () => {
    setActiveProblem(null);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setShowFullSolution(false);
    setRevealedWithoutScore(false);
  };

  const applyVerdict = (feedback: SmartFeedback, correct: boolean) => {
    if (!activeProblem) return;

    setSmartFeedback(feedback);
    const next = feedback.attemptsUsed === undefined ? submitPractice(attempts[activeProblem.id] ?? EMPTY_PRACTICE, correct)
      : { count: feedback.attemptsUsed, finished: Boolean(feedback.finished), forfeited: Boolean(feedback.forfeited) };
    saveAttempt(activeProblem.id, next);

    if (correct) {
      setRevealedWithoutScore(false);
      const isFresh = !completedProblems.includes(activeProblem.id);
      onSolveProblem(activeProblem.id, true, isFresh ? feedback.pointsAwarded??0 : 0);
      setShowFullSolution(true);
    } else {
      setShowFullSolution(next.finished);
      setRevealedWithoutScore(next.forfeited);
      onSolveProblem(activeProblem.id, false, 0);
    }
  };

  const handleRevealSolution = async () => {
    if (!activeProblem || evaluating || activeProblem.proOnly) return;
    const actingUser = user?.id;
    setEvaluating(true);
    try {
      const response=await apiFetch('/api/evaluate',{method:'POST',body:JSON.stringify({problemId:activeProblem.id,userAnswer:'__forfeit__',practiceSession,forfeit:true,durationMs:Math.min(14400000,Math.round(performance.now()-started.current))})});
      if(!response.ok&&user)throw Error('Could not save the pass. Please reconnect and retry.');
      if (currentUser.current !== actingUser) return;
      saveAttempt(activeProblem.id,{count:attempts[activeProblem.id]?.count??0,finished:true,forfeited:true});
      onSolveProblem(activeProblem.id,false,0);
    } catch(e) {if(user){setSmartFeedback({correct:false,explanation:'Could not save the pass.',guidance:'Reconnect and try again.'});setEvaluating(false);return;}saveAttempt(activeProblem.id,{count:attempts[activeProblem.id]?.count??0,finished:true,forfeited:true});}
    setEvaluating(false);
    setShowFullSolution(true);
    setRevealedWithoutScore(true);
    setSmartFeedback(null);
    onOpenTutor(
      [
        'A learner could not solve this problem and asked for a clear explanation.',
        'Explain the worked solution step by step in warm, precise English.',
        'Do not award points, and do not assume the learner already knows the key theorem.',
        `Problem: ${activeProblem.title}`,
        `Question: ${activeProblem.question}`,
        `Correct answer: ${activeProblem.correctAnswer}`,
        `Worked solution: ${activeProblem.solution}`,
      ].join('\n\n'),
    );
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || answerInput.includes('_') || !activeProblem || evaluating || locked || submissionLock.current) return;
    submissionLock.current = true;
    const actingUser=user?.id;

    setEvaluating(true);
    setSmartFeedback(null);
    setShowFullSolution(false);
    setRevealedWithoutScore(false);

    try {
      const response = await apiFetch('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ problemId: activeProblem.id, userAnswer: answerInput, practiceSession,durationMs:Math.min(14400000,Math.round(performance.now()-started.current)) }),
      });

      if (!response.ok) throw new Error(`Grading unavailable (${response.status})`);
      if (response.ok) {
        const data: SmartFeedback = await response.json();
        if(currentUser.current!==actingUser)return;
        applyVerdict(data, data.correct);
        started.current=performance.now();
      }
    } catch (err) {
      if(user){setSmartFeedback({correct:false,explanation:'Your answer has not been saved.',guidance:'Reconnect and submit again. Points and progress only update after a successful database save.'});return;}
      const correct = gradeLocally(answerInput, activeProblem.correctAnswer);


      applyVerdict(
        {
          correct,
          explanation: correct
            ? 'Correct! Your answer matches the worked solution.'
            : 'Not quite. Check your reasoning and try again while attempts remain.',
          guidance:
            "Answer checked in this browser. Online feedback is currently unavailable.",
        },
        correct,
      );
    } finally {
      setEvaluating(false);
      submissionLock.current = false;
    }
  };

  useEffect(()=>{
    if(!activeProblem)return;
    const live=problems.find(p=>p.id===activeProblem.id);
    if(!live){handleCloseWorkspace();return;}
    if(live!==activeProblem)setActiveProblem(live);
    if(user&&savedAttempts?.[activeProblem.id]?.finished){setShowFullSolution(!live.proOnly);setRevealedWithoutScore(Boolean(savedAttempts[activeProblem.id].forfeited));}
  },[problems,savedAttempts,user?.id]);

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
                <p className="type-eyebrow text-indigo-500 font-mono text-xs uppercase">Make a little room to think</p>
                <h1 className="type-title text-2xl font-bold text-content mt-1">Find a question worth your time</h1>
              </div>
              <span className="text-xs font-mono text-content-subtle">
                {completedProblems.length} of {problems.length} solved
              </span>
            </header>
            <p className="text-sm text-content-muted">Competition preparation, from short answers to proof techniques. These are training questions and variants, not official contest papers. Proof submissions will open with Pro.</p>

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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Competition level">
              {(['All', ...COMPETITION_LIST] as const).map(contest => <button key={contest}
                aria-pressed={selectedCompetition === contest} onClick={() => setSelectedCompetition(contest)}
                className={'cx-chip px-4 py-2 border rounded-xl ' + (selectedCompetition === contest ? 'border-indigo-500 text-indigo-500' : 'border-line text-content-muted')}>
                {contest === 'All' ? 'All competitions' : contest}
              </button>)}
            </div>
            {filteredProblems.length === 0 && <div className="cx-glass-panel p-7 space-y-3" role="status">
              <h3 className="type-title text-xl text-content">No questions in this selection yet.</h3>
              <p className="text-sm text-content-muted leading-relaxed">Try another tier or clear the filters to explore the full question library.</p>
              <button type="button" className="cx-btn cx-btn-secondary px-4 py-2 rounded-lg text-sm" onClick={() => { setSelectedTopic('All'); setSelectedLevel('All'); setSelectedCompetition('All'); }}>Show all questions</button>
            </div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProblems.map((prob, index) => {
                const isSolved = completedProblems.includes(prob.id);
                return (
                    <button type="button" className="text-left" key={prob.id} onClick={() => handleSelectProblem(prob)}>
                    <StaggerItem
                        index={Math.min(index, 7)}
                      className="cx-card-quantum p-5 space-y-3 flex flex-col justify-between hover:border-indigo-500/50 cursor-pointer transition-colors h-full"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="cx-tag cx-tag-accent text-[10px]">{prob.topic}</span>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-sunken border border-line text-content-subtle">
                              {prob.competition ?? prob.level}{prob.proOnly ? ' · Pro locked' : ''}
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
                  </button>
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
                {activeProblem.figure && <GeometryDiagram figure={activeProblem.figure}/>}

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
                {activeProblem.proOnly ? <section className="cx-glass-panel p-6 space-y-3">
                  <h3 className="font-semibold text-content">Proof practice · Pro</h3>
                  <p className="text-content-muted">Written proofs and detailed grading are coming with Pro. This problem is currently locked.</p>
                  <button disabled className="cx-btn w-full opacity-60">Pro coming soon</button>
                </section> : <form onSubmit={handleSubmitAnswer} className="cx-glass-panel p-6 space-y-4">
                  <h3 className="font-semibold text-sm text-content">Submit Your Answer</h3>
                  <p className="text-sm text-content-subtle">{Math.min(attempt?.count ?? 0, 3)} of 3 attempts used{attempt?.forfeited ? ' · No points available' : ''}</p>

                  <div className="space-y-2">
                    {activeProblem.answerMode === 'numeric-grid' && activeProblem.answerDigits ? <NumericAnswerGrid
                      digits={activeProblem.answerDigits} value={answerInput} onChange={setAnswerInput} disabled={evaluating || locked}
                    /> : activeProblem.options?.length ? <div className="space-y-2">{activeProblem.options.map((option, index) => <button
                      type="button" key={option} disabled={evaluating || locked} aria-pressed={answerInput === option}
                      onClick={() => setAnswerInput(option)} className={'w-full text-left p-3 border rounded-xl ' + (answerInput === option ? 'border-indigo-500 bg-indigo-500/10' : 'border-line')}>
                      <span className="mr-3">{String.fromCharCode(65 + index)}.</span><MathText text={option}/>
                    </button>)}</div> : <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Enter numerical or algebraic answer..."
                      disabled={evaluating || locked}
                      className="w-full px-4 py-3 rounded-xl border border-line bg-surface-sunken text-content font-mono text-sm focus:outline-hidden focus:border-indigo-500"
                    />}
                  </div>

                  <m.button
                    type="submit"
                    disabled={!answerInput.trim() || answerInput.includes('_') || evaluating || locked}
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
                </form>}

                {!showFullSolution && !activeProblem.proOnly && (
                  <m.button
                    type="button"
                    onClick={handleRevealSolution}
                    disabled={evaluating}
                    whileTap={{ scale: 0.97 }}
                    className="w-full rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <BookOpenCheck className="h-4 w-4 shrink-0" />
                        I can&apos;t solve this — show me
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-75">No points</span>
                    </span>
                  </m.button>
                )}

                {revealedWithoutScore && (
                  <p className="text-[11px] leading-relaxed text-content-subtle">
                    The solution is open for learning. This problem will not add points or count as solved.
                  </p>
                )}

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
                  onClick={() => onOpenTutor()}
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

          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
