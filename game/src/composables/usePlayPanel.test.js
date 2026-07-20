import { describe, expect, it } from "vitest";
import { buildIndoorPlayActions } from "./usePlayPanel.js";

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
