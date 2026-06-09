import { computed } from "vue";
import {
  canUseExteriorExit,
  exteriorMovesFrom,
  exteriorPathBetween,
  exteriorReachableNodes,
  exteriorStepOutMoves,
  isDestinationNamed,
  movesFrom,
  moveKey,
} from "../useGrid.js";
import { canBargeThroughDoor, canPassDoor } from "../useDoors.js";

export function createIndoorMovement(deps) {
  const {
    building,
    indoor,
    indoorVisibility,
    currentExteriorNode,
    discoverIndoorRoom,
    exitTravelHint,
    place,
    outdoor,
    builderView,
    tryOpenDoor,
  } = deps;

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

  const levelsTopDown = computed(() => building.value.levels);

  function goIndoors() {
    outdoor.state.barrierStand = null;
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
    outdoor.state.barrierStand = null;
    indoor.exteriorNode = null;
    indoor.currentRoom = null;
    place.value = "outdoors";
  }

  function exitBuilding() {
    const hexId = building.value.outdoorHex ?? outdoor.state.currentId;
    outdoor.state.currentId = hexId;
    outdoor.state.discovered = new Set([...outdoor.state.discovered, hexId]);
    outdoor.state.barrierStand = null;
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

  return {
    indoorMoves,
    bargeMoves,
    reachableRooms,
    reachableExteriorNodes,
    levelsTopDown,
    goIndoors,
    enterBuilding,
    visitStation,
    exitViaDoor,
    exitBuilding,
    applyIndoorMove,
    moveToRoom,
    moveToExteriorNode,
    moveKey,
    isDestinationNamed,
  };
}
