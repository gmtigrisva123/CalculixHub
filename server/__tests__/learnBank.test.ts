import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { problems } from '../data';
import { compareAnswer } from '../../shared/gradeAnswer';
import { EMPTY_PRACTICE, submitPractice } from '../../shared/practiceRules';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { MemoryCounterStore } from '../counters';

describe('Learn bank integrity', () => {
  it('provides 124 identifiable questions with valid numeric controls and proof locks', () => {
    expect(problems).toHaveLength(124);
    expect(new Set(problems.map(p => p.id)).size).toBe(problems.length);
    for (const p of problems) {
      expect(p.points).toBeGreaterThan(0);
      expect(Number.isInteger(p.points)).toBe(true);
      expect(p.maxAttempts).toBe(3);
      if (p.answerMode === 'choice') expect(p.options).toContain(p.correctAnswer);
      if (p.answerMode === 'numeric-grid') {
        expect(p.correctAnswer).toMatch(/^\d+$/);
        expect(p.correctAnswer.length).toBeLessThanOrEqual(p.answerDigits!);
      }
      if (p.answerMode === 'proof') expect(p.proOnly).toBe(true);
      for (const text of [p.question, p.hint, p.solution]) {
        expect(text.replace(/\$/g, '').length).toBeGreaterThan(0);
        expect((text.match(/\$/g) ?? []).length % 2, p.id + ': balanced math').toBe(0);
        for (const match of text.matchAll(/\$([^$]+)\$/g)) {
          expect(() => katex.renderToString(match[1], { throwOnError: true }), p.id).not.toThrow();
          expect(match[1]).not.toContain('\\\\');
        }
      }
    }
  });
  it('checks binary-string counts by exhaustive enumeration, independently of the generator', () => {
    for (const p of problems.filter(p => p.title === 'Binary strings with breathing room')) {
      const length = Number(p.question.match(/length (\d+)/)![1]);
      let count = 0;
      for (let value = 0; value < 2 ** length; value++) if (!value.toString(2).includes('11')) count++;
      expect(Number(p.correctAnswer)).toBe(count);
    }
  });
  it('checks modular powers with BigInt arithmetic', () => {
    for (const p of problems.filter(p => p.title === 'A long power, reduced')) {
      const [, base, exponent] = p.question.match(/\$(\d+)\^\{(\d+)\}/)!;
      expect(Number(p.correctAnswer)).toBe(Number(BigInt(base) ** BigInt(exponent) % 1000n));
    }
  });
  it('accepts AIME leading zeroes and reveals after exactly three wrong attempts', () => {
    expect(compareAnswer('007', '7')).toBe(true);
    expect(compareAnswer('070', '7')).toBe(false);
    const one = submitPractice(EMPTY_PRACTICE, false);
    const two = submitPractice(one, false);
    expect(two.finished).toBe(false);
    const three = submitPractice(two, false);
    expect(three).toEqual({ count: 3, finished: true, forfeited: true });
    expect(submitPractice(three, true)).toBe(three);
    expect(submitPractice(two, true)).toEqual({ count: 3, finished: true, forfeited: false });
  });
  it('enforces exhaustion, solution forfeiture and proof lock through the API', async () => {
    const app = buildApp({ config: loadConfig({ NODE_ENV: 'test' }), store: new MemoryCounterStore(), model: null });
    const submit = (id: string, answer: string, forfeit = false) => app(new Request('http://localhost/api/evaluate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ problemId: id, userAnswer: answer, practiceSession: '11111111-1111-4111-8111-111111111111', forfeit }),
    }));
    for (let i = 1; i <= 3; i++) {
      const result = await (await submit('alg-f01', '999')).json();
      expect(result).toMatchObject({ correct: false, attemptsUsed: i, finished: i === 3, forfeited: i === 3 });
    }
    expect(await (await submit('alg-f01', '7')).json()).toMatchObject({ correct: false, pointsAwarded: 0, finished: true });
    const item = problems.find(p => p.id.startsWith('gen-aime'))!;
    await submit(item.id, '__forfeit__', true);
    expect(await (await submit(item.id, item.correctAnswer)).json()).toMatchObject({ correct: false, pointsAwarded: 0, forfeited: true });
    expect((await submit(problems.find(p => p.proOnly)!.id, 'PROOF')).status).toBe(403);
  });
});
