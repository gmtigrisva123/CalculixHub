import { describe, expect, it } from 'vitest';
import { ARCHIVE_FIGURES } from '../archiveFigures';
import { SIGNUP_HREF } from '../kit';
import { renderLandingStatic } from './entry-static';

/**
 * The static first frame is the page a first visit paints before any of the
 * app's code has arrived, and the page a visitor without JavaScript keeps.
 * It must be complete and at rest on its own: nothing in it may wait for
 * code that has not come.
 */

const { markup, jsonLd } = renderLandingStatic();

/** Every word on the page, with a space wherever a tag was: for checking that a phrase appears. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** The text as a browser joins it: inline tags add nothing, a line break reads as a space. */
const reading = (html: string) => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Every opening tag, with its attributes. */
const tags = [...markup.matchAll(/<([a-z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>/g)]
  .map(([, name, attributes]) => ({ name, attributes, attr: (key: string) => attributes.match(new RegExp(`\\s${key}="([^"]*)"`))?.[1] }));

/** An inline style that keeps content out of sight: a reveal that only code could finish. */
const HIDDEN = /opacity:\s*0(?![.\d])|visibility:\s*hidden|scale[XY]?\(0\)|translate(?:[XY]|3d)?\((?!0(?:px|%)?[,)])[^)]*\)|clip-path:\s*inset\([^)]*100%/;

describe('the static first frame', () => {
  it('carries the hero headline as real text', () => {
    expect(markup).toContain('id="lx-hero-title"');
    const h1 = markup.match(/<h1[^>]*id="lx-hero-title"[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1).not.toBeNull();
    expect(reading(h1![1])).toBe('Stay with the question.');
  });

  it('numbers the headline\'s words in reading order, for the CSS entrance', () => {
    const h1 = markup.match(/<h1[^>]*id="lx-hero-title"[^>]*>([\s\S]*?)<\/h1>/)![1];
    const order = [...h1.matchAll(/class="lx-wi"[^>]*style="--i:(\d+)"/g)].map(match => Number(match[1]));
    expect(order.length).toBe(4);
    expect(order).toEqual(order.map((_, index) => index));
  });

  it('is at rest: nothing readable is hidden by an inline style', () => {
    const hidden = tags.filter(tag => HIDDEN.test(tag.attr('style') ?? ''));
    for (const tag of hidden) {
      expect(tag.attr('aria-hidden'), `<${tag.name}${tag.attributes}> hides content that only code would reveal`).toBe('true');
    }
  });

  it('shows the hero\'s figures settled, not counting from zero', () => {
    const page = text(markup);
    expect(page).toContain(ARCHIVE_FIGURES.problems.toLocaleString('en-US'));
    expect(page).toContain(String(ARCHIVE_FIGURES.papers));
    expect(page).toContain(`${ARCHIVE_FIGURES.firstYear} – ${ARCHIVE_FIGURES.lastYear}`);
  });

  it('starts the live page\'s takeover from a settled root', () => {
    const lx = tags.find(tag => /(?:^|\s)lx(?:\s|$)/.test(tag.attr('class') ?? ''));
    expect(lx?.attr('data-entrance')).toBe('');
    expect(lx?.attr('style')).toBe('--lx-elapsed:0ms;--lx-since:0ms');
  });

  it('lets a visitor sign up before any code has arrived', () => {
    const signups = tags.filter(tag => tag.name === 'a' && tag.attr('href') === SIGNUP_HREF);
    expect(signups.length).toBeGreaterThanOrEqual(3);
    expect(tags.some(tag => tag.name === 'button' && /sign|start|level/i.test(tag.attributes))).toBe(false);
  });

  it('holds the chapters\' place and carries their reading version', () => {
    expect(markup).toContain('class="lx-chapters-hold"');
    expect(markup).toContain('class="lx-reading"');
  });

  it('runs nothing: no inline script for the CSP to refuse', () => {
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+="/i);
  });

  it('gives every id once, so links to a chapter land on one place', () => {
    const ids = tags.map(tag => tag.attr('id')).filter((id): id is string => id !== undefined);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
  });

  it('renders the same HTML every time, so a build is reproducible', () => {
    expect(renderLandingStatic().markup).toBe(markup);
  });

  it('describes the page in schema.org JSON-LD', () => {
    expect(jsonLd.length).toBeGreaterThan(0);
    for (const item of jsonLd) {
      expect((item as Record<string, unknown>)['@context']).toBe('https://schema.org');
      expect(() => JSON.parse(JSON.stringify(item))).not.toThrow();
    }
  });
});
