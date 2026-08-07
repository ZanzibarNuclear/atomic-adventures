import { describe, expect, it } from "vitest";
import { buildBuilding } from "../composables/useGrid.js";
import {
  applyClosedUnlockedDoorManners,
  buildInitialDoorState,
  canTraverseDoorOnPath,
  doorNeedsClosedUnlockedManners,
  doorStateKey,
  setDoorOpen,
} from "../composables/useDoors.js";
import { planKnownRoomPath } from "../composables/knownAreaIndoorTravel.js";

/**
 * Synthetic three-room line: west — mid — east.
 * Doors: west-mid (unlocked), mid-east (may lock).
 * No production room IDs.
 */
function syntheticBuilding(doorInitials = {}) {
  return buildBuilding({
    id: "synth-hall",
    area: "synth-hall",
    levels: [{ id: "first", order: 0 }],
    rooms: [
      { id: "west-room", level: "first", x: 0, y: 0, w: 2, h: 2 },
      { id: "mid-room", level: "first", x: 2, y: 0, w: 2, h: 2 },
      { id: "east-room", level: "first", x: 4, y: 0, w: 2, h: 2 },
    ],
    doors: [
      {
        id: "door-west-mid",
        initial: doorInitials["door-west-mid"] ?? { open: true, locked: false },
      },
      {
        id: "door-mid-east",
        initial: doorInitials["door-mid-east"] ?? { open: true, locked: false },
        lock: doorInitials.lockConfig ?? undefined,
      },
    ],
    links: [
      { kind: "door", from: "west-room", to: "mid-room", door: "door-west-mid" },
      { kind: "door", from: "mid-room", to: "east-room", door: "door-mid-east" },
    ],
  });
}

function doorStateFor(building, overrides = {}) {
  const state = buildInitialDoorState(building.areaId, building);
  for (const [doorId, patch] of Object.entries(overrides)) {
    const key = doorStateKey(building.areaId, doorId);
    Object.assign(state[key], patch);
  }
  return state;
}

function plan(building, from, to, discovered, doorState) {
  return planKnownRoomPath({
    building,
    fromRoomId: from,
    toRoomId: to,
    discovered,
    doorState,
    visibility: null,
    atLevel: "first",
  });
}

describe("planKnownRoomPath (synthetic indoor)", () => {
  it("returns empty path when already in the target room", () => {
    const building = syntheticBuilding();
    const ds = doorStateFor(building);
    expect(
      plan(building, "west-room", "west-room", ["west-room"], ds),
    ).toEqual([]);
  });

  it("plans multi-hop through open doors across known rooms", () => {
    const building = syntheticBuilding();
    const ds = doorStateFor(building);
    const path = plan(
      building,
      "west-room",
      "east-room",
      ["west-room", "mid-room", "east-room"],
      ds,
    );
    expect(path).not.toBeNull();
    expect(path.map((m) => m.toRoomId)).toEqual(["mid-room", "east-room"]);
    expect(path.every((m) => m.doorId)).toBe(true);
  });

  it("allows free travel through closed unlocked doors", () => {
    const building = syntheticBuilding({
      "door-west-mid": { open: false, locked: false },
      "door-mid-east": { open: false, locked: false },
    });
    const ds = doorStateFor(building);
    const path = plan(
      building,
      "west-room",
      "east-room",
      ["west-room", "mid-room", "east-room"],
      ds,
    );
    expect(path).not.toBeNull();
    expect(path.map((m) => m.toRoomId)).toEqual(["mid-room", "east-room"]);
    for (const move of path) {
      expect(
        canTraverseDoorOnPath(ds, building.areaId, move.doorId),
      ).toBe(true);
      expect(
        doorNeedsClosedUnlockedManners(ds, building.areaId, move.doorId),
      ).toBe(true);
    }
  });

  it("recloses closed unlocked doors after manners (not raised in a barn)", () => {
    const building = syntheticBuilding({
      "door-west-mid": { open: false, locked: false },
    });
    const ds = doorStateFor(building);
    const doorId = "door-west-mid";
    expect(doorNeedsClosedUnlockedManners(ds, building.areaId, doorId)).toBe(
      true,
    );
    // Walk-through: temporarily open, then reclose unlocked.
    setDoorOpen(ds, building.areaId, doorId, true);
    expect(ds[doorStateKey(building.areaId, doorId)].open).toBe(true);
    applyClosedUnlockedDoorManners(ds, building.areaId, doorId);
    expect(ds[doorStateKey(building.areaId, doorId)].open).toBe(false);
    expect(ds[doorStateKey(building.areaId, doorId)].locked).toBe(false);
  });

  it("leaves already-open doors open after free travel", () => {
    const building = syntheticBuilding({
      "door-west-mid": { open: true, locked: false },
    });
    const ds = doorStateFor(building);
    const doorId = "door-west-mid";
    expect(doorNeedsClosedUnlockedManners(ds, building.areaId, doorId)).toBe(
      false,
    );
    // No manners → state unchanged.
    expect(ds[doorStateKey(building.areaId, doorId)].open).toBe(true);
  });

  it("blocks free travel through locked doors", () => {
    const building = syntheticBuilding({
      "door-mid-east": { open: false, locked: true },
    });
    const ds = doorStateFor(building);
    const path = plan(
      building,
      "west-room",
      "east-room",
      ["west-room", "mid-room", "east-room"],
      ds,
    );
    expect(path).toBeNull();
    // Still can reach mid.
    const toMid = plan(
      building,
      "west-room",
      "mid-room",
      ["west-room", "mid-room", "east-room"],
      ds,
    );
    expect(toMid?.map((m) => m.toRoomId)).toEqual(["mid-room"]);
  });

  it("refuses free travel into undiscovered rooms", () => {
    const building = syntheticBuilding();
    const ds = doorStateFor(building);
    const path = plan(
      building,
      "west-room",
      "east-room",
      ["west-room", "mid-room"], // east fogged
      ds,
    );
    expect(path).toBeNull();
  });

  it("does not invent an outdoor map transition (path is rooms only)", () => {
    const building = syntheticBuilding();
    const ds = doorStateFor(building);
    const path = plan(
      building,
      "west-room",
      "east-room",
      ["west-room", "mid-room", "east-room"],
      ds,
    );
    expect(path).not.toBeNull();
    for (const move of path) {
      expect(move.toExteriorNode).toBeUndefined();
      expect(move.place).toBeUndefined();
    }
  });
});
