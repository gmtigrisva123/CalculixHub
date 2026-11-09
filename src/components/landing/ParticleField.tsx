/**
 * Mathematics as light: the landing hero's particle stage, drawn with WebGL.
 *
 * A person thinking, in profile, turned towards the page's words. The face is
 * drawn by a warm line of light, the head by a soft volume of particles that
 * glows brightest at its rim, and the hair by strands that light runs along.
 * Where the mind is, seeds grow by the golden angle, a pulse passing out through
 * them now and then, and a few drift up out of the head as thoughts do. On first
 * paint the particles assemble out of a wide shell, and as the hero is scrolled
 * away the figure loosens and drifts.
 *
 * Every particle's motion is computed in the vertex shader from a handful of
 * stored numbers, so the CPU does no per-particle work after setup and the GPU
 * uploads nothing per frame.
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
import { figureLayout, KIND, MIND, mulberry32, risingPoint, seedPoint, type FigureCounts } from './particleShapes';

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
attribute vec4 aMeta;
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

const float TAU = 6.2831853;
const vec3 MIND = vec3(${MIND.x.toFixed(4)}, ${MIND.y.toFixed(4)}, ${MIND.z.toFixed(4)});

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float seed = aMeta.x;
  float path = aMeta.y;
  float light = aMeta.z;
  int kind = int(aMeta.w + 0.5);
  vec3 target = position;
  vec3 colour;
  float alpha;
  float size = 1.0;
  float glow = 0.0;
  float flare = 0.0;

  if (kind == ${KIND.outline}) {
    // The profile: warm, and a slow bead of light travelling down the face and back up.
    flare = 0.55 * pow(0.5 + 0.5 * cos((path - uTime * 0.035) * TAU), 60.0);
    colour = uEdge;
    alpha = 0.62 * light;
    size = 1.25;
    glow = 0.22;
  } else if (kind == ${KIND.surface}) {
    // Skin: barely breathing. Lit from the side the words are on, brightest at the rim.
    target += 0.006 * vec3(sin(uTime * 0.8 + seed * 40.0), cos(uTime * 0.7 + seed * 23.0), 0.0);
    float lamp = smoothstep(1.1, -1.2, target.x) * 0.7 + 0.3 * smoothstep(-1.4, 1.4, target.y);
    colour = mix(uCool, mix(uWarm, uEdge, 0.25), lamp * 0.55);
    alpha = 0.15 + 0.4 * light;
    size = 0.9 + 0.3 * light;
  } else if (kind == ${KIND.hair}) {
    // Hair: strands that sway a hair's breadth, with light running along them from brow to nape.
    target.x += 0.012 * sin(uTime * 0.6 + path * 7.0 + position.z * 4.0);
    target.y += 0.008 * cos(uTime * 0.5 + path * 5.0);
    flare = 0.6 * pow(0.5 + 0.5 * cos((path * 1.6 - uTime * 0.11 + position.z * 1.7) * TAU), 18.0);
    colour = mix(uWarm, uCool, 0.35 * (1.0 - light));
    alpha = 0.1 + 0.2 * light;
    size = 0.9;
    glow = 0.05;
  } else if (kind == ${KIND.feature}) {
    colour = uEdge;
    alpha = 0.5;
    size = 1.05;
    glow = 0.12;
  } else if (kind == ${KIND.seed}) {
    // Seed n at angle n·φ, radius ∝ √n; the flower turns slowly, and a pulse spreads out through it.
    float a = position.y + uTime * 0.05;
    float r = position.x;
    float v = r * sin(a);
    target = vec3(MIND.x + r * cos(a), MIND.y + v * 0.9, MIND.z + v * 0.42);
    flare = pow(0.5 + 0.5 * cos((path - uTime * 0.09) * TAU), 14.0);
    colour = mix(mix(uEdge, vec3(1.0, 0.96, 0.86), 0.5), uEdge, path);
    alpha = 0.6 - 0.22 * path;
    size = 1.05 - 0.3 * path;
    glow = 0.1;
    // The pulse brightens the seeds it passes rather than swelling them, so the spiral stays legible.
    flare *= 0.55;
  } else if (kind == ${KIND.rising}) {
    // Thoughts drift up out of the crown, each on its own loop, appearing and fading.
    float cycle = fract(uTime * 0.035 * position.z + path);
    target = vec3(
      MIND.x + position.x * (0.4 + cycle) + 0.12 * sin(position.y + cycle * 5.0),
      MIND.y + 0.45 + cycle * 1.5,
      MIND.z + 0.1 * cos(position.y + cycle * 4.0));
    colour = mix(uEdge, vec3(1.0), 0.35);
    alpha = 0.6 * sin(cycle * 3.14159);
    size = 1.1;
    glow = 0.3;
  } else {
    float theta = position.x + uTime * 0.018;
    float phi = position.y;
    float r = position.z;
    target = vec3(r * sin(phi) * cos(theta), r * cos(phi) * 0.55, r * sin(phi) * sin(theta));
    colour = mix(uCool, uWarm, hash(seed * 91.7));
    alpha = 0.26;
    size = 0.55 + seed * 0.75;
  }

  // Assembly out of a wide shell, each particle on its own delay.
  vec3 scatter = normalize(vec3(hash(seed * 13.13 + path) - 0.5, hash(seed * 7.71 + light) - 0.5, hash(seed * 3.37) - 0.5) + 1e-4);
  float t = clamp(uIntro * 1.5 - seed * 0.5, 0.0, 1.0);
  t = 1.0 - pow(1.0 - t, 3.0);
  vec3 p = mix(scatter * (5.5 + seed * 5.0), target, t);

  // Released as the hero scrolls away: the figure loosens outwards and lifts.
  p += scatter * uRelease * (0.4 + seed * 2.2);
  p.y += uRelease * (seed - 0.35) * 0.9;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Particles near the pointer lean away from it and brighten.
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uPointer;
  d.x *= uAspect;
  float near = uPointerPower * (1.0 - smoothstep(0.0, 0.3, length(d)));
  clip.xy += normalize(d + 1e-5) * near * 0.05 * clip.w;
  gl_Position = clip;

  // Depth: the near side is crisp and bright, the far side falls back into the dark.
  float near01 = clamp(0.5 + (uDist + mv.z) / 4.0, 0.0, 1.0);
  float depthFade = mix(0.7, 1.1, near01);
  // Now and then a particle catches the light, like a spark off a pencil's graphite.
  float spark = kind == ${KIND.dust} ? 0.0 : step(0.988, seed) * (0.5 + 0.5 * sin(uTime * (0.5 + seed * 1.3) + seed * 90.0));
  float twinkle = 0.76 + 0.24 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
  gl_PointSize = 1.9 * size * (mix(0.88, 1.08, near01) + near * 1.2 + flare * 0.9 + spark * 1.3) * uScale / -mv.z;

  vColor = colour * (0.85 + 0.3 * twinkle) + flare * 0.3 + spark * 0.4;
  vHalo = glow + flare * 0.25 + spark * 0.5;
  vAlpha = ((alpha + flare * 0.35) * depthFade * twinkle * t + near * 0.2) * (1.0 - uRelease * 0.7);
}`;

/*
 * A point is drawn at 1.9x its core size so there is room for a halo: a tight
 * bright core, and a wide faint bloom that — added up over the thousands of
 * points that overlap — makes the figure glow like light through paper.
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

/** How many particles each part of the figure gets, on a capable device and a modest one. */
const COUNTS: Record<'high' | 'low', FigureCounts> = {
  high: { outline: 2600, surface: 15000, hair: 12000, features: 760, seeds: 1400, rising: 220, dust: 1800 },
  low: { outline: 1500, surface: 7000, hair: 6000, features: 480, seeds: 900, rising: 120, dust: 700 },
};

/** The figure's resting turn towards the viewer, in radians, and how far it is lowered to sit centred. */
const TURN = 0.16;
const LIFT = -0.32;

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

    const layout = figureLayout(tier === 'low' ? COUNTS.low : COUNTS.high, rng);
    shuffleRecords(layout.count, rng, [{ data: layout.position, size: 3 }, { data: layout.meta, size: 4 }]);
    count = layout.count;
    geometry.setAttribute('position', new BufferAttribute(layout.position, 3));
    geometry.setAttribute('aMeta', new BufferAttribute(layout.meta, 4));
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
    points.position.y = LIFT;
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
      // Fit the figure's half-height across the narrower dimension, with a margin.
      const extent = 2.45;
      const share = wide ? 0.77 : 0.78;
      const fitHeight = extent / (tanHalf * share);
      const fitWidth = extent / (tanHalf * camera.aspect * share);
      camera.position.set(0, 0, Math.max(fitHeight, fitWidth) * (wide ? 1 : 1.04));
      camera.lookAt(0, 0, 0);
      uniforms.uDist.value = camera.position.z;
      // Wide: the figure sits right of the words, facing them; narrow: above them.
      if (wide) camera.setViewOffset(width, height, -width * 0.25, height * 0.02, width, height);
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
      targetYaw = pointerInside ? (x - 0.5) * 0.24 : 0;
      targetPitch = pointerInside ? (y - 0.5) * 0.12 : 0;
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
        yaw += (targetYaw - yaw) * settle(2.4);
        pitch += (targetPitch - pitch) * settle(2.4);
        pointerPower += ((pointerInside ? 1 : 0) - pointerPower) * settle(4);
      } else {
        intro = 1;
        pointerPower = 0;
      }

      uniforms.uIntro.value = intro;
      uniforms.uRelease.value = live.current.release?.get() ?? 0;
      // Turned a little towards the viewer, and turning a little more and back, slowly, as someone lost in thought.
      points.rotation.set(pitch, TURN + 0.07 * Math.sin(time * 0.21) + yaw, 0.03 * Math.sin(time * 0.13));
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

/** The same figure, drawn in 2D from the same angle. */
function drawFallback(canvas: HTMLCanvasElement, host: HTMLElement, style: CSSStyleDeclaration) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = host.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  const wide = rect.width >= 960;
  // The same framing as the live stage: right of the words when wide, above them when narrow.
  const cx = canvas.width * (wide ? 0.75 : 0.5);
  const cy = canvas.height * (wide ? 0.5 : 0.3);
  const scale = Math.min(canvas.width, canvas.height) / (wide ? 5.6 : 6.6);
  const cos = Math.cos(TURN);
  const sin = Math.sin(TURN);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  const cool = style.getPropertyValue('--lx-pf-cool').trim() || '#6fcde4';
  const warm = style.getPropertyValue('--lx-pf-warm').trim() || '#dcefe9';
  const edge = style.getPropertyValue('--lx-pf-edge').trim() || '#ffc56e';
  // A modest sample is enough for a still picture, and keeps the paint quick on the slow machines that get it.
  const layout = figureLayout(COUNTS.low, mulberry32(5));
  for (let i = 0; i < layout.count; i += 1) {
    let x = layout.position[i * 3];
    let y = layout.position[i * 3 + 1];
    let z = layout.position[i * 3 + 2];
    const path = layout.meta[i * 4 + 1];
    const light = layout.meta[i * 4 + 2];
    const kind = layout.meta[i * 4 + 3];
    let color = cool;
    let alpha = 0.15 + 0.4 * light;
    if (kind === KIND.outline || kind === KIND.feature) { color = edge; alpha = 0.6 * light; }
    else if (kind === KIND.hair) { color = warm; alpha = 0.1 + 0.2 * light; }
    else if (kind === KIND.seed) { [x, y, z] = seedPoint(x, y); color = edge; alpha = 0.55 - 0.2 * path; }
    else if (kind === KIND.rising) { [x, y, z] = risingPoint(x, y, path); color = edge; alpha = 0.6 * Math.sin(path * Math.PI); }
    else if (kind === KIND.dust) {
      const [theta, phi, r] = [x, y, z];
      [x, y, z] = [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.55, r * Math.sin(phi) * Math.sin(theta)];
      color = warm;
      alpha = 0.2;
    }
    // Turn about the vertical, as the live stage does, then project.
    const rx = x * cos + z * sin;
    const rz = -x * sin + z * cos;
    const depth = 7 / (7 - rz);
    context.globalAlpha = Math.max(0, Math.min(1, alpha));
    context.fillStyle = color;
    context.beginPath();
    context.arc(cx + rx * scale * depth, cy - (y + LIFT) * scale * depth, ratio * 0.9, 0, TAU);
    context.fill();
  }
}
