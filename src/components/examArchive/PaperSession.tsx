import { useEffect, type RefObject } from 'react';
import { m } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Flag } from 'lucide-react';
import MathText from '../MathText';
import {
  ARCHIVE_SOURCES, archiveTally, isArchiveAttempted, proofMarkKey, readProofMark,
  type ArchivePaper, type ArchiveQuestion, type ProofMark,
} from '../../domain/examArchive';
import type { ArchiveProgress } from '../../services/data/examArchiveProgress';
import { duration, ease } from '../../lib/motion';
import ArchiveProse, { displayMath } from './ArchiveProse';
import ProofPad, { MARK_LABEL } from './ProofPad';
import { FAMILY_SLUG } from './archiveModel';

type Change = (previous: ArchiveProgress) => ArchiveProgress;

function ChoiceResponse({ question, value, onChange }: { question: ArchiveQuestion; value: string; onChange: (value: string) => void }) {
  const options = question.options ?? [];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
        || (target instanceof HTMLInputElement && target.type !== 'radio'))) return;
      const index = 'abcde'.indexOf(event.key.toLowerCase());
      if (index < 0 || index >= options.length) return;
      event.preventDefault();
      onChange(String(index));
      document.getElementById(`xa-choice-${question.id}-${index}`)?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question.id, options.length, onChange]);
  return <fieldset className="xa-choices">
    <legend className="sr-only">Choose one answer</legend>
    {options.map((option, index) => {
      const selected = value === String(index);
      return <label key={index} className={selected ? 'xa-choice is-selected' : 'xa-choice'}>
        <input id={`xa-choice-${question.id}-${index}`} type="radio" name={`xa-${question.id}`} checked={selected} onChange={() => onChange(String(index))} />
        <span className="xa-choice-letter">{'ABCDE'[index]}</span>
        <span className="xa-choice-text"><MathText text={displayMath(option)} /></span>
        <Check className="xa-choice-check" size={18} aria-hidden="true" />
      </label>;
    })}
    <p className="xa-hint">Press A to E to choose{value ? <> · <button type="button" className="xa-link" onClick={() => onChange('')}>Clear my answer</button></> : null}</p>
  </fieldset>;
}

function DigitsResponse({ question, value, onChange }: { question: ArchiveQuestion; value: string; onChange: (value: string) => void }) {
  const id = `xa-digits-${question.id}`;
  const next = value.length < 3 ? value.length : -1;
  return <div className="xa-digits">
    <label htmlFor={id} className="xa-label">Your answer</label>
    <div className="xa-digits-box">
      <input id={id} className="xa-digits-input" inputMode="numeric" autoComplete="off" maxLength={3} pattern="[0-9]*"
        value={value} onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby={`${id}-hint`} />
      <span className="xa-digits-cells" aria-hidden="true">
        {[0, 1, 2].map(cell => <span key={cell} className={cell === next ? 'is-next' : value[cell] !== undefined ? 'is-filled' : undefined}>{value[cell] ?? ''}</span>)}
      </span>
    </div>
    <p className="xa-hint" id={`${id}-hint`}>A whole number from 000 to 999; leading zeros are optional.{value ? <> · <button type="button" className="xa-link" onClick={() => onChange('')}>Clear</button></> : null}</p>
  </div>;
}

function railState(question: ArchiveQuestion, answers: Record<string, string>): string {
  if (question.kind === 'proof') {
    const mark = readProofMark(answers, question.id);
    if (mark) return mark;
  }
  return isArchiveAttempted(question, answers) ? 'answered' : 'open';
}

const RAIL_TEXT: Record<string, string> = { open: 'not answered', answered: 'answered', solved: MARK_LABEL.solved, partial: MARK_LABEL.partial, stuck: MARK_LABEL.stuck };

type SessionProps = {
  paper: ArchivePaper;
  questions: ArchiveQuestion[];
  progress: ArchiveProgress | undefined;
  saveLabel: string;
  signedIn: boolean;
  still: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onUpdate: (change: Change) => void;
  onLeave: () => void;
};

/** The exam desk: one problem at a time on a sheet, the paper's problems in a rail beside it. */
export default function PaperSession({ paper, questions, progress, saveLabel, signedIn, still, headingRef, onUpdate, onLeave }: SessionProps) {
  const answers = progress?.answers ?? {};
  const index = Math.min(Math.max(progress?.currentIndex ?? 0, 0), questions.length - 1);
  const question = questions[index];
  const tally = archiveTally({ questions }, answers);
  const proofs = tally.proofs === tally.total;
  const source = ARCHIVE_SOURCES[paper.source];
  const last = index === questions.length - 1;

  const move = (target: number) => onUpdate(previous => ({ ...previous, currentIndex: Math.max(0, Math.min(target, questions.length - 1)) }));
  const finish = () => onUpdate(previous => ({ ...previous, completedAt: new Date().toISOString() }));
  const setAnswer = (questionId: string, value: string) => onUpdate(previous => {
    const next = { ...previous.answers };
    if (value === '') delete next[questionId]; else next[questionId] = value;
    return { ...previous, saved: true, answers: next };
  });
  const setMark = (questionId: string, mark: ProofMark | null) => setAnswer(proofMarkKey(questionId), mark ?? '');

  return <section className="xa-desk" data-family={FAMILY_SLUG[paper.family]} aria-labelledby="xa-sheet-title">
    <div className="xa-bar">
      <button type="button" className="xa-back" onClick={onLeave}><ArrowLeft size={17} aria-hidden="true" />All papers</button>
      <p className="xa-bar-title"><span className="xa-tag">{paper.family}</span>{paper.title}</p>
      <p className="xa-save" role="status">{saveLabel}</p>
    </div>

    <div className="xa-desk-grid">
      <aside className="xa-desk-side">
        <nav className="xa-rail" aria-label="Problems in this paper">
          <ol>{questions.map((item, itemIndex) => {
            const state = railState(item, answers);
            return <li key={item.id}>
              <button type="button" className={`xa-rail-node is-${state}`} aria-current={itemIndex === index ? 'step' : undefined} onClick={() => move(itemIndex)}>
                {itemIndex === index && <m.span layoutId="xa-rail-current" className="xa-rail-current" transition={still ? { duration: 0 } : { duration: duration.base, ease: ease.standard }} />}
                <span className="xa-rail-label">{item.label}</span>
                <span className="sr-only">, {RAIL_TEXT[state]}</span>
              </button>
            </li>;
          })}</ol>
        </nav>
        <div className="xa-desk-progress">
          <p><strong>{tally.attempted}</strong> of {tally.total} {proofs ? 'attempted' : 'answered'}</p>
          <span className="xa-track" aria-hidden="true"><span style={{ transform: `scaleX(${tally.attempted / Math.max(1, tally.total)})` }} /></span>
        </div>
        <p className="xa-desk-about">{paper.description}</p>
        {!last && <button type="button" className="xa-btn is-quiet xa-desk-finish" onClick={finish}><Flag size={15} aria-hidden="true" />Finish paper</button>}
      </aside>

      <m.article key={question.id} className="xa-sheet" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.base, ease: ease.standard }}>
        <header className="xa-sheet-head">
          <p className="xa-sheet-kicker">{index + 1} of {questions.length}</p>
          <h1 id="xa-sheet-title" ref={headingRef} tabIndex={-1}>Problem {question.label}</h1>
          {(question.topic || question.origin) && <p className="xa-sheet-tags">
            {question.topic && <span className="xa-tag">{question.topic}</span>}
            {question.origin && <span className="xa-tag is-plain">Proposed by {question.origin}</span>}
          </p>}
        </header>
        <ArchiveProse className="xa-statement" text={question.prompt} />
        <div className="xa-response">
          {question.kind === 'choice' && <ChoiceResponse question={question} value={answers[question.id] ?? ''} onChange={value => setAnswer(question.id, value)} />}
          {question.kind === 'numeric' && <DigitsResponse question={question} value={answers[question.id] ?? ''} onChange={value => setAnswer(question.id, value)} />}
          {question.kind === 'proof' && <ProofPad question={question} answers={answers} fallbackUrl={source?.url ?? paper.sourceUrl} signedIn={signedIn}
            onDraft={(questionId, text) => setAnswer(questionId, text.trim() ? text : '')} onMark={setMark} />}
        </div>
        {question.kind !== 'proof' && <p className="xa-hint xa-checked-later">Answers are checked when you finish the paper.</p>}
        <nav className="xa-steps" aria-label="Move through the paper">
          <button type="button" className="xa-btn is-quiet" disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={16} aria-hidden="true" />Previous</button>
          {last
            ? <button type="button" className="xa-btn is-ink" onClick={finish}>Finish paper<Flag size={16} aria-hidden="true" /></button>
            : <button type="button" className="xa-btn is-ink" onClick={() => move(index + 1)}>Next problem<ArrowRight size={16} aria-hidden="true" /></button>}
        </nav>
      </m.article>
    </div>

    <footer className="xa-desk-source">
      {source && <p>From <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {source.license}. {source.rights}.</p>}
      {question.sourceUrl && question.sourceUrl !== source?.url && <a href={question.sourceUrl} target="_blank" rel="noreferrer">This problem at its source ↗</a>}
    </footer>
  </section>;
}
