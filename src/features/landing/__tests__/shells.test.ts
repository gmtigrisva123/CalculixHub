import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LandingPage, { type LandingPageProps } from '../LandingPage';
import { SCENES } from '../scenes';

const NO_STATS = { registeredUsers: 0, testsCompleted: 0, problemsSolved: 0 };

const render = (liveStats: LandingPageProps['liveStats'] = NO_STATS) =>
  renderToStaticMarkup(createElement(LandingPage, { liveStats, onSignIn: () => {}, onRegister: () => {} }));

interface Shell {
  attributes: Record<string, string>;
  /** The inline style, one entry per declaration. */
  style: Record<string, string>;
  inner: string;
}

/** Every <section> in the markup, in document order. */
const shells = (html: string): Shell[] =>
  [...html.matchAll(/<section([^>]*)>(.*?)<\/section>/g)].map(([, rawAttributes, inner]) => {
    const attributes = Object.fromEntries([...rawAttributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
    const style = Object.fromEntries((attributes.style ?? '').split(';').filter(Boolean).map(declaration => {
      const colon = declaration.indexOf(':');
      return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
    }));
    return { attributes, style, inner };
  });

describe('the landing v2 scene shells', () => {
  it('are all in the document from the first render, one per scene, in order', () => {
    expect(shells(render()).map(shell => shell.attributes.id)).toEqual(SCENES.map(scene => scene.id));
  });

  it('carry exactly each scene’s world, scroll budget and name', () => {
    const found = shells(render());
    SCENES.forEach((scene, index) => {
      const { attributes, style } = found[index];
      expect(attributes['data-world'], scene.id).toBe(scene.world);
      expect(attributes['aria-label'], scene.id).toBe(scene.label);
      expect('data-pinned' in attributes, scene.id).toBe(scene.pinned);
      expect(attributes['data-budget'], scene.id).toBe(scene.budget === 'content' ? 'content' : 'fixed');
      const expected: Record<string, string> = {};
      if (scene.budget !== 'content') {
        expected['--budget-desktop'] = String(scene.budget.desktop);
        expected['--budget-mobile'] = String(scene.budget.mobile);
      }
      if (scene.dawn) expected['--dawn'] = String(scene.dawn);
      expect(style, scene.id).toEqual(expected);
    });
  });

  it('are empty, but for a sticky stage in each pinned scene', () => {
    const found = shells(render());
    SCENES.forEach((scene, index) => {
      expect(found[index].inner, scene.id).toBe(scene.pinned ? '<div class="lx2-stage"></div>' : '');
    });
  });

  it('never show the live stats they are handed', () => {
    const html = render({ registeredUsers: 1428, testsCompleted: 5671, problemsSolved: 98765 });
    for (const figure of ['1428', '1,428', '5671', '5,671', '98765', '98,765']) expect(html).not.toContain(figure);
  });
});
