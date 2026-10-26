/**
 * The archive's sky: every problem in the catalog as one star, drawn with WebGL.
 *
 * What it shows is fixed by `galaxyLayout.ts` — rings are banks, angle is year, a knot is a
 * paper — so the picture changes only when the catalog or the learner's work does. Stars a
 * learner has worked on burn brighter; right answers and proofs marked solved turn gold.
 *
 * On cost, the same rules as the landing hero's stage: named three.js imports, device pixel
 * ratio capped at 2, and a render loop that only runs while the canvas is on screen and the
 * tab is visible. With reduced motion the sky holds still and renders only when something
 * changes (a hover, a pick, new progress). Without WebGL it draws a still 2D version.
 */
import { useEffect, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, Group, Line, LineBasicMaterial,
  LineLoop, LineSegments, Mesh, PerspectiveCamera, PlaneGeometry, Points, Scene, ShaderMaterial, Vector3, Vector4,
  WebGLRenderer,
} from 'three';
import { ARCHIVE_FAMILIES } from '../../domain/examArchive';
import { GAP_ANGLE, RING_RADIUS, SCALE_RADIUS, YEAR_ARC, type GalaxyLayout } from './galaxyLayout';

export type GalaxyPick = { star: number; x: number; y: number };

type GalaxyProps = {
  layout: GalaxyLayout;
  /** Per star: 0 untouched, 1 worked on, 2 right or marked solved. */
  states: Uint8Array;
  /** Index into ARCHIVE_FAMILIES to bring forward, or -1. */
  familyFocus: number;
  /** Paper to draw as a constellation (hovered or picked), or -1. */
  focusPaper: number;
  /** The picked star, ringed, or -1. */
  pickedStar: number;
  still: boolean;
  onHover: (pick: GalaxyPick | null) => void;
  onPick: (pick: GalaxyPick | null) => void;
  onUnavailable: () => void;
};

const FOV = 34;
const ELEVATION = 0.7;
const BASE_SPIN = (Math.PI * 2) / 320;

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aState;
attribute float aPaper;
attribute float aFamily;
uniform float uTime;
uniform float uScale;
uniform float uTwinkle;
uniform float uFocusPaper;
uniform float uFamilyFocus;
uniform vec3 uFamily0;
uniform vec3 uFamily1;
uniform vec3 uFamily2;
uniform vec3 uFamily3;
varying vec3 vColor;
varying float vAlpha;
varying float vGold;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 color = aFamily < 0.5 ? uFamily0 : aFamily < 1.5 ? uFamily1 : aFamily < 2.5 ? uFamily2 : uFamily3;
  float focus = (uFocusPaper >= 0.0 && abs(aPaper - uFocusPaper) < 0.5) ? 1.0 : 0.0;
  float familyDim = (uFamilyFocus >= 0.0 && abs(aFamily - uFamilyFocus) > 0.5) ? 0.16 : 1.0;
  float paperDim = (uFocusPaper >= 0.0 && focus < 0.5) ? 0.5 : 1.0;
  float lit = aState > 0.5 ? 1.0 : 0.0;
  float twinkle = 1.0 + uTwinkle * 0.2 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  gl_PointSize = aSize * (1.0 + 0.5 * lit + 0.9 * focus) * twinkle * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
  vColor = color;
  vGold = aState > 1.5 ? 1.0 : 0.0;
  vAlpha = (0.5 + 0.5 * lit + 0.4 * focus) * familyDim * paperDim;
}`;

const STAR_FRAGMENT = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uWhite;
varying vec3 vColor;
varying float vAlpha;
varying float vGold;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float core = exp(-d * 26.0);
  float halo = exp(-d * 5.5) * 0.42;
  vec3 tint = mix(vColor, uGold, vGold);
  vec3 color = mix(tint, uWhite, clamp(core * 1.4, 0.0, 0.75));
  gl_FragColor = vec4(color, (core + halo) * vAlpha);
  #include <colorspace_fragment>
}`;

// The sky behind everything, drawn in screen space so the canvas can be opaque.
const SKY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uFrom;
uniform float uTo;
varying vec2 vUv;
void main() {
  // The same straight sRGB gradient the hero paints in CSS, across the hero's full height,
  // so the canvas edge never shows where it does not cover the whole sky.
  float t = mix(uTo, uFrom, vUv.y);
  gl_FragColor = vec4(mix(uTop, uBottom, t), 1.0);
}`;

// Soft light along each ring, only across the years that bank actually covers.
const NEBULA_VERTEX = /* glsl */ `
varying vec2 vPlane;
void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAGMENT = /* glsl */ `
uniform vec3 uFamily0;
uniform vec3 uFamily1;
uniform vec3 uFamily2;
uniform vec3 uFamily3;
uniform vec4 uRings;
uniform vec4 uFrom;
uniform vec4 uTo;
uniform vec3 uCore;
uniform float uTime;
uniform float uFamilyFocus;
uniform float uStart;
uniform float uArc;
varying vec2 vPlane;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float band(float r, float ring, float t, float from, float to, float index) {
  float radial = exp(-pow((r - ring) / 0.4, 2.0));
  float covered = smoothstep(from - 0.02, from + 0.01, t) * (1.0 - smoothstep(to - 0.01, to + 0.02, t));
  float dim = (uFamilyFocus >= 0.0 && abs(index - uFamilyFocus) > 0.5) ? 0.2 : 1.0;
  return radial * covered * dim;
}
void main() {
  // The plane lies in x/-z, so its local y is world -z.
  vec2 p = vec2(vPlane.x, -vPlane.y);
  float r = length(p);
  float angle = atan(p.y, p.x);
  float t = mod(angle - uStart, 6.2831853) / uArc;
  float n = fbm(p * 0.9 + vec2(uTime * 0.012, -uTime * 0.008));
  vec3 color = uFamily0 * band(r, uRings.x, t, uFrom.x, uTo.x, 0.0)
    + uFamily1 * band(r, uRings.y, t, uFrom.y, uTo.y, 1.0)
    + uFamily2 * band(r, uRings.z, t, uFrom.z, uTo.z, 2.0)
    + uFamily3 * band(r, uRings.w, t, uFrom.w, uTo.w, 3.0);
  float core = exp(-r * r * 2.6);
  color = color * (0.25 + 0.75 * n) * 0.24 + uCore * core * 0.1 * (0.6 + 0.4 * n);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

const MARK_VERTEX = /* glsl */ `
uniform float uSize;
void main() {
  gl_PointSize = uSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const MARK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  float ring = smoothstep(0.08, 0.0, abs(d - 0.8));
  gl_FragColor = vec4(uColor, ring * 0.9);
  #include <colorspace_fragment>
}`;

function srgb(hex: string): Vector3 {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return new Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function readColor(style: CSSStyleDeclaration, name: string, fallback: string): Color {
  const value = style.getPropertyValue(name).trim();
  return new Color(value || fallback);
}

export default function ArchiveGalaxy({ layout, states, familyFocus, focusPaper, pickedStar, still, onHover, onPick, onUnavailable }: GalaxyProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  // The latest props, read by the long-lived render loop without restarting it.
  const live = useRef({ states, familyFocus, focusPaper, pickedStar, still, onHover, onPick });
  live.current = { states, familyFocus, focusPaper, pickedStar, still, onHover, onPick };
  const api = useRef<{ sync: () => void } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const labelHost = labelsRef.current;
    if (!host || !labelHost) return;
    // A fresh canvas per run: a context released on cleanup can never be handed back to a remount.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, labelHost);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      drawStill(canvas, host, layout, live.current.states);
      onUnavailable();
      return () => canvas.remove();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const style = getComputedStyle(host);
    const family = [
      readColor(style, '--xa-star-amc', '#6cc7f0'), readColor(style, '--xa-star-aime', '#67d9b1'),
      readColor(style, '--xa-star-usamo', '#f49a7c'), readColor(style, '--xa-star-imo', '#b39bf9'),
    ];
    const gold = readColor(style, '--xa-star-gold', '#ffe2a0');
    const core = readColor(style, '--xa-star-core', '#fff1d6');
    // The sky gradient stays in sRGB, exactly as CSS interpolates it.
    const skyTop = srgb(style.getPropertyValue('--xa-sky-top').trim() || '#131c35');
    const skyBottom = srgb(style.getPropertyValue('--xa-sky-bottom').trim() || '#090e1c');
    const guide = readColor(style, '--xa-sky-muted', '#a6b0c8');

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
    const rings = new Group();
    scene.add(rings);
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T) => { disposables.push(item); return item; };

    // Sky.
    const skyGeometry = track(new BufferGeometry());
    skyGeometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const skyMaterial = track(new ShaderMaterial({
      uniforms: { uTop: { value: skyTop }, uBottom: { value: skyBottom }, uFrom: { value: 0 }, uTo: { value: 1 } },
      vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, depthTest: false, depthWrite: false,
    }));
    const sky = new Mesh(skyGeometry, skyMaterial);
    sky.frustumCulled = false;
    sky.renderOrder = -2;
    scene.add(sky);

    // Ring light, limited to the years each bank covers.
    const start = GAP_ANGLE + (Math.PI * 2 - YEAR_ARC) / 2;
    const span = layout.lastYear - layout.firstYear + 1;
    const coverage = ARCHIVE_FAMILIES.map(name => {
      const years = layout.papers.filter(paper => paper.family === name && paper.year).map(paper => paper.year!);
      return [(Math.min(...years) - layout.firstYear) / span, (Math.max(...years) - layout.firstYear + 1) / span];
    });
    const nebulaMaterial = track(new ShaderMaterial({
      uniforms: {
        uFamily0: { value: family[0] }, uFamily1: { value: family[1] }, uFamily2: { value: family[2] }, uFamily3: { value: family[3] },
        uRings: { value: new Vector4(...ARCHIVE_FAMILIES.map(name => RING_RADIUS[name])) },
        uFrom: { value: new Vector4(...coverage.map(range => range[0])) }, uTo: { value: new Vector4(...coverage.map(range => range[1])) },
        uCore: { value: core }, uTime: { value: 0 }, uFamilyFocus: { value: -1 }, uStart: { value: start }, uArc: { value: YEAR_ARC },
      },
      vertexShader: NEBULA_VERTEX, fragmentShader: NEBULA_FRAGMENT,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    }));
    const nebula = new Mesh(track(new PlaneGeometry(13, 13)), nebulaMaterial);
    nebula.rotation.x = -Math.PI / 2;
    nebula.renderOrder = -1;
    rings.add(nebula);

    // Ring guides: a faint full circle, and a brighter arc across the years that are here.
    ARCHIVE_FAMILIES.forEach((name, index) => {
      const radius = RING_RADIUS[name];
      const circle = new Float32Array(192 * 3);
      for (let i = 0; i < 192; i += 1) {
        const a = (i / 192) * Math.PI * 2;
        circle[i * 3] = Math.cos(a) * radius;
        circle[i * 3 + 2] = Math.sin(a) * radius;
      }
      const loopGeometry = track(new BufferGeometry());
      loopGeometry.setAttribute('position', new BufferAttribute(circle, 3));
      rings.add(new LineLoop(loopGeometry, track(new LineBasicMaterial({ color: family[index], transparent: true, opacity: 0.07, depthWrite: false }))));
      const [from, to] = coverage[index];
      const steps = Math.max(8, Math.round((to - from) * 160));
      const arc = new Float32Array((steps + 1) * 3);
      for (let i = 0; i <= steps; i += 1) {
        const a = start + YEAR_ARC * (from + (to - from) * (i / steps));
        arc[i * 3] = Math.cos(a) * radius;
        arc[i * 3 + 2] = Math.sin(a) * radius;
      }
      const arcGeometry = track(new BufferGeometry());
      arcGeometry.setAttribute('position', new BufferAttribute(arc, 3));
      rings.add(new Line(arcGeometry, track(new LineBasicMaterial({ color: family[index], transparent: true, opacity: 0.2, depthWrite: false }))));
    });

    // The year scale: a tick per year, longer at each decade.
    const ticks: number[] = [];
    for (let year = layout.firstYear; year <= layout.lastYear; year += 1) {
      const a = layout.angleOf(year);
      const long = year % 10 === 0 || year === layout.firstYear || year === layout.lastYear;
      const inner = SCALE_RADIUS - (long ? 0.16 : 0.07);
      ticks.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * SCALE_RADIUS, 0, Math.sin(a) * SCALE_RADIUS);
    }
    const tickGeometry = track(new BufferGeometry());
    tickGeometry.setAttribute('position', new BufferAttribute(new Float32Array(ticks), 3));
    rings.add(new LineSegments(tickGeometry, track(new LineBasicMaterial({ color: guide, transparent: true, opacity: 0.32, depthWrite: false }))));

    // Stars.
    const starGeometry = track(new BufferGeometry());
    const count = layout.paperOf.length;
    const paperAttr = new Float32Array(count);
    const familyAttr = new Float32Array(count);
    for (let i = 0; i < count; i += 1) { paperAttr[i] = layout.paperOf[i]; familyAttr[i] = layout.familyOf[i]; }
    const stateAttr = new BufferAttribute(new Float32Array(count), 1);
    starGeometry.setAttribute('position', new BufferAttribute(layout.positions, 3));
    starGeometry.setAttribute('aSize', new BufferAttribute(layout.sizes, 1));
    starGeometry.setAttribute('aPhase', new BufferAttribute(layout.phases, 1));
    starGeometry.setAttribute('aPaper', new BufferAttribute(paperAttr, 1));
    starGeometry.setAttribute('aFamily', new BufferAttribute(familyAttr, 1));
    starGeometry.setAttribute('aState', stateAttr);
    const starMaterial = track(new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uScale: { value: 1 }, uTwinkle: { value: 1 }, uFocusPaper: { value: -1 }, uFamilyFocus: { value: -1 },
        uFamily0: { value: family[0] }, uFamily1: { value: family[1] }, uFamily2: { value: family[2] }, uFamily3: { value: family[3] },
        uGold: { value: gold }, uWhite: { value: core },
      },
      vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    }));
    const stars = new Points(starGeometry, starMaterial);
    rings.add(stars);

    // The focused paper, joined in question order.
    const constellationGeometry = track(new BufferGeometry());
    const constellationPositions = new Float32Array(32 * 3);
    constellationGeometry.setAttribute('position', new BufferAttribute(constellationPositions, 3));
    constellationGeometry.setDrawRange(0, 0);
    const constellationMaterial = track(new LineBasicMaterial({ color: core, transparent: true, opacity: 0.5, depthWrite: false, blending: AdditiveBlending }));
    rings.add(new Line(constellationGeometry, constellationMaterial));

    // A ring around the picked star.
    const markGeometry = track(new BufferGeometry());
    markGeometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    const markMaterial = track(new ShaderMaterial({
      uniforms: { uSize: { value: 26 }, uColor: { value: core } },
      vertexShader: MARK_VERTEX, fragmentShader: MARK_FRAGMENT, transparent: true, depthWrite: false, blending: AdditiveBlending,
    }));
    const mark = new Points(markGeometry, markMaterial);
    mark.visible = false;
    rings.add(mark);

    // Decade labels, placed in HTML so they stay crisp and readable.
    const labelYears = [layout.firstYear];
    for (let year = Math.ceil((layout.firstYear + 5) / 10) * 10; year <= layout.lastYear - 4; year += 10) labelYears.push(year);
    labelYears.push(layout.lastYear);
    labelHost.replaceChildren(...labelYears.map(year => {
      const span = document.createElement('span');
      span.textContent = String(year);
      return span;
    }));
    const labelNodes = Array.from(labelHost.children) as HTMLSpanElement[];

    let width = 1;
    let height = 1;
    let wideLayout = false;
    let distance = 12;
    let projection = 1;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const tanHalf = Math.tan((FOV * Math.PI) / 360);
      const extent = SCALE_RADIUS + 0.55;
      // Fit the whole ring system: across the width, and the tilted ellipse top to bottom.
      const wide = width >= 860;
      const usable = wide ? 0.62 : 0.9;
      distance = Math.max(extent / (tanHalf * camera.aspect * usable), (extent * Math.sin(ELEVATION) + 0.4) / (tanHalf * (wide ? 0.8 : 0.92)));
      wideLayout = wide;
      // Wide: the map sits right of the words and above the legend.
      if (wide) camera.setViewOffset(width, height, -width * 0.2, height * 0.06, width, height);
      else camera.setViewOffset(width, height, 0, height * 0.05, width, height);
      const sky = host.closest('.xa-sky')?.getBoundingClientRect();
      if (sky && sky.height > 0) {
        skyMaterial.uniforms.uFrom.value = (rect.top - sky.top) / sky.height;
        skyMaterial.uniforms.uTo.value = (rect.bottom - sky.top) / sky.height;
      }
      camera.updateProjectionMatrix();
      projection = (height * renderer.getPixelRatio()) / (2 * tanHalf);
      starMaterial.uniforms.uScale.value = 0.2 * projection;
      markMaterial.uniforms.uSize.value = 24 * renderer.getPixelRatio();
      invalidate();
    };

    // Camera, gently following the pointer.
    const lookTarget = new Vector3(0, -0.15, 0);
    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    const placeCamera = () => {
      const elevation = ELEVATION + pitch;
      camera.position.set(Math.sin(yaw) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(yaw) * Math.cos(elevation) * distance);
      camera.lookAt(lookTarget);
    };

    let hovering = false;
    let spin = BASE_SPIN;
    let time = 0;
    const clock = new Clock();
    const world = new Vector3();
    const toCamera = new Vector3();

    const sync = () => {
      const { states: next, familyFocus: fam, focusPaper: paper, pickedStar: picked, still: quiet } = live.current;
      const array = stateAttr.array as Float32Array;
      for (let i = 0; i < count; i += 1) array[i] = next[i] ?? 0;
      stateAttr.needsUpdate = true;
      starMaterial.uniforms.uFamilyFocus.value = fam;
      nebulaMaterial.uniforms.uFamilyFocus.value = fam;
      starMaterial.uniforms.uFocusPaper.value = paper;
      starMaterial.uniforms.uTwinkle.value = quiet ? 0 : 1;
      if (paper >= 0) {
        const from = layout.paperStart[paper];
        const n = Math.min(32, layout.papers[paper].questions.length);
        constellationPositions.set(layout.positions.subarray(from * 3, (from + n) * 3));
        constellationGeometry.attributes.position.needsUpdate = true;
        constellationGeometry.setDrawRange(0, n);
        constellationMaterial.color = family[layout.familyOf[from]].clone().lerp(core, 0.35);
      } else {
        constellationGeometry.setDrawRange(0, 0);
      }
      if (picked >= 0) {
        (markGeometry.attributes.position.array as Float32Array).set(layout.positions.subarray(picked * 3, picked * 3 + 3));
        markGeometry.attributes.position.needsUpdate = true;
        mark.visible = true;
      } else {
        mark.visible = false;
      }
      invalidate();
    };
    api.current = { sync };

    const placeLabels = () => {
      rings.updateMatrixWorld();
      labelYears.forEach((year, index) => {
        const a = layout.angleOf(year);
        world.set(Math.cos(a) * (SCALE_RADIUS + 0.38), 0, Math.sin(a) * (SCALE_RADIUS + 0.38)).applyMatrix4(rings.matrixWorld);
        const depth = toCamera.copy(world).sub(camera.position).length();
        world.project(camera);
        const node = labelNodes[index];
        const x = Math.min(width - 22, Math.max(22, ((world.x + 1) / 2) * width));
        const y = ((1 - world.y) / 2) * height;
        node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        // Labels that drift under the words or the hint step back rather than collide with them.
        const underCopy = wideLayout && (x < width * 0.46 || (y < 70 && x > width - 400)) ? 0.12 : 1;
        node.style.opacity = String(Math.max(0.35, Math.min(1, 1.6 - (depth - distance) / 6)) * underCopy);
      });
    };

    let frame = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    const render = () => {
      frame = 0;
      const dt = Math.min(clock.getDelta(), 0.05);
      const quiet = live.current.still;
      if (!quiet) {
        time += dt;
        spin += ((hovering ? 0 : BASE_SPIN) - spin) * (1 - Math.exp(-dt * 2.5));
        rings.rotation.y += spin * dt;
        yaw += (targetYaw - yaw) * (1 - Math.exp(-dt * 3));
        pitch += (targetPitch - pitch) * (1 - Math.exp(-dt * 3));
      }
      placeCamera();
      starMaterial.uniforms.uTime.value = time;
      nebulaMaterial.uniforms.uTime.value = time;
      renderer.render(scene, camera);
      placeLabels();
      if (!quiet && visible && pageVisible) frame = requestAnimationFrame(render);
    };
    function invalidate() {
      if (!frame && visible && pageVisible) frame = requestAnimationFrame(render);
    }

    // Picking: the nearest star on screen to the pointer.
    const nearest = (clientX: number, clientY: number, radius: number): GalaxyPick | null => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      rings.updateMatrixWorld();
      const fam = live.current.familyFocus;
      let best = -1;
      let bestDistance = radius * radius;
      let bx = 0;
      let by = 0;
      for (let i = 0; i < count; i += 1) {
        if (fam >= 0 && layout.familyOf[i] !== fam) continue;
        world.set(layout.positions[i * 3], layout.positions[i * 3 + 1], layout.positions[i * 3 + 2]).applyMatrix4(rings.matrixWorld).project(camera);
        if (world.z > 1) continue;
        const sx = ((world.x + 1) / 2) * width;
        const sy = ((1 - world.y) / 2) * height;
        const d = (sx - px) ** 2 + (sy - py) ** 2;
        if (d < bestDistance) { bestDistance = d; best = i; bx = sx; by = sy; }
      }
      return best >= 0 ? { star: best, x: bx, y: by } : null;
    };

    let lastPointer = 'mouse';
    const onDown = (event: PointerEvent) => { lastPointer = event.pointerType; };
    const onMove = (event: PointerEvent) => {
      // Touch drags scroll the page; only a mouse steers the view or hovers.
      if (event.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      targetYaw = ((event.clientX - rect.left) / rect.width - 0.5) * 0.12;
      targetPitch = ((event.clientY - rect.top) / rect.height - 0.5) * -0.05;
      const pick = nearest(event.clientX, event.clientY, 16);
      hovering = true;
      canvas.style.cursor = pick ? 'pointer' : 'default';
      live.current.onHover(pick);
      invalidate();
    };
    const onLeave = () => {
      hovering = false;
      targetYaw = 0;
      targetPitch = 0;
      canvas.style.cursor = 'default';
      live.current.onHover(null);
      invalidate();
    };
    const onClick = (event: MouseEvent) => {
      live.current.onPick(nearest(event.clientX, event.clientY, lastPointer === 'mouse' ? 16 : 26));
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const skyElement = host.closest('.xa-sky');
    if (skyElement) resizeObserver.observe(skyElement);
    const visibility = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) { clock.getDelta(); invalidate(); }
    });
    visibility.observe(host);
    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) { clock.getDelta(); invalidate(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      visible = false;
      onUnavailable();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    resize();
    sync();

    return () => {
      api.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onLost);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
    // The scene is built once per layout; everything else flows through `sync`.
  }, [layout]);

  useEffect(() => { api.current?.sync(); }, [states, familyFocus, focusPaper, pickedStar, still]);

  return <div className="xa-galaxy" ref={hostRef}>
    <div className="xa-galaxy-labels" ref={labelsRef} aria-hidden="true" />
  </div>;
}

/** Without WebGL: the same map, drawn once in 2D from the same camera angle. */
function drawStill(canvas: HTMLCanvasElement, host: HTMLElement, layout: GalaxyLayout, states: Uint8Array) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = host.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const style = getComputedStyle(host);
  const colors = ['--xa-star-amc', '--xa-star-aime', '--xa-star-usamo', '--xa-star-imo'].map(name => style.getPropertyValue(name).trim() || '#ffffff');
  const gold = style.getPropertyValue('--xa-star-gold').trim() || '#ffe2a0';
  const scale = Math.min(canvas.width / ((SCALE_RADIUS + 0.6) * 2), canvas.height / ((SCALE_RADIUS + 0.6) * 2 * Math.sin(ELEVATION) + 1));
  const cx = canvas.width * (rect.width >= 860 ? 0.62 : 0.5);
  const cy = canvas.height / 2;
  context.globalCompositeOperation = 'lighter';
  for (let i = 0; i < layout.paperOf.length; i += 1) {
    const x = cx + layout.positions[i * 3] * scale;
    const y = cy + layout.positions[i * 3 + 2] * scale * Math.sin(ELEVATION);
    const state = states[i] ?? 0;
    context.globalAlpha = state ? 0.95 : 0.5;
    context.fillStyle = state === 2 ? gold : colors[layout.familyOf[i]];
    context.beginPath();
    context.arc(x, y, (state ? 1.6 : 1.1) * ratio, 0, Math.PI * 2);
    context.fill();
  }
}
