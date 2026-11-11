/**
 * The ground the page is printed on, changing colour as the story moves.
 *
 * Each chapter has a tone: cool morning paper after the engine, parchment in
 * the archive, sage in the workspace, cream by the prices, and a dusk that
 * gathers whenever a night stage is about to fill the screen. Scrolling does
 * not jump from one to the next. Every tone is a full-screen wash, and the
 * scroll only changes how opaque each one is. As one chapter leaves and the
 * next arrives their washes cross-fade, so the colour under the text is always
 * on its way from the last one to the next.
 *
 * How it stays cheap:
 *
 *   - Opacity is the only property that changes, and the compositor can blend
 *     a layer at a new opacity without repainting it.
 *   - At most two washes are ever visible. The rest are `visibility: hidden`,
 *     so they are not layers at all and cost no memory. (A first version kept
 *     all eight alive with `will-change`; eight screen-sized textures cost
 *     more than the effect was worth, most of all on a phone.)
 *   - Section positions are measured when the page's height changes, not on
 *     scroll. A scroll frame is a few subtractions and, usually, no DOM write:
 *     each opacity is rounded to a hundredth and written only when it differs
 *     from what is already there.
 *
 * The washes sit behind everything (z-index -1 inside the content sheet), take
 * no pointer events and are hidden from assistive technology.
 */

import { useCallback, useLayoutEffect, useRef } from 'react';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

/** A chapter's id on the page, and the tone that belongs to it. */
const TONES = [
  { id: 'playground', tone: 'morning' },
  { id: 'topics', tone: 'dusk' },
  { id: 'archive', tone: 'parchment' },
  { id: 'workspace', tone: 'sage' },
  { id: 'desk', tone: 'lamplight' },
  { id: 'plans', tone: 'cream' },
  { id: 'faq', tone: 'morning' },
  { id: 'begin', tone: 'dusk' },
] as const;

/** The share of a chapter's passage spent fading in, and again fading out. */
const EDGE = 0.2;

interface Band { top: number; bottom: number }

/**
 * How present a chapter's tone is at scroll position `y`.
 *
 * Its passage runs from its top edge entering at the foot of the screen to its
 * bottom edge leaving at the top. The tone fades in over the first fifth of
 * that, holds, and fades out over the last fifth. The next chapter is fading
 * in over the same stretch of scroll, which is what makes it a cross-fade.
 */
export function toneAt(band: Band | null, y: number, viewport: number): number {
  if (!band) return 0;
  const passage = (y + viewport - band.top) / (band.bottom - band.top + viewport);
  if (passage <= 0 || passage >= 1) return 0;
  return Math.min(1, passage / EDGE, (1 - passage) / EDGE);
}

export default function GroundTones() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const bands = useRef<(Band | null)[]>([]);
  const written = useRef<string[]>([]);
  const { scrollY } = useScroll();

  const apply = useCallback((y: number) => {
    const layers = root.current?.children;
    if (!layers) return;
    const viewport = window.innerHeight;
    for (let index = 0; index < TONES.length; index += 1) {
      const value = toneAt(bands.current[index] ?? null, y, viewport).toFixed(2);
      if (value === written.current[index]) continue;
      written.current[index] = value;
      const layer = layers[index] as HTMLElement;
      layer.style.opacity = value;
      layer.style.visibility = value === '0.00' ? 'hidden' : 'visible';
    }
  }, []);

  // Where each chapter sits on the page. Re-read whenever the page's height changes
  // (a resize, a font arriving, an FAQ answer opening), never while scrolling.
  useLayoutEffect(() => {
    if (reduce) return;
    const measure = () => {
      const y = window.scrollY;
      bands.current = TONES.map(({ id }) => {
        const box = document.getElementById(id)?.getBoundingClientRect();
        return box ? { top: box.top + y, bottom: box.bottom + y } : null;
      });
      apply(y);
    };
    measure();
    const page = root.current?.parentElement;
    if (!page || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [apply, reduce]);

  useMotionValueEvent(scrollY, 'change', y => { if (!reduce) apply(y); });

  // With reduced motion the page keeps its one paper ground: a colour that shifts under the text is motion too.
  if (reduce) return null;
  return (
    <div className="lx-ground" ref={root} aria-hidden="true">
      {TONES.map(({ id, tone }) => <i key={id} className={`lx-ground-tone is-${tone}`} />)}
    </div>
  );
}
