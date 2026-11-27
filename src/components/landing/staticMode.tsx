/**
 * Static mode: the landing page rendered once, at build time, into the HTML.
 *
 * The production build renders the nav, the hero, the sheet and the footer
 * into dist/index.html (scripts/landing-static-plugin.mjs), so the first paint
 * is the hero itself rather than a cover waiting for the bundles. Those
 * components render here with no motion state at all: every element in its
 * settled place and visible, so a visitor without JavaScript reads the page as
 * it was meant to look. The hero's entrance needs no script either: it is CSS,
 * keyed on attributes the inline boot script sets (landing-entrance.css).
 *
 * The same components render live in the browser. Only what moves with the
 * scroll, and what answers a click, differs between the two.
 */

import { createContext, useContext, type ReactNode } from 'react';

const StaticContext = createContext(false);

export function StaticRender({ children }: { children: ReactNode }) {
  return <StaticContext.Provider value={true}>{children}</StaticContext.Provider>;
}

/** True while the page is being rendered into the HTML at build time. */
export const useStatic = (): boolean => useContext(StaticContext);
