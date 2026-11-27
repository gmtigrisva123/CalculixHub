/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { duration, ease, spring, transition } from '../../lib/motion';

interface VelocityDatum {
  date: string;
  value: number;
}

interface VelocityChartProps {
  data: VelocityDatum[];
  color?: string;
}

/** The axis labels are monospaced at 10.5px, so each character takes about this much room. */
const LABEL_SIZE = 10.5;
const CHAR = 6.5;

// Small dependency-free SVG line chart driven entirely by real data points
// (no hardcoded coordinates) — renders an empty state when there isn't
// enough history yet instead of faking a trend line.
export default function VelocityChart({ data, color = '#c8842a' }: VelocityChartProps) {
  /** Shared viewport config, so every layer of the chart reveals together. */
  const viewport = { once: true, amount: 0.3 } as const;

  /*
   * The chart is drawn at the size of its frame, one unit to one pixel.
   *
   * It used to be a fixed 700x220 drawing stretched to fill whatever card held
   * it. In a 360px card that squeezed the axis labels to about 5px and turned
   * the round markers into ellipses. Measuring the frame keeps the labels at
   * their set size and the markers round at every width, and the line still
   * runs the full width of the card.
   */
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const enough = data.length >= 2;
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setSize(current => (current.width === node.clientWidth && current.height === node.clientHeight
      ? current
      : { width: node.clientWidth, height: node.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [enough]);

  if (!enough) {
    return (
      <div className="w-full h-full min-h-44 rounded-[14px] border border-dashed border-line-strong bg-surface-sunken/50 flex items-center justify-center text-center px-6">
        <p className="text-[13.5px] leading-relaxed text-content-subtle max-w-xs">
          Not enough history yet &mdash; solve a few more problems across different sessions and your progress trend will appear here.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = Math.max(1, maxVal - minVal);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const tickLabels = gridLines.map((g) => String(Math.round(minVal + range * g)));

  const { width, height } = size;
  // Wide enough for the longest figure on the axis, so a five-figure total is not cut off.
  const padLeft = Math.max(40, Math.max(...tickLabels.map((label) => label.length)) * CHAR + 16);
  // Half a date label: the last date is centred under the last marker.
  const padRight = 18;
  const padTop = 12;
  const padBottom = 26;
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = Math.max(1, height - padTop - padBottom);

  const xAt = (i: number) => padLeft + (i / (data.length - 1)) * plotW;
  const yAt = (v: number) => padTop + plotH - ((v - minVal) / range) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)},${yAt(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(data.length - 1).toFixed(1)},${padTop + plotH} L ${xAt(0).toFixed(1)},${padTop + plotH} Z`;

  /*
   * Dates are named as often as they fit, counted back from the latest day so
   * the most recent one is always there and no two labels touch.
   */
  const dateRoom = Math.max(...data.map((d) => d.date.length)) * CHAR + 12;
  const every = Math.max(1, Math.ceil(dateRoom / (plotW / (data.length - 1))));

  return (
    <div className="w-full h-full min-h-44 rounded-[14px] border border-line-faint bg-surface-sunken/40 relative">
      {/* Inset rather than padded, so the drawing can never push its own frame larger. */}
      <div ref={frame} className="absolute inset-4">
        {width > 0 && height > 0 && (
          <svg className="block" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/*
              Grid and axes read from the line tokens rather than from literals.

              They used to be `#f1f5f9` and `#e2e8f0` — two light slates, chosen when
              this chart only ever sat on a white card. At night the card goes to
              #1d1912 and both of them become brighter than the data they are meant
              to sit behind, so the chart reads as a grid with a line lost in it.
              `var(--ln-*)` flips with the theme and keeps the ranking right: the
              series is the loudest thing, the axis next, the grid last.
            */}
            {gridLines.map((g) => {
              const y = padTop + plotH * g;
              return <line key={g} x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="var(--ln-faint)" strokeWidth={1} />;
            })}
            <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="var(--ln)" strokeWidth={1.5} />
            <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--ln)" strokeWidth={1.5} />

            {/*
              The area fills in under the line rather than with it, so the line
              stays the thing being read while it is being drawn.
            */}
            <m.path
              d={areaPath}
              fill={`url(#velocityGradient)`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.15 }}
              viewport={viewport}
              transition={{ duration: duration.slower, ease: ease.standard, delay: 0.25 }}
            />
            {/*
              `pathLength` is the one place a stroke draw-on is the honest
              animation: this is a timeline, and tracing it left to right is the
              direction the data actually runs. Motion implements it as
              strokeDasharray/offset, so it composites and never re-lays out.
            */}
            <m.path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={viewport}
              transition={transition.draw}
            />

            {/*
              Each marker pops as the line reaches it. The delay is spread across
              the same window the draw occupies, so the two read as one gesture.
              The ring is the card, not white: a literal white ring on a night
              card turns each marker into a bright pinprick.
            */}
            {data.map((d, i) => (
              <m.circle
                key={i}
                cx={xAt(i)}
                cy={yAt(d.value)}
                r={3}
                fill={color}
                stroke="var(--sf-raised)"
                strokeWidth={1.5}
                style={{ transformOrigin: `${xAt(i)}px ${yAt(d.value)}px` }}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={viewport}
                transition={{
                  ...spring.snappy,
                  delay: (i / Math.max(1, data.length - 1)) * duration.deliberate,
                }}
              />
            ))}

            {/* The card's heading already says these are points, so the axis carries figures only. */}
            {gridLines.map((g, index) => (
              <text key={g} x={padLeft - 8} y={padTop + plotH * (1 - g) + 3.5} textAnchor="end" className="font-mono" fill="var(--ct-subtle)" style={{ fontSize: LABEL_SIZE }}>
                {tickLabels[index]}
              </text>
            ))}

            {data.map((d, i) => {
              if ((data.length - 1 - i) % every !== 0) return null;
              return (
                <text key={d.date + i} x={xAt(i)} y={height - 8} textAnchor="middle" className="font-mono" fill="var(--ct-subtle)" style={{ fontSize: LABEL_SIZE }}>
                  {d.date}
                </text>
              );
            })}

            <defs>
              <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
    </div>
  );
}
