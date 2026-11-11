/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle, HelpCircle, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Sparkles, BookOpenCheck } from 'lucide-react';
import { Problem, Topic, Level, SmartFeedback, UserStats } from '../../shared/types';
import NumericAnswerGrid from './NumericAnswerGrid';
import GeometryDiagram from './GeometryDiagram';
import { useAuth } from '../context/AuthContext';
import MathText from './MathText';
import LearnCatalog, { INITIAL_VIEW, type CatalogView } from './LearnCatalog';
import { TOPIC_META } from '../lib/topics';
import { apiUrl, apiFetch } from '../services/apiBase';
import { gradeLocally } from '../platform/offline';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { Collapse } from './motion';
import { EMPTY_PRACTICE, submitPractice } from '../../shared/practiceRules';

/** Why a signed-in submission could not be saved, phrased for the learner. */
interface SaveError { title: string; detail: string }

class SubmitError extends Error {
  constructor(readonly status: number) { super(`Request failed (${status})`); }
}

function describeSaveError(error: unknown, action: 'answer' | 'pass'): SaveError {
  const what = action === 'answer' ? 'Your answer' : 'Your pass';
  const notCounted = 'Nothing was counted, so you have not lost an attempt.';
  if (error instanceof SubmitError) {
    switch (error.status) {
      case 401:
        return { title: 'Your session has expired', detail: `Sign out and sign in again, then resubmit. ${notCounted}` };
      case 403:
        return { title: `${what} was not saved`, detail: `The server refused this connection. Reload the page and try again. ${notCounted}` };
      case 404:
        return { title: 'This question is no longer available', detail: 'Reload the page to refresh the question list.' };
      case 429:
        return { title: 'Too many submissions', detail: `Wait a minute, then submit again. ${notCounted}` };
      default:
        return { title: `${what} was not saved`, detail: `The server could not save it right now. Try again in a moment. ${notCounted}` };
    }
  }
  return { title: `${what} was not saved`, detail: `Check your internet connection and submit again. ${notCounted}` };
}

interface LearnProps {
  problems: Problem[];
  completedProblems: string[];
  userStats: UserStats;
  onSolveProblem: (id: string, isCorrect: boolean, scorePoints: number) => void;
  onOpenTutor: (prompt?: string, label?: string) => void;
  savedAttempts?: Record<string,{count:number;finished:boolean;forfeited:boolean}>;
  initialFilters?: { topic?: Topic; level?: Level };
  /** Goes up each time Learn is chosen from the navigation, including while it is already open. */
  visit?: number;
}

export default function Learn({
  problems,
  completedProblems,
  onSolveProblem,
  onOpenTutor,
  initialFilters,
  savedAttempts,
  visit = 0,
}: LearnProps) {
  // Kept here rather than in the catalog, so the list is as the learner left it when they come back from a question.
  const [view, setView] = useState<CatalogView>(INITIAL_VIEW);
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
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [showFullSolution, setShowFullSolution] = useState(false);
  const [revealedWithoutScore, setRevealedWithoutScore] = useState(false);

  useEffect(() => {
    if (initialFilters) setView({ ...INITIAL_VIEW, topic: initialFilters.topic ?? 'All', level: initialFilters.level ?? 'All' });
  }, [initialFilters]);

  // Where the list was scrolled to when a question was opened, so "back" returns to the same card.
  const listScroll = useRef(0);

  /*
   * The open question is part of the address (?problem=…), so the browser's
   * Back button returns to the list instead of leaving Learn, Forward reopens
   * the question, and a question can be linked to. `ownEntry` records whether
   * this page put that entry in the history, which decides how "Back to
   * Problem List" gets back: by stepping back to the list's own entry, or, for
   * someone who arrived on the question directly, by rewriting this one.
   */
  const ownEntry = useRef(false);
  const writeProblem = (id: string | null, mode: 'push' | 'replace') => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('problem', id); else url.searchParams.delete('problem');
    const address = url.pathname + url.search + url.hash;
    if (mode === 'push') window.history.pushState({ problem: id }, '', address);
    else window.history.replaceState(window.history.state, '', address);
  };

  const showProblem = (prob: Problem) => {
    started.current=performance.now();
    setActiveProblem(prob);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setSaveError(null);
    setShowFullSolution(Boolean(attempts[prob.id]?.finished || completedProblems.includes(prob.id)) && !prob.proOnly);
    setRevealedWithoutScore(Boolean(attempts[prob.id]?.forfeited));
  };

  const hideProblem = () => {
    setActiveProblem(null);
    setAnswerInput('');
    setShowHint(false);
    setSmartFeedback(null);
    setSaveError(null);
    setShowFullSolution(false);
    setRevealedWithoutScore(false);
  };

  const handleSelectProblem = (prob: Problem) => {
    listScroll.current = window.scrollY;
    window.scrollTo({ top: 0, behavior: 'instant' });
    writeProblem(prob.id, 'push');
    ownEntry.current = true;
    showProblem(prob);
  };

  const handleCloseWorkspace = () => {
    if (ownEntry.current) { window.history.back(); return; } // the history listener below closes it
    if (new URLSearchParams(window.location.search).has('problem')) writeProblem(null, 'replace');
    hideProblem();
  };

  // Back, Forward, and arriving on a link to a question.
  const follow = useRef(() => {});
  follow.current = () => {
    const id = new URLSearchParams(window.location.search).get('problem');
    const wanted = id ? problems.find(problem => problem.id === id) ?? null : null;
    if (wanted && wanted.id !== activeProblem?.id) { window.scrollTo({ top: 0, behavior: 'instant' }); showProblem(wanted); }
    if (!wanted && activeProblem) { ownEntry.current = false; hideProblem(); }
  };
  useEffect(() => {
    const onHistory = () => follow.current();
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  // Choosing Learn in the navigation always means the list, even from inside a question.
  const lastVisit = useRef(visit);
  useEffect(() => {
    if (lastVisit.current === visit) return;
    lastVisit.current = visit;
    if (activeProblem) handleCloseWorkspace();
  }, [visit]);
  const catalogReady = problems.length > 0;
  useEffect(() => { if (catalogReady) follow.current(); }, [catalogReady]);

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
    setSaveError(null);
    try {
      const response=await apiFetch('/api/evaluate',{method:'POST',body:JSON.stringify({problemId:activeProblem.id,userAnswer:'__forfeit__',practiceSession,forfeit:true,durationMs:Math.min(14400000,Math.round(performance.now()-started.current))})});
      if(!response.ok&&user)throw new SubmitError(response.status);
      if (currentUser.current !== actingUser) return;
      saveAttempt(activeProblem.id,{count:attempts[activeProblem.id]?.count??0,finished:true,forfeited:true});
      onSolveProblem(activeProblem.id,false,0);
    } catch(e) {if(user){if(currentUser.current===actingUser)setSaveError(describeSaveError(e,'pass'));setEvaluating(false);return;}saveAttempt(activeProblem.id,{count:attempts[activeProblem.id]?.count??0,finished:true,forfeited:true});}
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
      `Explain “${activeProblem.title}” to me`,
    );
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || answerInput.includes('_') || !activeProblem || evaluating || locked || submissionLock.current) return;
    submissionLock.current = true;
    const actingUser=user?.id;

    setEvaluating(true);
    setSmartFeedback(null);
    setSaveError(null);
    setShowFullSolution(false);
    setRevealedWithoutScore(false);

    try {
      const response = await apiFetch('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ problemId: activeProblem.id, userAnswer: answerInput, practiceSession,durationMs:Math.min(14400000,Math.round(performance.now()-started.current)) }),
      });

      if (!response.ok) throw new SubmitError(response.status);
      if (response.ok) {
        const data: SmartFeedback = await response.json();
        if(currentUser.current!==actingUser)return;
        applyVerdict(data, data.correct);
        started.current=performance.now();
      }
    } catch (err) {
      // Signed in, the database is the record: never fall back to a local
      // verdict that would look saved. Say plainly what happened instead.
      if(user){if(currentUser.current===actingUser)setSaveError(describeSaveError(err,'answer'));return;}
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
            <LearnCatalog problems={problems} completed={completedProblems} attempts={attempts} maxAttempts={maxAttempts}
              view={view} onView={setView} onOpen={handleSelectProblem} restoreScroll={listScroll} />
          </m.div>
        ) : (
          /* Focus-Mode Problem Workspace */
          <m.div
            key="problem-workspace"
            initial={{ opacity: 0, y: travel.sm }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -travel.sm }}
            transition={spring.smooth}
            className="ls"
          >
            {/* Where this question sits: the way back, and what kind of question it is. */}
            <div className="ls-bar">
              <m.button type="button" onClick={handleCloseWorkspace} whileTap={{ scale: 0.96 }} className="ls-back">
                <ArrowLeft size={16} aria-hidden="true" /> Back to Problem List
              </m.button>
              <p className="ls-facts" style={TOPIC_META[activeProblem.topic].vars}>
                <span className="ls-topic"><i aria-hidden="true" />{activeProblem.topic}</span>
                {activeProblem.competition && <span>{activeProblem.competition}</span>}
                <span>{activeProblem.level}</span>
                <strong>{activeProblem.points} pts</strong>
              </p>
            </div>

            <div className="ls-grid">
              <div className="ls-main">
                {/* The question, set at reading size on its own sheet. */}
                <article className="ls-sheet">
                  <h2 className="ls-title">{activeProblem.title}</h2>
                  <div className="ls-statement">
                    <MathText text={activeProblem.question} />
                  </div>
                  {activeProblem.figure && <GeometryDiagram figure={activeProblem.figure}/>}

                  {activeProblem.hint && (
                    <div className="ls-hint">
                      <button type="button" onClick={() => setShowHint(!showHint)} aria-expanded={showHint}>
                        <HelpCircle size={16} aria-hidden="true" /> {showHint ? 'Hide Hint' : 'Need a Hint?'}
                      </button>
                      <Collapse open={showHint}>
                        <div className="ls-hint-body">
                          <MathText text={activeProblem.hint} />
                        </div>
                      </Collapse>
                    </div>
                  )}
                </article>

                {showFullSolution && activeProblem.solution && (
                  <article className="ls-sheet ls-solution">
                    <h3><BookOpenCheck size={16} aria-hidden="true" /> Worked Solution</h3>
                    <div className="ls-statement">
                      <MathText text={activeProblem.solution} />
                    </div>
                  </article>
                )}
              </div>

              {/* Answering: stays beside the question while a long statement or solution scrolls. */}
              <div className="ls-side">
                {activeProblem.proOnly ? <section className="ls-panel">
                  <h3>Proof practice · Pro</h3>
                  <p className="ls-count">Written proofs and detailed grading are coming with Pro. This problem is currently locked.</p>
                  <button disabled className="ls-submit">Pro coming soon</button>
                </section> : <form onSubmit={handleSubmitAnswer} className="ls-panel">
                  <div className="ls-panel-head">
                    <h3>Submit Your Answer</h3>
                    <p className="ls-count">
                      <span className="ls-tries" aria-hidden="true">{[1, 2, 3].map(step => <i key={step} data-used={step <= Math.min(attempt?.count ?? 0, 3)} />)}</span>
                      {Math.min(attempt?.count ?? 0, 3)} of 3 attempts used{attempt?.forfeited ? ' · No points available' : ''}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {activeProblem.answerMode === 'numeric-grid' && activeProblem.answerDigits ? <NumericAnswerGrid
                      digits={activeProblem.answerDigits} value={answerInput} onChange={setAnswerInput} disabled={evaluating || locked}
                    /> : activeProblem.options?.length ? <div className="space-y-2 ls-options">{activeProblem.options.map((option, index) => <button
                      type="button" key={option} disabled={evaluating || locked} aria-pressed={answerInput === option}
                      onClick={() => setAnswerInput(option)}>
                      <span className="ls-letter">{String.fromCharCode(65 + index)}</span><MathText text={option}/>
                    </button>)}</div> : <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Enter numerical or algebraic answer..."
                      disabled={evaluating || locked}
                      className="ls-input"
                    />}
                  </div>

                  <m.button
                    type="submit"
                    disabled={!answerInput.trim() || answerInput.includes('_') || evaluating || locked}
                    whileTap={{ scale: 0.97 }}
                    className="ls-submit"
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

                {/* Save failure: not a verdict on the answer, so it is styled and worded apart from one. */}
                {saveError && (
                  <div role="alert" className="ls-verdict is-unsaved">
                    <strong><RefreshCw size={17} aria-hidden="true" /> {saveError.title}</strong>
                    <p>{saveError.detail}</p>
                  </div>
                )}

                {smartFeedback && (
                  <div className={`ls-verdict ${smartFeedback.correct ? 'is-right' : 'is-wrong'}`}>
                    <strong>
                      {smartFeedback.correct
                        ? <><CheckCircle size={17} aria-hidden="true" /> Correct!</>
                        : <><AlertCircle size={17} aria-hidden="true" /> Not quite correct</>}
                    </strong>
                    <MathText as="p" text={smartFeedback.explanation} />
                    {smartFeedback.guidance && <MathText as="p" className="ls-verdict-note" text={smartFeedback.guidance} />}
                  </div>
                )}

                <div className="ls-help">
                  <m.button type="button" onClick={() => onOpenTutor()} whileTap={{ scale: 0.97 }} className="ls-help-item">
                    <Sparkles ref={idleSparkleRef} size={17} aria-hidden="true" />
                    <span>Ask Socratic AI Tutor about this problem<small>It asks you questions; it does not hand over the answer.</small></span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </m.button>
                  {!showFullSolution && !activeProblem.proOnly && (
                    <m.button type="button" onClick={handleRevealSolution} disabled={evaluating} whileTap={{ scale: 0.97 }} className="ls-help-item is-reveal">
                      <BookOpenCheck size={17} aria-hidden="true" />
                      <span>I can&apos;t solve this — show me<small>Opens the worked solution. This problem then earns no points.</small></span>
                      <em>No points</em>
                    </m.button>
                  )}
                </div>

                {revealedWithoutScore && (
                  <p className="ls-fineprint">
                    The solution is open for learning. This problem will not add points or count as solved.
                  </p>
                )}
              </div>
            </div>

          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
