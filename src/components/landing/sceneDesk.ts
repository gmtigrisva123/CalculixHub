/**
 * Lamplight: the desk, seen at a three-quarter angle under a lamp.
 *
 * The desk itself is the chapter's own CSS 3D (DeskSection.tsx): a plane of
 * real elements, the scratch sheet and the index card, turned by the pose in
 * deskStage.ts. Everything here follows that plane by the same arithmetic,
 * from layout measured when it changes and the scroll, so nothing reads the
 * page's layout while it moves:
 *
 *   - the thread comes down onto the sheet and lies along the triangle the
 *     pencil is about to draw, as graphite on the paper (the sheet is paper
 *     inside an ink stage: `paper()` tells the stage so);
 *   - a pencil, made here in code, whose tip rides the triangle as it draws
 *     itself, lifting between strokes, and which lies down on the sheet when
 *     the triangle is done or the reader takes the pen. It is drawn through the
 *     desk's own CSS perspective rather than the stage's camera, so it stands
 *     on the very plane the browser draws, with its shadow on the paper;
 *   - a cone of warm lamplight from above the stage's corner, with motes of
 *     dust turning in it, which leans a little against the pointer.
 */

import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, CylinderGeometry, DoubleSide, Matrix4, Mesh, OneFactor,
  OneMinusSrcAlphaFactor, PlaneGeometry, Points, ShaderMaterial, Vector2, Vector3, Vector4,
} from 'three';
import { docBox, progressAt, readStageValue } from './stageLayout';
import { EMPTY_BOX, place, query, resetSlot, stageRadius } from './threadKit';
import { POLY_SAMPLES, cssColorToSrgb, lerp, resampleByLength, smoothstep, type Point } from './threadShapes';
import { SHAPE, STAGE_COMMON } from './threadShaders';
import { STAGE_ARRIVAL } from './kit';
import { onThread } from './threadBus';
import { deviceTier } from './ParticleField';
import {
  DEMO_POINTS, DESK_ARRIVAL_KEY, DESK_DEMO_KEY, DESK_FLAT_KEY, DESK_NARROW, DESK_SETTLE_EDGES, THREAD_FIGURE,
  demoPoint, deskPose, projectDesk, sheetDirection, sheetPoint, type DeskLayout, type DeskPose, type Vec3,
} from './deskStage';
import type { Extra, InkRect, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** The stage's arrival this frame: scaled about its top centre (on screen), then lowered. */
interface Arrived { scale: number; lift: number; ax: number; ay: number }

/** Where the pencil lies when it is not writing: along the foot of the sheet, below the figure (fractions of the sheet's width). */
const REST: { readonly x: number; readonly y: number } = { x: 0.05, y: 0.728 };

export class DeskScene implements ThreadScene {
  id = 'desk';
  private found = false;
  stage = EMPTY_BOX;
  objects = EMPTY_BOX;
  paper = EMPTY_BOX;
  copy = EMPTY_BOX;
  layout: DeskLayout = { origin: [0, 0], sheet: [0, 0] };
  narrow = false;
  radius = 14;
  /** The figure the thread lies along, in the paper's own px, evenly spaced by length. */
  private figure = new Float32Array(POLY_SAMPLES * 4);
  private samples = new Float32Array(POLY_SAMPLES * 4);
  private corners = [0, 0, 0, 0, 0, 0, 0, 0];

  measure() {
    const stage = query('.lx-desk-stage');
    const objects = query('.lx-desk-objects');
    const sheet = query('.lx-desk-sheet');
    const paper = query('.lx-desk-paper');
    this.found = Boolean(stage && objects && sheet && paper);
    if (!stage || !objects || !sheet || !paper) return;
    this.stage = docBox(stage);
    this.objects = docBox(objects);
    this.paper = docBox(paper);
    this.copy = docBox(query('.lx-desk-copy'));
    const sheetBox = docBox(sheet);
    this.layout = {
      origin: [this.objects.left + this.objects.width / 2, this.objects.top + this.objects.height / 2],
      sheet: [sheetBox.left + sheetBox.width / 2, sheetBox.top + sheetBox.height / 2],
    };
    // The same media query the chapter turns its desk by.
    this.narrow = window.matchMedia(`(max-width: ${DESK_NARROW}px)`).matches;
    this.radius = stageRadius();
    const width = this.paper.width;
    this.figure = resampleByLength(THREAD_FIGURE.map(([x, y]) => [x * width, y * width, 0] as Point));
  }

  present() { return this.found && this.paper.width > 0; }

  /** The desk's pose this frame: settling as the stage arrives (a pure function of the scroll, as the chapter has it). */
  pose(frame: StageFrame): DeskPose {
    const settle = frame.still ? 1 : progressAt(this.objects, DESK_SETTLE_EDGES, frame.y, frame.vh);
    return deskPose(settle, this.narrow);
  }

  /** How flat the sheet is: 0 lying on the desk, 1 facing the reader to be drawn on. */
  flat(): number {
    return readStageValue(DESK_FLAT_KEY) ?? 0;
  }

  arrived(frame: StageFrame): Arrived {
    const eased = frame.still ? 1 : readStageValue(DESK_ARRIVAL_KEY) ?? progressAt(this.stage, ['start end', 'start 0.3'], frame.y, frame.vh);
    return {
      scale: lerp(STAGE_ARRIVAL.scale, 1, eased),
      lift: lerp(STAGE_ARRIVAL.y, 0, eased),
      ax: this.stage.left + this.stage.width / 2,
      ay: this.stage.top - frame.y,
    };
  }

  /** A point of the page, as the desk's CSS draws it, on screen this frame. */
  toScreen(frame: StageFrame, arrived: Arrived, [x, y]: [number, number]): [number, number] {
    return [arrived.ax + (x - arrived.ax) * arrived.scale, arrived.ay + (y - frame.y - arrived.ay) * arrived.scale + arrived.lift];
  }

  /** A point of the paper (px from its top left corner) on screen this frame. */
  paperOnScreen(frame: StageFrame, pose: DeskPose, flat: number, arrived: Arrived, u: number, v: number): [number, number] {
    return this.toScreen(frame, arrived, projectDesk(this.layout, pose, sheetPoint(this.layout, pose, flat, this.paper.left + u, this.paper.top + v)));
  }

  stageOnScreen(arrived: Arrived): InkRect {
    return {
      x: arrived.ax + (this.stage.left - arrived.ax) * arrived.scale,
      y: arrived.ay + arrived.lift,
      w: this.stage.width * arrived.scale,
      h: this.stage.height * arrived.scale,
      r: this.radius,
    };
  }

  onScreen(frame: StageFrame, stage: InkRect): boolean {
    return stage.y < frame.ch && stage.y + stage.h > 0;
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.present()) return;
    const stage = this.stageOnScreen(this.arrived(frame));
    if (this.onScreen(frame, stage)) out.push(stage);
  }

  /** The sheet's four corners on screen: paper lying inside the ink stage, where the thread is graphite. */
  paperQuad(frame: StageFrame): readonly number[] | null {
    if (!this.present()) return null;
    const arrived = this.arrived(frame);
    if (!this.onScreen(frame, this.stageOnScreen(arrived))) return null;
    const pose = this.pose(frame);
    const flat = this.flat();
    const { width, height } = this.paper;
    [[0, 0], [width, 0], [width, height], [0, height]].forEach(([u, v], i) => {
      const [x, y] = this.paperOnScreen(frame, pose, flat, arrived, u, v);
      this.corners[i * 2] = x;
      this.corners[i * 2 + 1] = y;
    });
    return this.corners;
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.present()) return;
    const pose = this.pose(frame);
    const flat = this.flat();
    const arrived = this.arrived(frame);
    for (let i = 0; i < POLY_SAMPLES; i += 1) {
      const [x, y] = this.paperOnScreen(frame, pose, flat, arrived, this.figure[i * 4], this.figure[i * 4 + 1]);
      this.samples[i * 4] = x - frame.cw / 2;
      this.samples[i * 4 + 1] = frame.ch / 2 - y;
      this.samples[i * 4 + 2] = 0;
      this.samples[i * 4 + 3] = this.figure[i * 4 + 3];
    }
    out.shape = SHAPE.poly;
    // The thread's own coordinates are world coordinates: its origin is the centre of the screen.
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    out.p[0].set(row, 0.14, 0, 1);
    out.data = this.samples;
    // Graphite dots along the figure, a guide the pencil goes over; they fade back as it is drawn.
    const demo = readStageValue(DESK_DEMO_KEY) ?? (frame.still ? 1 : 0);
    out.look.set(1.9, lerp(1, 0.42, smoothstep(0, 1, demo)), 0.13, 0);
    const stage = this.stageOnScreen(arrived);
    out.clip.set(stage.x, stage.y, stage.w, stage.h);
    out.shade.set(stage.r, 8, 0, 0);
    out.flowing = false;
  }
}

/** The thread comes down onto the sheet as it rises into view, and has settled on the figure before the pencil starts. */
export function deskLeg(self: DeskScene): Leg | null {
  return {
    to: 'desk',
    window: frame => {
      if (!self.present()) return null;
      const end = self.paper.top + self.paper.height - frame.vh * 0.97;
      return [end - frame.vh * 0.62, end];
    },
    stagger: 0.9,
    orderByU: 0.75,
    swirl: 34,
    lift: 70,
  };
}

// ---------------------------------------------------------------------------
// Drawing through the desk's own perspective
// ---------------------------------------------------------------------------

/**
 * Shared by the pencil and its shadow: positions are in the desk's 3D space
 * (px from its perspective origin, y down, z toward the reader), projected the
 * way the CSS perspective projects the plane, then moved with the stage as it
 * arrives, straight into clip space.
 */
const DESK_VERTEX_HEAD = /* glsl */ `
uniform mat4 uModel;
uniform float uPersp;
uniform vec2 uOrigin;
uniform vec4 uArrive;
uniform vec2 uView;
vec4 deskToClip(vec3 p) {
  float k = uPersp / max(1.0, uPersp - p.z);
  vec2 page = uOrigin + p.xy * k;
  vec2 screen = uArrive.xy + (page - uArrive.xy) * uArrive.z + vec2(0.0, uArrive.w);
  return vec4(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0, clamp(-p.z / 4000.0, -1.0, 1.0), 1.0);
}`;

const PENCIL_VERTEX = /* glsl */ `
${DESK_VERTEX_HEAD}
attribute float aPart;
varying vec3 vNormal;
varying float vPart;
varying float vAlong;
void main() {
  vec4 p = uModel * vec4(position, 1.0);
  vNormal = normalize(mat3(uModel) * normal);
  vPart = aPart;
  vAlong = position.y;
  gl_Position = deskToClip(p.xyz);
}`;

const PENCIL_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform float uDpr;
uniform float uFade;
uniform vec3 uLamp;
uniform vec3 uLampColor;
uniform vec3 uFill;
uniform vec3 uBody;
uniform vec3 uWood;
uniform vec3 uLead;
uniform vec3 uBrass;
uniform vec3 uRubber;
varying vec3 vNormal;
varying float vPart;
varying float vAlong;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float m = clipAt(p, uClip, uClipR) * uFade;
  if (m < 0.002) discard;
  vec3 n = normalize(vNormal);
  vec3 base;
  float shine;
  float tight;
  if (vPart < 0.5) { base = uLead; shine = 0.55; tight = 24.0; }
  else if (vPart < 1.5) { base = uWood * (0.93 + 0.07 * sin(vAlong * 2.3)); shine = 0.04; tight = 6.0; }
  else if (vPart < 2.5) { base = uBody; shine = 0.6; tight = 70.0; }
  else if (vPart < 3.5) { base = uBrass * (0.78 + 0.32 * (0.5 + 0.5 * sin(vAlong * 2.1))); shine = 0.95; tight = 36.0; }
  else { base = uRubber; shine = 0.06; tight = 5.0; }
  // Lamplight from above the stage's corner, a cool fill from the room.
  vec3 L = normalize(uLamp);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float facing = dot(n, L);
  float diffuse = max(facing, 0.0);
  float wrap = max(facing * 0.5 + 0.5, 0.0);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), tight) * shine;
  vec3 c = base * (uFill + uLampColor * (0.22 * wrap + 0.9 * diffuse)) + uLampColor * spec;
  c += vec3(0.5, 0.75, 0.85) * pow(1.0 - abs(dot(n, V)), 3.0) * 0.12;
  gl_FragColor = vec4(c * m, m);
}`;

const SHADOW_VERTEX = /* glsl */ `
${DESK_VERTEX_HEAD}
attribute vec2 aShadow;
varying vec2 vShadow;
void main() {
  vShadow = aShadow;
  gl_Position = deskToClip(position);
}`;

const SHADOW_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform float uDpr;
uniform float uStrength;
varying vec2 vShadow;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  // Sharp and dark where the pencil touches, soft and faint toward its end.
  float across = abs(vShadow.y);
  float s = vShadow.x;
  float a = (1.0 - smoothstep(mix(0.15, 0.0, s), 1.0, across)) * smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.9, 1.0, s)) * mix(1.0, 0.35, s);
  a *= uStrength * clipAt(p, uClip, uClipR);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

const LAMP_VERTEX = /* glsl */ `
uniform vec4 uRect;
uniform vec2 uView;
void main() {
  vec2 screen = uRect.xy + (position.xy * vec2(0.5, -0.5) + 0.5) * uRect.zw;
  gl_Position = vec4(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0, 0.0, 1.0);
}`;

const LAMP_COMMON = /* glsl */ `
uniform vec2 uApex;
uniform vec2 uTarget;
uniform float uTan;
uniform float uTime;
float beamAt(vec2 p, out float along) {
  vec2 axis = uTarget - uApex;
  float len = max(length(axis), 1.0);
  vec2 dir = axis / len;
  vec2 d = p - uApex;
  float t = dot(d, dir);
  along = t / len;
  if (t <= 0.0) return 0.0;
  float q = length(d - dir * t) / max(t * uTan, 1.0);
  float core = 1.0 - smoothstep(0.3, 1.0, q);
  return core * core * smoothstep(0.02, 0.42, along) * (1.0 - smoothstep(1.05, 1.55, along));
}`;

const LAMP_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
${LAMP_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform vec4 uOcc[4];
uniform vec4 uOccR;
uniform float uDpr;
uniform float uStrength;
uniform vec3 uWarm;
uniform vec2 uPool;
uniform float uPoolStrength;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float along;
  float beam = beamAt(p, along);
  // Faint rays round the lamp, drifting very slowly.
  vec2 d = p - uApex;
  float angle = atan(d.y, d.x);
  float rays = 0.8 + 0.2 * sin(angle * 41.0 + uTime * 0.11) * sin(angle * 23.0 - uTime * 0.07);
  vec2 e = (p - uTarget) / uPool;
  float pool = exp(-dot(e, e) * 2.4);
  float a = (uStrength * beam * rays + uPoolStrength * pool) * clipAt(p, uClip, uClipR) * occlusionAt(p, uOcc, uOccR, 48.0);
  gl_FragColor = vec4(uWarm * a, 0.0);
}`;

const MOTE_VERTEX = /* glsl */ `
${LAMP_COMMON}
attribute vec4 aSeed;
uniform vec2 uView;
uniform float uDpr;
varying float vLight;
void main() {
  vec2 axis = uTarget - uApex;
  float len = max(length(axis), 1.0);
  vec2 dir = axis / len;
  vec2 side = vec2(-dir.y, dir.x);
  float t = mix(0.3, 1.12, aSeed.x) * len;
  vec2 p = uApex + dir * t + side * (aSeed.y * 2.0 - 1.0) * t * uTan * 0.9;
  // Each mote turns slowly on its own small orbit and sinks a little, the way dust hangs in lamplight.
  float phase = aSeed.z * 6.2831853;
  p += vec2(sin(uTime * (0.11 + aSeed.w * 0.08) + phase) * 26.0, cos(uTime * (0.08 + aSeed.x * 0.06) + phase * 1.7) * 18.0 + sin(uTime * 0.05 + phase) * 10.0);
  float along;
  float lit = beamAt(p, along);
  float twinkle = 0.5 + 0.5 * sin(uTime * (0.5 + aSeed.w * 0.9) + phase * 3.0);
  vLight = lit * (0.35 + 0.65 * twinkle);
  gl_PointSize = mix(1.5, 3.4, aSeed.w * aSeed.w) * uDpr;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;

const MOTE_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform float uDpr;
uniform vec3 uWarm;
uniform float uStrength;
varying float vLight;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 3.5) * vLight * uStrength * clipAt(p, uClip, uClipR);
  gl_FragColor = vec4(uWarm * a, 0.0);
}`;

const blend = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

// ---------------------------------------------------------------------------
// The pencil, made in code
// ---------------------------------------------------------------------------

/** Parts of the pencil, by the colour they are lit with. */
const PART = { lead: 0, wood: 1, body: 2, ferrule: 3, eraser: 4 } as const;

/**
 * A pencil along +y from its point at the origin: graphite, the sharpened cone
 * of cedar, a six-sided lacquered body (flat faces), a ridged brass ferrule and
 * an eraser. `length` and `radius` in px.
 */
export function pencilGeometry(length: number, radius: number): BufferGeometry {
  const pieces: { geometry: BufferGeometry; part: (normalY: number) => number; flat: boolean }[] = [];
  const piece = (top: number, bottom: number, from: number, to: number, sides: number, part: (normalY: number) => number, flat: boolean, open = true) => {
    const height = (to - from) * length;
    const geometry = new CylinderGeometry(top, bottom, height, sides, 1, open);
    geometry.translate(0, from * length + height / 2, 0);
    pieces.push({ geometry, part, flat });
  };
  piece(radius * 0.24, 0, 0, 0.028, 14, () => PART.lead, false);
  piece(radius * 0.92, radius * 0.24, 0.028, 0.105, 18, () => PART.wood, false);
  // The body is closed: its bare end, round the cone, is the wood the sharpener left.
  piece(radius, radius, 0.105, 0.86, 6, normalY => (Math.abs(normalY) > 0.9 ? PART.wood : PART.body), true, false);
  piece(radius * 1.05, radius * 1.05, 0.86, 0.945, 20, () => PART.ferrule, false);
  piece(radius * 0.86, radius * 0.97, 0.945, 1, 20, () => PART.eraser, false, false);

  const positions: number[] = [];
  const normals: number[] = [];
  const parts: number[] = [];
  for (const { geometry, part, flat } of pieces) {
    const plain = geometry.toNonIndexed();
    if (flat) plain.computeVertexNormals();
    const position = plain.getAttribute('position');
    const normal = plain.getAttribute('normal');
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      parts.push(part(normal.getY(i)));
    }
    geometry.dispose();
    plain.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  out.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  out.setAttribute('aPart', new BufferAttribute(new Float32Array(parts), 1));
  return out;
}

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** One step of a damped spring (stiffness k, damping c, unit mass), sub-stepped. */
function spring(state: { x: number; v: number }, target: number, dt: number, k: number, c: number) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    state.v += (-k * (state.x - target) - c * state.v) * h;
    state.x += state.v * h;
  }
}

/** The lamp, as a direction in the desk's space (toward it, y down): above the stage's right-hand corner, in front. */
const LAMP: Vec3 = unit([0.5, -0.72, 0.52]);
/**
 * In the sheet's own frame: writing, the pencil leans up and to the right of its point, toward the lamp, so it
 * is seen side on; lying, it runs along the foot of the sheet.
 */
const WRITING_LEAN = 48;
const LEANING_TO = unit([0.82, -0.42, 0]);
const LYING: Vec3 = unit([0.999, 0.012, 0]);

export function createDeskExtras(self: DeskScene, style: CSSStyleDeclaration, still: boolean): Extra[] {
  const srgb = (name: string, fallback: [number, number, number]) => new Vector3(...cssColorToSrgb(style.getPropertyValue(name), fallback));
  const brass = srgb('--lx-brass', [0.93, 0.76, 0.42]);
  const warm = new Vector3(1, 0.87, 0.66).lerp(brass, 0.35);

  // --- The pencil and its shadow ---------------------------------------------------------
  const deskUniforms = () => ({
    uModel: { value: new Matrix4() },
    uPersp: { value: 1600 },
    uOrigin: { value: new Vector2() },
    uArrive: { value: new Vector4(0, 0, 1, 0) },
    uView: { value: new Vector2(1, 1) },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uDpr: { value: 1 },
  });
  const pencilUniforms = {
    ...deskUniforms(),
    uFade: { value: 1 },
    uLamp: { value: new Vector3(...LAMP) },
    uLampColor: { value: warm.clone().multiplyScalar(1.05) },
    uFill: { value: new Vector3(0.16, 0.2, 0.26) },
    // Deep teal lacquer, cedar, graphite, brass, a worn pink eraser.
    uBody: { value: new Vector3(0.11, 0.3, 0.34) },
    uWood: { value: new Vector3(0.86, 0.68, 0.47) },
    uLead: { value: new Vector3(0.2, 0.21, 0.23) },
    uBrass: { value: brass.clone() },
    uRubber: { value: new Vector3(0.86, 0.52, 0.47) },
  };
  let built = { length: 0, radius: 0 };
  const pencil = new Mesh(new BufferGeometry(), new ShaderMaterial({
    uniforms: pencilUniforms,
    vertexShader: PENCIL_VERTEX,
    fragmentShader: PENCIL_FRAGMENT,
    ...blend,
    // A solid: it hides its own far side.
    depthTest: true,
    depthWrite: true,
    side: DoubleSide,
  }));
  pencil.frustumCulled = false;
  pencil.renderOrder = 14;
  pencil.visible = false;

  const shadowUniforms = { ...deskUniforms(), uStrength: { value: 0.3 } };
  const shadowGeometry = new BufferGeometry();
  const shadowPosition = new BufferAttribute(new Float32Array(12), 3);
  shadowGeometry.setAttribute('position', shadowPosition);
  shadowGeometry.setAttribute('aShadow', new BufferAttribute(new Float32Array([0, -1, 0, 1, 1, 1, 1, -1]), 2));
  shadowGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const shadow = new Mesh(shadowGeometry, new ShaderMaterial({ uniforms: shadowUniforms, vertexShader: SHADOW_VERTEX, fragmentShader: SHADOW_FRAGMENT, ...blend, side: DoubleSide }));
  shadow.frustumCulled = false;
  shadow.renderOrder = 11;
  shadow.visible = false;

  // The reader holding the pen sends the pencil to lie down.
  let readerDrawing = false;
  const stopListening = onThread(event => { if (event.type === 'desk-draw') readerDrawing = event.active; });

  const writing = { x: 0, v: 0 };
  const tipX = { x: REST.x, v: 0 };
  const tipY = { x: REST.y, v: 0 };
  let settledAt = -1;

  const setDeskUniforms = (uniforms: ReturnType<typeof deskUniforms>, frame: StageFrame, pose: DeskPose, arrived: Arrived, stage: InkRect) => {
    uniforms.uPersp.value = pose.perspective;
    uniforms.uOrigin.value.set(self.layout.origin[0], self.layout.origin[1] - frame.y);
    uniforms.uArrive.value.set(arrived.ax, arrived.ay, arrived.scale, arrived.lift);
    uniforms.uView.value.set(frame.cw, frame.ch);
    uniforms.uClip.value.set(stage.x, stage.y, stage.w, stage.h);
    uniforms.uClipR.value = stage.r;
    uniforms.uDpr.value = frame.dpr;
  };

  const pencilExtra: Extra = {
    object: pencil,
    update(frame) {
      const hide = () => { pencil.visible = false; shadow.visible = false; return false; };
      if (!self.present()) return hide();
      const arrived = self.arrived(frame);
      const stage = self.stageOnScreen(arrived);
      if (!self.onScreen(frame, stage)) return hide();
      const pose = self.pose(frame);
      const flat = self.flat();
      const width = self.paper.width;
      const length = Math.min(300, Math.max(140, width * 0.6));
      const radius = length / 34;
      if (Math.abs(built.length - length) > 0.5) {
        pencil.geometry.dispose();
        pencil.geometry = pencilGeometry(length, radius);
        built = { length, radius };
      }

      // Writing while the triangle draws itself; lying on the sheet before, after, and while the reader draws.
      const demo = readStageValue(DESK_DEMO_KEY) ?? (frame.still ? 1 : 0);
      const active = !readerDrawing && flat < 0.05 && demo > 0 && demo < 1;
      const point = demoPoint(demo * DEMO_POINTS);
      const target = active ? point : REST;
      const dt = frame.still ? 1 : Math.min(frame.dt, 1 / 30);
      if (frame.still) {
        writing.x = active ? 1 : 0;
        tipX.x = target.x;
        tipY.x = target.y;
      } else {
        spring(writing, active ? 1 : 0, dt, 130, 23);
        spring(tipX, target.x, dt, 520, 44);
        spring(tipY, target.y, dt, 520, 44);
      }
      const w = Math.min(1, Math.max(0, writing.x));
      // A pencil lifts off the paper as it travels: between strokes, and on the way to and from the sheet.
      const away = Math.hypot(tipX.x - target.x, tipY.x - target.y) * width;
      const lift = Math.min(1, away / 36) * 22 + Math.sin(Math.PI * w) * 28;

      const normal = sheetDirection(pose, flat, [0, 0, 1]);
      const lean = WRITING_LEAN * (Math.PI / 180);
      const upright: Vec3 = unit([LEANING_TO[0] * Math.cos(lean), LEANING_TO[1] * Math.cos(lean), Math.sin(lean)]);
      const axis = unit(sheetDirection(pose, flat, unit(mix3(LYING, upright, w))));
      const contact = sheetPoint(self.layout, pose, flat, self.paper.left + tipX.x * width, self.paper.top + tipY.x * width);
      // Lying, its axis is a hexagon's half-width above the paper; writing, its point is on it.
      const tip = add(contact, normal, radius * 0.87 * (1 - w) + lift);
      // Its own frame: y along the pencil, then turned a little about it as the hand moves.
      let side = cross(axis, normal);
      if (Math.hypot(...side) < 1e-4) side = [1, 0, 0];
      side = unit(side);
      const up = cross(side, axis);
      const roll = 0.35 + w * 0.5 + (frame.still ? 0 : Math.sin(frame.time * 1.3) * 0.04 * w);
      const x = add(side.map(v => v * Math.cos(roll)) as Vec3, up, Math.sin(roll));
      const z = add(up.map(v => v * Math.cos(roll)) as Vec3, side, -Math.sin(roll));
      pencilUniforms.uModel.value.set(
        x[0], axis[0], z[0], tip[0],
        x[1], axis[1], z[1], tip[1],
        x[2], axis[2], z[2], tip[2],
        0, 0, 0, 1,
      );
      setDeskUniforms(pencilUniforms, frame, pose, arrived, stage);
      // It comes in with the stage and steps aside while the sheet is held flat.
      pencilUniforms.uFade.value = smoothstep(0.2, 0.7, (arrived.scale - STAGE_ARRIVAL.scale) / (1 - STAGE_ARRIVAL.scale)) * (1 - smoothstep(0.1, 0.6, flat));
      pencil.visible = pencilUniforms.uFade.value > 0.002;

      // Its shadow on the paper, cast away from the lamp: from where its point would touch to where its end falls.
      const end = add(tip, axis, length);
      const toPaper = (p: Vec3): Vec3 => {
        const height = dot([p[0] - contact[0], p[1] - contact[1], p[2] - contact[2]], normal);
        return add(p, LAMP, -height / Math.max(0.2, dot(LAMP, normal)));
      };
      const from = toPaper(tip);
      // Past a pencil's length the shadow is too faint to see: keep it to that.
      let to = toPaper(end);
      const reach = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      if (reach > length) to = add(from, unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]), length);
      const along = unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
      const across = unit(cross(along, normal));
      const near = radius * 0.8 + lift * 0.25;
      const far = radius * 2.2;
      const corners = [
        add(add(from, along, -near), across, -near), add(add(from, along, -near), across, near),
        add(add(to, along, far), across, far), add(add(to, along, far), across, -far),
      ];
      corners.forEach((corner, i) => shadowPosition.setXYZ(i, corner[0], corner[1], corner[2]));
      shadowPosition.needsUpdate = true;
      setDeskUniforms(shadowUniforms, frame, pose, arrived, stage);
      shadowUniforms.uStrength.value = 0.34 * pencilUniforms.uFade.value * (1 - smoothstep(0, 60, lift) * 0.5);
      shadow.visible = pencil.visible;

      // Keep drawing while the pencil is still moving.
      const moving = Math.abs(writing.v) > 1e-3 || Math.abs(tipX.v) > 1e-4 || Math.abs(tipY.v) > 1e-4 || active;
      if (moving) settledAt = -1;
      else if (settledAt < 0) settledAt = frame.now;
      return !frame.still && (moving || frame.now - settledAt < 80);
    },
    dispose() {
      stopListening();
      pencil.geometry.dispose();
      (pencil.material as ShaderMaterial).dispose();
    },
  };

  const shadowExtra: Extra = {
    object: shadow,
    update: () => false,
    dispose() {
      shadowGeometry.dispose();
      (shadow.material as ShaderMaterial).dispose();
    },
  };

  // --- The lamp -------------------------------------------------------------------------
  const beamUniforms = {
    uView: { value: new Vector2(1, 1) },
    uRect: { value: new Vector4() },
    uApex: { value: new Vector2() },
    uTarget: { value: new Vector2() },
    uTan: { value: 0.3 },
    uTime: { value: 0 },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uOcc: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uOccR: { value: new Vector4() },
    uDpr: { value: 1 },
    uStrength: { value: 0.16 },
    uWarm: { value: warm.clone() },
    uPool: { value: new Vector2(300, 200) },
    uPoolStrength: { value: 0.07 },
  };
  const beam = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ uniforms: beamUniforms, vertexShader: LAMP_VERTEX, fragmentShader: LAMP_FRAGMENT, ...blend }));
  beam.frustumCulled = false;
  beam.renderOrder = 9;
  beam.visible = false;

  const moteCount = deviceTier(window.innerWidth) === 'high' ? 150 : 70;
  const seeds = new Float32Array(moteCount * 4);
  let seed = 0x2f6e2b1;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = random();
  const moteGeometry = new BufferGeometry();
  moteGeometry.setAttribute('position', new BufferAttribute(new Float32Array(moteCount * 3), 3));
  moteGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  const moteUniforms = {
    uView: beamUniforms.uView,
    uApex: beamUniforms.uApex,
    uTarget: beamUniforms.uTarget,
    uTan: beamUniforms.uTan,
    uTime: beamUniforms.uTime,
    uClip: beamUniforms.uClip,
    uClipR: beamUniforms.uClipR,
    uDpr: beamUniforms.uDpr,
    uWarm: beamUniforms.uWarm,
    uStrength: { value: 0.75 },
  };
  const motes = new Points(moteGeometry, new ShaderMaterial({ uniforms: moteUniforms, vertexShader: MOTE_VERTEX, fragmentShader: MOTE_FRAGMENT, ...blend }));
  motes.frustumCulled = false;
  motes.renderOrder = 9;
  motes.visible = false;

  // The lamp hangs nearer the reader than the desk: against the pointer it swings a little the other way.
  const swayX = { x: 0, v: 0 };
  const swayY = { x: 0, v: 0 };

  const lampExtra: Extra = {
    object: beam,
    update(frame) {
      const hide = () => { beam.visible = false; motes.visible = false; return false; };
      if (!self.present()) return hide();
      const arrived = self.arrived(frame);
      const stage = self.stageOnScreen(arrived);
      if (!self.onScreen(frame, stage)) return hide();
      const pointer = frame.pointer;
      const inside = pointer.active && pointer.y > stage.y && pointer.y < stage.y + stage.h;
      const wantX = inside ? Math.max(-0.6, Math.min(0.6, (pointer.x - (stage.x + stage.w / 2)) / stage.w)) : 0;
      const wantY = inside ? Math.max(-0.6, Math.min(0.6, (pointer.y - (stage.y + stage.h / 2)) / stage.h)) : 0;
      if (frame.still) { swayX.x = 0; swayY.x = 0; } else {
        spring(swayX, wantX, Math.min(frame.dt, 1 / 30), 40, 12);
        spring(swayY, wantY, Math.min(frame.dt, 1 / 30), 40, 12);
      }
      // Over the objects: the middle of the desk as drawn this frame.
      const [cx, cy] = self.toScreen(frame, arrived, [self.objects.left + self.objects.width * 0.5, self.objects.top + self.objects.height * 0.5]);
      const apex = new Vector2(stage.x + stage.w * (self.narrow ? 0.82 : 0.9) - swayX.x * 40, stage.y - stage.h * 0.16 - swayY.x * 24);
      const target = new Vector2(cx + swayX.x * 16, cy + swayY.x * 10);
      beamUniforms.uApex.value.copy(apex);
      beamUniforms.uTarget.value.copy(target);
      beamUniforms.uTan.value = (self.objects.width * arrived.scale * (self.narrow ? 0.55 : 0.4)) / Math.max(1, apex.distanceTo(target));
      beamUniforms.uPool.value.set(self.objects.width * arrived.scale * 0.62, self.objects.height * arrived.scale * 0.5);
      beamUniforms.uRect.value.set(stage.x, stage.y, stage.w, stage.h);
      beamUniforms.uView.value.set(frame.cw, frame.ch);
      beamUniforms.uClip.value.set(stage.x, stage.y, stage.w, stage.h);
      beamUniforms.uClipR.value = stage.r;
      beamUniforms.uDpr.value = frame.dpr;
      beamUniforms.uTime.value = frame.time;
      // Keep the haze off the words.
      const copy = self.copy;
      if (copy.width && !self.narrow) {
        const [x, y] = self.toScreen(frame, arrived, [copy.left, copy.top]);
        beamUniforms.uOcc.value[0].set(x - 24, y - 24, copy.width * arrived.scale + 48, copy.height * arrived.scale + 48);
        beamUniforms.uOccR.value.set(24, 0, 0, 0);
      } else {
        beamUniforms.uOcc.value[0].set(0, 0, 0, 0);
        beamUniforms.uOccR.value.set(0, 0, 0, 0);
      }
      const shown = smoothstep(0, 0.6, (arrived.scale - STAGE_ARRIVAL.scale) / (1 - STAGE_ARRIVAL.scale));
      beamUniforms.uStrength.value = 0.15 * shown;
      beamUniforms.uPoolStrength.value = 0.06 * shown;
      moteUniforms.uStrength.value = 0.8 * shown;
      beam.visible = shown > 0.002;
      motes.visible = beam.visible;
      const swaying = Math.abs(swayX.v) + Math.abs(swayY.v) > 1e-3;
      // The motes keep turning while the desk is on screen.
      return !still && !frame.still && beam.visible ? true : swaying;
    },
    dispose() {
      beam.geometry.dispose();
      (beam.material as ShaderMaterial).dispose();
    },
  };

  const motesExtra: Extra = {
    object: motes,
    update: () => false,
    dispose() {
      moteGeometry.dispose();
      (motes.material as ShaderMaterial).dispose();
    },
  };

  return [lampExtra, motesExtra, shadowExtra, pencilExtra];
}
