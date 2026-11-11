import { useLayoutEffect } from 'react';
import BrandLogo from '../components/BrandLogo';
import { liftBoot } from './boot';

/**
 * Rendered by each screen that can be the first one shown. Mounting it means
 * that screen is in the document, so the cover painted by index.html can go.
 */
export default function BootLift() {
  useLayoutEffect(() => { liftBoot(); }, []);
  return null;
}

/**
 * The same quiet ground the cover shows, for the rare wait after the cover has
 * gone: signing in before the workspace's code has arrived, for instance. Its
 * styles are the inline ones in index.html, so it can never arrive unstyled.
 */
export function BootHold({ label }: { label: string }) {
  return (
    <main className="boot-hold" role="status" aria-live="polite">
      <span className="boot-mark" aria-hidden="true"><BrandLogo /></span>
      <span className="boot-sr">{label}</span>
    </main>
  );
}
