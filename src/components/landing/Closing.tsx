/**
 * The end of the paper, and the colophon.
 *
 * A paper ends by saying so. Under that line is the one thing the page has
 * left to say, which is the thing the product is built on: not knowing yet is
 * allowed. If the visitor sat any of the paper, their sheet is summed up here,
 * honestly labelled as a few answers and not a placement; either way the two
 * ways in follow.
 *
 * The footer is a colophon, as a printed book has: what the page is set in,
 * what its figures are, and the few places left to go.
 */

import { recommendedSource } from '../../domain/irt';
import { Arrow, Wordmark, goTo } from './kit';
import { useSitting } from './sitting';

interface ClosingProps {
  onRegister: () => void;
  onSignIn: () => void;
}

export default function Closing({ onRegister, onSignIn }: ClosingProps) {
  const { marks, belief, status } = useSitting();
  const right = marks.filter(mark => mark.correct).length;
  const toTop = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); goTo('top'); };

  return (
    <>
      <section className="p1-sec p1-end" id="begin" aria-labelledby="p1-end-title">
        <div className="p1-wrap">
          <p className="p1-end-rule"><span>End of paper</span></p>
          <div className="p1-end-grid">
            <div className="p1-end-copy">
              <h2 id="p1-end-title" className="p1-display"><span className="p1-kern">Y</span>ou’re allowed to not know yet.</h2>
              <p className="p1-lede">Cross things out. Try a smaller case. Come back tomorrow. Bring a little patience, and we’ll bring the questions.</p>
            </div>

            <div className="p1-end-ways">
              {marks.length > 0 ? (
                <p className="p1-end-slip">
                  <b>Your sheet.</b> {marks.length} {marks.length === 1 ? 'problem' : 'problems'} marked, {right} right. The engine has you at{' '}
                  <b>{belief.tier}</b>, give or take <span className="p1-num">{belief.sem.toFixed(2)}</span>, and would start you on {recommendedSource(belief.theta)} problems.{' '}
                  {status === 'closed'
                    ? 'That is as far as this short paper goes; the placement in the app has a wider range and starts fresh.'
                    : <>That is a few answers, not a placement. <a className="p1-link is-inline" href="#top" onClick={toTop}>Go on with the paper</a>, or take the whole placement in the app, which starts fresh.</>}
                </p>
              ) : (
                <p className="p1-end-slip">
                  <b>Your sheet is blank.</b> Problem 1 is still at <a className="p1-link is-inline" href="#top" onClick={toTop}>the top of the page</a>, and it takes no account to try it.
                </p>
              )}
              <div className="p1-end-actions">
                <button type="button" className="p1-btn is-large" onClick={onRegister}>
                  <span>Find your level</span>
                  <Arrow />
                </button>
                <a className="p1-btn is-outline is-large" href="/?auth=signup&tab=learn">
                  <span>Open practice</span>
                  <Arrow />
                </a>
                <button type="button" className="p1-textbtn" onClick={onSignIn}>I have an account</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="p1-colophon">
        <div className="p1-wrap p1-colophon-grid">
          <div className="p1-colophon-name">
            <Wordmark />
            <p>Keep a little room for a good question.</p>
          </div>
          <p className="p1-colophon-text">
            Set in Computer Modern, the face contest papers have been typeset in since TeX, and in Geist. The curves in Figs. 1 and 2 are the
            placement engine’s own arithmetic, not drawings of it. Every problem is quoted from the paper it was set in. Fig. 3 follows
            Euclid, by way of Oliver Byrne.
          </p>
          <nav className="p1-colophon-links" aria-label="More">
            <a className="p1-link" href="/?preview=ios">The iPhone experience</a>
            <a className="p1-link" href="/?preview=mac">The MacBook experience</a>
            <a className="p1-link" href="#top" onClick={toTop}>Back to the top</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
