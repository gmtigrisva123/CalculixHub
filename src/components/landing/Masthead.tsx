/**
 * The head of the paper, and the strip that follows the reader down it.
 *
 * The masthead is a paper's: today's date on the left, the name in the middle,
 * the two ways in on the right, a double rule, and the sections beneath. It is
 * part of the page and scrolls away with it.
 *
 * Once it has gone, a narrow strip takes its place at the top of the screen.
 * It carries the one thing worth keeping in view: where the engine has the
 * visitor so far (or that a problem is waiting, if they have not started), and
 * the way to sign up. It is `inert` while hidden, so a keyboard never lands on
 * a control that is off screen.
 */

import { useEffect, useRef, useState } from 'react';
import { Wordmark, goTo } from './kit';
import { useSitting, type Sitting } from './sitting';

/** The sections worth a jump. The ids are the page's public anchors (/#plans, /#faq) and stay put. */
export const SECTIONS = [
  { id: 'engine', label: 'How it works' },
  { id: 'playground', label: 'Try one' },
  { id: 'archive', label: 'Past papers' },
  { id: 'plans', label: 'Pricing' },
  { id: 'faq', label: 'Questions' },
] as const;

const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

interface MastheadProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export default function Masthead({ onSignIn, onRegister }: MastheadProps) {
  const headRef = useRef<HTMLElement>(null);
  const [gone, setGone] = useState(false);
  const today = new Date();

  // The strip appears when the masthead has left the screen, and not a moment before.
  useEffect(() => {
    const node = headRef.current;
    if (!node || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(([entry]) => setGone(!entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    goTo(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
      <header ref={headRef} className="p1-mast">
        <div className="p1-wrap p1-mast-top">
          <p className="p1-mast-date">
            <time dateTime={today.toISOString().slice(0, 10)}>{DATE.format(today).replace(',', '')}</time>
          </p>
          <a className="p1-mast-name" href="/?home=1" aria-label="CalculixHub, front page">
            <Wordmark />
          </a>
          <div className="p1-mast-actions">
            <button type="button" className="p1-textbtn" onClick={onSignIn}>Sign in</button>
            <button type="button" className="p1-btn is-outline is-small" onClick={onRegister}>Sign up</button>
          </div>
        </div>
        <nav className="p1-wrap p1-mast-nav" aria-label="Sections">
          <ul>
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`} onClick={event => jump(event, section.id)}>{section.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className={gone ? 'p1-strip is-shown' : 'p1-strip'} inert={!gone}>
        <div className="p1-wrap p1-strip-row">
          <a className="p1-strip-name" href="#top" aria-label="CalculixHub, back to the top" onClick={event => jump(event, 'top')}>
            <Wordmark />
          </a>
          <StripStatus onGo={event => jump(event, 'top')} />
          <button type="button" className="p1-btn is-small" onClick={onRegister}>Sign up</button>
        </div>
      </div>
    </>
  );
}

/** Where the sitting stands, in a line. It is a link back to the sheet. */
function StripStatus({ onGo }: { onGo: (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const state = useSitting();
  return (
    <a className="p1-strip-status" href="#top" onClick={onGo}>
      {statusLine(state)}
    </a>
  );
}

function statusLine(state: Sitting) {
  const marked = state.marks.length;
  if (marked === 0) return <><b>Problem 1</b> is on the sheet</>;
  const margin = `±${state.belief.sem.toFixed(2)}`;
  if (state.status === 'closed') return <>Placed: <b>{state.belief.tier}</b> <span className="p1-num">{margin}</span></>;
  return <>So far: <b>{state.belief.tier}</b> <span className="p1-num">{margin}</span><span className="p1-strip-count"> after {marked}</span></>;
}
