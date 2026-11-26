/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Today's board: one problem from the bank, the same for everyone, pinned at
 * the top of the feed until midnight UTC.
 *
 * It gives the room something to talk about on a quiet day, and gives a
 * newcomer an obvious first thing to do: try it, then read how other people
 * got there. The problem is chosen from the date (`boardProblem`), so there is
 * nothing to schedule and nothing to store.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, LifeBuoy, PenLine } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import { countThread } from '../../services/data/feed';
import MathText from '../MathText';
import { boardCountdown, boardDay, plural } from './model';
import { useNow } from './ui';

export default function TodayBoard({
  problem,
  solved,
  signedIn,
  onSolve,
  onOpenThread,
  onWrite,
  onStuck,
}: {
  problem: Problem;
  /** Whether the viewer has already solved it, when that is known. */
  solved: boolean;
  signedIn: boolean;
  /** Open the problem in Learn. Absent where there is nowhere to send the learner. */
  onSolve?: (problem: Problem) => void;
  onOpenThread: (problemId: string) => void;
  onWrite: (problem: Problem) => void;
  onStuck: (problem: Problem) => void;
}) {
  const now = useNow();
  const day = boardDay(now);
  const [thread, setThread] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setThread(null);
    countThread(problem.id)
      .then((count) => alive && setThread(count))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [problem.id, day]);

  // The board turns over at midnight UTC; the date printed on it is that day.
  const date = new Date(day * 86_400_000).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <section className="cm-board" aria-labelledby="cm-board-title">
      <span className="cm-board-tape" aria-hidden="true" />
      <header className="cm-board-head">
        <p className="cm-board-label">
          <strong>Today&rsquo;s board</strong>
          <span>{date}</span>
        </p>
        <p className="cm-board-clock" title="Everyone gets the same problem. It changes at midnight UTC.">
          Next board in <time>{boardCountdown(now)}</time>
        </p>
      </header>

      <div className="cm-board-body">
        <div className="cm-board-problem">
          <h2 id="cm-board-title">{problem.title}</h2>
          <p className="cm-board-meta">
            {problem.topic} · {problem.level}
            {problem.competition ? ` · ${problem.competition} style` : ''} · {problem.points} pts
          </p>
          <MathText as="p" className="cm-board-question" text={problem.question} />
        </div>

        <p className="cm-board-note" aria-hidden="true">
          {solved ? 'you solved this one: show how' : 'same problem for everyone, all day'}
        </p>
      </div>

      <footer className="cm-board-foot">
        <div className="cm-board-actions">
          {onSolve && !solved && (
            <button type="button" className="cm-board-button is-primary" onClick={() => onSolve(problem)}>
              Try it <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          )}
          <button type="button" className={`cm-board-button ${solved || !onSolve ? 'is-primary' : ''}`} onClick={() => onWrite(problem)}>
            <PenLine size={16} aria-hidden="true" /> {signedIn ? 'Write up your approach' : 'Sign in to post'}
          </button>
          {signedIn && !solved && (
            <button type="button" className="cm-board-button" onClick={() => onStuck(problem)}>
              <LifeBuoy size={16} aria-hidden="true" /> Ask for a nudge
            </button>
          )}
        </div>
        <button type="button" className="cm-board-thread" onClick={() => onOpenThread(problem.id)}>
          {thread === null ? 'Open the thread' : thread === 0 ? 'No posts yet. Be the first' : `${plural(thread, 'post')} in this thread`}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
