import { describe, expect, it } from "vitest";
import {
  buildIndoorPlayActions,
  formatNearbyReachableItemsMessage,
  handleIndoorPlayAction,
  listNearbyReachableItems,
} from "./usePlayPanel.js";

function threeFlavorBoxesIndoor() {
  return {
    roomPickups: [],
    availableActions: [],
    nearbyDoors: [],
    playerRoomId: "kitchen",
    building: {
      areaId: "utility-station",
      doors: [],
      doorById: {},
      links: [],
      roomById: { kitchen: { id: "kitchen", label: "Kitchen", stands: [{ id: "cabinets" }] } },
      pickups: [],
    },
    indoor: {
      currentRoom: "kitchen",
      currentStand: "cabinets",
      doorState: {},
      facility: {},
      discovered: new Set(["kitchen"]),
    },
    character: {
      definitions: {
        items: [
          {
            id: "tastee-tack-box",
            label: "Box of Tastee Tack meals",
            container: { capacity: { slots: 14 }, accepts: { kinds: ["consumable"] } },
            portable: true,
          },
          { id: "turkey", label: "Tastee Tack: Turkey Cranberry Dinner", kind: "consumable", portable: true },
          { id: "breakfast", label: "Tastee Tack: Pioneer Breakfast", kind: "consumable", portable: true },
          { id: "nut", label: "Tastee Tack: Nut Butter and Preserves", kind: "consumable", portable: true },
        ],
      },
      holdings: {
        holders: {
          "character:player": { id: "character:player", kind: "character" },
          "fixed:kitchen-cabinets": {
            id: "fixed:kitchen-cabinets",
            kind: "fixed",
            location: { room: "kitchen", stand: "cabinets" },
          },
          "container:box-1": { id: "container:box-1", kind: "container", instance: "box-1" },
          "container:box-2": { id: "container:box-2", kind: "container", instance: "box-2" },
          "container:box-3": { id: "container:box-3", kind: "container", instance: "box-3" },
        },
        instances: {
          "box-1": { item: "tastee-tack-box", holder: "fixed:kitchen-cabinets" },
          "box-2": { item: "tastee-tack-box", holder: "fixed:kitchen-cabinets" },
          "box-3": { item: "tastee-tack-box", holder: "fixed:kitchen-cabinets" },
        },
        stacks: {
          s1: { item: "turkey", quantity: 14, holder: "container:box-1" },
          s2: { item: "breakfast", quantity: 14, holder: "container:box-2" },
          s3: { item: "nut", quantity: 14, holder: "container:box-3" },
        },
        nextId: 20,
      },
    },
    doorStateFor: () => ({ open: false, locked: false }),
    doorLockHint: () => null,
    canToggleDoorLock: () => false,
  };
}

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

describe("nearby container look-in", () => {
  it("offers Look in for a container building pickup at the cabinets", () => {
    const indoor = {
      roomPickups: [{
        id: "kitchen-tastee-tack-box",
        room: "kitchen",
        item: "tastee-tack-box",
        label: "Box of Tastee Tack meals",
        stand: "cabinets",
      }],
      availableActions: [],
      nearbyDoors: [],
      playerRoomId: "kitchen",
      building: {
        areaId: "utility-station",
        doors: [],
        doorById: {},
        links: [],
        roomById: {
          kitchen: {
            id: "kitchen",
            label: "Kitchen",
            stands: [{ id: "cabinets", label: "cabinets" }],
          },
        },
        pickups: [{
          id: "kitchen-tastee-tack-box",
          room: "kitchen",
          item: "tastee-tack-box",
          label: "Box of Tastee Tack meals",
          stand: "cabinets",
        }],
      },
      indoor: {
        currentRoom: "kitchen",
        currentStand: "cabinets",
        doorState: {},
        facility: {},
        discovered: new Set(["kitchen"]),
      },
      character: {
        definitions: {
          items: [{
            id: "tastee-tack-box",
            label: "Box of Tastee Tack meals",
            container: { capacity: { slots: 14 }, accepts: { kinds: ["consumable"] } },
            portable: true,
          }],
        },
        holdings: {
          holders: {
            "character:player": { id: "character:player", kind: "character", label: "Holding" },
          },
          instances: {},
          stacks: {},
          nextId: 1,
        },
        revision: 0,
      },
      doorStateFor: () => ({ open: false, locked: false }),
      doorLockHint: () => null,
      canToggleDoorLock: () => false,
    };

    const actions = buildIndoorPlayActions(indoor);
    expect(actions.map((action) => action.id)).toContain("pickup-look:kitchen-tastee-tack-box");
    expect(actions.map((action) => action.label)).toContain("Look in the Box of Tastee Tack meals");
    expect(actions.map((action) => action.id)).toContain("pickup:kitchen-tastee-tack-box");

    const result = handleIndoorPlayAction(indoor, "pickup-look:kitchen-tastee-tack-box");
    expect(result.ok).toBe(true);
    expect(result.lookIn?.type).toBe("instance");
    expect(result.lookIn?.id).toBeTruthy();
    expect(indoor.character.holdings.instances[result.lookIn.id]?.holder)
      .toBe("fixed:kitchen-cabinets");
  });

  it("offers Look in for a container on a fixed stand without requiring pickup", () => {
    const indoor = {
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [],
      playerRoomId: "kitchen",
      building: {
        areaId: "utility-station",
        doors: [],
        doorById: {},
        links: [],
        roomById: { kitchen: { id: "kitchen", label: "Kitchen" } },
      },
      indoor: {
        currentRoom: "kitchen",
        currentStand: "cabinets",
        doorState: {},
        facility: {},
        discovered: new Set(["kitchen"]),
      },
      character: {
        definitions: {
          items: [{
            id: "tastee-tack-box",
            label: "Box of Tastee Tack meals",
            container: { capacity: { slots: 14 }, accepts: { kinds: ["consumable"] } },
            portable: true,
          }],
        },
        holdings: {
          holders: {
            "fixed:kitchen-cabinets": {
              id: "fixed:kitchen-cabinets",
              kind: "fixed",
              label: "cabinets",
              location: { room: "kitchen", stand: "cabinets" },
            },
            "container:box-1": {
              id: "container:box-1",
              kind: "container",
              instance: "box-1",
            },
          },
          instances: {
            "box-1": {
              item: "tastee-tack-box",
              holder: "fixed:kitchen-cabinets",
            },
          },
          stacks: {},
        },
      },
      doorStateFor: () => ({ open: false, locked: false }),
      doorLockHint: () => null,
      canToggleDoorLock: () => false,
    };

    const actions = buildIndoorPlayActions(indoor);
    expect(actions.map((action) => action.id)).toContain("holding-look:instance:box-1");
    expect(actions.map((action) => action.label)).toContain("Look in the Empty Tastee Tack box");
    expect(actions.map((action) => action.id)).toContain("holding-pickup:instance:box-1");
  });
});

describe("multi-flavor container groups", () => {
  it("offers one inspect action and flavored pick-up labels", () => {
    const indoor = threeFlavorBoxesIndoor();
    const actions = buildIndoorPlayActions(indoor);
    const ids = actions.map((action) => action.id);
    const labels = actions.map((action) => action.label);

    expect(ids).toContain("holding-inspect-group:tastee-tack-box");
    expect(labels).toContain("Inspect the Tastee Tack boxes");
    expect(ids.some((id) => id.startsWith("holding-look:"))).toBe(false);
    expect(labels).toEqual(expect.arrayContaining([
      "Pick up the Box of Tastee Tack: Turkey Cranberry Dinner",
      "Pick up the Box of Tastee Tack: Pioneer Breakfast",
      "Pick up the Box of Tastee Tack: Nut Butter and Preserves",
    ]));

    const result = handleIndoorPlayAction(indoor, "holding-inspect-group:tastee-tack-box");
    expect(result.ok).toBe(true);
    expect(result.inspectGroup.entries).toHaveLength(3);
    expect(result.inspectGroup.entries.map((entry) => entry.label)).toEqual(expect.arrayContaining([
      "Box of Tastee Tack: Turkey Cranberry Dinner",
      "Box of Tastee Tack: Pioneer Breakfast",
      "Box of Tastee Tack: Nut Butter and Preserves",
    ]));
  });

  it("summarizes flavors in the discovery message", () => {
    const message = formatNearbyReachableItemsMessage(threeFlavorBoxesIndoor());
    expect(message).toContain("3 boxes of Tastee Tack");
    expect(message).toContain("Turkey Cranberry Dinner");
    expect(message).toContain("Pioneer Breakfast");
    expect(message).toContain("Nut Butter and Preserves");
    expect(message).not.toMatch(/There is a Box of Tastee Tack meals and a Box of Tastee Tack meals/);
  });
});

describe("nearby reachable item messages", () => {
  it("lists stand pickups for discovery copy", () => {
    const indoor = indoorWithReachable({
      pickups: [{ id: "bolt-cutter-1", label: "bolt cutter", item: "bolt-cutter" }],
    });
    expect(listNearbyReachableItems(indoor)).toEqual([
      {
        key: "pickup:bolt-cutter-1",
        label: "bolt cutter",
        itemId: "bolt-cutter",
        isContainer: false,
      },
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
