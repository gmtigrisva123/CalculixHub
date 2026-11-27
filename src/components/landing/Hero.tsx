/**
 * The first screen: what CalculixHub is, and the first problem.
 *
 * Most front pages describe the product and offer a button. This one starts
 * it. The headline and the way to sign up come first; under them, side by
 * side, are a real contest problem already chosen by the placement engine and
 * the engine's belief about whoever is reading (Fig. 1), which moves as soon
 * as they answer. A visitor can find out what the product does by doing it,
 * before giving anyone an email address.
 */

import { lazy, Suspense } from 'react';
import BeliefFigure from './BeliefFigure';
import { Arrow, Hl, goTo } from './kit';

/*
 * The sheet brings the maths typesetter with it, which is most of the page's
 * code. The headline and the way in do not wait for it: it is asked for as
 * soon as this file runs, and until it arrives its place is held by a sheet of
 * the same size, so nothing moves when the problem is set. If it cannot be
 * fetched at all the page still stands, with the sheet left blank.
 */
const sheet = () => import('./ProblemSheet');
const ProblemSheet = lazy(() => sheet().catch(() => ({ default: SheetHold })));
void sheet().catch(() => undefined);

function SheetHold() {
  return (
    <div className="p1-sheet is-hold" aria-hidden="true">
      <div className="p1-sheet-head"><span className="p1-sheet-title">Problem 1.</span></div>
      <div className="p1-sheet-body">
        <span className="p1-hold-line" />
        <span className="p1-hold-line" />
        <div className="p1-opts"><span /><span /><span /><span /><span /></div>
      </div>
    </div>
  );
}

interface HeroProps {
  onRegister: () => void;
}

export default function Hero({ onRegister }: HeroProps) {
  return (
    <section className="p1-hero" id="top" aria-labelledby="p1-hero-title">
      <div className="p1-wrap p1-hero-head">
        <h1 id="p1-hero-title" className="p1-display">
          Stay with <br />the <Hl swipe>question</Hl>.
        </h1>
        <div className="p1-hero-pitch">
          <p className="p1-lede">
            Contest maths from AMC to IMO. CalculixHub works out your level from the problems you answer,
            then keeps you on the ones that are just hard enough.
          </p>
          <div className="p1-hero-actions">
            <button type="button" className="p1-btn is-large" onClick={onRegister}>
              <span>Find your level</span>
              <Arrow />
            </button>
            <a className="p1-link" href="#engine" onClick={event => { event.preventDefault(); goTo('engine'); }}>How it works</a>
          </div>
          <p className="p1-hero-note">Free to start. Or begin below: the first problem is already on the page.</p>
        </div>
      </div>

      <div className="p1-wrap p1-hero-desk">
        <div className="p1-hero-sheet">
          <Suspense fallback={<SheetHold />}>
            <ProblemSheet onRegister={onRegister} />
          </Suspense>
          <p className="p1-sheet-rubric">Time allowed: as long as you need. Nothing on this sheet is saved or sent anywhere.</p>
        </div>
        <BeliefFigure />
      </div>
    </section>
  );
}
