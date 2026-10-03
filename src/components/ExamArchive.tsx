import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, RotateCcw } from 'lucide-react';
import MathText from './MathText';
import { EXAM_COLLECTIONS, archiveScore, isArchiveAnswerCorrect, type ExamCollection } from '../domain/examArchive';
import {
  emptyArchiveProgress, loadAccountArchiveProgress, queueAccountArchiveSave,
  readArchiveProgress, writeArchiveProgress, type ArchiveProgress, type ArchiveProgressMap,
} from '../services/data/examArchiveProgress';
import '../styles/exam-archive.css';

type Family = 'All' | ExamCollection['family'];
type SaveState = 'ready' | 'saving' | 'synced' | 'local' | 'failed';

export default function ExamArchive({ userId }: { userId: string | null }) {
  const [progress, setProgress] = useState<ArchiveProgressMap>(() => readArchiveProgress(userId));
  const progressRef = useRef(progress);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [family, setFamily] = useState<Family>('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const questionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const local = readArchiveProgress(userId);
    progressRef.current = local;
    setProgress(local);
    setActiveId(null);
    setSaveState('ready');
    if (!userId) return;
    let live = true;
    const reconcile = async () => {
      try {
        const remote = await loadAccountArchiveProgress(userId);
        if (!live) return;
        const current = progressRef.current;
        const merged: ArchiveProgressMap = { ...current };
        for (const [id, row] of Object.entries(remote)) {
          if (!merged[id] || row.updatedAt > merged[id].updatedAt) merged[id] = row;
        }
        progressRef.current = merged;
        setProgress(merged);
        writeArchiveProgress(userId, merged);
        const uploads = Object.entries(merged).filter(([id, row]) => !remote[id] || row.updatedAt > remote[id].updatedAt);
        if (uploads.length) {
          setSaveState('saving');
          await Promise.all(uploads.map(([id, row]) => queueAccountArchiveSave(userId, id, row)));
        }
        if (live && progressRef.current === merged) setSaveState('synced');
      } catch {
        if (live) setSaveState('local');
      }
    };
    void reconcile();
    const online = () => void reconcile();
    window.addEventListener('online', online);
    return () => { live = false; window.removeEventListener('online', online); };
  }, [userId]);

  const update = (collectionId: string, change: (previous: ArchiveProgress) => ArchiveProgress) => {
    const previous = progressRef.current[collectionId] ?? emptyArchiveProgress();
    const nextTimestamp = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    const nextRecord = { ...change(previous), updatedAt: nextTimestamp };
    const next = { ...progressRef.current, [collectionId]: nextRecord };
    progressRef.current = next;
    setProgress(next);
    if (!writeArchiveProgress(userId, next)) {
      setSaveState('failed');
      return;
    }
    if (!userId) { setSaveState('local'); return; }
    setSaveState('saving');
    void queueAccountArchiveSave(userId, collectionId, nextRecord).then(() => {
      if (progressRef.current[collectionId]?.updatedAt === nextRecord.updatedAt) setSaveState('synced');
    }).catch(() => setSaveState('local'));
  };

  const active = EXAM_COLLECTIONS.find(collection => collection.id === activeId);
  const activeProgress = active ? progress[active.id] : undefined;
  const index = active ? Math.min(Math.max(activeProgress?.currentIndex ?? 0, 0), active.questions.length - 1) : 0;
  const question = active?.questions[index];
  const answered = active ? active.questions.filter(item => (activeProgress?.answers[item.id] ?? '').trim() !== '').length : 0;
  const visible = EXAM_COLLECTIONS.filter(collection =>
    (family === 'All' || family === collection.family) && (!savedOnly || progress[collection.id]?.saved));

  useEffect(() => { if (active) questionHeading.current?.focus(); }, [activeId, index, Boolean(activeProgress?.completedAt)]);

  const openCollection = (collection: ExamCollection) => {
    if (!progressRef.current[collection.id]) update(collection.id, previous => previous);
    else if (!progressRef.current[collection.id].saved) update(collection.id, previous => ({ ...previous, saved: true }));
    setActiveId(collection.id);
  };

  const saveLabel = saveState === 'failed' ? 'Could not save on this device' :
    saveState === 'saving' ? 'Saving…' : saveState === 'synced' ? 'Saved to your account' :
      saveState === 'local' ? (userId ? 'Saved here · account sync pending' : 'Saved on this device') :
        'Your answers save as you go';

  if (!active || !question) return <section className="exam-archive" aria-label="International exam archive">
    <header className="exam-archive-header">
      <span className="exam-archive-eyebrow">International exam archive</span>
      <h1>Choose a paper. Pick up where you left off.</h1>
      <p>Work through one question at a time. Your answers and place in each paper save automatically.</p>
    </header>
    <div className="exam-archive-controls" aria-label="Filter exam papers">
      <div className="exam-archive-families">{(['All', 'AMC 12', 'AIME', 'USAMO', 'IMO'] as Family[]).map(value =>
        <button key={value} type="button" aria-pressed={family === value} onClick={() => setFamily(value)}>{value}</button>)}</div>
      <button className="exam-archive-saved-filter" type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>
        <Bookmark size={16} /> Saved for later
      </button>
    </div>
    <p className="exam-archive-save-state" role="status">{saveLabel}</p>
    <div className="exam-archive-grid">{visible.map(collection => {
      const state = progress[collection.id];
      const count = collection.questions.length;
      const completed = state?.completedAt != null;
      const done = collection.questions.filter(item => (state?.answers[item.id] ?? '').trim() !== '').length;
      return <article className="exam-archive-card" key={collection.id}>
        <div className="exam-archive-card-top"><span>{collection.family}</span><span>{count} questions</span></div>
        <h2>{collection.title}</h2>
        <p>{collection.description}</p>
        <div className="exam-archive-card-progress"><span>{completed ? `Finished · ${archiveScore(collection, state.answers)}/${count} correct` : `${done}/${count} answered`}</span><span>{Math.round(done / count * 100)}%</span><div className="exam-archive-track" role="progressbar" aria-label={`${collection.title} questions answered`} aria-valuenow={done} aria-valuemin={0} aria-valuemax={count}><span style={{ width: `${done / count * 100}%` }} /></div></div>
        <div className="exam-archive-card-actions">
          <button className="exam-archive-open" type="button" onClick={() => openCollection(collection)}>{completed ? 'View result' : done ? 'Continue paper' : 'Start paper'} <ArrowRight size={17} /></button>
          <button className="exam-archive-bookmark" type="button" aria-label={`${state?.saved ? 'Remove saved paper' : 'Save paper for later'}: ${collection.title}`} aria-pressed={Boolean(state?.saved)} onClick={() => {
            const saved = Boolean(progressRef.current[collection.id]?.saved);
            update(collection.id, previous => ({ ...previous, saved: !saved }));
          }}>{state?.saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}</button>
        </div>
      </article>;
    })}</div>
    {!visible.length && <p className="exam-archive-empty">No saved papers in this view yet.</p>}
    <p className="exam-archive-footnote">Papers include problems that work without missing diagrams. USAMO and IMO groups contain selected result questions adapted for answers you can check here.</p>
  </section>;

  if (activeProgress?.completedAt) {
    const score = archiveScore(active, activeProgress.answers);
    return <section className="exam-archive exam-archive-session">
      <button className="exam-archive-back" type="button" onClick={() => setActiveId(null)}><ArrowLeft size={17} /> All papers</button>
      <div className="exam-archive-result">
        <span className="exam-archive-eyebrow">Paper complete · {active.title}</span>
        <h1 ref={questionHeading} tabIndex={-1}>{score} of {active.questions.length} correct</h1>
        <p>Your answers are saved. You can review the paper or start a fresh attempt.</p>
        <div className="exam-archive-result-actions"><button type="button" onClick={() => update(active.id, previous => ({ ...previous, answers: {}, currentIndex: 0, completedAt: null, saved: true }))}><RotateCcw size={16} /> Try again</button><button type="button" onClick={() => setActiveId(null)}>Back to archive</button></div>
        <div className="exam-archive-review">{active.questions.map((item, position) => <details key={item.id}>
          <summary><span>Question {position + 1}</span><strong>{isArchiveAnswerCorrect(item, activeProgress.answers[item.id]) ? 'Correct' : 'Incorrect or unanswered'}</strong></summary>
          <p><MathText text={item.prompt} /></p>
          <p>Your answer: {activeProgress.answers[item.id] === undefined || activeProgress.answers[item.id] === '' ? 'No answer' : item.kind === 'choice' ? <MathText text={item.options?.[Number(activeProgress.answers[item.id])] ?? 'No answer'} /> : activeProgress.answers[item.id]}</p>
          <p>Correct answer: {item.kind === 'choice' ? <MathText text={item.options?.[item.answerIndex ?? 0] ?? ''} /> : item.answer}</p>
        </details>)}</div>
      </div>
    </section>;
  }

  const answer = activeProgress?.answers[question.id] ?? '';
  const saveAnswer = (value: string) => update(active.id, previous => ({ ...previous, saved: true, answers: { ...previous.answers, [question.id]: value } }));
  const move = (nextIndex: number) => update(active.id, previous => ({ ...previous, currentIndex: Math.max(0, Math.min(nextIndex, active.questions.length - 1)) }));
  return <section className="exam-archive exam-archive-session">
    <div className="exam-archive-session-top"><button className="exam-archive-back" type="button" onClick={() => setActiveId(null)}><ArrowLeft size={17} /> Save & leave</button><span role="status">{saveLabel}</span></div>
    <div className="exam-archive-paper">
      <header><span className="exam-archive-eyebrow">{active.title}</span><h1 ref={questionHeading} tabIndex={-1}>Question {index + 1} <span>of {active.questions.length}</span></h1><p>Original problem {question.number} · {answered} answered</p></header>
      <div className="exam-archive-track" role="progressbar" aria-label="Questions answered" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={active.questions.length}><span style={{ width: `${answered / active.questions.length * 100}%` }} /></div>
      <div className="exam-archive-prompt"><MathText text={question.prompt} /></div>
      {question.kind === 'choice' ? <fieldset className="exam-archive-options"><legend className="sr-only">Choose one answer</legend>{question.options?.map((option, optionIndex) => <label key={optionIndex} className={answer === String(optionIndex) ? 'is-selected' : ''}>
        <input type="radio" name={`archive-${question.id}`} checked={answer === String(optionIndex)} onChange={() => saveAnswer(String(optionIndex))} />
        <span className="exam-archive-option-letter">{String.fromCharCode(65 + optionIndex)}</span><MathText text={option} />{answer === String(optionIndex) && <Check size={18} />}
      </label>)}</fieldset> : <div className="exam-archive-numeric"><label htmlFor="exam-archive-answer">Your answer</label><input id="exam-archive-answer" type="text" inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} autoComplete="off" value={answer} onChange={event => saveAnswer(event.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="000–999" /><p>Enter a whole number from 0 to 999.</p></div>}
      <nav className="exam-archive-step-controls" aria-label="Paper navigation"><button type="button" disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={17} /> Previous</button>{index === active.questions.length - 1 ? <button className="exam-archive-primary" type="button" onClick={() => update(active.id, previous => ({ ...previous, completedAt: new Date().toISOString() }))}>Finish paper <Check size={17} /></button> : <button className="exam-archive-primary" type="button" onClick={() => move(index + 1)}>Next question <ArrowRight size={17} /></button>}</nav>
    </div>
    <div className="exam-archive-paper-footer"><span>Answers are checked when you finish.</span><a href={question.sourceUrl ?? active.sourceUrl} target="_blank" rel="noreferrer">Dataset source ↗</a></div>
  </section>;
}
