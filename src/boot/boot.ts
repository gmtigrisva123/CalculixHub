/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The first frame.
 *
 * index.html paints a ground before any script has loaded: night for a visitor
 * about to see the landing page, the workspace's paper and rails for someone
 * coming back to their work. It is a single fixed element, `#boot`, drawn by
 * inline CSS, so it appears with the HTML itself. The page then never shows
 * white, and never shows a ground of the wrong colour that has to be corrected.
 *
 * Which ground to paint is decided by the inline script in index.html and left
 * on `<html data-boot>`. This module reads that decision so the app can fetch
 * the right code first, and it lifts the cover once a real screen is drawn.
 */

export type BootVariant = 'landing' | 'workspace' | 'paper';

const read = (): BootVariant => {
  const value = typeof document === 'undefined' ? null : document.documentElement.dataset.boot;
  return value === 'workspace' || value === 'paper' ? value : 'landing';
};

/** The screen this visit opens on, as far as it can be known before sign-in is checked. */
export const bootVariant: BootVariant = read();

let lifted = false;

/**
 * Lift the cover. Called from a layout effect of the first real screen, so the
 * screen is already in the document underneath when the fade starts. Calling it
 * again does nothing.
 */
export function liftBoot(): void {
  if (lifted || typeof document === 'undefined') return;
  lifted = true;
  const cover = document.getElementById('boot');
  if (!cover) return;
  const remove = () => cover.remove();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { remove(); return; }
  // Two frames: one for the screen underneath to paint, one to start from a
  // settled opacity. Without them the fade can begin before the first real
  // frame exists, which reads as a blink.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cover.classList.add('is-leaving');
    cover.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 700);
  }));
}

/** Whether the cover is still up. The landing hero waits for it before it starts to move. */
export const bootLifted = (): boolean => lifted;

/**
 * Remove the static first frame: the landing's first two screens, written into
 * the HTML at build time (scripts/landing-static-plugin.mjs) so that a first
 * visit paints the hero itself instead of a cover. Called from the layout
 * effect of the first real screen, in the same commit that put that screen in
 * the document, so no frame is ever painted with neither of them. When that
 * screen is the landing, it is the same markup, continuing the same entrance
 * (src/components/landing/entrance.ts). Calling it again does nothing.
 *
 * Unlike the cover it is never removed on a timer: if the page's code never
 * arrives, the static frame is the best thing left to read.
 */
export function dropStaticFrame(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('lx-static')?.remove();
}

// A visit that will not open on the landing (index.html's boot script decided)
// has no use for its static frame; it was never shown, so it goes at once.
if (typeof document !== 'undefined' && document.documentElement.dataset.landing === undefined) dropStaticFrame();

// If nothing ever asks for the cover to lift (a script failed, say), it must
// not sit over the page for good.
if (typeof window !== 'undefined') window.setTimeout(liftBoot, 12000);
