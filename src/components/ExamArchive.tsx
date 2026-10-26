/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import {
  ARCHIVE_PAPERS, findArchivePaper, loadArchivePaper,
  type ArchiveFamily, type ArchivePaper, type ArchiveQuestion,
} from '../domain/examArchive';
import {
  emptyArchiveProgress, loadAccountArchiveProgress, queueAccountArchiveSave,
  readArchiveProgress, writeArchiveProgress, type ArchiveProgress, type ArchiveProgressMap,
} from '../services/data/examArchiveProgress';
import { duration, ease } from '../lib/motion';
import ArchiveHero from './examArchive/ArchiveHero';
import PaperLibrary from './examArchive/PaperLibrary';
import PaperSession from './examArchive/PaperSession';
import PaperResult from './examArchive/PaperResult';
import { papersInProgress, type SortOrder, type StatusFilter } from './examArchive/archiveModel';
import '../styles/exam-archive.css';

type SaveState = 'ready' | 'saving' | 'synced' | 'local' | 'failed';

export default function ExamArchive({ userId }: { userId: string | null }) {
  const [progress, setProgress] = useState<ArchiveProgressMap>(() => readArchiveProgress(userId));
  const progressRef = useRef(progress);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [family, setFamily] = useState<ArchiveFamily | 'All'>('All');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [paper, setPaper] = useState<{ id: string; questions: ArchiveQuestion[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [undo, setUndo] = useState<{ id: string; snapshot: ArchiveProgress } | null>(null);
  const reduce = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLElement>(null);
  const libraryHeading = useRef<HTMLHeadingElement>(null);
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<{ id: string; scroll: number; opener: HTMLElement | null } | null>(null);

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

  const update = (paperId: string, change: (previous: ArchiveProgress) => ArchiveProgress) => {
    const previous = progressRef.current[paperId] ?? emptyArchiveProgress();
    const nextTimestamp = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    const nextRecord = { ...change(previous), updatedAt: nextTimestamp };
    const next = { ...progressRef.current, [paperId]: nextRecord };
    progressRef.current = next;
    setProgress(next);
    if (!writeArchiveProgress(userId, next)) {
      setSaveState('failed');
      return;
    }
    if (!userId) { setSaveState('local'); return; }
    setSaveState('saving');
    void queueAccountArchiveSave(userId, paperId, nextRecord).then(() => {
      if (progressRef.current[paperId]?.updatedAt === nextRecord.updatedAt) setSaveState('synced');
    }).catch(() => setSaveState('local'));
  };

  const active = findArchivePaper(activeId);
  const activeProgress = active ? progress[active.id] : undefined;
  const questions = paper && paper.id === activeId ? paper.questions : null;
  const index = activeProgress?.currentIndex ?? 0;
  const completed = Boolean(activeProgress?.completedAt);
  const resume = useMemo(() => papersInProgress(ARCHIVE_PAPERS, progress, 1)[0], [progress]);

  // Papers load on demand; a hover or focus on a plate has usually fetched it already.
  useEffect(() => {
    if (!activeId) return;
    let live = true;
    setLoadError(false);
    loadArchivePaper(activeId).then(
      loaded => { if (live) setPaper({ id: activeId, questions: loaded }); },
      () => { if (live) setLoadError(true); },
    );
    return () => { live = false; };
  }, [activeId, attempt]);

  // Each new problem, result or paper hands focus to its heading, and brings the sheet into view.
  useEffect(() => {
    const heading = viewHeading.current;
    if (!active || !questions || !heading) return;
    heading.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < -40) rootRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeId, index, completed, Boolean(questions)]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 12000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const openPaper = (target: ArchivePaper, at?: number) => {
    returnTo.current = { id: target.id, scroll: window.scrollY, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    const record = progressRef.current[target.id];
    if (!record) update(target.id, previous => ({ ...previous, currentIndex: at ?? 0 }));
    else if (!record.saved || (at !== undefined && at !== record.currentIndex)) {
      update(target.id, previous => ({ ...previous, saved: true, currentIndex: at ?? previous.currentIndex }));
    }
    setUndo(null);
    setActiveId(target.id);
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: 'start' }));
  };

  const leavePaper = () => {
    const back = returnTo.current;
    setActiveId(null);
    setUndo(null);
    requestAnimationFrame(() => {
      if (back) window.scrollTo({ top: back.scroll });
      // Focus goes back to whatever opened the paper (a plate, the sky's card, Continue), else its plate.
      const opener = back?.opener;
      const plate = back ? document.querySelector<HTMLElement>(`[data-paper="${back.id}"]`) : null;
      const target = opener?.isConnected && opener.offsetParent ? opener : plate?.offsetParent ? plate : libraryHeading.current;
      target?.focus({ preventScroll: true });
    });
  };

  const toggleSave = (target: ArchivePaper) => {
    const saved = Boolean(progressRef.current[target.id]?.saved);
    update(target.id, previous => ({ ...previous, saved: !saved }));
  };

  const browse = () => {
    libraryHeading.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    libraryHeading.current?.focus({ preventScroll: true });
  };

  const retry = () => {
    if (!active) return;
    const snapshot = progressRef.current[active.id];
    update(active.id, previous => ({ ...previous, answers: {}, currentIndex: 0, completedAt: null, saved: true }));
    if (snapshot) setUndo({ id: active.id, snapshot });
  };

  const restore = () => {
    if (!undo) return;
    const { id, snapshot } = undo;
    update(id, () => ({ ...snapshot }));
    setUndo(null);
  };

  // Stable handlers, so the memoised plates re-render only when their own paper changes.
  const handlers = useRef({ openPaper, toggleSave });
  handlers.current = { openPaper, toggleSave };
  const onOpen = useCallback((target: ArchivePaper) => handlers.current.openPaper(target), []);
  const onOpenAt = useCallback((target: ArchivePaper, at: number) => handlers.current.openPaper(target, at), []);
  const onToggleSave = useCallback((target: ArchivePaper) => handlers.current.toggleSave(target), []);
  const onPrefetch = useCallback((target: ArchivePaper) => { void loadArchivePaper(target.id).catch(() => undefined); }, []);

  const saveLabel = saveState === 'failed' ? 'Could not save on this device' :
    saveState === 'saving' ? 'Saving…' : saveState === 'synced' ? 'Saved to your account' :
      saveState === 'local' ? (userId ? 'Saved here · account sync pending' : 'Saved on this device') :
        'Your work saves as you go';

  return <section className="xa" ref={rootRef} aria-label="Exam archive">
    <div className="xa-home" hidden={Boolean(active)}>
      <ArchiveHero papers={ARCHIVE_PAPERS} progress={progress} family={family} onFamily={setFamily}
        onBrowse={browse} onOpenAt={onOpenAt} resume={resume} still={reduce} />
      <PaperLibrary ref={libraryHeading} papers={ARCHIVE_PAPERS} progress={progress}
        family={family} onFamily={setFamily} status={status} onStatus={setStatus} query={query} onQuery={setQuery}
        sort={sort} onSort={setSort} saveLabel={saveLabel} onOpen={onOpen} onToggleSave={onToggleSave} onPrefetch={onPrefetch} reduce={reduce} />
    </div>

    {active && <m.div key={active.id} className="xa-view" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: ease.standard }}>
      {undo?.id === active.id && <p className="xa-undo" role="status">
        Your answers were cleared for a fresh start.
        <button type="button" onClick={restore}><RotateCcw size={15} aria-hidden="true" />Undo</button>
      </p>}
      {loadError
        ? <div className="xa-loading" role="alert">
          <p>{active.title} could not be opened. Check your connection and try again.</p>
          <div><button type="button" className="xa-btn is-ink" onClick={() => setAttempt(value => value + 1)}>Try again</button>
            <button type="button" className="xa-btn is-quiet" onClick={leavePaper}>All papers</button></div>
        </div>
        : !questions
          ? <div className="xa-loading" role="status"><span className="xa-pulse" aria-hidden="true" />Opening {active.title}…</div>
          : completed && activeProgress
            ? <PaperResult paper={active} questions={questions} progress={activeProgress} headingRef={viewHeading} onRetry={retry} onLeave={leavePaper} />
            : <PaperSession paper={active} questions={questions} progress={activeProgress} saveLabel={saveLabel} signedIn={Boolean(userId)}
              still={reduce} headingRef={viewHeading} onUpdate={change => update(active.id, change)} onLeave={leavePaper} />}
    </m.div>}
  </section>;
}
