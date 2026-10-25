/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One match on the board, cut like a ticket: a stub with the date and the
 * match's own crest, and a body with its status, clock and actions.
 *
 * The actions arrive as children, so every handler and every disabled rule
 * stays in Arena.tsx beside the match logic it belongs to. This file only
 * decides how a match looks.
 */

import { useMemo, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Hash, Timer } from 'lucide-react';
import type { Arena } from '../../../shared/arena';
import { spring } from '../../lib/motion';
import { crestFor, formatCountdown, ticketId, windowProgress, type MatchStatus } from './lobbyModel';

interface MatchTicketProps {
  arena: Arena;
  status: MatchStatus;
  clock: number;
  children: ReactNode;
}

const STATUS_CLASS: Record<MatchStatus, string> = { 'Live now': 'is-live', Upcoming: 'is-upcoming', Finished: 'is-finished' };

/** Lets the ticket's spotlight follow a mouse. Touch has no hover, so it is left alone. */
function follow(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--al-mx', `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty('--al-my', `${event.clientY - rect.top}px`);
}

export default function MatchTicket({ arena, status, clock, children }: MatchTicketProps) {
  const reduce = useReducedMotion();
  const crest = useMemo(() => crestFor(arena.id), [arena.id]);
  const start = new Date(arena.starts_at);
  const live = status === 'Live now';
  const countdown =
    status === 'Upcoming' ? `Opens in ${formatCountdown(Date.parse(arena.starts_at) - clock)}`
    : live ? `Closes in ${formatCountdown(Date.parse(arena.ends_at) - clock)}`
    : null;
  const year = start.getFullYear() === new Date(clock).getFullYear() ? '' : `${start.getFullYear()} · `;

  return (
    <m.article
      id={ticketId(arena.id)}
      tabIndex={-1}
      className={`arena-match al-ticket ${STATUS_CLASS[status]}`}
      style={{ '--al-hue': `var(--al-${crest.hue})` } as CSSProperties}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={spring.smooth}
      onPointerMove={follow}
    >
      <div className="al-ticket-stub">
        <span className="sr-only">Starts {start.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</span>
        <span className="al-stub-month" aria-hidden="true">{start.toLocaleDateString(undefined, { month: 'short' })}</span>
        <strong className="al-stub-day" aria-hidden="true">{start.toLocaleDateString(undefined, { day: 'numeric' })}</strong>
        <span className="al-stub-time" aria-hidden="true">
          {year}{start.toLocaleDateString(undefined, { weekday: 'short' })} · {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
        <svg className="al-crest" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" />
          <path d={crest.path} pathLength={1} />
        </svg>
      </div>
      <div className="al-ticket-body">
        <div className="al-ticket-info">
          <div className="al-ticket-top">
            <span className={'arena-status al-status' + (live ? ' is-live' : '')}>
              {live && <i className="al-dot" aria-hidden="true" />}
              {status}
            </span>
            {countdown && <span className="al-ticket-clock">{countdown}</span>}
          </div>
          <h3>{arena.title}</h3>
          {arena.description && <p className="al-ticket-desc">{arena.description}</p>}
          <ul className="al-ticket-meta">
            <li><Timer size={15} aria-hidden="true" />{arena.duration_minutes} minutes</li>
            {arena.question_count != null && <li><Hash size={15} aria-hidden="true" />{arena.question_count} questions</li>}
          </ul>
        </div>
        <div className="arena-match-actions">{children}</div>
      </div>
      {live && (
        <span className="al-ticket-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${windowProgress(arena, clock)})` }} />
        </span>
      )}
    </m.article>
  );
}

/** A ticket-shaped placeholder while the board loads. */
export function TicketSkeleton() {
  return (
    <div className="al-ticket al-ticket-ghost" aria-hidden="true">
      <div className="al-ticket-stub">
        <span className="al-skel is-short" />
        <span className="al-skel is-tall" />
        <span className="al-skel" />
      </div>
      <div className="al-ticket-body">
        <div className="al-ticket-info">
          <span className="al-skel is-short" />
          <span className="al-skel is-title" />
          <span className="al-skel is-wide" />
        </div>
      </div>
    </div>
  );
}

/** An empty bowl with its lights on: nothing scheduled, or the board is out of reach. */
export function BoardEmpty({ catalogError }: { catalogError: boolean }) {
  return (
    <div className={'al-empty' + (catalogError ? ' is-offline' : '')}>
      <svg className="al-empty-art" viewBox="0 0 180 100" aria-hidden="true">
        <ellipse className="al-empty-rim" cx="90" cy="56" rx="84" ry="40" />
        <ellipse className="al-empty-rim" cx="90" cy="56" rx="64" ry="29" />
        <g transform="translate(90 56) scale(1 .44)">
          <circle className="al-empty-field" r="46" />
        </g>
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          return <circle key={i} className="al-empty-seat" cx={90 + Math.cos(angle) * 74} cy={56 + Math.sin(angle) * 34.5} r="2.6" style={{ '--i': i } as CSSProperties} />;
        })}
        <path className="al-empty-flag" d="M90 55 V27 M90 28 L105 33 L90 38" />
      </svg>
      <h3>{catalogError ? 'The board is unavailable.' : 'A quiet arena, for now.'}</h3>
      <p>{catalogError ? 'Use Refresh to reconnect after setup is complete.' : 'The next match will appear here when an administrator publishes it.'}</p>
    </div>
  );
}
