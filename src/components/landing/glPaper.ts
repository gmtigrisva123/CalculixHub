/**
 * The edge of a sheet of paper, in light and shadow.
 *
 * The page is printed on sheets: the idea's sheet slides up over the hero, and
 * at the end the whole content sheet lifts away from the footer. Their edges
 * are flat in the DOM. Here an edge is given what a real sheet has when it is
 * moving: a soft curl (a lip that catches the light, with a little valley
 * behind it), corners that lift a touch more than the middle, the faint bow of
 * a sheet that is not quite flat, and a contact shadow cast onto whatever is
 * underneath.
 *
 * All of it is one screen-space quad and a fragment shader; no geometry moves.
 * The lip is drawn in the page's exact paper colour, so where it ends the DOM
 * sheet carries on without a seam. It only ever covers the sheet's empty
 * margin (the idea's sheet opens on a tall band of blank paper), never type.
 */

import {
  AddEquation, CustomBlending, DoubleSide, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, Vector2, Vector3, Vector4,
} from 'three';
import { cssColorToSrgb } from './threadShapes';
import { STAGE_COMMON } from './threadShaders';
import type { Extra, StageFrame } from './threadTypes';

export interface PaperEdge {
  /** Screen y of the edge, its left x and width, its corner radius. */
  x: number;
  y: number;
  w: number;
  r: number;
  /** How curled it is, 0 (flat) to 1. */
  curl: number;
  /** How deep the lip reaches into the sheet, px, when it differs from the default. */
  band?: number;
}

const VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
${STAGE_COMMON}
uniform vec4 uEdge;
uniform float uSide;
uniform float uCurl;
uniform float uDpr;
uniform vec3 uPaper;
uniform vec3 uShadow;
uniform float uBand;
uniform float uOverlay;
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float across = clamp((p.x - uEdge.x) / uEdge.z, 0.0, 1.0);
  // Corners lift more than the middle, the way a sheet pushed across a table curls.
  // (In overlay mode there is no paper to paint past the real edge, so the lift shows in the shadow alone.)
  float rise = uOverlay > 0.5 ? 0.0 : uCurl * (4.0 + 20.0 * pow(abs(across * 2.0 - 1.0), 6.0));
  float edge = uEdge.y - uSide * rise;
  vec4 paper = uSide > 0.0 ? vec4(uEdge.x, edge, uEdge.z, 6000.0) : vec4(uEdge.x, edge - 6000.0, uEdge.z, 6000.0);
  float sd = sdRoundRect(p, paper, uEdge.w);
  if (sd < 0.0) {
    // How far into the sheet from its edge: down from the edge, not in from its sides.
    float depth = max(0.0, (p.y - edge) * uSide);
    float lip = clamp(depth / uBand, 0.0, 1.0);
    if (lip >= 1.0) discard;
    // A rim of light at the very edge, a soft valley just behind it, then flat paper.
    float shade = 1.0 + uCurl * (0.045 * exp(-depth * 0.6) - 0.07 * exp(-pow((lip - 0.38) * 3.6, 2.0)));
    // The bow: a sheet that is not quite flat is a little brighter down its middle.
    shade += uCurl * 0.012 * (cos((across - 0.5) * 3.14159) - 0.6) * (1.0 - lip);
    // By the inner end of the band every term has died away: the colour is the DOM paper's, so no seam.
    if (uOverlay > 0.5) {
      // Over paper that carries a tone of its own, only the light and shade of the curl are laid on it.
      float dark = max(0.0, 1.0 - shade) * 3.0;
      float light = max(0.0, shade - 1.0) * 3.0;
      gl_FragColor = vec4(vec3(light), dark);
    } else {
      gl_FragColor = vec4(uPaper * shade, 1.0);
    }
  } else {
    // The contact shadow on what is underneath: tight and dark where the lip is lifted.
    float reach = 8.0 + 18.0 * uCurl;
    float s = exp(-sd / reach) * (0.14 + 0.3 * uCurl) * (0.8 + 0.2 * cos((across - 0.5) * 3.14159));
    gl_FragColor = vec4(uShadow * s, s);
  }
}`;

/**
 * An edge that follows `locate` each frame. `side` is 1 when the paper lies
 * below the edge (a sheet sliding up) and -1 when it lies above (a sheet
 * lifting away from what is beneath it).
 */
export function createPaperEdge(
  locate: (frame: StageFrame) => PaperEdge | null,
  side: 1 | -1,
  style: CSSStyleDeclaration,
  band = 34,
  /** Shade the paper that is there instead of painting paper over it (for a sheet whose colour is toned). */
  overlay = false,
): Extra {
  const uniforms = {
    uView: { value: new Vector2(1, 1) },
    uEdge: { value: new Vector4() },
    uSide: { value: side },
    uCurl: { value: 0 },
    uDpr: { value: 1 },
    uBand: { value: band },
    uOverlay: { value: overlay ? 1 : 0 },
    uPaper: { value: new Vector3(...cssColorToSrgb(style.getPropertyValue('--lx-paper'), [0.97, 0.96, 0.94])) },
    uShadow: { value: new Vector3(0.02, 0.05, 0.08) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
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
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  // Under the thread, over every stage: the thread hangs in front of the paper.
  mesh.renderOrder = 6;
  mesh.visible = false;

  return {
    object: mesh,
    update(frame) {
      const edge = locate(frame);
      if (!edge || edge.y < -120 || edge.y > frame.ch + 120) {
        mesh.visible = false;
        return false;
      }
      mesh.visible = true;
      uniforms.uView.value.set(frame.cw, frame.ch);
      uniforms.uDpr.value = frame.dpr;
      uniforms.uEdge.value.set(edge.x, edge.y, edge.w, edge.r);
      uniforms.uCurl.value = edge.curl;
      uniforms.uBand.value = edge.band ?? band;
      // The quad covers the edge with room for the shadow on one side and the lip on the other.
      const lip = edge.band ?? band;
      const above = side > 0 ? 90 : lip + 30;
      const below = side > 0 ? lip + 30 : 90;
      const top = edge.y - above;
      const height = above + below;
      mesh.position.set(edge.x + edge.w / 2 - frame.cw / 2, frame.ch / 2 - (top + height / 2), 0);
      mesh.scale.set(edge.w + 40, height, 1);
      return false;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
