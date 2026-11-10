/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scratch paper: what is kept, and how.
 *
 * Strokes are stored as points, not pixels. A page of working is a few
 * kilobytes that way instead of a few megabytes, it redraws sharp at any size
 * or pixel density, and undo is "drop the last stroke" rather than a stack of
 * bitmaps. Points are fractions of the sheet's width, so a page drawn on a
 * laptop reads the same on a phone.
 *
 * Everything lives in this browser. Scratch work is thinking, not a record,
 * and nobody else needs to see it.
 */

export type ScratchTool = 'pen' | 'accent' | 'mark' | 'eraser';

export interface ScratchStroke {
  tool: ScratchTool;
  /** x0, y0, x1, y1, ... in units of the sheet's width, rounded to 4 places. */
  points: number[];
}

export interface ScratchPad {
  pages: ScratchStroke[][];
  page: number;
}

export const SCRATCH_STORAGE = 'calculix_scratch_v1';
export const MAX_PAGES = 12;
/** Past this a single page would crowd out the rest of local storage. */
const MAX_POINTS_PER_PAGE = 60_000;

/** Width of each tool's line, as a fraction of the sheet's width. */
export const TOOL_WIDTH: Record<ScratchTool, number> = { pen: 0.0052, accent: 0.0052, mark: 0.03, eraser: 0.045 };

export const emptyPad = (): ScratchPad => ({ pages: [[]], page: 0 });

const TOOLS: readonly string[] = ['pen', 'accent', 'mark', 'eraser'];

/** Anything read back from storage is checked: a hand-edited or truncated value must not crash the sheet. */
export function parsePad(raw: string | null): ScratchPad {
  if (!raw) return emptyPad();
  try {
    const value = JSON.parse(raw) as Partial<ScratchPad>;
    if (!Array.isArray(value.pages)) return emptyPad();
    const pages = value.pages.slice(0, MAX_PAGES).map(page => (Array.isArray(page) ? page : []).filter((stroke): stroke is ScratchStroke =>
      Boolean(stroke) && TOOLS.includes(stroke.tool) && Array.isArray(stroke.points) && stroke.points.length >= 2 && stroke.points.length % 2 === 0 && stroke.points.every(Number.isFinite)));
    if (pages.length === 0) return emptyPad();
    const page = Number.isInteger(value.page) ? Math.min(pages.length - 1, Math.max(0, value.page as number)) : 0;
    return { pages, page };
  } catch {
    return emptyPad();
  }
}

export const serializePad = (pad: ScratchPad): string => JSON.stringify(pad);

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Add a point to a stroke in progress, skipping ones too close to the last to change the line. */
export function extendStroke(stroke: ScratchStroke, x: number, y: number): boolean {
  const { points } = stroke;
  const count = points.length;
  if (count >= 2 && Math.hypot(x - points[count - 2], y - points[count - 1]) < 0.0015) return false;
  points.push(round(x), round(y));
  return true;
}

export const pointCount = (page: ScratchStroke[]): number => page.reduce((total, stroke) => total + stroke.points.length / 2, 0);
export const pageIsFull = (page: ScratchStroke[]): boolean => pointCount(page) >= MAX_POINTS_PER_PAGE;

export function withStroke(pad: ScratchPad, stroke: ScratchStroke): ScratchPad {
  const pages = pad.pages.map((page, index) => (index === pad.page ? [...page, stroke] : page));
  return { ...pad, pages };
}

export function undoStroke(pad: ScratchPad): ScratchPad {
  const pages = pad.pages.map((page, index) => (index === pad.page ? page.slice(0, -1) : page));
  return { ...pad, pages };
}

export function clearPage(pad: ScratchPad): ScratchPad {
  const pages = pad.pages.map((page, index) => (index === pad.page ? [] : page));
  return { ...pad, pages };
}

/** Turn to another page, adding a blank one when stepping past the last. */
export function turnPage(pad: ScratchPad, delta: number): ScratchPad {
  const target = pad.page + delta;
  if (target < 0) return pad;
  if (target < pad.pages.length) return { ...pad, page: target };
  // A new sheet is only offered once the last one has been written on.
  if (pad.pages.length >= MAX_PAGES || pad.pages[pad.pages.length - 1].length === 0) return pad;
  return { pages: [...pad.pages, []], page: pad.pages.length };
}

export interface ScratchInk { pen: string; accent: string; mark: string }

/**
 * Draw one page. Coordinates are scaled by `width`; the eraser cuts through
 * whatever is beneath it, which is why the paper itself is drawn by CSS (or by
 * the caller, for an exported image) and never onto this canvas.
 */
export function drawPage(context: CanvasRenderingContext2D, strokes: readonly ScratchStroke[], width: number, ink: ScratchInk): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    const { points, tool } = stroke;
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    context.globalAlpha = tool === 'mark' ? 0.32 : 1;
    context.strokeStyle = tool === 'eraser' ? '#000' : ink[tool];
    context.fillStyle = context.strokeStyle;
    context.lineWidth = TOOL_WIDTH[tool] * width;
    if (points.length === 2) {
      // A tap: a dot, so a decimal point or the dot of an "i" is not lost.
      context.beginPath();
      context.arc(points[0] * width, points[1] * width, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(points[0] * width, points[1] * width);
    // Each segment curves through the midpoint of the next, so a fast hand draws arcs, not corners.
    for (let index = 2; index < points.length - 2; index += 2) {
      const midX = (points[index] + points[index + 2]) / 2 * width;
      const midY = (points[index + 1] + points[index + 3]) / 2 * width;
      context.quadraticCurveTo(points[index] * width, points[index + 1] * width, midX, midY);
    }
    context.lineTo(points[points.length - 2] * width, points[points.length - 1] * width);
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
}
