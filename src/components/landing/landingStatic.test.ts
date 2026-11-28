import { describe, expect, it } from 'vitest';
import { landingNoscript } from './landingStatic';
import { ARCHIVE_FIGURES } from './archiveFigures';
import { FAQS } from './faqContent';
import { PLANS, dollars } from '../../../shared/plans';

describe('the landing page without script', () => {
  const html = landingNoscript();

  it('is one noscript block that hides the boot screen', () => {
    expect(html.startsWith('<noscript>')).toBe(true);
    expect(html.endsWith('</noscript>')).toBe(true);
    expect(html).toContain('#boot { display: none !important; }');
    expect(html).not.toMatch(/<script/i);
  });

  it('says what the live page says, with the figures and prices it reads', () => {
    expect(html).toContain('Stay with the question.');
    expect(html).toContain(`${ARCHIVE_FIGURES.problems.toLocaleString('en-US')} past problems`);
    expect(html).toContain(`${ARCHIVE_FIGURES.papers} real exams`);
    expect(html).toContain(dollars(PLANS.pro.price.monthly));
    for (const [question] of FAQS) expect(html).toContain(question.replace(/&/g, '&amp;'));
  });

  it('leaves no unrendered values or stray maths markup behind', () => {
    expect(html).not.toMatch(/undefined|NaN|\[object/);
    // A dollar sign is fine before a price; anywhere else it would be a maths delimiter left in.
    expect(html.replace(/<style>[\s\S]*?<\/style>/, '')).not.toMatch(/\$(?!\d)|\\\(|\\frac/);
  });

  it('keeps every section a link can land on', () => {
    for (const id of ['top', 'idea', 'engine', 'playground', 'topics', 'archive', 'workspace', 'desk', 'plans', 'faq', 'begin']) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
