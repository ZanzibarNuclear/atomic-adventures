import { describe, expect, it } from "vitest";
import {
  buildInitialDoorState,
  canBreakLock,
  canOpenDoor,
  canToggleLock,
  canToggleLockFromRoom,
  getDoorState,
  setDoorOpen,
  toggleDoorLock,
} from "./useDoors.js";

/**
 * Synthetic key door: freeFrom inside, key required from outside.
 * Mirrors the side-garage man-door pattern without production IDs.
 */
function keyDoorWorld() {
  const areaId = "synth-building";
  const doorId = "side-man";
  const door = {
    id: doorId,
    kind: "man",
    room: "inside",
    lock: { key: "side-man-key", freeFrom: "inside" },
    initial: { closed: true, locked: true },
  };
  const building = {
    areaId,
    doors: [door],
    doorById: { [doorId]: door },
  };
  const doorState = buildInitialDoorState(areaId, building);
  return { areaId, doorId, door, building, doorState };
}

describe("key door lock sides", () => {
  it("starts locked closed: cannot open; can break lock", () => {
    const { areaId, doorId, building, doorState } = keyDoorWorld();
    expect(getDoorState(doorState, areaId, doorId)).toMatchObject({
      open: false,
      locked: true,
    });
    expect(canOpenDoor(doorState, areaId, doorId)).toBe(false);
    expect(setDoorOpen(doorState, areaId, doorId, true)).toBe(false);
    expect(canBreakLock(doorState, areaId, doorId, building)).toBe(true);
  });

  it("does not unlock from exterior without a key (no freeFrom match)", () => {
    const { areaId, doorId, building, doorState } = keyDoorWorld();
    // Exterior approach: playerRoomId is null
    expect(
      canToggleLockFromRoom(
        doorState,
        building,
        areaId,
        doorId,
        null,
        new Set(),
        {},
      ),
    ).toEqual({ ok: false, reason: "need-key", keyId: "side-man-key" });
    expect(
      canToggleLock(doorState, areaId, doorId, building, null, new Set(), {}),
    ).toBe(false);
    expect(
      toggleDoorLock(doorState, areaId, doorId, building, null, new Set(), {}),
    ).toBe(false);
    expect(getDoorState(doorState, areaId, doorId).locked).toBe(true);
    expect(canOpenDoor(doorState, areaId, doorId)).toBe(false);
  });

  it("unlocks with the matching key from exterior", () => {
    const { areaId, doorId, building, doorState } = keyDoorWorld();
    const inventory = new Set(["side-man-key"]);
    expect(
      canToggleLock(doorState, areaId, doorId, building, null, inventory, {}),
    ).toBe(true);
    expect(
      toggleDoorLock(doorState, areaId, doorId, building, null, inventory, {}),
    ).toBe(true);
    expect(getDoorState(doorState, areaId, doorId).locked).toBe(false);
    expect(canOpenDoor(doorState, areaId, doorId)).toBe(true);
  });

  it("unlocks without a key from the freeFrom (inside) room", () => {
    const { areaId, doorId, building, doorState } = keyDoorWorld();
    expect(
      canToggleLock(
        doorState,
        areaId,
        doorId,
        building,
        "inside",
        new Set(),
        {},
      ),
    ).toBe(true);
    expect(
      toggleDoorLock(
        doorState,
        areaId,
        doorId,
        building,
        "inside",
        new Set(),
        {},
      ),
    ).toBe(true);
    expect(getDoorState(doorState, areaId, doorId).locked).toBe(false);
  });

  it("does not unlock from a non-free room without a key", () => {
    const { areaId, doorId, building, doorState } = keyDoorWorld();
    expect(
      toggleDoorLock(
        doorState,
        areaId,
        doorId,
        building,
        "other-room",
        new Set(),
        {},
      ),
    ).toBe(false);
    expect(getDoorState(doorState, areaId, doorId).locked).toBe(true);
  });
});
