import { describe, expect, it } from 'vitest';
import {
  DEMO, DEMO_POINTS, TRIANGLE, demoPoint, demoProgress, deskPose, planePoint, planeTransform, projectDesk, quadToSquare,
  sheetPoint, sheetTransform, squareToQuad, type DeskLayout, type Quad,
} from './deskStage';

const layout: DeskLayout = { origin: [700, 400], sheet: [560, 420] };

describe('the desk pose', () => {
  it('settles from a steeper lean to its resting angle', () => {
    const arriving = deskPose(0, false);
    const settled = deskPose(1, false);
    expect(arriving.tiltX).toBeGreaterThan(settled.tiltX);
    expect(arriving.rise).toBeGreaterThan(0);
    expect(settled.rise).toBe(0);
    expect(deskPose(1, true).tiltX).toBeLessThan(settled.tiltX);
  });

  it('writes the transforms the arithmetic follows', () => {
    const pose = deskPose(1, false);
    expect(planeTransform(pose)).toBe('translate3d(0px, 0px, 0px) rotateX(25deg) rotateZ(-5deg)');
    expect(sheetTransform(pose, 0)).toBe('translate3d(0px, 0px, 0px) rotateZ(0deg) rotateX(0deg)');
    expect(sheetTransform(pose, 1)).toBe('translate3d(0px, 0px, 26px) rotateZ(5deg) rotateX(-25deg)');
  });
});

describe('following a point of the sheet to the page', () => {
  it('leaves the plane where it is when nothing is turned', () => {
    const pose = { tiltX: 0, tiltZ: 0, rise: 0, perspective: 1600 };
    expect(projectDesk(layout, pose, sheetPoint(layout, pose, 0, 500, 300))).toEqual([500, 300]);
  });

  it('tips the top of the desk away and the front toward the reader', () => {
    const pose = deskPose(1, false);
    const top = planePoint(layout, pose, 700, 200);
    const front = planePoint(layout, pose, 700, 600);
    expect(top[2]).toBeLessThan(0);
    expect(front[2]).toBeGreaterThan(0);
    // Foreshortened: the far edge draws narrower than the near one.
    const farWidth = projectDesk(layout, pose, planePoint(layout, pose, 900, 200))[0] - projectDesk(layout, pose, planePoint(layout, pose, 500, 200))[0];
    const nearWidth = projectDesk(layout, pose, planePoint(layout, pose, 900, 600))[0] - projectDesk(layout, pose, planePoint(layout, pose, 500, 600))[0];
    expect(farWidth).toBeLessThan(nearWidth);
  });

  it('faces the reader square once the sheet is flat', () => {
    const pose = deskPose(1, false);
    const corners = [[400, 300], [720, 300], [720, 540], [400, 540]].map(([x, y]) => sheetPoint(layout, pose, 1, x, y));
    for (const corner of corners) expect(corner[2]).toBeCloseTo(corners[0][2], 6);
    const flat = corners.map(corner => projectDesk(layout, pose, corner));
    expect(flat[0][1]).toBeCloseTo(flat[1][1], 6);
    expect(flat[0][0]).toBeCloseTo(flat[3][0], 6);
    // Its proportions are the paper's.
    expect((flat[1][0] - flat[0][0]) / (flat[3][1] - flat[0][1])).toBeCloseTo(320 / 240, 6);
  });
});

describe('mapping the pointer back onto the paper', () => {
  it('inverts the map from the square to a quad', () => {
    const pose = deskPose(0.6, false);
    const quad = [[400, 300], [720, 300], [720, 540], [400, 540]].map(([x, y]) => projectDesk(layout, pose, sheetPoint(layout, pose, 0.3, x, y))) as unknown as Quad;
    const map = squareToQuad(quad);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.25, 0.7], [0.5, 0.5]]) {
      // The true point of the paper, followed to the screen…
      const [x, y] = projectDesk(layout, pose, sheetPoint(layout, pose, 0.3, 400 + u * 320, 300 + v * 240));
      // …comes back to where it was.
      const [bu, bv] = quadToSquare(map, x, y);
      expect(bu).toBeCloseTo(u, 6);
      expect(bv).toBeCloseTo(v, 6);
    }
  });

  it('handles a quad that is only moved and scaled', () => {
    const map = squareToQuad([[10, 20], [110, 20], [110, 70], [10, 70]]);
    expect(quadToSquare(map, 60, 45)).toEqual([0.5, 0.5]);
  });
});

describe('the pencil on the triangle', () => {
  it('starts at the right angle and ends where the last stroke does', () => {
    expect(demoPoint(0)).toMatchObject({ x: TRIANGLE.A[0], y: TRIANGLE.A[1], stroke: 0 });
    const last = DEMO[DEMO.length - 1].points;
    const end = demoPoint(DEMO_POINTS);
    expect(end.x).toBeCloseTo(last[last.length - 2], 9);
    expect(end.y).toBeCloseTo(last[last.length - 1], 9);
    expect(end.stroke).toBe(DEMO.length - 1);
  });

  it('moves smoothly between the points it draws', () => {
    const a = demoPoint(10);
    const b = demoPoint(10.5);
    const c = demoPoint(11);
    expect(b.x).toBeCloseTo((a.x + c.x) / 2, 9);
  });

  it('waits a moment, then draws, slowing at the end', () => {
    expect(demoProgress(0)).toBe(0);
    expect(demoProgress(350 + 1300)).toBeCloseTo(0.75, 9);
    expect(demoProgress(10000)).toBe(1);
  });
});
