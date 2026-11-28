/**
 * "Four kinds of problem. Which one is yours?" — the chalkboard.
 *
 * The thread arrives on the board from the chord problem's circle and
 * shatters there into chalk dust: each particle leaves the circle on its own
 * moment, strays, and lands a little above where it will lie, then settles
 * as the board comes up the page. Dust lies the way dust does, thicker low
 * down and gathering toward the chalk ledge the stage ends on. It drifts a
 * little in the air of the room, and a mouse moving over the board stirs it.
 *
 * The dust is light over the slate, and never sits over anything a reader
 * reads: the heading, each room from its title down (the drawing, the slip,
 * the links), and the foot are held in front of it. A room's top band, where
 * its symbol hangs, is bare board.
 *
 * Each room's symbol (∑ △ ! ≡) is a 3D glyph extruded from a hand-built
 * outline and bevelled, in a chalk material: pale chalk tinted with the
 * room's colour, pitted with grain, lit softly from the upper left with a
 * little edge light, matt as chalk is. The glyphs idle (a slow bob and turn)
 * and turn their faces toward the pointer; on a touch screen, toward the last
 * tap. The DOM symbol stays underneath as the drawing without WebGL.
 *
 * The rooms answer the reader through the thread bus ('topic-choice'):
 *
 *   wrong   the glyph shudders, a damped shake like a head saying no, and
 *           puffs a little dust from its foot; the board's own dust near it
 *           is blown aside and drifts back
 *   right   a chalk ring draws itself round the glyph, the glyph brightens
 *           for a moment, and the dust on the board swirls toward the slip,
 *           into the explanation, then lets go as the words arrive
 *
 * Under reduced motion nothing idles or drifts, and the reactions are
 * instant changes of state: a ring that is simply there.
 */

import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, ExtrudeGeometry, Group, Mesh, OneFactor, OneMinusSrcAlphaFactor,
  PlaneGeometry, Points, ShaderMaterial, Shape, Vector2, Vector3, Vector4,
} from 'three';
import { docBox, type Box } from './stageLayout';
import { EMPTY_BOX as EMPTY, follow, place, query, resetSlot, stageRadius } from './threadKit';
import { SHAPE, STAGE_COMMON } from './threadShaders';
import { clamp01, cssColorToSrgb, smoothstep, springStep } from './threadShapes';
import { onThread } from './threadBus';
import { wake } from './pageClock';
import { glide } from './scenePlayground';
import { TOPIC_ROOMS, ringPath } from './topicRooms';
import type { Extra, InkRect, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

// ---------------------------------------------------------------------------
// Timing: pure functions of the seconds since a moment, so they can be tested
// ---------------------------------------------------------------------------

/** The glyph's "no" after a wrong choice: a damped shake about its height, in radians. */
export function shudder(t: number): number {
  if (t <= 0 || t > 1.4) return 0;
  return 0.32 * Math.exp(-t * 5) * Math.sin(t * Math.PI * 2 * 6.5);
}

/** A puff of dust: a quick breath out, then the dust falls back where it was. */
export function puffEnvelope(t: number): number {
  if (t <= 0 || t > 2.4) return 0;
  return smoothstep(0, 0.08, t) * Math.exp(-Math.max(0, t - 0.08) / 0.45);
}

/** The swirl after a right choice: drawn in, held while the explanation arrives, let go. */
export function swirlEnvelope(t: number): number {
  if (t <= 0 || t > 3.2) return 0;
  return smoothstep(0, 0.55, t) * (1 - smoothstep(1.75, 3.1, t));
}

/** Where the swirl is on its way from the ringed glyph down into the slip's explanation: 0 at the glyph, 1 at the slip. */
export function swirlPour(t: number): number {
  return smoothstep(0.85, 1.85, t);
}

/** How much of the chalk ring is drawn, `t` seconds after a right choice. */
export function ringDrawn(t: number): number {
  return glide(clamp01(t / 0.95));
}

/** When the ring's drawing head reaches `share` of the way round, in seconds after a right choice. */
export function ringReaches(share: number): number {
  let lo = 0;
  let hi = 0.95;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (ringDrawn(mid) < share) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The glyph's small lift of pride when its ring is drawn: a scale above 1 that settles back. */
export function proudScale(t: number): number {
  if (t <= 0 || t > 1.6) return 1;
  return 1 + 0.13 * Math.exp(-t * 3.4) * Math.sin(Math.min(t, 1.6) * 7.5);
}

/**
 * A room's card, rising into place when a fifth of it comes into view: what
 * kit.tsx's Rise does in the DOM (opacity on GLIDE over 0.55 s, a 44 px rise
 * on the settle spring), so the glyph arrives with its card.
 */
export function roomEntrance(t: number): { presence: number; rise: number } {
  if (t < 0) return { presence: 0, rise: 44 };
  // SPRING.settle (visualDuration 0.9, bounce 0.06) as Motion resolves it: stiffness 33.8, damping 10.9, mass 1.
  return { presence: glide(clamp01(t / 0.55)), rise: 44 * (1 - springStep(t, 33.8, 10.9, 1)) };
}

// ---------------------------------------------------------------------------
// The glyphs, as outlines in units of the type's cap height
// ---------------------------------------------------------------------------

function polygon(points: [number, number][]): Shape {
  const shape = new Shape();
  points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return shape;
}

function capsule(x0: number, x1: number, y: number, height: number): Shape {
  const r = height / 2;
  const shape = new Shape();
  shape.moveTo(x0 + r, y);
  shape.lineTo(x1 - r, y);
  shape.absarc(x1 - r, y + r, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(x0 + r, y + height);
  shape.absarc(x0 + r, y + r, r, Math.PI / 2, Math.PI * 1.5, false);
  return shape;
}

/**
 * The outline of a room's symbol, as three.js shapes in units of the cap
 * height (y up). Drawn by hand rather than taken from a font file: the page
 * downloads no 3D assets, and a chalk glyph wants its own sturdy strokes.
 */
export function glyphShapes(symbol: string): Shape[] {
  switch (symbol) {
    case '∑':
      // Top bar with its serif, the two diagonals meeting at the tip, the bottom bar with its serif.
      return [polygon([
        [0, 1], [0.8, 1], [0.85, 0.74], [0.79, 0.74], [0.73, 0.875], [0.21, 0.875], [0.52, 0.5], [0.19, 0.125],
        [0.75, 0.125], [0.81, 0.27], [0.87, 0.27], [0.82, 0], [0, 0], [0, 0.06], [0.37, 0.5], [0, 0.94],
      ])];
    case '△': {
      // An outline: the triangle with a triangle cut from it, the stroke as wide all round.
      const side = 1.12;
      const h = side * Math.sqrt(3) / 2;
      const inradius = side / (2 * Math.sqrt(3));
      const k = (inradius - 0.16) / inradius;
      const c: [number, number] = [side / 2, inradius];
      const corners: [number, number][] = [[0, 0], [side, 0], [side / 2, h]];
      const outer = polygon(corners);
      const hole = polygon(corners.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k] as [number, number]).reverse());
      outer.holes.push(hole);
      return [outer];
    }
    case '!': {
      // A bar that tapers to its foot, round at the head, and the dot below it.
      const bar = new Shape();
      bar.moveTo(0.44, 0.32);
      bar.lineTo(0.56, 0.32);
      bar.lineTo(0.62, 0.92);
      bar.quadraticCurveTo(0.63, 1, 0.55, 1);
      bar.lineTo(0.45, 1);
      bar.quadraticCurveTo(0.37, 1, 0.38, 0.92);
      bar.closePath();
      const dot = new Shape();
      dot.absarc(0.5, 0.1, 0.1, 0, Math.PI * 2, false);
      return [bar, dot];
    }
    default:
      // ≡: three bars with round ends, wider than the symbol is tall, as in type.
      return [capsule(0, 1, 0, 0.16), capsule(0, 1, 0.24, 0.16), capsule(0, 1, 0.48, 0.16)];
  }
}

// ---------------------------------------------------------------------------
// The scene: the dust on the board
// ---------------------------------------------------------------------------

interface Room {
  /** The room's card where it sits (its static place plus any CSS translate it wears). */
  card: Box;
  /** The part of the card in front of the dust: from its title down. */
  guard: Box;
  /** The DOM symbol the 3D glyph stands in for. */
  glyph: Box;
  /** The slip's note, where a right answer's explanation appears. */
  note: Box;
  /** The symbol's font size, px: the glyph's cap height follows it. */
  type: number;
  /** Answered before the stage could see it. */
  solved: boolean;
}

const union = (a: Box, b: Box): Box => {
  if (!a.width) return b;
  if (!b.width) return a;
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top };
};
const shifted = (box: Box, dy: number): Box => ({ ...box, top: box.top + dy });

/** The vertical part of an element's CSS `translate`, read when the layout is measured (the even rooms hang lower). */
function translateY(element: Element): number {
  const value = getComputedStyle(element).translate;
  if (!value || value === 'none') return 0;
  const parts = value.split(/\s+/);
  return parts.length > 1 ? Number.parseFloat(parts[1]) || 0 : 0;
}

export class TopicsScene implements ThreadScene {
  id = 'topics';
  private found = false;
  stage = EMPTY;
  /** Where the dust lies: the whole board, down to the ledge. */
  private board = EMPTY;
  private head = EMPTY;
  private foot = EMPTY;
  radius = 14;
  rooms: Room[] = [];
  /** When each room last heard a wrong and a right choice (performance.now; -1 never). */
  wrongAt = [-1, -1, -1, -1];
  rightAt = [-1, -1, -1, -1];
  /** A tap on the board from a finger: where (document px) and when. */
  tap = { x: 0, y: 0, at: -1 };

  measure() {
    const stage = query('.lx-topics-stage');
    this.found = Boolean(stage);
    if (!stage) return;
    this.stage = docBox(stage);
    this.radius = stageRadius();
    const ledge = query('.lx-ledge');
    const floor = ledge ? docBox(ledge).top : this.stage.top + this.stage.height;
    this.board = { left: this.stage.left + 6, top: this.stage.top + 6, width: this.stage.width - 12, height: floor - this.stage.top - 6 };
    this.head = union(docBox(query('#lx-topics-title')), docBox(query('.lx-topics-intro')));
    this.foot = Array.from(document.querySelectorAll<HTMLElement>('.lx-topics-foot > *')).reduce((box, child) => union(box, docBox(child)), EMPTY);
    this.rooms = Array.from(document.querySelectorAll<HTMLElement>('.lx-topic')).map(article => {
      const shift = translateY(article);
      const box = (selector: string) => shifted(docBox(article.querySelector<HTMLElement>(selector)), shift);
      const card = box('.lx-topic-inner');
      // From a hair under the top of the title's line box (its capitals sit well inside it), so the guard's
      // padding and soft edge stay clear of the symbol's band above, where the dust is left free to puff and swirl.
      const from = box('.lx-topic-title').top + 6;
      const symbol = article.querySelector<HTMLElement>('[data-topic-glyph]');
      return {
        card,
        guard: { left: card.left, top: from, width: card.width, height: card.top + card.height - from },
        glyph: box('[data-topic-glyph]'),
        note: box('.lx-slip-note'),
        type: symbol ? Number.parseFloat(getComputedStyle(symbol).fontSize) || 60 : 60,
        solved: article.hasAttribute('data-solved'),
      };
    });
  }

  present() { return this.found; }

  /** The board on screen this frame. */
  stageRect(frame: StageFrame): InkRect {
    return { x: this.stage.left, y: this.stage.top - frame.y, w: this.stage.width, h: this.stage.height, r: this.radius };
  }

  /** The stretch of scroll over which the circle shatters onto the board: as the board comes up the screen. */
  arrival(frame: StageFrame): [number, number] {
    return [this.stage.top - frame.vh * 0.92, this.stage.top - frame.vh * 0.14];
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.found) return;
    const rect = this.stageRect(frame);
    if (rect.y < frame.ch && rect.y + rect.h > 0) out.push(rect);
  }

  /** What stands in front of the dust, in page order: the heading, each room from its title down, the foot. */
  private guards(): Box[] {
    return [this.head, ...this.rooms.map(room => room.guard), this.foot].filter(box => box.width > 0);
  }

  slot(frame: StageFrame, out: Slot) {
    resetSlot(out);
    if (!this.found) return;
    const board = this.board;
    const cx = board.left + board.width / 2;
    const cy = board.top + board.height / 2;
    out.shape = SHAPE.dust;
    place(out.matrix, frame, cx, cy - frame.y);
    // Landed a little above where it will lie, the dust settles as the board comes up the page.
    const [start, end] = this.arrival(frame);
    const settle = smoothstep(start + (end - start) * 0.3, end + frame.vh * 0.4, frame.y);
    out.p[0].set(board.width, board.height, settle, frame.still ? 0 : 0.3);

    if (!frame.still) {
      // A puff where a glyph said no, or where a finger touched the board.
      let puff = 0;
      let px = 0;
      let py = 0;
      this.rooms.forEach((room, index) => {
        const strength = puffEnvelope((frame.now - this.wrongAt[index]) / 1000);
        if (this.wrongAt[index] >= 0 && strength > puff) {
          puff = strength;
          px = room.glyph.left + room.glyph.width / 2;
          py = room.glyph.top + room.glyph.height * 0.6;
        }
      });
      const tapped = this.tap.at >= 0 ? 0.7 * puffEnvelope((frame.now - this.tap.at) / 1000) : 0;
      if (tapped > puff) {
        puff = tapped;
        px = this.tap.x;
        py = this.tap.y;
      }
      out.p[1].set(px - cx, cy - py, puff, 95);
      // A right answer: the dust gathers into a swirl round the ringed glyph, then pours down with it into
      // the slip's explanation (where the room stands in front of the dust, so it is seen to go in), and lets go.
      let swirl = 0;
      let sx = 0;
      let sy = 0;
      let reach = 200;
      this.rooms.forEach((room, index) => {
        if (this.rightAt[index] < 0) return;
        const t = (frame.now - this.rightAt[index]) / 1000;
        const strength = swirlEnvelope(t);
        if (strength <= swirl) return;
        swirl = strength;
        const pour = swirlPour(t);
        const gx = room.glyph.left + room.glyph.width / 2;
        const gy = room.glyph.top + room.glyph.height / 2;
        const nx = room.note.left + room.note.width / 2;
        const ny = room.note.top + Math.min(room.note.height, 120) / 2;
        sx = gx + (nx - gx) * pour;
        sy = gy + (ny - gy) * pour;
        reach = 300 + 120 * pour;
      });
      out.p[2].set(sx - cx, cy - sy, swirl * 0.95, reach);
    }

    // Each mote has to be seen alone, not as part of a line. A particle's bright core is narrow, and in a
    // sprite of three pixels or so it falls between pixel centres and all but vanishes; at about six pixels
    // the core covers a pixel or two and the soft halo round it shows, which is what a fleck of chalk is.
    out.look.set(5.8, 0.5, 0.36, 0);
    const slate = this.stageRect(frame);
    out.clip.set(slate.x, slate.y, slate.w, slate.h);
    out.shade.set(slate.r, 16, 0, 0);
    // In front of the dust: whatever of the heading, the rooms and the foot is on screen. Four at most
    // can be at once with these proportions; on a screen where more are, the last are folded together.
    const top = frame.y - 60;
    const bottom = frame.y + frame.vh + 60;
    const seen = this.guards().filter(box => box.top + box.height >= top && box.top <= bottom);
    while (seen.length > 4) seen[3] = union(seen[3], seen.pop()!);
    seen.forEach((box, index) => out.occ[index].set(box.left - 12, box.top - frame.y - 12, box.width + 24, box.height + 24));
    out.occR.set(18, 18, 18, 18);
    out.flowing = !frame.still;
    out.pointer = frame.still ? 0 : 0.85;
    out.pointerRadius = 130;
  }
}

/** The thread arrives from the circle, which shatters: every particle on its own moment, in no order, with a wide stray. */
export function topicsLeg(self: TopicsScene): Leg {
  return {
    to: 'topics',
    window: frame => (self.present() ? self.arrival(frame) : null),
    stagger: 0.8,
    orderByU: 0,
    swirl: 190,
    lift: 170,
  };
}

// ---------------------------------------------------------------------------
// The extras: the glyphs, their rings, their puffs
// ---------------------------------------------------------------------------

const premultiplied = {
  transparent: true,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

/** Everything here is clipped to the board's rounded rectangle, as the DOM stage is. */
const MASK = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform float uDpr;
float boardMask() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  return clipAt(p, uClip, uClipR);
}
`;

const CHALK_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const CHALK_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uTone;
uniform float uPresence;
uniform float uFlash;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLocal;
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
void main() {
  float m = boardMask() * uPresence;
  if (m < 0.004) discard;
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(-vViewPos);
  // Chalk is pressed powder: a fine grain, a coarser mottle, and pits where a grain broke away.
  float grain = noise3(vLocal * 64.0);
  float mottle = noise3(vLocal * 17.0);
  float pit = smoothstep(0.7, 0.9, noise3(vLocal * 41.0 + 7.3));
  // The grain breaks the light up across the faces, as a rough surface does.
  vec3 bump = vec3(noise3(vLocal * 52.0), noise3(vLocal * 52.0 + 3.1), noise3(vLocal * 52.0 + 6.7)) - 0.5;
  n = normalize(n + bump * 0.42);
  // A rough lambert: one soft key from the upper left (wrapped, so the shadow side is never black), a cool fill.
  vec3 key = normalize(vec3(-0.42, 0.62, 0.66));
  float lit = clamp((dot(n, key) + 0.38) / 1.38, 0.0, 1.0);
  float fill = clamp(dot(n, normalize(vec3(0.6, -0.3, 0.55))), 0.0, 1.0);
  vec3 chalk = mix(vec3(0.95, 0.95, 0.925), uTone, 0.48);
  vec3 albedo = chalk * (0.78 + 0.16 * mottle + 0.12 * grain) * (1.0 - 0.42 * pit);
  // Soft edge light: the dust on a stick of chalk catches light along its silhouette.
  float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);
  vec3 colour = albedo * (0.24 + 0.88 * lit + 0.16 * fill) + mix(uTone, vec3(1.0), 0.4) * rim * 0.55;
  colour += mix(uTone, vec3(1.0), 0.3) * uFlash * 0.5;
  gl_FragColor = vec4(colour * m, m);
}`;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** The glyph's own glow on the slate: the type's text-shadow, as light. */
const GLOW_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uTone;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float d = dot(q, q);
  float a = exp(-d * 3.6) * (1.0 - smoothstep(0.6, 1.0, d)) * uAlpha * boardMask();
  gl_FragColor = vec4(uTone * a, 0.0);
}`;

const RING_VERTEX = /* glsl */ `
attribute float aS;
attribute float aSide;
varying float vS;
varying float vSide;
void main() {
  vS = aS;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** A stroke of chalk: drawn up to uDraw, pressing harder and lighter along its way, skipping where the board's tooth catches it. */
const RING_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uTone;
uniform float uDraw;
uniform float uAlpha;
varying float vS;
varying float vSide;
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  float drawn = 1.0 - smoothstep(uDraw - 0.01, uDraw, vS);
  float press = 0.72 + 0.28 * sin(vS * 21.0 + 1.3);
  float across = 1.0 - smoothstep(0.25 * press + 0.2, 1.0, abs(vSide));
  float tooth = hash12(vec2(floor(vS * 560.0), floor((vSide + 1.0) * 3.5)));
  float skip = smoothstep(0.1, 0.45, tooth);
  float ends = smoothstep(0.0, 0.03, vS) * (1.0 - 0.5 * smoothstep(0.9, 1.0, vS));
  float a = drawn * across * skip * ends * uAlpha * boardMask();
  vec3 colour = mix(uTone, vec3(1.0), 0.3);
  gl_FragColor = vec4(colour * a, a * 0.8);
}`;

const PUFF_VERTEX = /* glsl */ `
attribute vec3 aVelocity;
attribute float aSeed;
uniform float uAge;
uniform float uDpr;
varying float vAlpha;
void main() {
  float t = max(uAge, 0.0);
  // Thrown out, slowed by the air, sinking as chalk dust does.
  vec3 p = aVelocity * (1.0 - exp(-3.0 * t)) / 3.0;
  p.y -= 14.0 * t * t;
  p.x += sin(t * 2.2 + aSeed * 31.0) * 4.0 * t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float life = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.3 + 0.55 * aSeed, 1.35, t));
  vAlpha = uAge < 0.0 ? 0.0 : life * (0.45 + 0.55 * aSeed);
  gl_PointSize = (1.3 + 2.4 * aSeed) * (1.0 + 0.7 * t) * uDpr;
}`;

const PUFF_FRAGMENT = /* glsl */ `
uniform vec3 uTone;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = vAlpha * exp(-d * 3.2);
  gl_FragColor = vec4(mix(vec3(0.95, 0.95, 0.93), uTone, 0.3) * a, a * 0.6);
}`;

/**
 * Crumbs off the stick: as the ring is drawn, chalk dust falls from the
 * stroke just behind the drawing head and drifts down the board. Each crumb
 * knows where on the ring it comes from and when the head passes there.
 */
const CRUMB_VERTEX = /* glsl */ `
attribute vec2 aRing;
attribute float aBorn;
attribute float aSeed;
uniform float uAge;
uniform float uScale;
uniform float uDpr;
varying float vAlpha;
void main() {
  float t = uAge - aBorn;
  float s = max(t, 0.0);
  vec3 p = vec3(aRing * uScale, 0.0);
  p.x += sin(aSeed * 47.0) * 10.0 * s + sin(s * 3.0 + aSeed * 20.0) * 3.0 * s;
  p.y -= 10.0 * s + 22.0 * s * s;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float life = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.35 + 0.6 * aSeed, 1.6, t));
  vAlpha = (uAge < 0.0 || t < 0.0) ? 0.0 : life * (0.55 + 0.45 * aSeed);
  gl_PointSize = (2.2 + 2.8 * aSeed) * uDpr;
}`;

/** How tall a glyph's cap height is for type of this size (the symbols are set in Newsreader). */
const CAP = 0.7;
const PUFF_COUNT = 90;
const CRUMB_COUNT = 72;
/** The ring is drawn this much larger than the glyph's cap height. */
const RING_SCALE = 1.02;

interface Glyph {
  mesh: Mesh;
  glow: Mesh;
  ring: Mesh;
  puff: Points;
  crumbs: Points;
  chalk: { uTone: { value: Vector3 }; uPresence: { value: number }; uFlash: { value: number } };
  glowUniforms: { uAlpha: { value: number } };
  ringUniforms: { uDraw: { value: number }; uAlpha: { value: number } };
  puffUniforms: { uAge: { value: number } };
  crumbUniforms: { uAge: { value: number }; uScale: { value: number } };
  yaw: { x: number; v: number };
  pitch: { x: number; v: number };
  /** When the room's card rose into view (performance.now); 0 already there when the stage started; -1 not yet. */
  enteredAt: number;
}

function ringGeometry(): BufferGeometry {
  const points = ringPath(140);
  const width = 0.085;
  const positions = new Float32Array(points.length * 2 * 3);
  const along = new Float32Array(points.length * 2);
  const side = new Float32Array(points.length * 2);
  const index: number[] = [];
  points.forEach(([x, y], i) => {
    const [ax, ay] = points[Math.max(0, i - 1)];
    const [bx, by] = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / length;
    const ny = (bx - ax) / length;
    // A stick pressed a little harder through the middle of the stroke.
    const w = width * (0.8 + 0.3 * Math.sin((i / points.length) * Math.PI));
    positions.set([x + nx * w / 2, y + ny * w / 2, 0, x - nx * w / 2, y - ny * w / 2, 0], i * 6);
    along[i * 2] = i / (points.length - 1);
    along[i * 2 + 1] = i / (points.length - 1);
    side[i * 2] = 1;
    side[i * 2 + 1] = -1;
    if (i < points.length - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aS', new BufferAttribute(along, 1));
  geometry.setAttribute('aSide', new BufferAttribute(side, 1));
  geometry.setIndex(index);
  return geometry;
}

function puffGeometry(seed: number): BufferGeometry {
  let state = seed * 9301 + 49297;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const velocity = new Float32Array(PUFF_COUNT * 3);
  const seeds = new Float32Array(PUFF_COUNT);
  for (let i = 0; i < PUFF_COUNT; i += 1) {
    // Out from the glyph's foot, mostly sideways and up, as a tap on a chalky thing throws it.
    const angle = Math.PI * (0.08 + 0.84 * random()) + (random() < 0.5 ? 0 : Math.PI * 0.9);
    const speed = 50 + 120 * random() ** 1.6;
    velocity.set([Math.cos(angle) * speed, Math.abs(Math.sin(angle)) * speed * 0.55 + 10, (random() - 0.5) * 40], i * 3);
    seeds[i] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(PUFF_COUNT * 3), 3));
  geometry.setAttribute('aVelocity', new BufferAttribute(velocity, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  return geometry;
}

function crumbGeometry(seed: number): BufferGeometry {
  let state = seed * 7919 + 104729;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const path = ringPath(140);
  const ring = new Float32Array(CRUMB_COUNT * 2);
  const born = new Float32Array(CRUMB_COUNT);
  const seeds = new Float32Array(CRUMB_COUNT);
  for (let i = 0; i < CRUMB_COUNT; i += 1) {
    const share = (i + random()) / CRUMB_COUNT;
    const [x, y] = path[Math.round(share * (path.length - 1))];
    ring.set([x + (random() - 0.5) * 0.06, y + (random() - 0.5) * 0.06], i * 2);
    // A crumb falls a moment after the head has passed its place on the stroke.
    born[i] = ringReaches(share) + 0.03 + 0.12 * random();
    seeds[i] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(CRUMB_COUNT * 3), 3));
  geometry.setAttribute('aRing', new BufferAttribute(ring, 2));
  geometry.setAttribute('aBorn', new BufferAttribute(born, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  return geometry;
}

export function createTopicsExtras(self: TopicsScene, style: CSSStyleDeclaration, still: boolean): Extra[] {
  const group = new Group();
  const fallbacks: [number, number, number][] = [[0.95, 0.71, 0.36], [0.27, 0.82, 0.73], [0.65, 0.55, 0.98], [0.24, 0.74, 0.96]];
  const tones = ['--lx-w1-a', '--lx-w2-a', '--lx-w3-a', '--lx-w4-a'].map((name, i) => new Vector3(...cssColorToSrgb(style.getPropertyValue(name), fallbacks[i])));
  const shared = {
    uView: { value: new Vector2(1, 1) },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uDpr: { value: 1 },
  };
  const material = (vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>, extra: object = {}) =>
    new ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...shared, ...uniforms }, ...premultiplied, depthTest: false, depthWrite: false, ...extra });

  const ringShape = ringGeometry();
  const quad = new PlaneGeometry(1, 1);
  const glyphs: Glyph[] = TOPIC_ROOMS.map((room, i) => {
    const geometry = new ExtrudeGeometry(glyphShapes(room.symbol), {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.04,
      bevelSegments: 4,
      curveSegments: 18,
    });
    geometry.center();
    const chalk = { uTone: { value: tones[i] }, uPresence: { value: 0 }, uFlash: { value: 0 } };
    const mesh = new Mesh(geometry, material(CHALK_VERTEX, CHALK_FRAGMENT, chalk, { depthTest: true, depthWrite: true }));
    const glowUniforms = { uTone: { value: tones[i] }, uAlpha: { value: 0 } };
    const glow = new Mesh(quad, material(QUAD_VERTEX, GLOW_FRAGMENT, glowUniforms));
    const ringUniforms = { uTone: { value: tones[i] }, uDraw: { value: 0 }, uAlpha: { value: 0 } };
    const ring = new Mesh(ringShape, material(RING_VERTEX, RING_FRAGMENT, ringUniforms));
    const puffUniforms = { uTone: { value: tones[i] }, uAge: { value: -1 } };
    const puff = new Points(puffGeometry(i + 1), material(PUFF_VERTEX, PUFF_FRAGMENT, puffUniforms));
    const crumbUniforms = { uTone: { value: tones[i] }, uAge: { value: -1 }, uScale: { value: 40 } };
    const crumbs = new Points(crumbGeometry(i + 1), material(CRUMB_VERTEX, PUFF_FRAGMENT, crumbUniforms));
    for (const [object, order] of [[glow, 5], [ring, 6], [mesh, 8], [puff, 9], [crumbs, 9]] as const) {
      object.matrixAutoUpdate = false;
      object.frustumCulled = false;
      object.renderOrder = order;
      object.visible = false;
      group.add(object);
    }
    return {
      mesh, glow, ring, puff, crumbs, chalk, glowUniforms, ringUniforms, puffUniforms, crumbUniforms,
      yaw: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, enteredAt: -1,
    };
  });

  // The rooms' answers arrive on the thread bus; each wakes the stage for its moment. With nothing
  // moving on its own (reduced motion) a woken stage would not draw, so the change asks for a frame.
  let redraw = 0;
  const stop = onThread(event => {
    if (event.type !== 'topic-choice') return;
    const now = performance.now();
    if (event.right) self.rightAt[event.room] = now;
    else self.wrongAt[event.room] = now;
    redraw = 2;
    wake();
  });
  // A finger has no hover: a tap on the board puffs its dust, and the glyphs look toward it for a while.
  const look = { x: 0, y: 0, at: -1 };
  const onTap = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || still || !self.present()) return;
    const y = event.clientY + window.scrollY;
    const stage = self.stage;
    if (y < stage.top || y > stage.top + stage.height || event.clientX < stage.left || event.clientX > stage.left + stage.width) return;
    const now = performance.now();
    self.tap = { x: event.clientX, y, at: now };
    look.x = event.clientX;
    look.y = event.clientY;
    look.at = now;
    wake();
  };
  window.addEventListener('pointerdown', onTap, { passive: true });

  let started = false;

  return [{
    object: group,
    update(frame: StageFrame) {
      if (!self.present()) { group.visible = false; return false; }
      const stage = self.stageRect(frame);
      const onScreen = stage.y < frame.ch && stage.y + stage.h > 0;
      group.visible = onScreen;
      if (!onScreen) { started = true; return false; }
      shared.uView.value.set(frame.cw, frame.ch);
      shared.uDpr.value = frame.dpr;
      shared.uClip.value.set(stage.x, stage.y, stage.w, stage.h);
      shared.uClipR.value = stage.r;

      let animating = false;
      glyphs.forEach((glyph, i) => {
        const room = self.rooms[i];
        const parts = [glyph.mesh, glyph.glow, glyph.ring, glyph.puff, glyph.crumbs];
        if (!room || !room.glyph.width) { for (const part of parts) part.visible = false; return; }
        // The card rises in when a fifth of it is on screen, measured where it waits (44 px low), as the
        // DOM's observer sees it; a card already showing when the stage started is simply there.
        const card = room.card.top - frame.y + 44;
        const showing = (Math.min(frame.vh, card + room.card.height) - Math.max(0, card)) / Math.max(1, room.card.height);
        if (glyph.enteredAt < 0 && showing >= 0.2) glyph.enteredAt = started && !frame.still ? frame.now : 0;
        const entrance = glyph.enteredAt === 0 ? { presence: 1, rise: 0 } : roomEntrance(glyph.enteredAt < 0 ? -1 : (frame.now - glyph.enteredAt) / 1000);
        const size = room.type * CAP;
        const x = room.glyph.left + room.glyph.width / 2;
        const y = room.glyph.top + room.glyph.height / 2 - frame.y + entrance.rise;
        const visible = entrance.presence > 0.002 && y > -size * 3 && y < frame.ch + size * 3;
        for (const part of parts) part.visible = visible;
        if (!visible) return;
        if (entrance.presence < 1) animating = true;

        // Where the glyph looks: the mouse, or for a while the last tap on the board.
        const pointer = frame.pointer.active ? frame.pointer : look.at >= 0 && frame.now - look.at < 2600 ? look : null;
        const yawAim = pointer && !frame.still ? Math.max(-1, Math.min(1, (pointer.x - x) / 420)) * 0.55 : 0;
        const pitchAim = pointer && !frame.still ? Math.max(-1, Math.min(1, (pointer.y - y) / 420)) * 0.42 : 0;
        follow(glyph.yaw, yawAim, frame.dt);
        follow(glyph.pitch, pitchAim, frame.dt);
        if (Math.abs(glyph.yaw.v) + Math.abs(glyph.pitch.v) > 1e-3) animating = true;

        // Idle: a slow bob and turn, each glyph on its own phase.
        const idle = frame.still ? 0 : 1;
        const bob = idle * 2.4 * Math.sin(frame.time * 0.9 + i * 1.3);
        const turn = idle * 0.2 * Math.sin(frame.time * 0.42 + i * 1.9);
        const nod = idle * 0.07 * Math.sin(frame.time * 0.33 + i * 0.8);
        if (idle) animating = true;

        // A wrong choice: the shudder, and the puff from the glyph's foot.
        const wrongT = self.wrongAt[i] >= 0 && !frame.still ? (frame.now - self.wrongAt[i]) / 1000 : -1;
        const shake = wrongT >= 0 ? shudder(wrongT) : 0;
        if (wrongT >= 0 && wrongT < 1.6) animating = true;
        glyph.puffUniforms.uAge.value = wrongT >= 0 && wrongT < 1.6 ? wrongT : -1;

        // A right one: the ring draws itself round, the glyph lifts and brightens for a moment.
        const rightT = self.rightAt[i] >= 0 ? (frame.now - self.rightAt[i]) / 1000 : -1;
        const answered = rightT >= 0 || room.solved;
        const drawn = !answered ? 0 : frame.still || rightT < 0 ? 1 : ringDrawn(rightT);
        const proud = rightT >= 0 && !frame.still ? proudScale(rightT) : 1;
        const flash = rightT >= 0 && !frame.still ? Math.exp(-rightT * 2.4) * smoothstep(0, 0.1, rightT) : 0;
        if (rightT >= 0 && rightT < 1.8 && !frame.still) animating = true;

        const scale = size * proud;
        place(glyph.mesh.matrix, frame, x + shake * 14, y + bob, scale, scale, [glyph.pitch.x + nod, glyph.yaw.x + turn + shake, shake * 0.35], size * 0.25);
        glyph.mesh.matrixWorldNeedsUpdate = true;
        glyph.chalk.uPresence.value = entrance.presence;
        glyph.chalk.uFlash.value = flash;

        place(glyph.glow.matrix, frame, x, y + bob * 0.5, size * 3.4, 1, undefined, -size * 0.5);
        glyph.glow.matrixWorldNeedsUpdate = true;
        glyph.glowUniforms.uAlpha.value = entrance.presence * (0.2 + 0.35 * flash + (answered ? 0.06 : 0));

        place(glyph.ring.matrix, frame, x, y, size * RING_SCALE, 1);
        glyph.ring.matrixWorldNeedsUpdate = true;
        glyph.ring.visible = visible && drawn > 0.001;
        glyph.ringUniforms.uDraw.value = drawn * 1.02;
        glyph.ringUniforms.uAlpha.value = entrance.presence * 0.95;

        const crumbing = rightT >= 0 && rightT < 2.8 && !frame.still;
        place(glyph.crumbs.matrix, frame, x, y, 1, 1, undefined, 2);
        glyph.crumbs.matrixWorldNeedsUpdate = true;
        glyph.crumbs.visible = visible && crumbing;
        glyph.crumbUniforms.uAge.value = crumbing ? rightT : -1;
        glyph.crumbUniforms.uScale.value = size * RING_SCALE;

        place(glyph.puff.matrix, frame, x, y + size * 0.45, 1, 1, undefined, size * 0.2);
        glyph.puff.matrixWorldNeedsUpdate = true;
        glyph.puff.visible = visible && glyph.puffUniforms.uAge.value >= 0;
      });
      started = true;
      if (redraw > 0) {
        redraw -= 1;
        return true;
      }
      return animating && !frame.still;
    },
    dispose() {
      stop();
      window.removeEventListener('pointerdown', onTap);
      ringShape.dispose();
      quad.dispose();
      for (const glyph of glyphs) {
        glyph.mesh.geometry.dispose();
        glyph.puff.geometry.dispose();
        glyph.crumbs.geometry.dispose();
        for (const part of [glyph.mesh, glyph.glow, glyph.ring, glyph.puff, glyph.crumbs]) (part.material as ShaderMaterial).dispose();
      }
    },
  }];
}
