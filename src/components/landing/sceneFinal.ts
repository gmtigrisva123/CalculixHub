/**
 * The close: the thread becomes the pencilled line that climbs the last
 * stage, and at its end it blooms into a small Lorenz butterfly, so the page
 * ends where it began.
 *
 * The line is a tube of light. Its trace on screen is exactly the SVG path the
 * page draws without WebGL (finalLine.ts): it keeps to the floor under the
 * words and climbs behind the two cards, so it never crosses a line of text.
 * But it recedes: every point is pushed back in depth the further along the
 * line it is, and its place in world space is scaled out by the same amount,
 * so the projection lands on the designed trace while the tube itself grows
 * thinner and dimmer the way a line drawn away from you does. That depth is
 * worked out in the vertex shader from the stage's place on screen, so the
 * geometry is built once and never rebuilt while the page scrolls.
 *
 * How much of it is drawn is the same follow-spring value FinalStage draws its
 * SVG with (readStageValue), so the line runs on a moment after the scroll
 * stops. A point of light rides its tip; when it is fully drawn the tip opens
 * into the butterfly, which keeps flowing.
 *
 * The footer's curl lives here too: as the content sheet lifts away from the
 * footer, its lower edge catches the light and casts a shadow on what it
 * uncovers (glPaper.ts, shading only, because that strip of paper carries the
 * dusk tone of the ground).
 */

import {
  AddEquation, BufferAttribute, CatmullRomCurve3, CustomBlending, DoubleSide, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial,
  TubeGeometry, Vector2, Vector3, Vector4,
} from 'three';
import { docBox, progressAt, readStageValue, type Box } from './stageLayout';
import { EMPTY_BOX, cameraDistance, place, query, resetSlot, stageRadius } from './threadKit';
import { SHAPE, STAGE_COMMON } from './threadShaders';
import { POLY_SAMPLES, cssColorToSrgb, lerp, resampleByLength, smoothstep, svgPathPoints, type Point } from './threadShapes';
import { createPaperEdge } from './glPaper';
import { FINAL_ARRIVAL_KEY, FINAL_DRAWN_KEY, FINAL_PATH, drawnFor, sliceFit } from './finalLine';
import { STAGE_ARRIVAL } from './kit';
import { TILT, TURN } from './ParticleField';
import type { Extra, InkRect, Leg, Slot, StageFrame, ThreadScene } from './threadTypes';

/** How far back the line's end sits, in px: it starts a touch in front of the stage and climbs away. */
const NEAR = 40;
const FAR = -300;
/** Where along the thread the butterfly begins: the last share of the particles become it. */
const BLOOM_START = 0.6;
/** The share of the thread's particles this scene shows (the tube carries the line; these are its sparkle and the butterfly). */
const SHARE = 0.3;
/** The tube's radius, in px at the screen plane. */
const RADIUS = 2.6;

interface StageOnScreen extends InkRect { scale: number; originX: number; originY: number }

export class FinalScene implements ThreadScene {
  id = 'final';
  private found = false;
  private section = EMPTY_BOX;
  private stage = EMPTY_BOX;
  private boxes: Box[] = [];
  private radius = 14;
  /** The content sheet, whose lower edge lifts away from the footer. */
  content = EMPTY_BOX;
  /** The line in the stage's own pixels (y down), with its recession in z, before any scroll. */
  local: Point[] = [];
  /** Distance along `local` at each of its points, as a share of its length. */
  private along: number[] = [];
  /**
   * How much of the line the stage draws. The designed path runs off the stage's corner (the SVG lets it,
   * as a line that carries on); here it stops at its last point well inside the stage, where the butterfly
   * has room to open.
   */
  lineEnd = 1;
  /** Wide enough for the designed path; narrower stages draw a simple line along the floor. */
  wide = true;
  /** How far back the line's start and end sit, in px (its depth follows its length). */
  depth: [number, number] = [NEAR, FAR];
  /** The line resampled evenly by its length on screen, flat, in stage pixels. */
  private flat = new Float32Array(POLY_SAMPLES * 4);
  private samples = new Float32Array(POLY_SAMPLES * 4);

  measure() {
    const section = query('.lx-final');
    const stage = query('.lx-final-stage');
    this.found = Boolean(section && stage);
    if (!section || !stage) return;
    this.section = docBox(section);
    this.stage = docBox(stage);
    this.radius = stageRadius();
    // In front of the line: the words, and the two cards it climbs behind.
    this.boxes = [query('.lx-final-letter'), ...Array.from(document.querySelectorAll<HTMLElement>('.lx-final-paths .lx-path'))]
      .filter((element): element is HTMLElement => Boolean(element))
      .slice(0, 4)
      .map(element => docBox(element));
    this.wide = this.stage.width >= 960;
    this.local = this.buildLine();
    let run = 0;
    this.along = this.local.map((point, i) => (i ? (run += Math.hypot(point[0] - this.local[i - 1][0], point[1] - this.local[i - 1][1])) : 0));
    this.along = this.along.map(value => value / (run || 1));
    this.lineEnd = this.findLineEnd();
    this.flat = resampleByLength(this.local.map(([x, y]) => [x, y, 0] as Point));
    this.content = docBox(query('.lx-content'));
  }

  present() { return this.found; }

  /** The line in stage pixels: the designed path where there is room for it, a line along the floor where there is not. */
  private buildLine(): Point[] {
    const { width, height } = this.stage;
    let flat: Point[];
    if (this.wide) {
      const fit = sliceFit(width, height);
      flat = svgPathPoints(FINAL_PATH, 14).map(([x, y]) => [fit.x + x * fit.scale, fit.y + y * fit.scale, 0] as Point);
    } else {
      // On a narrow stage the cards stack and fill it; the line keeps to the strip of floor below them,
      // dips once, and still ends higher than it started.
      const floor = height - 46;
      flat = svgPathPoints(`M${width * 0.04} ${floor}C${width * 0.3} ${floor + 14} ${width * 0.42} ${floor - 26} ${width * 0.58} ${floor - 12}S${width * 0.84} ${floor - 30} ${width * 0.95} ${floor - 52}`, 20)
        .map(([x, y]) => [x, y, 0] as Point);
    }
    // Recede along the line's own length on screen, so its share drawn is the same in depth as in the SVG.
    this.depth = [NEAR, this.wide ? FAR : FAR * 0.4];
    const total = flat.reduce((sum, point, i) => (i ? sum + Math.hypot(point[0] - flat[i - 1][0], point[1] - flat[i - 1][1]) : 0), 0) || 1;
    let run = 0;
    return flat.map((point, i) => {
      if (i) run += Math.hypot(point[0] - flat[i - 1][0], point[1] - flat[i - 1][1]);
      return [point[0], point[1], lerp(this.depth[0], this.depth[1], run / total)] as Point;
    });
  }

  /** The last share of the line that lies inside the stage with room around it for the butterfly. */
  private findLineEnd(): number {
    const mx = this.wide ? 78 : 54;
    const my = this.wide ? 74 : 40;
    const { width, height } = this.stage;
    for (let k = 400; k > 0; k -= 1) {
      const share = k / 400;
      const [x, y] = this.localAt(share);
      if (x >= mx && x <= width - mx && y >= my && y <= height - my) return share;
    }
    return 1;
  }

  /** The stage on screen this frame, after its arrival (the same spring FinalStage draws with). */
  stageOnScreen(frame: StageFrame): StageOnScreen {
    const eased = frame.still ? 1 : readStageValue(FINAL_ARRIVAL_KEY) ?? progressAt(this.stage, ['start end', 'start 0.3'], frame.y, frame.vh);
    const scale = frame.still ? 1 : lerp(STAGE_ARRIVAL.scale, 1, eased);
    const lift = frame.still ? 0 : lerp(STAGE_ARRIVAL.y, 0, eased);
    const originX = this.stage.left + this.stage.width / 2;
    const top = this.stage.top - frame.y;
    // transform-origin: 50% 0%; the translate applies after the scale.
    const x = originX + (this.stage.left - originX) * scale;
    return { x, y: top + lift, w: this.stage.width * scale, h: this.stage.height * scale, r: this.radius, scale, originX: x, originY: top + lift };
  }

  /** How much of the line is drawn: the spring FinalStage uses, mapped the same way. */
  drawn(frame: StageFrame): number {
    const eased = readStageValue(FINAL_DRAWN_KEY)
      ?? progressAt(this.section, this.wide ? ['start 0.9', 'start 0.04'] : ['end 1.05', 'end 0.7'], frame.y, frame.vh);
    return drawnFor(eased, frame.still);
  }

  /** A stage-space point (px, y down, depth z) in world space, pushed back so it still lands on its designed pixel. */
  toWorld(frame: StageFrame, stage: StageOnScreen, [x, y, z]: Point): Point {
    const sx = stage.originX + x * stage.scale;
    const sy = stage.originY + y * stage.scale;
    const distance = cameraDistance(frame.ch);
    const out = (distance - z) / distance;
    return [(sx - frame.cw / 2) * out, (frame.ch / 2 - sy) * out, z];
  }

  ink(frame: StageFrame, out: InkRect[]) {
    if (!this.found) return;
    const stage = this.stageOnScreen(frame);
    if (stage.y < frame.ch && stage.y + stage.h > 0) out.push(stage);
  }

  /** Screen rectangles of the words and cards in front of the line. */
  occluders(frame: StageFrame, stage: StageOnScreen): [number, number, number, number][] {
    return this.boxes.map(box => [
      stage.originX + (box.left - this.stage.left) * stage.scale - 10,
      stage.originY + (box.top - this.stage.top) * stage.scale - 10,
      box.width * stage.scale + 20,
      box.height * stage.scale + 20,
    ]);
  }

  slot(frame: StageFrame, out: Slot, row: number) {
    resetSlot(out);
    if (!this.found || !this.local.length) return;
    const stage = this.stageOnScreen(frame);
    const drawn = this.drawn(frame);
    // The evenly spaced samples, placed on screen and pushed back to their depth (toWorld, inlined: this runs every frame).
    const distance = cameraDistance(frame.ch);
    for (let i = 0; i < POLY_SAMPLES; i += 1) {
      const share = i / (POLY_SAMPLES - 1);
      const z = lerp(this.depth[0], this.depth[1], share);
      const outward = (distance - z) / distance;
      this.samples[i * 4] = (stage.originX + this.flat[i * 4] * stage.scale - frame.cw / 2) * outward;
      this.samples[i * 4 + 1] = (frame.ch / 2 - stage.originY - this.flat[i * 4 + 1] * stage.scale) * outward;
      this.samples[i * 4 + 2] = z;
      this.samples[i * 4 + 3] = share;
    }
    // The thread's own coordinates are world coordinates: its origin is the centre of the screen.
    place(out.matrix, frame, frame.cw / 2, frame.ch / 2);
    out.shape = SHAPE.final;
    const bloom = frame.still ? 1 : smoothstep(0.9, 1, drawn);
    const reach = drawn * this.lineEnd;
    // The butterfly opens at the tip; until then its particles gather there as the point of light.
    const tip = this.toWorld(frame, stage, this.localAt(reach));
    out.p[0].set(row, 1.1, BLOOM_START, bloom);
    out.p[1].set(tip[0], tip[1], tip[2], (this.wide ? 32 : 19) * stage.scale);
    out.p[2].set(reach, TURN, TILT, 0);
    out.data = this.samples;
    out.look.set(2.1, 1.1, SHARE, 0);
    out.clip.set(stage.x, stage.y, stage.w, stage.h);
    out.shade.set(stage.r, 12, 0, 0);
    this.occluders(frame, stage).forEach(([x, y, w, h], i) => {
      out.occ[i].set(x, y, w, h);
      out.occR.setComponent(i, 14);
    });
    // The butterfly flows once it has bloomed; the line on its own is still.
    out.flowing = bloom > 0.001 && !frame.still;
  }

  /** A point along the line in stage pixels, by share of its length. */
  localAt(share: number): Point {
    const local = this.local;
    if (!local.length) return [0, 0, 0];
    const target = Math.max(0, Math.min(1, share));
    let i = 1;
    while (i < local.length - 1 && this.along[i] < target) i += 1;
    const span = this.along[i] - this.along[i - 1] || 1;
    const f = Math.max(0, Math.min(1, (target - this.along[i - 1]) / span));
    const a = local[i - 1];
    const b = local[i] ?? a;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  stageBox() { return this.stage; }
}

/** The thread enters the last stage as it arrives, and becomes the line from its start. */
export function finalLeg(self: FinalScene): Leg | null {
  return {
    to: 'final',
    window: frame => {
      if (!self.present()) return null;
      const top = self.stageBox().top;
      return [top - frame.vh * 0.95, top - frame.vh * 0.25];
    },
    stagger: 1.1,
    orderByU: 0.85,
    swirl: 40,
    lift: 60,
  };
}

// ---------------------------------------------------------------------------
// The tube and its point of light
// ---------------------------------------------------------------------------

const TUBE_VERTEX = /* glsl */ `
uniform vec2 uOrigin;
uniform float uScale;
uniform vec2 uCanvas;
uniform float uCamDist;
uniform vec2 uDepth;
attribute vec2 aCentre;
varying float vAlong;
varying float vFacing;
varying float vDepth;
void main() {
  // The geometry is the flat line in stage pixels (y down). Its centre line is placed on screen and pushed
  // back by its depth, which follows its length (uv.x), scaled out so it still lands on its designed pixel;
  // the tube's own girth is not scaled out, so it thins as it recedes.
  float depth = mix(uDepth.x, uDepth.y, uv.x);
  vec2 centre = uOrigin + aCentre * uScale;
  vec3 girth = (position - vec3(aCentre, 0.0)) * uScale;
  float out_ = (uCamDist - depth) / uCamDist;
  vec3 world = vec3((centre.x - uCanvas.x * 0.5) * out_ + girth.x, (uCanvas.y * 0.5 - centre.y) * out_ - girth.y, depth + girth.z);
  vec4 mv = viewMatrix * vec4(world, 1.0);
  vec3 n = normalize(normalMatrix * vec3(normal.x, -normal.y, normal.z));
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  vAlong = uv.x;
  vDepth = clamp((depth - uDepth.y) / max(1.0, uDepth.x - uDepth.y), 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const TUBE_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform vec4 uOcc[4];
uniform vec4 uOccR;
uniform float uDpr;
uniform float uDrawn;
uniform vec3 uCyan;
uniform vec3 uBrass;
varying float vAlong;
varying float vFacing;
varying float vDepth;
void main() {
  if (vAlong > uDrawn) discard;
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float m = clipAt(p, uClip, uClipR) * occlusionAt(p, uOcc, uOccR, 12.0);
  // Lit like a glass rod from the front: a bright core where it faces you, a soft rim.
  float core = pow(vFacing, 3.0);
  vec3 c = mix(uCyan * 0.55, vec3(1.0), core * 0.55);
  // Brighter toward the drawn end, warming to brass at the very tip; dimmer as it recedes.
  float lead = smoothstep(uDrawn - 0.08, uDrawn, vAlong);
  c = mix(c, uBrass, lead * 0.6);
  float a = (0.35 + 0.65 * core) * mix(0.45, 1.0, vDepth) * (0.75 + 0.5 * lead) * m;
  gl_FragColor = vec4(c * a, 0.0);
}`;

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // A sprite: always faces the viewer.
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * vec2(modelMatrix[0][0], modelMatrix[1][1]);
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uClip;
uniform float uClipR;
uniform float uDpr;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float d = length(vUv - 0.5) * 2.0;
  float a = (exp(-d * d * 9.0) * 0.9 + exp(-d * 3.0) * 0.25) * uStrength * clipAt(p, uClip, uClipR);
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

const TUBE_SEGMENTS = 420;
const TUBE_SIDES = 10;

/** Each vertex of a tube with the centre of its ring, so the shader can push the centre back without its girth. */
function withCentres(geometry: TubeGeometry): TubeGeometry {
  const position = geometry.getAttribute('position');
  const centres = new Float32Array(position.count * 2);
  const ring = TUBE_SIDES + 1;
  for (let i = 0; i <= TUBE_SEGMENTS; i += 1) {
    let x = 0;
    let y = 0;
    for (let j = 0; j < TUBE_SIDES; j += 1) {
      x += position.getX(i * ring + j);
      y += position.getY(i * ring + j);
    }
    x /= TUBE_SIDES;
    y /= TUBE_SIDES;
    for (let j = 0; j < ring; j += 1) {
      centres[(i * ring + j) * 2] = x;
      centres[(i * ring + j) * 2 + 1] = y;
    }
  }
  geometry.setAttribute('aCentre', new BufferAttribute(centres, 2));
  return geometry;
}

const premultiplied = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: DoubleSide,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

export function createFinalExtras(self: FinalScene, style: CSSStyleDeclaration, _still: boolean): Extra[] {
  const color = (name: string, fallback: [number, number, number]) => new Vector3(...cssColorToSrgb(style.getPropertyValue(name), fallback));
  const cyan = color('--lx-cyan', [0.55, 0.86, 0.93]);
  const brass = color('--lx-brass', [0.95, 0.78, 0.45]);

  const tubeUniforms = {
    uView: { value: new Vector2(1, 1) },
    uCanvas: { value: new Vector2(1, 1) },
    uOrigin: { value: new Vector2() },
    uScale: { value: 1 },
    uCamDist: { value: 1 },
    uDepth: { value: new Vector2(NEAR, FAR) },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uOcc: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uOccR: { value: new Vector4() },
    uDpr: { value: 1 },
    uDrawn: { value: 0 },
    uCyan: { value: cyan },
    uBrass: { value: brass },
  };
  const tubeMaterial = new ShaderMaterial({ uniforms: tubeUniforms, vertexShader: TUBE_VERTEX, fragmentShader: `${TUBE_FRAGMENT}`, ...premultiplied });
  const tube = new Mesh(new TubeGeometry(), tubeMaterial);
  tube.frustumCulled = false;
  tube.renderOrder = 8;
  tube.visible = false;
  let builtFor: Point[] | null = null;

  const glowUniforms = {
    uView: { value: new Vector2(1, 1) },
    uClip: { value: new Vector4() },
    uClipR: { value: 14 },
    uDpr: { value: 1 },
    uColor: { value: brass },
    uStrength: { value: 1 },
  };
  const glow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({ uniforms: glowUniforms, vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, ...premultiplied }));
  glow.frustumCulled = false;
  glow.renderOrder = 12;
  glow.visible = false;

  const line: Extra = {
    object: tube,
    update(frame) {
      if (!self.present() || !self.local.length) { tube.visible = false; return false; }
      const stage = self.stageOnScreen(frame);
      const onScreen = stage.y < frame.ch && stage.y + stage.h > 0;
      tube.visible = onScreen;
      if (!onScreen) return false;
      if (builtFor !== self.local) {
        builtFor = self.local;
        tube.geometry.dispose();
        // Flat: the shader pushes it back by its length, so uv.x is the same share of it the SVG draws.
        const curve = new CatmullRomCurve3(self.local.map(([x, y]) => new Vector3(x, y, 0)), false, 'centripetal');
        curve.arcLengthDivisions = 1200;
        tube.geometry = withCentres(new TubeGeometry(curve, TUBE_SEGMENTS, RADIUS, TUBE_SIDES, false));
      }
      tubeUniforms.uView.value.set(frame.cw, frame.ch);
      tubeUniforms.uCanvas.value.set(frame.cw, frame.ch);
      tubeUniforms.uOrigin.value.set(stage.originX, stage.originY);
      tubeUniforms.uScale.value = stage.scale;
      tubeUniforms.uCamDist.value = cameraDistance(frame.ch);
      tubeUniforms.uDepth.value.set(self.depth[0], self.depth[1]);
      tubeUniforms.uDpr.value = frame.dpr;
      tubeUniforms.uClip.value.set(stage.x, stage.y, stage.w, stage.h);
      tubeUniforms.uClipR.value = stage.r;
      const occ = self.occluders(frame, stage);
      for (let i = 0; i < 4; i += 1) {
        const box = occ[i];
        tubeUniforms.uOcc.value[i].set(box ? box[0] : 0, box ? box[1] : 0, box ? box[2] : 0, box ? box[3] : 0);
        tubeUniforms.uOccR.value.setComponent(i, box ? 14 : 0);
      }
      tubeUniforms.uDrawn.value = self.drawn(frame) * self.lineEnd;
      return false;
    },
    dispose() {
      tube.geometry.dispose();
      tubeMaterial.dispose();
    },
  };

  const tip: Extra = {
    object: glow,
    update(frame) {
      if (!self.present() || !tube.visible) { glow.visible = false; return false; }
      const stage = self.stageOnScreen(frame);
      const drawn = self.drawn(frame);
      // The point of light rides the tip while the line is drawn, and gives way to the butterfly.
      const strength = 1 - smoothstep(0.92, 1, drawn);
      glow.visible = strength > 0.01;
      const point = self.toWorld(frame, stage, self.localAt(drawn * self.lineEnd));
      glow.position.set(point[0], point[1], point[2]);
      glow.scale.set(54 * stage.scale, 54 * stage.scale, 1);
      glowUniforms.uView.value.set(frame.cw, frame.ch);
      glowUniforms.uDpr.value = frame.dpr;
      glowUniforms.uClip.value.set(stage.x, stage.y, stage.w, stage.h);
      glowUniforms.uClipR.value = stage.r;
      glowUniforms.uStrength.value = strength;
      return false;
    },
    dispose() {
      glow.geometry.dispose();
      (glow.material as ShaderMaterial).dispose();
    },
  };

  // The footer, uncovered: the content sheet's lower edge curls as it lifts away. Its lip may only shade
  // the strip of paper under the last stage, which is as tall as the page's frame (--lx-frame).
  const footer = createPaperEdge(frame => {
    const content = self.content;
    if (!self.present() || !content.height) return null;
    const lift = progressAt(content, ['end end', 'end start'], frame.y, frame.vh);
    if (lift <= 0 || lift >= 1) return null;
    const strip = Math.min(16, Math.max(8, frame.vw * 0.0105));
    return {
      x: content.left,
      y: content.top + content.height - frame.y,
      w: content.width,
      r: Math.max(strip, 10),
      curl: frame.still ? 0.5 : smoothstep(0, 0.14, lift) * 0.9,
      band: strip,
    };
  }, -1, style, 12, true);

  return [line, tip, footer];
}
