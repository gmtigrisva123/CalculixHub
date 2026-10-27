import { describe, expect, it } from 'vitest';
import { ARCHIVE_FAMILIES, ARCHIVE_PAPERS, archiveCounts } from '../../domain/examArchive';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES } from './archiveFigures';

describe('the archive figures quoted on the landing page', () => {
  it('match the catalog exactly', () => {
    const counts = archiveCounts();
    expect(ARCHIVE_FIGURES.problems).toBe(counts.questions);
    expect(ARCHIVE_FIGURES.papers).toBe(counts.papers);
    expect(ARCHIVE_FIGURES.proofs).toBe(counts.proofs);
    expect(ARCHIVE_FIGURES.firstYear).toBe(counts.firstYear);
    expect(ARCHIVE_FIGURES.lastYear).toBe(counts.lastYear);
    expect(ARCHIVE_FIGURES.families.map(entry => entry.family)).toEqual(ARCHIVE_FAMILIES);
    for (const entry of ARCHIVE_FIGURES.families) {
      expect(entry.papers).toBe(counts.families[entry.family].papers);
      expect(entry.problems).toBe(counts.families[entry.family].questions);
    }
  });

  it('name every contest in each bank, and only those', () => {
    for (const entry of ARCHIVE_FIGURES.families) {
      const contests = new Set(ARCHIVE_PAPERS.filter(paper => paper.family === entry.family).map(paper => paper.contest));
      expect([...contests].sort()).toEqual([...entry.contests].sort());
    }
    const all = new Set(ARCHIVE_PAPERS.map(paper => paper.contest));
    // The marquee may leave out the plain "AIME" label, which only the 2025 and 2026 papers carry.
    for (const contest of ARCHIVE_CONTESTS) expect(all.has(contest)).toBe(true);
    for (const contest of all) expect(ARCHIVE_CONTESTS.includes(contest as never) || contest === 'AIME').toBe(true);
  });
});
