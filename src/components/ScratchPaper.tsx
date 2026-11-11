/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scratch paper: a sheet you can pull over any page and think on with a pen.
 *
 * Contest mathematics is done on paper, and a text box is a poor substitute
 * for drawing the triangle. The sheet docks beside the page rather than over
 * it, with no backdrop, so the problem stays readable while you work. Press S
 * anywhere (outside a text field) to bring it out or put it away.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eraser, Highlighter, Pen, Plus, Trash2, Undo2, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  MAX_PAGES, SCRATCH_STORAGE, clearPage, drawPage, emptyPad, extendStroke, pageIsFull, parsePad, serializePad, turnPage, undoStroke, withStroke,
  type ScratchInk, type ScratchPad, type ScratchStroke, type ScratchTool,
} from '../domain/scratch';
import '../styles/scratch.css';

interface ScratchPaperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOOLS: readonly { tool: ScratchTool; label: string; Icon: typeof Pen }[] = [
  { tool: 'pen', label: 'Pen', Icon: Pen },
  { tool: 'accent', label: 'Red pen', Icon: Pen },
  { tool: 'mark', label: 'Highlighter', Icon: Highlighter },
  { tool: 'eraser', label: 'Eraser', Icon: Eraser },
];

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function loadPad(): ScratchPad {
  try { return parsePad(localStorage.getItem(SCRATCH_STORAGE)); } catch { return emptyPad(); }
}

export default function ScratchPaper({ open, onOpenChange }: ScratchPaperProps) {
  const { resolved } = useTheme();
  const [pad, setPad] = useState<ScratchPad>(loadPad);
  const [tool, setTool] = useState<ScratchTool>('pen');
  const [full, setFull] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<ScratchStroke | null>(null);
  const frame = useRef(0);
  const padRef = useRef(pad);
  padRef.current = pad;

  const strokes = pad.pages[pad.page] ?? [];

  const ink = useCallback((): ScratchInk => {
    const style = getComputedStyle(sheet.current ?? document.documentElement);
    const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    return { pen: read('--scratch-pen', '#22333b'), accent: read('--scratch-accent', '#c2552d'), mark: read('--scratch-mark', '#e6bd73') };
  }, []);

  /** Size the bitmap to the sheet and the screen's pixel density, then draw the page and the stroke in hand. */
  const paint = useCallback(() => {
    const node = canvas.current;
    if (!node) return;
    const width = node.clientWidth, height = node.clientHeight;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 3);
    if (node.width !== Math.round(width * density) || node.height !== Math.round(height * density)) {
      node.width = Math.round(width * density);
      node.height = Math.round(height * density);
    }
    const context = node.getContext('2d');
    if (!context) return;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    const current = padRef.current.pages[padRef.current.page] ?? [];
    drawPage(context, live.current ? [...current, live.current] : current, width, ink());
  }, [ink]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

  // Redraw whenever what is on the page, the theme's ink or the sheet's size changes.
  useLayoutEffect(() => { if (open) paint(); }, [open, pad, resolved, paint]);
  useEffect(() => {
    const node = canvas.current;
    if (!open || !node) return;
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, [open, schedule]);

  // Kept in this browser. A full or unavailable store loses nothing on screen; it just is not there next time.
  useEffect(() => {
    try { localStorage.setItem(SCRATCH_STORAGE, serializePad(pad)); setFull(false); } catch { setFull(true); }
  }, [pad]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        if (open && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !typing(event.target)) { event.preventDefault(); setPad(undoStroke); }
        return;
      }
      if (typing(event.target) || document.querySelector('dialog[open]')) return;
      if (event.key === 's' || event.key === 'S') { event.preventDefault(); onOpenChange(!open); }
      else if (event.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open, onOpenChange]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.width] as const;
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || pageIsFull(strokes)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = position(event);
    live.current = { tool, points: [] };
    extendStroke(live.current, x, y);
    schedule();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    // A stylus or fast mouse reports several positions per frame; using them all keeps curves round.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    let changed = false;
    for (const sample of events.length ? events : [event.nativeEvent]) {
      const box = event.currentTarget.getBoundingClientRect();
      changed = extendStroke(live.current, (sample.clientX - box.left) / box.width, (sample.clientY - box.top) / box.width) || changed;
    }
    if (changed) schedule();
  };
  const end = () => {
    const stroke = live.current;
    live.current = null;
    if (stroke && stroke.points.length >= 2) setPad(current => withStroke(current, stroke));
  };

  /** The page as a picture: paper first, then the ink, so erased areas show paper rather than nothing. */
  const download = () => {
    const node = canvas.current;
    if (!node) return;
    const width = 1600, height = Math.round(width * node.clientHeight / Math.max(node.clientWidth, 1));
    const inkLayer = Object.assign(document.createElement('canvas'), { width, height });
    const inkContext = inkLayer.getContext('2d');
    const output = Object.assign(document.createElement('canvas'), { width, height });
    const context = output.getContext('2d');
    if (!inkContext || !context) return;
    drawPage(inkContext, strokes, width, ink());
    context.fillStyle = getComputedStyle(sheet.current ?? document.documentElement).getPropertyValue('--scratch-paper').trim() || '#fdfcf7';
    context.fillRect(0, 0, width, height);
    context.drawImage(inkLayer, 0, 0);
    const link = document.createElement('a');
    link.href = output.toDataURL('image/png');
    link.download = `scratch-page-${pad.page + 1}.png`;
    link.click();
  };

  const lastPage = pad.page === pad.pages.length - 1;
  const canAdd = lastPage && strokes.length > 0 && pad.pages.length < MAX_PAGES;

  return (
    <aside ref={sheet} className={`scratch${open ? ' is-open' : ''}`} aria-label="Scratch paper" aria-hidden={!open} inert={!open}>
      <header className="scratch-head">
        <div>
          <h2>Scratch paper</h2>
          <p>Only on this device. Press <kbd>S</kbd> to tuck it away.</p>
        </div>
        <div className="scratch-pages" aria-label="Pages">
          <button type="button" onClick={() => setPad(current => turnPage(current, -1))} disabled={pad.page === 0} aria-label="Previous page"><ChevronLeft size={17} /></button>
          <span aria-live="polite">{pad.page + 1}<i>/</i>{pad.pages.length}</span>
          {lastPage
            ? <button type="button" onClick={() => setPad(current => turnPage(current, 1))} disabled={!canAdd} aria-label="New page" title={canAdd ? 'New page' : pad.pages.length >= MAX_PAGES ? 'That is the whole pad' : 'Write on this page first'}><Plus size={17} /></button>
            : <button type="button" onClick={() => setPad(current => turnPage(current, 1))} aria-label="Next page"><ChevronRight size={17} /></button>}
        </div>
        <button type="button" className="scratch-close" onClick={() => onOpenChange(false)} aria-label="Close scratch paper"><X size={19} /></button>
      </header>

      <div className="scratch-sheet">
        <canvas ref={canvas} className={`scratch-canvas is-${tool}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          role="img" aria-label={strokes.length ? `Scratch page ${pad.page + 1}, with ${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}` : `Scratch page ${pad.page + 1}, blank`} />
        {strokes.length === 0 && <p className="scratch-invite" aria-hidden="true">Draw it out.<span>Nobody’s marking this.</span></p>}
        {full && <p className="scratch-full" role="status">This browser’s storage is full, so new strokes won’t be here next time.</p>}
      </div>

      <footer className="scratch-tools">
        <div role="radiogroup" aria-label="Tool">
          {TOOLS.map(({ tool: value, label, Icon }) => (
            <button key={value} type="button" role="radio" aria-checked={tool === value} aria-label={label} title={label} className={`is-${value}`} onClick={() => setTool(value)}><Icon size={18} /></button>
          ))}
        </div>
        <div>
          <button type="button" onClick={() => setPad(undoStroke)} disabled={strokes.length === 0} aria-label="Undo" title="Undo"><Undo2 size={18} /></button>
          <button type="button" onClick={() => setPad(clearPage)} disabled={strokes.length === 0} aria-label="Clear this page" title="Clear this page"><Trash2 size={18} /></button>
          <button type="button" onClick={download} disabled={strokes.length === 0} aria-label="Save page as an image" title="Save as an image"><Download size={18} /></button>
        </div>
      </footer>
    </aside>
  );
}
