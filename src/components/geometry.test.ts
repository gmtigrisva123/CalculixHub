import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GeometryDiagram from './GeometryDiagram';
import { problems } from '../../server/data';

describe('geometry constructions', () => {
  it('preserves every stated triangle and cyclic quadrilateral side ratio', () => {
    for (const item of problems.filter(p => p.figure)) {
      const figure = item.figure!;
      const html = renderToStaticMarkup(createElement(GeometryDiagram, { figure }));
      expect(html, item.id).not.toMatch(/NaN|Infinity/);
      if (figure.kind !== 'triangle' && figure.kind !== 'quadrilateral') continue;
      const coords = html.match(/<polygon points="([^"]+)"/)![1].split(' ').map(pair => pair.split(',').map(Number));
      const sides = coords.map(([x,y], i) => Math.hypot(x - coords[(i+1)%coords.length][0], y - coords[(i+1)%coords.length][1]));
      const expected = figure.kind === 'triangle' ? [figure.values![2],figure.values![0],figure.values![1]] : figure.values!;
      const scale = sides[0] / expected[0];
      sides.forEach((side, i) => expect(side / scale, item.id).toBeCloseTo(expected[i], 8));
    }
  });
});
