/**
 * The landing page's one WebGL stage.
 *
 * A single canvas, fixed over the page's grounds and under its type, draws
 * every scene's mathematics as light: one thread that is the Lorenz butterfly
 * in the hero, a line across the idea's sheet, the engine's belief curve, and
 * on through the page. The DOM keeps every word and every control; nothing a
 * reader must read or press is drawn here.
 *
 * How it stays cheap, and why each rule is here:
 *
 *   - One renderer, one canvas, one draw for the whole thread. Its particles
 *     never move on the CPU: the shape of each scene and the morph between
 *     two are uniforms, and every particle finds its own place on the GPU.
 *   - It renders only while something on it changes: the scroll moved, the
 *     pointer stirred the butterfly, a scene is flowing or settling. A still
 *     page costs nothing.
 *   - It follows the page clock (pageClock.ts), which runs Lenis first, so a
 *     frame of 3D is always drawn for the scroll position the DOM shows.
 *   - It never reads layout while scrolling: anchors are measured when the
 *     layout changes (stageLayout.ts) and moved by the scroll arithmetically.
 *   - The device pixel ratio is capped, small or low-core devices draw fewer
 *     particles, and the loop steps down through QUALITY when frames run long.
 *   - It stops while the tab is hidden. A software rasteriser never gets it;
 *     the DOM drawings stay instead (data-gl="off"). A lost context hands the
 *     page back to those drawings at once and takes over again on restore.
 *   - Shaders are compiled asynchronously in an idle moment before the first
 *     frame is shown, so no frame waits on a compile.
 */

import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, DataTexture, FloatType, Matrix4, NearestFilter, OneFactor,
  OneMinusSrcAlphaFactor, PerspectiveCamera, Points, RGBAFormat, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderer,
} from 'three';
import { PRIORITY, onTick, wake, type Tick } from './pageClock';
import { onMeasure } from './stageLayout';
import { COUNTS, QUALITY, deviceTier, isSoftwareRenderer, shuffleRecords } from './ParticleField';
import { flowLayout, lorenzPath, mulberry32 } from './particleShapes';
import { DATA_ROWS, PATH_LENGTH, PATH_WIDTH, SHAPE, STAGE_COMMON, THREAD_FRAGMENT, THREAD_VERTEX } from './threadShaders';
import { POLY_SAMPLES, cssColorToSrgb } from './threadShapes';
import { createScenes } from './threadRegistry';
import { createExtras } from './threadExtras';
import type { Extra, InkRect, Leg, Slot, StageFrame, ThreadScene, TimelineState } from './threadTypes';

/** The stage's field of view. The camera stands where a 30° lens sees exactly the viewport at z = 0. */
const FOV = 30;

export interface StageOptions {
  /** The fixed layer the canvas is placed in. */
  host: HTMLElement;
  /** Reduced motion: nothing moves on its own. */
  still: boolean;
  /** The first frame has been drawn. */
  onReady: () => void;
  /** No usable WebGL (or it was lost): the page keeps its DOM drawings. */
  onFail: () => void;
  /** A lost context came back. */
  onRestore: () => void;
}

function makeSlot(): Slot {
  return {
    shape: SHAPE.none,
    matrix: new Matrix4(),
    p: [new Vector4(), new Vector4(), new Vector4()],
    look: new Vector4(2, 1, 1, 0),
    clip: new Vector4(),
    shade: new Vector4(0, 2, 0, 0),
    occ: [new Vector4(), new Vector4(), new Vector4(), new Vector4()],
    occR: new Vector4(),
    data: null,
    flowing: false,
    pointer: 0,
    pointerRadius: 150,
  };
}

const srgb = (style: CSSStyleDeclaration, name: string, fallback: [number, number, number]) =>
  new Vector3(...cssColorToSrgb(style.getPropertyValue(name), fallback));

export function startThreadStage({ host, still, onReady, onFail, onRestore }: StageOptions): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = 'lx-thread-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let cw = host.clientWidth || window.innerWidth;
  let ch = host.clientHeight || window.innerHeight;
  const tier = deviceTier(cw);
  const deviceRatio = window.devicePixelRatio || 1;

  let renderer: WebGLRenderer | null = null;
  try {
    renderer = new WebGLRenderer({
      canvas,
      // Points are soft sprites and need no multisampling; the few meshes do, where pixels are large.
      antialias: tier === 'high' && deviceRatio < 1.5,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    if (isSoftwareRenderer(renderer)) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
  } catch {
    renderer = null;
  }
  if (!renderer) {
    canvas.remove();
    onFail();
    return () => {};
  }
  const gl = renderer;
  const maxRatio = Math.min(deviceRatio, tier === 'low' ? 1.5 : 2);
  gl.setPixelRatio(maxRatio);
  gl.setClearColor(0x000000, 0);
  gl.autoClear = true;

  const style = getComputedStyle(host.closest('.lx') ?? document.documentElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 1, 20000);
  let camDist = 1;
  // Something changed that the next frame must draw, whatever else is moving.
  let dirty = true;

  // --- The thread -----------------------------------------------------------
  const rng = mulberry32(5);
  const counts = tier === 'low' ? COUNTS.low : COUNTS.high;
  const layout = flowLayout(counts.threads, counts.dust, rng);
  shuffleRecords(layout.count, rng, [{ data: layout.params, size: 4 }, { data: layout.offsets, size: 3 }]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('aParam', new BufferAttribute(layout.params, 4));
  geometry.setAttribute('aOffset', new BufferAttribute(layout.offsets, 3));
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(layout.count * 3), 3));

  const path = new DataTexture(lorenzPath(PATH_LENGTH).samples, PATH_WIDTH, PATH_LENGTH / PATH_WIDTH, RGBAFormat, FloatType);
  path.minFilter = NearestFilter;
  path.magFilter = NearestFilter;
  path.needsUpdate = true;
  const shapeData = new Float32Array(POLY_SAMPLES * DATA_ROWS * 4);
  const data = new DataTexture(shapeData, POLY_SAMPLES, DATA_ROWS, RGBAFormat, FloatType);
  data.minFilter = NearestFilter;
  data.magFilter = NearestFilter;
  data.needsUpdate = true;

  const slotA = makeSlot();
  const slotB = makeSlot();
  const zero4 = () => [new Vector4(), new Vector4(), new Vector4(), new Vector4()];
  const uniforms = {
    uView: { value: new Vector2(cw, ch) },
    uPath: { value: path },
    uData: { value: data },
    uTime: { value: 0 },
    uCount: { value: layout.count },
    uDpr: { value: maxRatio },
    uCamDist: { value: 1 },
    uShapeA: { value: 0 },
    uShapeB: { value: 0 },
    uMatA: { value: slotA.matrix },
    uMatB: { value: slotB.matrix },
    uPA: { value: slotA.p },
    uPB: { value: slotB.p },
    uLookA: { value: slotA.look },
    uLookB: { value: slotB.look },
    uClipA: { value: slotA.clip },
    uClipB: { value: slotB.clip },
    uShadeA: { value: slotA.shade },
    uShadeB: { value: slotB.shade },
    uOccA: { value: slotA.occ },
    uOccB: { value: slotB.occ },
    uOccRA: { value: slotA.occR },
    uOccRB: { value: slotB.occR },
    uMorph: { value: 0 },
    uMorphLook: { value: new Vector4() },
    uGround: { value: zero4() },
    uGroundR: { value: new Vector4() },
    uPointer: { value: new Vector2(-9999, -9999) },
    uPointerPower: { value: 0 },
    uPointerRadius: { value: 150 },
    uCool: { value: srgb(style, '--lx-pf-cool', [0.44, 0.8, 0.89]) },
    uWarm: { value: srgb(style, '--lx-pf-warm', [0.86, 0.94, 0.91]) },
    uEdge: { value: srgb(style, '--lx-pf-edge', [1, 0.77, 0.43]) },
    uChalk: { value: new Vector3(0.93, 0.95, 0.94) },
    uInk: { value: srgb(style, '--lx-accent', [0.11, 0.38, 0.5]) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: STAGE_COMMON + THREAD_VERTEX,
    fragmentShader: THREAD_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  // --- Scenes, legs, extras ----------------------------------------------------
  const scenes = createScenes();
  const byId = new Map<string, ThreadScene>(scenes.list.map(entry => [entry.id, entry]));
  const legs: Leg[] = scenes.legs;
  const extras: Extra[] = createExtras(scenes, style, still);
  for (const extra of extras) scene.add(extra.object);
  const stopMeasure = onMeasure(() => {
    for (const entry of scenes.list) entry.measure();
    dirty = true;
  });

  // --- Sizing -------------------------------------------------------------------
  const resize = () => {
    cw = Math.max(1, host.clientWidth);
    ch = Math.max(1, host.clientHeight);
    gl.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camDist = ch / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.position.set(0, 0, camDist);
    camera.near = Math.max(1, camDist * 0.05);
    camera.far = camDist * 4;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    uniforms.uView.value.set(cw, ch);
    uniforms.uCamDist.value = camDist;
    uniforms.uDpr.value = gl.getPixelRatio();
    dirty = true;
    wake();
  };

  // --- Quality ------------------------------------------------------------------
  // Frame times are sampled while the stage animates; a device that cannot hold
  // ~30 fps steps down, and one that still cannot stops animating on its own.
  let quality = 0;
  let throttled = false;
  const samples: number[] = [];
  let lastFrameAt = 0;
  const applyQuality = () => {
    geometry.setDrawRange(0, Math.round(layout.count * QUALITY[quality].share));
    gl.setPixelRatio(Math.min(maxRatio, QUALITY[quality].ratio));
    resize();
  };
  const sampleFrame = (now: number) => {
    const gap = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;
    if (!gap || gap > 400) return;
    samples.push(gap);
    if (samples.length < 50) return;
    const median = samples.slice(20).sort((a, b) => a - b)[15];
    samples.length = 0;
    if (median > 34 && quality < QUALITY.length - 1) {
      quality += 1;
      applyQuality();
    } else if (median > 40) {
      throttled = true;
    }
  };

  // --- Pointer -------------------------------------------------------------------
  const pointer = { x: -9999, y: -9999, active: false };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    if (hasPointerScene) wake();
  };
  const onPointerLeave = () => { pointer.active = false; wake(); };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  let hasPointerScene = false;

  // --- The timeline ----------------------------------------------------------------
  const timeline: TimelineState = { a: 'hero', b: 'hero', morph: 0 };
  const arrivals = new Map(legs.map(leg => [leg.to, leg]));
  /**
   * Which scene holds the thread at this scroll position, and how far it is
   * on its way to the next. Legs are walked in page order; each must start
   * no earlier than the last one ended, so the thread is never in two
   * journeys at once and scrolling back retraces it exactly.
   */
  const evaluate = (frame: StageFrame) => {
    const present = scenes.list.filter(entry => entry.present());
    let current = present[0]?.id ?? 'hero';
    timeline.a = current;
    timeline.b = current;
    timeline.morph = 0;
    let floor = -Infinity;
    for (let i = 1; i < present.length; i += 1) {
      const leg = arrivals.get(present[i].id);
      const window = leg?.window(frame);
      if (!leg || !window) continue;
      const start = Math.max(window[0], floor);
      const end = Math.max(window[1], start + 1);
      floor = end;
      if (frame.y < start) break;
      if (frame.y <= end) {
        timeline.a = current;
        timeline.b = leg.to;
        timeline.morph = (frame.y - start) / (end - start);
        return leg;
      }
      current = leg.to;
      timeline.a = current;
      timeline.b = current;
    }
    return null;
  };

  const writeSlot = (target: Slot, row: number, id: string, frame: StageFrame) => {
    const owner = byId.get(id);
    if (!owner) return;
    owner.slot(frame, target, row);
    if (target.data) {
      shapeData.set(target.data.subarray(0, POLY_SAMPLES * 4), row * POLY_SAMPLES * 4);
      data.needsUpdate = true;
    }
  };

  const inkRects: InkRect[] = [];
  const writeGround = (frame: StageFrame) => {
    inkRects.length = 0;
    for (const entry of scenes.list) entry.ink?.(frame, inkRects);
    const visible = inkRects.filter(rect => rect.y < frame.ch && rect.y + rect.h > 0 && rect.w > 0 && rect.h > 0);
    for (let i = 0; i < 4; i += 1) {
      const rect = visible[i];
      uniforms.uGround.value[i].set(rect ? rect.x : 0, rect ? rect.y : 0, rect ? rect.w : 0, rect ? rect.h : 0);
      uniforms.uGroundR.value.setComponent(i, rect ? rect.r : 0);
    }
  };

  // --- The frame -------------------------------------------------------------------------
  let time = 0;
  let firstFrame = 0;
  let visible = !document.hidden;
  let lost = false;
  let ready = false;
  let alive = true;
  const frame: StageFrame = { y: 0, vy: 0, vw: 1, vh: 1, cw, ch, dpr: maxRatio, time: 0, dt: 0, now: 0, still, pointer };

  const draw = (tick: Tick): boolean => {
    if (!alive || lost || !visible || !ready) return false;
    const quiet = still || throttled;
    if (!quiet) sampleFrame(tick.now);
    if (!quiet) time += tick.dt;
    if (!firstFrame) firstFrame = tick.now;

    frame.y = tick.y;
    frame.vy = tick.vy;
    frame.vw = tick.vw;
    frame.vh = tick.vh;
    frame.cw = cw;
    frame.ch = ch;
    frame.dpr = gl.getPixelRatio();
    frame.time = time;
    frame.dt = quiet ? 0 : tick.dt;
    frame.now = tick.now;

    const leg = evaluate(frame);
    writeSlot(slotA, 0, timeline.a, frame);
    const morphing = timeline.morph > 0 && timeline.a !== timeline.b;
    if (morphing) writeSlot(slotB, 1, timeline.b, frame);
    uniforms.uShapeA.value = slotA.shape;
    uniforms.uShapeB.value = morphing ? slotB.shape : 0;
    uniforms.uMorph.value = morphing ? timeline.morph : 0;
    if (leg) uniforms.uMorphLook.value.set(leg.stagger, leg.orderByU, still ? 0 : leg.swirl, still ? 0 : leg.lift);
    uniforms.uTime.value = time;
    writeGround(frame);

    const power = slotA.pointer * (1 - timeline.morph);
    hasPointerScene = slotA.pointer > 0 || (scenes.hero.present() && timeline.a === 'hero');
    uniforms.uPointer.value.set(pointer.x, pointer.y);
    uniforms.uPointerPower.value = power;
    uniforms.uPointerRadius.value = slotA.pointerRadius;

    let animating = (slotA.flowing || (morphing && slotB.flowing)) && !quiet;
    if (scenes.hero.settling(frame) && timeline.a === 'hero') animating = true;
    for (const extra of extras) {
      if (extra.update(frame, timeline)) animating = true;
    }

    if (dirty || tick.dy !== 0 || animating || power > 0.001) {
      gl.render(scene, camera);
      dirty = false;
    }
    return animating && !throttled;
  };
  const stopTick = onTick(draw, PRIORITY.stage);
  // Development only: the stage's state, for checking a scene from the console or a test run.
  if (import.meta.env.DEV) (window as unknown as { __lxStage?: unknown }).__lxStage = { timeline, slotA, slotB, frame, uniforms, scenes };

  // --- Lifecycle ----------------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const onVisibility = () => {
    visible = !document.hidden;
    lastFrameAt = 0;
    if (visible) { dirty = true; wake(); }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    // Hand the page back to its DOM drawings at once: never a blank stage.
    onFail();
  };
  const onRestored = () => {
    lost = false;
    path.needsUpdate = true;
    data.needsUpdate = true;
    dirty = true;
    resize();
    onRestore();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  resize();
  // Compile every program while nothing on screen is moving, then show the first frame.
  const hidden = scene.children.filter(child => !child.visible);
  for (const child of hidden) child.visible = true;
  const compiled = typeof gl.compileAsync === 'function' ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera));
  void Promise.resolve(compiled).catch(() => undefined).then(() => {
    for (const child of hidden) child.visible = false;
    if (!alive) return;
    ready = true;
    dirty = true;
    wake();
    requestAnimationFrame(() => { if (alive && !lost) onReady(); });
  });

  return () => {
    alive = false;
    stopTick();
    stopMeasure();
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    for (const extra of extras) extra.dispose();
    geometry.dispose();
    material.dispose();
    path.dispose();
    data.dispose();
    gl.dispose();
    gl.forceContextLoss();
    canvas.remove();
  };
}
