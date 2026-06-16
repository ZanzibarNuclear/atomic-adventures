import {
  canBreakLock,
  canCloseDoor,
  canOpenDoor,
  canToggleLock,
  doorLabel,
  doorStatusText,
  isEnablerLock,
  isManualEnablerActive,
  isSelfClosingDoor,
} from "../lib/maps/composables/useDoors.js";
import { searchActionLabel } from "../lib/maps/composables/useBarrierOpenings.js";

function actionButtonLabel(action) {
  if (action.verb) return `${action.verb} — ${action.label}`;
  return action.label;
}

/**
 * Story choice buttons for the play panel (prose stays in NarrativeCard).
 * Story choices use adjacency only — a choice may walk the player to a fence
 * and stop. Movement options use enterability (may stop at an in-hex barrier).
 */
export function buildStoryChoices(pendingBeat, isAdjacentHex = () => true) {
  if (!pendingBeat?.choices?.length || pendingBeat.revisit) return [];
  return pendingBeat.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => !choice.go_hex || isAdjacentHex(choice.go_hex))
    .map(({ choice, index }) => ({
      id: `story:${index}`,
      toHexId: choice.go_hex ?? null,
      label: choice.text,
      kind: "story",
    }));
}

export function handleStoryChoice(index, applyChoice) {
  applyChoice(Number(index));
}

/** Default compass label for a reachable move (route or direct hex step). */
export function defaultMovementLabel(move) {
  if (move?.label) return `Go ${move.label}`;
  return "Go onward";
}

export function storyChoiceDestinations(pendingBeat) {
  const hexes = new Set();
  const rooms = new Set();
  for (const choice of pendingBeat?.choices ?? []) {
    if (choice.go_hex) hexes.add(choice.go_hex);
    if (choice.go_room) rooms.add(choice.go_room);
    if (choice.enter) hexes.add("__enter__");
  }
  return { hexes, rooms };
}

/**
 * Reachable outdoor moves for "Choose an Action".
 * Story choice labels (part-i.yaml) override; otherwise compass defaults from path geometry.
 * Blocked directions are omitted — outdoor.moves / directMoves are pre-filtered.
 */
export function buildOutdoorSearchActions(outdoor) {
  if (!outdoor.canSearchHere?.()) return [];
  const label = searchActionLabel({
    openings: outdoor.searchableOpenings?.() ?? [],
    atBarrier: outdoor.state.atBarrier,
    lastBlocked: outdoor.state.lastBlocked,
  });
  return [{ id: "search:barrier", label, kind: "search" }];
}

export function buildOutdoorPassageActions(outdoor) {
  return (outdoor.passageCrossings ?? []).map((m) => ({
    id: `passage:${m.openingId}`,
    openingId: m.openingId,
    label: m.label,
    kind: m.barrierKind === "river" ? "river" : "fence",
  }));
}

export function buildOutdoorGatePuzzleActions(outdoor) {
  if (!outdoor.atLockedCompoundGate) return [];
  return [
    {
      id: "gate:solve",
      label: "Solve the puzzle to unlock",
      kind: "puzzle",
    },
  ];
}

/** @deprecated Use buildOutdoorPassageActions */
export const buildOutdoorCrossingActions = buildOutdoorPassageActions;

export function getMovementOptions(outdoor, pendingBeat) {
  const isAdjacent = (hexId) => outdoor.isAdjacentHex?.(hexId) ?? true;
  const items = [...buildStoryChoices(pendingBeat, isAdjacent)];
  const { hexes: storyHexes } = storyChoiceDestinations(pendingBeat);
  const seen = new Set(storyHexes);

  items.push(...buildOutdoorGatePuzzleActions(outdoor));

  for (const m of outdoor.moves ?? []) {
    if (seen.has(m.toHexId)) continue;
    seen.add(m.toHexId);
    items.push({
      id: `move:${m.toHexId}`,
      toHexId: m.toHexId,
      label: defaultMovementLabel(m),
      kind: m.kind,
    });
  }

  for (const o of outdoor.directMoves ?? []) {
    if (seen.has(o.toHexId)) continue;
    seen.add(o.toHexId);
    items.push({
      id: `hex:${o.toHexId}`,
      toHexId: o.toHexId,
      label: defaultMovementLabel(o),
      kind: "hex",
    });
  }

  items.push(...buildOutdoorPassageActions(outdoor));
  items.push(...buildOutdoorSearchActions(outdoor));

  return items;
}

export function handleOutdoorChooseAction(
  outdoor,
  applyChoice,
  actionId,
  travelToHex = (hexId) => outdoor.moveTo(hexId),
) {
  if (actionId === "search:barrier") {
    outdoor.searchBarrier?.();
    return;
  }
  if (actionId === "gate:solve") {
    outdoor.solveGatePuzzle?.();
    return;
  }
  if (actionId.startsWith("story:")) {
    handleStoryChoice(actionId.slice("story:".length), applyChoice);
    return;
  }
  if (actionId.startsWith("passage:")) {
    outdoor.crossPassage?.(actionId.slice("passage:".length));
    return;
  }
  if (actionId.startsWith("move:") || actionId.startsWith("hex:")) {
    const hexId = actionId.includes("hex:")
      ? actionId.slice("hex:".length)
      : actionId.slice("move:".length);
    travelToHex(hexId);
  }
}

/** Indoor items for "Choose an Action" — story choices, then moves (deduped). */
export function buildIndoorChooseActions(indoor, pendingBeat) {
  const items = [...buildStoryChoices(pendingBeat)];
  const { hexes: storyHexes, rooms: storyRooms } =
    storyChoiceDestinations(pendingBeat);
  if (storyHexes.has("__enter__")) {
    // enter-building is handled via story applyChoice, not move list
  }

  const fromRoom = indoor.currentRoomData;
  for (const m of indoor.indoorMoves ?? []) {
    const dest = m.toExteriorNode ?? m.toRoomId;
    if (dest && storyRooms.has(dest)) continue;
    const custom = fromRoom?.travel?.[dest];
    items.push({
      id: `move:${indoor.moveKey(m)}`,
      label: custom ?? `Go ${m.label}`,
      kind: m.kind === "door" ? "path" : m.kind === "path" ? "trail" : "road",
      move: m,
    });
  }

  return items;
}

export function handleIndoorChooseAction(
  indoor,
  applyChoice,
  actionId,
  travelToRoom = (roomId) => indoor.moveToRoom(roomId),
) {
  if (actionId.startsWith("story:")) {
    handleStoryChoice(actionId.slice("story:".length), applyChoice);
    return;
  }
  if (actionId.startsWith("move:")) {
    const key = actionId.slice("move:".length);
    const m = indoor.indoorMoves.find((mv) => indoor.moveKey(mv) === key);
    if (!m) return;
    if (m.toRoomId) {
      travelToRoom(m.toRoomId);
      return;
    }
    indoor.applyIndoorMove(m);
  }
}

/**
 * Build a flat action list for the play panel (pickups, room actions, doors, switches).
 */
export function buildIndoorPlayActions(indoor) {
  const items = [];

  for (const pickup of indoor.roomPickups ?? []) {
    items.push({
      id: `pickup:${pickup.id}`,
      label: `Take — ${pickup.label}`,
    });
  }

  for (const action of indoor.availableActions ?? []) {
    items.push({
      id: `action:${action.id}`,
      label: actionButtonLabel(action),
    });
  }

  const building = indoor.building;
  const doorState = indoor.indoor.doorState;
  const facility = indoor.indoor.facility;
  const inventory = indoor.indoor.inventory;
  const playerRoomId = indoor.playerRoomId;

  for (const d of indoor.nearbyDoors ?? []) {
    const door = building.doorById[d.doorId];
    if (!door) continue;
    const state = indoor.doorStateFor(d.doorId);
    const name = doorLabel(building, d.doorId, d.toName);
    const status = doorStatusText(state, door, facility);
    const hint = indoor.doorLockHint(d.doorId) || status;

    if (canBreakLock(doorState, building.areaId, d.doorId, building)) {
      items.push({
        id: `door-break:${d.doorId}`,
        label: `Break lock — ${name}`,
        hint,
      });
    }

    if (
      !isEnablerLock(door) &&
      (canToggleLock(
        doorState,
        building.areaId,
        d.doorId,
        building,
        playerRoomId,
        inventory,
        facility,
      ) ||
        state.locked)
    ) {
      items.push({
        id: `door-lock:${d.doorId}`,
        label: `${state.locked ? "Unlock" : "Lock"} — ${name}`,
        hint,
        disabled: !indoor.canToggleDoorLock(d.doorId),
      });
    }

    if (!isSelfClosingDoor(door)) {
      if (canOpenDoor(doorState, building.areaId, d.doorId)) {
        items.push({
          id: `door-open:${d.doorId}`,
          label: `Open — ${name}`,
          hint,
        });
      } else if (canCloseDoor(doorState, building.areaId, d.doorId)) {
        items.push({
          id: `door-close:${d.doorId}`,
          label: `Close — ${name}`,
          hint,
        });
      }
    }
  }

  for (const sw of indoor.roomSwitches ?? []) {
    const engaged = isManualEnablerActive(sw.door, facility);
    items.push({
      id: `switch:${sw.door}`,
      label: engaged ? `Engage motor — ${sw.label}` : sw.label,
    });
  }

  if (indoor.worldMapExit) {
    items.push({
      id: `exit-world:${indoor.worldMapExit.doorId}`,
      label: indoor.worldMapExit.label,
    });
  }

  if (indoor.indoor.exteriorNode) {
    items.push({
      id: "exit-building",
      label: "Return to the trail map",
    });
  }

  return items;
}

export function handleIndoorPlayAction(indoor, actionId) {
  if (actionId.startsWith("pickup:")) {
    indoor.tryPickup(actionId.slice("pickup:".length));
    return;
  }
  if (actionId.startsWith("action:")) {
    indoor.performAction(actionId.slice("action:".length));
    return;
  }
  if (actionId.startsWith("door-break:")) {
    indoor.tryBreakLock(actionId.slice("door-break:".length));
    return;
  }
  if (actionId.startsWith("door-lock:")) {
    indoor.tryToggleLock(actionId.slice("door-lock:".length));
    return;
  }
  if (actionId.startsWith("door-open:") || actionId.startsWith("door-close:")) {
    indoor.tryToggleDoor(actionId.split(":").slice(1).join(":"));
    return;
  }
  if (actionId.startsWith("switch:")) {
    indoor.toggleManualRelease(actionId.slice("switch:".length));
    return;
  }
  if (actionId.startsWith("exit-world:")) {
    indoor.exitViaDoor(actionId.slice("exit-world:".length));
    return;
  }
  if (actionId === "exit-building") {
    indoor.exitBuilding();
  }
}

export function buildIndoorStatusLines(indoor) {
  const lines = [];
  if (indoor.powerOn) {
    lines.push("Station power is on.");
  }
  return lines;
}

export function buildOutdoorStatusLines(outdoor, indoor) {
  const lines = [];
  if (outdoor.atGatePuzzle) {
    lines.push("A locked gate blocks the road — look closer.");
  }
  if (outdoor.state.lastBlocked === "fence") {
    lines.push("A fence blocks the way.");
  } else if (outdoor.state.lastBlocked === "river") {
    lines.push("The river blocks the way.");
  } else {
    const hint = outdoor.barrierHintAtStand?.() ?? null;
    if (hint === "fence") {
      lines.push("The fence line is here.");
    } else if (hint === "river") {
      lines.push("The river bank is here.");
    }
  }
  if (outdoor.atBuildingEntrance) {
    lines.push(`The ${indoor.building.label} is here — enter from the map or below.`);
  }
  return lines;
}
