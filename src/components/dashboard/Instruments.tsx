/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The four headline figures, each as a small instrument.
 *
 *   Learning points   the figure, this week's gain, and the running total
 *                     across every active day as a sparkline;
 *   Problems solved   one dot per solved problem;
 *   Answer accuracy   a gauge, or an honest dash before the first answer;
 *   Learning streak   the last seven days as a chain: a filled link for each
 *                     day with practice, joined where the days run on.
 *
 * Every mark is drawn from the same props the figures are, and each figure
 * stays readable as text: the drawings add nothing a screen reader would miss.
 */

import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { m } from 'motion/react';
import { CheckCircle2, Flame, Target, Trophy, type LucideIcon } from 'lucide-react';
import { ease, spring } from '../../lib/motion';
import { AnimatedNumber } from '../motion';
import { formatLike, solvedDots, sparkPaths, type DayPoints } from './dashboardModel';

interface InstrumentsProps {
  points: number;
  weekPoints: number;
  curve: DayPoints[];
  solved: number;
  accuracy: number;
  streak: number;
  week: { date: string; label: string; active: boolean; today: boolean }[];
  still: boolean;
}

const DOTS = 36;
const SPARK = { width: 240, height: 58 };
const GAUGE = 'M 12 62 A 50 50 0 0 1 112 62';

export default function Instruments({ points, weekPoints, curve, solved, accuracy, streak, week, still }: InstrumentsProps) {
  const answered = solved > 0;
  return (
    <section className="dh-instruments" aria-label="Your learning statistics">
      <Instrument index={0} kind="points" label="Learning points" icon={Trophy} still={still}>
        <p className="dh-figure">
          <AnimatedNumber value={points} format={(value) => Math.round(value).toLocaleString()} />
        </p>
        <p className="dh-note">
          {weekPoints > 0 && <span className="dh-delta">+{weekPoints.toLocaleString()} this week</span>}
          One discovery at a time
        </p>
        <Sparkline values={curve} still={still} />
      </Instrument>

      <Instrument index={1} kind="solved" label="Problems solved" icon={CheckCircle2} still={still}>
        <p className="dh-figure">
          <AnimatedNumber value={solved} />
        </p>
        <p className="dh-note">Ideas made your own</p>
        <DotMatrix count={solved} />
      </Instrument>

      <Instrument index={2} kind="accuracy" label="Answer accuracy" icon={Target} still={still}>
        <p className="dh-figure">
          {answered ? (
            <>
              <AnimatedNumber value={accuracy} format={(value) => formatLike(value, accuracy)} />%
            </>
          ) : (
            '—'
          )}
        </p>
        <p className="dh-note">{answered ? 'Keep refining your thinking' : 'Solve a problem to get started'}</p>
        <Gauge value={answered ? accuracy : 0} still={still} />
      </Instrument>

      <Instrument index={3} kind="streak" label="Learning streak" icon={Flame} still={still} lit={streak > 0}>
        <p className="dh-figure">
          <AnimatedNumber value={streak} />
          <span className="dh-figure-unit"> {streak === 1 ? 'day' : 'days'}</span>
        </p>
        <p className="dh-note">Little habits. Lasting growth.</p>
        <StreakChain week={week} />
      </Instrument>
    </section>
  );
}

function Instrument({
  index,
  kind,
  label,
  icon: Icon,
  still,
  lit,
  children,
}: {
  index: number;
  kind: string;
  label: string;
  icon: LucideIcon;
  still: boolean;
  lit?: boolean;
  children: ReactNode;
}) {
  return (
    <m.article
      className="dh-card dh-instrument"
      data-kind={kind}
      data-lit={lit || undefined}
      initial={still ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay: 0.22 + index * 0.06 }}
    >
      <div className="dh-instrument-head">
        <h3>{label}</h3>
        <span className="dh-instrument-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      </div>
      {children}
    </m.article>
  );
}

const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The running points total over every active day, oldest on the left. Hovering reads any day back. */
function Sparkline({ values: days, still }: { values: DayPoints[]; still: boolean }) {
  const values = days.map((day) => day.points);
  const { line, area, end } = sparkPaths(values, SPARK.width, SPARK.height);
  const [hover, setHover] = useState<number | null>(null);
  if (!end) {
    return (
      <div className="dh-spark is-empty" aria-hidden="true">
        <span className="dh-spark-rest" />
        <span className="dh-spark-hint">Your curve starts with your first point</span>
      </div>
    );
  }
  const read = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    setHover(Math.round(ratio * (days.length - 1)));
  };
  // The same geometry sparkPaths uses: a 4-unit inset, scaled to the curve's highest point.
  const top = Math.max(...values) || 1;
  const x = hover === null ? 0 : (4 + (hover * (SPARK.width - 8)) / (days.length - 1)) / SPARK.width;
  const y = hover === null ? 0 : (SPARK.height - 4 - (values[hover] / top) * (SPARK.height - 8)) / SPARK.height;
  return (
    <div className="dh-spark" role="img" aria-label={`Points over your last ${days.length} active days, from ${values[0].toLocaleString()} to ${values[values.length - 1].toLocaleString()}.`}>
      <div className="dh-spark-plot" onPointerMove={read} onPointerLeave={() => setHover(null)}>
        {hover !== null && (
          <>
            <span className="dh-spark-cross" style={{ left: `${x * 100}%` }} aria-hidden="true" />
            <span className="dh-spark-dot" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden="true" />
            <span className="dh-spark-read" style={{ left: `${Math.min(78, Math.max(22, x * 100))}%` }} aria-hidden="true">
              <strong>{values[hover].toLocaleString()}</strong> · {shortDay(days[hover].date)}
            </span>
          </>
        )}
        <svg viewBox={`0 0 ${SPARK.width} ${SPARK.height}`} preserveAspectRatio="none" aria-hidden="true">
          <m.path
            className="dh-spark-area"
            d={area}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9, ease: ease.standard }}
          />
          <m.path
            className="dh-spark-line"
            d={line}
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.35, ease: ease.standard }}
          />
        </svg>
        <m.span
          className="dh-spark-end"
          style={{ left: `${(end.x / SPARK.width) * 100}%`, top: `${(end.y / SPARK.height) * 100}%` }}
          initial={still ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.snappy, delay: 1.35 }}
        />
      </div>
    </div>
  );
}

/** One dot per solved problem, up to a full board; the rest are counted beside it. */
function DotMatrix({ count }: { count: number }) {
  const { filled, overflow } = solvedDots(count, DOTS);
  return (
    <div className="dh-dots" aria-hidden="true">
      <div className="dh-dots-grid">
        {Array.from({ length: DOTS }, (_, i) => (
          <span key={i} className={i < filled ? 'dh-dot is-on' : 'dh-dot'} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      {overflow > 0 && <span className="dh-dots-more">+{overflow.toLocaleString()}</span>}
    </div>
  );
}

function Gauge({ value, still }: { value: number; still: boolean }) {
  return (
    <div className="dh-gauge" aria-hidden="true">
      <svg viewBox="0 0 124 70">
        <path className="dh-gauge-track" d={GAUGE} />
        {value > 0 && (
          <m.path
            className="dh-gauge-fill"
            d={GAUGE}
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: value / 100 }}
            transition={{ ...spring.data, delay: 0.4 }}
          />
        )}
        <text x="12" y="69">0</text>
        <text x="112" y="69">100</text>
      </svg>
    </div>
  );
}

/** The last seven days, oldest first; consecutive practice days are linked. */
function StreakChain({ week }: { week: InstrumentsProps['week'] }) {
  const active = week.filter((day) => day.active).length;
  return (
    <ol className="dh-chain" aria-label={`Practised on ${active} of the last 7 days`}>
      {week.map((day, i) => (
        <li
          key={day.date}
          className="dh-chain-day"
          data-active={day.active || undefined}
          data-today={day.today || undefined}
          data-linked={(day.active && week[i - 1]?.active) || undefined}
          aria-label={`${day.label}: ${day.active ? 'practised' : 'no practice'}${day.today ? ' (today)' : ''}`}
        >
          <span className="dh-chain-link" aria-hidden="true" />
          <span className="dh-chain-mark" aria-hidden="true" />
          <span className="dh-chain-label" aria-hidden="true">
            {day.label.slice(0, 1)}
          </span>
        </li>
      ))}
    </ol>
  );
}
