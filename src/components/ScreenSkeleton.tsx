/**
 * What the content area shows while a page's code is on its way.
 *
 * Pages are fetched ahead of the click wherever possible, so this is rarely
 * seen. When it is, it holds the page's shape (a heading, a wide panel, a row
 * of cards) so the real page arrives into the space it will occupy. It stays
 * invisible for the first fifth of a second: a page that turns up that quickly
 * should not be preceded by a flash of grey.
 */
export default function ScreenSkeleton() {
  return (
    <div className="ws-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Opening the page…</span>
      <div className="ws-skeleton-head" aria-hidden="true"><i /><i /></div>
      <div className="ws-skeleton-panel" aria-hidden="true" />
      <div className="ws-skeleton-row" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
