import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { findArchivePaper, loadArchivePaper } from '../../domain/examArchive';
import { ITEM_BANK } from '../../domain/itemBank';
import { recommendedSource } from '../../domain/irt';
import { PAPER_BANK, PAPER_DOMAINS } from './paperBank';

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

describe('the paper on the landing page', () => {
  it('quotes every problem, its choices and its answer exactly as the archive holds them', async () => {
    for (const item of PAPER_BANK) {
      const paperId = item.id.replace(/-p?\d+$/, '');
      const paper = findArchivePaper(paperId);
      expect(paper, item.id).toBeDefined();
      const question = (await loadArchivePaper(paperId)).find(entry => entry.id === item.id);
      expect(question?.prompt, item.id).toBe(item.question);
      expect(question?.options, item.id).toEqual(item.options);
      expect(question?.answerIndex, item.id).toBe(item.correctIdx);
      // The citation names the right contest, year and problem number.
      expect(item.ref, item.id).toBe(`${paper!.contest} ${paper!.year} · Problem ${question!.label}`);
    }
  });

  it('shares no problem with the placement test, so sitting it cannot spoil a real placement', () => {
    const placement = new Set(ITEM_BANK.map(item => item.id));
    for (const item of PAPER_BANK) expect(placement.has(item.id), item.id).toBe(false);
    expect(new Set(PAPER_BANK.map(item => item.id)).size).toBe(PAPER_BANK.length);
  });

  it('covers the four topics evenly, from gentle to hard in each', () => {
    for (const domain of PAPER_DOMAINS) {
      const levels = PAPER_BANK.filter(item => item.domain === domain).map(item => item.b);
      expect(levels, domain).toHaveLength(4);
      expect(Math.min(...levels), domain).toBeLessThan(-1);
      expect(Math.max(...levels), domain).toBeGreaterThan(0.5);
    }
  });

  it('gives the engine parameters it can use', () => {
    for (const item of PAPER_BANK) {
      expect(item.a, item.id).toBeGreaterThanOrEqual(0.5);
      expect(item.a, item.id).toBeLessThanOrEqual(2.5);
      expect(Math.abs(item.b), item.id).toBeLessThanOrEqual(3);
      // Guessing among the choices is the floor.
      expect(item.c, item.id).toBeCloseTo(1 / item.options.length, 10);
      expect(item.correctIdx, item.id).toBeLessThan(item.options.length);
      expect(item.source, item.id).toBe(recommendedSource(item.b));
    }
  });

  it('renders every formula without a KaTeX error', () => {
    for (const item of PAPER_BANK) {
      for (const text of [item.question, ...item.options, item.hint, item.reason]) expect(mathErrors(text), item.id).toEqual([]);
    }
  });

  it('never gives the answer away in a nudge', () => {
    for (const item of PAPER_BANK) {
      const answer = item.options[item.correctIdx];
      expect(item.hint.includes(answer), item.id).toBe(false);
    }
  });
});
