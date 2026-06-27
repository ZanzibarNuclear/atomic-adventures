import { describe, expect, it } from "vitest";
import { utilityData } from '../../testing/content.js';
import { buildBuilding, fixturesOnLevel } from "./useGrid.js";
import {
  findGridEditable,
  listAllGridEditable,
  resolvedFixtureHandles,
  resolvedWallHandles,
  listEditableRoomStands,
  resolvedRoomStandHandle,
  setFixtureFromHandle,
  setRoomStandAt,
  setWallPoint,
} from "./useGridBuilder.js";

describe("grid builder room stands", () => {
  it("lists, resolves, and moves authored room stands", () => {
    const draft = structuredClone(utilityData);
    const items = listEditableRoomStands(draft, "first");
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "large-bay/midway",
        "large-bay/stairs-bottom",
        "large-bay/service-area",
      ]),
    );

    const stand = findGridEditable(draft, "stands", "large-bay/stairs-bottom");
    expect(resolvedRoomStandHandle(stand, draft.cell)).toEqual([
      expect.objectContaining({ role: "room-stand", handleKey: "room-stand" }),
    ]);

    setRoomStandAt(draft, "large-bay/stairs-bottom", 1.5, 2.8);
    expect(stand.at).toEqual({ x: 1.5, y: 2.8 });
  });
});

describe("grid builder straight-stair fixtures", () => {
  it("resolves and edits straight-stair fixture geometry handles", () => {
    const draft = {
      cell: 64,
      fixtures: [
        {
          id: "stone-riverbank-stair",
          kind: "straight-stairs",
          visualOnly: true,
          rect: { x: 3.65, y: -1.16, w: 0.32, h: 1.28 },
          run: "vertical",
          ascend: "end",
          angleDegrees: -25.35,
          onLevels: ["first"],
        },
      ],
    };
    const fixture = findGridEditable(draft, "fixtures", "stone-riverbank-stair");

    expect(resolvedFixtureHandles(fixture, draft.cell).map((handle) => handle.role)).toEqual([
      "stair-move",
      "stair-start",
      "stair-end",
      "stair-width-a",
      "stair-width-b",
    ]);

    setFixtureFromHandle(draft, "stone-riverbank-stair", "stair-end", 4.25, 0.25);

    expect(fixture.rect.h).toBeGreaterThan(1.4);
    expect(fixture.rect.w).toBe(0.32);
    expect(fixture.angleDegrees).toBeLessThan(0);
  });

  it("preserves straight-stair fixture rotation in render models", () => {
    const building = buildBuilding({
      cell: 64,
      levels: [{ id: "first" }],
      rooms: [],
      fixtures: [
        {
          id: "stone-riverbank-stair",
          kind: "straight-stairs",
          rect: { x: 3.65, y: -1.16, w: 0.32, h: 1.28 },
          run: "vertical",
          angleDegrees: -25.35,
          onLevels: ["first"],
        },
      ],
    });

    expect(fixturesOnLevel(building, "first")[0].angleDegrees).toBe(-25.35);
  });
});

describe("grid builder visual walls", () => {
  it("lists, resolves, and moves the utility station cliff wall", () => {
    const draft = {
      cell: 64,
      exterior: { level: "first" },
      cliffWall: {
        onLevels: ["first"],
        points: [
          { x: 7.26, y: 0.1 },
          { x: 4.4, y: 0.1 },
        ],
      },
    };

    expect(listAllGridEditable(draft, "first")).toEqual([
      expect.objectContaining({ source: "walls", id: "cliff-wall" }),
    ]);

    const wall = findGridEditable(draft, "walls", "cliff-wall");
    expect(resolvedWallHandles(wall, draft.cell).map((handle) => handle.handleKey)).toEqual([
      "wall-point-0",
      "wall-point-1",
    ]);

    setWallPoint(draft, "cliff-wall", 1, 4.2, 0.3);

    expect(draft.cliffWall.points[1]).toEqual({ x: 4.2, y: 0.3 });
  });
});
