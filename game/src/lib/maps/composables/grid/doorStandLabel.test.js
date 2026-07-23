import { describe, expect, it } from "vitest";
import { buildBuilding } from "../useGrid.js";
import { resolveDoorStandLabel, doorThresholdForRoom } from "./useGridModel.js";

function sampleBuilding() {
  return buildBuilding({
    id: "utility-station",
    label: "Utility Station",
    levels: [
      { id: "first", order: 0 },
      { id: "second", order: 1 },
    ],
    rooms: [
      { id: "conference", label: "Conference Room", level: "second", x: 0, y: 0, w: 2, h: 2 },
      { id: "kitchen", label: "Kitchen", level: "second", x: 2, y: 0, w: 2, h: 2 },
      {
        id: "spiral-stair",
        label: "Spiral Stair",
        feature: "spiral-stair",
        levels: ["first", "second"],
        x: 1, y: 0, w: 1, h: 1,
      },
    ],
    links: [
      { from: "conference", to: "kitchen", kind: "door", door: "conference-kitchen" },
      { from: "kitchen", to: "spiral-stair", kind: "door", door: "kitchen-spiral" },
      { from: "conference", to: "spiral-stair", kind: "door", door: "conference-garage-stair" },
    ],
    doors: [
      {
        id: "conference-kitchen",
        kind: "man",
        level: "second",
        at: { x: 2, y: 1 },
        label: "end door",
      },
      {
        id: "kitchen-spiral",
        kind: "man",
        level: "second",
        at: { x: 2.3, y: 0.1 },
        label: "stairway door",
      },
      {
        id: "conference-garage-stair",
        kind: "man",
        level: "second",
        at: { x: 0.3, y: 2 },
        // no label — should not become "Conference Garage Stair"
      },
    ],
    fixtures: [
      {
        id: "spiral-stair",
        kind: "spiral-stairs",
        at: { x: 1.5, y: 0.5 },
        radius: 0.5,
        protrude: "west",
      },
    ],
  });
}

describe("door stand labels", () => {
  it("uses authored door labels for automatic door stands", () => {
    const building = sampleBuilding();
    expect(resolveDoorStandLabel(
      building,
      "kitchen",
      building.doorById["kitchen-spiral"],
    )).toBe("stairway door");
    expect(doorThresholdForRoom(building, "kitchen", "kitchen-spiral")?.label)
      .toBe("stairway door");
  });

  it("avoids humanized door-id names for unlabeled stair doors", () => {
    const building = sampleBuilding();
    expect(resolveDoorStandLabel(
      building,
      "conference",
      building.doorById["conference-garage-stair"],
    )).toBe("stairway door");
  });

  it("supports per-side stand label overrides", () => {
    const building = sampleBuilding();
    building.doorById["conference-garage-stair"].standLabels = {
      conference: "door to the stairs",
    };
    expect(resolveDoorStandLabel(
      building,
      "conference",
      building.doorById["conference-garage-stair"],
    )).toBe("door to the stairs");
  });
});
