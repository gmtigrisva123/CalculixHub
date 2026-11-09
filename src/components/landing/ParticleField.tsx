/**
 * Mathematics as light: the landing hero's particle stage, drawn with WebGL.
 *
 * Threads of light flow along the Lorenz attractor — the butterfly of chaos
 * theory, one path looping round two wings for ever without crossing itself.
 * Where the path runs fast, crossing from wing to wing, it burns warm; where it
 * slows in the eye of a wing it cools. On first paint the particles assemble out
 * of a wide shell, and as the hero is scrolled away the form loosens and drifts.
 *
 * The path is integrated once on the CPU and handed to the GPU as a texture;
 * every particle then finds its own place along it in the vertex shader, so
 * the CPU does no per-particle work after setup and nothing is uploaded per frame.
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
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, DataTexture, FloatType, NearestFilter, PerspectiveCamera,
  Points, RGBAFormat, Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';
import { flowLayout, lorenzPath, mulberry32, pathPoint } from './particleShapes';

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

/** Samples along the path, and the width of the texture that holds them. */
const PATH_LENGTH = 16384;
const PATH_WIDTH = 1024;

const VERTEX = /* glsl */ `
attribute vec4 aParam;
attribute vec3 aOffset;
uniform sampler2D uPath;
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

const float LENGTH = ${PATH_LENGTH.toFixed(1)};
const float WIDTH = ${PATH_WIDTH.toFixed(1)};
const float ROWS = ${(PATH_LENGTH / PATH_WIDTH).toFixed(1)};

vec4 pathAt(float i) {
  return texture2D(uPath, vec2((mod(i, WIDTH) + 0.5) / WIDTH, (floor(i / WIDTH) + 0.5) / ROWS));
}

// The path at a fractional sample index, between its two neighbours.
vec4 along(float at) {
  float i = floor(at);
  return mix(pathAt(i), pathAt(min(i + 1.0, LENGTH - 1.0)), at - i);
}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float seed = abs(aParam.w);
  bool dust = aParam.w < 0.0;
  vec3 target;
  vec3 colour;
  float alpha;
  float size;
  float fast = 0.0;
  float crest = 0.0;
  float ends = 1.0;
  if (!dust) {
    seed = aParam.z;
    // Each thread slides along the path at its own pace; the whole path takes a few minutes to travel.
    float u = fract(aParam.x + uTime * 0.0075 * aParam.y);
    vec4 here = along(u * (LENGTH - 1.0));
    fast = here.w;
    // The path's two ends are far apart, so a thread fades out at one and in at the other.
    ends = smoothstep(0.0, 0.01, u) * smoothstep(1.0, 0.99, u);
    // Fibres stray from the centre line, and stray a little further where the path slows and spreads.
    float stray = aParam.w * (1.2 - 0.5 * fast) * (1.0 + 0.25 * sin(uTime * 0.6 + seed * 50.0));
    target = here.xyz + aOffset * stray;
    // The two wings take different light: one cool, one pale; the crossing between them burns warm.
    float wing = smoothstep(-0.9, 0.9, here.x);
    colour = mix(uCool, uWarm, wing * 0.7);
    colour = mix(colour, uEdge, smoothstep(0.55, 0.95, fast) * 0.85);
    // A slow crest of light travels the path ahead of the flow.
    crest = pow(0.5 + 0.5 * cos((u * 9.0 - uTime * 0.05) * 6.2831853), 30.0);
    alpha = 0.3 + 0.16 * fast;
    size = 0.7 + 0.4 * smoothstep(0.6, 1.0, fast);
  } else {
    float theta = aParam.x + uTime * 0.018;
    float phi = aParam.y;
    float r = aParam.z;
    target = vec3(r * sin(phi) * cos(theta), r * cos(phi) * 0.6, r * sin(phi) * sin(theta));
    colour = mix(uCool, uWarm, hash(seed * 91.7));
    alpha = 0.26;
    size = 0.55 + seed * 0.75;
  }

  // The whole form breathes, very slightly, as something alive would.
  target *= 1.0 + 0.01 * sin(uTime * 0.55);

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
  clip.xy += normalize(d + 1e-5) * near * 0.05 * clip.w;
  gl_Position = clip;

  // Depth: the near side of the form is crisp and bright, the far side falls back into the dark.
  float near01 = clamp(0.5 + (uDist + mv.z) / 4.0, 0.0, 1.0);
  float depthFade = mix(0.6, 1.12, near01);
  // Now and then a particle catches the light and flares, like a spark off a pencil's graphite.
  float spark = dust ? 0.0 : step(0.988, seed) * (0.5 + 0.5 * sin(uTime * (0.5 + seed * 1.3) + seed * 90.0));
  float twinkle = 0.76 + 0.24 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
  gl_PointSize = 1.9 * size * (mix(0.86, 1.1, near01) + near * 1.2 + crest * 0.8 + spark * 1.3) * uScale / -mv.z;

  vColor = colour * (0.85 + 0.3 * twinkle) + crest * 0.3 + spark * 0.4;
  vHalo = dust ? 0.0 : 0.08 + 0.14 * fast + crest * 0.25 + spark * 0.5;
  vAlpha = ((alpha + crest * 0.3) * ends * depthFade * twinkle * t + near * 0.2) * (1.0 - uRelease * 0.7);
}`;

/*
 * A point is drawn at 1.9x its core size so there is room for a halo: a tight
 * bright core, and a wide faint bloom that — added up over the thousands of
 * points that overlap — makes the form glow like light through paper.
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

/** Threads along the path and loose dust, on a capable device and a modest one. */
const COUNTS = { high: { threads: 46000, dust: 1800 }, low: { threads: 20000, dust: 700 } } as const;

/** The form's resting tilt towards the viewer and turn about its height, in radians: the wings open, never edge-on. */
const TILT = 0.22;
const TURN = 0.36;

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

    const counts = tier === 'low' ? COUNTS.low : COUNTS.high;
    const layout = flowLayout(counts.threads, counts.dust, rng);
    shuffleRecords(layout.count, rng, [{ data: layout.params, size: 4 }, { data: layout.offsets, size: 3 }]);
    count = layout.count;
    geometry.setAttribute('aParam', new BufferAttribute(layout.params, 4));
    geometry.setAttribute('aOffset', new BufferAttribute(layout.offsets, 3));
    // three needs a position attribute to know how many vertices to draw.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(layout.count * 3), 3));
    const path = new DataTexture(lorenzPath(PATH_LENGTH).samples, PATH_WIDTH, PATH_LENGTH / PATH_WIDTH, RGBAFormat, FloatType);
    path.minFilter = NearestFilter;
    path.magFilter = NearestFilter;
    path.needsUpdate = true;
    material = new ShaderMaterial({
      uniforms: {
        uPath: { value: path }, uTime: { value: 0 }, uIntro: { value: still ? 1 : 0 }, uRelease: { value: 0 }, uScale: { value: 1 }, uDist: { value: 10 },
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
      // Fit the form's half-height across the narrower dimension, with a margin.
      const extent = 2.75;
      const share = wide ? 0.77 : 0.78;
      const fitHeight = extent / (tanHalf * share);
      const fitWidth = extent / (tanHalf * camera.aspect * share);
      camera.position.set(0, 0, Math.max(fitHeight, fitWidth) * (wide ? 1 : 1.04));
      camera.lookAt(0, 0, 0);
      uniforms.uDist.value = camera.position.z;
      // Wide: the form sits right of the words; narrow: above them.
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
      // The butterfly sways slowly about its height, so its two wings show their depth without ever turning edge-on.
      points.rotation.set(TILT + pitch, TURN + 0.28 * Math.sin(time * 0.09) + yaw, 0.04);
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
      path.dispose();
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

/** The same form, drawn in 2D from the same angle. */
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
  const scale = Math.min(canvas.width, canvas.height) / (wide ? 6.4 : 7.4);
  const [cosY, sinY] = [Math.cos(TURN), Math.sin(TURN)];
  const [cosX, sinX] = [Math.cos(TILT), Math.sin(TILT)];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'lighter';
  const cool = style.getPropertyValue('--lx-pf-cool').trim() || '#6fcde4';
  const warm = style.getPropertyValue('--lx-pf-warm').trim() || '#dcefe9';
  const edge = style.getPropertyValue('--lx-pf-edge').trim() || '#ffc56e';
  const path = lorenzPath(PATH_LENGTH);
  const rng = mulberry32(5);
  for (let k = 0; k < 9000; k += 1) {
    const [x0, y0, z0, fast] = pathPoint(path, rng() * (path.length - 1));
    // Turn about the vertical, then tip towards the viewer, as the live stage does.
    const x = x0 * cosY + z0 * sinY;
    const z1 = -x0 * sinY + z0 * cosY;
    const y = y0 * cosX - z1 * sinX;
    const z = y0 * sinX + z1 * cosX;
    const depth = 7 / (7 - z);
    context.globalAlpha = 0.3 + 0.3 * fast;
    context.fillStyle = fast > 0.7 ? edge : x0 > 0 ? warm : cool;
    context.beginPath();
    context.arc(cx + x * scale * depth, cy - y * scale * depth, ratio * 0.8, 0, TAU);
    context.fill();
  }
}
