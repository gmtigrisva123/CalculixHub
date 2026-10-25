import { memo, useId } from 'react';
import { ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';
import type { ArchivePaper } from '../../domain/examArchive';
import type { ArchiveProgress } from '../../services/data/examArchiveProgress';
import { archiveTally } from '../../domain/examArchive';
import PaperCover from './PaperCover';
import { FAMILY_SLUG, kindLine, paperStatus, statusLine } from './archiveModel';

function plateTitle(paper: ArchivePaper): string {
  return paper.year ? paper.contest : paper.title.split(' · ').slice(1).join(' · ') || paper.title;
}

function actionLabel(paper: ArchivePaper, progress: ArchiveProgress | undefined): string {
  const status = paperStatus(paper, progress);
  return status === 'done' ? 'Review' : status === 'progress' ? 'Continue' : 'Start';
}

type PlateProps = {
  paper: ArchivePaper;
  progress: ArchiveProgress | undefined;
  onOpen: (paper: ArchivePaper) => void;
  onToggleSave: (paper: ArchivePaper) => void;
  onPrefetch: (paper: ArchivePaper) => void;
  wide?: boolean;
};

/** One paper on the shelf: its constellation, what it asks for, and where the learner stands. */
function PaperPlate({ paper, progress, onOpen, onToggleSave, onPrefetch, wide }: PlateProps) {
  const status = paperStatus(paper, progress);
  const tally = archiveTally(paper, progress?.answers ?? {});
  const fraction = status === 'done' ? 1 : tally.attempted / Math.max(1, tally.total);
  const action = actionLabel(paper, progress);
  const saved = Boolean(progress?.saved);
  const describedBy = useId();
  return <li className={wide ? 'xa-plate is-wide' : 'xa-plate'} data-family={FAMILY_SLUG[paper.family]} data-status={status}>
    <button type="button" className="xa-plate-main" data-paper={paper.id}
      aria-label={`${action} ${paper.title}`} aria-describedby={`${describedBy}-kind ${describedBy}-status`}
      onClick={() => onOpen(paper)} onPointerEnter={() => onPrefetch(paper)} onFocus={() => onPrefetch(paper)}>
      <span className="xa-plate-cover">
        <PaperCover paper={paper} answers={progress?.answers} />
        <span className="xa-plate-year">{paper.year ?? 'Set'}</span>
      </span>
      <span className="xa-plate-body">
        <span className="xa-plate-title">{plateTitle(paper)}</span>
        <span className="xa-plate-kind" id={`${describedBy}-kind`}>{kindLine(paper).split(' · ').map((part, index) => <span key={index}>{index ? ' · ' : ''}<span className="xa-nowrap">{part}</span></span>)}</span>
        <span className="xa-plate-foot">
          <span className="xa-plate-status" id={`${describedBy}-status`}>{statusLine(paper, progress)}</span>
          <span className="xa-plate-cta" aria-hidden="true">{action}<ArrowRight size={15} /></span>
        </span>
        <span className="xa-plate-track" aria-hidden="true"><span style={{ transform: `scaleX(${fraction})` }} /></span>
      </span>
    </button>
    <button type="button" className="xa-plate-save" aria-pressed={saved}
      aria-label={`${saved ? 'Remove from saved' : 'Save for later'}: ${paper.title}`} onClick={() => onToggleSave(paper)}>
      {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
    </button>
  </li>;
}

export default memo(PaperPlate);
