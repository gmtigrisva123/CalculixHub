import { forwardRef, useMemo, useRef } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { ARCHIVE_FAMILIES, ARCHIVE_SOURCES, type ArchiveFamily, type ArchivePaper } from '../../domain/examArchive';
import type { ArchiveProgressMap } from '../../services/data/examArchiveProgress';
import PaperPlate from './PaperPlate';
import { FAMILY_SLUG, filterPapers, groupByDecade, papersInProgress, type SortOrder, type StatusFilter } from './archiveModel';

type LibraryProps = {
  papers: ArchivePaper[];
  progress: ArchiveProgressMap;
  family: ArchiveFamily | 'All';
  onFamily: (family: ArchiveFamily | 'All') => void;
  status: StatusFilter;
  onStatus: (status: StatusFilter) => void;
  query: string;
  onQuery: (query: string) => void;
  sort: SortOrder;
  onSort: (sort: SortOrder) => void;
  saveLabel: string;
  onOpen: (paper: ArchivePaper) => void;
  onToggleSave: (paper: ArchivePaper) => void;
  onPrefetch: (paper: ArchivePaper) => void;
  reduce: boolean;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All papers' },
  { value: 'progress', label: 'In progress' },
  { value: 'done', label: 'Finished' },
  { value: 'saved', label: 'Saved for later' },
];

/** The shelves: every paper, filterable, grouped by decade, with a ruler to jump through time. */
const PaperLibrary = forwardRef<HTMLHeadingElement, LibraryProps>(function PaperLibrary(props, headingRef) {
  const { papers, progress, family, onFamily, status, onStatus, query, onQuery, sort, onSort, saveLabel, onOpen, onToggleSave, onPrefetch, reduce } = props;
  const visible = useMemo(() => filterPapers(papers, { family, status, query, progress }), [papers, family, status, query, progress]);
  const groups = useMemo(() => groupByDecade(visible, sort), [visible, sort]);
  const resume = useMemo(() => papersInProgress(papers, progress), [papers, progress]);
  const familyCounts = useMemo(() => Object.fromEntries(ARCHIVE_FAMILIES.map(name => [name, papers.filter(paper => paper.family === name).length])), [papers]);
  const visibleProblems = visible.reduce((sum, paper) => sum + paper.questions.length, 0);
  const widest = Math.max(1, ...groups.map(group => group.papers.length));
  const filtered = family !== 'All' || status !== 'all' || query.trim() !== '';
  // One line per dataset, with every rights note that applies to the papers taken from it.
  const usedSources = useMemo(() => {
    const byName = new Map<string, { name: string; url: string; license: string; rights: string[] }>();
    for (const key of new Set(papers.map(paper => paper.source))) {
      const source = ARCHIVE_SOURCES[key];
      if (!source) continue;
      const entry = byName.get(source.name) ?? { name: source.name, url: source.url, license: source.license, rights: [] };
      if (!entry.rights.includes(source.rights)) entry.rights.push(source.rights);
      byName.set(source.name, entry);
    }
    return [...byName.values()];
  }, [papers]);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const jump = (key: string) => {
    const target = document.getElementById(`xa-decade-${key}`);
    if (!target) return;
    // Land the decade just below the sticky toolbar (or the page's own scroll padding on phones).
    const toolbar = toolbarRef.current;
    const sticky = toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.getBoundingClientRect().height + 30 : 0;
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - Math.max(sticky, padding);
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    target.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };

  return <section className="xa-library" aria-labelledby="xa-library-title">
    <header className="xa-library-head">
      <div>
        <h2 id="xa-library-title" ref={headingRef} tabIndex={-1}>The papers</h2>
        <p className="xa-library-count" aria-live="polite">
          {filtered ? `${visible.length} of ${papers.length} papers` : `${papers.length} papers`} · {visibleProblems.toLocaleString('en-US')} problems
        </p>
      </div>
      <p className="xa-save" role="status">{saveLabel}</p>
    </header>

    {resume.length > 0 && !filtered && <section className="xa-resume" aria-labelledby="xa-resume-title">
      <h3 id="xa-resume-title">Pick up where you left off</h3>
      <ol className="xa-plates is-resume">
        {resume.map(paper => <PaperPlate key={paper.id} wide paper={paper} progress={progress[paper.id]} onOpen={onOpen} onToggleSave={onToggleSave} onPrefetch={onPrefetch} />)}
      </ol>
    </section>}

    <div className="xa-toolbar" ref={toolbarRef}>
      <div className="xa-seg" role="group" aria-label="Exam">
        {(['All', ...ARCHIVE_FAMILIES] as const).map(name => <button key={name} type="button" aria-pressed={family === name}
          data-family={name === 'All' ? undefined : FAMILY_SLUG[name]} onClick={() => onFamily(name)}>
          {name}<span>{name === 'All' ? papers.length : familyCounts[name]}</span>
        </button>)}
      </div>
      <div className="xa-tools">
        <label className="xa-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search papers</span>
          <input type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Year or contest, e.g. 2019 or JMO" autoComplete="off" spellCheck={false} />
        </label>
        <label className="xa-select">
          <span className="sr-only">Show</span>
          <select value={status} onChange={event => onStatus(event.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" className="xa-sort" onClick={() => onSort(sort === 'newest' ? 'oldest' : 'newest')} aria-label={`Order: ${sort === 'newest' ? 'newest first' : 'oldest first'}. Switch order`}>
          <ArrowDownUp size={15} aria-hidden="true" />{sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>
    </div>

    {groups.length > 1 && <nav className="xa-ruler" aria-label="Jump to a decade">
      <ol>{groups.map(group => <li key={group.key}>
        <button type="button" onClick={() => jump(group.key)} aria-label={`${group.label}: ${group.papers.length} papers`}>
          <span className="xa-ruler-bar" aria-hidden="true"><span style={{ transform: `scaleY(${group.papers.length / widest})` }} /></span>
          <span className="xa-ruler-label">{group.label}</span>
        </button>
      </li>)}</ol>
    </nav>}

    {groups.map(group => <section key={group.key} className="xa-decade" id={`xa-decade-${group.key}`} aria-labelledby={`xa-decade-title-${group.key}`}>
      <div className="xa-decade-head">
        <h3 id={`xa-decade-title-${group.key}`} tabIndex={-1}>{group.label}</h3>
        <p>{group.papers.length} {group.papers.length === 1 ? 'paper' : 'papers'} · {group.papers.reduce((sum, paper) => sum + paper.questions.length, 0).toLocaleString('en-US')} problems</p>
      </div>
      <ol className="xa-plates">
        {group.papers.map(paper => <PaperPlate key={paper.id} paper={paper} progress={progress[paper.id]} onOpen={onOpen} onToggleSave={onToggleSave} onPrefetch={onPrefetch} />)}
      </ol>
    </section>)}

    {!visible.length && <div className="xa-empty">
      <p>{status === 'saved' ? 'No saved papers here yet. Use the bookmark on any paper to keep it for later.'
        : status === 'progress' ? 'Nothing in progress here yet. Open any paper to begin.'
          : status === 'done' ? 'No finished papers here yet.'
            : 'No papers match that search.'}</p>
      <button type="button" className="xa-btn is-quiet" onClick={() => { onQuery(''); onStatus('all'); onFamily('All'); }}>Show all papers</button>
    </div>}

    <footer className="xa-sources">
      <h3>Where the problems come from</h3>
      <p>Problems are reproduced from public datasets for study. Each paper names its source; problems that depend on a missing diagram are left out. AMC 12 and AIME answers are checked automatically. USAMO and IMO problems are written proofs: compare your work with the reference solutions and mark it yourself.</p>
      <ul>{usedSources.map(source => <li key={source.name}>
        <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
        <span>{source.license}. {source.rights.join('; ')}.</span>
      </li>)}</ul>
    </footer>
  </section>;
});

export default PaperLibrary;
