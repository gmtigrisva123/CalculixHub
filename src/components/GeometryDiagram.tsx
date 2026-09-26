import React from 'react';
import type { GeometryFigure } from '../../shared/types';

type Point = [number, number];
export default function GeometryDiagram({ figure }: { figure: GeometryFigure }) {
  const values = figure.values ?? [];
  const labels = figure.labels ?? [];
  let points: Point[] = [];
  if (figure.kind === 'triangle' && values.length >= 3) {
    const [a, b, c] = values;
    const x = (b * b + c * c - a * a) / (2 * c);
    const y = Math.sqrt(Math.max(0, b * b - x * x));
    points = [[0, 0], [c, 0], [x, y]];
  } else if (figure.kind === 'coordinate-grid') {
    for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]]);
  } else if (figure.kind === 'regular-polygon') {
    const [side, count] = values;
    const radius = side / (2 * Math.sin(Math.PI / count));
    points = Array.from({ length: count }, (_, i): Point => [radius * Math.cos(2 * Math.PI * i / count), radius * Math.sin(2 * Math.PI * i / count)]);
  } else if (figure.kind === 'quadrilateral' && values.length === 4) {
    // A cyclic quadrilateral: solve the circumradius from the central angles.
    const max = Math.max(...values);
    const minorSum = (r: number) => values.reduce((sum, side) => sum + 2 * Math.asin(side / (2 * r)), 0);
    const major = minorSum(max / 2) < 2 * Math.PI;
    const longest = values.indexOf(max);
    const angles = (r: number) => values.map((side, i) => {
      const angle = 2 * Math.asin(side / (2 * r));
      return major && i === longest ? 2 * Math.PI - angle : angle;
    });
    let low = max / 2, high = max * 1000;
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      const sum = angles(mid).reduce((a, b) => a + b, 0);
      if (major ? sum < 2 * Math.PI : sum > 2 * Math.PI) low = mid; else high = mid;
    }
    const radius = (low + high) / 2;
    let angle = 0;
    for (const delta of angles(radius)) { points.push([radius * Math.cos(angle), radius * Math.sin(angle)]); angle += delta; }
  }
  const minX = points.length ? Math.min(...points.map(p => p[0])) : 0;
  const minY = points.length ? Math.min(...points.map(p => p[1])) : 0;
  const width = points.length ? Math.max(...points.map(p => p[0])) - minX : 1;
  const height = points.length ? Math.max(...points.map(p => p[1])) - minY : 1;
  const scale = Math.min(270 / (width || 1), 180 / (height || 1));
  const mapped = points.map(([x, y]): Point => [45 + (270 - width * scale) / 2 + (x - minX) * scale, 225 - (180 - height * scale) / 2 - (y - minY) * scale]);
  const auxiliaries: { label: string; point: Point }[] = [];
  const lines: [Point, Point][] = [];
  const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (figure.kind === 'triangle' && mapped.length === 3 && figure.construction) {
    const [a, b, c] = mapped;
    const mid = midpoint(b, c);
    if (figure.construction === 'median' || figure.construction === 'ceva') {
      lines.push([a, mid]); auxiliaries.push({ label: 'M', point: mid });
      if (figure.construction === 'ceva') lines.push([b, midpoint(a, c)], [c, midpoint(a, b)]);
    }
    if (figure.construction === 'bisector') {
      const [, ac, ab] = values;
      const d: Point = [(ac * b[0] + ab * c[0]) / (ac + ab), (ac * b[1] + ab * c[1]) / (ac + ab)];
      lines.push([a, d]); auxiliaries.push({ label: 'D', point: d });
    }
    if (figure.construction === 'centers' || figure.construction === 'euler-line') {
      const [sa, sb, sc] = values;
      const total = sa + sb + sc;
      const inc: Point = [(sa * a[0] + sb * b[0] + sc * c[0]) / total, (sa * a[1] + sb * b[1] + sc * c[1]) / total];
      const circum: Point = [midpoint(a, b)[0], a[1] - ((sb * sb - sc * points[2][0]) / (2 * points[2][1])) * scale];
      auxiliaries.push({ label: 'O', point: circum });
      if (figure.construction === 'centers') { auxiliaries.push({ label: 'I', point: inc }); lines.push([circum, inc]); }
      else {
        const centroid: Point = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
        const ortho: Point = [a[0] + b[0] + c[0] - 2 * circum[0], a[1] + b[1] + c[1] - 2 * circum[1]];
        auxiliaries.push({ label: 'G', point: centroid }, { label: 'H', point: ortho }); lines.push([circum, ortho]);
      }
    }
  }
  if (figure.construction === 'diagonals' && mapped.length === 4) lines.push([mapped[0], mapped[2]], [mapped[1], mapped[3]]);
  return <figure className="border border-line rounded-2xl p-3 bg-surface-sunken/40">
    <svg viewBox="0 0 360 270" role="img" aria-label={'Geometric construction: ' + figure.kind} className="w-full max-h-72 text-content">
      {figure.kind === 'circle' ? <>
        <circle cx="180" cy="135" r="90" fill="none" stroke="currentColor" strokeWidth="2"/>
        <line x1="180" y1="135" x2="270" y2="135" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="180" cy="135" r="3" fill="currentColor"/>
        <text x="210" y="125" fill="currentColor">{labels[0] ?? 'r'}</text>
      </> : mapped.length ? <>
        <polygon points={mapped.map(p => p.join(',')).join(' ')} fill="rgba(99,102,241,0.06)" stroke="currentColor" strokeWidth="2"/>
        {mapped.map((point, i) => {
          const next = mapped[(i + 1) % mapped.length];
          return <g key={i}><circle cx={point[0]} cy={point[1]} r="3" fill="currentColor"/>
            <text x={point[0] + 7} y={point[1] - 9} fill="currentColor" fontSize="13">{figure.kind === 'coordinate-grid' ? labels[i] : String.fromCharCode(65 + i)}</text>
            {figure.kind !== 'coordinate-grid' && <text x={(point[0] + next[0]) / 2} y={(point[1] + next[1]) / 2 + 17} textAnchor="middle" fill="currentColor" fontSize="13">{figure.kind === 'triangle' ? labels[[2, 0, 1][i]] : labels[i]}</text>}
          </g>;
        })}
      </> : <text x="180" y="135" textAnchor="middle" fill="currentColor">See the stated lengths in the problem.</text>}
      {lines.map(([a, b], i) => <line key={'line' + i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4"/>)}
      {auxiliaries.map(({ label, point }) => <g key={label}><circle cx={point[0]} cy={point[1]} r="3" fill="currentColor"/><text x={point[0] + 5} y={point[1] - 6} fill="currentColor" fontSize="12">{label}</text></g>)}
    </svg>
    <figcaption className="text-xs text-content-subtle">{figure.illustrative ? 'An exact example illustrating the general theorem; the proof must cover all configurations.' : 'Constructed from the given measurements. Use the stated values in your reasoning.'}</figcaption>
  </figure>;
}
