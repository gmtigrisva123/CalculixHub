import { describe, expect, it } from 'vitest';
import { EXAM_COLLECTIONS, archiveScore, isArchiveAnswerCorrect } from '../examArchive';

describe('international exam archive', () => {
  it('offers distinct, checkable questions in every exam collection', () => {
    const all = EXAM_COLLECTIONS.flatMap(collection => collection.questions);
    expect(EXAM_COLLECTIONS.length).toBe(8);
    expect(all.length).toBeGreaterThan(100);
    expect(new Set(all.map(question => question.id)).size).toBe(all.length);
    for (const collection of EXAM_COLLECTIONS) {
      expect(collection.questions.length).toBeGreaterThanOrEqual(5);
      expect(collection.sourceUrl).toMatch(/^https:\/\/huggingface\.co\/datasets\//);
      for (const question of collection.questions) {
        expect(question.prompt.trim()).not.toBe('');
        if (question.kind === 'choice') {
          expect(question.options?.length).toBeGreaterThanOrEqual(4);
          expect(new Set(question.options).size).toBe(question.options?.length);
          expect(question.answerIndex).toBeGreaterThanOrEqual(0);
          expect(question.answerIndex).toBeLessThan(question.options!.length);
        } else {
          expect(question.answer).toMatch(/^\d{1,3}$/);
        }
      }
    }
  });

  it('scores actual AMC choices and AIME short answers without counting blanks', () => {
    const amc = EXAM_COLLECTIONS.find(collection => collection.id === 'amc12-2025a')!;
    const aime = EXAM_COLLECTIONS.find(collection => collection.id === 'aime-2026')!;
    const choice = amc.questions[0];
    const numeric = aime.questions[0];
    expect(isArchiveAnswerCorrect(choice, String(choice.answerIndex))).toBe(true);
    expect(isArchiveAnswerCorrect(choice, '')).toBe(false);
    expect(isArchiveAnswerCorrect(numeric, numeric.answer)).toBe(true);
    expect(isArchiveAnswerCorrect(numeric, '')).toBe(false);
    expect(archiveScore(amc, { [choice.id]: String(choice.answerIndex) })).toBe(1);
  });
});
