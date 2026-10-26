import { describe, expect, it } from 'vitest';
import { ARCHIVE_FAMILIES, ARCHIVE_PAPERS, findArchivePaper, proofMarkKey } from '../../domain/examArchive';
import type { ArchiveProgress } from '../../services/data/examArchiveProgress';
import {
  coverStars, filterPapers, groupByDecade, kindLine, matchesQuery, paperStatus, papersInProgress, starState, statusLine,
} from './archiveModel';
import { buildGalaxyLayout, RING_RADIUS } from './galaxyLayout';

const record = (answers: Record<string, string>, extra: Partial<ArchiveProgress> = {}): ArchiveProgress => ({
  saved: true, answers, currentIndex: 0, completedAt: null, updatedAt: '2026-10-25T12:00:00.000Z', ...extra,
});

describe('paper status and wording', () => {
  const amc = findArchivePaper('amc12-2025a')!;
  const imo = findArchivePaper('imo-2025')!;

  it('moves from new to in progress to finished', () => {
    expect(paperStatus(amc, undefined)).toBe('new');
    expect(paperStatus(amc, record({}))).toBe('new');
    expect(paperStatus(amc, record({ [amc.questions[0].id]: '1' }))).toBe('progress');
    expect(paperStatus(amc, record({}, { completedAt: '2026-10-25T13:00:00.000Z' }))).toBe('done');
  });

  it('describes what a paper asks for, and says plainly that proof marks are the learner’s', () => {
    expect(kindLine(amc)).toBe(`${amc.questions.length} problems · multiple choice`);
    expect(kindLine(findArchivePaper('aime-2026')!)).toMatch(/answers 000–999$/);
    expect(kindLine(imo)).toBe(`${imo.questions.length} problems · written proofs`);
    const key = amc.questions[0].key!;
    expect(statusLine(amc, record({ [amc.questions[0].id]: key }, { completedAt: 'x' }))).toBe(`Finished · 1 of ${amc.questions.length} correct`);
    const marked = record({ [proofMarkKey(imo.questions[0].id)]: 'solved' }, { completedAt: 'x' });
    expect(statusLine(imo, marked)).toBe('Finished · 1 solved (your review)');
    expect(statusLine(imo, record({ [imo.questions[1].id]: 'A draft' }))).toBe(`1 of ${imo.questions.length} attempted`);
  });

  it('lights a star for work, and turns it gold only for a right answer or a proof marked solved', () => {
    const [first] = amc.questions;
    expect(starState(first, undefined)).toBe(0);
    expect(starState(first, { [first.id]: String((Number(first.key) + 1) % 5) })).toBe(1);
    expect(starState(first, { [first.id]: first.key! })).toBe(2);
    const proof = imo.questions[0];
    expect(starState(proof, { [proof.id]: 'Draft' })).toBe(1);
    expect(starState(proof, { [proofMarkKey(proof.id)]: 'partial' })).toBe(1);
    expect(starState(proof, { [proofMarkKey(proof.id)]: 'solved' })).toBe(2);
  });
});

describe('finding papers', () => {
  it('matches years, contests and common short names', () => {
    const jmo = findArchivePaper('usajmo-2020')!;
    expect(matchesQuery(jmo, 'jmo 2020')).toBe(true);
    expect(matchesQuery(jmo, 'usajmo')).toBe(true);
    expect(matchesQuery(jmo, '2021')).toBe(false);
    expect(matchesQuery(findArchivePaper('amc12-2023b')!, '12b 2023')).toBe(true);
    expect(matchesQuery(findArchivePaper('imo-sl-2022')!, 'shortlist')).toBe(true);
    expect(matchesQuery(findArchivePaper('aime-2024-ii')!, '')).toBe(true);
  });

  it('filters by exam, status and saved papers', () => {
    const progress = { 'aime-2024-ii': record({ 'aime-2024-ii-p1': '33' }), 'imo-2025': record({}, { saved: true }) };
    expect(filterPapers(ARCHIVE_PAPERS, { family: 'AIME', status: 'all', query: '', progress }).every(paper => paper.family === 'AIME')).toBe(true);
    expect(filterPapers(ARCHIVE_PAPERS, { family: 'All', status: 'progress', query: '', progress }).map(paper => paper.id)).toEqual(['aime-2024-ii']);
    expect(filterPapers(ARCHIVE_PAPERS, { family: 'All', status: 'saved', query: '', progress }).map(paper => paper.id).sort()).toEqual(['aime-2024-ii', 'imo-2025']);
    expect(papersInProgress(ARCHIVE_PAPERS, progress).map(paper => paper.id)).toEqual(['aime-2024-ii']);
  });

  it('groups by decade in either order and keeps the adapted sets last', () => {
    const newest = groupByDecade(ARCHIVE_PAPERS, 'newest');
    const oldest = groupByDecade(ARCHIVE_PAPERS, 'oldest');
    expect(newest[0].decade).toBe(2020);
    expect(oldest[0].decade).toBe(1950);
    expect(newest.at(-1)?.decade).toBeNull();
    expect(oldest.at(-1)?.decade).toBeNull();
    expect(newest.reduce((sum, group) => sum + group.papers.length, 0)).toBe(ARCHIVE_PAPERS.length);
    const twenties = newest[0].papers.map(paper => paper.year ?? 0);
    expect([...twenties].sort((a, b) => b - a)).toEqual(twenties);
  });
});

describe('shapes', () => {
  it('draws the same constellation for a paper every time, inside its cover', () => {
    const a = coverStars('aime-2024-ii', 12);
    expect(coverStars('aime-2024-ii', 12)).toEqual(a);
    expect(coverStars('aime-2023-i', 12)).not.toEqual(a);
    for (const star of a) {
      expect(star.x).toBeGreaterThan(0);
      expect(star.x).toBeLessThan(240);
      expect(star.y).toBeGreaterThan(0);
      expect(star.y).toBeLessThan(120);
    }
  });

  it('places one star per problem, each bank on its own ring, years running around it', () => {
    const layout = buildGalaxyLayout(ARCHIVE_PAPERS);
    const total = ARCHIVE_PAPERS.reduce((sum, paper) => sum + paper.questions.length, 0);
    expect(layout.paperOf.length).toBe(total);
    expect(layout.firstYear).toBe(1959);
    for (const paper of ARCHIVE_PAPERS.filter(entry => entry.year)) {
      const index = ARCHIVE_PAPERS.indexOf(paper);
      const start = layout.paperStart[index];
      const radius = Math.hypot(layout.positions[start * 3], layout.positions[start * 3 + 2]);
      expect(Math.abs(radius - RING_RADIUS[paper.family])).toBeLessThan(0.6);
      expect(layout.familyOf[start]).toBe(ARCHIVE_FAMILIES.indexOf(paper.family));
    }
    expect(layout.angleOf(2000)).toBeGreaterThan(layout.angleOf(1990));
  });
});
