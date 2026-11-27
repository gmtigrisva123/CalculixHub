import { describe, expect, it } from 'vitest';
import { ARCHIVE_FAMILIES, ARCHIVE_PAPERS, archiveCounts } from '../../domain/examArchive';
import { ARCHIVE_CONTESTS, ARCHIVE_FIGURES, ARCHIVE_SHELF, ARCHIVE_UNDATED, shelfAt, yearsOf } from './archiveFigures';

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

  it('puts one square on the shelf for every dated paper in the catalog, and no others', () => {
    const shelved = ARCHIVE_SHELF.flatMap(row => row.contests.flatMap(entry => yearsOf(entry.years).map(year => `${row.family}|${entry.contest}|${year}`)));
    const dated = ARCHIVE_PAPERS.filter(paper => paper.year !== null).map(paper => `${paper.family}|${paper.contest}|${paper.year}`);
    expect(new Set(shelved).size).toBe(shelved.length);
    expect([...shelved].sort()).toEqual([...dated].sort());
    expect(ARCHIVE_PAPERS.filter(paper => paper.year === null)).toHaveLength(ARCHIVE_UNDATED);
    expect(shelved.length + ARCHIVE_UNDATED).toBe(ARCHIVE_FIGURES.papers);
    // The shelf runs exactly as far as the figures say the archive does.
    const years = shelved.map(entry => Number(entry.split('|')[2]));
    expect(Math.min(...years)).toBe(ARCHIVE_FIGURES.firstYear);
    expect(Math.max(...years)).toBe(ARCHIVE_FIGURES.lastYear);
    expect(ARCHIVE_SHELF.map(row => row.family).sort()).toEqual([...ARCHIVE_FAMILIES].sort());
  });

  it('reads a year off the shelf', () => {
    expect(yearsOf('1959-1961,1970')).toEqual([1959, 1960, 1961, 1970]);
    expect(shelfAt(1988).filter(row => row.contests.length)).toEqual([{ family: 'IMO', contests: ['IMO'] }, { family: 'USAMO', contests: ['USAMO'] }]);
    // No Olympiad was held in 1980.
    expect(shelfAt(1980).find(row => row.family === 'IMO')!.contests).toEqual([]);
  });
});
