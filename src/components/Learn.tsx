/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle, HelpCircle, GraduationCap, ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Award, Sparkles, BookOpenCheck } from 'lucide-react';
import { Problem, Topic, Level, SmartFeedback, UserStats } from '../types';
import { TOPIC_META, TOPIC_LIST, LEVEL_LIST, LEVEL_META } from '../lib/topics';
import MathText from './MathText';
import { apiUrl, apiFetch } from '../services/apiBase';
import { gradeLocally, queueGrade } from '../platform/offline';
import { duration, ease, spring, travel } from '../lib/motion';
import { useAmbient } from '../hooks/useAmbient';
import { Collapse, StaggerItem } from './motion';

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
      // apiFetch attaches the session token, so the server can record this
      // attempt against the learner and award points itself. Without a session
      // the answer is still graded, just not recorded.
      const response = await apiFetch('/api/evaluate', {
        method: 'POST',
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

  // The idle-state sparkle in the feedback panel, paused when out of view.
  const idleSparkleRef = useAmbient<SVGSVGElement>();

  return (
    <div className="space-y-6">
      {/*
        Browsing the catalogue and working a problem are two different places,
        not two states of one screen, so moving between them gets a directional
        transition: the list recedes and the workspace comes forward from
        slightly below, and the reverse on the way back. That direction is what
        makes "Back to problem list" feel like going back rather than like
        another unrelated screen appearing.

        `mode="wait"` because the two views are full-width and would otherwise
        overlap mid-transition.
      */}
      <AnimatePresence mode="wait" initial={false}>
      {!activeProblem ? (
        <m.div
          key="problem-list"
          initial={{ opacity: 0, y: travel.sm, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99, transition: { duration: duration.instant, ease: ease.exit } }}
          transition={spring.smooth}
          className="space-y-6"
        >
          {/*
            The screen header. Learn ships its own rather than using the
            workspace one in App.tsx, because the completed count belongs beside
            the title and nowhere else.
          */}
          <header className="flex flex-col gap-4 border-b border-line pb-4.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="type-eyebrow text-accent-text">CalculixHub Workspace</p>
              <h1 className="type-title mt-1.5 font-normal text-[clamp(1.75rem,2.6vw,2.375rem)]">Learn</h1>
            </div>
            <span className="text-[12px] tracking-[0.08em] text-content-subtle tnum self-start sm:self-auto">
              {completedProblems.length} of {problems.length} solved
            </span>
          </header>

          {/*
            Filters.

            Topic on the left, tier on the right, each under its own tracked
            label. `.cx-chip` carries both states off `aria-pressed`, so the
            selected chip is an accent outline rather than a filled black pill —
            the system has no filled controls except the one primary action, and
            a row of five filled chips would out-shout it.
          */}
          <section className="flex flex-wrap items-end justify-between gap-6.5">
            <div className="flex flex-col gap-3.5">
              <span className="type-eyebrow text-content-subtle">Topic</span>
              <div className="flex flex-wrap gap-2">
                <m.button
                  onClick={() => setSelectedTopic('All')}
                  whileTap={{ scale: 0.95 }}
                  transition={spring.press}
                  aria-pressed={selectedTopic === 'All'}
                  className="cx-chip"
                >
                  All
                </m.button>
                {TOPIC_LIST.map((topic) => (
                  <m.button
                    key={topic}
                    onClick={() => setSelectedTopic(topic)}
                    whileTap={{ scale: 0.95 }}
                    transition={spring.press}
                    aria-pressed={selectedTopic === topic}
                    className="cx-chip"
                  >
                    {TOPIC_META[topic].label}
                  </m.button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <span className="type-eyebrow text-content-subtle">Tier</span>
              <div className="flex flex-wrap gap-2">
                <m.button
                  onClick={() => setSelectedLevel('All')}
                  whileTap={{ scale: 0.95 }}
                  transition={spring.press}
                  aria-pressed={selectedLevel === 'All'}
                  className="cx-chip"
                >
                  All
                </m.button>
                {LEVEL_LIST.map((lvl) => (
                  <m.button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    whileTap={{ scale: 0.95 }}
                    transition={spring.press}
                    aria-pressed={selectedLevel === lvl}
                    className="cx-chip"
                  >
                    {lvl}
                  </m.button>
                ))}
              </div>
            </div>
          </section>

          <p className="text-[12.5px] tracking-[0.04em] text-content-subtle">
            {filteredProblems.length} {filteredProblems.length === 1 ? 'problem' : 'problems'}
            {' · '}
            {completedProblems.length === 0 ? 'none solved yet' : `${completedProblems.length} solved`}
          </p>

          {filteredProblems.length === 0 ? (
            <div className="cx-card-pending px-8 py-13 text-center">
              <AlertCircle className="mx-auto h-5.5 w-5.5 text-content-subtle" />
              <p className="mt-4 font-serif text-[24px]">Nothing matches those filters</p>
              <p className="type-caption mx-auto mt-2 max-w-[38ch] leading-[1.75] text-content-subtle">
                Widen the topic or the tier and the list fills again.
              </p>
            </div>
          ) : (
            /*
              A ruled list, not a card grid.

              Each problem is a row on a hairline, numbered in the display face
              down the left margin — a contents page. The grid used to be three
              cards across, which made a catalogue of thirty-seven items into
              thirteen rows of boxes that could only be compared by reading each
              one; ruled rows put the number, the title, the domain and the
              value on four fixed columns you can run an eye down.

              Keyed on the active filters, so changing a filter replays the
              stagger. That is deliberate: the list re-populating is the only
              confirmation the filter did anything, and without it a filter that
              happens to match a similar number of problems looks like nothing
              happened at all.
            */
            <section key={`${selectedTopic}-${selectedLevel}`} className="border-t border-line">
              {filteredProblems.map((prob, index) => {
                const isCompleted = completedProblems.includes(prob.id);
                const topic = TOPIC_META[prob.topic];
                return (
                  <StaggerItem key={prob.id} index={index}>
                    <button
                      onClick={() => handleSelectProblem(prob)}
                      className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-5.5 border-b border-line-faint px-1.5 py-5 text-left transition-colors duration-160 ease-standard hover:bg-content/3 cursor-pointer"
                    >
                      <span className="font-serif text-[26px] text-content-subtle tnum">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate font-serif text-[22px] text-content">{prob.title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="cx-tag" style={topic.vars}>{topic.label}</span>
                          <span className="cx-tag cx-tag-neutral">{prob.level}</span>
                          <span className="text-[12.5px] text-content-subtle">{LEVEL_META[prob.level].scope}</span>
                        </span>
                      </span>

                      <span className="flex items-center gap-4">
                        {isCompleted ? (
                          <span className="flex items-center gap-1.5 text-[12.5px] text-proof">
                            <CheckCircle className="h-3.5 w-3.5 shrink-0" /> Solved
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-content-subtle tnum">{prob.points} pts</span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-accent transition-transform duration-160 ease-standard group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </StaggerItem>
                );
              })}
            </section>
          )}
        </m.div>
      ) : (
        <m.div
          key="problem-workspace"
          initial={{ opacity: 0, y: travel.md, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: travel.sm, scale: 0.99, transition: { duration: duration.instant, ease: ease.exit } }}
          transition={spring.smooth}
          className="max-w-4xl mx-auto space-y-6 pb-16"
        >
          {/*
            The back control nudges left on hover, pointing at where it goes.
          */}
          <m.button
            onClick={handleCloseWorkspace}
            whileHover={{ x: -travel.xs / 2 }}
            whileTap={{ scale: 0.96 }}
            transition={spring.press}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-[color,box-shadow] duration-160 ease-standard text-xs font-bold cursor-pointer border border-stone-200 bg-surface-raised px-3.5 py-2 rounded-control hover:shadow-e1 self-start"
          >
            <ArrowLeft className="w-4 h-4" /> Back to problem list
          </m.button>

          <div className="bg-surface-raised border border-stone-100 rounded-panel shadow-e3 overflow-hidden">
            <div className="ramp-static bg-ink-950 text-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-800">
              <div className="space-y-1">
                <div className="flex gap-2 items-center">
                  <span className="cx-tag cx-tag-accent">{activeProblem.level}</span>
                  <span className="text-[11px] text-stone-300 font-bold uppercase tracking-wider">{TOPIC_META[activeProblem.topic].label}</span>
                </div>
                <h2 className="text-base md:text-lg font-bold tracking-tight mt-1.5 font-serif">{activeProblem.title}</h2>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-stone-400 block font-medium">Reward</span>
                <span className="text-sm font-semibold text-azure-400 tracking-wide block">+{activeProblem.points} pts</span>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="p-5 cx-card border border-stone-150">
                <MathText text={activeProblem.question} as="div" className="text-sm md:text-base text-stone-800 leading-relaxed font-semibold" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="font-bold text-xs text-stone-500 uppercase tracking-wider">Submit your answer</h4>

                  <form onSubmit={handleSubmitAnswer} className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <input
                        id="field-user-answer"
                        type="text"
                        placeholder="Enter your answer..."
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        disabled={evaluating || completedProblems.includes(activeProblem.id)}
                        className="flex-1 border border-stone-200 focus:border-stone-900 rounded-control px-4 py-3 text-sm font-bold outline-hidden transition-[border-color,opacity] duration-160 ease-standard text-stone-800 bg-stone-50/50 disabled:opacity-55 disabled:cursor-not-allowed"
                      />
                      <m.button
                        id="btn-submit-answer"
                        type="submit"
                        disabled={evaluating || !answerInput.trim() || completedProblems.includes(activeProblem.id)}
                        whileTap={{ scale: 0.95 }}
                        transition={spring.press}
                        className="bg-content hover:bg-content-muted text-surface-raised font-bold text-xs px-5 py-3 h-11 rounded-control transition-[background-color,opacity] duration-160 ease-standard shadow-e2 disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {/*
                          Grading is the one genuinely slow action in the app.
                          Crossfading the label keeps the button the same object
                          throughout instead of blinking between two states.
                        */}
                        <AnimatePresence mode="wait" initial={false}>
                          {evaluating ? (
                            <m.span
                              key="grading"
                              className="flex items-center gap-1"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: duration.instant, ease: ease.standard }}
                            >
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Grading...
                            </m.span>
                          ) : (
                            <m.span
                              key="submit"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: duration.instant, ease: ease.standard }}
                            >
                              Submit answer
                            </m.span>
                          )}
                        </AnimatePresence>
                      </m.button>
                    </div>

                    <div className="flex gap-2">
                      <m.button
                        id="btn-show-hint"
                        type="button"
                        onClick={() => setShowHint(!showHint)}
                        whileTap={{ scale: 0.95 }}
                        transition={spring.press}
                        className="text-xs bg-stone-100 hover:bg-stone-200/80 text-stone-700 px-4 py-2 rounded-lg border border-stone-200 transition-colors duration-160 ease-standard cursor-pointer flex items-center gap-1.5"
                      >
                        <HelpCircle className="w-4 h-4 text-stone-500" />
                        {showHint ? 'Hide hint' : 'Show hint'}
                      </m.button>

                      <m.button
                        type="button"
                        onClick={() => setShowFullSolution(!showFullSolution)}
                        whileTap={{ scale: 0.95 }}
                        transition={spring.press}
                        className="text-xs bg-azure-50 hover:bg-azure-100 text-azure-700 px-4 py-2 rounded-lg border border-azure-100 transition-colors duration-160 ease-standard cursor-pointer flex items-center gap-1.5 font-semibold"
                      >
                        <BookOpenCheck className="w-4 h-4 text-azure-600" />
                        View full solution
                      </m.button>
                    </div>

                    <Collapse open={showHint}>
                      <div className="p-4.5 bg-amber-50/60 border border-amber-200 rounded-control text-xs text-amber-800 leading-relaxed font-medium">
                        <strong>Hint:</strong> <MathText text={activeProblem.hint} />
                      </div>
                    </Collapse>
                  </form>
                </div>

                <div className="lg:col-span-5 cx-card p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] uppercase font-semibold text-azure-700 bg-azure-50 border border-azure-100 px-2 py-0.5 rounded-md">EduReach AI Feed</span>
                    <span className="text-[11px] text-stone-400 font-bold">Automatic feedback</span>
                  </div>

                  {/*
                    The verdict is the emotional peak of the whole product —
                    the moment the learner finds out whether they were right.
                    It gets the most expressive motion here, and it is the only
                    place bounce is used at any strength: the icon lands with a
                    spring, then the explanation and next step follow it in.
                    Everything else on this screen is deliberately quieter so
                    this reads as the answer.
                  */}
                  <AnimatePresence mode="wait" initial={false}>
                  {smartFeedback ? (
                    <m.div
                      key={`verdict-${smartFeedback.correct}`}
                      initial={{ opacity: 0, y: travel.sm }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: duration.instant, ease: ease.exit } }}
                      transition={spring.smooth}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <m.div
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.45 }}
                          className="shrink-0"
                        >
                          {smartFeedback.correct ? (
                            <div className="bg-proof-50 dark:bg-proof-950/60 text-proof-700 dark:text-proof-300 border border-proof-200 p-2.5 rounded-card flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4.5 h-4.5 text-proof-500 animate-bounce" />
                                <span className="font-bold text-xs uppercase tracking-wider text-proof-700 dark:text-proof-200">Correct! Solution Unlocked</span>
                              </div>
                              <span className="cx-tag cx-tag-accent text-[10px] tracking-wider animate-pulse">+{activeProblem.points} PTS</span>
                            </div>
                          ) : (
                            <div className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 p-1.5 rounded-full flex items-center justify-center"><AlertCircle className="w-4 h-4" /></div>
                          )}
                        </m.div>
                        <m.span
                          initial={{ opacity: 0, x: -travel.xs }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...spring.snappy, delay: 0.06 }}
                          className={`text-xs font-bold uppercase tracking-wider ${smartFeedback.correct ? 'text-proof-700' : 'text-rose-700'}`}
                        >
                          {smartFeedback.correct ? 'Correct' : 'Not quite'}
                        </m.span>
                      </div>

                      <m.div
                        initial={{ opacity: 0, y: travel.xs }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring.smooth, delay: 0.1 }}
                        className="space-y-2"
                      >
                        <p className="text-stone-850 text-xs leading-relaxed font-semibold italic">&ldquo;{smartFeedback.explanation}&rdquo;</p>
                        <p className="text-stone-600 text-[12px] leading-relaxed border-t border-stone-200 pt-2 font-medium">
                          <strong>Next step:</strong> {smartFeedback.guidance}
                        </p>
                      </m.div>
                    </m.div>
                  ) : (
                    <m.div
                      key="verdict-idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: duration.instant, ease: ease.exit } }}
                      transition={{ duration: duration.base, ease: ease.standard }}
                      className="text-center py-6 text-stone-400 text-xs space-y-1"
                    >
                      <Sparkles ref={idleSparkleRef} className="w-5 h-5 text-stone-300 mx-auto animate-pulse" />
                      <p className="font-semibold">Waiting for your answer</p>
                      <p className="text-[11px]">Submit an answer to get AI-guided feedback.</p>
                    </m.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>

              {/*
                The worked solution is a large dark panel appearing at the
                bottom of a light card. Dropping it in fully formed shifts the
                page under the reader; expanding it keeps the scroll position
                honest and reads as the card opening up.
              */}
              <Collapse open={showFullSolution}>
                <div className="border-t border-stone-100 pt-6 space-y-4">
                  <div className="flex items-center gap-2 text-violet-800">
                    <Award className="w-5 h-5 text-violet-600" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider">Full Solution</h3>
                  </div>

                  <div className="ramp-static p-5 md:p-6 bg-ink-950 text-stone-100 rounded-card border border-ink-850 shadow-inset-well leading-relaxed text-sm space-y-3.5">
                    <MathText text={activeProblem.solution} as="div" className="font-medium text-stone-300" />
                    <div className="pt-2 bg-ink-850 p-3 rounded-control border border-ink-800 text-xs text-violet-300 font-medium">
                      What did this solution teach you? Save the key idea to your personal notebook to build the habit of dissecting structure.
                    </div>
                  </div>
                </div>
              </Collapse>
            </div>
          </div>
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
}
