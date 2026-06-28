import { describe, expect, it } from "vitest";
import {
  expandFrameToAspect,
  expandViewBoxRectToAspect,
  focusedViewBox,
  panViewBoxByPixels,
  resolveGridCameraFocus,
  rotatePointAround,
  zoomViewBoxAt,
} from "../composables/useGridMapTransform.js";
import { utilityData } from '../../testing/content.js';
import { buildBuilding } from "../composables/useGrid.js";

const frame = {
  minX: 0,
  maxX: 400,
  minY: 0,
  maxY: 200,
  bcx: 200,
  bcy: 100,
};

describe("grid map viewport contract", () => {
  it("preserves the canonical gameplay center while adapting to panel aspect", () => {
    const wide = expandFrameToAspect(frame, 16 / 9);
    const tall = expandFrameToAspect(frame, 3 / 4);

    expect(wide.bcx).toBe(200);
    expect(wide.bcy).toBe(100);
    expect(tall.bcx).toBe(200);
    expect(tall.bcy).toBe(100);
    expect(wide.w / wide.h).toBeCloseTo(16 / 9);
    expect(tall.w / tall.h).toBeCloseTo(3 / 4);
  });

  it("fits the content frame without adding a second zoom-out margin", () => {
    const fitAll = expandFrameToAspect(frame, 16 / 9);

    expect(fitAll.bcx).toBe(frame.bcx);
    expect(fitAll.bcy).toBe(frame.bcy);
    expect(fitAll.w).toBe(400);
    expect(fitAll.h).toBe(225);
  });

  it("expands a rotated fit-all box back to the panel aspect", () => {
    const rotatedBox = { x: 50, y: -100, w: 225, h: 400 };
    const expanded = expandViewBoxRectToAspect(rotatedBox, 16 / 9);

    expect(expanded.x + expanded.w / 2).toBe(rotatedBox.x + rotatedBox.w / 2);
    expect(expanded.y + expanded.h / 2).toBe(rotatedBox.y + rotatedBox.h / 2);
    expect(expanded.h).toBe(rotatedBox.h);
    expect(expanded.w / expanded.h).toBeCloseTo(16 / 9);
  });

  it("centers the gameplay camera on the avatar with a fixed close span", () => {
    const focus = { x: 320, y: 180 };
    const view = focusedViewBox(focus, 16 / 9, 64);

    expect(view.x + view.w / 2).toBe(focus.x);
    expect(view.y + view.h / 2).toBe(focus.y);
    expect(view.h).toBeCloseTo(64 * 5.2);
    expect(view.w / view.h).toBeCloseTo(16 / 9);
  });

  it("does not change gameplay zoom when the avatar moves", () => {
    const first = focusedViewBox({ x: 0, y: 0 }, 2, 64);
    const later = focusedViewBox({ x: 500, y: -200 }, 2, 64);

    expect(later.w).toBe(first.w);
    expect(later.h).toBe(first.h);
  });

  it("zooms around the pointer position", () => {
    const view = { x: 0, y: 0, w: 100, h: 50 };
    const zoomed = zoomViewBoxAt(view, 0.5, 0.25, 0.75);

    expect(zoomed).toEqual({ x: 12.5, y: 18.75, w: 50, h: 25 });
    expect(zoomed.x + zoomed.w * 0.25).toBe(view.x + view.w * 0.25);
    expect(zoomed.y + zoomed.h * 0.75).toBe(view.y + view.h * 0.75);
  });

  it("limits builder wheel zoom", () => {
    const view = { x: 0, y: 0, w: 100, h: 50 };

    expect(zoomViewBoxAt(view, 0.01, 0.5, 0.5, { minWidth: 20 }).w).toBe(20);
    expect(zoomViewBoxAt(view, 10, 0.5, 0.5, { maxWidth: 300 }).w).toBe(300);
  });

  it("pans the camera with a pointer drag", () => {
    const view = { x: 100, y: 50, w: 400, h: 200 };

    expect(panViewBoxByPixels(view, 50, -25, 800, 400)).toEqual({
      x: 75,
      y: 62.5,
      w: 400,
      h: 200,
    });
  });

  it("keeps the authored map transform independent from camera focus", () => {
    const rotationPivot = { x: 200, y: 100 };
    const room = { x: 100, y: 50 };
    const before = rotatePointAround(room, rotationPivot, 90);
    const playerMovedElsewhere = { x: 500, y: 300 };
    const after = rotatePointAround(room, rotationPivot, 90);

    expect(playerMovedElsewhere).not.toEqual(rotationPivot);
    expect(after).toEqual(before);
  });

  it("keeps a room centered while the avatar changes stands", () => {
    const building = buildBuilding(utilityData);
    const room = building.roomById["large-bay"];
    const expected = {
      x: (room.x + room.w / 2) * building.cell,
      y: (room.y + room.h / 2) * building.cell,
    };

    const atCenterStand = resolveGridCameraFocus({
      building,
      level: "first",
      cell: building.cell,
      currentRoom: "large-bay",
      avatarWaypoint: { x: 2, y: 3.5 },
    });
    const atDoorStand = resolveGridCameraFocus({
      building,
      level: "first",
      cell: building.cell,
      currentRoom: "large-bay",
      avatarWaypoint: { x: 0.22, y: 4.8 },
    });

    expect(atCenterStand).toEqual(expected);
    expect(atDoorStand).toEqual(expected);
  });

  it("continues following the avatar on exterior paths", () => {
    const building = buildBuilding(utilityData);
    expect(resolveGridCameraFocus({
      building,
      level: "first",
      cell: building.cell,
      currentRoom: null,
      exteriorNode: "large-bay-roll-front",
      avatarWaypoint: { x: 4.3, y: 2.4 },
    })).toEqual({
      x: 4.3 * building.cell,
      y: 2.4 * building.cell,
    });
  });
});
