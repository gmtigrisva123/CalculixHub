/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { m } from 'motion/react';
import { duration, ease, spring, staggerDelay } from '../../lib/motion';

interface RadarDatum {
  label: string;
  value: number; // 0-100
}

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  color?: string;
}

// Small dependency-free SVG radar chart for skill-mastery visualization.
export default function RadarChart({ data, size = 260, color = '#c8842a' }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.34;
  const rings = [0.25, 0.5, 0.75, 1];
  const angleStep = (Math.PI * 2) / data.length;

  const pointAt = (index: number, fraction: number) => {
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius * fraction,
      y: center + Math.sin(angle) * radius * fraction,
    };
  };

  const dataPoints = data.map((d, i) => pointAt(i, Math.max(0.04, d.value / 100)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  /*
   * The chart builds itself in three beats: the grid, then the measured
   * polygon growing outward from the centre, then the vertex markers.
   *
   * The polygon is scaled from the centre rather than having its outline
   * stroked on. For a radar chart that is the meaningful animation — the shape
   * expanding is literally the ability being measured — whereas tracing the
   * perimeter would animate the drawing rather than the data. It is also a pure
   * transform, so the whole reveal is composited.
   *
   * Everything runs on `whileInView` with `once`, so opening the Progress tab
   * plays it, and scrolling back up does not replay it.
   */
  return (
    <m.svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
    >
      {rings.map((r, i) => {
        const ringPoints = data.map((_, index) => pointAt(index, r));
        const ringPath = ringPoints.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
        return (
          <m.path
            key={r}
            d={ringPath}
            fill="none"
            stroke="currentColor"
            className="text-stone-200"
            strokeWidth={1}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: duration.base, ease: ease.standard, delay: staggerDelay(i, 0.05) }}
          />
        );
      })}

      {data.map((_, i) => {
        const p = pointAt(i, 1);
        return (
          <m.line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            className="text-stone-200"
            strokeWidth={1}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: duration.base, ease: ease.standard, delay: 0.1 }}
          />
        );
      })}

      <m.path
        d={dataPath}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ transformOrigin: `${center}px ${center}px` }}
        variants={{
          hidden: { scale: 0, opacity: 0 },
          visible: { scale: 1, opacity: 1 },
        }}
        transition={{ ...spring.gentle, delay: 0.16 }}
      />

      {dataPoints.map((p, i) => (
        <m.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          variants={{ hidden: { scale: 0 }, visible: { scale: 1 } }}
          transition={{ ...spring.snappy, delay: 0.34 + staggerDelay(i, 0.05) }}
        />
      ))}

      {data.map((d, i) => {
        const labelPoint = pointAt(i, 1.22);
        return (
          <m.text
            key={d.label}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-stone-500 font-bold"
            style={{ fontSize: size * 0.032 }}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: duration.base, ease: ease.standard, delay: 0.3 + staggerDelay(i, 0.04) }}
          >
            {d.label}
          </m.text>
        );
      })}
    </m.svg>
  );
}
