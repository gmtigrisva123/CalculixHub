import { describe, expect, it } from 'vitest';
import {
  STAIRS, STEP, clipToView, flatEdges, labelIn, overviewPose, perspectiveProject, reached, resampleInto, rotateX, rotateY, sheetLift, sheetPoint,
  sheetRect, stackPoint, stairEdges, stairsCamera, stairsFocus, stairsProgress, trackOffset, trackPose, trackTransform, type StairsMeasure,
} from './archiveStairs';
import { POLY_SAMPLES, resampleByLength, type Point } from './threadShapes';

// A 1440 × 900 stage; four stacks 300px wide on a 460px pitch, standing on the track's floor.
const H = 560;
const measure: StairsMeasure = {
  pin: { width: 1440, height: 1300 },
  view: { width: 1440, height: 900 },
  track: { left: 0, top: 1300 - H, width: 4 * 460, height: H },
  stacks: STEP.map((k, i) => ({ left: 80 + i * 460, top: H - k * H, width: 300, height: k * H })),
  depth: 375,
};
const camera = stairsCamera(1440, 900);

describe('the staircase’s timing, as a pure function of the scroll', () => {
  it('waits before the first stack through the opening shot, then climbs to the last', () => {
    expect(sheetLift(stairsFocus(0), 0)).toBe(0);
    expect(stairsFocus(STAIRS.opening)).toBeCloseTo(0);
    expect(stairsFocus(1)).toBeCloseTo(STEP.length - 1);
  });

  it('never moves back as the page scrolls down, and rewinds exactly', () => {
    const forward = Array.from({ length: 201 }, (_, i) => stairsFocus(i / 200));
    for (let i = 1; i < forward.length; i += 1) expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1]);
    const back = Array.from({ length: 201 }, (_, i) => stairsFocus((200 - i) / 200)).reverse();
    expect(back).toEqual(forward);
  });

  it('holds on the last stack before the pin lets go', () => {
    const settled = stairsFocus(1 - 0.04);
    expect(settled).toBe(STEP.length - 1);
    expect(sheetLift(settled, STEP.length - 1)).toBe(1);
  });

  it('runs from the pin to its release, not to the runway’s end', () => {
    const runway = { top: 1000, height: 3400 };
    expect(stairsProgress(runway, 1260, 1000)).toBe(0);
    // The stage lets go when the runway's foot reaches the stage's foot.
    expect(stairsProgress(runway, 1260, 1000 + 3400 - 1260)).toBe(1);
    expect(stairsProgress(runway, 1260, 900)).toBe(0);
  });

  it('slows as each stack passes the centre', () => {
    const rate = (p: number) => (stairsFocus(p + 0.001) - stairsFocus(p - 0.001)) / 0.002;
    // Progress at which the focus crosses stack 1, and halfway between stacks 1 and 2.
    const at = (target: number) => {
      let lo = 0; let hi = 1;
      for (let i = 0; i < 40; i += 1) { const mid = (lo + hi) / 2; if (stairsFocus(mid) < target) lo = mid; else hi = mid; }
      return lo;
    };
    expect(rate(at(1))).toBeLessThan(rate(at(1.5)) / 3);
  });

  it('lifts a stack’s top sheet only near the centre, symmetrically', () => {
    expect(sheetLift(2, 2)).toBe(1);
    expect(sheetLift(2.05, 2)).toBe(1);
    expect(sheetLift(2.9, 2)).toBe(0);
    expect(sheetLift(1.7, 2)).toBeCloseTo(sheetLift(2.3, 2));
    expect(sheetLift(2.3, 2)).toBeGreaterThan(0);
    expect(sheetLift(2.3, 2)).toBeLessThan(1);
  });

  it('shows a stack’s count and format once it reaches the centre, and keeps them after', () => {
    expect(labelIn(0.4, 1)).toBe(0);
    expect(labelIn(0.95, 1)).toBe(1);
    expect(labelIn(3, 1)).toBe(1);
    expect(reached(0.5, 1)).toBe(false);
    expect(reached(0.6, 1)).toBe(true);
  });
});

describe('the CSS 3D projection, replayed', () => {
  it('turns the way CSS turns', () => {
    // rotateY(+90deg) sends an element's right edge away from the viewer; rotateX(+90deg) its top edge.
    const right = rotateY([1, 0, 0], 90);
    expect(right[0]).toBeCloseTo(0);
    expect(right[2]).toBeCloseTo(-1);
    const top = rotateX([0, -1, 0], 90);
    expect(top[1]).toBeCloseTo(0);
    expect(top[2]).toBeCloseTo(-1);
  });

  it('divides by depth about the perspective origin', () => {
    expect(perspectiveProject(camera, [camera.ox, camera.oy, -500])).toEqual([camera.ox, camera.oy]);
    const [x] = perspectiveProject(camera, [camera.ox + 100, camera.oy, -camera.perspective]);
    expect(x).toBeCloseTo(camera.ox + 50);
    const [near] = perspectiveProject(camera, [camera.ox + 100, camera.oy, 0]);
    expect(near).toBeCloseTo(camera.ox + 100);
  });

  it('brings the stack in focus to the focus point', () => {
    for (const focus of [0, 1, 2, 3]) {
      const offset = trackOffset(measure, focus);
      const box = measure.stacks[focus];
      // The middle of the front top edge lies on the stack's turning axis, so the turn does not move it.
      const [x, y, z] = stackPoint(measure, offset, focus, box.width / 2, 0);
      expect(x).toBeCloseTo(measure.view.width * STAIRS.focusX);
      expect(y).toBeCloseTo(measure.view.height * STAIRS.focusY);
      expect(z).toBeCloseTo(0);
    }
  });

  it('opens on the whole staircase, then moves in to the first stack without a jump', () => {
    const wide = overviewPose(measure);
    expect(wide.scale).toBeLessThan(1);
    // Every stack is on screen in the opening shot.
    for (let i = 0; i < STEP.length; i += 1) {
      const [left] = perspectiveProject(camera, stackPoint(measure, wide, i, 0, 0));
      const [right] = perspectiveProject(camera, stackPoint(measure, wide, i, measure.stacks[i].width, 0));
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(measure.view.width);
    }
    expect(trackPose(measure, 0)).toEqual(wide);
    expect(trackPose(measure, STAIRS.opening)).toEqual(trackOffset(measure, 0));
    const before = trackPose(measure, STAIRS.opening - 1e-6);
    const after = trackPose(measure, STAIRS.opening + 1e-6);
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.5);
    expect(Math.abs(before.scale - after.scale)).toBeLessThan(1e-3);
    expect(trackTransform({ x: 1, y: 2, scale: 1 })).toBe('translate3d(1.00px, 2.00px, 0px) scale3d(1.0000, 1.0000, 1.0000)');
  });

  it('climbs: the floor drops as the focus moves to the taller stacks', () => {
    const floor = (focus: number) => trackOffset(measure, focus).y;
    expect(floor(3)).toBeGreaterThan(floor(0));
    expect(floor(3) - floor(0)).toBeCloseTo((STEP[3] - STEP[0]) * H);
  });

  it('lays a flat sheet on its stack and stands a lifted one up, square to the viewer', () => {
    const offset = trackOffset(measure, 1);
    const box = measure.stacks[1];
    // Flat: the sheet's far edge lies back along the stack's top, at the height of the top edge.
    const flatFar = sheetPoint(measure, offset, 1, 0, box.width / 2, 0);
    const edge = stackPoint(measure, offset, 1, box.width / 2, 0);
    expect(flatFar[1]).toBeCloseTo(edge[1] - 1.5, 1);
    expect(flatFar[2]).toBeLessThan(-measure.depth * 0.9);
    // Lifted: the sheet stands above the edge, its two top corners at the same depth (no turn left).
    const left = sheetPoint(measure, offset, 1, 1, 0, 0);
    const right = sheetPoint(measure, offset, 1, 1, box.width, 0);
    expect(left[2]).toBeCloseTo(right[2]);
    expect(left[1]).toBeLessThan(edge[1] - measure.depth * 0.9);
  });

  it('runs the stair edges up and to the right, one tread per stack', () => {
    const points = stairEdges(measure, camera, trackOffset(measure, 1.5));
    // In along the floor, up the first riser, then a riser and a tread per stack, then out.
    expect(points).toHaveLength(2 + 2 + 3 * (STEP.length - 1) + 1);
    // Each tread's far end is higher on screen (smaller y) than the last.
    const treads = [3, 6, 9, 12].map(i => points[i][1]);
    for (let i = 1; i < treads.length; i += 1) expect(treads[i]).toBeLessThan(treads[i - 1]);
    for (let i = 1; i < points.length; i += 1) expect(points[i][0]).toBeGreaterThan(points[i - 1][0] - 40);
  });

  it('finds a lifted sheet above its stack', () => {
    const offset = trackOffset(measure, 2);
    const rect = sheetRect(measure, camera, offset, 2, 1);
    const top = perspectiveProject(camera, stackPoint(measure, offset, 2, 150, 0))[1];
    expect(rect.top + rect.height).toBeLessThanOrEqual(top);
    expect(rect.height).toBeGreaterThan(measure.depth * 0.9);
  });
});

describe('the stair edges on a flat list', () => {
  it('climbs a row as stairs', () => {
    const row = [0, 1, 2].map(i => ({ left: i * 220, top: 300 - i * 60, width: 200, height: 100 + i * 60 }));
    const points = flatEdges(row, 12);
    expect(points[0]).toEqual([-12, 300, 0]);
    expect(points).toContainEqual([220, 300, 0]);
    expect(points).toContainEqual([220, 240, 0]);
    expect(points[points.length - 1][0]).toBeGreaterThan(row[2].left + row[2].width);
  });

  it('zigzags down a column, switching sides in the gutters', () => {
    const column = [0, 1, 2].map(i => ({ left: 20, top: i * 500, width: 350, height: 120 }));
    const points = flatEdges(column, 10);
    const xs = points.map(p => p[0]);
    expect(Math.max(...xs)).toBe(380);
    expect(Math.min(...xs)).toBe(10);
    // Never runs back up the page.
    for (let i = 1; i < points.length; i += 1) expect(points[i][1]).toBeGreaterThanOrEqual(points[i - 1][1]);
  });
});

describe('keeping the thread to what is on screen', () => {
  it('cuts a path at the edges of the view, keeping what lies between', () => {
    const path: [number, number, number][] = [[-500, 100, 0], [-100, 100, 0], [300, 100, 0], [300, 40, 0], [2000, 40, 0]];
    const seen = clipToView(path, 0, 0, 1000, 800);
    expect(seen[0]).toEqual([0, 100, 0]);
    expect(seen).toContainEqual([300, 100, 0]);
    expect(seen).toContainEqual([300, 40, 0]);
    expect(seen[seen.length - 1]).toEqual([1000, 40, 0]);
  });

  it('leaves a path that is wholly inside alone, and one wholly outside whole', () => {
    const inside: [number, number, number][] = [[10, 10, 0], [20, 30, 0], [40, 30, 0]];
    expect(clipToView(inside, 0, 0, 100, 100)).toEqual(inside);
    const outside: [number, number, number][] = [[-50, -50, 0], [-10, -80, 0]];
    expect(clipToView(outside, 0, 0, 100, 100)).toEqual(outside);
  });
});

describe('resampling into a kept buffer', () => {
  it('matches the shared resampler', () => {
    const points: Point[] = [[0, 0, 0], [100, 0, 0], [100, 50, 0], [100, 50, 0], [300, 80, 10]];
    const out = resampleInto(points, new Float32Array(POLY_SAMPLES * 4));
    const expected = resampleByLength(points);
    for (let i = 0; i < out.length; i += 1) expect(out[i]).toBeCloseTo(expected[i], 3);
  });
});
