import { describe, expect, it } from 'vitest';
import katex from 'katex';
import {
  ARCHIVE_FAMILIES, ARCHIVE_PAPERS, ARCHIVE_SOURCES, archiveScore, archiveTally, findArchivePaper,
  isArchiveAnswerCorrect, isArchiveAttempted, loadArchivePaper, proofMarkKey, type ArchiveQuestion,
} from '../examArchive';

// The same segments MathText renders.
const SEGMENT = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$|\\begin\{([a-z*]+)\}([\s\S]+?)\\end\{\5\}/g;

function mathErrors(text: string): string[] {
  const errors: string[] = [];
  for (const match of text.matchAll(SEGMENT)) {
    const [, displayDollar, displayBracket, inlineParen, inlineDollar, env, body] = match;
    const expr = displayDollar ?? displayBracket ?? inlineParen ?? inlineDollar ?? `\\begin{${env}}${body}\\end{${env}}`;
    try {
      katex.renderToString(expr, { throwOnError: true, displayMode: displayDollar !== undefined || displayBracket !== undefined || env !== undefined, strict: 'ignore' });
    } catch (error) {
      errors.push(`${expr.slice(0, 60)}: ${(error as Error).message.slice(0, 80)}`);
    }
  }
  return errors;
}

const LAUNCH_PAPERS = ['amc12-2024a', 'amc12-2024b', 'amc12-2025a', 'amc12-2025b', 'aime-2025', 'aime-2026', 'usamo-outcomes', 'imo-outcomes'];

describe('international exam archive', () => {
  it('keeps the launch papers and their question ids, so saved progress still lines up', async () => {
    for (const id of LAUNCH_PAPERS) {
      const paper = findArchivePaper(id);
      expect(paper?.legacy).toBe(true);
      const questions = await loadArchivePaper(id);
      expect(questions.map(question => question.id)).toEqual(paper!.questions.map(question => question.id));
    }
    expect((await loadArchivePaper('amc12-2025a'))[0].id).toBe('amc12-2025a-p1');
  });

  it('adds at least 500 questions to every bank, with unique ids', () => {
    const ids = ARCHIVE_PAPERS.flatMap(paper => paper.questions.map(question => question.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ARCHIVE_PAPERS.map(paper => paper.id)).size).toBe(ARCHIVE_PAPERS.length);
    for (const family of ARCHIVE_FAMILIES) {
      const added = ARCHIVE_PAPERS.filter(paper => paper.family === family && !paper.legacy)
        .reduce((sum, paper) => sum + paper.questions.length, 0);
      expect(added, family).toBeGreaterThanOrEqual(500);
    }
    // USAMO and IMO are written-proof banks.
    for (const paper of ARCHIVE_PAPERS.filter(entry => !entry.legacy && (entry.family === 'USAMO' || entry.family === 'IMO'))) {
      expect(paper.questions.every(question => question.kind === 'proof')).toBe(true);
    }
  });

  it('ships every paper with checkable keys, cited sources and math that renders', async () => {
    for (const paper of ARCHIVE_PAPERS) {
      expect(ARCHIVE_SOURCES[paper.source], paper.id).toBeDefined();
      expect(paper.sourceUrl).toMatch(/^https:\/\//);
      const questions = await loadArchivePaper(paper.id);
      expect(questions.length, paper.id).toBe(paper.questions.length);
      questions.forEach((question: ArchiveQuestion, index) => {
        const ref = paper.questions[index];
        expect(question.id).toBe(ref.id);
        expect(question.kind).toBe(ref.kind);
        expect(question.prompt.trim()).not.toBe('');
        if (question.kind === 'choice') {
          expect(question.options?.length).toBeGreaterThanOrEqual(4);
          expect(new Set(question.options).size).toBe(question.options?.length);
          expect(question.answerIndex).toBeGreaterThanOrEqual(0);
          expect(question.answerIndex).toBeLessThan(question.options!.length);
          expect(ref.key).toBe(String(question.answerIndex));
        } else if (question.kind === 'numeric') {
          expect(question.answer).toMatch(/^\d{1,3}$/);
          expect(ref.key).toBe(question.answer);
        } else {
          expect(ref.key).toBeNull();
        }
        const texts = [question.prompt, ...(question.options ?? []), ...(question.solutions ?? []), question.finalAnswer ?? ''];
        expect(texts.flatMap(mathErrors), question.id).toEqual([]);
      });
    }
    // Typesetting every formula in the archive takes a few seconds.
  }, 60_000);

  it('scores AMC choices and AIME short answers without counting blanks', async () => {
    const amc = findArchivePaper('amc12-2025a')!;
    const choice = (await loadArchivePaper('amc12-2025a'))[0];
    const numeric = (await loadArchivePaper('aime-2026'))[0];
    expect(isArchiveAnswerCorrect(choice, String(choice.answerIndex))).toBe(true);
    expect(isArchiveAnswerCorrect(choice, '')).toBe(false);
    expect(isArchiveAnswerCorrect(numeric, numeric.answer)).toBe(true);
    expect(isArchiveAnswerCorrect(numeric, '')).toBe(false);
    // The catalog's keys score exactly like the full questions.
    expect(isArchiveAnswerCorrect(amc.questions[0], String(choice.answerIndex))).toBe(true);
    expect(archiveScore(amc, { [choice.id]: String(choice.answerIndex) })).toBe(1);
  });

  it('never marks a written proof itself, and counts the learner’s own review', () => {
    const paper = ARCHIVE_PAPERS.find(entry => entry.family === 'IMO' && !entry.legacy)!;
    const [first, second] = paper.questions;
    expect(isArchiveAnswerCorrect(first, 'Assume for contradiction…')).toBe(false);
    const answers = { [first.id]: 'Assume for contradiction…', [proofMarkKey(first.id)]: 'solved', [proofMarkKey(second.id)]: 'partial' };
    expect(isArchiveAttempted(second, answers)).toBe(true);
    const tally = archiveTally(paper, answers);
    expect(tally).toMatchObject({ proofs: paper.questions.length, solved: 1, partial: 1, attempted: 2, checkable: 0, correct: 0 });
  });
});
