import { computed, reactive, ref } from "vue";
import {
  applyRevealForDoor,
  applyRevealDoorsForRoom,
  buildBuilding,
  canUseExteriorExit,
  exteriorMovesFrom,
  exteriorPathBetween,
  exteriorReachableNodes,
  exteriorStepOutMoves,
  isDestinationNamed,
  isDoorMapped,
  mapVisibilityCtx,
  movesFrom,
  moveKey,
} from "./useGrid.js";
import {
  buildInitialDoorState,
  canPassDoor,
  canBargeThroughDoor,
  doorsFromRoom,
  lockHintForDoor,
  getDoorState,
  setDoorOpen,
  canToggleLockFromRoom,
  breakLock,
  toggleDoorLock,
  setAllDoorsOpen,
  applyEnablerAutoUnlock,
  isSelfClosingDoor,
  relockEnablerDoor,
} from "./useDoors.js";
import { createInventory, addItem, inventoryItems } from "./useInventory.js";

export function useIndoorBuilding(buildingData, outdoor, ctx) {
  const { place, builderView } = ctx;

  const editableBuildingData = ref(structuredClone(buildingData));
  const building = computed(() => buildBuilding(editableBuildingData.value));

  function syncFromBuildingData(data) {
    editableBuildingData.value = structuredClone(data);
  }

  if (import.meta.hot) {
    import.meta.hot.accept("../content/world/utility-station.yaml", (mod) => {
      if (mod?.default) syncFromBuildingData(mod.default);
    });
  }

  const initialBuilding = buildBuilding(buildingData);
  const exitTravelHint = ref("");

  const indoor = reactive({
    currentRoom: null,
    exteriorNode: initialBuilding.exterior?.entry ?? null,
    discovered: new Set(),
    revealed: new Set(),
    level: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
    viewLevel: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
    doorState: buildInitialDoorState(initialBuilding.areaId, initialBuilding),
    inventory: createInventory(),
    pickupsTaken: new Set(),
    facility: {
      hydroOnline: false,
      manualMode: {},
    },
    moving: false,
  });

  const indoorVisibility = computed(() =>
    mapVisibilityCtx(
      indoor.discovered,
      indoor.revealed,
      building.value,
      indoor.doorState,
      building.value.areaId,
      builderView.value,
      indoor.currentRoom,
      indoor.exteriorNode,
    ),
  );

  const currentRoomData = computed(() =>
    indoor.currentRoom ? building.value.roomById[indoor.currentRoom] : null,
  );

  const currentExteriorNode = computed(() =>
    indoor.exteriorNode
      ? building.value.exterior?.nodeById?.[indoor.exteriorNode]
      : null,
  );

  const indoorMoves = computed(() => {
    if (indoor.exteriorNode) {
      const moves = exteriorMovesFrom(building.value, indoor.exteriorNode).map(
        (m) => ({
          ...m,
          toExteriorNode: m.toNodeId,
        }),
      );
      const node = currentExteriorNode.value;
      if (
        node?.room &&
        canPassDoor(
          indoor.doorState,
          building.value.areaId,
          node.door,
          building.value.doorById[node.door],
        )
      ) {
        const room = building.value.roomById[node.room];
        moves.push({
          kind: "door",
          toRoomId: node.room,
          label: "through the door",
          toName: room?.name ?? node.room,
        });
      }
      return moves;
    }
    return [
      ...movesFrom(
        building.value,
        indoor.currentRoom,
        indoor.level,
        indoor.doorState,
        indoorVisibility.value,
      ),
      ...exteriorStepOutMoves(
        building.value,
        indoor.currentRoom,
        indoor.doorState,
        building.value.areaId,
      ),
    ];
  });

  const bargeMoves = computed(() => {
    if (indoor.exteriorNode) {
      const node = currentExteriorNode.value;
      if (!node?.room || !node.door) return [];
      const door = building.value.doorById[node.door];
      if (
        canPassDoor(
          indoor.doorState,
          building.value.areaId,
          node.door,
          door,
        )
      ) {
        return [];
      }
      if (
        !canBargeThroughDoor(
          indoor.doorState,
          building.value.areaId,
          node.door,
          door,
        )
      ) {
        return [];
      }
      const room = building.value.roomById[node.room];
      return [
        {
          kind: "door",
          toRoomId: node.room,
          doorId: node.door,
          label: "through the door",
          toName: room?.name ?? node.room,
        },
      ];
    }
    if (!indoor.currentRoom) return [];
    const passableIds = new Set(
      indoorMoves.value.filter((m) => !m.onSpiral).map((m) => m.toRoomId),
    );
    return movesFrom(
      building.value,
      indoor.currentRoom,
      indoor.level,
      indoor.doorState,
      indoorVisibility.value,
      { includeBarge: true },
    ).filter((m) => !passableIds.has(m.toRoomId));
  });

  const reachableRooms = computed(() => {
    if (indoor.exteriorNode) {
      const ids = indoorMoves.value
        .filter((m) => m.kind === "door")
        .map((m) => m.toRoomId);
      for (const m of bargeMoves.value) ids.push(m.toRoomId);
      return ids;
    }
    return [
      ...indoorMoves.value.filter((m) => !m.onSpiral).map((m) => m.toRoomId),
      ...bargeMoves.value.map((m) => m.toRoomId),
    ];
  });

  const reachableExteriorNodes = computed(() => {
    if (indoor.exteriorNode) {
      return exteriorReachableNodes(building.value, indoor.exteriorNode);
    }
    if (indoor.currentRoom) {
      return exteriorStepOutMoves(
        building.value,
        indoor.currentRoom,
        indoor.doorState,
        building.value.areaId,
      ).map((m) => m.toExteriorNode);
    }
    return [];
  });

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
          toName: room?.name ?? node.room,
        },
      ];
    }
    return doorsFromRoom(building.value, indoor.currentRoom).filter((d) =>
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
    if (builderView.value) {
      return (building.value.exits ?? []).map((e) => e.door);
    }
    if (indoor.exteriorNode) {
      return (building.value.exits ?? []).map((e) => e.door).filter(Boolean);
    }
    return (building.value.exits ?? [])
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
      .map((exit) => exit.door);
  });

  const levelsTopDown = computed(() => building.value.levels);

  const worldMapExit = computed(() => {
    for (const doorId of reachableExitDoors.value) {
      const exit = building.value.exitByDoorId?.[doorId];
      if (!exit) continue;
      return { doorId, label: "Travel world map ⬡" };
    }
    return null;
  });

  const playerRoomId = computed(() => indoor.currentRoom ?? null);

  const carriedItems = computed(() =>
    inventoryItems(indoor.inventory, building.value.itemById),
  );

  const roomPickups = computed(() => {
    const roomId = indoor.currentRoom;
    if (!roomId) return [];
    return (building.value.pickups ?? []).filter(
      (p) => p.room === roomId && !indoor.pickupsTaken.has(p.id),
    );
  });

  const roomSwitches = computed(() => {
    const roomId = indoor.currentRoom;
    if (!roomId) return [];
    return (building.value.switches ?? []).filter((s) => s.room === roomId);
  });

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
      indoor.inventory,
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
      indoor.inventory,
      indoor.facility,
      building.value.itemById,
    );
  }

  function syncDoorState() {
    const next = {};
    for (const [k, v] of Object.entries(indoor.doorState)) {
      next[k] = { ...v };
    }
    indoor.doorState = next;
  }

  function discoverIndoorRoom(roomId) {
    indoor.discovered = new Set([...indoor.discovered, roomId]);
    const next = new Set(indoor.revealed);
    applyRevealDoorsForRoom(building.value, next, roomId);
    indoor.revealed = next;
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
        indoor.inventory,
        indoor.facility,
      )
    )
      return;
    syncDoorState();
  }

  function tryPickup(pickupId) {
    const pickup = (building.value.pickups ?? []).find((p) => p.id === pickupId);
    if (!pickup || indoor.pickupsTaken.has(pickupId)) return;
    if (pickup.room !== indoor.currentRoom) return;
    addItem(indoor.inventory, pickup.item);
    indoor.pickupsTaken = new Set([...indoor.pickupsTaken, pickupId]);
  }

  function toggleManualRelease(doorId) {
    const sw = (building.value.switches ?? []).find((s) => s.door === doorId);
    if (!sw || sw.room !== indoor.currentRoom) return;
    const next = { ...indoor.facility.manualMode };
    const engaging = !next[doorId];
    next[doorId] = engaging;
    indoor.facility.manualMode = next;
    if (engaging) {
      applyEnablerAutoUnlock(
        indoor.doorState,
        building.value,
        building.value.areaId,
        indoor.facility,
      );
    } else {
      relockEnablerDoor(
        indoor.doorState,
        building.value,
        building.value.areaId,
        doorId,
      );
    }
    syncDoorState();
  }

  function setHydroOnline(on) {
    indoor.facility.hydroOnline = on;
    applyEnablerAutoUnlock(
      indoor.doorState,
      building.value,
      building.value.areaId,
      indoor.facility,
    );
    syncDoorState();
  }

  function goIndoors() {
    outdoor.outdoorStand = null;
    indoor.exteriorNode = building.value.exterior?.entry ?? null;
    indoor.currentRoom = null;
    indoor.discovered = new Set();
    indoor.revealed = new Set();
    indoor.level = building.value.exterior?.level ?? "first";
    indoor.viewLevel = indoor.level;
    place.value = "indoors";
  }

  function enterBuilding(hexId) {
    const id = hexId ?? outdoor.state.currentId;
    const hex = outdoor.hexById[id];
    if (!hex || hex.area !== "utility") return;
    goIndoors();
  }

  function visitStation() {
    const hexId =
      building.value.outdoorHex ??
      outdoor.editableHexes.find((h) => h.area === "utility")?.id;
    if (!hexId) return;
    outdoor.state.currentId = hexId;
    outdoor.state.discovered.add(hexId);
    goIndoors();
  }

  function exitViaDoor(doorId) {
    if (builderView.value) return;
    const exit = building.value.exitByDoorId?.[doorId];
    if (!exit) return;
    if (
      !canUseExteriorExit(
        building.value,
        exit,
        indoor.currentRoom,
        indoor.doorState,
        building.value.areaId,
        indoor.exteriorNode,
      )
    ) {
      exitTravelHint.value = indoor.exteriorNode
        ? ""
        : "Open the exterior door first, then use the ⬡ map marker.";
      return;
    }
    exitTravelHint.value = "";
    const hexId = exit.hex ?? building.value.outdoorHex;
    if (!hexId) return;
    outdoor.state.currentId = hexId;
    outdoor.state.discovered = new Set([...outdoor.state.discovered, hexId]);
    outdoor.outdoorStand = null;
    indoor.exteriorNode = null;
    indoor.currentRoom = null;
    place.value = "outdoors";
  }

  function exitBuilding() {
    const hexId = building.value.outdoorHex ?? outdoor.state.currentId;
    outdoor.state.currentId = hexId;
    outdoor.state.discovered = new Set([...outdoor.state.discovered, hexId]);
    outdoor.outdoorStand = null;
    indoor.exteriorNode = null;
    indoor.currentRoom = null;
    place.value = "outdoors";
  }

  function applyIndoorMove(move) {
    if (indoor.moving) return;
    if (!indoorMoves.value.some((m) => moveKey(m) === moveKey(move))) return;

    indoor.moving = true;

    if (indoor.exteriorNode) {
      if (move.toExteriorNode) {
        indoor.exteriorNode = move.toExteriorNode;
        setTimeout(() => {
          indoor.moving = false;
        }, 400);
        return;
      }
      if (move.kind === "door" && move.toRoomId) {
        indoor.currentRoom = move.toRoomId;
        indoor.exteriorNode = null;
        discoverIndoorRoom(move.toRoomId);
        indoor.level =
          building.value.roomById[move.toRoomId]?.level ?? indoor.level;
        indoor.viewLevel = indoor.level;
        setTimeout(() => {
          indoor.moving = false;
        }, 400);
        return;
      }
      indoor.moving = false;
      return;
    }

    if (move.toExteriorNode) {
      indoor.exteriorNode = move.toExteriorNode;
      indoor.currentRoom = null;
      setTimeout(() => {
        indoor.moving = false;
      }, 400);
      return;
    }

    if (move.onSpiral) {
      indoor.level = move.toLevel;
      indoor.viewLevel = move.toLevel;
      setTimeout(() => {
        indoor.moving = false;
      }, 500);
      return;
    }

    const from = building.value.roomById[indoor.currentRoom];
    const to = building.value.roomById[move.toRoomId];
    if (!to) {
      indoor.moving = false;
      return;
    }

    indoor.currentRoom = move.toRoomId;
    discoverIndoorRoom(move.toRoomId);

    if (to.feature) {
      indoor.level = move.toLevel ?? from.level ?? from.levels?.[0];
    } else {
      indoor.level = move.toLevel ?? to.level ?? to.levels?.[0];
    }
    indoor.viewLevel = indoor.level;

    setTimeout(() => {
      indoor.moving = false;
    }, 500);
  }

  function moveToRoom(roomId) {
    let move = indoorMoves.value.find(
      (m) => !m.onSpiral && m.toRoomId === roomId,
    );
    if (!move) {
      const barge = bargeMoves.value.find((m) => m.toRoomId === roomId);
      if (!barge) return;
      if (barge.doorId) tryOpenDoor(barge.doorId);
      move = indoorMoves.value.find(
        (m) => !m.onSpiral && m.toRoomId === roomId,
      );
    }
    if (move) applyIndoorMove(move);
  }

  function moveToExteriorNode(nodeId) {
    if (indoor.moving || nodeId === indoor.exteriorNode) return;

    if (indoor.exteriorNode) {
      const path = exteriorPathBetween(
        building.value,
        indoor.exteriorNode,
        nodeId,
      );
      if (!path?.length) return;
      walkExteriorPath(path);
      return;
    }

    const move = indoorMoves.value.find((m) => m.toExteriorNode === nodeId);
    if (move) applyIndoorMove(move);
  }

  function walkExteriorPath(nodeIds) {
    if (indoor.moving || !nodeIds.length) return;
    indoor.moving = true;
    let i = 0;
    function step() {
      if (i >= nodeIds.length) {
        indoor.moving = false;
        return;
      }
      indoor.exteriorNode = nodeIds[i];
      i += 1;
      setTimeout(step, 400);
    }
    step();
  }

  function resetIndoor() {
    indoor.exteriorNode = building.value.exterior?.entry ?? null;
    indoor.currentRoom = null;
    indoor.discovered = new Set();
    indoor.revealed = new Set();
    indoor.level = building.value.exterior?.level ?? "first";
    indoor.viewLevel = indoor.level;
    indoor.doorState = buildInitialDoorState(
      building.value.areaId,
      building.value,
    );
    indoor.inventory = createInventory();
    indoor.pickupsTaken = new Set();
    indoor.facility.hydroOnline = false;
    indoor.facility.manualMode = {};
  }

  return reactive({
    buildingData,
    editableBuildingData,
    building,
    syncFromBuildingData,
    indoor,
    exitTravelHint,
    indoorVisibility,
    currentRoomData,
    currentExteriorNode,
    indoorMoves,
    bargeMoves,
    reachableRooms,
    reachableExteriorNodes,
    nearbyDoors,
    interactableDoorIds,
    reachableExitDoors,
    levelsTopDown,
    worldMapExit,
    playerRoomId,
    carriedItems,
    roomPickups,
    roomSwitches,
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
    tryPickup,
    toggleManualRelease,
    setHydroOnline,
    goIndoors,
    enterBuilding,
    visitStation,
    exitViaDoor,
    exitBuilding,
    applyIndoorMove,
    moveToRoom,
    moveToExteriorNode,
    resetIndoor,
    moveKey,
    isDestinationNamed,
  });
}
