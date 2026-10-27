import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { findArchivePaper, loadArchivePaper } from '../../domain/examArchive';
import { ARCHIVE_SAMPLES } from './archiveSamples';
import { WORLD_IDEAS } from './worldIdeas';

// The segments MathText renders, as the archive test reads them.
const SEGMENT = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

function mathErrors(text: string): string[] {
  const errors: string[] = [];
  for (const match of text.matchAll(SEGMENT)) {
    const [, displayDollar, displayBracket, inlineParen, inlineDollar] = match;
    const expr = displayDollar ?? displayBracket ?? inlineParen ?? inlineDollar;
    try {
      katex.renderToString(expr, { throwOnError: true, displayMode: displayDollar !== undefined || displayBracket !== undefined, strict: 'ignore' });
    } catch (error) {
      errors.push(`${expr.slice(0, 60)}: ${(error as Error).message.slice(0, 80)}`);
    }
  }
  return errors;
}

describe('mathematics quoted on the landing page', () => {
  it('quotes archive problems exactly as the archive holds them', async () => {
    for (const sample of ARCHIVE_SAMPLES) {
      const paperId = sample.id.replace(/-p?\d+$/, '');
      const paper = findArchivePaper(paperId);
      expect(paper, sample.id).toBeDefined();
      const questions = await loadArchivePaper(paperId);
      const question = questions.find(entry => entry.id === sample.id);
      expect(question?.prompt, sample.id).toBe(sample.prompt);
      // The label names the right contest, year and problem number.
      expect(sample.ref).toContain(String(paper!.year));
      expect(sample.ref.endsWith(`Problem ${question!.label}`)).toBe(true);
    }
  });

  it('renders every formula without a KaTeX error', () => {
    for (const sample of ARCHIVE_SAMPLES) expect(mathErrors(sample.prompt), sample.id).toEqual([]);
    for (const idea of WORLD_IDEAS) expect(mathErrors(idea.formula), idea.topic).toEqual([]);
  });
});
