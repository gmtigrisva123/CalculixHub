export const TRIANGLE = { left: 150, right: 450, top: 80, bottom: 270, minX: 70, maxX: 530, initialX: 300 } as const;
export function clampVertex(x: number): number {
  return Number.isFinite(x) ? Math.max(TRIANGLE.minX, Math.min(TRIANGLE.maxX, x)) : TRIANGLE.initialX;
}
export function triangleArea(x: number): number {
  return Math.abs((TRIANGLE.left * (TRIANGLE.bottom - TRIANGLE.top) + TRIANGLE.right * (TRIANGLE.top - TRIANGLE.bottom) + clampVertex(x) * (TRIANGLE.bottom - TRIANGLE.bottom)) / 2);
}
