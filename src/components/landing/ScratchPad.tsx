/**
 * Scratch paper, under the problem.
 *
 * Contest maths is done by hand, so the workspace keeps a sheet of squared
 * paper beside every problem. This is that sheet, running on the same drawing
 * code (src/domain/scratch.ts): strokes are kept as points, the eraser cuts
 * through what is under it, and the paper itself is drawn by CSS.
 *
 * Unlike the workspace's, this sheet is not saved anywhere. It is working out,
 * and it is gone when the page is.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { drawPage, extendStroke, type ScratchInk, type ScratchStroke, type ScratchTool } from '../../domain/scratch';

const TOOLS: readonly { tool: ScratchTool; label: string }[] = [
  { tool: 'pen', label: 'Pen' },
  { tool: 'accent', label: 'Red pen' },
  { tool: 'mark', label: 'Highlighter' },
  { tool: 'eraser', label: 'Eraser' },
];

/** The pens are the page's own colours, read from its tokens so the canvas cannot drift from the stylesheet. */
function inkFrom(node: Element): ScratchInk {
  const style = getComputedStyle(node);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return { pen: token('--color-ink'), accent: token('--color-accent'), mark: token('--color-highlight') };
}

export default function ScratchPad({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ScratchTool>('pen');
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const live = useRef<ScratchStroke | null>(null);
  const ink = useRef<ScratchInk | null>(null);
  // The sheet's size in CSS pixels, measured when it changes rather than on every stroke.
  const size = useRef({ width: 0, height: 0 });

  const paint = useCallback(() => {
    const node = canvas.current;
    const { width, height } = size.current;
    if (!node || !width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    if (node.width !== Math.round(width * density) || node.height !== Math.round(height * density)) {
      node.width = Math.round(width * density);
      node.height = Math.round(height * density);
    }
    const context = node.getContext('2d');
    if (!context) return;
    ink.current ??= inkFrom(node);
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    drawPage(context, live.current ? [...strokesRef.current, live.current] : strokesRef.current, width, ink.current);
  }, []);

  useEffect(() => { paint(); }, [strokes, paint]);
  useEffect(() => {
    const node = canvas.current;
    if (!node || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => {
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      paint();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [paint]);

  // Points are fractions of the sheet's width, as the workspace stores them.
  const at = (event: { clientX: number; clientY: number }, target: HTMLCanvasElement) => {
    const box = target.getBoundingClientRect();
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.width] as const;
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    live.current = { tool, points: [] };
    extendStroke(live.current, ...at(event, event.currentTarget));
    paint();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    let changed = false;
    for (const sample of samples.length ? samples : [event.nativeEvent]) changed = extendStroke(live.current, ...at(sample, event.currentTarget)) || changed;
    if (changed) paint();
  };
  const end = () => {
    const stroke = live.current;
    live.current = null;
    if (stroke && stroke.points.length >= 2) setStrokes(current => [...current, stroke]);
  };

  return (
    <div className="p1-scratch" id={id}>
      <canvas
        ref={canvas}
        className={`p1-scratch-sheet is-${tool}`}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        role="img"
        aria-label="Scratch paper. Draw on it with a mouse, a finger or a stylus."
      />
      <div className="p1-scratch-tools">
        <div role="radiogroup" aria-label="Pen">
          {TOOLS.map(({ tool: value, label }) => (
            <button key={value} type="button" role="radio" aria-checked={tool === value} aria-label={label} title={label} className={`p1-scratch-tool is-${value}`} onClick={() => setTool(value)}>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <button type="button" className="p1-textbtn" onClick={() => setStrokes(current => current.slice(0, -1))} disabled={strokes.length === 0}>Undo</button>
        <button type="button" className="p1-textbtn" onClick={() => setStrokes([])} disabled={strokes.length === 0}>Clear</button>
      </div>
    </div>
  );
}
