/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The share card: a learner's record as one picture, drawn on a canvas so it
 * can be saved or passed to the device's share sheet.
 *
 * Every figure on it is one the profile already shows, read from the same
 * props. The card states them and adds nothing: no percentile, no "top X%",
 * nothing that would have to be invented to be printed.
 */

import type { Topic } from '../../shared/types';
import { MARK_DOT, MARK_PATH, MARK_STROKE } from '../components/brand';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export type CardDesign = 'night' | 'paper' | 'brass';

export interface CardData {
  name: string;
  handle: string | null;
  tier: string;
  level: string | null;
  points: number;
  solved: number;
  streak: number;
  /** null until an answer has been given: a dash is printed, not 0%. */
  accuracy: number | null;
  skills: Record<Topic, number>;
}

interface Palette { ground: [string, string]; glow: string; ink: string; soft: string; faint: string; accent: string; rule: string }

export const DESIGNS: Record<CardDesign, { label: string; pro: boolean; palette: Palette }> = {
  night: { label: 'Night', pro: false, palette: { ground: ['#1b3039', '#0c181d'], glow: '#e6bd7333', ink: '#f1ece2', soft: '#b6c2bf', faint: '#81928f', accent: '#e6bd73', rule: '#f2ece124' } },
  paper: { label: 'Paper', pro: true, palette: { ground: ['#fdfcf7', '#f1ede0'], glow: '#426c7b1f', ink: '#22333b', soft: '#5c6b70', faint: '#8a9698', accent: '#a87a2f', rule: '#22333b24' } },
  brass: { label: 'Brass', pro: true, palette: { ground: ['#f2d498', '#d39f47'], glow: '#fff8e666', ink: '#21180a', soft: '#5a4318', faint: '#7a5e26', accent: '#21180a', rule: '#21180a33' } },
};

const TOPIC_HUE: Record<Topic, string> = { Algebra: '#c8842a', Geometry: '#209d8c', Combinatorics: '#8b5cf6', 'Number Theory': '#0484c0' };
const TOPICS: readonly Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

const SERIF = `'Newsreader', Georgia, serif`;
const SANS = `'Geist', 'DM Sans', system-ui, sans-serif`;
const MONO = `'Geist Mono', ui-monospace, monospace`;

/** The faces the card is set in. Loaded before drawing: a canvas does not wait for a webfont the way the page does. */
export const CARD_FONTS: readonly string[] = [`400 64px ${SERIF}`, `400 28px ${SANS}`, `500 21px ${SANS}`, `600 28px ${SANS}`, `500 19px ${MONO}`, `600 13px ${MONO}`];

const grouped = (value: number) => Math.round(value).toLocaleString('en-US');

/** Shrink a line of text until it fits, so a long name is never cut off or run under the mark. */
function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, start: number, floor: number): number {
  let size = start;
  context.font = font(size);
  while (size > floor && context.measureText(text).width > maxWidth) {
    size -= 2;
    context.font = font(size);
  }
  return size;
}

function spaced(context: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  // letterSpacing is not in every browser's canvas; drawing letter by letter is.
  let cursor = x;
  for (const letter of text) {
    context.fillText(letter, cursor, y);
    cursor += context.measureText(letter).width + tracking;
  }
}

export function drawShareCard(context: CanvasRenderingContext2D, data: CardData, design: CardDesign): void {
  const { palette } = DESIGNS[design];
  const W = CARD_WIDTH, H = CARD_HEIGHT, pad = 72;

  const ground = context.createLinearGradient(0, 0, W * 0.6, H);
  ground.addColorStop(0, palette.ground[0]);
  ground.addColorStop(1, palette.ground[1]);
  context.fillStyle = ground;
  context.fillRect(0, 0, W, H);

  const glow = context.createRadialGradient(W * 0.86, H * 0.1, 0, W * 0.86, H * 0.1, W * 0.55);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'transparent');
  context.fillStyle = glow;
  context.fillRect(0, 0, W, H);

  // Squared paper, fading out toward the left so it never sits behind the name.
  context.save();
  context.strokeStyle = palette.rule;
  context.lineWidth = 1;
  for (let x = W; x > W * 0.45; x -= 40) { context.globalAlpha = Math.max(0, (x - W * 0.45) / (W * 0.55)) * 0.55; context.beginPath(); context.moveTo(x + 0.5, 0); context.lineTo(x + 0.5, H); context.stroke(); }
  for (let y = 30; y < H; y += 40) {
    const fade = context.createLinearGradient(W * 0.45, 0, W, 0);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(1, palette.rule);
    context.globalAlpha = 0.55;
    context.strokeStyle = fade;
    context.beginPath(); context.moveTo(W * 0.45, y + 0.5); context.lineTo(W, y + 0.5); context.stroke();
  }
  context.restore();

  // The mark and wordmark.
  context.save();
  context.translate(pad, pad - 14);
  context.scale(1.25, 1.25);
  context.strokeStyle = palette.accent;
  context.fillStyle = palette.accent;
  context.lineWidth = MARK_STROKE;
  context.lineCap = 'round';
  context.stroke(new Path2D(MARK_PATH));
  context.beginPath(); context.arc(MARK_DOT.cx, MARK_DOT.cy, MARK_DOT.r, 0, Math.PI * 2); context.fill();
  context.restore();
  context.fillStyle = palette.ink;
  context.textBaseline = 'alphabetic';
  context.font = `600 28px ${SANS}`;
  context.fillText('calculix', pad + 60, pad + 22);
  const brandWidth = context.measureText('calculix').width;
  context.font = `400 28px ${SANS}`;
  context.fillText('hub', pad + 60 + brandWidth, pad + 22);

  // Who this is.
  const nameSize = fitText(context, data.name, W * 0.56, size => `400 ${size}px ${SERIF}`, 84, 44);
  context.fillStyle = palette.ink;
  context.fillText(data.name, pad, 232);
  context.font = `500 22px ${MONO}`;
  context.fillStyle = palette.soft;
  const line = [data.handle ? `@${data.handle}` : null, data.tier, data.level].filter(Boolean).join('  ·  ');
  context.fillText(line, pad, 232 + Math.max(40, nameSize * 0.56));

  // Four figures on one baseline.
  const figures: [string, string][] = [
    [grouped(data.points), 'POINTS'],
    [grouped(data.solved), 'SOLVED'],
    [data.accuracy == null ? '—' : `${Math.round(data.accuracy)}%`, 'ACCURACY'],
    [grouped(data.streak), 'DAY STREAK'],
  ];
  const baseline = 452, column = 190;
  figures.forEach(([value, label], index) => {
    const x = pad + index * column;
    context.fillStyle = index === 0 ? palette.accent : palette.ink;
    fitText(context, value, column - 34, size => `400 ${size}px ${SERIF}`, 64, 34);
    context.fillText(value, x, baseline);
    context.fillStyle = palette.faint;
    context.font = `600 13px ${MONO}`;
    spaced(context, label, x, baseline + 30, 1.6);
  });

  // Topic mastery, as four bars on the right.
  const barsX = W - pad - 300, barsTop = 196, barWidth = 300;
  context.font = `600 13px ${MONO}`;
  context.fillStyle = palette.faint;
  spaced(context, 'MASTERY BY TOPIC', barsX, barsTop - 26, 1.6);
  TOPICS.forEach((topic, index) => {
    const y = barsTop + index * 64;
    const value = Math.max(0, Math.min(100, Math.round(data.skills[topic] ?? 0)));
    context.font = `500 21px ${SANS}`;
    context.fillStyle = palette.ink;
    context.textAlign = 'left';
    context.fillText(topic, barsX, y + 16);
    context.textAlign = 'right';
    context.font = `500 19px ${MONO}`;
    context.fillStyle = palette.soft;
    context.fillText(`${value}%`, barsX + barWidth, y + 16);
    context.textAlign = 'left';
    context.fillStyle = palette.rule;
    context.beginPath(); context.roundRect(barsX, y + 28, barWidth, 8, 4); context.fill();
    if (value > 0) {
      context.fillStyle = design === 'brass' ? palette.ink : TOPIC_HUE[topic];
      context.beginPath(); context.roundRect(barsX, y + 28, Math.max(8, barWidth * value / 100), 8, 4); context.fill();
    }
  });

  // Foot: a rule, the address, and the date the card was made.
  context.fillStyle = palette.rule;
  context.fillRect(pad, H - 92, W - pad * 2, 1);
  context.font = `500 19px ${MONO}`;
  context.fillStyle = palette.soft;
  context.fillText('calculixhub.com', pad, H - 52);
  context.textAlign = 'right';
  context.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), W - pad, H - 52);
  context.textAlign = 'left';
}
