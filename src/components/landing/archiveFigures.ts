/**
 * The exam archive, in the numbers the landing page quotes.
 *
 * Written out here rather than computed from the catalog because the catalog
 * is 150 KB of JSON that belongs to the lazily loaded archive screen, and the
 * landing page should not pay for it to print a few figures. The test beside
 * this file recomputes every number from the catalog, so they cannot drift:
 * add a paper and the test fails until this file is updated.
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
