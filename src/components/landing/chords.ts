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
