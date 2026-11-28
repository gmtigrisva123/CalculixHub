import { describe, expect, it } from 'vitest';
import { COPY } from '../copy';
import { FORM_IDS } from '../gl/swarm/forms';
import { SCENES, type SceneId } from '../scenes';

type Row = [SceneId, 'night' | 'day', [number, number] | 'content', boolean, string, 'left' | 'right' | 'center'];

// docs/landing-v2-brief.md §9.4, row by row: id, world, budget in svh
// (desktop, phone), sticky stage, form, the side the text is on.
const TABLE: Row[] = [
  ['top', 'night', [100, 100], false, 'cloud', 'left'],
  ['how-it-works', 'night', [300, 220], true, 'posterior', 'left'],
  ['try', 'night', 'content', false, 'figure-algebra', 'right'],
  ['why', 'night', [160, 130], true, 'layers', 'left'],
  ['tutor', 'night', [120, 110], true, 'quiet', 'left'],
  ['map', 'night', [180, 140], true, 'constellation', 'left'],
  ['archive', 'night', [240, 170], true, 'tunnel', 'center'],
  ['arena', 'night', [130, 110], true, 'track', 'left'],
  ['plans', 'day', 'content', false, 'grid', 'center'],
  ['faq', 'day', 'content', false, 'grid', 'left'],
  ['begin', 'night', [130, 110], true, 'mark', 'center'],
];

describe('the landing v2 scene registry', () => {
  it('holds the eleven scenes of the brief, in page order, as its table gives them', () => {
    const rows = SCENES.map(({ id, world, budget, pinned, form, textSide }) =>
      [id, world, budget === 'content' ? 'content' : [budget.desktop, budget.mobile], pinned, form, textSide]);
    expect(rows).toEqual(TABLE);
  });

  it('gives every scene its own id and its name from copy.ts', () => {
    expect(new Set(SCENES.map(scene => scene.id)).size).toBe(SCENES.length);
    for (const scene of SCENES) expect(scene.label).toBe(COPY.scenes[scene.id]);
    expect(Object.keys(COPY.scenes).sort()).toEqual(SCENES.map(scene => scene.id).sort());
  });

  it('adds up to the scroll the brief budgets', () => {
    const fixed = SCENES.flatMap(scene => (scene.budget === 'content' ? [] : [scene.budget]));
    expect(fixed.reduce((sum, budget) => sum + budget.desktop, 0)).toBe(1360);
    expect(fixed.reduce((sum, budget) => sum + budget.mobile, 0)).toBe(1090);
    // Plans opens on 60svh of clear ground for the dawn (§10.9); no other scene has one.
    expect(SCENES.filter(scene => scene.dawn).map(scene => [scene.id, scene.dawn])).toEqual([['plans', 60]]);
  });

  it('only uses forms that exist, with posterior where the shader expects it', () => {
    expect(FORM_IDS).toHaveLength(14);
    expect(new Set(FORM_IDS).size).toBe(FORM_IDS.length);
    expect(FORM_IDS.indexOf('cloud')).toBe(0);
    expect(FORM_IDS.indexOf('posterior')).toBe(1);
    for (const scene of SCENES) expect(FORM_IDS).toContain(scene.form);
  });
});
