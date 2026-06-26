import { buildBuilding, exteriorReachableNodes, movesFrom } from "../composables/useGrid.js";
import { buildInitialDoorState, setAllDoorsOpen } from "../composables/useDoors.js";
import { mapVisibilityCtx } from "../composables/useGrid.js";

export function auditIndoorBuilding(buildingData) {
  const building = buildBuilding(buildingData);
  const doorState = buildInitialDoorState(building.areaId, building);
  setAllDoorsOpen(doorState, building.areaId, building, true);
  const roomIds = building.rooms.map((room) => room.id);
  const visibility = mapVisibilityCtx(
    roomIds,
    roomIds,
    building,
    doorState,
    building.areaId,
    true,
    building.start,
    null,
  );
  const start = {
    roomId: building.start,
    level: building.roomById[building.start]?.level
      ?? building.roomById[building.start]?.levels?.[0],
  };
  const queue = start.roomId ? [start] : [];
  const visitedStates = new Set(queue.map((item) => `${item.roomId}:${item.level}`));
  const visitedRooms = new Set(queue.map((item) => item.roomId));

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
      const key = `${move.toRoomId}:${nextLevel}`;
      visitedRooms.add(move.toRoomId);
      if (visitedStates.has(key)) continue;
      visitedStates.add(key);
      queue.push({ roomId: move.toRoomId, level: nextLevel });
    }
  }

  const standableRooms = building.rooms.filter((room) => !room.open).map((room) => room.id);
  const unreachableRooms = standableRooms.filter((id) => !visitedRooms.has(id));
  const exteriorStart = building.exterior?.entry;
  const reachableExterior = new Set([
    exteriorStart,
    ...exteriorReachableNodes(building, exteriorStart),
  ].filter(Boolean));
  const unreachableExteriorNodes = (building.exterior?.nodes ?? [])
    .map((node) => node.id)
    .filter((id) => !reachableExterior.has(id));

  return {
    valid: unreachableRooms.length === 0 && unreachableExteriorNodes.length === 0,
    roomCount: standableRooms.length,
    exteriorNodeCount: building.exterior?.nodes?.length ?? 0,
    unreachableRooms,
    unreachableExteriorNodes,
  };
}
