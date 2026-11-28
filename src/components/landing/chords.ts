/**
 * The chord problem's mathematics, and the figure it is drawn in.
 *
 * The figure is an SVG the reader can hold (ChordPlayground.tsx), and the
 * WebGL stage draws the thread of light into its circle before handing over
 * (scenePlayground.ts). Both work from the numbers here, so the light lands
 * exactly on the SVG's stroke. Nothing in this file needs the DOM or three.
 */

export const CHORD_RADIUS = 17;
export const CHORD_POINT = { x: 8, y: 6 };
export const INITIAL_CHORD_ANGLE = Math.atan2(6, 8) * 180 / Math.PI;
export function chordEndpoints(degrees: number) {
  const angle = degrees * Math.PI / 180;
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const dot = CHORD_POINT.x * ux + CHORD_POINT.y * uy;
  const power = CHORD_RADIUS ** 2 - CHORD_POINT.x ** 2 - CHORD_POINT.y ** 2;
  const root = Math.sqrt(dot ** 2 + power);
  const near = root - dot, far = root + dot;
  return {
    c: { x: CHORD_POINT.x + near * ux, y: CHORD_POINT.y + near * uy },
    d: { x: CHORD_POINT.x - far * ux, y: CHORD_POINT.y - far * uy },
    near, far, power,
  };
}

// ---------------------------------------------------------------------------
// The figure on the page, shared by the SVG and the stage
// ---------------------------------------------------------------------------

/** The figure's viewBox, its circle's centre, and how many viewBox units one unit of the problem is drawn at. */
export const FIGURE = { W: 600, H: 390, CX: 300, CY: 190, UNIT: 8 } as const;
/** The circle's radius in viewBox units: 136. */
export const FIGURE_R = CHORD_RADIUS * FIGURE.UNIT;

/**
 * Where the circle's centre is on screen, as a share of the viewport's
 * height, when the thread of light has closed into it. The figure draws
 * itself in from that moment, so the light is there first and hands over.
 */
export const CIRCLE_ARRIVES_AT = 0.55;

/** The same moment, as an edge pair for stageLayout.ts: the circle's centre (a share of the figure's height) meets that line. */
export const HANDOVER_EDGE = `${(FIGURE.CY / FIGURE.H).toFixed(5)} ${CIRCLE_ARRIVES_AT}`;

/**
 * The card the problem is printed on: how far it rises as it arrives (px),
 * how far at most it tilts toward the pointer (degrees), and the perspective
 * it tilts in (px). The stage applies the same numbers to the circle of light.
 */
export const CARD = { RISE: 70, TILT: 4, PERSPECTIVE: 1600 } as const;

/** The names the stage reads the card's live values by (readStageValue): the very numbers the DOM draws with. */
export const PLAY_KEYS = { arrive: 'play-arrive', tiltX: 'play-tilt-x', tiltY: 'play-tilt-y' } as const;

interface Box { top: number; left: number; width: number; height: number }

/**
 * The circle inside a box that holds the whole figure. The SVG keeps its
 * default preserveAspectRatio (xMidYMid meet): the viewBox is scaled to fit
 * and centred, so the circle is found the same way the browser places it.
 */
export function circleInBox(box: Box): { x: number; y: number; r: number } {
  const k = Math.min(box.width / FIGURE.W, box.height / FIGURE.H);
  return {
    x: box.left + (box.width - FIGURE.W * k) / 2 + FIGURE.CX * k,
    y: box.top + (box.height - FIGURE.H * k) / 2 + FIGURE.CY * k,
    r: FIGURE_R * k,
  };
}

/**
 * Where a point of the card lands on screen when the card is tilted: CSS's
 * `perspective(P) rotateX(x) rotateY(y)` about the card's centre, applied to
 * an offset (dx, dy) from that centre (CSS px, y down). Returns the offset on
 * screen. Angles in radians.
 */
export function tiltPoint(dx: number, dy: number, rotateX: number, rotateY: number, perspective: number): [number, number] {
  const cosY = Math.cos(rotateY);
  const sinY = Math.sin(rotateY);
  const cosX = Math.cos(rotateX);
  const sinX = Math.sin(rotateX);
  // rotateY acts first (it is last in the list), then rotateX, then the perspective divide.
  const x1 = dx * cosY;
  const z1 = -dx * sinY;
  const y2 = dy * cosX - z1 * sinX;
  const z2 = dy * sinX + z1 * cosX;
  const f = perspective / Math.max(1, perspective - z2);
  return [x1 * f, y2 * f];
}
