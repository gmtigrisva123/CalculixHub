import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Pause, Play, Shuffle, X } from 'lucide-react';
import { ARCHIVE_FAMILIES, archiveCounts, type ArchiveFamily, type ArchivePaper } from '../../domain/examArchive';
import type { ArchiveProgressMap } from '../../services/data/examArchiveProgress';
import { buildGalaxyLayout } from './galaxyLayout';
import { FAMILY_FORMAT, FAMILY_SLUG, starState } from './archiveModel';
import type { GalaxyPick } from './ArchiveGalaxy';

const ArchiveGalaxy = lazy(() => import('./ArchiveGalaxy'));

type HeroProps = {
  papers: ArchivePaper[];
  progress: ArchiveProgressMap;
  family: ArchiveFamily | 'All';
  onFamily: (family: ArchiveFamily | 'All') => void;
  onBrowse: () => void;
  onOpenAt: (paper: ArchivePaper, questionIndex: number) => void;
  resume: ArchivePaper | undefined;
  still: boolean;
};

const STATE_TEXT = ['Not started yet', 'You have worked on it', 'Right, or marked solved'];

/** The archive's opening: the whole catalog as a sky, with the words and the legend beside it. */
export default function ArchiveHero({ papers, progress, family, onFamily, onBrowse, onOpenAt, resume, still }: HeroProps) {
  const counts = useMemo(() => archiveCounts(), []);
  const layout = useMemo(() => buildGalaxyLayout(papers), [papers]);
  const [hover, setHover] = useState<GalaxyPick | null>(null);
  const [picked, setPicked] = useState<GalaxyPick | null>(null);
  const [peek, setPeek] = useState(-1);
  const [flat, setFlat] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const [surprised, setSurprised] = useState(0);
  // The sky drifts; anyone can hold it still (and reduced motion always does).
  const [paused, setPaused] = useState(false);
  const cardId = useId();

  const states = useMemo(() => {
    const out = new Uint8Array(layout.paperOf.length);
    layout.papers.forEach((paper, index) => {
      const answers = progress[paper.id]?.answers;
      if (!answers) return;
      paper.questions.forEach((question, questionIndex) => { out[layout.paperStart[index] + questionIndex] = starState(question, answers); });
    });
    return out;
  }, [layout, progress]);
  const lit = useMemo(() => states.reduce((sum, state) => sum + (state ? 1 : 0), 0), [states]);
  const gold = useMemo(() => states.reduce((sum, state) => sum + (state === 2 ? 1 : 0), 0), [states]);

  useEffect(() => {
    if (!picked) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPicked(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [picked]);

  // After a random pick, bring the card into view and hand it focus.
  useEffect(() => {
    if (!surprised) return;
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
    openRef.current?.focus({ preventScroll: true });
  }, [surprised]);

  const familyFocus = peek >= 0 ? peek : family === 'All' ? -1 : ARCHIVE_FAMILIES.indexOf(family);
  /** A problem nobody has touched yet, from the exam in view when one is chosen. */
  const surprise = () => {
    const bank = family === 'All' ? -1 : ARCHIVE_FAMILIES.indexOf(family);
    const pool: number[] = [];
    for (let i = 0; i < states.length; i += 1) if (!states[i] && (bank < 0 || layout.familyOf[i] === bank)) pool.push(i);
    if (!pool.length) for (let i = 0; i < states.length; i += 1) if (bank < 0 || layout.familyOf[i] === bank) pool.push(i);
    if (!pool.length) return;
    setPicked({ star: pool[Math.floor(Math.random() * pool.length)], x: 0, y: 0 });
    setSurprised(value => value + 1);
  };
  const focusStar = hover?.star ?? picked?.star ?? -1;
  const focusPaper = focusStar >= 0 ? layout.paperOf[focusStar] : -1;
  const describe = (star: number) => {
    const paper = layout.papers[layout.paperOf[star]];
    const question = paper.questions[layout.questionOf[star]];
    return { paper, question, index: layout.questionOf[star] };
  };
  const hovered = hover ? describe(hover.star) : null;
  const chosen = picked ? describe(picked.star) : null;

  return <section className="xa-sky" aria-labelledby="xa-sky-title"><div className="xa-sky-frame">
    <div className="xa-sky-stage" ref={stageRef}>
      <Suspense fallback={null}>
        <ArchiveGalaxy layout={layout} states={states} familyFocus={familyFocus} focusPaper={focusPaper}
          pickedStar={picked?.star ?? -1} still={still || paused} onHover={setHover} onPick={setPicked} onUnavailable={() => setFlat(true)} />
      </Suspense>
      {!still && !flat && <button type="button" className="xa-icon-btn xa-sky-pause" aria-pressed={paused}
        aria-label="Hold the sky still" onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>}
      {hovered && hover && <p className="xa-sky-tip" aria-hidden="true" style={{ transform: `translate3d(${hover.x}px, ${hover.y}px, 0) translate(-50%, ${hover.y > 64 ? 'calc(-100% - 14px)' : '16px'})` }}>
        <strong>{hovered.paper.title}</strong> · Problem {hovered.question.label}
      </p>}
      {!flat && !chosen && <p className="xa-sky-hint" aria-hidden="true">
        <span className="xa-sky-hint-hover">Point at a star to see its paper. Click to open it.</span>
        <span className="xa-sky-hint-touch">Tap a star to see its paper.</span>
      </p>}
      {chosen && <div className="xa-focus" data-family={FAMILY_SLUG[chosen.paper.family]} role="group" aria-label="Selected problem">
        <p className="xa-focus-title" id={`${cardId}-title`}>{chosen.paper.title}</p>
        <p className="xa-focus-meta" id={`${cardId}-meta`}>Problem {chosen.question.label} of {chosen.paper.questions.length} · {STATE_TEXT[starState(chosen.question, progress[chosen.paper.id]?.answers)]}</p>
        <div className="xa-focus-actions">
          <button type="button" ref={openRef} className="xa-btn is-gold" aria-describedby={`${cardId}-title ${cardId}-meta`} onClick={() => onOpenAt(chosen.paper, chosen.index)}>Open problem {chosen.question.label} <ArrowRight size={16} /></button>
          <button type="button" className="xa-icon-btn" aria-label="Close" onClick={() => setPicked(null)}><X size={17} /></button>
        </div>
      </div>}
    </div>

    <div className="xa-sky-copy">
      <h1 id="xa-sky-title">Every past paper, in one sky.</h1>
      <p className="xa-sky-lead">
        {counts.questions.toLocaleString('en-US')} problems from {counts.papers} papers, {counts.firstYear} to {counts.lastYear}.
        Each ring is an exam and runs through the years; each star is one problem. The ones you work on start to glow.
      </p>
      {!flat && <p className="xa-sky-hint-inline" aria-hidden="true">
        <span className="xa-sky-hint-hover">Point at a star in the sky to see its paper.</span>
        <span className="xa-sky-hint-touch">Tap a star in the sky to see its paper.</span>
      </p>}
      {lit > 0 && <p className="xa-sky-mine">You have worked on {lit.toLocaleString('en-US')} {lit === 1 ? 'problem' : 'problems'}{gold ? `, and ${gold.toLocaleString('en-US')} ${gold === 1 ? 'is' : 'are'} gold` : ''}.</p>}
      <div className="xa-sky-actions">
        {resume
          ? <><button type="button" className="xa-btn is-gold" onClick={() => onOpenAt(resume, progress[resume.id]?.currentIndex ?? 0)}>Continue {resume.title} <ArrowRight size={17} /></button>
            <button type="button" className="xa-btn is-ghost" onClick={onBrowse}>All papers <ArrowDown size={16} /></button></>
          : <button type="button" className="xa-btn is-gold" onClick={onBrowse}>Browse the papers <ArrowDown size={17} /></button>}
        <button type="button" className="xa-btn is-ghost" onClick={surprise}><Shuffle size={16} aria-hidden="true" />Pick a star for me</button>
      </div>
    </div>

    <ul className="xa-legend" aria-label="Show one exam">
      {ARCHIVE_FAMILIES.map((name, index) => {
        const entry = counts.families[name];
        return <li key={name}>
          <button type="button" data-family={FAMILY_SLUG[name]} aria-pressed={family === name}
            onClick={() => onFamily(family === name ? 'All' : name)}
            onPointerEnter={() => setPeek(index)} onPointerLeave={() => setPeek(-1)} onFocus={() => setPeek(index)} onBlur={() => setPeek(-1)}>
            <span className="xa-legend-swatch" aria-hidden="true" />
            <span className="xa-legend-name">{name}</span>
            <span className="xa-legend-count">{entry.papers} papers · {entry.questions.toLocaleString('en-US')} problems</span>
            <span className="xa-legend-format">{FAMILY_FORMAT[name]}</span>
          </button>
        </li>;
      })}
    </ul>
  </div></section>;
}
