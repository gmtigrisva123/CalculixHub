/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface VelocityDatum {
  date: string;
  value: number;
}

interface VelocityChartProps {
  data: VelocityDatum[];
  color?: string;
  unit?: string;
}

// Small dependency-free SVG line chart driven entirely by real data points
// (no hardcoded coordinates) — renders an empty state when there isn't
// enough history yet instead of faking a trend line.
export default function VelocityChart({ data, color = '#c8842a', unit = 'pts' }: VelocityChartProps) {
  const width = 700;
  const height = 220;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  if (data.length < 2) {
    return (
      <div className="w-full h-64 border border-stone-100 rounded-2xl bg-stone-50/50 flex items-center justify-center text-center px-6">
        <p className="text-xs text-stone-400 max-w-xs">
          Not enough history yet &mdash; solve a few more problems across different sessions and your progress trend will appear here.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = Math.max(1, maxVal - minVal);

  const xAt = (i: number) => padLeft + (i / (data.length - 1)) * plotW;
  const yAt = (v: number) => padTop + plotH - ((v - minVal) / range) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)},${yAt(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(data.length - 1).toFixed(1)},${padTop + plotH} L ${xAt(0).toFixed(1)},${padTop + plotH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full h-64 border border-stone-100 rounded-2xl bg-stone-50/50 p-4 relative">
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {gridLines.map((g) => {
          const y = padTop + plotH * g;
          return <line key={g} x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth={1} />;
        })}
        <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="#e2e8f0" strokeWidth={1.5} />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#e2e8f0" strokeWidth={1.5} />

        <path d={areaPath} fill={`url(#velocityGradient)`} opacity={0.15} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(d.value)} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
        ))}

        {gridLines.map((g) => (
          <text key={g} x={padLeft - 10} y={padTop + plotH * (1 - g) + 3} textAnchor="end" className="fill-stone-400 font-mono font-bold" style={{ fontSize: 10 }}>
            {Math.round(minVal + range * g)} {unit}
          </text>
        ))}

        {data.map((d, i) => {
          if (data.length > 8 && i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
          return (
            <text key={d.date + i} x={xAt(i)} y={height - 10} textAnchor="middle" className="fill-stone-400 font-mono font-bold" style={{ fontSize: 10 }}>
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
    </div>
  );
}
