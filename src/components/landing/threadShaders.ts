/**
 * The GLSL behind the thread of light.
 *
 * One particle system draws the thread through every scene. Each particle has
 * a fixed place along the thread (u, 0–1) and a little stray off its centre
 * line, which is what makes the thread read as silk rather than wire. Two
 * shape slots, A and B, say where u is in the scene being left and the scene
 * being entered; `uMorph` carries every particle from one to the other, each
 * on its own delay, with a lift and a swirl in flight so the thread is seen to
 * travel rather than cross-fade.
 *
 * Colour follows the ground. Over an ink stage a particle is light, added to
 * what is behind it; over paper the same particle is ink, laid over it. Both
 * are written as premultiplied colour (light has no alpha, ink does), so one
 * draw call does both and a particle changes material as it crosses the edge
 * of a stage. Colours arrive already gamma-encoded and stay that way: the
 * browser composites the canvas over the page in sRGB, so blending in the
 * same space is what makes the thread's ink match the page's ink.
 *
 * Text that sits in front of the thread (a slip of paper, a card) is given to
 * the shader as an occluder: a rounded rectangle in screen space where the
 * thread is not drawn, softened at the edge so it reads as passing behind.
 */

/** Shape ids, shared with threadEngine.ts. */
export const SHAPE = { none: 0, lorenz: 1, line: 2, curve: 3, circle: 4, dust: 5, poly: 6, final: 7 } as const;
export type ShapeId = (typeof SHAPE)[keyof typeof SHAPE];

/** Samples along the Lorenz path, and the width of the texture that holds them. */
export const PATH_LENGTH = 16384;
export const PATH_WIDTH = 1024;
/** The shape-data texture: one row per slot (A, B) and spares, POLY_SAMPLES wide. */
export const DATA_ROWS = 4;

/** Screen-space helpers shared by every material that lives on the stage. */
export const STAGE_COMMON = /* glsl */ `
uniform vec2 uView;
float sdRoundRect(vec2 p, vec4 rect, float radius) {
  vec2 c = rect.xy + rect.zw * 0.5;
  vec2 q = abs(p - c) - rect.zw * 0.5 + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
// 1 where nothing is in front, 0 inside an occluder; soft over a few pixels.
float occlusionAt(vec2 p, vec4 occ[4], vec4 radii, float feather) {
  float seen = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = occ[i];
    if (r.z <= 0.0) continue;
    float sd = sdRoundRect(p, r, radii[i]);
    seen = min(seen, smoothstep(-feather, feather, sd));
  }
  return seen;
}
// 1 inside the clip (or with no clip), 0 outside.
float clipAt(vec2 p, vec4 clip, float radius) {
  if (clip.z <= 0.0) return 1.0;
  return 1.0 - smoothstep(-1.5, 1.5, sdRoundRect(p, clip, radius));
}
float hash11(float n) { return fract(sin(n) * 43758.5453123); }
`;

export const THREAD_VERTEX = /* glsl */ `
attribute vec4 aParam;
attribute vec3 aOffset;

uniform sampler2D uPath;
uniform sampler2D uData;
uniform float uTime;
uniform float uCount;
uniform float uDpr;
uniform float uCamDist;

uniform float uShapeA;
uniform float uShapeB;
uniform mat4 uMatA;
uniform mat4 uMatB;
uniform vec4 uPA[3];
uniform vec4 uPB[3];
// size (px), alpha, visible share, dust alpha
uniform vec4 uLookA;
uniform vec4 uLookB;
uniform vec4 uClipA;
uniform vec4 uClipB;
// clip radius, occluder feather, vignette left, vignette bottom
uniform vec4 uShadeA;
uniform vec4 uShadeB;
uniform vec4 uOccA[4];
uniform vec4 uOccB[4];
uniform vec4 uOccRA;
uniform vec4 uOccRB;

uniform float uMorph;
// stagger, order by u (0 = random), swirl (px), lift toward the viewer (px)
uniform vec4 uMorphLook;

uniform vec4 uGround[4];
uniform vec4 uGroundR;

uniform vec2 uPointer;
uniform float uPointerPower;
uniform float uPointerRadius;

uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uEdge;
uniform vec3 uChalk;

varying vec3 vColor;
varying float vAlpha;
varying float vHalo;
varying float vInk;

const float LENGTH = ${PATH_LENGTH.toFixed(1)};
const float WIDTH = ${PATH_WIDTH.toFixed(1)};
const float ROWS = ${(PATH_LENGTH / PATH_WIDTH).toFixed(1)};
const float DATA_W = 256.0;
const float DATA_H = ${DATA_ROWS.toFixed(1)};
const float PI = 3.14159265;

vec4 pathAt(float i) {
  return texture2D(uPath, vec2((mod(i, WIDTH) + 0.5) / WIDTH, (floor(i / WIDTH) + 0.5) / ROWS));
}
vec4 along(float at) {
  float i = floor(at);
  return mix(pathAt(i), pathAt(min(i + 1.0, LENGTH - 1.0)), at - i);
}
// A row of the shape-data texture at s in [0, 1], between its two nearest samples.
vec4 dataAt(float row, float s) {
  float at = clamp(s, 0.0, 1.0) * (DATA_W - 1.0);
  float i = floor(at);
  float y = (row + 0.5) / DATA_H;
  vec4 a = texture2D(uData, vec2((i + 0.5) / DATA_W, y));
  vec4 b = texture2D(uData, vec2((min(i + 1.0, DATA_W - 1.0) + 0.5) / DATA_W, y));
  return mix(a, b, at - i);
}

// Where particle u sits on a shape, in that shape's local space.
vec3 shapeAt(float shape, vec4 P[3], float u, float speed, float seed, float stray, vec3 dir, vec4 param, bool dust, out float fast, out float ends, out float crest) {
  fast = 0.0;
  ends = 1.0;
  crest = 0.0;
  if (shape < 0.5) return vec3(0.0);

  if (shape < 1.5) {
    // The Lorenz attractor: P0 = flow, loosen, intro, breathe.
    vec3 p;
    if (!dust) {
      float uu = fract(u + uTime * P[0].x * speed);
      vec4 here = along(uu * (LENGTH - 1.0));
      fast = here.w;
      ends = smoothstep(0.0, 0.01, uu) * smoothstep(1.0, 0.99, uu);
      float spread = stray * (1.2 - 0.5 * fast) * (1.0 + 0.25 * sin(uTime * 0.6 + seed * 50.0));
      p = here.xyz + dir * spread;
      crest = pow(0.5 + 0.5 * cos((uu * 9.0 - uTime * 0.05) * 6.2831853), 30.0);
    } else {
      float theta = param.x + uTime * 0.018;
      float phi = param.y;
      float r = param.z;
      p = vec3(r * sin(phi) * cos(theta), r * cos(phi) * 0.6, r * sin(phi) * sin(theta));
    }
    p *= 1.0 + P[0].w * sin(uTime * 0.55);
    vec3 scatter = normalize(vec3(hash11(seed * 13.13) - 0.5, hash11(seed * 7.71) - 0.5, hash11(seed * 3.37) - 0.5) + 1e-4);
    // Assembly out of a wide shell, each particle on its own delay.
    float t = clamp(P[0].z * 1.5 - seed * 0.5, 0.0, 1.0);
    t = 1.0 - pow(1.0 - t, 3.0);
    p = mix(scatter * (5.5 + seed * 5.0), p, t);
    // Loosening as the hero is covered: outward, and a little lift.
    p += scatter * P[0].y * (0.4 + seed * 2.2);
    p.y += P[0].y * (seed - 0.35) * 0.9;
    return p;
  }

  if (shape < 2.5) {
    // A line along x: P0 = length, wave, thickness, flow.
    float uu = fract(u + uTime * P[0].w);
    float x = (uu - 0.5) * P[0].x;
    float wave = P[0].y * sin(uu * 11.0 + uTime * 0.7) * sin(uu * PI);
    ends = smoothstep(0.0, 0.02, uu) * smoothstep(1.0, 0.98, uu);
    crest = pow(0.5 + 0.5 * cos((uu * 3.0 - uTime * 0.04) * 6.2831853), 24.0);
    return vec3(x, wave, 0.0) + dir * stray * P[0].z * 30.0;
  }

  if (shape < 3.5) {
    // The belief curve: P0 = width, height, lift, thickness; P1.x = data row.
    float h = dataAt(P[1].x, u).r;
    fast = h;
    ends = smoothstep(0.0, 0.015, u) * smoothstep(1.0, 0.985, u);
    return vec3((u - 0.5) * P[0].x, h * P[0].y * P[0].z, 0.0) + dir * stray * P[0].w * 30.0;
  }

  if (shape < 4.5) {
    // A circle: P0 = radius, the u that sits at the top, thickness, flow.
    float uu = u + uTime * P[0].w;
    float a = PI * 0.5 - (uu - P[0].y) * 2.0 * PI;
    crest = pow(0.5 + 0.5 * cos((uu * 2.0 - uTime * 0.05) * 6.2831853), 40.0);
    return vec3(cos(a), sin(a), 0.0) * P[0].x + dir * stray * P[0].z * 30.0;
  }

  if (shape < 5.5) {
    // Chalk dust over a board: P0 = width, height, settle (0 aloft, 1 on the board), drift.
    // P1 = a puff: x, y, strength, radius. P2 = a swirl: x, y, strength, radius.
    vec2 home = vec2(hash11(seed * 91.7) - 0.5, hash11(seed * 17.3) - 0.5) * P[0].xy;
    // Most settle low, as dust does, gathering toward the ledge.
    home.y = mix(home.y, -P[0].y * 0.5 + abs(home.y + P[0].y * 0.5) * 0.35, 0.55 * hash11(seed * 5.1));
    vec2 aloft = home + vec2(sin(seed * 40.0) * 60.0, 140.0 + seed * 220.0);
    vec2 p = mix(aloft, home, P[0].z);
    float t = uTime * P[0].w;
    p += vec2(sin(t * 0.7 + seed * 31.0), cos(t * 0.5 + seed * 17.0)) * (6.0 + 18.0 * (1.0 - P[0].z));
    vec2 toPuff = p - P[1].xy;
    float near = P[1].z * exp(-dot(toPuff, toPuff) / (P[1].w * P[1].w + 1.0));
    p += normalize(toPuff + 1e-3) * near * (40.0 + 60.0 * seed) + vec2(0.0, near * 30.0);
    vec2 toSwirl = p - P[2].xy;
    float pull = P[2].z * exp(-dot(toSwirl, toSwirl) / (P[2].w * P[2].w + 1.0));
    float ang = pull * 4.0 + seed * 6.28;
    p = mix(p, P[2].xy + vec2(cos(ang), sin(ang)) * P[2].w * 0.25 * (1.0 - pull), pull);
    fast = near + pull;
    return vec3(p, (seed - 0.5) * 40.0);
  }

  if (shape < 6.5) {
    // A polyline, resampled by length: P0 = data row, thickness, flow, drawn share.
    float uu = clamp(u + uTime * P[0].z, 0.0, 1.0);
    if (P[0].z != 0.0) uu = fract(u + uTime * P[0].z);
    vec4 d = dataAt(P[0].x, uu);
    ends = step(uu, P[0].w + 1e-4) * smoothstep(0.0, 0.01, uu);
    crest = pow(0.5 + 0.5 * cos((uu * 4.0 - uTime * 0.06) * 6.2831853), 30.0);
    return d.xyz + dir * stray * P[0].y * 30.0;
  }

  // The closing line, with a small butterfly at its tip.
  // P0 = data row, thickness, where the butterfly starts (u), bloom 0–1.
  // P1 = tip position (local), butterfly scale. P2.x = drawn share of the line.
  if (u < P[0].z) {
    float s = u / P[0].z;
    vec4 d = dataAt(P[0].x, s * P[2].x);
    ends = smoothstep(0.0, 0.01, s);
    crest = pow(0.5 + 0.5 * cos((s * 5.0 - uTime * 0.08) * 6.2831853), 26.0);
    fast = s;
    return d.xyz + dir * stray * P[0].y * 30.0;
  }
  float b = (u - P[0].z) / (1.0 - P[0].z);
  float uu = fract(b + uTime * 0.01 * speed);
  vec4 here = along(uu * (LENGTH - 1.0));
  fast = here.w;
  vec3 wing = (here.xyz + dir * stray * 0.8) * P[1].w * P[0].w;
  crest = pow(0.5 + 0.5 * cos((uu * 9.0 - uTime * 0.05) * 6.2831853), 30.0);
  return P[1].xyz + wing;
}

vec3 shapeColor(float shape, vec3 p, float fast, float crest, float u) {
  if (shape < 1.5) {
    float wing = smoothstep(-0.9, 0.9, p.x);
    vec3 c = mix(uCool, uWarm, wing * 0.7);
    return mix(c, uEdge, smoothstep(0.55, 0.95, fast) * 0.85);
  }
  if (shape > 4.5 && shape < 5.5) return mix(uChalk, uCool, fast * 0.5);
  if (shape > 2.5 && shape < 3.5) return mix(uCool, mix(uCool, uEdge, 0.35), smoothstep(0.55, 1.0, fast));
  if (shape > 6.5) return mix(uCool, uEdge, smoothstep(0.65, 1.0, fast) * 0.6);
  return mix(uCool, uEdge, crest * 0.5);
}

float vignette(vec2 s, vec4 clip, vec4 shade) {
  if (clip.z <= 0.0 || (shade.z <= 0.0 && shade.w <= 0.0)) return 1.0;
  vec2 q = (s - clip.xy) / clip.zw;
  float left = shade.z * (1.0 - smoothstep(0.0, 0.62, q.x));
  float bottom = shade.w * (1.0 - smoothstep(0.0, 0.36, 1.0 - q.y));
  return clamp(1.0 - left - bottom, 0.0, 1.0);
}

void main() {
  bool dust = aParam.w < 0.0;
  float seed = dust ? -aParam.w : aParam.z;
  float u = dust ? fract(seed * 7.31 + 0.13) : aParam.x;
  float speed = dust ? 1.0 : aParam.y;
  float stray = dust ? 0.002 : aParam.w;
  float rank = float(gl_VertexID) / uCount;

  // Each particle's own share of the morph.
  float order = mix(rank, u, uMorphLook.y);
  float ti = clamp(uMorph * (1.0 + uMorphLook.x) - order * uMorphLook.x, 0.0, 1.0);
  ti = ti * ti * (3.0 - 2.0 * ti);

  float fastA; float endsA; float crestA;
  vec3 localA = shapeAt(uShapeA, uPA, u, speed, seed, stray, aOffset, aParam, dust, fastA, endsA, crestA);
  vec3 world = (uMatA * vec4(localA, 1.0)).xyz;
  float fast = fastA;
  float ends = endsA;
  float crest = crestA;
  vec3 colour = shapeColor(uShapeA, localA, fastA, crestA, u);
  if (uMorph > 0.0) {
    float fastB; float endsB; float crestB;
    vec3 localB = shapeAt(uShapeB, uPB, u, speed, seed, stray, aOffset, aParam, dust, fastB, endsB, crestB);
    vec3 worldB = (uMatB * vec4(localB, 1.0)).xyz;
    world = mix(world, worldB, ti);
    fast = mix(fastA, fastB, ti);
    ends = mix(endsA, endsB, ti);
    crest = mix(crestA, crestB, ti);
    colour = mix(colour, shapeColor(uShapeB, localB, fastB, crestB, u), ti);
    // In flight: a lift toward the viewer and a stray of the particle's own, so the thread travels as a strand.
    float flight = sin(PI * ti);
    vec3 n = vec3(hash11(seed * 12.9) - 0.5, hash11(seed * 78.2) - 0.5, hash11(seed * 37.7) - 0.5);
    world += flight * (n * uMorphLook.z + vec3(sin(u * 18.0 + uTime) * uMorphLook.z * 0.25, 0.0, uMorphLook.w * (0.4 + seed)));
  }

  vec4 mv = viewMatrix * vec4(world, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 screen = vec2((clip.x / clip.w * 0.5 + 0.5) * uView.x, (0.5 - clip.y / clip.w * 0.5) * uView.y);

  // The pointer stirs what is near it: a swirl (the curl of a moving field) and a brightening.
  float near = uPointerPower * (1.0 - smoothstep(0.0, uPointerRadius, distance(screen, uPointer))) * (1.0 - ti);
  if (near > 0.001) {
    vec2 q = (screen - uPointer) / uPointerRadius;
    float t = uTime * 0.9;
    float a = 5.0; float b = 4.0; float c = 3.0;
    float dpdx = a * cos(a * q.x + t) * cos(b * q.y - t) + 0.5 * c * cos(c * (q.x + q.y) + 1.7 * t);
    float dpdy = -b * sin(a * q.x + t) * sin(b * q.y - t) + 0.5 * c * cos(c * (q.x + q.y) + 1.7 * t);
    vec2 curl = vec2(dpdy, -dpdx);
    // A gentle vortex round the pointer, broken up by the field so it reads as a stir, not a whirlpool.
    float spin = near * near * 0.55;
    vec2 swirl = vec2(-q.y, q.x) * spin * uPointerRadius * 0.28 + curl * near * 5.5;
    world.xy += vec2(swirl.x, -swirl.y);
    mv = viewMatrix * vec4(world, 1.0);
    clip = projectionMatrix * mv;
    screen = vec2((clip.x / clip.w * 0.5 + 0.5) * uView.x, (0.5 - clip.y / clip.w * 0.5) * uView.y);
  }
  gl_Position = clip;

  // Light over an ink stage, ink over paper.
  float inside = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uGround[i];
    if (r.z <= 0.0) continue;
    inside = max(inside, 1.0 - smoothstep(-3.0, 3.0, sdRoundRect(screen, r, uGroundR[i])));
  }
  vInk = 1.0 - inside;

  float seenA = clipAt(screen, uClipA, uShadeA.x) * occlusionAt(screen, uOccA, uOccRA, uShadeA.y) * vignette(screen, uClipA, uShadeA);
  float seenB = clipAt(screen, uClipB, uShadeB.x) * occlusionAt(screen, uOccB, uOccRB, uShadeB.y) * vignette(screen, uClipB, uShadeB);
  float seen = mix(seenA, uMorph > 0.0 ? seenB : seenA, ti);

  float shownA = step(rank, uLookA.z) * (dust ? uLookA.w : 1.0);
  float shownB = step(rank, uLookB.z) * (dust ? uLookB.w : 1.0);
  float shown = mix(shownA, uMorph > 0.0 ? shownB : shownA, ti);
  float alpha = mix(uLookA.y, uMorph > 0.0 ? uLookB.y : uLookA.y, ti);
  float size = mix(uLookA.x, uMorph > 0.0 ? uLookB.x : uLookA.x, ti);

  float twinkle = 0.76 + 0.24 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
  float spark = dust ? 0.0 : step(0.988, seed) * (0.5 + 0.5 * sin(uTime * (0.5 + seed * 1.3) + seed * 90.0));
  float depth = clamp(0.5 + world.z / 400.0, 0.0, 1.0);
  float perspective = uCamDist / max(1.0, -mv.z);

  float visible = shown * seen * ends;
  gl_PointSize = visible > 0.002 ? size * uDpr * perspective * (mix(0.86, 1.1, depth) + near * 0.8 + crest * 0.8 + spark * 1.3) : 0.0;
  vColor = colour * (0.85 + 0.3 * twinkle) + crest * 0.3 + spark * 0.4;
  vHalo = dust ? 0.0 : 0.08 + 0.14 * fast + crest * 0.25 + spark * 0.5;
  vAlpha = ((alpha + crest * 0.3 * alpha) * mix(0.6, 1.12, depth) * twinkle + near * 0.14) * visible;
}`;

export const THREAD_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uCool;
varying vec3 vColor;
varying float vAlpha;
varying float vHalo;
varying float vInk;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float core = exp(-d * 15.0);
  float halo = vHalo * exp(-d * 3.4) * (1.0 - d) * (1.0 - d);
  float light = vAlpha * (core + halo);
  // On paper the same particle is luminous ink: a firm core in the page's blue ink,
  // and round it a faint aura of the light it was, laid over the paper.
  float inkCore = min(1.0, vAlpha * 1.5 * exp(-d * 8.0));
  float aura = vAlpha * 0.32 * exp(-d * 2.2) * (1.0 - d);
  vec3 inkRgb = uInk * inkCore + uCool * aura;
  float inkA = inkCore + aura * (1.0 - inkCore);
  gl_FragColor = vec4(mix(vColor * light, inkRgb, vInk), vInk * inkA);
}`;
