import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** The first hex value given to a custom property in a stylesheet. */
const token = (css: string, name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1].toLowerCase();

describe('the landing v2 colour tokens', () => {
  it('use the app’s own topic hues', () => {
    const landing = read('src/features/landing/styles/tokens.css');
    // The first value in the app's tokens is its light :root; the landing keeps those at any theme.
    const app = read('src/styles/tokens.css');
    const index = read('src/index.css');
    const hues = {
      algebra: ['#c8842a', token(app, '--hu-amber-500')],
      geometry: ['#2f9c8c', token(index, '--color-proof-500')],
      combinatorics: ['#8b5cf6', token(app, '--hu-violet-500')],
      'number-theory': ['#0ea5e9', token(app, '--hu-sky-500')],
    };
    for (const [topic, [brief, theApp]] of Object.entries(hues)) {
      expect(theApp, topic).toBe(brief);
      expect(token(landing, `--topic-${topic}`), topic).toBe(brief);
    }
  });
});
