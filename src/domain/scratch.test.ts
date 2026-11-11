import { describe, expect, it } from 'vitest';
import { MAX_PAGES, clearPage, emptyPad, extendStroke, parsePad, serializePad, turnPage, undoStroke, withStroke, type ScratchStroke } from './scratch';

const line = (): ScratchStroke => ({ tool: 'pen', points: [0.1, 0.1, 0.2, 0.2] });

describe('scratch paper', () => {
  it('survives a round trip through storage', () => {
    const pad = withStroke(emptyPad(), line());
    expect(parsePad(serializePad(pad))).toEqual(pad);
  });

  it.each([
    ['nothing stored', null],
    ['text that is not JSON', '{oops'],
    ['a value of the wrong shape', '{"pages":"all of them"}'],
    ['no pages', '{"pages":[],"page":0}'],
  ])('opens a blank pad from %s', (_label, raw) => {
    expect(parsePad(raw)).toEqual(emptyPad());
  });

  it('drops strokes it cannot draw and keeps the rest', () => {
    const raw = JSON.stringify({ page: 9, pages: [[line(), { tool: 'laser', points: [0, 0] }, { tool: 'pen', points: [0.5] }, { tool: 'pen', points: [0, null] }]] });
    expect(parsePad(raw)).toEqual({ page: 0, pages: [[line()]] });
  });

  it('skips points too close together to change the line', () => {
    const stroke: ScratchStroke = { tool: 'pen', points: [] };
    expect(extendStroke(stroke, 0.5, 0.5)).toBe(true);
    expect(extendStroke(stroke, 0.5004, 0.5)).toBe(false);
    expect(extendStroke(stroke, 0.52, 0.5)).toBe(true);
    expect(stroke.points).toEqual([0.5, 0.5, 0.52, 0.5]);
  });

  it('undoes and clears only the page in view', () => {
    let pad = withStroke(withStroke(emptyPad(), line()), line());
    pad = withStroke(turnPage(pad, 1), line());
    expect(pad.page).toBe(1);
    expect(undoStroke(pad).pages).toEqual([[line(), line()], []]);
    expect(clearPage(turnPage(pad, -1)).pages).toEqual([[], [line()]]);
  });

  it('offers a new page only once the last one is written on, up to the size of the pad', () => {
    expect(turnPage(emptyPad(), 1)).toEqual(emptyPad());
    let pad = emptyPad();
    for (let page = 0; page < MAX_PAGES + 3; page++) pad = turnPage(withStroke(pad, line()), 1);
    expect(pad.pages).toHaveLength(MAX_PAGES);
    expect(turnPage({ ...pad, page: 0 }, -1).page).toBe(0);
  });
});
