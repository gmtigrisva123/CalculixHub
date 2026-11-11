/**
 * The landing page arrives in two parts.
 *
 * The first is the nav, the hero and the sheet that slides over it: everything
 * on the first two screens. The second is the nine chapters below, which bring
 * the maths typesetter and most of the page's markup with them. Mounting all
 * of it at once kept the browser busy for long enough that the hero's entrance
 * had to wait for it, on the screens where that wait is longest.
 *
 * So the chapters are mounted a moment later: once the headline has landed, or
 * at once if the reader shows any sign of leaving the first screen (a wheel
 * tick, a touch, a key, a link to a chapter). This file is the small piece of
 * shared state that lets a link ask for them and wait until they exist.
 */

let mounted = false;
let demand: (() => void) | null = null;
const waiting: (() => void)[] = [];

/** The page registers how to bring the chapters in now. */
export function onChapterDemand(handler: (() => void) | null): void {
  demand = handler;
  if (!handler) mounted = false;
}

/** The page reports that the chapters are in the document. */
export function chaptersMounted(): void {
  mounted = true;
  for (const resolve of waiting.splice(0)) resolve();
}

/** Resolves once the chapters are in the document, without asking for them. */
export function afterChapters(): Promise<void> {
  return mounted ? Promise.resolve() : new Promise(resolve => { waiting.push(resolve); });
}

/** Resolves once the chapters are in the document, asking for them if they are not. */
export function whenChapters(): Promise<void> {
  if (mounted) return Promise.resolve();
  demand?.();
  return new Promise(resolve => { waiting.push(resolve); });
}
