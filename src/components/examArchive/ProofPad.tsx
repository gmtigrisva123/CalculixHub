import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpen, Eye, PenLine } from 'lucide-react';
import MathText from '../MathText';
import { PROOF_MARKS, readProofMark, type ArchiveQuestion, type ProofMark } from '../../domain/examArchive';
import ArchiveProse from './ArchiveProse';

export const MARK_LABEL: Record<ProofMark, string> = { solved: 'Complete proof', partial: 'Partial progress', stuck: 'Not yet' };

/** Reference solutions, one tab per solution, with the source's own caveats stated plainly. */
export function SolutionView({ question, fallbackUrl }: { question: ArchiveQuestion; fallbackUrl: string }) {
  const [tab, setTab] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const solutions = question.solutions ?? [];
  useEffect(() => { setTab(0); }, [question.id]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (tab + step + solutions.length) % solutions.length;
    setTab(next);
    tabs.current[next]?.focus();
  };
  return <div className="xa-solutions">
    {question.finalAnswer && <p className="xa-final"><span>Answer</span><MathText text={question.finalAnswer} /></p>}
    {question.sketch && <p className="xa-caveat">These are abridged notes: some proof steps were lost when the source was converted. Read them as a guide, not a complete proof.</p>}
    {question.figureOmitted && <p className="xa-caveat">The original solution refers to a figure that is not shown here.</p>}
    {!solutions.length && <p className="xa-caveat">No written solution came with this problem. <a href={question.sourceUrl ?? fallbackUrl} target="_blank" rel="noreferrer">Read it at the source ↗</a></p>}
    {solutions.length > 1 && <div className="xa-tabs" role="tablist" aria-label="Reference solutions">
      {solutions.map((_, index) => <button key={index} type="button" role="tab" id={`${base}-tab-${index}`} aria-controls={`${base}-panel`}
        aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} ref={node => { tabs.current[index] = node; }}
        onClick={() => setTab(index)} onKeyDown={onKey}>Solution {index + 1}</button>)}
    </div>}
    {solutions.length > 0 && <div className="xa-solution" id={`${base}-panel`} role={solutions.length > 1 ? 'tabpanel' : undefined}
      aria-labelledby={solutions.length > 1 ? `${base}-tab-${tab}` : undefined}>
      <ArchiveProse text={solutions[Math.min(tab, solutions.length - 1)]} />
    </div>}
  </div>;
}

type ProofPadProps = {
  question: ArchiveQuestion;
  answers: Record<string, string>;
  fallbackUrl: string;
  signedIn: boolean;
  onDraft: (questionId: string, text: string) => void;
  onMark: (questionId: string, mark: ProofMark | null) => void;
};

/**
 * Where a proof gets written. The draft saves itself shortly after typing stops, and always
 * before the learner moves to another problem. The reference solution is one click away, and
 * once it is open the learner marks their own work: a proof is never machine-marked here.
 */
export default function ProofPad({ question, answers, fallbackUrl, signedIn, onDraft, onMark }: ProofPadProps) {
  const [draft, setDraft] = useState(answers[question.id] ?? '');
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const pending = useRef({ id: question.id, text: draft, saved: draft });
  const ids = useId();
  const mark = readProofMark(answers, question.id);

  const flush = () => {
    const { id, text, saved } = pending.current;
    if (text !== saved) {
      pending.current.saved = text;
      onDraft(id, text);
    }
  };

  // A new problem: save what was typed for the last one, then load this one's draft.
  useEffect(() => {
    const stored = answers[question.id] ?? '';
    pending.current = { id: question.id, text: stored, saved: stored };
    setDraft(stored);
    setPreview(false);
    setOpen(Boolean(readProofMark(answers, question.id)));
    return flush;
  }, [question.id]);

  useEffect(() => {
    pending.current.text = draft;
    if (draft === pending.current.saved) return;
    const timer = window.setTimeout(flush, 700);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useLayoutEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, 220)}px`;
  }, [draft, preview]);

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  return <div className="xa-proof">
    <div className="xa-proof-head">
      <label htmlFor={`${ids}-draft`} className="xa-label">Your proof</label>
      <div className="xa-proof-modes" role="group" aria-label="View">
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><PenLine size={15} aria-hidden="true" />Write</button>
        <button type="button" aria-pressed={preview} onClick={() => { flush(); setPreview(true); }} disabled={!draft.trim()}><Eye size={15} aria-hidden="true" />Preview</button>
      </div>
    </div>
    {preview
      ? <div className="xa-proof-preview"><ArchiveProse text={draft} /></div>
      : <textarea id={`${ids}-draft`} ref={area} className="xa-proof-area" value={draft} spellCheck
        onChange={event => setDraft(event.target.value)} onBlur={flush} aria-describedby={`${ids}-hint`}
        placeholder="Write your argument here. Use $…$ for math, for example $a^2 + b^2 \ge 2ab$." />}
    <p className="xa-hint" id={`${ids}-hint`}>{words ? `${words} ${words === 1 ? 'word' : 'words'} · ` : ''}{signedIn ? 'Saves to your account as you write.' : 'Saves on this device as you write.'}</p>

    {!open
      ? <div className="xa-reveal">
        <p>{draft.trim() ? 'When you are ready, compare your proof with a reference solution.' : 'Give it a real attempt first. The reference solution will be here.'}</p>
        <button type="button" className="xa-btn is-quiet" onClick={() => { flush(); setOpen(true); }}><BookOpen size={16} aria-hidden="true" />Show the reference solution</button>
      </div>
      : <>
        <SolutionView question={question} fallbackUrl={fallbackUrl} />
        <div className="xa-marks" role="group" aria-labelledby={`${ids}-marks`}>
          <p id={`${ids}-marks`} className="xa-label">How did your proof hold up?</p>
          <div>{PROOF_MARKS.map(value => <button key={value} type="button" data-mark={value} aria-pressed={mark === value}
            onClick={() => { flush(); onMark(question.id, mark === value ? null : value); }}>{MARK_LABEL[value]}</button>)}</div>
        </div>
      </>}
  </div>;
}
