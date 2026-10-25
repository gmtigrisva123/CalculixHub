import { memo, useMemo, type CSSProperties } from 'react';
import type { ArchivePaper } from '../../domain/examArchive';
import { coverStars, starState } from './archiveModel';

/**
 * A paper's constellation: one star per question, joined in question order. The shape comes
 * from the paper's id, so every paper keeps its own figure; the stars light up as the learner
 * works (attempted) and turn gold when an answer is right or a proof is marked solved.
 */
function PaperCover({ paper, answers, className }: { paper: ArchivePaper; answers?: Record<string, string>; className?: string }) {
  const stars = useMemo(() => coverStars(paper.id, paper.questions.length), [paper.id, paper.questions.length]);
  const path = useMemo(() => stars.map((star, index) => `${index ? 'L' : 'M'}${star.x.toFixed(1)} ${star.y.toFixed(1)}`).join(' '), [stars]);
  return <svg className={className ? `xa-cover ${className}` : 'xa-cover'} viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <path className="xa-cover-line" d={path} pathLength={1} />
    {stars.map((star, index) => {
      const state = starState(paper.questions[index], answers);
      return <g key={paper.questions[index].id} className={`xa-cover-star is-${state}`} transform={`translate(${star.x.toFixed(1)} ${star.y.toFixed(1)})`} style={{ '--xa-i': index } as CSSProperties}>
        {state > 0 && <circle className="xa-cover-halo" r={star.r * 4.4} />}
        <circle className="xa-cover-glow" r={star.r * 2.1} />
        <circle className="xa-cover-core" r={star.r} />
      </g>;
    })}
  </svg>;
}

export default memo(PaperCover);
