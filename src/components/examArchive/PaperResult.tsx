import { useState, type RefObject } from 'react';
import { ArrowLeft, Check, Minus, RotateCcw, X } from 'lucide-react';
import MathText from '../MathText';
import AnimatedNumber from '../motion/AnimatedNumber';
import {
  ARCHIVE_SOURCES, archiveTally, isArchiveAnswerCorrect, readProofMark,
  type ArchivePaper, type ArchiveQuestion,
} from '../../domain/examArchive';
import type { ArchiveProgress } from '../../services/data/examArchiveProgress';
import ArchiveProse, { displayMath } from './ArchiveProse';
import PaperCover from './PaperCover';
import { MARK_LABEL, SolutionView } from './ProofPad';
import { FAMILY_SLUG } from './archiveModel';

type Outcome = 'right' | 'wrong' | 'blank' | 'solved' | 'partial' | 'stuck' | 'unmarked';

function outcomeOf(question: ArchiveQuestion, answers: Record<string, string>): Outcome {
  if (question.kind === 'proof') return readProofMark(answers, question.id) ?? 'unmarked';
  const answer = answers[question.id];
  if (answer === undefined || answer.trim() === '') return 'blank';
  return isArchiveAnswerCorrect(question, answer) ? 'right' : 'wrong';
}

const OUTCOME_TEXT: Record<Outcome, string> = {
  right: 'Correct', wrong: 'Incorrect', blank: 'No answer',
  solved: MARK_LABEL.solved, partial: MARK_LABEL.partial, stuck: MARK_LABEL.stuck, unmarked: 'Not reviewed',
};

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  if (outcome === 'right' || outcome === 'solved') return <Check size={14} aria-hidden="true" />;
  if (outcome === 'wrong' || outcome === 'stuck') return <X size={14} aria-hidden="true" />;
  return <Minus size={14} aria-hidden="true" />;
}

function choiceText(question: ArchiveQuestion, value: string | undefined) {
  if (value === undefined || value === '') return <span className="xa-muted">No answer</span>;
  const index = Number(value);
  return <><strong>({'ABCDE'[index]})</strong> <MathText text={displayMath(question.options?.[index] ?? '')} /></>;
}

type ResultProps = {
  paper: ArchivePaper;
  questions: ArchiveQuestion[];
  progress: ArchiveProgress;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onLeave: () => void;
};

/** A finished paper: the score, the paper's constellation as the learner left it, and a full review. */
export default function PaperResult({ paper, questions, progress, headingRef, onRetry, onLeave }: ResultProps) {
  const answers = progress.answers;
  const tally = archiveTally({ questions }, answers);
  const proofs = tally.proofs === tally.total;
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const source = ARCHIVE_SOURCES[paper.source];
  const reveal = (id: string) => {
    setOpen(previous => new Set(previous).add(id));
    requestAnimationFrame(() => document.getElementById(`xa-review-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  return <section className="xa-result" data-family={FAMILY_SLUG[paper.family]} aria-labelledby="xa-result-title">
    <div className="xa-bar">
      <button type="button" className="xa-back" onClick={onLeave}><ArrowLeft size={17} aria-hidden="true" />All papers</button>
      <p className="xa-bar-title"><span className="xa-tag">{paper.family}</span>{paper.title}</p>
    </div>

    <div className="xa-result-hero">
      <div className="xa-result-sky">
        <PaperCover paper={paper} answers={answers} className="is-result" />
      </div>
      <div className="xa-result-copy">
        <p className="xa-result-kicker">Paper finished</p>
        {proofs
          ? <h1 id="xa-result-title" ref={headingRef} tabIndex={-1}>
            {tally.solved || tally.partial
              ? <><AnimatedNumber value={tally.solved} /> {tally.solved === 1 ? 'proof' : 'proofs'} complete{tally.partial ? <>, <AnimatedNumber value={tally.partial} /> partly</> : null}</>
              : 'Your proofs are saved'}
          </h1>
          : <h1 id="xa-result-title" ref={headingRef} tabIndex={-1}><AnimatedNumber value={tally.correct} /> of {tally.checkable} correct</h1>}
        <p>{proofs
          ? 'These marks are your own, made against the reference solutions. Open any problem below to read your proof beside them.'
          : 'Your answers are saved with the paper. Each gold star is a problem you got right.'}</p>
        <div className="xa-result-actions">
          <button type="button" className="xa-btn is-ink" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />Start the paper again</button>
          <button type="button" className="xa-btn is-quiet" onClick={onLeave}>Back to all papers</button>
        </div>
      </div>
    </div>

    <ol className="xa-result-strip" aria-label="Problems">
      {questions.map(question => {
        const outcome = outcomeOf(question, answers);
        return <li key={question.id}>
          <button type="button" className={`xa-outcome is-${outcome}`} onClick={() => reveal(question.id)} aria-label={`Problem ${question.label}: ${OUTCOME_TEXT[outcome]}. Review`}>
            <span>{question.label}</span><OutcomeIcon outcome={outcome} />
          </button>
        </li>;
      })}
    </ol>

    <div className="xa-review">
      {questions.map(question => {
        const outcome = outcomeOf(question, answers);
        return <details key={question.id} id={`xa-review-${question.id}`} open={open.has(question.id)}
          onToggle={event => {
            const isOpen = (event.currentTarget as HTMLDetailsElement).open;
            setOpen(previous => {
              if (previous.has(question.id) === isOpen) return previous;
              const next = new Set(previous);
              if (isOpen) next.add(question.id); else next.delete(question.id);
              return next;
            });
          }}>
          <summary><span>Problem {question.label}</span><strong className={`is-${outcome}`}><OutcomeIcon outcome={outcome} />{OUTCOME_TEXT[outcome]}</strong></summary>
          <div className="xa-review-body">
            <ArchiveProse className="xa-statement is-small" text={question.prompt} />
            {question.kind === 'choice' && <dl>
              <div><dt>Your answer</dt><dd>{choiceText(question, answers[question.id])}</dd></div>
              <div><dt>Correct answer</dt><dd>{choiceText(question, String(question.answerIndex))}</dd></div>
            </dl>}
            {question.kind === 'numeric' && <dl>
              <div><dt>Your answer</dt><dd>{answers[question.id] ? <strong>{answers[question.id]}</strong> : <span className="xa-muted">No answer</span>}</dd></div>
              <div><dt>Correct answer</dt><dd><strong>{question.answer}</strong></dd></div>
            </dl>}
            {question.kind === 'proof' && <>
              <h3>Your proof</h3>
              {answers[question.id] ? <div className="xa-proof-preview"><ArchiveProse text={answers[question.id]} /></div> : <p className="xa-muted">No proof written.</p>}
              <h3>Reference</h3>
              <SolutionView question={question} fallbackUrl={source?.url ?? paper.sourceUrl} />
            </>}
          </div>
        </details>;
      })}
    </div>
  </section>;
}
