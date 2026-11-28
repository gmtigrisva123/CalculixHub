/**
 * "Watch it find your level", in three dimensions.
 *
 * The thread itself is the belief curve's crest (threadScenes.ts). Around it
 * this module builds the rest of the instrument, all of it procedural:
 *
 *   curtain   the area under the curve, a curtain of light that is brightest
 *             at the crest and fades to nothing at the axis
 *   ribbon    the crest given depth: a luminous band along the curve, seen
 *             from a little above as the camera rises
 *   slabs     the four tier bands as frosted-glass slabs standing behind the
 *             curve; the slab of the tier the engine would give now lights up
 *   beads     one per answer, in its topic's colour, with a tick or a cross;
 *             it drops from above and bounces onto the axis when the replay
 *             reaches it, stacks with answers of similar difficulty, and
 *             lifts away again if the reader scrolls back
 *   marker    YOU: a line from the axis up to the curve at the estimate, a
 *             point of light on top, and the margin of error on the axis
 *
 * Every shape is the engine's own output (engineReplay.ts), so scrolling
 * scrubs the real placement. The labels (tier names, easier and harder, YOU)
 * stay DOM text; each frame they are moved to where their 3D anchor lands on
 * screen, written from this one loop.
 */

import {
  AddEquation, BoxGeometry, BufferAttribute, BufferGeometry, CustomBlending, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector2, Vector3, Vector4,
} from 'three';
import { TIER_BANDS } from './engineRun';
import { ANSWERS, CHART, DOMAIN_INDEX, RUG_LEVEL, RUN, chartX, heightAtEstimate } from './engineReplay';
import { POLY_SAMPLES, cssColorToSrgb, smoothstep } from './threadShapes';
import { STAGE_COMMON } from './threadShaders';
import { layoutVersion } from './stageLayout';
import type { EngineScene } from './threadScenes';
import type { Extra, StageFrame, TimelineState } from './threadTypes';

/** How deep the ribbon is, in chart units, and where the slabs and beads stand. */
const DEPTH = 64;
const SLAB_Z = -DEPTH * 0.5 - 26;
const SLAB_THICK = 12;
const SLAB_TOP = CHART.CURVE_H + 26;
const BEAD_R = 8.5;
const BEAD_Z = DEPTH * 0.5 + 16;
const COLUMNS = 160;
const HALF = (CHART.W - 2 * CHART.PAD) / 2;

const premultiplied = {
  transparent: true,
  depthWrite: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

/** What every engine mesh shares: clipped to the stage, hidden behind the DOM panels in front of it. */
const MASK = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform vec4 uOcc[4];
uniform vec4 uOccR;
uniform float uDpr;
uniform float uFade;
float stageMask() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  return clipAt(p, uClip, uClipR) * occlusionAt(p, uOcc, uOccR, 10.0) * uFade;
}
`;

const CURTAIN_VERTEX = /* glsl */ `
attribute float aU;
attribute float aV;
varying float vU;
varying float vV;
void main() {
  vU = aU;
  vV = aV;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const CURTAIN_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uColor;
varying float vU;
varying float vV;
void main() {
  float m = stageMask();
  // Brightest at the crest, nothing at the axis; faint vertical rules like light through a slatted blind.
  float a = (0.03 + 0.4 * pow(vV, 1.7)) * (0.86 + 0.14 * cos(vU * 6.2831853 * 96.0)) * m;
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

const BAND_VERTEX = /* glsl */ `
attribute float aW;
attribute float aH;
varying float vW;
varying float vH;
void main() {
  vW = aW;
  vH = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BAND_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uColor;
varying float vW;
varying float vH;
void main() {
  float m = stageMask();
  float centre = 1.0 - abs(vW);
  float a = (0.06 + 0.5 * pow(centre, 3.0)) * (0.25 + 0.75 * smoothstep(0.0, 0.6, vH)) * m;
  vec3 c = mix(uColor, vec3(1.0), pow(centre, 8.0) * 0.6);
  gl_FragColor = vec4(c * a, 0.0);
}`;

const SLAB_VERTEX = /* glsl */ `
attribute float aBand;
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
varying float vBand;
void main() {
  vBand = aBand;
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SLAB_FRAGMENT = /* glsl */ `
${MASK}
uniform vec4 uActive;
uniform vec3 uCyan;
uniform vec3 uBrass;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
varying float vBand;
void main() {
  float m = stageMask();
  float act = vBand < 0.5 ? uActive.x : vBand < 1.5 ? uActive.y : vBand < 2.5 ? uActive.z : uActive.w;
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vView);
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 2.2);
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.03, min(e.x, e.y));
  // Frosting: a fine, still grain, a little brighter toward the top of the slab.
  float grain = fract(sin(dot(floor(vUv * vec2(90.0, 160.0)), vec2(12.9898, 78.233))) * 43758.5453);
  float frost = (0.028 + 0.06 * act) * (0.75 + 0.5 * grain) * (0.55 + 0.45 * vUv.y);
  float light = frost + fresnel * (0.05 + 0.1 * act) + edge * (0.05 + 0.32 * act);
  vec3 tint = mix(vec3(0.78, 0.9, 0.96), mix(uCyan, uBrass, 0.25), act);
  // A milky fill (alpha) and its edges of light (added).
  float milk = (0.035 + 0.05 * act) * m;
  gl_FragColor = vec4(tint * light * m + tint * milk * 0.6, milk);
}`;

const BEAD_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute vec2 aMark;
varying vec3 vNormalV;
varying vec3 vColor;
varying vec2 vMark;
void main() {
  vColor = aColor;
  vMark = aMark;
  mat4 model = modelMatrix * instanceMatrix;
  vNormalV = normalize(mat3(viewMatrix * model) * normal);
  gl_Position = projectionMatrix * viewMatrix * model * vec4(position, 1.0);
}`;

const BEAD_FRAGMENT = /* glsl */ `
${MASK}
varying vec3 vNormalV;
varying vec3 vColor;
varying vec2 vMark;
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a; vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  float m = stageMask() * vMark.y;
  if (m < 0.003) discard;
  vec3 n = normalize(vNormalV);
  vec3 l = normalize(vec3(-0.45, 0.75, 0.55));
  float diffuse = max(dot(n, l), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.4);
  float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
  vec3 c = vColor * (0.32 + 0.78 * diffuse) + vColor * rim * 0.7 + spec * 0.55;
  // The mark, printed on the face toward the viewer: a tick for right, a cross for missed.
  vec2 q = n.xy / 0.6;
  float d = vMark.x > 0.0
    ? min(segment(q, vec2(-0.46, 0.02), vec2(-0.12, -0.34)), segment(q, vec2(-0.12, -0.34), vec2(0.5, 0.36)))
    : min(segment(q, vec2(-0.36, -0.36), vec2(0.36, 0.36)), segment(q, vec2(-0.36, 0.36), vec2(0.36, -0.36)));
  float mark = (1.0 - smoothstep(0.1, 0.17, d)) * smoothstep(0.2, 0.5, n.z);
  c = mix(c, vec3(0.05, 0.08, 0.11), mark * 0.88);
  gl_FragColor = vec4(c * m, m);
}`;

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** A soft line, capsule or point of light on a flat quad, by signed distance. */
const GLOW_FRAGMENT = /* glsl */ `
${MASK}
uniform vec3 uColor;
uniform vec2 uSize;
uniform float uSoft;
uniform float uCore;
varying vec2 vUv;
void main() {
  float m = stageMask();
  vec2 p = (vUv - 0.5) * uSize;
  float r = min(uSize.x, uSize.y) * 0.5;
  vec2 q = abs(p) - (uSize * 0.5 - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r * uCore;
  float a = exp(-max(d, 0.0) / uSoft) * (d < 0.0 ? 1.0 : 0.65) * m;
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

interface Bead {
  index: number;
  x: number;
  rest: number;
  born: number;
  gone: number;
  shown: boolean;
}

/** A ball dropped from `height` onto the floor, bouncing to rest: height above the floor at time t, and how hard it is squashed. */
export function bounce(t: number, height: number, fall = 0.38, restitution = 0.42): { y: number; squash: number } {
  if (t <= 0) return { y: height, squash: 0 };
  const g = (2 * height) / (fall * fall);
  if (t < fall) return { y: height - 0.5 * g * t * t, squash: 0 };
  let start = fall;
  let speed = g * fall * restitution;
  let squash = Math.exp(-(t - fall) * 22) * 0.24;
  for (let i = 0; i < 4 && speed > 1; i += 1) {
    const flight = (2 * speed) / g;
    if (t < start + flight) {
      const s = t - start;
      return { y: speed * s - 0.5 * g * s * s, squash };
    }
    start += flight;
    squash += Math.exp(-(t - start) * 22) * 0.24 * restitution ** (i + 1);
    speed *= restitution;
  }
  return { y: 0, squash: Math.min(0.24, squash) };
}

export function createEngineExtra(engine: EngineScene, style: CSSStyleDeclaration, still: boolean): Extra {
  const group = new Group();
  group.matrixAutoUpdate = false;
  const color = (name: string, fallback: [number, number, number]) => new Vector3(...cssColorToSrgb(style.getPropertyValue(name), fallback));
  const cyan = color('--lx-cyan', [0.55, 0.86, 0.93]);
  const brass = color('--lx-brass', [0.95, 0.78, 0.45]);
  const topics = ['--lx-w1-a', '--lx-w2-a', '--lx-w3-a', '--lx-w4-a'].map((name, i) => color(name, [[0.95, 0.71, 0.36], [0.27, 0.82, 0.73], [0.65, 0.55, 0.98], [0.24, 0.74, 0.96]][i] as [number, number, number]));

  const shared = {
    uView: { value: new Vector2(1, 1) },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uOcc: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uOccR: { value: new Vector4(8, 8, 8, 0) },
    uDpr: { value: 1 },
    uFade: { value: 0 },
  };
  const material = (vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>, extra: object = {}) =>
    new ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...shared, ...uniforms }, ...premultiplied, depthTest: false, ...extra });

  // --- Curtain and ribbon: one column per sample, rewritten as the curve moves. ---
  const curtainPositions = new Float32Array(COLUMNS * 2 * 3);
  const curtainU = new Float32Array(COLUMNS * 2);
  const curtainV = new Float32Array(COLUMNS * 2);
  const bandPositions = new Float32Array(COLUMNS * 2 * 3);
  const bandW = new Float32Array(COLUMNS * 2);
  const bandH = new Float32Array(COLUMNS * 2);
  const strip: number[] = [];
  for (let i = 0; i < COLUMNS - 1; i += 1) {
    const a = i * 2;
    strip.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (let i = 0; i < COLUMNS; i += 1) {
    const u = i / (COLUMNS - 1);
    curtainU[i * 2] = u; curtainU[i * 2 + 1] = u;
    curtainV[i * 2] = 0; curtainV[i * 2 + 1] = 1;
    bandW[i * 2] = -1; bandW[i * 2 + 1] = 1;
  }
  const curtainGeometry = new BufferGeometry();
  curtainGeometry.setAttribute('position', new BufferAttribute(curtainPositions, 3));
  curtainGeometry.setAttribute('aU', new BufferAttribute(curtainU, 1));
  curtainGeometry.setAttribute('aV', new BufferAttribute(curtainV, 1));
  curtainGeometry.setIndex(strip);
  const bandGeometry = new BufferGeometry();
  bandGeometry.setAttribute('position', new BufferAttribute(bandPositions, 3));
  bandGeometry.setAttribute('aW', new BufferAttribute(bandW, 1));
  bandGeometry.setAttribute('aH', new BufferAttribute(bandH, 1));
  bandGeometry.setIndex(strip);
  const curtain = new Mesh(curtainGeometry, material(CURTAIN_VERTEX, CURTAIN_FRAGMENT, { uColor: { value: cyan } }, { side: DoubleSide }));
  const band = new Mesh(bandGeometry, material(BAND_VERTEX, BAND_FRAGMENT, { uColor: { value: cyan } }, { side: DoubleSide }));
  curtain.frustumCulled = false;
  band.frustumCulled = false;
  curtain.renderOrder = 3;
  band.renderOrder = 4;

  // --- Slabs: the four tiers, as frosted glass. ---
  const slabParts: BufferGeometry[] = [];
  const slabGeometry = new BufferGeometry();
  {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const bands: number[] = [];
    const index: number[] = [];
    TIER_BANDS.forEach((tier, b) => {
      const from = chartX(Math.max(CHART.THETA_MIN, tier.from)) - CHART.W / 2 + 3;
      const to = chartX(Math.min(CHART.THETA_MAX, tier.to)) - CHART.W / 2 - 3;
      const box = new BoxGeometry(to - from, SLAB_TOP, SLAB_THICK);
      box.translate((from + to) / 2, SLAB_TOP / 2, SLAB_Z);
      slabParts.push(box);
      const base = positions.length / 3;
      positions.push(...(box.getAttribute('position').array as Float32Array));
      normals.push(...(box.getAttribute('normal').array as Float32Array));
      uvs.push(...(box.getAttribute('uv').array as Float32Array));
      for (let i = 0; i < box.getAttribute('position').count; i += 1) bands.push(b);
      for (const i of box.getIndex()!.array) index.push(base + i);
    });
    slabGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    slabGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    slabGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    slabGeometry.setAttribute('aBand', new BufferAttribute(new Float32Array(bands), 1));
    slabGeometry.setIndex(index);
    slabParts.forEach(part => part.dispose());
  }
  const active = new Vector4();
  const activeTarget = new Vector4();
  const slabUniforms = { uActive: { value: active }, uCyan: { value: cyan }, uBrass: { value: brass }, uTime: { value: 0 } };
  const slabs = new Mesh(slabGeometry, material(SLAB_VERTEX, SLAB_FRAGMENT, slabUniforms));
  slabs.renderOrder = 1;
  slabs.frustumCulled = false;

  // --- The axis, the marker, the margin of error. ---
  const glow = (size: [number, number], soft: number, core: number, colour: Vector3) => {
    const uniforms = { uColor: { value: colour }, uSize: { value: new Vector2(...size) }, uSoft: { value: soft }, uCore: { value: core } };
    const mesh = new Mesh(new PlaneGeometry(1, 1), material(GLOW_VERTEX, GLOW_FRAGMENT, uniforms, { side: DoubleSide }));
    mesh.frustumCulled = false;
    return { mesh, uniforms };
  };
  const axis = glow([HALF * 2 + 24, 10], 1.6, 0.2, new Vector3(0.85, 0.9, 0.95));
  axis.mesh.scale.set(HALF * 2 + 24, 10, 1);
  axis.mesh.position.set(0, 0, 0);
  axis.mesh.renderOrder = 2;
  const interval = glow([100, 12], 2.2, 0.5, cyan);
  interval.mesh.renderOrder = 5;
  const stem = glow([8, 100], 1.2, 0.25, new Vector3(0.92, 0.95, 0.98));
  stem.mesh.renderOrder = 5;
  const point = glow([30, 30], 3.2, 0.12, brass);
  point.mesh.renderOrder = 13;

  // --- Beads: one per answer. ---
  const beadGeometry = new SphereGeometry(BEAD_R, 28, 18);
  const beadColor = new InstancedBufferAttribute(new Float32Array(ANSWERS * 3), 3);
  const beadMark = new InstancedBufferAttribute(new Float32Array(ANSWERS * 2), 2);
  beadGeometry.setAttribute('aColor', beadColor);
  beadGeometry.setAttribute('aMark', beadMark);
  const beads = new InstancedMesh(beadGeometry, material(BEAD_VERTEX, BEAD_FRAGMENT, {}, { depthTest: true, depthWrite: true }), ANSWERS);
  beads.frustumCulled = false;
  beads.renderOrder = 12;
  const beadState: Bead[] = RUN.steps.slice(1).map((step, i) => {
    const tone = topics[DOMAIN_INDEX[step.item!.domain] ?? 0];
    beadColor.setXYZ(i, tone.x, tone.y, tone.z);
    beadMark.setXY(i, step.correct ? 1 : -1, 0);
    return { index: i, x: chartX(step.item!.b) - CHART.W / 2, rest: BEAD_R + RUG_LEVEL[i] * BEAD_R * 1.9, born: -1, gone: -1, shown: false };
  });
  const placeBead = new Matrix4();
  const beadPosition = new Vector3();
  const beadScale = new Vector3();
  const noTurn = new Quaternion();

  group.add(slabs, axis.mesh, curtain, band, interval.mesh, stem.mesh, beads, point.mesh);

  // --- Labels: DOM text placed where its 3D anchor lands. ---
  let labels: { tiers: HTMLElement[]; easier: HTMLElement | null; harder: HTMLElement | null; you: HTMLElement | null; layer: HTMLElement | null } = { tiers: [], easier: null, harder: null, you: null, layer: null };
  let labelVersion = -1;
  const findLabels = () => {
    const layer = document.querySelector<HTMLElement>('[data-engine-labels]');
    labels = {
      layer,
      tiers: Array.from(layer?.querySelectorAll<HTMLElement>('[data-tier]') ?? []),
      easier: layer?.querySelector<HTMLElement>('[data-end="easier"]') ?? null,
      harder: layer?.querySelector<HTMLElement>('[data-end="harder"]') ?? null,
      you: layer?.querySelector<HTMLElement>('[data-you]') ?? null,
    };
  };
  const written = new Map<HTMLElement, string>();
  const put = (element: HTMLElement | null, x: number, y: number, opacity = 1) => {
    if (!element) return;
    const value = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)|${opacity.toFixed(2)}`;
    if (written.get(element) === value) return;
    written.set(element, value);
    element.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    element.style.opacity = opacity.toFixed(2);
  };

  let lastPlayhead = -1;

  return {
    object: group,
    update(frame: StageFrame, timeline: TimelineState) {
      if (!engine.present()) { group.visible = false; return false; }
      const chart = engine.chartFrame(frame);
      const onScreen = chart.stage.y < frame.ch && chart.stage.y + chart.stage.h > 0;
      // The instrument appears as the thread arrives in the engine, and stays while the stage is on screen.
      const arriving = timeline.b === 'engine' ? timeline.morph : timeline.a === 'engine' ? 1 : 0;
      const presence = onScreen ? Math.max(arriving, timeline.a === 'engine' ? 1 : 0) : 0;
      group.visible = presence > 0.002;
      if (labelVersion !== layoutVersion()) { labelVersion = layoutVersion(); findLabels(); }
      if (labels.layer) labels.layer.style.visibility = group.visible ? 'visible' : 'hidden';
      if (!group.visible) return false;

      group.matrix.copy(chart.matrix);
      group.matrixWorldNeedsUpdate = true;
      shared.uView.value.set(frame.cw, frame.ch);
      shared.uDpr.value = window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1;
      shared.uClip.value.set(chart.stage.x, chart.stage.y, chart.stage.w, chart.stage.h);
      shared.uClipR.value = chart.stage.r;
      shared.uFade.value = presence;
      const { state, heights } = engine.curve(chart.playhead, frame.still);
      const lift = engine.lift(chart.playhead, frame.still);
      // The DOM panels inside the stage sit in front: the readouts, the verdict (once it shows), the ticker.
      const stageBox = engine.stageBox();
      const s = chart.stage.scale;
      ['readouts', 'verdict', 'ticker'].forEach((name, i) => {
        const box = engine.boxes[name];
        const shown = name !== 'verdict' || state.beat === 3;
        if (!box || !box.width || !shown) { shared.uOcc.value[i].set(0, 0, 0, 0); return; }
        shared.uOcc.value[i].set(
          chart.stage.x + (box.left - stageBox.left) * s - 6,
          chart.stage.y + (box.top - stageBox.top) * s - 6,
          box.width * s + 12,
          box.height * s + 12,
        );
      });
      if (chart.playhead !== lastPlayhead) {
        lastPlayhead = chart.playhead;
        for (let i = 0; i < COLUMNS; i += 1) {
          const s = i / (COLUMNS - 1);
          const h = heights[Math.round(s * (POLY_SAMPLES - 1))] * lift;
          const x = (s - 0.5) * HALF * 2;
          const y = h * CHART.CURVE_H;
          curtainPositions.set([x, 0, 0, x, y, 0], i * 6);
          bandPositions.set([x, y, -DEPTH / 2, x, y, DEPTH / 2], i * 6);
          bandH[i * 2] = h; bandH[i * 2 + 1] = h;
        }
        curtainGeometry.getAttribute('position').needsUpdate = true;
        bandGeometry.getAttribute('position').needsUpdate = true;
        bandGeometry.getAttribute('aH').needsUpdate = true;
      }

      // The tier the engine would give now lights its slab, on a spring of its own.
      activeTarget.set(0, 0, 0, 0).setComponent(state.tierIndex, lift);
      let settling = false;
      for (let i = 0; i < 4; i += 1) {
        const value = active.getComponent(i);
        const next = frame.still ? activeTarget.getComponent(i) : value + (activeTarget.getComponent(i) - value) * (1 - Math.exp(-frame.dt * 7));
        active.setComponent(i, next);
        if (Math.abs(next - activeTarget.getComponent(i)) > 0.002) settling = true;
      }

      // YOU: the estimate, its margin of error, and a point of light where it meets the curve.
      const ex = chartX(state.theta) - CHART.W / 2;
      const ey = (heightAtEstimate(state) / RUN.peak) * CHART.CURVE_H * lift;
      const halfWidth = ((chartX(state.theta + state.sem) - chartX(state.theta - state.sem)) / 2);
      interval.mesh.position.set(ex, 0, DEPTH / 2 + 2);
      interval.mesh.scale.set(Math.max(10, halfWidth * 2), 12, 1);
      interval.uniforms.uSize.value.set(Math.max(10, halfWidth * 2), 12);
      stem.mesh.position.set(ex, ey / 2, DEPTH / 2 + 1);
      stem.mesh.scale.set(8, Math.max(1, ey), 1);
      stem.uniforms.uSize.value.set(8, Math.max(1, ey));
      point.mesh.position.set(ex, ey, DEPTH / 2 + 1);
      point.mesh.scale.set(30, 30, 1);
      stem.mesh.visible = lift > 0.05;
      point.mesh.visible = lift > 0.05;
      interval.mesh.visible = lift > 0.05;

      // Beads drop when the replay reaches their answer, and lift away if it goes back.
      const answered = lift < 0.99 ? 0 : state.answered;
      let moving = false;
      for (const bead of beadState) {
        const want = bead.index < answered;
        if (want && !bead.shown) { bead.shown = true; bead.born = frame.now; bead.gone = -1; }
        if (!want && bead.shown) { bead.shown = false; bead.gone = frame.now; }
        let y = bead.rest;
        let alpha = 0;
        let squash = 0;
        if (bead.shown) {
          const t = frame.still ? 9 : (frame.now - bead.born) / 1000;
          const drop = bounce(t, 240);
          y = bead.rest + drop.y;
          squash = drop.squash;
          alpha = Math.min(1, t / 0.12);
          if (t < 1.6) moving = true;
        } else if (bead.gone >= 0) {
          const t = frame.still ? 9 : (frame.now - bead.gone) / 1000;
          y = bead.rest + t * t * 900 + t * 120;
          alpha = Math.max(0, 1 - t / 0.28);
          if (alpha > 0) moving = true;
        }
        beadPosition.set(bead.x, y, BEAD_Z);
        beadScale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
        placeBead.compose(beadPosition, noTurn, beadScale);
        beads.setMatrixAt(bead.index, placeBead);
        beadMark.setY(bead.index, alpha);
      }
      beads.instanceMatrix.needsUpdate = true;
      beadMark.needsUpdate = true;

      // The labels, where their anchors land on screen, inside the stage's own (scaled) box.
      const toLayer = ([x, y]: [number, number]): [number, number] => [(x - chart.stage.x) / chart.stage.scale, (y - chart.stage.y) / chart.stage.scale];
      TIER_BANDS.forEach((tier, i) => {
        const centre = (chartX(Math.max(CHART.THETA_MIN, tier.from)) + chartX(Math.min(CHART.THETA_MAX, tier.to))) / 2 - CHART.W / 2;
        const [x, y] = toLayer(chart.project(centre, -40, SLAB_Z));
        const element = labels.tiers[i];
        if (element) {
          put(element, x, y, presence);
          element.toggleAttribute('data-active', i === state.tierIndex && lift > 0.5);
        }
      });
      const [lx, ly] = toLayer(chart.project(-HALF, -22, DEPTH / 2));
      const [rx, ry] = toLayer(chart.project(HALF, -22, DEPTH / 2));
      put(labels.easier, lx, ly, presence);
      put(labels.harder, rx, ry, presence);
      const [yx, yy] = toLayer(chart.project(ex, ey + 30, DEPTH / 2));
      put(labels.you, yx, yy, presence * smoothstep(0.05, 0.5, lift));

      slabUniforms.uTime.value = frame.time;
      return moving || settling;
    },
    dispose() {
      curtainGeometry.dispose();
      bandGeometry.dispose();
      slabGeometry.dispose();
      beadGeometry.dispose();
      for (const child of group.children) {
        const mesh = child as Mesh;
        (mesh.material as ShaderMaterial).dispose();
        if (mesh.geometry && mesh.geometry !== beadGeometry) mesh.geometry.dispose();
      }
    },
  };
}
