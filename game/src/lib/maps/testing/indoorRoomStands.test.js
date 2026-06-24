import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { mapData, utilityData } from '../../testing/content.js';
import {
  buildBuilding,
  defaultRoomStandId,
  derivedDoorStands,
  roomStandById,
  roomStandPosition,
} from "../composables/useGrid.js";
import { setAllDoorsOpen } from "../composables/useDoors.js";
import { useIndoorBuilding } from "../composables/useIndoorBuilding.js";
import { useOutdoorWorld } from "../composables/useOutdoorWorld.js";
import { createFlags } from "../composables/useFlags.js";

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
    expect(roomStandById(building, "large-bay", "stairs-bottom")).toMatchObject({
      label: "Bottom of the stairs",
      kind: "authored",
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
  });

  it("moves between authored and derived stands without changing rooms", () => {
    const { indoor } = indoorHarness();
    indoor.indoor.currentRoom = "large-bay";
    indoor.indoor.exteriorNode = null;
    indoor.indoor.currentStand = "midway";
    indoor.indoor.discovered = new Set(["large-bay"]);

    expect(indoor.indoorMoves.map((move) => move.toStandId)).toEqual(
      expect.arrayContaining([
        "stairs-bottom",
        "service-area",
        "door:large-bay-man",
        "door:large-bay-roll",
      ]),
    );

    indoor.moveToStand("stairs-bottom");
    expect(indoor.indoor.currentRoom).toBe("large-bay");
    expect(indoor.indoor.currentStand).toBe("stairs-bottom");
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
    expect(indoor.indoor.exteriorNode).toBe("garage-approach");
  });

  it("enters at the river walk after approaching from the-flats", () => {
    const { indoor, outdoor, place } = indoorHarness();
    place.value = "outdoors";
    outdoor.state.previousId = "the-flats";

    indoor.enterBuilding("utility-yard");

    expect(place.value).toBe("indoors");
    expect(indoor.indoor.exteriorNode).toBe("upstream-bank");
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
    expect(indoor.indoor.exteriorNode).toBe("upstream-bank");
  });

  it("returns to the world at the transition stand", () => {
    const { indoor, outdoor, place } = indoorHarness();
    indoor.indoor.exteriorNode = "large-bay-man-front";

    indoor.exitViaDoor("man-door-path");

    expect(place.value).toBe("outdoors");
    expect(outdoor.state.currentId).toBe("utility-yard");
    expect(outdoor.state.stand).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(outdoor.state.stand).not.toEqual(outdoor.defaultStandForHex("utility-yard"));
  });
});
