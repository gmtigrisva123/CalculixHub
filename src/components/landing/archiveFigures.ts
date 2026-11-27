/**
 * The exam archive, in the numbers the landing page quotes.
 *
 * Written out here rather than computed from the catalog because the catalog
 * is 150 KB of JSON that belongs to the lazily loaded archive screen, and the
 * landing page should not pay for it to print a few figures. The test beside
 * this file recomputes every number from the catalog, so they cannot drift:
 * add a paper and the test fails until this file is updated.
 *
 * The same goes for the shelf further down: which contest the archive holds a
 * paper for in which year, written as ranges of years. The landing page draws
 * one square for each, and the test checks the squares against the catalog
 * paper for paper.
 */

export interface ArchiveFamilyFigure {
  family: 'AMC 12' | 'AIME' | 'USAMO' | 'IMO';
  papers: number;
  problems: number;
  /** How a problem in this bank is answered. */
  format: string;
  /** The contests filed under this bank. */
  contests: string[];
}

export const ARCHIVE_FIGURES = {
  problems: 2195,
  papers: 233,
  proofs: 1054,
  firstYear: 1959,
  lastYear: 2026,
  families: [
    { family: 'AMC 12', papers: 27, problems: 580, format: 'Multiple choice', contests: ['AMC 12A', 'AMC 12B'] },
    { family: 'AIME', papers: 39, problems: 550, format: 'Answers 0 to 999', contests: ['AIME', 'AIME I', 'AIME II'] },
    { family: 'USAMO', papers: 96, problems: 540, format: 'Written proofs', contests: ['USAMO', 'USAJMO', 'USA TST', 'USA TSTST'] },
    { family: 'IMO', papers: 71, problems: 525, format: 'Written proofs', contests: ['IMO', 'IMO Shortlist'] },
  ] satisfies ArchiveFamilyFigure[],
} as const;

/** Every contest in the archive, in the order a student usually meets them. */
export const ARCHIVE_CONTESTS = ['AMC 12A', 'AMC 12B', 'AIME I', 'AIME II', 'USAJMO', 'USAMO', 'USA TSTST', 'USA TST', 'IMO', 'IMO Shortlist'] as const;

/** One contest, and the years the archive holds its paper for: "1959-1979,1981-2025". */
export interface ShelfContest {
  contest: string;
  years: string;
}

export interface ShelfRow {
  family: ArchiveFamilyFigure['family'];
  contests: ShelfContest[];
}

/**
 * The shelf, hardest bank first. Every (contest, year) here is one paper in
 * the archive. The gaps are real: there was no IMO in 1980.
 */
export const ARCHIVE_SHELF: ShelfRow[] = [
  { family: 'IMO', contests: [{ contest: 'IMO', years: '1959-1979,1981-2025' }, { contest: 'IMO Shortlist', years: '2020-2023' }] },
  {
    family: 'USAMO',
    contests: [
      { contest: 'USAMO', years: '1972-2026' },
      { contest: 'USAJMO', years: '2010-2025' },
      { contest: 'USA TSTST', years: '2011-2024' },
      { contest: 'USA TST', years: '2014-2021,2023-2024' },
    ],
  },
  { family: 'AIME', contests: [{ contest: 'AIME I', years: '2006-2023' }, { contest: 'AIME II', years: '2006-2024' }, { contest: 'AIME', years: '2025-2026' }] },
  { family: 'AMC 12', contests: [{ contest: 'AMC 12A', years: '2012-2020,2022-2025' }, { contest: 'AMC 12B', years: '2011-2020,2022-2025' }] },
];

/** Papers the archive holds that carry no year (two collections of adapted questions), and so have no place on the shelf. */
export const ARCHIVE_UNDATED = 2;

/** The years a range string names, in order. */
export function yearsOf(ranges: string): number[] {
  return ranges.split(',').flatMap(range => {
    const [from, to = from] = range.split('-').map(Number);
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  });
}

/** The contests each bank holds a paper for in one year, in the shelf's order. */
export function shelfAt(year: number): { family: ShelfRow['family']; contests: string[] }[] {
  return ARCHIVE_SHELF.map(row => ({
    family: row.family,
    contests: row.contests.filter(entry => yearsOf(entry.years).includes(year)).map(entry => entry.contest),
  }));
}
