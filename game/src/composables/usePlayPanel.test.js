import { describe, expect, it } from "vitest";
import {
  buildIndoorPlayActions,
  formatNearbyReachableItemsMessage,
  listNearbyReachableItems,
} from "./usePlayPanel.js";

describe("indoor door actions", () => {
  it("offers a keyless unlock from a door's authored free side", () => {
    const door = {
      id: "hallway-small-bay",
      label: "small bay door",
      kind: "man",
      lock: { key: "hallway-small-bay-key", freeFrom: "hallway" },
    };
    const indoor = {
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [],
      playerRoomId: "hallway",
      building: {
        areaId: "utility-station",
        doors: [door],
        doorById: { [door.id]: door },
        links: [{ from: "hallway", to: "small-bay", door: door.id }],
        roomById: {},
      },
      indoor: {
        currentRoom: "hallway",
        currentStand: null,
        doorState: { "utility-station:hallway-small-bay": { open: false, locked: true } },
        facility: {},
        discovered: new Set(["hallway"]),
      },
      character: { holdings: {}, definitions: { items: [] } },
      doorStateFor: () => ({ open: false, locked: true }),
      doorLockHint: () => "Lock thumb turn — no key needed",
      canToggleDoorLock: () => true,
    };

    expect(buildIndoorPlayActions(indoor).map((action) => action.id))
      .toContain("door-lock:hallway-small-bay");
  });
});

function indoorWithReachable({ pickups = [] } = {}) {
  return {
    roomPickups: pickups,
    character: null,
    indoor: {
      currentRoom: "large-bay",
      currentStand: "service-area",
      exteriorNode: null,
    },
  };
}

describe("nearby reachable item messages", () => {
  it("lists stand pickups for discovery copy", () => {
    const indoor = indoorWithReachable({
      pickups: [{ id: "bolt-cutter-1", label: "bolt cutter", item: "bolt-cutter" }],
    });
    expect(listNearbyReachableItems(indoor)).toEqual([
      { key: "pickup:bolt-cutter-1", label: "bolt cutter" },
    ]);
    expect(formatNearbyReachableItemsMessage(indoor)).toBe("There is a bolt cutter.");
  });

  it("joins multiple reachable labels", () => {
    const indoor = indoorWithReachable({
      pickups: [
        { id: "a", label: "bolt cutter" },
        { id: "b", label: "key ring" },
      ],
    });
    expect(formatNearbyReachableItemsMessage(indoor)).toBe(
      "There is a bolt cutter and a key ring.",
    );
  });

  it("returns null when nothing is within reach", () => {
    expect(formatNearbyReachableItemsMessage(indoorWithReachable())).toBe(null);
  });
});
