/**
 * Mathematics as light: the landing page's particle stages, drawn with WebGL.
 *
 * Two variants share one renderer setup:
 *
 *   - `mobius`, the hero. Rails of particles stream along a Möbius strip; the
 *     strip's single edge is drawn warm, so following it twice round shows
 *     there is only one. On first paint the particles assemble out of a wide
 *     shell, and as the hero is scrolled away the form loosens and drifts.
 *   - `worlds`, the four-domain chapter. One cloud morphs between the monkey
 *     saddle, the geodesic sphere, the rotating 4-cube and the times table
 *     modulo n as the reader scrolls (see particleShapes.ts for the mathematics).
 *     The 4-cube keeps turning through four dimensions and the times table's
 *     multiplier drifts from 2 towards 3, so the cardioid breathes.
 *
 * The particle positions are computed in the vertex shader — the strip from its
 * parametric equation, the morph from per-form attributes — so the CPU does no
 * per-particle work after setup and the GPU uploads nothing per frame.
 *
 * On cost, the rules ArchiveGalaxy set: named three.js imports, the device
 * pixel ratio capped (lower on small or low-core devices, which also get fewer
 * particles), and a render loop that runs only while the canvas is on screen
 * and the tab is visible. With reduced motion nothing moves on its own; the
 * stage renders once, and again only when the scroll changes what it shows.
 *
 * Two more guards keep a weak machine smooth. The loop watches its own frame
 * time and, if the device cannot keep up, draws fewer particles at a lower
 * pixel ratio (the particles are stored in shuffled order, so any prefix is an
 * even sample of the form). And a software rasteriser — SwiftShader, llvmpipe —
 * never gets the live stage at all: it would spend seconds per frame, so it gets
 * the same points drawn once in 2D, which is also what happens without WebGL.
 */

import { useEffect, useRef } from 'react';
import type { MotionValue } from 'motion/react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, PerspectiveCamera, Points, Scene,
  ShaderMaterial, Vector2, Vector4, WebGLRenderer,
} from 'three';
import {
  MOBIUS, MODULAR_CHORDS, MODULAR_RADIUS, WORLD_KIND, mobiusLayout, mobiusPoint, modularPoint, mulberry32, worldForms, type WorldForm,
} from './particleShapes';

export interface ParticleFieldProps {
  variant: 'mobius' | 'worlds';
  /** worlds: a continuous index through the four forms, 0–3. */
  morph?: MotionValue<number>;
  /** mobius: 0 at rest, 1 once the hero has been scrolled away. */
  release?: MotionValue<number>;
  /** Reduced motion: render on change only, never on a timer. */
  still: boolean;
  className?: string;
  onReady?: () => void;
}

const FOV = 32;
const TAU = Math.PI * 2;

/** How far each world form is tipped towards the viewer: the saddle and the spiral read best from above. */
const WORLD_TILT = [0.62, 0.32, 0.28, 1.02];

const MOBIUS_VERTEX = /* glsl */ `
attribute vec4 aParam;
uniform float uTime;
uniform float uIntro;
uniform float uRelease;
uniform float uScale;
uniform vec2 uPointer;
uniform float uPointerPower;
uniform float uAspect;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uEdge;
varying vec3 vColor;
varying float vAlpha;

const float RADIUS = ${MOBIUS.radius.toFixed(4)};
const float HALF = ${MOBIUS.halfWidth.toFixed(4)};

vec3 strip(float u, float s) {
  float h = u * 0.5;
  float reach = RADIUS + s * cos(h);
  return vec3(reach * cos(u), s * sin(h), reach * sin(u));
}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float seed = abs(aParam.w);
  bool dust = aParam.w < 0.0;
  vec3 target;
  float tone;
  float edge = 0.0;
  float size;
  float u = 0.0;
  if (!dust) {
    // Each rail flows along the strip; after one lap a rail lands where its mirror began.
    u = aParam.x + uTime * 0.15 * aParam.z;
    target = strip(u, aParam.y);
    // Colour belongs to the place on the strip, not to the particle passing through it.
    tone = 0.5 + 0.5 * cos(u);
    edge = smoothstep(HALF * 0.8, HALF, abs(aParam.y));
    size = 1.0 + edge * 0.85;
  } else {
    float theta = aParam.x + uTime * 0.018;
    float phi = aParam.y;
    float r = aParam.z;
    target = vec3(r * sin(phi) * cos(theta), r * cos(phi) * 0.55, r * sin(phi) * sin(theta));
    tone = hash(seed * 91.7);
    size = 0.55 + seed * 0.75;
  }

  // Assembly out of a wide shell, each particle on its own delay.
  vec3 scatter = normalize(vec3(hash(seed * 13.13) - 0.5, hash(seed * 7.71) - 0.5, hash(seed * 3.37) - 0.5) + 1e-4);
  float t = clamp(uIntro * 1.5 - seed * 0.5, 0.0, 1.0);
  t = 1.0 - pow(1.0 - t, 3.0);
  vec3 p = mix(scatter * (5.5 + seed * 5.0), target, t);

  // Released as the hero scrolls away: the form loosens outwards and lifts.
  p += scatter * uRelease * (0.4 + seed * 2.2);
  p.y += uRelease * (seed - 0.35) * 0.9;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Particles near the pointer lean away from it and brighten.
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uPointer;
  d.x *= uAspect;
  float near = uPointerPower * (1.0 - smoothstep(0.0, 0.3, length(d)));
  clip.xy += normalize(d + 1e-5) * near * 0.055 * clip.w;
  gl_Position = clip;

  // A slow crest of light runs round the strip ahead of the flow.
  float crest = dust ? 0.0 : pow(0.5 + 0.5 * cos(u * 0.5 - uTime * 0.42), 26.0);
  float twinkle = 0.74 + 0.26 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
  gl_PointSize = size * (1.0 + near * 1.3 + crest * 0.9) * uScale / -mv.z;

  vec3 base = mix(uCool, uWarm, tone);
  vColor = mix(base, uEdge, edge * 0.9) + crest * 0.32;
  vAlpha = ((dust ? 0.3 : 0.78) * twinkle * t + near * 0.22) * (1.0 - uRelease * 0.7);
}`;

const WORLDS_VERTEX = /* glsl */ `
attribute vec4 aShape0;
attribute vec4 aShape1;
attribute vec4 aShape2;
attribute vec4 aShape3;
attribute vec4 aSizes;
attribute vec4 aTones;
attribute vec4 aSeed;
uniform float uMorph;
uniform float uTime;
uniform float uReveal;
uniform float uScale;
uniform vec2 uPointer;
uniform float uPointerPower;
uniform float uAspect;
uniform vec4 uKind;
uniform float uMultiplier;
uniform vec3 uColA0;
uniform vec3 uColA1;
uniform vec3 uColA2;
uniform vec3 uColA3;
uniform vec3 uColB0;
uniform vec3 uColB1;
uniform vec3 uColB2;
uniform vec3 uColB3;
varying vec3 vColor;
varying float vAlpha;

vec4 formAt(float i) { return i < 0.5 ? aShape0 : i < 1.5 ? aShape1 : i < 2.5 ? aShape2 : aShape3; }
float pick(vec4 v, float i) { return i < 0.5 ? v.x : i < 1.5 ? v.y : i < 2.5 ? v.z : v.w; }
vec3 colourA(float i) { return i < 0.5 ? uColA0 : i < 1.5 ? uColA1 : i < 2.5 ? uColA2 : uColA3; }
vec3 colourB(float i) { return i < 0.5 ? uColB0 : i < 1.5 ? uColB1 : i < 2.5 ? uColB2 : uColB3; }

vec3 place(vec4 s, float i) {
  float kind = pick(uKind, i);
  if (kind < 0.5) return s.xyz;
  if (kind < 1.5) {
    // Four dimensions: turn through the x-w and y-w planes, then project from w.
    float a = uTime * 0.3;
    float b = uTime * 0.19 + 0.6;
    vec4 p = s;
    p = vec4(p.x * cos(a) - p.w * sin(a), p.y, p.z, p.x * sin(a) + p.w * cos(a));
    p = vec4(p.x, p.y * cos(b) - p.w * sin(b), p.z, p.y * sin(b) + p.w * cos(b));
    return p.xyz * (2.5 / (3.3 - p.w));
  }
  // The times table: chord k = s.x * n runs from k to m * k, and s.y says how far along.
  float from = 6.28318530718 * s.x;
  float to = from * uMultiplier;
  vec2 q = mix(vec2(cos(from), sin(from)), vec2(cos(to), sin(to)), s.y) * ${MODULAR_RADIUS.toFixed(4)};
  return vec3(q.x, s.z, q.y);
}

void main() {
  float m = clamp(uMorph, 0.0, 3.0);
  float i0 = floor(m);
  float i1 = min(i0 + 1.0, 3.0);
  float seed = aSeed.w;
  // Each particle sets off a little after the last, so a morph flows like a current.
  float t = clamp((m - i0 - seed * 0.35) / 0.65, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);

  vec3 p = mix(place(formAt(i0), i0), place(formAt(i1), i1), t);
  // Mid-flight the cloud breathes out before it gathers into the next form.
  p += aSeed.xyz * sin(t * 3.14159265) * 0.75;
  p += aSeed.xyz * 0.018 * sin(uTime * 1.2 + seed * 37.0);
  p *= mix(0.6, 1.0, uReveal);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uPointer;
  d.x *= uAspect;
  float near = uPointerPower * (1.0 - smoothstep(0.0, 0.28, length(d)));
  clip.xy += normalize(d + 1e-5) * near * 0.05 * clip.w;
  gl_Position = clip;

  float size = mix(pick(aSizes, i0), pick(aSizes, i1), t);
  float tone = mix(pick(aTones, i0), pick(aTones, i1), t);
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.6 + seed * 1.9) + seed * 53.0);
  gl_PointSize = size * (1.0 + near * 1.2) * uScale / -mv.z;
  vColor = mix(mix(colourA(i0), colourB(i0), tone), mix(colourA(i1), colourB(i1), tone), t);
  vAlpha = (0.42 + 0.22 * size) * twinkle * uReveal + near * 0.2;
}`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float glow = exp(-d * 4.2);
  gl_FragColor = vec4(vColor, vAlpha * glow);
  #include <colorspace_fragment>
}`;

function readColor(style: CSSStyleDeclaration, name: string, fallback: string): Color {
  return new Color(style.getPropertyValue(name).trim() || fallback);
}

/** Small screens and low-core devices draw fewer, slightly larger particles. */
function deviceTier(width: number) {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return width < 760 || cores <= 4 ? 'low' : 'high';
}

/** A renderer that rasterises on the CPU, where thousands of glowing points cost seconds a frame. */
function isSoftwareRenderer(renderer: WebGLRenderer) {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** Fisher–Yates over records of `size` floats, applying one permutation to every array given. */
function shuffleRecords(count: number, rng: () => number, arrays: { data: Float32Array; size: number }[]) {
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    for (const { data, size } of arrays) {
      for (let k = 0; k < size; k += 1) {
        const a = i * size + k;
        const b = j * size + k;
        const swap = data[a];
        data[a] = data[b];
        data[b] = swap;
      }
    }
  }
}

/** Quality steps the loop can fall back through: share of particles drawn, pixel-ratio ceiling, point size. */
const QUALITY = [
  { share: 1, ratio: 2, size: 1 },
  { share: 0.6, ratio: 1.25, size: 1.12 },
  { share: 0.36, ratio: 1, size: 1.3 },
] as const;

export default function ParticleField({ variant, morph, release, still, className, onReady }: ParticleFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ morph, release, still, onReady });
  live.current = { morph, release, still, onReady };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per run: a context released on cleanup can never be handed back to a remount.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const tier = deviceTier(host.getBoundingClientRect().width || window.innerWidth);
    const style = getComputedStyle(host);
    const isMobius = variant === 'mobius';
    const rng = mulberry32(isMobius ? 5 : 17);

    let renderer: WebGLRenderer | null = null;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
      if (isSoftwareRenderer(renderer)) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer = null;
      }
    } catch {
      renderer = null;
    }
    if (!renderer) {
      // A canvas that has held a WebGL context can never give out a 2D one: start again.
      canvas.remove();
      const stop = runFallback(host, variant, live.current.morph, style);
      live.current.onReady?.();
      return stop;
    }
    const maxRatio = Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.5 : 2);
    renderer.setPixelRatio(maxRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    const geometry = new BufferGeometry();
    let material: ShaderMaterial;
    let count = 0;
    const pointer = new Vector2(10, 10);

    if (isMobius) {
      const layout = tier === 'low' ? mobiusLayout(22, 300, 520, rng) : mobiusLayout(30, 520, 1400, rng);
      shuffleRecords(layout.count, rng, [{ data: layout.params, size: 4 }]);
      count = layout.count;
      geometry.setAttribute('aParam', new BufferAttribute(layout.params, 4));
      // three needs a position attribute to know how many vertices to draw.
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(layout.count * 3), 3));
      material = new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uIntro: { value: still ? 1 : 0 }, uRelease: { value: 0 }, uScale: { value: 1 },
          uPointer: { value: pointer }, uPointerPower: { value: 0 }, uAspect: { value: 1 },
          uCool: { value: readColor(style, '--lx-pf-cool', '#7fd3e6') },
          uWarm: { value: readColor(style, '--lx-pf-warm', '#b9a6ff') },
          uEdge: { value: readColor(style, '--lx-pf-edge', '#ffc978') },
        },
        vertexShader: MOBIUS_VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      });
    } else {
      count = tier === 'low' ? 7000 : 14000;
      const forms = worldForms(count);
      const sizes = new Float32Array(count * 4);
      const tones = new Float32Array(count * 4);
      const seeds = new Float32Array(count * 4);
      // One permutation across every form keeps particle i paired with its partners in each.
      shuffleRecords(count, rng, forms.flatMap((form: WorldForm) => [
        { data: form.points, size: 4 }, { data: form.sizes, size: 1 }, { data: form.tones, size: 1 },
      ]));
      forms.forEach((form: WorldForm, f) => {
        geometry.setAttribute(`aShape${f}`, new BufferAttribute(form.points, 4));
        for (let i = 0; i < count; i += 1) {
          sizes[i * 4 + f] = form.sizes[i];
          tones[i * 4 + f] = form.tones[i];
        }
      });
      for (let i = 0; i < count; i += 1) {
        // A random direction inside the unit ball, for the breath between forms.
        const theta = rng() * TAU;
        const z = rng() * 2 - 1;
        const r = Math.cbrt(rng()) * (0.4 + rng() * 0.8);
        const ring = Math.sqrt(1 - z * z);
        seeds[i * 4] = r * ring * Math.cos(theta);
        seeds[i * 4 + 1] = r * z;
        seeds[i * 4 + 2] = r * ring * Math.sin(theta);
        seeds[i * 4 + 3] = rng();
      }
      geometry.setAttribute('aSizes', new BufferAttribute(sizes, 4));
      geometry.setAttribute('aTones', new BufferAttribute(tones, 4));
      geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
      const colour = (index: number, end: 'a' | 'b', fallback: string) => readColor(style, `--lx-w${index + 1}-${end}`, fallback);
      material = new ShaderMaterial({
        uniforms: {
          uMorph: { value: 0 }, uTime: { value: 0 }, uReveal: { value: still ? 1 : 0 }, uScale: { value: 1 },
          uPointer: { value: pointer }, uPointerPower: { value: 0 }, uAspect: { value: 1 },
          uKind: { value: new Vector4(...WORLD_KIND) }, uMultiplier: { value: 2 },
          uColA0: { value: colour(0, 'a', '#f6c46a') }, uColB0: { value: colour(0, 'b', '#fff0c9') },
          uColA1: { value: colour(1, 'a', '#4fd1bd') }, uColB1: { value: colour(1, 'b', '#d5fff6') },
          uColA2: { value: colour(2, 'a', '#a78bfa') }, uColB2: { value: colour(2, 'b', '#f0e9ff') },
          uColA3: { value: colour(3, 'a', '#38bdf8') }, uColB3: { value: colour(3, 'b', '#e0f6ff') },
        },
        vertexShader: WORLDS_VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      });
    }
    const uniforms = material.uniforms;
    const activeRenderer = renderer;

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // --- Sizing -----------------------------------------------------------
    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      activeRenderer.setSize(width, height, false);
      camera.aspect = width / height;
      const tanHalf = Math.tan((FOV * Math.PI) / 360);
      const wide = width >= 960;
      // Fit the form's radius across the narrower dimension, with a margin.
      const extent = isMobius ? 2.55 : 2.75;
      const share = isMobius ? (wide ? 0.6 : 0.74) : wide ? 0.82 : 0.88;
      const fitHeight = extent / (tanHalf * share);
      const fitWidth = extent / (tanHalf * camera.aspect * share);
      camera.position.set(0, 0, Math.max(fitHeight, fitWidth) * (isMobius && !wide ? 1.04 : 1));
      camera.lookAt(0, 0, 0);
      // Wide: the strip sits right of the words; narrow: above them.
      if (isMobius && wide) camera.setViewOffset(width, height, -width * 0.245, height * 0.02, width, height);
      else if (isMobius) camera.setViewOffset(width, height, 0, height * (camera.aspect < 0.8 ? 0.27 : 0.2), width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      uniforms.uAspect.value = camera.aspect;
      const base = isMobius ? (tier === 'low' ? 0.036 : 0.03) : tier === 'low' ? 0.034 : 0.028;
      uniforms.uScale.value = ((height * activeRenderer.getPixelRatio()) / (2 * tanHalf)) * base * QUALITY[quality].size;
      invalidate();
    };

    // --- Quality ------------------------------------------------------------
    // Frame times are sampled while the stage animates; a device that cannot
    // hold ~30 fps steps down, and one that still cannot stops animating.
    let quality = 0;
    let throttled = false;
    const samples: number[] = [];
    let lastFrameAt = 0;
    const applyQuality = () => {
      geometry.setDrawRange(0, Math.round(count * QUALITY[quality].share));
      activeRenderer.setPixelRatio(Math.min(maxRatio, QUALITY[quality].ratio));
      resize();
    };
    const sampleFrame = (now: number) => {
      const gap = lastFrameAt ? now - lastFrameAt : 0;
      lastFrameAt = now;
      // Gaps after a pause (offscreen, hidden tab) are not frame times.
      if (!gap || gap > 400) return;
      samples.push(gap);
      if (samples.length < 50) return;
      const median = samples.slice(20).sort((a, b) => a - b)[15];
      samples.length = 0;
      if (median > 34 && quality < QUALITY.length - 1) {
        quality += 1;
        applyQuality();
      } else if (median > 40) {
        // Still under ~25 fps at the lightest setting: the page's own scrolling matters more.
        throttled = true;
      }
    };

    // --- Pointer ----------------------------------------------------------
    // Read on the window, because the hero's words sit above the canvas.
    let pointerInside = false;
    let targetYaw = 0;
    let targetPitch = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      pointerInside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      pointer.set(x * 2 - 1, 1 - y * 2);
      targetYaw = pointerInside ? (x - 0.5) * 0.35 : 0;
      targetPitch = pointerInside ? (y - 0.5) * 0.18 : 0;
      if (pointerInside) invalidate();
    };
    const onPointerLeave = () => { pointerInside = false; targetYaw = 0; targetPitch = 0; invalidate(); };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);

    // --- Loop ---------------------------------------------------------------
    const clock = new Clock();
    let time = 0;
    let intro = still ? 1 : 0;
    let reveal = still ? 1 : 0;
    // The entrance runs on the wall clock from the first frame drawn, so a slow
    // device finishes assembling on time instead of in slow motion.
    let firstFrame = 0;
    let yaw = 0;
    let pitch = 0;
    let spin = 0;
    let tilt = isMobius ? 0.5 : WORLD_TILT[0];
    let pointerPower = 0;
    let frame = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    let readyCalled = false;

    const render = () => {
      frame = 0;
      const quiet = live.current.still || throttled;
      if (!quiet) sampleFrame(performance.now());
      const dt = Math.min(clock.getDelta(), 0.05);
      const settle = (rate: number) => 1 - Math.exp(-dt * rate);

      if (!quiet) {
        time += dt;
        const now = performance.now();
        if (!firstFrame) firstFrame = now;
        intro = Math.min(1, (now - firstFrame) / 2600);
        reveal = Math.min(1, (now - firstFrame) / 1600);
        spin += dt * (isMobius ? 0.07 : 0.09);
        yaw += (targetYaw - yaw) * settle(2.4);
        pitch += (targetPitch - pitch) * settle(2.4);
        pointerPower += ((pointerInside ? 1 : 0) - pointerPower) * settle(4);
      } else {
        intro = 1;
        reveal = 1;
        pointerPower = 0;
      }

      if (isMobius) {
        uniforms.uIntro.value = intro;
        uniforms.uRelease.value = live.current.release?.get() ?? 0;
        points.rotation.set(tilt + pitch, spin + yaw, 0.18);
      } else {
        const raw = live.current.morph?.get() ?? 0;
        const value = quiet ? Math.round(raw) : raw;
        uniforms.uMorph.value = value;
        uniforms.uReveal.value = reveal;
        // The times table's multiplier drifts between 2 and 3: cardioid, then nephroid, and back.
        uniforms.uMultiplier.value = quiet ? 2 : 2.5 - 0.5 * Math.cos(time * 0.16);
        const i0 = Math.max(0, Math.min(3, Math.floor(value)));
        const i1 = Math.min(3, i0 + 1);
        const f = value - i0;
        const targetTilt = WORLD_TILT[i0] + (WORLD_TILT[i1] - WORLD_TILT[i0]) * (f * f * (3 - 2 * f));
        tilt += (targetTilt - tilt) * (quiet ? 1 : settle(5));
        points.rotation.set(tilt + pitch, spin + yaw, 0);
      }
      uniforms.uTime.value = time;
      uniforms.uPointerPower.value = pointerPower;
      activeRenderer.render(scene, camera);
      lastRender = performance.now();

      if (!readyCalled) {
        readyCalled = true;
        live.current.onReady?.();
      }
      if (!quiet && visible && pageVisible) frame = requestAnimationFrame(render);
    };
    // A throttled stage still answers the scroll and the pointer, but at most a few times a second.
    let lastRender = 0;
    let pending = 0;
    function invalidate() {
      if (frame || pending || !visible || !pageVisible) return;
      const wait = throttled ? 200 - (performance.now() - lastRender) : 0;
      if (wait > 0) {
        pending = window.setTimeout(() => { pending = 0; invalidate(); }, wait);
        return;
      }
      frame = requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const visibility = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      lastFrameAt = 0;
      if (visible) { clock.getDelta(); invalidate(); }
    }, { rootMargin: '80px' });
    visibility.observe(host);
    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) { clock.getDelta(); invalidate(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Scroll-driven inputs repaint a still stage; a moving one picks them up next frame.
    const unsubscribe = [live.current.morph?.on('change', invalidate), live.current.release?.on('change', invalidate)];

    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      visible = false;
    };
    canvas.addEventListener('webglcontextlost', onLost);

    resize();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(pending);
      unsubscribe.forEach(stop => stop?.());
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onLost);
      geometry.dispose();
      material.dispose();
      activeRenderer.dispose();
      activeRenderer.forceContextLoss();
      canvas.remove();
    };
    // The scene is built once per variant and stillness; everything else is read live.
  }, [variant, still]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}

/**
 * Without a usable WebGL: a 2D canvas, painted once and again only when what it
 * should show changes — a resize, or the reader scrolling to another world.
 */
function runFallback(host: HTMLElement, variant: 'mobius' | 'worlds', morph: MotionValue<number> | undefined, style: CSSStyleDeclaration) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  let shown = -1;
  const paint = () => {
    shown = Math.max(0, Math.min(3, Math.round(morph?.get() ?? 0)));
    drawFallback(canvas, host, variant, shown, style);
  };
  paint();
  const resizeObserver = new ResizeObserver(paint);
  resizeObserver.observe(host);
  const stop = morph?.on('change', value => { if (Math.round(value) !== shown) paint(); });
  return () => {
    resizeObserver.disconnect();
    stop?.();
    canvas.remove();
  };
}

let fallbackForms: WorldForm[] | null = null;

/** The same points, drawn in 2D from the same angle. */
function drawFallback(canvas: HTMLCanvasElement, host: HTMLElement, variant: 'mobius' | 'worlds', morph: number, style: CSSStyleDeclaration) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = host.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const wide = rect.width >= 960;
  // The same framing as the live stage: right of the words when wide, above them when narrow.
  const cx = canvas.width * (variant === 'mobius' && wide ? 0.76 : 0.5);
  const cy = canvas.height * (variant === 'mobius' && !wide ? 0.3 : 0.5);
  const scale = Math.min(canvas.width, canvas.height) / (variant === 'mobius' ? 7.8 : 6.4);
  const tilt = variant === 'mobius' ? 0.5 : WORLD_TILT[Math.round(morph)] ?? 0.4;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  const dot = (x: number, y: number, z: number, color: string, size: number) => {
    const ry = y * cos - z * sin;
    const rz = y * sin + z * cos;
    const depth = 7 / (7 + rz);
    context.globalAlpha = 0.55;
    context.fillStyle = color;
    context.beginPath();
    context.arc(cx + x * scale * depth, cy - ry * scale * depth, size * ratio, 0, TAU);
    context.fill();
  };
  if (variant === 'mobius') {
    const cool = style.getPropertyValue('--lx-pf-cool').trim() || '#7fd3e6';
    const edge = style.getPropertyValue('--lx-pf-edge').trim() || '#ffc978';
    for (let rail = 0; rail < 18; rail += 1) {
      const s = -MOBIUS.halfWidth + (2 * MOBIUS.halfWidth * rail) / 17;
      for (let k = 0; k < 260; k += 1) {
        const [x, y, z] = mobiusPoint((k / 260) * TAU, s);
        dot(x, y, z, rail === 0 || rail === 17 ? edge : cool, 1);
      }
    }
    return;
  }
  const index = Math.max(0, Math.min(3, Math.round(morph)));
  fallbackForms ??= worldForms(3000);
  const form = fallbackForms[index];
  const color = style.getPropertyValue(`--lx-w${index + 1}-a`).trim() || '#ffffff';
  for (let i = 0; i < 3000; i += 1) {
    let [x, y, z] = [form.points[i * 4], form.points[i * 4 + 1], form.points[i * 4 + 2]];
    if (WORLD_KIND[index] === 2) [x, y, z] = modularPoint(x * MODULAR_CHORDS, y, 2);
    else if (WORLD_KIND[index] === 1) {
      // The 4-cube as the shader first shows it: turned 0.6 rad through the y–w plane, then projected from w.
      const w = form.points[i * 4 + 3];
      const turnedW = y * Math.sin(0.6) + w * Math.cos(0.6);
      const k = 2.5 / (3.3 - turnedW);
      [x, y, z] = [x * k, (y * Math.cos(0.6) - w * Math.sin(0.6)) * k, z * k];
    }
    dot(x, y, z, color, 0.9 * form.sizes[i]);
  }
}
