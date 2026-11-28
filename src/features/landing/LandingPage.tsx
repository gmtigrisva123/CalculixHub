/**
 * Landing v2, «Signal» (docs/landing-v2-brief.md).
 *
 * Built behind a flag (`?landing=v2`, see src/components/Welcome.tsx) until it
 * replaces src/components/landing in Phase 7, and loaded with the same props.
 *
 * For now the page is only its scene shells: one <section> per scene, as tall
 * as the registry says, so the page has its full length from the first render
 * (§9.4). Nothing is drawn and nothing moves yet.
 */

import type { CSSProperties } from 'react';
import { SCENES, type Scene } from './scenes';
import './styles/tokens.css';
import './styles/layout.css';

export interface LandingPageProps {
  /**
   * Platform totals, passed by Welcome.tsx. Never shown: they read zero today,
   * and the page quotes no figure it cannot source (§2).
   */
  liveStats: { registeredUsers: number; testsCompleted: number; problemsSolved: number };
  onSignIn: () => void;
  onRegister: () => void;
}

export default function LandingPage(_props: LandingPageProps) {
  return (
    <div className="lx2">
      <main>
        {SCENES.map(scene => <SceneShell key={scene.id} scene={scene} />)}
      </main>
    </div>
  );
}

/**
 * One scene's section. A budget in svh is handed to CSS as `--budget-desktop`
 * and `--budget-mobile`, and layout.css picks one by width. Until a scene has
 * its heading it is named by its label; `aria-labelledby` comes with the heading.
 */
function SceneShell({ scene }: { scene: Scene }) {
  const style = {
    ...(scene.budget === 'content' ? {} : { '--budget-desktop': scene.budget.desktop, '--budget-mobile': scene.budget.mobile }),
    ...(scene.dawn ? { '--dawn': scene.dawn } : {}),
  } as CSSProperties;
  return (
    <section
      id={scene.id}
      className="lx2-scene"
      data-world={scene.world}
      data-budget={scene.budget === 'content' ? 'content' : 'fixed'}
      data-pinned={scene.pinned || undefined}
      style={style}
      aria-label={scene.label}
    >
      {scene.pinned && <div className="lx2-stage" />}
    </section>
  );
}
