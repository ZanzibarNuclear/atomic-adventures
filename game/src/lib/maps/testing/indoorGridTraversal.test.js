import { describe, expect, it } from "vitest";
import utilityData from "../../../../content/world/utility-station.yaml";
import {
  buildBuilding,
  exteriorMovesFrom,
  exteriorPathBetween,
  exteriorReachableNodes,
  mapVisibilityCtx,
  movesFrom,
} from "../composables/useGrid.js";
import {
  buildInitialDoorState,
  canPassDoor,
  setAllDoorsOpen,
} from "../composables/useDoors.js";
import {
  EXTERIOR_WALK_SPEED,
  exteriorWalkDurationMs,
} from "../composables/indoor/useIndoorMovement.js";
import { auditIndoorBuilding } from "./indoorBuildingAudit.js";

const building = buildBuilding(utilityData);

function fullyMappedVisibility(doorState) {
  const roomIds = building.rooms.map((room) => room.id);
  return mapVisibilityCtx(
    roomIds,
    roomIds,
    building,
    doorState,
    building.areaId,
    false,
    building.start,
    null,
  );
}

describe("utility station grid traversal contract", () => {
  it("passes the authoring traversal audit", () => {
    expect(auditIndoorBuilding(utilityData)).toMatchObject({
      valid: true,
      unreachableRooms: [],
      unreachableExteriorNodes: [],
    });
  });
  it("keeps the exterior path network connected and routes both directions", () => {
    const nodeIds = building.exterior.nodes.map((node) => node.id);
    const reachable = exteriorReachableNodes(building, building.exterior.entry);

    expect(reachable.sort()).toEqual(
      nodeIds.filter((id) => id !== building.exterior.entry).sort(),
    );

    for (const nodeId of nodeIds) {
      if (nodeId === building.exterior.entry) continue;
      const outward = exteriorPathBetween(building, building.exterior.entry, nodeId);
      const returning = exteriorPathBetween(building, nodeId, building.exterior.entry);
      expect(outward?.at(-1)).toBe(nodeId);
      expect(returning?.at(-1)).toBe(building.exterior.entry);
    }
  });

  it("labels unknown exterior choices by geographic direction", () => {
    const moves = exteriorMovesFrom(building, "large-bay-roll-front");
    const labels = moves.map((move) => move.label).sort();

    expect(labels).toEqual([
      "east along the footpath",
      "west along the footpath",
    ]);
  });

  it("reaches every standable room when authored doors are open", () => {
    const doorState = buildInitialDoorState(building.areaId, building);
    setAllDoorsOpen(doorState, building.areaId, building, true);
    const visibility = fullyMappedVisibility(doorState);
    const start = { roomId: building.start, level: building.roomById[building.start].level };
    const queue = [start];
    const visitedStates = new Set([`${start.roomId}:${start.level}`]);
    const visitedRooms = new Set([start.roomId]);

    while (queue.length) {
      const current = queue.shift();
      for (const move of movesFrom(
        building,
        current.roomId,
        current.level,
        doorState,
        visibility,
      )) {
        const nextLevel = move.toLevel ?? current.level;
        const stateKey = `${move.toRoomId}:${nextLevel}`;
        visitedRooms.add(move.toRoomId);
        if (visitedStates.has(stateKey)) continue;
        visitedStates.add(stateKey);
        queue.push({ roomId: move.toRoomId, level: nextLevel });
      }
    }

    const standableRoomIds = building.rooms
      .filter((room) => !room.open)
      .map((room) => room.id);
    expect([...visitedRooms].sort()).toEqual(standableRoomIds.sort());
  });

  it("does not allow the initial exterior entry to bypass the locked roll-up", () => {
    const doorState = buildInitialDoorState(building.areaId, building);
    const entry = building.exterior.nodeById[building.exterior.entry];
    expect(entry.room).toBe(building.start);
    expect(canPassDoor(
      doorState,
      building.areaId,
      entry.door,
      building.doorById[entry.door],
    )).toBe(false);
  });

  it("derives exterior animation duration from one shared speed policy", () => {
    expect(exteriorWalkDurationMs(EXTERIOR_WALK_SPEED)).toBe(1000);
    expect(exteriorWalkDurationMs(EXTERIOR_WALK_SPEED, true)).toBe(0);
    expect(exteriorWalkDurationMs(0)).toBe(0);
  });
});
