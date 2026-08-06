import { describe, expect, it } from "vitest";
import {
  applyClosedUnlockedDoorManners,
  canTraverseDoorOnPath,
  doorNeedsClosedUnlockedManners,
  doorStateKey,
  normalizeDoorInitial,
} from "./useDoors.js";

describe("known-area door traversal manners", () => {
  const areaId = "test-building";
  const doorId = "room-a-b";

  function state(initial) {
    return {
      [doorStateKey(areaId, doorId)]: normalizeDoorInitial(initial),
    };
  }

  it("allows free travel through open or closed unlocked doors", () => {
    expect(
      canTraverseDoorOnPath(state({ open: true, locked: false }), areaId, doorId),
    ).toBe(true);
    expect(
      canTraverseDoorOnPath(state({ open: false, locked: false }), areaId, doorId),
    ).toBe(true);
  });

  it("blocks free travel through locked doors", () => {
    expect(
      canTraverseDoorOnPath(state({ open: false, locked: true }), areaId, doorId),
    ).toBe(false);
  });

  it("recloses an unlocked door after passage manners", () => {
    const ds = state({ open: false, locked: false });
    expect(doorNeedsClosedUnlockedManners(ds, areaId, doorId)).toBe(true);
    // Simulate open for walk-through
    ds[doorStateKey(areaId, doorId)].open = true;
    applyClosedUnlockedDoorManners(ds, areaId, doorId);
    expect(ds[doorStateKey(areaId, doorId)].open).toBe(false);
    expect(ds[doorStateKey(areaId, doorId)].locked).toBe(false);
  });

  it("does not request manners for open or locked doors", () => {
    expect(
      doorNeedsClosedUnlockedManners(
        state({ open: true, locked: false }),
        areaId,
        doorId,
      ),
    ).toBe(false);
    expect(
      doorNeedsClosedUnlockedManners(
        state({ open: false, locked: true }),
        areaId,
        doorId,
      ),
    ).toBe(false);
  });

  it("self-closing doors are pathable without reclose manners", () => {
    const selfClosing = { selfClosing: true };
    expect(
      canTraverseDoorOnPath(
        state({ open: false, locked: false }),
        areaId,
        doorId,
        selfClosing,
      ),
    ).toBe(true);
    expect(
      doorNeedsClosedUnlockedManners(
        state({ open: false, locked: false }),
        areaId,
        doorId,
        selfClosing,
      ),
    ).toBe(false);
  });
});
