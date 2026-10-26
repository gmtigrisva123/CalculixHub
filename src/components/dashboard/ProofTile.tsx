/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Something to think about: (x + y)², seen rather than expanded.
 *
 * A square of side x + y draws itself, splits along x and y, and its four
 * pieces fill in -- x², two rectangles of xy, and y². Then x and y keep
 * trading length, and the identity holds at every proportion: the simpler
 * step, made visible.
 */

import { useCallback, useRef } from 'react';
import { m } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Level, Topic } from '../../../shared/types';
import { spring } from '../../lib/motion';
import { clamp01, easeInOut, easeOut, useCanvasScene, withAlpha, type Scene } from './useCanvasScene';

interface ProofTileProps {
  still: boolean;
  paused: boolean;
  navigate: (tab: string, arg?: { topic?: Topic; level?: Level }) => void;
}

const INTRO = 2.6;

const STEPS: [string, string][] = [
  ['(x + y)²', '= (x + y)(x + y)'],
  ['', '= x² + xy + yx + y²'],
];

function createProof(still: boolean): Scene {
  const ink = { line: '#293d46', soft: '#9eaeae', label: '#293d46', x2: '#c8842a', xy: '#209d8c', y2: '#8b5cf6', paper: '#fdfcf7' };
  let time = still ? INTRO + 0.4 : 0;

  return {
    palette(read) {
      ink.line = read('--dh-proof-line', ink.line);
      ink.soft = read('--dh-glyph-line', ink.soft);
      ink.label = read('--dh-proof-label', ink.label);
      ink.x2 = read('--dh-alg', ink.x2);
      ink.xy = read('--dh-geo', ink.xy);
      ink.y2 = read('--dh-com', ink.y2);
      ink.paper = read('--dh-card', ink.paper);
    },
    rest() {
      time = INTRO + 0.4;
    },
    frame(ctx, { width, height }, dt) {
      time += dt;
      ctx.clearRect(0, 0, width, height);
      const side = Math.min(width, height) * 0.7;
      const left = (width - side) / 2 + side * 0.04;
      const top = (height - side) / 2 + side * 0.05;
      const breathing = Math.max(0, time - INTRO - 1.2);
      const u = 0.6 - 0.18 * Math.sin(breathing * 0.85) * clamp01(breathing / 1.5);
      const split = side * u;

      // The square draws itself, corner to corner.
      const outline = easeInOut(time / 0.9);
      ctx.strokeStyle = withAlpha(ink.line, 0.9);
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const corners: [number, number][] = [[left, top], [left + side, top], [left + side, top + side], [left, top + side], [left, top]];
      const travel = outline * 4;
      ctx.moveTo(left, top);
      for (let i = 0; i < 4 && i < travel; i++) {
        const part = Math.min(1, travel - i);
        const [ax, ay] = corners[i];
        const [bx, by] = corners[i + 1];
        ctx.lineTo(ax + (bx - ax) * part, ay + (by - ay) * part);
      }
      ctx.stroke();

      const pieces = [
        { x: left, y: top, w: split, h: split, color: ink.x2, label: 'x²', at: 1.3 },
        { x: left + split, y: top, w: side - split, h: split, color: ink.xy, label: 'xy', at: 1.55 },
        { x: left, y: top + split, w: split, h: side - split, color: ink.xy, label: 'xy', at: 1.8 },
        { x: left + split, y: top + split, w: side - split, h: side - split, color: ink.y2, label: 'y²', at: 2.05 },
      ];
      const fontSize = Math.round(Math.max(13, Math.min(22, side * 0.085)));
      for (const piece of pieces) {
        const show = easeOut((time - piece.at) / 0.45);
        if (show <= 0) continue;
        const inset = 3;
        ctx.fillStyle = withAlpha(piece.color, 0.2 * show);
        ctx.fillRect(piece.x + inset, piece.y + inset, Math.max(0, piece.w - inset * 2), Math.max(0, piece.h - inset * 2));
        ctx.strokeStyle = withAlpha(piece.color, 0.85 * show);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(piece.x + inset, piece.y + inset, Math.max(0, piece.w - inset * 2), Math.max(0, piece.h - inset * 2));
        if (piece.w > fontSize * 1.4 && piece.h > fontSize * 1.2) {
          ctx.fillStyle = withAlpha(ink.label, show);
          ctx.font = `italic 400 ${fontSize}px Newsreader, Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(piece.label, piece.x + piece.w / 2, piece.y + piece.h / 2 + (1 - show) * 6);
        }
      }

      // The dividing lines, then the lengths they mark along two edges.
      const cut = easeInOut((time - 0.8) / 0.55);
      if (cut > 0) {
        ctx.strokeStyle = withAlpha(ink.line, 0.75);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(left + split, top);
        ctx.lineTo(left + split, top + side * cut);
        ctx.moveTo(left, top + split);
        ctx.lineTo(left + side * cut, top + split);
        ctx.stroke();
      }
      const marks = easeOut((time - 2.2) / 0.5);
      if (marks > 0) {
        const gap = Math.max(10, side * 0.055);
        const small = Math.round(Math.max(12, fontSize * 0.8));
        ctx.strokeStyle = withAlpha(ink.soft, 0.9 * marks);
        ctx.fillStyle = withAlpha(ink.label, 0.85 * marks);
        ctx.lineWidth = 1;
        ctx.font = `italic 400 ${small}px Newsreader, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const spans: [number, number, string][] = [[0, split, 'x'], [split, side, 'y']];
        for (const [from, to, name] of spans) {
          // Along the top edge…
          ctx.beginPath();
          ctx.moveTo(left + from + 2, top - gap);
          ctx.lineTo(left + to - 2, top - gap);
          ctx.moveTo(left + from + 2, top - gap - 3);
          ctx.lineTo(left + from + 2, top - gap + 3);
          ctx.moveTo(left + to - 2, top - gap - 3);
          ctx.lineTo(left + to - 2, top - gap + 3);
          ctx.stroke();
          ctx.fillStyle = withAlpha(ink.paper, marks);
          ctx.fillRect(left + (from + to) / 2 - small * 0.6, top - gap - small * 0.6, small * 1.2, small * 1.2);
          ctx.fillStyle = withAlpha(ink.label, 0.85 * marks);
          ctx.fillText(name, left + (from + to) / 2, top - gap);
          // …and down the left.
          ctx.beginPath();
          ctx.moveTo(left - gap, top + from + 2);
          ctx.lineTo(left - gap, top + to - 2);
          ctx.moveTo(left - gap - 3, top + from + 2);
          ctx.lineTo(left - gap + 3, top + from + 2);
          ctx.moveTo(left - gap - 3, top + to - 2);
          ctx.lineTo(left - gap + 3, top + to - 2);
          ctx.stroke();
          ctx.fillStyle = withAlpha(ink.paper, marks);
          ctx.fillRect(left - gap - small * 0.6, top + (from + to) / 2 - small * 0.6, small * 1.2, small * 1.2);
          ctx.fillStyle = withAlpha(ink.label, 0.85 * marks);
          ctx.fillText(name, left - gap, top + (from + to) / 2);
        }
      }
    },
  };
}

export default function ProofTile({ still, paused, navigate }: ProofTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const create = useCallback(() => createProof(still), [still]);
  useCanvasScene(canvasRef, create, { still, paused, fps: 30 });

  return (
    <m.section
      className="dh-card dh-proof"
      aria-labelledby="dh-proof-title"
      initial={still ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ ...spring.smooth, delay: 0.08 }}
    >
      <div className="dh-proof-top">
        <span className="dh-chip">
          <Sparkles size={14} aria-hidden="true" /> Something to think about
        </span>
        <span className="dh-proof-day">Today</span>
      </div>
      <div className="dh-proof-body">
        <div className="dh-proof-figure">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="A square with side x plus y, cut into a square of x squared, two rectangles of x times y, and a square of y squared."
          />
        </div>
        <div className="dh-proof-text">
          <p className="dh-proof-equation" aria-label="(x plus y) squared equals x squared, plus 2 x y, plus y squared.">
            <span aria-hidden="true">
              (x + y)² = <span className="dh-term" data-topic="alg">x²</span> + <span className="dh-term" data-topic="geo">2xy</span> +{' '}
              <span className="dh-term" data-topic="com">y²</span>
            </span>
          </p>
          <h2 id="dh-proof-title">Look for the simpler step.</h2>
          <p className="dh-proof-copy">A fresh perspective starts with a little practice. Take a few minutes for your mind.</p>
          <button type="button" className="dh-proof-cta" onClick={() => navigate('learn', { topic: 'Algebra' })}>
            Explore algebra <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {/* The same identity in symbols, one step at a time, beside the picture of it. */}
        <ol className="dh-proof-steps" aria-label="Expanding (x + y) squared, one step at a time">
          {STEPS.map(([left, right], i) => (
            <m.li
              key={right}
              initial={still ? false : { opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ ...spring.smooth, delay: 0.25 + i * 0.22 }}
            >
              <span>{left}</span>
              <span>{right}</span>
            </m.li>
          ))}
          <m.li
            className="dh-proof-result"
            initial={still ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ ...spring.smooth, delay: 0.25 + STEPS.length * 0.22 }}
            aria-label="equals x squared, plus 2 x y, plus y squared"
          >
            <span />
            <span aria-hidden="true">
              = <span className="dh-term" data-topic="alg">x²</span> + <span className="dh-term" data-topic="geo">2xy</span> +{' '}
              <span className="dh-term" data-topic="com">y²</span>
            </span>
          </m.li>
        </ol>
      </div>
    </m.section>
  );
}
