/**
 * The MacBook preview's stage: a 16-inch MacBook Pro built from primitives, and
 * a camera that moves between named shots as the page is scrolled.
 *
 * The laptop's display is not a texture. It is a live DOM element (the app, in
 * an iframe) placed in the same 3D space by CSS3DRenderer and seen through a
 * hole the WebGL canvas leaves where the panel is. The canvas sits on top, so
 * the lid, the hinge and anything else in front still cover the page correctly.
 *
 * Everything is measured in centimetres, from Apple's published dimensions.
 * Named three.js imports only, the pixel ratio capped, and nothing is drawn
 * unless the camera, the lid or the size of the stage has changed.
 */

import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, CanvasTexture, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, NoBlending, PCFSoftShadowMap, Path, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, RepeatWrapping, Scene, ShadowMaterial, Shape, ShapeGeometry, SRGBColorSpace, Vector3,
  WebGLRenderer, type BufferGeometry, type Material,
} from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One camera position. Angles in degrees; distances in centimetres. */
export interface Shot {
  /** Around the laptop: 0 is straight in front, 90 its right side, 180 behind. */
  az: number;
  /** Above the desk. */
  el: number;
  dist: number;
  target: [number, number, number];
  /** How far the lid is open: 0 shut, 90 upright. */
  lid: number;
  /** Where the laptop sits in the frame, in half-frames: 0 centred, +1 the right or top edge. */
  shift: [number, number];
  /** The same, for a frame taller than it is wide. */
  shiftTall: [number, number];
  /** Half the laptop's width as this shot sees it, in centimetres. It must fit in the part of the frame the words leave free. */
  span: number;
  /** Half the width that must stay in a tall frame, margins included. */
  spanTall: number;
  /** 0–1: how strongly the shortcut keys are lit. */
  keys?: number;
}

export interface StageHandle {
  /** The scroll position, in shots: 1.5 is half-way from the second shot to the third. */
  setProgress(p: number): void;
  dispose(): void;
}

/* Apple's figures for the 16-inch model: 35.55 wide, 24.42 deep, 1.60 tall when shut. */
const W = 35.55;
const D = 24.42;
const BASE_T = 1.08;
const LID_T = 0.46;
const GAP = 0.06;
/* The 16.3-inch panel, 3472 by 2266. */
export const SCREEN_PX = { w: 1736, h: 1133 };
const SCREEN_W = 34.67;
const SCREEN_H = SCREEN_W * (SCREEN_PX.h / SCREEN_PX.w);
const SCREEN_Y = D - 0.52 - SCREEN_H / 2;
const PIVOT = new Vector3(0, GAP, -D / 2 + 0.22);
const FOV = 28;
const RAD = Math.PI / 180;

/** The middle of the display, in the world, for a given lid angle. */
export function screenCentre(lid: number): [number, number, number] {
  const tilt = (lid - 90) * RAD;
  return [0, PIVOT.y + SCREEN_Y * Math.cos(tilt), PIVOT.z - SCREEN_Y * Math.sin(tilt)];
}

function roundedRect(target: Shape | Path, w: number, h: number, r: number, cx = 0, cy = 0) {
  const x = cx - w / 2, y = cy - h / 2;
  target.moveTo(x + r, y);
  target.lineTo(x + w - r, y); target.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  target.lineTo(x + w, y + h - r); target.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  target.lineTo(x + r, y + h); target.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(x, y + r); target.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}

/** A slab with rounded corners in plan and softened edges, w by h, t thick, extruded along +Z from 0. */
function slab(w: number, h: number, t: number, r: number, bevel: number, curve = 14): BufferGeometry {
  const shape = roundedRect(new Shape(), w - bevel * 2, h - bevel * 2, r - bevel) as Shape;
  const g = new ExtrudeGeometry(shape, { depth: t - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: curve });
  g.translate(0, 0, bevel);
  return g;
}

/* The keyboard: every key as [width in key units, legend]. Rows run back to front. */
type Key = { x: number; z: number; w: number; d: number; label: string; id?: string };
const U = 1.86;
const KEY_GAP = 0.26;
const ROWS: Array<Array<[number, string, string?]>> = [
  [[1.5, 'esc'], ...Array.from({ length: 12 }, (_, i): [number, string] => [1, `F${i + 1}`]), [1, '']],
  [[1, '`'], ...'1234567890-='.split('').map((c): [number, string] => [1, c]), [1.5, 'delete']],
  [[1.5, 'tab'], ...'QWERTYUIOP[]'.split('').map((c): [number, string] => [1, c]), [1, '\\']],
  [[1.75, 'caps lock'], ...'ASDFGHJKL;\''.split('').map((c): [number, string, string?] => [1, c, c === 'K' ? 'k' : undefined]), [1.75, 'return']],
  [[2.25, 'shift'], ...'ZXCVBNM,./'.split('').map((c): [number, string] => [1, c]), [2.25, 'shift']],
  [[1, 'fn'], [1, '⌃'], [1, '⌥'], [1.25, '⌘', 'cmd'], [5, ''], [1.25, '⌘'], [1, '⌥']],
];
const KB_W = 14.5 * U;
const KB_D = 6 * U;
const KB_Z = -D / 2 + 1.55 + KB_D / 2;

function keyboard(): Key[] {
  const keys: Key[] = [];
  ROWS.forEach((row, r) => {
    let x = -KB_W / 2;
    const z = KB_Z - KB_D / 2 + (r + 0.5) * U;
    for (const [w, label, id] of row) {
      keys.push({ x: x + (w * U) / 2, z, w: w * U - KEY_GAP, d: U - KEY_GAP, label, id });
      x += w * U;
    }
    if (r === 5) {
      /* The arrow cluster: left and right at half height, up over down between them. */
      const half = (U - KEY_GAP) / 2 - 0.04;
      const low = z + (U - KEY_GAP) / 4 + 0.02, high = z - (U - KEY_GAP) / 4 - 0.02;
      keys.push({ x: x + U * 0.5, z: low, w: U - KEY_GAP, d: half, label: '◀' });
      keys.push({ x: x + U * 1.5, z: high, w: U - KEY_GAP, d: half, label: '▲' });
      keys.push({ x: x + U * 1.5, z: low, w: U - KEY_GAP, d: half, label: '▼' });
      keys.push({ x: x + U * 2.5, z: low, w: U - KEY_GAP, d: half, label: '▶' });
    }
  });
  return keys;
}

/** The legends, drawn once onto a sheet that lies over the key tops. */
function legends(keys: Key[], lit: boolean): CanvasTexture {
  const px = 76;
  const c = document.createElement('canvas');
  c.width = Math.round((KB_W + 0.4) * px); c.height = Math.round((KB_D + 0.4) * px);
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of keys) {
    const cx = k.x * px, cy = (k.z - KB_Z) * px;
    if (lit) {
      if (!k.id) continue;
      const w = k.w * px, h = k.d * px, r = 0.2 * px;
      g.fillStyle = '#e9bd6c';
      g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, r); g.fill();
      g.fillStyle = '#1b1407';
    } else {
      if (k.id) continue;
      g.fillStyle = '#e8ecee';
    }
    const word = k.label.length > 1 && !/^F\d+$/.test(k.label);
    const small = /^F\d+$/.test(k.label) || '◀▲▼▶'.includes(k.label);
    g.font = `${lit ? 600 : 500} ${Math.round((word ? 0.3 : small ? 0.3 : 0.52) * px)}px 'Geist', -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    if (word) {
      const left = ['esc', 'tab', 'caps lock', 'shift', 'fn'].includes(k.label) && k.x < 0;
      g.textAlign = left ? 'left' : 'right';
      g.fillText(k.label, cx + (left ? -1 : 1) * (k.w / 2 - 0.22) * px, cy + (k.d / 2 - 0.34) * px);
      g.textAlign = 'center';
    } else {
      g.fillText(k.label, cx, cy + 0.02 * px);
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function speakerDots(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  for (const [x, y] of [[8, 8], [24, 24]]) { g.beginPath(); g.arc(x, y, 4.4, 0, Math.PI * 2); g.fill(); }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function spill(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  const down = g.createLinearGradient(0, 0, 0, 256);
  down.addColorStop(0, 'rgba(214,228,236,1)'); down.addColorStop(0.35, 'rgba(214,228,236,.38)'); down.addColorStop(0.8, 'rgba(214,228,236,0)');
  g.fillStyle = down; g.fillRect(0, 0, 64, 256);
  /* Fade the two short edges so the sheet has no outline. */
  g.globalCompositeOperation = 'destination-in';
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.2, '#000'); across.addColorStop(0.8, '#000'); across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across; g.fillRect(0, 0, 64, 256);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

function lightPool(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(150,190,200,.34)'); grad.addColorStop(0.45, 'rgba(120,160,172,.12)'); grad.addColorStop(1, 'rgba(120,160,172,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

function buildLaptop(screen: HTMLElement) {
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  /* Space Black: anodised aluminium, dark and slightly warm. */
  const body = keep(new MeshStandardMaterial({ color: 0x26272b, metalness: 0.78, roughness: 0.46, envMapIntensity: 0.8 }));
  const well = keep(new MeshStandardMaterial({ color: 0x08090a, metalness: 0.2, roughness: 0.7 }));
  const keycap = keep(new MeshStandardMaterial({ color: 0x17181b, metalness: 0, roughness: 0.52 }));
  const glass = keep(new MeshStandardMaterial({ color: 0x030304, metalness: 0, roughness: 0.22, envMapIntensity: 0.6 }));
  const pad = keep(new MeshStandardMaterial({ color: 0x232428, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.75 }));
  const dark = keep(new MeshStandardMaterial({ color: 0x050506, metalness: 0.3, roughness: 0.6 }));

  const laptop = new Group();
  const mesh = (g: BufferGeometry, m: Material, shadow = false) => {
    const o = new Mesh(keep(g), m);
    o.castShadow = shadow; o.receiveShadow = true;
    return o;
  };
  /* Lay a flat shape on the deck, facing up. */
  const onDeck = (g: BufferGeometry, y: number) => g.rotateX(-Math.PI / 2).translate(0, y, 0);

  /* Base */
  const base = mesh(slab(W, D, BASE_T, 1.15, 0.16).rotateX(-Math.PI / 2).translate(0, -BASE_T, 0), body, true);
  laptop.add(base);

  /* Keyboard well, keys, and their legends */
  const keys = keyboard();
  laptop.add(mesh(onDeck(new ShapeGeometry(roundedRect(new Shape(), KB_W + 0.5, KB_D + 0.5, 0.5, 0, -KB_Z) as Shape, 10), 0.004), well));
  const caps = keys.map(k => slab(k.w, k.d, 0.11, 0.2, 0.025, 4).rotateX(-Math.PI / 2).translate(k.x, 0.004, k.z));
  const capMesh = mesh(mergeGeometries(caps), keycap);
  caps.forEach(g => g.dispose());
  laptop.add(capMesh);
  const sheet = (lit: boolean) => {
    const m = keep(new MeshBasicMaterial({ map: keep(legends(keys, lit)), transparent: true, depthWrite: false, toneMapped: false, opacity: lit ? 0 : 0.82 }));
    const o = new Mesh(keep(new PlaneGeometry(KB_W + 0.4, KB_D + 0.4).rotateX(-Math.PI / 2).translate(0, 0.12, KB_Z)), m);
    laptop.add(o);
    return m;
  };
  sheet(false);
  const litKeys = sheet(true);

  /* Speaker grilles either side of the keyboard */
  const dots = keep(speakerDots());
  const grilleW = 2.3, grilleX = KB_W / 2 + 0.25 + (W / 2 - KB_W / 2 - 0.25) / 2;
  dots.repeat.set(grilleW / 0.34, KB_D / 0.34);
  const grille = keep(new MeshBasicMaterial({ map: dots, transparent: true, opacity: 0.7, depthWrite: false }));
  for (const side of [-1, 1]) {
    laptop.add(new Mesh(keep(new PlaneGeometry(grilleW, KB_D - 0.2).rotateX(-Math.PI / 2).translate(side * grilleX, 0.004, KB_Z)), grille));
  }

  /* Trackpad */
  const padD = 9.5, padZ = KB_Z + KB_D / 2 + 1.0 + padD / 2;
  laptop.add(mesh(onDeck(new ShapeGeometry(roundedRect(new Shape(), 15.7, padD + 0.1, 0.62, 0, -padZ) as Shape, 10), 0.003), dark));
  laptop.add(mesh(onDeck(new ShapeGeometry(roundedRect(new Shape(), 15.6, padD, 0.58, 0, -padZ) as Shape, 10), 0.006), pad));

  /* Ports. Left: MagSafe, two Thunderbolt, headphones. Right: HDMI, Thunderbolt, SDXC. */
  const port = (side: -1 | 1, z: number, w: number, h: number) => {
    const g = new ShapeGeometry(roundedRect(new Shape(), w, h, Math.min(w, h) / 2 - 0.001) as Shape, 8);
    g.rotateY(side * Math.PI / 2).translate(side * (W / 2 + 0.004), -BASE_T / 2, z);
    laptop.add(mesh(g, dark));
  };
  port(-1, -9.6, 1.7, 0.3); port(-1, -7.4, 0.9, 0.27); port(-1, -5.7, 0.9, 0.27); port(-1, -4.2, 0.36, 0.36);
  port(1, -9.4, 1.5, 0.46); port(1, -7.3, 0.9, 0.27); port(1, -4.6, 2.5, 0.2);

  /* Hinge */
  laptop.add(mesh(new CylinderGeometry(0.42, 0.42, W - 5.5, 24, 1).rotateZ(Math.PI / 2).translate(0, -0.06, -D / 2 + 0.36), dark));

  /* Lid: hinged along its lower edge, the display facing +Z when upright. */
  const lid = new Group();
  lid.position.copy(PIVOT);
  laptop.add(lid);
  lid.add(mesh(slab(W, D, LID_T, 1.15, 0.12).translate(0, D / 2, -LID_T), body, true));
  const bezel = roundedRect(new Shape(), W - 0.34, D - 0.34, 1.0, 0, D / 2) as Shape;
  bezel.holes.push(roundedRect(new Path(), SCREEN_W, SCREEN_H, 0.34, 0, SCREEN_Y) as Path);
  lid.add(mesh(new ShapeGeometry(bezel, 14).translate(0, 0, 0.004), glass));
  /* The hole: it writes nothing but transparency, so the page behind the canvas shows through. */
  const hole = keep(new MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: NoBlending }));
  lid.add(new Mesh(keep(new ShapeGeometry(roundedRect(new Shape(), SCREEN_W + 0.02, SCREEN_H + 0.02, 0.34, 0, SCREEN_Y) as Shape, 14).translate(0, 0, 0.004)), hole));

  const panel = new CSS3DObject(screen);
  panel.position.set(0, SCREEN_Y, 0.004);
  panel.scale.setScalar(SCREEN_W / SCREEN_PX.w);
  lid.add(panel);

  /* What the display throws onto the deck: brightest under the panel, gone by the trackpad. */
  const glow = keep(new MeshBasicMaterial({ map: keep(spill()), transparent: true, depthWrite: false, toneMapped: false, blending: AdditiveBlending, opacity: 0 }));
  laptop.add(new Mesh(keep(new PlaneGeometry(W - 1.2, D - 1).rotateX(-Math.PI / 2).translate(0, 0.13, 0)), glow));

  return { laptop, lid, glow, litKeys, dispose: () => disposables.forEach(d => d.dispose()) };
}

const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function createStage(options: {
  canvas: HTMLCanvasElement;
  /** An empty element behind the canvas; the display is drawn into it. */
  layer: HTMLElement;
  /** The display's contents. */
  screen: HTMLElement;
  shots: Shot[];
  /** Reduced motion: the camera cuts between shots and the lid starts open. */
  still: boolean;
  onReady?: () => void;
}): StageHandle {
  const { canvas, layer, screen, shots, still } = options;
  const host = canvas.parentElement!;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const css = new CSS3DRenderer({ element: layer });

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.5;
  room.dispose(); pmrem.dispose();

  const { laptop, lid, glow, litKeys, dispose: disposeLaptop } = buildLaptop(screen);
  scene.add(laptop);

  /* The desk: a pool of light, and the laptop's shadow in it. */
  const floorY = -BASE_T - 0.05;
  const poolMap = lightPool();
  const pool = new Mesh(new PlaneGeometry(150, 150).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: poolMap, transparent: true, depthWrite: false, toneMapped: false }));
  pool.position.y = floorY - 0.01;
  const shadow = new Mesh(new PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new ShadowMaterial({ opacity: 0.55 }));
  shadow.position.y = floorY; shadow.receiveShadow = true;
  scene.add(pool, shadow);

  scene.add(new AmbientLight(0xffffff, 0.12));
  const key = new DirectionalLight(0xfff4e6, 1.7);
  key.position.set(-26, 58, 36);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 7; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 10, far: 140 });
  const rim = new DirectionalLight(0xb9d9e8, 1.1);
  rim.position.set(60, 14, -4);
  const fill = new DirectionalLight(0xf0d7a8, 0.1);
  fill.position.set(-44, 10, -18);
  scene.add(key, rim, fill);

  const camera = new PerspectiveCamera(FOV, 1, 1, 600);
  const tanHalf = Math.tan((FOV / 2) * RAD);
  const eye = new Vector3(), look = new Vector3(), right = new Vector3(), up = new Vector3();

  let aspect = 1;
  let goal = 0, at = 0, dirty = true, raf = 0, last = performance.now();
  /* The opening: the lid lifts and the camera settles. */
  let intro = still ? 1 : 0;
  let readyCalled = false;

  const place = () => {
    const i = Math.max(0, Math.min(shots.length - 2, Math.floor(at)));
    const a = shots[i], b = shots[Math.min(shots.length - 1, i + 1)];
    const t = ease(Math.max(0, Math.min(1, at - i)));
    const tall = aspect < 1;
    const sa = tall ? a.shiftTall : a.shift, sb = tall ? b.shiftTall : b.shift;
    const open = ease(intro);
    const az = mix(a.az, b.az, t) * RAD, el = mix(a.el, b.el, t) * RAD;
    /* Never closer than the shot asks for; further back when the window is too narrow to hold the laptop beside the words. */
    const fit = (s: Shot) => Math.max(s.dist, tall ? s.spanTall / (tanHalf * aspect) : s.span / (tanHalf * aspect * (s.shift[0] ? Math.abs(s.shift[0]) + 0.28 : 1)));
    const dist = mix(fit(a), fit(b), t) * mix(1.14, 1, open);
    const lidAngle = mix(a.lid, b.lid, t) * open;

    lid.rotation.x = (90 - lidAngle) * RAD;
    glow.opacity = 0.16 * Math.max(0, Math.min(1, (lidAngle - 15) / 50));
    litKeys.opacity = mix(a.keys ?? 0, b.keys ?? 0, t);

    look.set(mix(a.target[0], b.target[0], t), mix(a.target[1], b.target[1], t), mix(a.target[2], b.target[2], t));
    eye.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist).add(look);
    camera.position.copy(eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    /* Slide the whole frame sideways so the laptop sits off-centre without turning the camera. */
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const half = dist * tanHalf;
    camera.position.addScaledVector(right, -mix(sa[0], sb[0], t) * half * aspect).addScaledVector(up, -mix(sa[1], sb[1], t) * half);
    camera.updateMatrixWorld();
  };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    aspect = w / h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    css.setSize(w, h);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (intro < 1) { intro = Math.min(1, intro + dt / 1.9); dirty = true; }
    const gap = goal - at;
    if (Math.abs(gap) > 0.0004) { at = still ? goal : at + gap * (1 - Math.exp(-dt * 5.2)); dirty = true; }
    else if (at !== goal) { at = goal; dirty = true; }
    if (!dirty) return;
    dirty = false;
    place();
    renderer.render(scene, camera);
    css.render(scene, camera);
    if (!readyCalled) { readyCalled = true; options.onReady?.(); }
  };
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { goal = Math.max(0, Math.min(shots.length - 1, p)); },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      /* CSS3DRenderer leaves its own elements behind; a second stage would be laid out beneath them. */
      layer.replaceChildren();
      disposeLaptop();
      env.dispose(); poolMap.dispose();
      pool.geometry.dispose(); (pool.material as Material).dispose();
      shadow.geometry.dispose(); (shadow.material as Material).dispose();
      renderer.dispose();
    },
  };
}
