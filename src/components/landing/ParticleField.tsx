/**
 * Mathematics as light: the landing hero's particle stage, drawn with WebGL.
 *
 * Rails of particles stream along a Möbius strip; the strip's single edge is
 * drawn warm, so following it twice round shows there is only one. On first
 * paint the particles assemble out of a wide shell, and as the hero is scrolled
 * away the form loosens and drifts.
 *
 * The particle positions are computed in the vertex shader, from the strip's
 * parametric equation, so the CPU does no per-particle work after setup and the
 * GPU uploads nothing per frame.
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
  ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';
import { MOBIUS, mobiusLayout, mobiusPoint, mulberry32 } from './particleShapes';

export interface ParticleFieldProps {
  /** 0 at rest, 1 once the hero has been scrolled away. */
  release?: MotionValue<number>;
  /** Reduced motion: render on change only, never on a timer. */
  still: boolean;
  className?: string;
  onReady?: () => void;
}

const FOV = 32;
const TAU = Math.PI * 2;

const VERTEX = /* glsl */ `
attribute vec4 aParam;
uniform float uTime;
uniform float uIntro;
uniform float uRelease;
uniform float uScale;
uniform float uDist;
uniform vec2 uPointer;
uniform float uPointerPower;
uniform float uAspect;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uEdge;
varying vec3 vColor;
varying float vAlpha;
varying float vHalo;

const float RADIUS = ${MOBIUS.radius.toFixed(4)};
const float HALF = ${MOBIUS.halfWidth.toFixed(4)};
// A lamp above and to the left of the strip, in view space.
const vec3 LAMP = vec3(-0.46, 0.62, 0.64);

vec3 strip(float u, float s) {
  float h = u * 0.5;
  float reach = RADIUS + s * cos(h);
  return vec3(reach * cos(u), s * sin(h), reach * sin(u));
}

// The way the surface faces at (u, s): the cross product of its two tangents.
vec3 stripNormal(float u, float s) {
  float h = u * 0.5;
  float ch = cos(h);
  float sh = sin(h);
  float cu = cos(u);
  float su = sin(u);
  float reach = RADIUS + s * ch;
  vec3 along = vec3(-reach * su - 0.5 * s * sh * cu, 0.5 * s * ch, reach * cu - 0.5 * s * sh * su);
  vec3 across = vec3(ch * cu, sh, ch * su);
  return normalize(cross(along, across));
}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float seed = abs(aParam.w);
  bool dust = aParam.w < 0.0;
  vec3 target;
  vec3 facing = vec3(0.0, 0.0, 1.0);
  float tone;
  float edge = 0.0;
  float size;
  float u = 0.0;
  if (!dust) {
    // Each rail flows along the strip; after one lap a rail lands where its mirror began.
    u = aParam.x + uTime * 0.15 * aParam.z;
    // No two threads of silk lie perfectly parallel: each wanders a hair off its line.
    float rail = aParam.y + 0.014 * sin(u * 2.0 + aParam.y * 9.0) + 0.006 * sin(u * 5.0 + seed * 40.0);
    target = strip(u, rail);
    facing = stripNormal(u, rail);
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

  // The whole form breathes, very slightly, as something alive would.
  target *= 1.0 + 0.011 * sin(uTime * 0.55);

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

  // Light. The strip has two faces that are really one, so the normal is turned
  // towards the viewer; where it faces the lamp the silk glows, and where the
  // surface turns edge-on to the eye it catches a rim of light.
  vec3 n = normalize(normalMatrix * facing);
  vec3 toEye = normalize(-mv.xyz);
  if (dot(n, toEye) < 0.0) n = -n;
  float lit = clamp(dot(n, normalize(LAMP)), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, toEye), 0.0, 1.0), 2.4);
  float shade = dust ? 1.0 : 0.58 + 0.62 * lit + 0.28 * rim;
  // The strip's one edge stays lit all the way round, so it can be followed with the eye.
  shade = mix(shade, max(shade, 1.0), edge);
  // Depth: the near arc of the strip is crisp and bright, the far arc falls back into the dark.
  float near01 = clamp(0.5 + (uDist + mv.z) / 5.0, 0.0, 1.0);
  float depthFade = mix(0.62, 1.12, near01);

  // A slow crest of light runs round the strip ahead of the flow.
  float crest = dust ? 0.0 : pow(0.5 + 0.5 * cos(u * 0.5 - uTime * 0.42), 26.0);
  // Now and then a particle catches the light and flares, like a spark off a pencil's graphite.
  float spark = dust ? 0.0 : step(0.986, seed) * (0.5 + 0.5 * sin(uTime * (0.5 + seed * 1.3) + seed * 90.0));
  float twinkle = 0.74 + 0.26 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
  gl_PointSize = 1.9 * size * (mix(0.86, 1.1, near01) + near * 1.3 + crest * 0.9 + spark * 1.4) * uScale / -mv.z;

  vec3 base = mix(uCool, uWarm, tone);
  vec3 colour = mix(base, uEdge, edge * 0.9);
  // Where the lamp strikes, the cool silk warms towards cream.
  colour = mix(colour, mix(colour, uEdge, 0.5) + 0.12, lit * lit * 0.55 * (1.0 - edge));
  vColor = colour * shade + crest * 0.32 + spark * 0.45;
  vHalo = dust ? 0.0 : (0.1 + edge * 0.17 + crest * 0.25 + spark * 0.6) * (1.0 - 0.5 * rim);
  // Where the strip turns edge-on its rails pile up on one another, so each is dimmed to keep the sum honest.
  float piling = dust ? 1.0 : 1.0 - 0.6 * rim;
  vAlpha = ((dust ? 0.3 : 0.5) * piling * depthFade * twinkle * t + near * 0.22) * (1.0 - uRelease * 0.7);
}`;

/*
 * A point is drawn at 1.9x its core size so there is room for a halo: a tight
 * bright core, and a wide faint bloom that — added up over the thousands of
 * points that overlap — makes the strip glow like light through paper.
 */
const WORLDS_FRAGMENT = /* glsl */ `
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

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vHalo;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float core = exp(-d * 15.0);
  float halo = vHalo * exp(-d * 3.4) * (1.0 - d) * (1.0 - d);
  gl_FragColor = vec4(vColor, vAlpha * (core + halo));
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

export default function ParticleField({ release, still, className, onReady }: ParticleFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ release, still, onReady });
  live.current = { release, still, onReady };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per run: a context released on cleanup can never be handed back to a remount.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const tier = deviceTier(host.getBoundingClientRect().width || window.innerWidth);
    const style = getComputedStyle(host);
    const rng = mulberry32(5);

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
      const stop = runFallback(host, style);
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

    const layout = tier === 'low' ? mobiusLayout(30, 420, 700, rng) : mobiusLayout(56, 880, 1800, rng);
    shuffleRecords(layout.count, rng, [{ data: layout.params, size: 4 }]);
    count = layout.count;
    geometry.setAttribute('aParam', new BufferAttribute(layout.params, 4));
    // three needs a position attribute to know how many vertices to draw.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(layout.count * 3), 3));
    material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uIntro: { value: still ? 1 : 0 }, uRelease: { value: 0 }, uScale: { value: 1 }, uDist: { value: 10 },
        uPointer: { value: pointer }, uPointerPower: { value: 0 }, uAspect: { value: 1 },
        uCool: { value: readColor(style, '--lx-pf-cool', '#7fd3e6') },
        uWarm: { value: readColor(style, '--lx-pf-warm', '#b9a6ff') },
        uEdge: { value: readColor(style, '--lx-pf-edge', '#ffc978') },
      },
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    });

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
      const extent = 2.55;
      const share = wide ? 0.77 : 0.78;
      const fitHeight = extent / (tanHalf * share);
      const fitWidth = extent / (tanHalf * camera.aspect * share);
      camera.position.set(0, 0, Math.max(fitHeight, fitWidth) * (wide ? 1 : 1.04));
      camera.lookAt(0, 0, 0);
      uniforms.uDist.value = camera.position.z;
      // Wide: the strip sits right of the words; narrow: above them.
      if (wide) camera.setViewOffset(width, height, -width * 0.22, height * 0.02, width, height);
      else camera.setViewOffset(width, height, 0, height * (camera.aspect < 0.8 ? 0.27 : 0.2), width, height);
      camera.updateProjectionMatrix();
      uniforms.uAspect.value = camera.aspect;
      const base = tier === 'low' ? 0.03 : 0.024;
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
    // The entrance runs on the wall clock from the first frame drawn, so a slow
    // device finishes assembling on time instead of in slow motion.
    let firstFrame = 0;
    let yaw = 0;
    let pitch = 0;
    let spin = 0;
    const tilt = 0.5;
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
        spin += dt * 0.07;
        yaw += (targetYaw - yaw) * settle(2.4);
        pitch += (targetPitch - pitch) * settle(2.4);
        pointerPower += ((pointerInside ? 1 : 0) - pointerPower) * settle(4);
      } else {
        intro = 1;
        pointerPower = 0;
      }

      uniforms.uIntro.value = intro;
      uniforms.uRelease.value = live.current.release?.get() ?? 0;
      points.rotation.set(tilt + pitch, spin + yaw, 0.18);
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
    const unsubscribe = [live.current.release?.on('change', invalidate)];

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
    // The scene is built once per stillness setting; everything else is read live.
  }, [still]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}

/**
 * Without a usable WebGL: a 2D canvas, painted once and again only when the
 * stage is resized.
 */
function runFallback(host: HTMLElement, style: CSSStyleDeclaration) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const paint = () => drawFallback(canvas, host, style);
  paint();
  const resizeObserver = new ResizeObserver(paint);
  resizeObserver.observe(host);
  return () => {
    resizeObserver.disconnect();
    canvas.remove();
  };
}

/** The same points, drawn in 2D from the same angle. */
function drawFallback(canvas: HTMLCanvasElement, host: HTMLElement, style: CSSStyleDeclaration) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = host.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const wide = rect.width >= 960;
  // The same framing as the live stage: right of the words when wide, above them when narrow.
  const cx = canvas.width * (wide ? 0.76 : 0.5);
  const cy = canvas.height * (wide ? 0.5 : 0.3);
  const scale = Math.min(canvas.width, canvas.height) / 7.8;
  const tilt = 0.5;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  const dot = (x: number, y: number, z: number, color: string, size: number) => {
    const ry = y * cos - z * sin;
    const rz = y * sin + z * cos;
    const depth = 7 / (7 + rz);
    // Nearer points are brighter, as in the live stage.
    context.globalAlpha = 0.22 + 0.5 * Math.min(1, Math.max(0, (depth - 0.74) / 0.78));
    context.fillStyle = color;
    context.beginPath();
    context.arc(cx + x * scale * depth, cy - ry * scale * depth, size * ratio, 0, TAU);
    context.fill();
  };
  const cool = style.getPropertyValue('--lx-pf-cool').trim() || '#7fd3e6';
  const edge = style.getPropertyValue('--lx-pf-edge').trim() || '#ffc978';
  for (let rail = 0; rail < 18; rail += 1) {
    const s = -MOBIUS.halfWidth + (2 * MOBIUS.halfWidth * rail) / 17;
    for (let k = 0; k < 260; k += 1) {
      const [x, y, z] = mobiusPoint((k / 260) * TAU, s);
      dot(x, y, z, rail === 0 || rail === 17 ? edge : cool, 1);
    }
  }
}
