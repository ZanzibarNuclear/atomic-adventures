import { describe, expect, it } from "vitest";
import {
  buildIndoorPlayActions,
  buildOutdoorSearchActions,
  buildOutdoorStatusLines,
  formatNearbyReachableItemsMessage,
  handleIndoorPlayAction,
  handleOutdoorChooseAction,
  listNearbyReachableItems,
  takeOneFromNearbyContainer,
} from "./usePlayPanel.js";
import {
  clearPlayMessages,
  playMessageLines,
} from "./usePlayMessages.js";
import { describeBarrierSearchResult } from "../lib/maps/composables/useBarrierOpenings.js";

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

  it("from exterior: locked key door offers break, not open or unlock", () => {
    const door = {
      id: "side-man",
      label: "side door",
      kind: "man",
      lock: { key: "side-man-key", freeFrom: "inside" },
    };
    const doorState = {
      "synth:side-man": { open: false, locked: true, lockBroken: false },
    };
    const indoor = {
      roomPickups: [],
      availableActions: [],
      nearbyDoors: [{ doorId: "side-man", toRoomId: "inside", toName: "Inside" }],
      playerRoomId: null,
      building: {
        areaId: "synth",
        doors: [door],
        doorById: { [door.id]: door },
        links: [],
        roomById: { inside: { id: "inside", label: "Inside" } },
      },
      indoor: {
        currentRoom: null,
        exteriorNode: "side-entry",
        currentStand: null,
        doorState,
        facility: {},
        discovered: new Set(),
      },
      character: { holdings: { holders: {}, instances: {}, stacks: {} }, definitions: { items: [] } },
      doorStateFor: () => doorState["synth:side-man"],
      doorLockHint: () => "Need key: side man key",
      canToggleDoorLock: () => false,
    };

    const ids = buildIndoorPlayActions(indoor).map((action) => action.id);
    expect(ids).toContain("door-break:side-man");
    expect(ids).not.toContain("door-open:side-man");
    expect(ids).not.toContain("door-lock:side-man");
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
    expect(actions.map((action) => action.id)).not.toContain("pickup:kitchen-tastee-tack-box");

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
    expect(actions.map((action) => action.id)).toContain("holding-inspect-group:tastee-tack-box");
    expect(actions.map((action) => action.label)).toContain("Inspect the Tastee Tack box");
    expect(actions.map((action) => action.id)).not.toContain("holding-look:instance:box-1");
    expect(actions.map((action) => action.id)).not.toContain("holding-pickup:instance:box-1");
  });
});

describe("purifier tablet pickup", () => {
  function sinkIndoor({ flags = new Set(), skills = {} } = {}) {
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
        roomById: { kitchen: { id: "kitchen", label: "Kitchen" } },
      },
      indoor: {
        currentRoom: "kitchen",
        currentStand: "kitchen-sink",
        doorState: {},
        facility: { fixtures: {} },
        discovered: new Set(["kitchen"]),
        flags,
      },
      flags,
      character: {
        skills,
        definitions: {
          items: [
            { id: "purifier-tablet", label: "purification tablet", kind: "consumable", portable: true, carrying: "stack" },
          ],
        },
        holdings: {
          holders: {
            "character:player": { id: "character:player", kind: "character" },
            "fixed:kitchen-sink-counter": {
              id: "fixed:kitchen-sink-counter",
              kind: "fixed",
              label: "Sink counter",
              location: { room: "kitchen", stand: "kitchen-sink" },
            },
          },
          instances: {},
          stacks: {
            "stack-tablet": { item: "purifier-tablet", quantity: 8, holder: "fixed:kitchen-sink-counter" },
          },
        },
      },
      doorStateFor: () => ({ open: false, locked: false }),
      doorLockHint: () => null,
      canToggleDoorLock: () => false,
    };
  }

  it("offers tablet pickup until one has been taken", () => {
    const indoor = sinkIndoor();
    const labels = buildIndoorPlayActions(indoor).map((action) => action.label);
    expect(labels).toContain("Pick up the purification tablet");
  });

  it("hides tablet pickup after the first take", () => {
    const indoor = sinkIndoor({ flags: new Set(["kitchen.took-purifier-tablet"]) });
    const labels = buildIndoorPlayActions(indoor).map((action) => action.label);
    expect(labels).not.toContain("Pick up the purification tablet");
  });
});

describe("multi-flavor container groups", () => {
  it("offers one inspect action and no whole-box pickups", () => {
    const indoor = threeFlavorBoxesIndoor();
    const actions = buildIndoorPlayActions(indoor);
    const ids = actions.map((action) => action.id);
    const labels = actions.map((action) => action.label);

    expect(ids).toContain("holding-inspect-group:tastee-tack-box");
    expect(labels).toContain("Inspect the Tastee Tack boxes");
    expect(ids.some((id) => id.startsWith("holding-look:"))).toBe(false);
    expect(ids.some((id) => id.startsWith("holding-pickup:"))).toBe(false);
    expect(labels.some((label) => /^Pick up the Box of Tastee Tack/i.test(label))).toBe(false);

    const result = handleIndoorPlayAction(indoor, "holding-inspect-group:tastee-tack-box");
    expect(result.ok).toBe(true);
    expect(result.inspectGroup.intro).toBe(
      "Shelf-stable Tastee Tack rations. Each package is a full meal.",
    );
    expect(result.inspectGroup.entries).toHaveLength(3);
    expect(result.inspectGroup.entries.map((entry) => entry.label)).toEqual(expect.arrayContaining([
      "Box of Tastee Tack: Turkey Cranberry Dinner",
      "Box of Tastee Tack: Pioneer Breakfast",
      "Box of Tastee Tack: Nut Butter and Preserves",
    ]));
    expect(result.inspectGroup.entries.every((entry) => entry.viewLabel === "View")).toBe(true);
    expect(result.inspectGroup.entries.every((entry) => entry.takeLabel === "Take one")).toBe(true);
    expect(result.inspectGroup.entries.every((entry) => entry.takeOne)).toBe(true);
  });

  it("takes one meal from a Tastee Tack box and leaves the box", () => {
    const indoor = threeFlavorBoxesIndoor();
    const result = takeOneFromNearbyContainer(indoor, "box-1");
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/Turkey Cranberry Dinner/i);
    expect(indoor.character.holdings.stacks.s1.quantity).toBe(13);
    expect(indoor.character.holdings.stacks.s1.holder).toBe("container:box-1");
    const held = Object.values(indoor.character.holdings.stacks)
      .find((stack) => stack.item === "turkey" && stack.holder === "character:player");
    expect(held?.quantity).toBe(1);
    expect(indoor.character.holdings.instances["box-1"].holder).toBe("fixed:kitchen-cabinets");
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

  it("collapses identical items into a counted plural phrase", () => {
    const indoor = indoorWithReachable({
      pickups: [
        { id: "g1", label: "drinking glass", item: "drinking-glass" },
        { id: "g2", label: "drinking glass", item: "drinking-glass" },
        { id: "g3", label: "drinking glass", item: "drinking-glass" },
        { id: "g4", label: "drinking glass", item: "drinking-glass" },
      ],
    });
    expect(formatNearbyReachableItemsMessage(indoor)).toBe(
      "There are four drinking glasses.",
    );
  });

  it("returns null when nothing is within reach", () => {
    expect(formatNearbyReachableItemsMessage(indoorWithReachable())).toBe(null);
  });
});

describe("outdoor barrier search feedback", () => {
  it("describes ford discovery and empty streambank searches", () => {
    expect(describeBarrierSearchResult({
      kind: "stream",
      found: ["the-flats-ford"],
      foundKinds: ["ford"],
    })).toBe("You find a shallow ford across the stream.");
    expect(describeBarrierSearchResult({
      kind: "stream",
      found: [],
      foundKinds: [],
    })).toBe("You search the streambank carefully, but find no safe place to cross.");
  });

  it("does not keep barrier search results as ongoing status lines", () => {
    // Discovery feedback is a one-shot play message; sticky status confused
    // players who left the hole and walked to the gate without crossing.
    const outdoor = {
      state: {
        lastSearch: {
          kind: "stream",
          found: ["the-flats-ford"],
          foundKinds: ["ford"],
        },
        lastBlocked: null,
      },
      barrierHintAtStand: () => "stream",
      barrierCutsCurrentHex: () => false,
      lockedPassageActions: [],
    };
    const lines = buildOutdoorStatusLines(outdoor, { building: { label: "Utility Station" } });
    expect(lines).not.toContain("You find a shallow ford across the stream.");
    expect(lines).not.toContain("On closer inspection, you have found a hole in the fence.");
  });

  it("mentions both fence and stream when both cut the hex", () => {
    const outdoor = {
      state: { lastSearch: null, lastBlocked: null },
      barrierHintAtStand: () => null,
      barrierCutsCurrentHex: (kind) => kind === "fence" || kind === "stream",
      lockedPassageActions: [],
    };
    const lines = buildOutdoorStatusLines(outdoor, { building: { label: "x" } });
    expect(lines).toContain("The fence line is here.");
    expect(lines).toContain("The stream bank is here.");
  });

  it("offers separate fence and stream search actions when both are available", () => {
    const outdoor = {
      hasObviousPassageAtStand: false,
      passageCrossings: [],
      availableSearchKinds: () => ["fence", "stream"],
      canSearchHere: () => true,
    };
    expect(buildOutdoorSearchActions(outdoor)).toEqual([
      { id: "search:barrier:fence", label: "Inspect the fence", kind: "search", barrierKind: "fence" },
      { id: "search:barrier:stream", label: "Search the streambank", kind: "search", barrierKind: "stream" },
    ]);
  });

  it("pushes a play message when a barrier search finds a ford", () => {
    clearPlayMessages();
    const outdoor = {
      state: { lastSearch: null },
      searchBarrier(kind) {
        expect(kind).toBe("stream");
        outdoor.state.lastSearch = {
          kind: "stream",
          found: ["the-flats-ford"],
          foundKinds: ["ford"],
        };
        return ["the-flats-ford"];
      },
    };
    handleOutdoorChooseAction(outdoor, () => {}, "search:barrier:stream");
    expect(playMessageLines()).toEqual([
      "You find a shallow ford across the stream.",
    ]);
  });
});
