/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The week, as seven columns.
 *
 * One series, so one hue: today in the accent, the six days before it a step
 * lighter. Only today and the best day carry a printed value; every other
 * figure is one hover, one focus or one arrow key away, and all seven are in
 * the table that screen readers get. The numbers are the dashboard's own
 * weekly arithmetic, unchanged.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, m, useInView } from 'motion/react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { ease, spring } from '../../lib/motion';
import { AnimatedNumber } from '../motion';
import { bestDay, niceCeiling, type DayPoints } from './dashboardModel';

interface MomentumChartProps {
  daily: DayPoints[];
  weekPoints: number;
  still: boolean;
  onProgress: () => void;
}

const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const longDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const pointsLabel = (points: number) => `${points.toLocaleString()} ${points === 1 ? 'point' : 'points'}`;

export default function MomentumChart({ daily, weekPoints, still, onProgress }: MomentumChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const inView = useInView(chartRef, { once: true, amount: 0.35 });
  const shown = still || inView;
  const [active, setActive] = useState<number | null>(null);
  const today = daily.length - 1;
  const best = bestDay(daily);
  const ceiling = niceCeiling(Math.max(...daily.map((day) => day.points)));
  // Clean numbers only: the midline is printed when it falls on a whole number.
  const ticks = Number.isInteger(ceiling / 2) ? [ceiling, ceiling / 2, 0] : [ceiling, 0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    setActive((current) => {
      const from = current ?? today;
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return today;
      return Math.max(0, Math.min(today, from + (event.key === 'ArrowLeft' ? -1 : 1)));
    });
  };

  const focused = active === null ? null : daily[active];

  return (
    <m.section
      className="dh-card dh-momentum"
      aria-labelledby="dh-momentum-title"
      initial={still ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={spring.smooth}
    >
      <div className="dh-section-head">
        <div>
          <h2 id="dh-momentum-title">A little better, every day</h2>
          <p>Your learning momentum this week.</p>
        </div>
        <span className="dh-pill">Last 7 days</span>
      </div>

      <div className="dh-momentum-total">
        <p>
          <strong>
            <AnimatedNumber value={shown ? weekPoints : 0} />
          </strong>
          <span>points this week</span>
        </p>
        <button type="button" className="dh-link" onClick={onProgress}>
          See my progress <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>

      <div
        ref={chartRef}
        className="dh-chart"
        role="group"
        tabIndex={0}
        aria-label="Points earned in the past seven days. Use the arrow keys to read each day."
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <div className="dh-chart-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="dh-chart-tick">
              <small>{tick.toLocaleString()}</small>
            </span>
          ))}
        </div>
        <div className="dh-chart-cols">
          {daily.map((day, i) => {
            const height = (day.points / ceiling) * 100;
            const labelled = day.points > 0 && (i === today || i === best);
            return (
              <div
                key={day.date}
                className="dh-col"
                data-today={i === today || undefined}
                data-active={active === i || undefined}
                onPointerEnter={() => setActive(i)}
              >
                <div className="dh-col-track">
                  {day.points > 0 ? (
                    <m.span
                      className="dh-bar"
                      style={{ height: `${height}%` }}
                      initial={still ? false : { clipPath: 'inset(100% 0% 0% 0%)' }}
                      animate={{ clipPath: shown ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)' }}
                      transition={{ duration: 0.75, delay: 0.1 + i * 0.05, ease: ease.standard }}
                    />
                  ) : (
                    <span className="dh-bar-rest" />
                  )}
                  {labelled && (
                    <m.span
                      className="dh-bar-value"
                      style={{ bottom: `${height}%` }}
                      initial={still ? false : { opacity: 0, y: 4 }}
                      animate={shown ? { opacity: 1, y: 0 } : undefined}
                      transition={{ ...spring.snappy, delay: 0.55 + i * 0.05 }}
                    >
                      {day.points.toLocaleString()}
                    </m.span>
                  )}
                </div>
                <span className="dh-col-day">{weekday(day.date)}</span>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {focused && active !== null && (
            <m.div
              key="tip"
              className="dh-tip"
              style={{ left: `${((active + 0.5) / daily.length) * 100}%` }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: ease.standard }}
              aria-hidden="true"
            >
              <strong>{pointsLabel(focused.points)}</strong>
              <span>{longDay(focused.date)}{active === today ? ' · today' : ''}</span>
            </m.div>
          )}
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">
          {focused ? `${longDay(focused.date)}: ${pointsLabel(focused.points)}` : ''}
        </p>

        {weekPoints === 0 && (
          <div className="dh-chart-empty">
            <Sparkles size={16} aria-hidden="true" />
            <span>Your first solved problem will bring this chart to life.</span>
          </div>
        )}
      </div>

      {weekPoints > 0 && (
        <p className="dh-chart-caption">
          <span aria-hidden="true" /> Every point is a little more understanding.
        </p>
      )}

      <table className="sr-only">
        <caption>Points earned each day this week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((day) => (
            <tr key={day.date}>
              <th scope="row">{longDay(day.date)}</th>
              <td>{day.points.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </m.section>
  );
}
