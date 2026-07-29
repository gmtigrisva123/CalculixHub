/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

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

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      {rings.map((r) => {
        const ringPoints = data.map((_, i) => pointAt(i, r));
        const ringPath = ringPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
        return <path key={r} d={ringPath} fill="none" stroke="currentColor" className="text-stone-200" strokeWidth={1} />;
      })}

      {data.map((_, i) => {
        const p = pointAt(i, 1);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" className="text-stone-200" strokeWidth={1} />;
      })}

      <path d={dataPath} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} strokeLinejoin="round" />

      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="white" strokeWidth={1.5} />
      ))}

      {data.map((d, i) => {
        const labelPoint = pointAt(i, 1.22);
        return (
          <text
            key={d.label}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-stone-500 font-bold"
            style={{ fontSize: size * 0.032 }}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
