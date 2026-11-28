import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LandingPage, { type LandingPageProps } from '../LandingPage';
import { SCENES } from '../scenes';

const NO_STATS = { registeredUsers: 0, testsCompleted: 0, problemsSolved: 0 };

const render = (liveStats: LandingPageProps['liveStats'] = NO_STATS) =>
  renderToStaticMarkup(createElement(LandingPage, { liveStats, onSignIn: () => {}, onRegister: () => {} }));

/** The attributes of every <section> in the markup, in document order. */
const sections = (html: string): Record<string, string>[] =>
  [...html.matchAll(/<section([^>]*)>/g)].map(([, attributes]) =>
    Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])));

describe('the landing v2 scene shells', () => {
  it('are all in the document from the first render, one per scene, in order', () => {
    expect(sections(render()).map(section => section.id)).toEqual(SCENES.map(scene => scene.id));
  });

  it('carry each scene’s world, scroll budget and name', () => {
    const found = sections(render());
    SCENES.forEach((scene, index) => {
      const section = found[index];
      expect(section['data-world'], scene.id).toBe(scene.world);
      expect(section['aria-label'], scene.id).toBe(scene.label);
      expect('data-pinned' in section, scene.id).toBe(scene.pinned);
      if (scene.budget === 'content') {
        expect(section['data-budget'], scene.id).toBe('content');
      } else {
        expect(section['data-budget'], scene.id).toBe('fixed');
        expect(section.style, scene.id).toContain(`--budget-desktop:${scene.budget.desktop}`);
        expect(section.style, scene.id).toContain(`--budget-mobile:${scene.budget.mobile}`);
      }
      if (scene.dawn) expect(section.style, scene.id).toContain(`--dawn:${scene.dawn}`);
    });
  });

  it('give every pinned scene a sticky stage, and only those', () => {
    const stages = render().match(/class="lx2-stage"/g) ?? [];
    expect(stages).toHaveLength(SCENES.filter(scene => scene.pinned).length);
  });

  it('never show the live stats they are handed', () => {
    const html = render({ registeredUsers: 1428, testsCompleted: 5671, problemsSolved: 98765 });
    for (const figure of ['1428', '1,428', '5671', '5,671', '98765', '98,765']) expect(html).not.toContain(figure);
  });
});
