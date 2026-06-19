import { roomLabel } from "../../../displayLabel.js";
import { computed } from "vue";
import {
  canUseExteriorExit,
  exteriorMovesFrom,
  exteriorPathBetween,
  exteriorReachableNodes,
  exteriorSegmentPoints,
  exteriorStepOutMoves,
  isDestinationNamed,
  movesFrom,
  moveKey,
  defaultRoomStandId,
  doorThresholdForRoom,
  roomStandModels,
} from "../useGrid.js";
import { canBargeThroughDoor, canPassDoor } from "../useDoors.js";

export const INDOOR_MOVE_MS = 550;
export const FLOOR_MOVE_MS = 520;
export const EXTERIOR_WALK_SPEED = 5;

export function prefersReducedMapMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function exteriorWalkDurationMs(distance, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(distance) || distance <= 0) return 0;
  return (distance / EXTERIOR_WALK_SPEED) * 1000;
}

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
          doorId: node.door,
          label: "through the door",
          toName: roomLabel(room),
        });
      }
      return moves;
    }
    const roomMoves = [
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
    const localStandMoves = roomStandModels(
      building.value,
      indoor.currentRoom,
    )
      .filter((stand) => stand.id !== indoor.currentStand)
      .map((stand) => ({
        kind: "stand",
        toRoomId: indoor.currentRoom,
        toStandId: stand.id,
        label: `to ${stand.label ?? stand.id}`,
        toName: stand.label ?? stand.id,
      }));
    return [...localStandMoves, ...roomMoves];
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
          toName: roomLabel(room),
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
    ].filter((id) => id && id !== indoor.currentRoom);
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

  function resetOutdoorStand(hexId) {
    outdoor.state.stand = outdoor.defaultStandForHex(hexId);
    outdoor.state.lastBlocked = null;
    outdoor.state.atBarrier = null;
  }

  function goIndoors() {
    resetOutdoorStand(outdoor.state.currentId);
    indoor.exteriorNode = building.value.exterior?.entry ?? null;
    indoor.currentRoom = null;
    indoor.currentStand = null;
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
    goIndoors();
  }

  function exitViaDoor(doorId) {
    if (builderView.value) return;
    const exit = building.value.exitByDoorId?.[doorId] ?? building.value.exitById?.[doorId];
    if (!exit) return;
    if (exit.door) {
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
    } else if (!indoor.exteriorNode) {
      // Transitions (no door) are only usable from the exterior path network
      return;
    }
    exitTravelHint.value = "";
    const hexId = exit.hex ?? building.value.outdoorHex;
    if (!hexId) return;
    outdoor.state.currentId = hexId;
    resetOutdoorStand(hexId);
    indoor.exteriorNode = null;
    indoor.currentRoom = null;
    indoor.currentStand = null;
    place.value = "outdoors";
  }

  function exitBuilding() {
    const hexId = building.value.outdoorHex ?? outdoor.state.currentId;
    outdoor.state.currentId = hexId;
    resetOutdoorStand(hexId);
    indoor.exteriorNode = null;
    indoor.currentRoom = null;
    indoor.currentStand = null;
    place.value = "outdoors";
  }

  function applyIndoorMove(move) {
    if (indoor.moving) return;
    if (!indoorMoves.value.some((m) => moveKey(m) === moveKey(move))) return;

    indoor.moving = true;
    const finishAfter = (duration) => {
      const wait = prefersReducedMapMotion() ? 0 : duration;
      if (wait === 0) {
        indoor.moving = false;
        return;
      }
      setTimeout(() => {
        indoor.moving = false;
      }, wait);
    };

    if (indoor.exteriorNode) {
      if (move.toExteriorNode) {
        // Route through the path-follower so the avatar walks the drawn path.
        indoor.moving = false
        walkExteriorPath([move.toExteriorNode])
        return;
      }
      if (move.kind === "door" && move.toRoomId) {
        const room = building.value.roomById[move.toRoomId];
        indoor.currentRoom = move.toRoomId;
        indoor.currentStand = move.doorId
          ? `door:${move.doorId}`
          : defaultRoomStandId(room);
        indoor.exteriorNode = null;
        discoverIndoorRoom(move.toRoomId);
        indoor.level =
          building.value.roomById[move.toRoomId]?.level ?? indoor.level;
        indoor.viewLevel = indoor.level;
        finishAfter(INDOOR_MOVE_MS);
        return;
      }
      indoor.moving = false;
      return;
    }

    if (move.toExteriorNode) {
      indoor.exteriorNode = move.toExteriorNode;
      indoor.currentRoom = null;
      indoor.currentStand = null;
      finishAfter(INDOOR_MOVE_MS);
      return;
    }

    if (move.onSpiral) {
      indoor.level = move.toLevel;
      indoor.viewLevel = move.toLevel;
      finishAfter(FLOOR_MOVE_MS);
      return;
    }

    if (move.toStandId && move.toRoomId === indoor.currentRoom) {
      indoor.currentStand = move.toStandId;
      finishAfter(INDOOR_MOVE_MS);
      return;
    }

    const from = building.value.roomById[indoor.currentRoom];
    const to = building.value.roomById[move.toRoomId];
    if (!to) {
      indoor.moving = false;
      return;
    }

    indoor.currentRoom = move.toRoomId;
    indoor.currentStand = move.doorId
      ? doorThresholdForRoom(building.value, move.toRoomId, move.doorId)?.id
      : defaultRoomStandId(to);
    discoverIndoorRoom(move.toRoomId);

    if (to.feature) {
      indoor.level = move.toLevel ?? from.level ?? from.levels?.[0];
    } else {
      indoor.level = move.toLevel ?? to.level ?? to.levels?.[0];
    }
    indoor.viewLevel = indoor.level;

    finishAfter(INDOOR_MOVE_MS);
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

  function moveToStand(standId) {
    const move = indoorMoves.value.find((item) =>
      item.toRoomId === indoor.currentRoom && item.toStandId === standId
    );
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
    if (indoor.moving || !nodeIds.length) return
    indoor.moving = true

    const startNode = building.value.exterior?.nodeById?.[indoor.exteriorNode]
    if (!startNode?.at) { indoor.moving = false; return }

    // Build an ordered list of { at, nodeId? } waypoints for the entire route.
    const waypoints = [{ at: startNode.at }]
    let prev = indoor.exteriorNode
    for (const nodeId of nodeIds) {
      const pts = exteriorSegmentPoints(building.value, prev, nodeId)
      if (!pts.length) {
        const dest = building.value.exterior?.nodeById?.[nodeId]
        if (dest?.at) waypoints.push({ at: dest.at, nodeId })
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          waypoints.push({ at: pts[i] })
        }
        waypoints.push({ at: pts[pts.length - 1], nodeId })
      }
      prev = nodeId
    }

    // Arc-length parameterization so the avatar walks at constant speed.
    const dists = [0]
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1].at, b = waypoints[i].at
      dists.push(dists[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
    }
    const totalDist = dists[dists.length - 1]
    if (!totalDist) { indoor.moving = false; return }

    const totalMs = exteriorWalkDurationMs(totalDist, prefersReducedMapMotion())
    if (totalMs === 0) {
      indoor.exteriorNode = nodeIds.at(-1)
      indoor.avatarWaypoint = null
      indoor.moving = false
      return
    }
    const startTime = performance.now()

    // Real nodes queued to be committed as the avatar passes their distance.
    const pendingNodes = waypoints
      .map((wp, i) => ({ dist: dists[i], nodeId: wp.nodeId }))
      .filter((n) => n.nodeId)

    function frame() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / totalMs, 1)
      const targetDist = progress * totalDist

      // Advance exteriorNode as avatar passes real node positions.
      while (pendingNodes.length && pendingNodes[0].dist <= targetDist) {
        indoor.exteriorNode = pendingNodes.shift().nodeId
      }

      if (progress >= 1) {
        indoor.avatarWaypoint = null
        indoor.moving = false
        return
      }

      // Interpolate position on the current segment.
      let seg = 0
      while (seg < dists.length - 2 && dists[seg + 1] <= targetDist) seg++
      const segLen = dists[seg + 1] - dists[seg]
      const segT = segLen > 0 ? (targetDist - dists[seg]) / segLen : 0
      const a = waypoints[seg].at, b = waypoints[seg + 1].at
      indoor.avatarWaypoint = {
        x: a.x + (b.x - a.x) * segT,
        y: a.y + (b.y - a.y) * segT,
      }

      requestAnimationFrame(frame)
    }

    indoor.avatarWaypoint = startNode.at
    requestAnimationFrame(frame)
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
    moveToStand,
    moveToExteriorNode,
    moveKey,
    isDestinationNamed,
  };
}
