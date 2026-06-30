import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { mapData, utilityData } from '../../testing/content.js';
import { useGridMapPlacements } from "../composables/useGridMapPlacements.js";
import {
  buildBuilding,
  defaultRoomStandId,
  derivedDoorStands,
  derivedStairStands,
  roomStandById,
  roomStandPosition,
} from "../composables/useGrid.js";
import { setAllDoorsOpen } from "../composables/useDoors.js";
import { useIndoorBuilding } from "../composables/useIndoorBuilding.js";
import { useOutdoorWorld } from "../composables/useOutdoorWorld.js";
import { resolveStandPoint } from "../composables/useAvatarStand.js";
import { createFlags } from "../composables/useFlags.js";
import {
  buildIndoorMovementActions,
  buildIndoorPlayActions,
} from "../../../composables/usePlayPanel.js";

function indoorHarness() {
  const place = ref("indoors");
  const builderView = ref(false);
  const utilityHex = {
    id: "utility-yard",
    q: -2,
    r: 1,
    landmark: {
      building: "utility-station",
      dx: 0.06,
      dy: 0.19,
    },
    stands: [
      { id: "driveway", at: { from: "landmark", dx: 0.05, dy: -0.56 } },
      { id: "upstream-corner", at: { from: "landmark", dx: -0.18, dy: -0.42 } },
      { id: "man-door", at: { from: "landmark", dx: 0.29, dy: -0.13 } },
      { id: "lobby-entrance", at: { from: "landmark", dx: 0.12, dy: 0.37 } },
    ],
  };
  const outdoor = {
    state: {
      currentId: "utility-yard",
      stand: { x: 0, y: 0 },
      previousId: null,
      lastBlocked: null,
      atBarrier: null,
    },
    size: 44,
    editableHexes: [utilityHex],
    hexById: { "utility-yard": utilityHex },
    defaultStandForHex: () => ({ x: 0, y: 0 }),
  };
  const gameState = { flags: createFlags() };
  const indoor = useIndoorBuilding(utilityData, outdoor, {
    place,
    builderView,
    gameState,
  });
  return { indoor, outdoor, place };
}

describe("indoor room stands", () => {
  it("models authored stands and derived door thresholds inside the room", () => {
    const building = buildBuilding(utilityData);
    const room = building.roomById["large-bay"];
    expect(defaultRoomStandId(room)).toBe("midway");
    expect(roomStandById(building, "large-bay", "stair:garage-stair:bottom")).toMatchObject({
      label: "bottom of the stairs",
      kind: "stair",
    });

    const thresholds = derivedDoorStands(building, "large-bay");
    expect(thresholds.map((stand) => stand.id)).toEqual(
      expect.arrayContaining(["door:large-bay-man", "door:large-bay-roll"]),
    );
    for (const stand of thresholds) {
      expect(stand.at.x).toBeGreaterThan(room.x);
      expect(stand.at.x).toBeLessThan(room.x + room.w);
      expect(stand.at.y).toBeGreaterThan(room.y);
      expect(stand.at.y).toBeLessThan(room.y + room.h);
    }
    expect(derivedStairStands(building, "garage-stair").map((stand) => stand.id)).toEqual(
      expect.arrayContaining(["stair:garage-stair:bottom", "stair:garage-stair:top"]),
    );
    const topStand = roomStandById(building, "garage-stair", "stair:garage-stair:top");
    expect(topStand).toMatchObject({
      label: "top of the stairs",
      kind: "stair",
      door: "conference-garage-stair",
    });
    expect(topStand.at).not.toEqual(building.doorById["conference-garage-stair"].at);
  });

  it("moves to the bottom stair stand without leaving the large bay", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";
    indoor.indoor.discovered = new Set(["large-bay"]);

    expect(indoor.indoorMoves.map((move) => move.toStandId)).toEqual(
      expect.arrayContaining([
        "stair:garage-stair:bottom",
        "service-area",
        "door:large-bay-man",
        "door:large-bay-roll",
      ]),
    );

    indoor.moveToStand("stair:garage-stair:bottom");
    expect(indoor.indoor.currentRoom).toBe("large-bay");
    expect(indoor.indoor.currentStand).toBe("stair:garage-stair:bottom");
    expect(indoor.indoor.level).toBe("first");

    const labels = buildIndoorMovementActions(indoor).map((action) => action.label);
    expect(labels).toContain("Climb the stairs");
    expect(labels).not.toContain("Descend the stairs");
    expect(labels).not.toContain("Go into the large bay");
    expect(indoor.indoorMoves.map((move) => move.toStandId)).toContain("service-area");
  });

  it("shows the top stair endpoint while standing at the bottom endpoint", () => {
    const building = buildBuilding(utilityData);
    const placements = useGridMapPlacements({
      building: ref(building),
      level: ref("first"),
      currentRoom: ref("large-bay"),
      currentStand: ref("stair:garage-stair:bottom"),
      exteriorNode: ref(null),
      avatarWaypoint: ref(null),
      standLevel: ref("first"),
      doorStates: ref({}),
      builderView: ref(false),
      builderEdit: ref(false),
      editMode: ref(null),
      selectedItemId: ref(null),
      mapClickMode: ref(null),
      reachableExteriorNodes: ref([]),
      reachableExitDoors: ref([]),
      visibility: ref({ discovered: new Set(["large-bay", "garage-stair"]) }),
      cell: ref(building.cell),
      tp: (x, y) => ({ x, y }),
      swapAxes: ref(false),
    });

    const top = placements.placedRoomStands.value.find(
      (stand) => stand.id === "stair:garage-stair:top",
    );

    expect(top).toMatchObject({
      roomId: "large-bay",
      kind: "stair",
      reachable: true,
    });
  });

  it("climbs when clicking the projected top stair endpoint from the bottom", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "stair:garage-stair:bottom";
    indoor.indoor.level = "first";
    indoor.indoor.discovered = new Set(["large-bay", "garage-stair"]);
    indoor.indoor.revealed = new Set(["large-bay", "garage-stair"]);

    indoor.moveToStand("stair:garage-stair:top");

    expect(indoor.indoor.currentRoom).toBe("garage-stair");
    expect(indoor.indoor.level).toBe("second");
    expect(indoor.indoor.currentStand).toBe("stair:garage-stair:top");
  });

  it("only offers room-side door controls at that door threshold", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "stair:garage-stair:bottom";
    indoor.indoor.discovered = new Set(["large-bay"]);

    expect(indoor.nearbyDoors.map((door) => door.doorId)).not.toContain("large-bay-man");

    indoor.moveToStand("door:large-bay-man");

    expect(indoor.nearbyDoors.map((door) => door.doorId)).toEqual(["large-bay-man"]);
  });

  it("only offers stand-associated pickups at their standpoint", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";

    expect(indoor.roomPickups.map((pickup) => pickup.id)).not.toContain("bolt-cutter");
    indoor.tryPickup("bolt-cutter");
    expect([...indoor.indoor.inventory]).not.toContain("bolt-cutter");

    indoor.indoor.currentStand = "service-area";

    expect(indoor.roomPickups.map((pickup) => pickup.id)).toContain("bolt-cutter");
    indoor.tryPickup("bolt-cutter");
    expect([...indoor.indoor.inventory]).toContain("bolt-cutter");
  });

  it("offers the garage side-door key only at the inside door threshold", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";

    expect(indoor.roomPickups.map((pickup) => pickup.id)).not.toContain("large-bay-key-peg");
    indoor.tryPickup("large-bay-key-peg");
    expect([...indoor.indoor.inventory]).not.toContain("large-bay-man-key");

    indoor.indoor.currentStand = "door:large-bay-man";

    expect(indoor.roomPickups.map((pickup) => pickup.id)).toContain("large-bay-key-peg");
    indoor.tryPickup("large-bay-key-peg");
    expect([...indoor.indoor.inventory]).toContain("large-bay-man-key");
  });

  it("only offers stand-associated authored actions at their standpoint", () => {
    const data = structuredClone(utilityData);
    data.actions.push({
      id: "inspect-service-bench",
      room: "large-bay",
      stand: "service-area",
      label: "Inspect the service bench",
      once: false,
    });
    const place = ref("indoors");
    const indoor = useIndoorBuilding(data, useOutdoorWorld(mapData), {
      place,
      builderView: ref(false),
      gameState: { flags: createFlags() },
    });
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";

    expect(indoor.availableActions.map((action) => action.id)).not.toContain("inspect-service-bench");

    indoor.indoor.currentStand = "service-area";

    expect(indoor.availableActions.map((action) => action.id)).toContain("inspect-service-bench");
  });

  it("climbs to the top stair door stand and does not barge into the conference room", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";
    indoor.indoor.discovered = new Set(["large-bay", "garage-stair"]);
    indoor.indoor.revealed = new Set(["large-bay", "garage-stair", "conference"]);

    indoor.moveToRoom("garage-stair");

    expect(indoor.indoor.currentRoom).toBe("garage-stair");
    expect(indoor.indoor.level).toBe("second");
    expect(indoor.indoor.currentStand).toBe("stair:garage-stair:top");
    expect(indoor.nearbyDoors.map((door) => door.doorId)).toContain("conference-garage-stair");
    let labels = buildIndoorMovementActions(indoor).map((action) => action.label);
    expect(labels.filter((label) => label === "Descend the stairs")).toHaveLength(1);
    expect(labels).not.toContain("Climb the stairs");
    indoor.indoor.moving = false;

    indoor.moveToRoom("conference");
    expect(indoor.indoor.currentRoom).toBe("garage-stair");

    indoor.tryOpenDoor("conference-garage-stair");
    indoor.indoor.moving = false;
    expect(buildIndoorMovementActions(indoor).map((action) => action.label)).toContain("Enter the room");
    expect(buildIndoorMovementActions(indoor).map((action) => action.label).join(" ")).not.toMatch(/conference/i);
    indoor.moveToRoom("conference");

    expect(indoor.indoor.currentRoom).toBe("conference");
    expect(indoor.indoor.currentStand).toBe("door:conference-garage-stair");
  });

  it("descends from the top stair stand to the generated bottom stand", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "garage-stair";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "stair:garage-stair:top";
    indoor.indoor.level = "second";
    indoor.indoor.discovered = new Set(["large-bay", "garage-stair"]);
    indoor.indoor.revealed = new Set(["large-bay", "garage-stair"]);

    indoor.moveToStand("stair:garage-stair:bottom");

    expect(indoor.indoor.currentRoom).toBe("large-bay");
    expect(indoor.indoor.level).toBe("first");
    expect(indoor.indoor.currentStand).toBe("stair:garage-stair:bottom");
  });

  it("leaves the conference room onto the top stair stand", () => {
    const { indoor } = indoorHarness();
    indoor.tryOpenDoor("conference-garage-stair");
    indoor.indoor.moving = false;
    indoor.indoor.currentRoom = "conference";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "door:conference-garage-stair";
    indoor.indoor.level = "second";
    indoor.indoor.discovered = new Set(["conference", "garage-stair"]);
    indoor.indoor.revealed = new Set(["conference", "garage-stair"]);

    indoor.moveToRoom("garage-stair");

    expect(indoor.indoor.currentRoom).toBe("garage-stair");
    expect(indoor.indoor.level).toBe("second");
    expect(indoor.indoor.currentStand).toBe("stair:garage-stair:top");
  });

  it("does not offer a lock action from the top stair stand without lock hardware or a key", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "garage-stair";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "stair:garage-stair:top";
    indoor.indoor.level = "second";
    indoor.indoor.discovered = new Set(["large-bay", "garage-stair"]);
    indoor.indoor.revealed = new Set(["large-bay", "garage-stair", "conference"]);

    const actions = buildIndoorPlayActions(indoor).map((action) => ({
      id: action.id,
      label: action.label,
    }));

    expect(actions.map((action) => action.id)).not.toContain("door-lock:conference-garage-stair");
    expect(actions.map((action) => action.label)).toContain("Open the door");
    expect(actions.map((action) => action.label).join(" ")).not.toMatch(/conference/i);
  });

  it("offers manual roll-up release only at the roll-up door stand", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";
    indoor.indoor.discovered = new Set(["large-bay"]);

    expect(buildIndoorPlayActions(indoor).map((action) => action.id))
      .not.toContain("switch:large-bay-roll");

    indoor.moveToStand("door:large-bay-roll");

    const actions = buildIndoorPlayActions(indoor);
    expect(actions.map((action) => action.id)).toContain("switch:large-bay-roll");
    expect(actions.map((action) => action.label)).toContain("Release the large roll-up door manually");
  });

  it("offers small roll-up manual release only at the small roll-up door stand", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "small-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = null;
    indoor.indoor.discovered = new Set(["small-bay"]);

    expect(buildIndoorPlayActions(indoor).map((action) => action.id))
      .not.toContain("switch:small-bay-roll");

    indoor.moveToStand("door:small-bay-roll");

    const actions = buildIndoorPlayActions(indoor);
    expect(actions.map((action) => action.id)).toContain("switch:small-bay-roll");
    expect(actions.map((action) => action.label)).toContain("Release the small roll-up door manually");
  });

  it("does not reveal fogged kitchen name from the conference room movement action", () => {
    const { indoor } = indoorHarness();
    indoor.tryOpenDoor("conference-kitchen");
    indoor.indoor.moving = false;
    indoor.indoor.currentRoom = "conference";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "door:conference-kitchen";
    indoor.indoor.level = "second";
    indoor.indoor.discovered = new Set(["conference"]);
    indoor.indoor.revealed = new Set(["conference", "kitchen"]);

    const labels = buildIndoorMovementActions(indoor).map((action) => action.label);

    expect(labels).toContain("Enter the room");
    expect(labels.join(" ")).not.toMatch(/kitchen/i);
  });

  it("arrives at the destination-side threshold when crossing a door", () => {
    const { indoor } = indoorHarness();
    setAllDoorsOpen(
      indoor.indoor.doorState,
      indoor.building.areaId,
      indoor.building,
      true,
    );
    indoor.indoor.currentRoom = "library";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = null;
    indoor.indoor.discovered = new Set(["library", "hallway"]);
    indoor.indoor.revealed = new Set(["library", "hallway"]);

    indoor.moveToRoom("hallway");
    expect(indoor.indoor.currentRoom).toBe("hallway");
    expect(indoor.indoor.currentStand).toBe("door:library-hallway");

    const position = roomStandPosition(
      indoor.building,
      indoor.building.roomById.hallway,
      indoor.indoor.currentStand,
    );
    expect(position).not.toBeNull();
  });

  it("enters the local exterior at the transition selected by previous world hex", () => {
    const { indoor, outdoor, place } = indoorHarness();
    place.value = "outdoors";
    outdoor.state.previousId = "south-pines";

    indoor.enterBuilding("utility-yard");

    expect(place.value).toBe("indoors");
    expect(indoor.indoor.exteriorNode).toBe("large-bay-man-front");
  });

  it("enters through the garage transition after approaching from west-slope", () => {
    const { indoor, outdoor, place } = indoorHarness();
    place.value = "outdoors";
    outdoor.state.previousId = "west-slope";

    indoor.enterBuilding("utility-yard");

    expect(place.value).toBe("indoors");
    expect(indoor.indoor.exteriorNode).toBe("garage-front-entrance");
  });

  it("enters at the river walk after approaching from the-flats", () => {
    const { indoor, outdoor, place } = indoorHarness();
    place.value = "outdoors";
    outdoor.state.previousId = "the-flats";

    indoor.enterBuilding("utility-yard");

    expect(place.value).toBe("indoors");
    expect(indoor.indoor.exteriorNode).toBe("intake-entrance");
  });

  it("uses the river walk when entering utility-yard after outdoor movement from the-flats", () => {
    const place = ref("outdoors");
    const outdoor = useOutdoorWorld(mapData);
    const indoor = useIndoorBuilding(utilityData, outdoor, {
      place,
      builderView: ref(false),
      gameState: { flags: createFlags() },
    });
    outdoor.state.currentId = "the-flats";
    outdoor.state.stand = outdoor.defaultStandForHex("the-flats");

    outdoor.moveTo("utility-yard");
    indoor.enterBuilding();

    expect(outdoor.state.previousId).toBe("the-flats");
    expect(place.value).toBe("indoors");
    expect(indoor.indoor.exteriorNode).toBe("intake-entrance");
  });

  it("lands on the named utility-yard stand for the source hex", () => {
    const utilityHex = mapData.hexes.find((hex) => hex.id === "utility-yard");
    const expectedBySource = {
      "west-slope": "driveway",
      "the-flats": "upstream-corner",
      "south-pines": "man-door",
    };

    for (const [sourceHexId, standId] of Object.entries(expectedBySource)) {
      const outdoor = useOutdoorWorld(mapData);
      outdoor.state.currentId = sourceHexId;
      outdoor.state.stand = outdoor.defaultStandForHex(sourceHexId);

      outdoor.moveTo("utility-yard");

      expect(outdoor.state.currentId).toBe("utility-yard");
      expect(outdoor.state.previousId).toBe(sourceHexId);
      const expected = resolveStandPoint(utilityHex, { stand: standId }, mapData.size ?? 44);
      expect(outdoor.state.stand).toEqual({
        x: Math.round(expected.x),
        y: Math.round(expected.y),
      });
    }
  });

  it("returns to the world at the named transition stand", () => {
    const { indoor, outdoor, place } = indoorHarness();
    indoor.indoor.exteriorNode = "large-bay-man-front";
    outdoor.state.previousId = "the-flats";

    indoor.exitViaDoor("man-door-path");

    expect(place.value).toBe("outdoors");
    expect(outdoor.state.currentId).toBe("utility-yard");
    expect(outdoor.state.previousId).toBeNull();
    expect(outdoor.state.mapTransition).toBe("man-door-path");
    expect(outdoor.state.transitionDirection).toBe("toRegional");
    expect(outdoor.state.stand).toEqual(
      resolveStandPoint(outdoor.hexById["utility-yard"], { stand: "man-door" }, outdoor.size),
    );
  });
});
