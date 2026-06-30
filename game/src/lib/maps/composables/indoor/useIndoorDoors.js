import { roomLabel } from "../../../displayLabel.js";
import { computed } from "vue";
import {
  applyRevealForDoor,
  canUseExteriorExit,
  isDoorMapped,
} from "../useGrid.js";
import {
  breakLock,
  canBargeThroughDoor,
  canPassDoor,
  canToggleLockFromRoom,
  doorsFromRoom,
  getDoorState,
  isSelfClosingDoor,
  lockHintForDoor,
  setAllDoorsOpen,
  setDoorOpen,
  toggleDoorLock,
} from "../useDoors.js";

export function createIndoorDoors(deps) {
  const {
    building,
    indoor,
    indoorVisibility,
    builderView,
    playerRoomId,
    currentExteriorNode,
    reachableRooms,
    bargeMoves,
    moveToRoom,
    exitTravelHint,
    character,
  } = deps;

  const nearbyDoors = computed(() => {
    if (indoor.exteriorNode) {
      const node = currentExteriorNode.value;
      if (!node?.door) return [];
      const door = building.value.doorById[node.door];
      if (!door || !isDoorMapped(door, indoorVisibility.value)) return [];
      const room = building.value.roomById[node.room];
      return [
        {
          doorId: node.door,
          toRoomId: node.room,
          toName: roomLabel(room),
        },
      ];
    }
    return doorsFromRoom(building.value, indoor.currentRoom)
      .filter((d) => indoor.currentStand === `door:${d.doorId}`)
      .filter((d) =>
        isDoorMapped(building.value.doorById[d.doorId], indoorVisibility.value),
      );
  });

  const interactableDoorIds = computed(() => {
    if (builderView.value) {
      return (building.value.doors ?? []).map((d) => d.id).filter(Boolean);
    }
    return nearbyDoors.value.map((d) => d.doorId);
  });

  const reachableExitDoors = computed(() => {
    const exitKey = (e) => e.door ?? e.id
    if (builderView.value) {
      return (building.value.exits ?? []).map(exitKey).filter(Boolean)
    }
    if (indoor.exteriorNode) {
      // All transitions reachable once on the exterior path network
      return (building.value.exits ?? []).map(exitKey).filter(Boolean)
    }
    // Inside a room: only door-based exits whose door is passable from here
    return (building.value.exits ?? [])
      .filter((exit) => !!exit.door)
      .filter((exit) =>
        canUseExteriorExit(
          building.value,
          exit,
          indoor.currentRoom,
          indoor.doorState,
          building.value.areaId,
          indoor.exteriorNode,
        ),
      )
      .filter((exit) =>
        isDoorMapped(
          building.value.doorById[exit.door],
          indoorVisibility.value,
        ),
      )
      .map((exit) => exit.door)
  });

  const worldMapExit = computed(() => {
    for (const key of reachableExitDoors.value) {
      const exit = building.value.exitByDoorId?.[key] ?? building.value.exitById?.[key];
      if (!exit) continue;
      return { doorId: key, label: "Travel world map ⬡" };
    }
    return null;
  });

  function syncDoorState() {
    const next = {};
    for (const [k, v] of Object.entries(indoor.doorState)) {
      next[k] = { ...v };
    }
    indoor.doorState = next;
  }

  function doorStateFor(doorId) {
    return getDoorState(indoor.doorState, building.value.areaId, doorId);
  }

  function doorLockCheck(doorId) {
    return canToggleLockFromRoom(
      indoor.doorState,
      building.value,
      building.value.areaId,
      doorId,
      playerRoomId.value,
      character ?? indoor.inventory,
      indoor.facility,
    );
  }

  function canToggleDoorLock(doorId) {
    return doorLockCheck(doorId).ok;
  }

  function doorLockHint(doorId) {
    const door = building.value.doorById[doorId];
    return lockHintForDoor(
      door,
      playerRoomId.value,
      character ?? indoor.inventory,
      indoor.facility,
      Object.fromEntries(
        (character?.definitions?.items ?? []).map((item) => [item.id, item]),
      ),
    );
  }

  function tryOpenDoor(doorId) {
    if (!setDoorOpen(indoor.doorState, building.value.areaId, doorId, true))
      return;
    syncDoorState();
    exitTravelHint.value = "";
    const next = new Set(indoor.revealed);
    applyRevealForDoor(building.value, next, doorId);
    indoor.revealed = next;
  }

  function tryCloseDoor(doorId) {
    if (!setDoorOpen(indoor.doorState, building.value.areaId, doorId, false))
      return;
    syncDoorState();
  }

  function tryToggleDoor(doorId) {
    const door = building.value.doorById[doorId];
    if (door && isSelfClosingDoor(door)) return;
    const ds = doorStateFor(doorId);
    if (!ds || ds.locked) return;
    if (indoor.exteriorNode) {
      const node = currentExteriorNode.value;
      if (
        node?.door === doorId &&
        ds.open &&
        node.room &&
        reachableRooms.value.includes(node.room)
      ) {
        moveToRoom(node.room);
        return;
      }
    }
    if (ds.open) tryCloseDoor(doorId);
    else tryOpenDoor(doorId);
  }

  function openAllInteriorDoors() {
    setAllDoorsOpen(
      indoor.doorState,
      building.value.areaId,
      building.value,
      true,
    );
    syncDoorState();
    const next = new Set(indoor.revealed);
    for (const door of building.value.doors) {
      if (door.id) applyRevealForDoor(building.value, next, door.id);
    }
    indoor.revealed = next;
  }

  function closeAllInteriorDoors() {
    setAllDoorsOpen(
      indoor.doorState,
      building.value.areaId,
      building.value,
      false,
    );
    syncDoorState();
  }

  function tryBreakLock(doorId) {
    if (
      !breakLock(
        indoor.doorState,
        building.value.areaId,
        doorId,
        building.value,
      )
    )
      return;
    syncDoorState();
  }

  function tryToggleLock(doorId) {
    if (
      !toggleDoorLock(
        indoor.doorState,
        building.value.areaId,
        doorId,
        building.value,
        playerRoomId.value,
        character ?? indoor.inventory,
        indoor.facility,
      )
    )
      return;
    syncDoorState();
  }

  return {
    nearbyDoors,
    interactableDoorIds,
    reachableExitDoors,
    worldMapExit,
    syncDoorState,
    doorStateFor,
    doorLockCheck,
    canToggleDoorLock,
    doorLockHint,
    tryOpenDoor,
    tryCloseDoor,
    tryToggleDoor,
    openAllInteriorDoors,
    closeAllInteriorDoors,
    tryBreakLock,
    tryToggleLock,
  };
}
