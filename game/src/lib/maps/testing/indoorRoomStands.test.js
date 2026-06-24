import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { utilityData } from '../../testing/content.js';
import {
  buildBuilding,
  defaultRoomStandId,
  derivedDoorStands,
  roomStandById,
  roomStandPosition,
} from "../composables/useGrid.js";
import { setAllDoorsOpen } from "../composables/useDoors.js";
import { useIndoorBuilding } from "../composables/useIndoorBuilding.js";
import { createFlags } from "../composables/useFlags.js";

function indoorHarness() {
  const place = ref("indoors");
  const builderView = ref(false);
  const outdoor = {
    state: {
      currentId: "utility-yard",
      stand: { x: 0, y: 0 },
      lastBlocked: null,
      atBarrier: null,
    },
    editableHexes: [{ id: "utility-yard", landmark: { building: "utility-station" } }],
    hexById: { "utility-yard": { id: "utility-yard", landmark: { building: "utility-station" } } },
    defaultStandForHex: () => ({ x: 0, y: 0 }),
  };
  const gameState = { flags: createFlags() };
  const indoor = useIndoorBuilding(utilityData, outdoor, {
    place,
    builderView,
    gameState,
  });
  return { indoor, place };
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
});
