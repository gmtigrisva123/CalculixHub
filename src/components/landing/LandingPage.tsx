/**
 * The public front page: a contest paper a visitor can sit.
 *
 * The page is laid out as what its readers know best, a typeset paper, and it
 * opens on a problem rather than a pitch. The problem is real, the engine that
 * chooses and marks it is the product's own, and the curve under it is that
 * engine's belief about whoever is answering. Everything below the first
 * screen explains what just happened and what else is inside: how the engine
 * works (with a whole placement printed out), a theorem to pick up and turn,
 * the archive year by year, a contest date turned into a plan, the fees, and
 * the questions people ask before signing up.
 *
 * It is one page of ordinary document flow. Nothing is pinned to the scroll,
 * nothing waits for the reader to arrive before it exists, and the browser
 * keeps charge of scrolling. The one entrance is the hill in Fig. 1 lifting
 * off its axis.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import Hero from './Hero';
import Masthead from './Masthead';
import { goTo } from './kit';
import { whenIdle } from '../../lib/lazy';
import '../../styles/landing-paper.css';

/*
 * The sections under the first screen are one more piece of code, asked for
 * as soon as this file runs so the download overlaps the hero's first paint.
 * They are mounted once the hero is on screen and the browser has a quiet
 * moment, or at once if the visit arrived with a section in its address.
 */
const below = () => import('./Below');
const Below = lazy(below);
void below().catch(() => undefined);

interface LandingPageProps {
  /** Kept for the callers that pass it; the page quotes the archive's figures, not live counts. */
  liveStats?: { registeredUsers: number; testsCompleted: number; problemsSolved: number };
  onSignIn: () => void;
  onRegister: () => void;
}

export default function LandingPage({ onSignIn, onRegister }: LandingPageProps) {
  const linked = typeof window !== 'undefined' && window.location.hash.length > 1;
  const [rest, setRest] = useState(linked);

  useEffect(() => {
    if (rest) return;
    return whenIdle(() => setRest(true), 500);
  }, [rest]);

  return (
    <div className="p1">
      <a className="p1-skip" href="#top">Skip to the paper</a>
      <Masthead onSignIn={onSignIn} onRegister={onRegister} />
      <main>
        <Hero onRegister={onRegister} />
        {rest
          ? <Suspense fallback={<div className="p1-below-hold" aria-hidden="true" />}><Below onRegister={onRegister} onSignIn={onSignIn} onReady={linked ? arriveAtHash : undefined} /></Suspense>
          : <div className="p1-below-hold" aria-hidden="true" />}
      </main>
    </div>
  );
}

/** A visit that names a section (/#plans) lands on it once the section exists. */
function arriveAtHash(): void {
  const id = window.location.hash.slice(1);
  if (id && document.getElementById(id)) goTo(id);
}
