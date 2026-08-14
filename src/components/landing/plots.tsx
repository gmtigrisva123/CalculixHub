/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The three charts below the fold.
 *
 * Every one of them is drawn from something the platform already holds: the
 * item bank, and the two functions in `irt.ts` that the placement test itself
 * calls. There is no sample data, no illustrative curve, and no learner
 * telemetry — a visitor has answered nothing, so there is nothing about a
 * learner to plot, and inventing some would poison the one claim this page is
 * making, which is that the numbers here are measured.
 *
 * What that leaves is better than telemetry anyway: the model, and the bank it
 * runs on. Both are the actual product, and both are honest to show to someone
 * who has not signed up.
 */

import { m } from 'motion/react';
import { ITEM_BANK } from '../../lib/itemBank';
import { itemInformation, probCorrect, type Domain, type IRTItem } from '../../lib/irt';
import { domainBankProfiles, formatDifficulty } from '../../lib/skillGraph';
import { ease } from '../../lib/motion';

/* -------------------------------------------------------------------------- */
/* Shared plot frame                                                           */
/* -------------------------------------------------------------------------- */

const W = 360;
const H = 208;
/*
 * `top: 22` is headroom for the y-axis label, not padding for its own sake. The
 * label sits above the plot's first rule and the topmost tick number sits
 * beside it; at the 14 this started on the two were eight pixels apart and read
 * as one smudged glyph.
 */
const PAD = { left: 34, right: 12, top: 22, bottom: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const THETA_MIN = -3;
const THETA_MAX = 3;

const toX = (theta: number) => PAD.left + ((theta - THETA_MIN) / (THETA_MAX - THETA_MIN)) * PLOT_W;
const toY = (value: number, max: number) => PAD.top + (1 - value / max) * PLOT_H;

const THETA_TICKS = [-3, -2, -1, 0, 1, 2, 3];

/**
 * Sixteen samples would be enough for the eye and are not enough for the maths:
 * an information curve for a = 2.3 is a spike about 0.9 wide on the theta scale,
 * and coarse sampling clips its peak — which would understate, in a picture, the
 * exact quantity the picture exists to explain.
 */
const SAMPLES = 200;

function samplePath(f: (theta: number) => number, max: number): string {
  let d = '';
  for (let i = 0; i <= SAMPLES; i += 1) {
    const theta = THETA_MIN + ((THETA_MAX - THETA_MIN) * i) / SAMPLES;
    d += `${i === 0 ? 'M' : 'L'}${toX(theta).toFixed(2)} ${toY(f(theta), max).toFixed(2)}`;
  }
  return d;
}

/** The frame every plot shares: rules on the ticks, an axis, and theta labels. */
function PlotFrame({ yTicks, yLabel }: { yTicks: { at: number; label: string }[]; yLabel: string }) {
  return (
    <g>
      {yTicks.map((tick) => (
        <g key={tick.label}>
          <line className="chart-grid" x1={PAD.left} y1={tick.at} x2={W - PAD.right} y2={tick.at} />
          <text
            x={PAD.left - 7}
            y={tick.at + 3.5}
            textAnchor="end"
            className="fill-current opacity-35 text-[9px] tnum"
          >
            {tick.label}
          </text>
        </g>
      ))}

      {THETA_TICKS.map((tick) => (
        <g key={tick}>
          <line
            className="chart-grid"
            x1={toX(tick)}
            y1={PAD.top}
            x2={toX(tick)}
            y2={H - PAD.bottom}
          />
          <text
            x={toX(tick)}
            y={H - PAD.bottom + 15}
            textAnchor="middle"
            className="fill-current opacity-35 text-[9px] tnum"
          >
            {tick > 0 ? `+${tick}` : tick}
          </text>
        </g>
      ))}

      <line
        className="chart-axis"
        x1={PAD.left}
        y1={H - PAD.bottom}
        x2={W - PAD.right}
        y2={H - PAD.bottom}
      />

      <text
        x={W - PAD.right}
        y={H - 4}
        textAnchor="end"
        className="fill-current opacity-45 text-[9px] uppercase tracking-[0.14em]"
      >
        ability θ
      </text>
      <text
        x={PAD.left}
        y={PAD.top - 9}
        textAnchor="start"
        className="fill-current opacity-45 text-[9px] uppercase tracking-[0.14em]"
      >
        {yLabel}
      </text>
    </g>
  );
}

/** A curve that draws itself once, the first time it comes into view. */
function DrawnPath({ d, stroke, delay }: { d: string; stroke: string; delay: number }) {
  return (
    <m.path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1.15, ease: ease.standard, delay }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* The three items both curve plots use                                        */
/* -------------------------------------------------------------------------- */

/**
 * Easiest, median and hardest by difficulty.
 *
 * Picked by position in the sorted bank rather than by hand, so the plots keep
 * spanning the bank's real range as items are added instead of quietly becoming
 * a snapshot of what the bank held the day this was written.
 */
const BY_DIFFICULTY = [...ITEM_BANK].sort((left, right) => left.b - right.b);
const SHOWN: IRTItem[] = [
  BY_DIFFICULTY[0],
  BY_DIFFICULTY[Math.floor((BY_DIFFICULTY.length - 1) / 2)],
  BY_DIFFICULTY[BY_DIFFICULTY.length - 1],
];

/* The domain hues, which clear 3:1 on both the paper and the ink ground. */
const SERIES_INK = ['#0ea5e9', '#8b5cf6', '#c8842a'];

/* -------------------------------------------------------------------------- */
/* Plot 1 — what the model believes                                            */
/* -------------------------------------------------------------------------- */

export function ItemCurvesPlot() {
  const guessing = SHOWN[0].c;

  return (
    <figure className="cx-card p-5 sm:p-6.5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-medium text-current opacity-80">Probability of a correct answer</span>
        <span className="text-[11px] font-mono text-current opacity-35">3PL</span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full h-auto" role="img"
        aria-label="Item characteristic curves for the easiest, median and hardest items in the bank.">
        <PlotFrame
          yLabel="P"
          yTicks={[
            { at: toY(1, 1), label: '1.0' },
            { at: toY(0.5, 1), label: '0.5' },
            { at: toY(0, 1), label: '0' },
          ]}
        />

        {/* The guessing floor. On four options nobody scores zero, and the model says so. */}
        <line
          className="chart-guide"
          x1={PAD.left}
          y1={toY(guessing, 1)}
          x2={W - PAD.right}
          y2={toY(guessing, 1)}
        />

        {SHOWN.map((item, i) => (
          <DrawnPath
            key={item.id}
            d={samplePath((theta) => probCorrect(theta, item), 1)}
            stroke={SERIES_INK[i]}
            delay={i * 0.16}
          />
        ))}

        {/* Each curve's inflection sits at its own b: the tick is where that is. */}
        {SHOWN.map((item, i) => (
          <line
            key={`${item.id}-b`}
            x1={toX(item.b)}
            y1={H - PAD.bottom}
            x2={toX(item.b)}
            y2={H - PAD.bottom - 7}
            stroke={SERIES_INK[i]}
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <ul className="mt-4 space-y-1.5">
        {SHOWN.map((item, i) => (
          <li key={item.id} className="flex items-center gap-2.5 text-[11.5px] text-current opacity-50">
            <span className="w-5 h-px shrink-0" style={{ backgroundColor: SERIES_INK[i] }} />
            <span className="text-current opacity-70">{item.source}</span>
            <span className="truncate">{item.concept}</span>
            <span className="ml-auto font-mono tnum text-current opacity-40 shrink-0">
              b {formatDifficulty(item.b)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Plot 2 — why it asks what it asks                                           */
/* -------------------------------------------------------------------------- */

export function InformationPlot() {
  const peak = Math.max(
    ...SHOWN.flatMap((item) =>
      Array.from({ length: SAMPLES + 1 }, (_, i) =>
        itemInformation(THETA_MIN + ((THETA_MAX - THETA_MIN) * i) / SAMPLES, item),
      ),
    ),
  );
  const top = Math.ceil(peak * 2) / 2;

  return (
    <figure className="cx-card p-5 sm:p-6.5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-medium text-current opacity-80">How much each item would tell us</span>
        <span className="text-[11px] font-mono text-current opacity-35">Fisher information</span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full h-auto" role="img"
        aria-label="Fisher information curves for the same three items, each peaking at its own difficulty.">
        <PlotFrame
          yLabel="I(θ)"
          yTicks={[
            { at: toY(top, top), label: top.toFixed(1) },
            { at: toY(top / 2, top), label: (top / 2).toFixed(1) },
            { at: toY(0, top), label: '0' },
          ]}
        />

        {SHOWN.map((item, i) => (
          <DrawnPath
            key={item.id}
            d={samplePath((theta) => itemInformation(theta, item), top)}
            stroke={SERIES_INK[i]}
            delay={i * 0.16}
          />
        ))}
      </svg>

      <p className="mt-4 text-[12.5px] leading-[1.6] text-current opacity-50">
        Each item is informative over a narrow band of ability and almost useless
        outside it. That is the whole selection rule: the next question is the one
        whose peak sits closest to where your estimate currently is.
      </p>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Plot 3 — what the bank actually covers                                      */
/* -------------------------------------------------------------------------- */

const DOMAIN_INK: Record<Domain, string> = {
  Algebra: '#c8842a',
  Geometry: '#2f9c8c',
  Combinatorics: '#8b5cf6',
  'Number Theory': '#0ea5e9',
};

const SPREAD_MIN = -3;
const SPREAD_MAX = 3;
const spreadPct = (b: number) => ((b - SPREAD_MIN) / (SPREAD_MAX - SPREAD_MIN)) * 100;

export function BankSpread() {
  const profiles = domainBankProfiles();

  return (
    <div>
      <div className="space-y-7">
        {profiles.map((profile, index) => {
          const ink = DOMAIN_INK[profile.domain];
          const items = ITEM_BANK.filter((item) => item.domain === profile.domain);
          const left = spreadPct(profile.easiestB);
          const width = spreadPct(profile.hardestB) - left;

          return (
            <m.div
              key={profile.domain}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: ease.standard, delay: index * 0.07 }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[14px] font-medium text-current opacity-85">{profile.domain}</span>
                <span className="text-[11.5px] font-mono tnum text-current opacity-40">
                  {profile.itemCount} items · b {formatDifficulty(profile.easiestB)} →{' '}
                  {formatDifficulty(profile.hardestB)}
                </span>
              </div>

              {/*
                The bar is the span, the dots are the items. Showing both matters:
                a span alone would let four items at one end read as coverage of
                the whole range, which is exactly the impression a small bank
                should not be allowed to give.
              */}
              <div className="relative mt-3 h-4">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current opacity-15" />
                <m.span
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                  style={{ left: `${left}%`, backgroundColor: ink, opacity: 0.45 }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${width}%` }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.7, ease: ease.standard, delay: index * 0.07 + 0.1 }}
                />
                {items.map((item) => (
                  <span
                    key={item.id}
                    title={`${item.source} · ${item.concept} · b ${formatDifficulty(item.b)}`}
                    className="absolute top-1/2 w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${spreadPct(item.b)}%`, backgroundColor: ink }}
                  />
                ))}
              </div>

              <p className="mt-2.5 text-[12.5px] text-current opacity-45 leading-[1.55]">
                Tops out at {profile.hardestConcept.toLowerCase()} · {profile.conceptCount} concepts ·
                mean discrimination {profile.meanDiscrimination.toFixed(2)}
              </p>
            </m.div>
          );
        })}
      </div>

      {/* The shared ruler, once, underneath — the four lanes are on one scale. */}
      <div className="relative mt-8 h-6 border-t border-current/15">
        {[-3, -2, -1, 0, 1, 2, 3].map((tick) => (
          <span
            key={tick}
            className="absolute top-2 -translate-x-1/2 text-[10.5px] font-mono tnum text-current opacity-30"
            style={{ left: `${spreadPct(tick)}%` }}
          >
            {tick > 0 ? `+${tick}` : tick}
          </span>
        ))}
      </div>
      {/*
        The axis name goes on its own line rather than at the end of the ruler.
        The +3 tick is centred on the right edge, so anything sharing that row
        with it lands on top of it.
      */}
      <p className="text-right text-[10.5px] uppercase tracking-[0.14em] text-current opacity-30">
        difficulty b
      </p>
    </div>
  );
}
