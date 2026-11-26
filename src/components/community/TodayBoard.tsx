/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Today's board: one problem from the bank, the same for everyone, pinned at
 * the top of the feed for a day.
 *
 * It gives the room something to talk about on a quiet day, and gives a
 * newcomer an obvious first thing to do: try it, then read how other people
 * got there. The problem is chosen from the date (`boardProblem`), so there is
 * nothing to schedule and nothing to store. Yesterday's problem gets one line
 * under it: the morning after is when its thread is worth reading.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, LifeBuoy, PenLine } from 'lucide-react';
import type { Problem } from '../../../shared/types';
import { countThread } from '../../services/data/feed';
import MathText from '../MathText';
import { boardCountdown, boardDay, plural } from './model';
import { useNow } from './ui';

/** How many posts a problem's thread holds, re-read whenever `refreshKey` changes. */
function useThreadCount(problemId: string | null, refreshKey: string): number | null {
  const [state, setState] = useState<{ id: string | null; count: number | null }>({ id: problemId, count: null });

  useEffect(() => {
    if (!problemId) return;
    let alive = true;
    countThread(problemId)
      .then((count) => alive && setState({ id: problemId, count }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [problemId, refreshKey]);

  // A figure for another problem is never shown; one for this problem stays up while it is re-read.
  return state.id === problemId ? state.count : null;
}

export default function TodayBoard({
  problem,
  yesterday,
  solved,
  signedIn,
  refreshKey,
  onSolve,
  onOpenThread,
  onOpenYesterday,
  onWrite,
  onStuck,
}: {
  problem: Problem;
  /** The problem the board carried the day before, if it was a different one. */
  yesterday: Problem | null;
  /** Whether the viewer has already solved it, when that is known. */
  solved: boolean;
  signedIn: boolean;
  /** Changes whenever the feed does, so the thread counts are read again. */
  refreshKey: string;
  /** Open the problem in Learn. Absent where there is nowhere to send the learner. */
  onSolve?: (problem: Problem) => void;
  onOpenThread: (problemId: string) => void;
  /** Open yesterday's thread, most marked first. */
  onOpenYesterday: (problemId: string) => void;
  onWrite: (problem: Problem) => void;
  onStuck: (problem: Problem) => void;
}) {
  const now = useNow();
  const day = boardDay(now);
  const thread = useThreadCount(problem.id, `${day}:${refreshKey}`);
  const before = useThreadCount(yesterday?.id ?? null, `${day}:${refreshKey}`);

  // The board turns over at midnight UTC. Said in the reader's own time, because
  // "today" printed as a UTC date is the wrong weekday for half the world.
  const turns = new Date((day + 1) * 86_400_000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <section className="cm-board" aria-labelledby="cm-board-title">
      <span className="cm-board-tape" aria-hidden="true" />
      <header className="cm-board-head">
        <p className="cm-board-label">
          <strong>Today&rsquo;s board</strong>
          <span>The same problem for everyone until {turns}</span>
        </p>
        <p className="cm-board-clock">
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
          {solved ? 'you solved this one: show how' : 'try it before you read the thread'}
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
        {thread === 0 ? (
          <p className="cm-board-thread is-static">No posts on this problem yet.</p>
        ) : (
          <button type="button" className="cm-board-thread" onClick={() => onOpenThread(problem.id)}>
            {thread === null ? 'Open the thread' : `${plural(thread, 'post')} in this thread`}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </footer>

      {yesterday && before !== null && before > 0 && (
        <p className="cm-board-yesterday">
          <span>Yesterday</span>
          <button type="button" onClick={() => onOpenYesterday(yesterday.id)}>
            {yesterday.title}
          </button>
          <span>{before === 1 ? 'One post in its thread.' : `${before} posts, the most marked first.`}</span>
        </p>
      )}
    </section>
  );
}
