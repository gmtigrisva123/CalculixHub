/**
 * The point sets the landing page's particle stages are drawn from.
 *
 * Pure functions with no WebGL in them, so every form can be tested and the
 * 2D fallback can draw exactly what the shader would. Each form is a piece of
 * real mathematics rather than a decorative blob, chosen so that it belongs to
 * the domain it stands for:
 *
 *   - the Möbius strip, for the hero: one side, one edge, and a path you can
 *     follow forever without crossing a boundary;
 *   - the monkey saddle z = Re((x + iy)³) = x³ − 3xy², for Algebra;
 *   - the icosahedron's edges projected onto its circumscribed sphere, for
 *     Geometry;
 *   - the 4-cube Q₄, whose 16 vertices are the subsets of {1, 2, 3, 4} and whose
 *     32 edges join subsets that differ by one element, for Combinatorics;
 *   - the times table modulo n, whose chords k → 2k wrap a cardioid, for
 *     Number Theory.
 *
 * Every world form is laid out as `count` vec4s (x, y, z, w). Most are plain
 * positions; Q₄ uses w for its fourth coordinate, and the times table stores
 * chord coordinates the shader turns into positions (see WORLD_KIND). All forms
 * fit inside a ball of radius ~2.4 so the camera frames them alike.
 */

export type Rng = () => number;

/** A small, fast, seedable generator: the same seed draws the same forms. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The hero: a Möbius strip
// ---------------------------------------------------------------------------

/** Centre-line radius and half-width of the strip. Mirrored in the hero shader. */
export const MOBIUS = { radius: 1.75, halfWidth: 0.62 } as const;

/**
 * A point on the strip. `u` runs along it (period 4π: one lap flips the
 * side, the second brings it back) and `s` across it, in [-halfWidth, halfWidth].
 * The strip lies in the x/z plane with its twist rising through y.
 */
export function mobiusPoint(u: number, s: number): [number, number, number] {
  const half = u / 2;
  const reach = MOBIUS.radius + s * Math.cos(half);
  return [reach * Math.cos(u), s * Math.sin(half), reach * Math.sin(u)];
}

export interface MobiusLayout {
  /** Per particle: u, s, speed factor, seed. Dust particles carry a negative seed. */
  params: Float32Array;
  count: number;
  rails: number;
}

/**
 * The strip as rails of light: `rails` lines across its width, each carrying
 * `perRail` particles that the shader slides along u. Rails at ±s swap places
 * after one lap, so the flow never shows a seam. A little loose dust around the
 * strip gives the stage depth.
 */
export function mobiusLayout(rails: number, perRail: number, dust: number, rng: Rng = mulberry32(11)): MobiusLayout {
  const count = rails * perRail + dust;
  const params = new Float32Array(count * 4);
  let index = 0;
  for (let rail = 0; rail < rails; rail += 1) {
    const s = rails === 1 ? 0 : -MOBIUS.halfWidth + (2 * MOBIUS.halfWidth * rail) / (rails - 1);
    // Edge rails move a touch faster than the middle, which reads as depth.
    const speed = 0.85 + 0.3 * Math.abs(s / MOBIUS.halfWidth);
    for (let k = 0; k < perRail; k += 1) {
      const jitter = (rng() - 0.5) * 0.55;
      params[index * 4] = ((k + jitter) / perRail) * Math.PI * 2;
      params[index * 4 + 1] = s + (rng() - 0.5) * 0.012;
      params[index * 4 + 2] = speed * (0.94 + rng() * 0.12);
      params[index * 4 + 3] = 0.02 + rng() * 0.98;
      index += 1;
    }
  }
  for (let k = 0; k < dust; k += 1) {
    // Dust stores a direction and a radius instead of strip coordinates.
    params[index * 4] = rng() * Math.PI * 2;
    params[index * 4 + 1] = Math.acos(2 * rng() - 1);
    params[index * 4 + 2] = 2.6 + rng() * 2.6;
    params[index * 4 + 3] = -(0.02 + rng() * 0.98);
    index += 1;
  }
  return { params, count, rails };
}

// ---------------------------------------------------------------------------
// The four worlds
// ---------------------------------------------------------------------------

export interface WorldForm {
  /** count × (x, y, z, w). */
  points: Float32Array;
  /** Relative point size, 1 for an ordinary particle. */
  sizes: Float32Array;
  /** 0–1 position between the form's two colours. */
  tones: Float32Array;
}

function allocate(count: number): WorldForm {
  return { points: new Float32Array(count * 4), sizes: new Float32Array(count), tones: new Float32Array(count) };
}

function put(form: WorldForm, index: number, x: number, y: number, z: number, w: number, size: number, tone: number) {
  form.points[index * 4] = x;
  form.points[index * 4 + 1] = y;
  form.points[index * 4 + 2] = z;
  form.points[index * 4 + 3] = w;
  form.sizes[index] = size;
  form.tones[index] = tone;
}

/**
 * Rounding a share per ring or per edge can leave a few slots unfilled. They
 * repeat earlier points rather than collapsing to the origin, where a stray
 * cluster would be the one thing on the stage that is not mathematics.
 */
function complete(form: WorldForm, filled: number, count: number) {
  for (let index = filled; index < count; index += 1) {
    const source = filled > 0 ? index % filled : 0;
    form.points.copyWithin(index * 4, source * 4, source * 4 + 4);
    form.sizes[index] = form.sizes[source];
    form.tones[index] = form.tones[source];
  }
}

/**
 * Algebra: the monkey saddle z = r³ cos 3θ, the real part of (x + iy)³, over
 * the unit disc. Points sit on concentric rings, each holding a share in
 * proportion to its circumference so the surface is evenly lit; the rim ring
 * is a little brighter so the three-fold ruffle reads at a glance.
 */
export function saddleForm(count: number, rng: Rng = mulberry32(21)): WorldForm {
  const form = allocate(count);
  const rings = Math.max(8, Math.round(Math.sqrt(count / 9)));
  const weights = Array.from({ length: rings }, (_, k) => k + 0.5);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const rimShare = 0.08;
  const rim = Math.round(count * rimShare);
  const body = count - rim;
  let index = 0;
  let placed = 0;
  for (let k = 0; k < rings; k += 1) {
    const share = Math.max(0, k === rings - 1 ? body - placed : Math.min(body - placed, Math.round((weights[k] / total) * body)));
    placed += share;
    const r = (k + 0.5) / rings;
    for (let j = 0; j < share; j += 1) {
      const theta = ((j + rng() * 0.6) / Math.max(1, share)) * Math.PI * 2 + k * 0.37;
      const height = r * r * r * Math.cos(3 * theta);
      put(form, index, 2.15 * r * Math.cos(theta), 1.05 * height, 2.15 * r * Math.sin(theta), 0, 0.9, 0.5 + 0.5 * height);
      index += 1;
    }
  }
  for (let j = 0; j < rim; j += 1) {
    const theta = (j / rim) * Math.PI * 2;
    const height = Math.cos(3 * theta);
    put(form, index, 2.15 * Math.cos(theta), 1.05 * height, 2.15 * Math.sin(theta), 0, 1.5, 0.5 + 0.5 * height);
    index += 1;
  }
  complete(form, index, count);
  return form;
}

/** The 12 vertices of a regular icosahedron, on the unit sphere. */
export function icosahedronVertices(): [number, number, number][] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ];
  return raw.map(([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  });
}

/** Vertex pairs at the icosahedron's edge length: its 30 edges. */
export function icosahedronEdges(vertices = icosahedronVertices()): [number, number][] {
  let shortest = Infinity;
  for (let a = 0; a < vertices.length; a += 1) {
    for (let b = a + 1; b < vertices.length; b += 1) {
      shortest = Math.min(shortest, Math.hypot(vertices[a][0] - vertices[b][0], vertices[a][1] - vertices[b][1], vertices[a][2] - vertices[b][2]));
    }
  }
  const edges: [number, number][] = [];
  for (let a = 0; a < vertices.length; a += 1) {
    for (let b = a + 1; b < vertices.length; b += 1) {
      const d = Math.hypot(vertices[a][0] - vertices[b][0], vertices[a][1] - vertices[b][1], vertices[a][2] - vertices[b][2]);
      if (Math.abs(d - shortest) < 1e-6) edges.push([a, b]);
    }
  }
  return edges;
}

/**
 * Geometry: the icosahedron's 30 edges drawn as great-circle arcs on the
 * sphere around it, its 12 vertices as bright nodes, and a faint Fibonacci
 * lattice over the rest of the surface.
 */
export function geodesicForm(count: number, rng: Rng = mulberry32(31)): WorldForm {
  const form = allocate(count);
  const radius = 2.05;
  const vertices = icosahedronVertices();
  const edges = icosahedronEdges(vertices);
  const nodeCount = Math.min(count, vertices.length * 14);
  const arcCount = Math.round((count - nodeCount) * 0.58);
  const surfaceCount = count - nodeCount - arcCount;
  let index = 0;

  for (let j = 0; j < nodeCount; j += 1) {
    const [x, y, z] = vertices[j % vertices.length];
    const spread = 0.035;
    put(form, index, radius * (x + (rng() - 0.5) * spread), radius * (y + (rng() - 0.5) * spread), radius * (z + (rng() - 0.5) * spread), 0, 2.1, 1);
    index += 1;
  }
  for (let j = 0; j < arcCount; j += 1) {
    const [a, b] = edges[j % edges.length];
    const t = (Math.floor(j / edges.length) + rng() * 0.4) / Math.ceil(arcCount / edges.length);
    // Spherical interpolation between the two vertices.
    const va = vertices[a];
    const vb = vertices[b];
    const omega = Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const sa = Math.sin((1 - t) * omega) / Math.sin(omega);
    const sb = Math.sin(t * omega) / Math.sin(omega);
    put(form, index, radius * (sa * va[0] + sb * vb[0]), radius * (sa * va[1] + sb * vb[1]), radius * (sa * va[2] + sb * vb[2]), 0, 1.05, 0.72);
    index += 1;
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let j = 0; j < surfaceCount; j += 1) {
    const y = 1 - (2 * (j + 0.5)) / surfaceCount;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * j;
    put(form, index, radius * ring * Math.cos(theta), radius * y, radius * ring * Math.sin(theta), 0, 0.55, 0.15 + 0.2 * rng());
    index += 1;
  }
  return form;
}

/** The 16 vertices of the 4-cube, (±1, ±1, ±1, ±1), indexed by their bit pattern. */
export function tesseractVertices(): [number, number, number, number][] {
  return Array.from({ length: 16 }, (_, bits) => [
    bits & 1 ? 1 : -1, bits & 2 ? 1 : -1, bits & 4 ? 1 : -1, bits & 8 ? 1 : -1,
  ] as [number, number, number, number]);
}

/** Pairs of vertices whose bit patterns differ in exactly one place: Q₄'s 32 edges. */
export function tesseractEdges(): [number, number][] {
  const edges: [number, number][] = [];
  for (let a = 0; a < 16; a += 1) {
    for (let bit = 0; bit < 4; bit += 1) {
      const b = a ^ (1 << bit);
      if (a < b) edges.push([a, b]);
    }
  }
  return edges;
}

/**
 * Combinatorics: Q₄ in four dimensions. Particles fill its 32 edges and gather
 * at its 16 vertices; the shader turns the whole figure through the x–w and z–w
 * planes and projects it, which is why the inner cube appears to turn inside out.
 */
export function tesseractForm(count: number, rng: Rng = mulberry32(41)): WorldForm {
  const form = allocate(count);
  const vertices = tesseractVertices();
  const edges = tesseractEdges();
  const scale = 0.92;
  const nodeCount = Math.min(count, 16 * 18);
  const edgeCount = count - nodeCount;
  let index = 0;
  for (let j = 0; j < nodeCount; j += 1) {
    const v = vertices[j % 16];
    const spread = 0.03;
    put(form, index, scale * (v[0] + (rng() - 0.5) * spread), scale * (v[1] + (rng() - 0.5) * spread), scale * (v[2] + (rng() - 0.5) * spread), scale * v[3], 2.3, 1);
    index += 1;
  }
  const perEdge = Math.ceil(edgeCount / edges.length);
  for (let j = 0; j < edgeCount; j += 1) {
    const [a, b] = edges[j % edges.length];
    const t = (Math.floor(j / edges.length) + 0.5 + (rng() - 0.5) * 0.5) / perEdge;
    const va = vertices[a];
    const vb = vertices[b];
    // Edges that run through w are the "time" edges between the two cubes; tint them.
    const throughW = va[3] !== vb[3];
    put(
      form, index,
      scale * (va[0] + (vb[0] - va[0]) * t), scale * (va[1] + (vb[1] - va[1]) * t),
      scale * (va[2] + (vb[2] - va[2]) * t), scale * (va[3] + (vb[3] - va[3]) * t),
      1, throughW ? 0.15 : 0.7,
    );
    index += 1;
  }
  return form;
}

/** Chords in the modular times table. */
export const MODULAR_CHORDS = 240;
/** Radius of the times-table circle. Mirrored in the worlds shader. */
export const MODULAR_RADIUS = 2.2;

/**
 * A point on the chord from k to m·k (mod n) of the times table, t of the way
 * along it. The circle lies in the x/z plane. `m` may be fractional: the shader
 * turns it slowly, and the envelope of the chords flows from one curve into the
 * next — a cardioid at 2, a nephroid at 3.
 */
export function modularPoint(k: number, t: number, m: number, chords = MODULAR_CHORDS): [number, number, number] {
  const from = (2 * Math.PI * k) / chords;
  const to = (2 * Math.PI * m * k) / chords;
  const x = Math.cos(from) + (Math.cos(to) - Math.cos(from)) * t;
  const z = Math.sin(from) + (Math.sin(to) - Math.sin(from)) * t;
  return [MODULAR_RADIUS * x, 0, MODULAR_RADIUS * z];
}

/**
 * Number Theory: the times table read modulo n. Number k on a circle of n
 * points is joined to m·k (mod n); for m = 2 the chords' envelope is a
 * cardioid. Arithmetic in ℤ/nℤ, drawn. Each particle stores which chord it is
 * on and how far along (x = k/n, y = t), and the shader places it for the
 * current multiplier. Points crowd where chords overlap, so the envelope glows.
 */
export function modularForm(count: number, rng: Rng = mulberry32(51)): WorldForm {
  const form = allocate(count);
  const rim = Math.round(count * 0.12);
  for (let index = 0; index < count; index += 1) {
    if (index < rim) {
      // The circle itself, with the n residues as brighter beads.
      const k = (index / rim) * MODULAR_CHORDS;
      const bead = Math.abs(k - Math.round(k)) < 0.08;
      put(form, index, Math.round(k) / MODULAR_CHORDS, 0, (rng() - 0.5) * 0.03, 0, bead ? 1.5 : 0.7, 0.9);
      continue;
    }
    const k = Math.floor(rng() * MODULAR_CHORDS);
    const t = rng();
    put(form, index, k / MODULAR_CHORDS, t, (rng() - 0.5) * 0.05, 0, 0.85, 0.2 + 0.7 * Math.abs(t - 0.5) * 2);
  }
  return form;
}

/** The four worlds in the order the page tells them. */
export const WORLD_ORDER = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'] as const;

export function worldForms(count: number): WorldForm[] {
  return [saddleForm(count), geodesicForm(count), tesseractForm(count), modularForm(count)];
}

/**
 * How the shader reads each form: 0 as a position, 1 as a point in four
 * dimensions to turn and project, 2 as a (chord, distance) pair on the times table.
 */
export const WORLD_KIND = [0, 0, 1, 2] as const;
