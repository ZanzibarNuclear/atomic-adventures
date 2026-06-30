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
import { barrierHintAtStand } from "../lib/maps/composables/useBarrierStand.js";

function actionButtonLabel(action) {
  if (action.verb) return cleanActionLabel(`${action.verb} ${withArticle(action.label)}`);
  return cleanActionLabel(action.label);
}

function withArticle(label) {
  if (!label) return "";
  return /^(the|a|an)\s/i.test(label) ? label : `the ${label}`;
}

function cleanActionLabel(label) {
  return String(label ?? "").replace(/\s+[–—]\s+/g, " the ");
}

function switchActionLabel(sw, engaged) {
  const normalized = cleanActionLabel(sw.label);
  const manualRelease = normalized.match(/^Manual release (?:the )?(.+)$/i);
  if (manualRelease) {
    const target = withArticle(manualRelease[1]);
    return engaged ? `Engage the motor for ${target}` : `Release ${target} manually`;
  }
  return engaged ? `Engage the motor for ${withArticle(normalized)}` : normalized;
}

export function isVisibleAction(action) {
  return !action.disabled;
}

/**
 * Story choice buttons for the play panel (prose stays in NarrativeCard).
 * Story choices with go_hex use the same enterability predicate as movement options.
 */
export function buildStoryChoices(pendingBeat, canReachHex = () => true) {
  if (!pendingBeat?.choices?.length) return [];
  return pendingBeat.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => !choice.disabled)
    .filter(({ choice }) => !choice.go_hex || canReachHex(choice.go_hex))
    .map(({ choice, index }) => ({
      id: `story:${index}`,
      toHexId: choice.go_hex ?? null,
      label: choice.text,
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

export function buildOutdoorSearchActions(outdoor) {
  if (!outdoor.canSearchHere?.()) return [];
  const label = searchActionLabel({
    openings: outdoor.searchableOpenings?.() ?? [],
    atBarrier: outdoor.barrierCutsCurrentHex?.("fence")
      ? "fence"
      : outdoor.state.atBarrier,
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

export function buildOutdoorPassageUnlockActions(outdoor) {
  return (outdoor.lockedPassageActions ?? []).map((action) => ({
    id: `passage-unlock:${action.openingId}`,
    openingId: action.openingId,
    label: action.label,
    kind: "puzzle",
  }));
}

export function buildOutdoorPassageToggleActions(outdoor) {
  return (outdoor.passageToggleActions ?? []).map((action) => ({
    id: `passage-toggle:${action.openingId}`,
    openingId: action.openingId,
    label: action.label,
    kind: "fence",
  }));
}

function directionPhrase(direction, style = "to") {
  if (!direction) return style === "along" ? "onward" : "onward";
  return style === "along" ? direction : `to the ${direction}`;
}

function routeActionLabel(move) {
  const routeName = move.routeName ?? move.kind ?? "route";
  return `Follow the ${routeName} ${directionPhrase(move.label)}`;
}

function barrierName(kind) {
  if (kind === "fence") return "fence line";
  if (kind === "river") return "river";
  if (kind === "cliff") return "cliff edge";
  if (kind === "ravine") return "ravine";
  return kind ?? "barrier";
}

export function buildOutdoorRouteActions(outdoor, pendingBeat = null) {
  const storyDests = storyChoiceDestinations(pendingBeat).hexes;
  return (outdoor.moves ?? [])
    .filter((move) => move.routeId && !storyDests.has(move.toHexId))
    .map((move) => ({
      id: `route:${move.toHexId}`,
      toHexId: move.toHexId,
      label: routeActionLabel(move),
      kind: move.kind ?? "route",
    }));
}

export function buildOutdoorBarrierFollowActions(outdoor, pendingBeat = null) {
  const currentBarrier =
    outdoor.barrierHintAtStand?.() ??
    outdoor.state?.atBarrier ??
    outdoor.state?.lastBlocked ??
    null;
  if (!currentBarrier) return [];

  const storyDests = storyChoiceDestinations(pendingBeat).hexes;
  return (outdoor.directMoves ?? [])
    .filter((move) => !storyDests.has(move.toHexId))
    .filter((move) => {
      const preview = outdoor.previewMove?.(move.toHexId);
      if (!preview || preview.result?.activeHexId !== move.toHexId) return false;
      const destinationBarrier = barrierHintAtStand(
        preview.result.stand,
        outdoor.travelBarrierCtx?.barriers ?? [],
      );
      return destinationBarrier === currentBarrier;
    })
    .map((move) => ({
      id: `barrier:${move.toHexId}`,
      toHexId: move.toHexId,
      label: `Walk ${directionPhrase(move.label, "along")} along the ${barrierName(
        currentBarrier,
      )}`,
      kind: currentBarrier,
    }));
}

export function buildOutdoorPlayActions(outdoor, pendingBeat = null) {
  return [
    ...buildOutdoorRouteActions(outdoor, pendingBeat),
    ...buildOutdoorBarrierFollowActions(outdoor, pendingBeat),
    ...buildOutdoorSearchActions(outdoor),
    ...buildOutdoorPassageUnlockActions(outdoor),
    ...buildOutdoorPassageToggleActions(outdoor),
    ...buildOutdoorPassageActions(outdoor),
  ].filter(isVisibleAction);
}

export function getMovementOptions(outdoor, pendingBeat) {
  const canReach = (hexId) => outdoor.canReachHex?.(hexId) ?? true;
  return buildStoryChoices(pendingBeat, canReach);
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
  if (actionId.startsWith("passage-unlock:")) {
    outdoor.unlockPassage?.(actionId.slice("passage-unlock:".length));
    return;
  }
  if (actionId.startsWith("passage-toggle:")) {
    outdoor.togglePassage?.(actionId.slice("passage-toggle:".length));
    return;
  }
  if (actionId.startsWith("passage:")) {
    outdoor.crossPassage?.(actionId.slice("passage:".length));
    return;
  }
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:")) {
    travelToHex(actionId.slice(actionId.indexOf(":") + 1));
    return;
  }
  if (actionId.startsWith("story:")) {
    handleStoryChoice(actionId.slice("story:".length), applyChoice);
    return;
  }
  void travelToHex;
}

export function handleOutdoorPlayAction(
  outdoor,
  actionId,
  travelToHex = (hexId) => outdoor.moveTo(hexId),
) {
  handleOutdoorChooseAction(outdoor, () => {}, actionId, travelToHex);
}

export function buildIndoorChooseActions(indoor, pendingBeat) {
  void indoor;
  return buildStoryChoices(pendingBeat);
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
  void indoor;
  void travelToRoom;
}

/**
 * Build a flat action list for the play panel (pickups, room actions, doors, switches).
 */
export function buildIndoorPlayActions(indoor, pendingBeat = null) {
  const items = buildIndoorMovementActions(indoor, pendingBeat);

  for (const pickup of indoor.roomPickups ?? []) {
    items.push({
      id: `pickup:${pickup.id}`,
      label: `Take ${withArticle(pickup.label)}`,
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
  const inventory = indoor.character ?? indoor.indoor.inventory;
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
        label: `Break the lock on ${withArticle(name)}`,
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
        label: `${state.locked ? "Unlock" : "Lock"} ${withArticle(name)}`,
        hint,
        disabled: !indoor.canToggleDoorLock(d.doorId),
      });
    }

    if (!isSelfClosingDoor(door)) {
      if (canOpenDoor(doorState, building.areaId, d.doorId)) {
        items.push({
          id: `door-open:${d.doorId}`,
          label: `Open ${withArticle(name)}`,
          hint,
        });
      } else if (canCloseDoor(doorState, building.areaId, d.doorId)) {
        items.push({
          id: `door-close:${d.doorId}`,
          label: `Close ${withArticle(name)}`,
          hint,
        });
      }
    }
  }

  for (const sw of indoor.roomSwitches ?? []) {
    const engaged = isManualEnablerActive(sw.door, facility);
    items.push({
      id: `switch:${sw.door}`,
      label: switchActionLabel(sw, engaged),
    });
  }

  return items.filter(isVisibleAction);
}

function movementLabel(indoor, move) {
  if (move.kind === "stairs" || move.kind === "winding-stairs" || move.onSpiral) {
    return isDescendingStairs(indoor, move) ? "Descend the stairs" : "Climb the stairs";
  }
  if (indoor?.indoor && !indoor.indoor.exteriorNode && move.toExteriorNode) return "Go outside";
  if (indoor?.indoor?.exteriorNode && move.toRoomId && move.kind === "door") return "Go inside";
  if (move.toExteriorNode) return `Go ${move.label ?? "along the footpath"}`;
  if (move.toStandId) return `Go ${move.label ?? "to another spot"}`;
  if (move.toRoomId) return `Go ${move.label ?? "to another room"}`;
  return `Go ${move.label ?? "onward"}`;
}

function isDescendingStairs(indoor, move) {
  if (/\bdown\b/i.test(move.label ?? "")) return true;
  if (/\bup\b/i.test(move.label ?? "")) return false;
  const levels = indoor?.building?.levels ?? [];
  const orderFor = (id) => {
    const level = levels.find((item) => item.id === id);
    return Number(level?.order ?? levels.findIndex((item) => item.id === id));
  };
  const fromOrder = orderFor(indoor?.indoor?.level);
  const toOrder = orderFor(move.toLevel);
  if (Number.isFinite(fromOrder) && Number.isFinite(toOrder) && fromOrder !== toOrder) {
    return toOrder < fromOrder;
  }
  return false;
}

export function buildIndoorMovementActions(indoor, pendingBeat = null) {
  const moves = indoor.indoorMoves ?? [];
  const storyDests = storyChoiceDestinations(pendingBeat);
  const exteriorNodes = new Set(
    (pendingBeat?.choices ?? [])
      .map((choice) => choice.go_exterior_node)
      .filter(Boolean),
  );
  return moves
    .filter((move) => move.toExteriorNode || move.toStandId || move.toRoomId)
    .filter((move) => {
      if (move.toRoomId && storyDests.rooms.has(move.toRoomId)) return false;
      if (move.toExteriorNode && exteriorNodes.has(move.toExteriorNode)) return false;
      return true;
    })
    .map((move) => {
      if (move.toExteriorNode) {
        return {
          id: `move-exterior:${move.toExteriorNode}`,
          label: movementLabel(indoor, move),
          kind: move.kind ?? "path",
        };
      }
      if (move.toStandId) {
        return {
          id: `move-stand:${move.toStandId}`,
          label: movementLabel(indoor, move),
          kind: move.kind ?? "stand",
        };
      }
      return {
        id: `move-room:${move.toRoomId}`,
        label: movementLabel(indoor, move),
        kind: move.kind ?? "room",
      };
    });
}

export function handleIndoorPlayAction(indoor, actionId) {
  if (actionId.startsWith("move-exterior:")) {
    indoor.moveToExteriorNode(actionId.slice("move-exterior:".length));
    return;
  }
  if (actionId.startsWith("move-stand:")) {
    indoor.moveToStand(actionId.slice("move-stand:".length));
    return;
  }
  if (actionId.startsWith("move-room:")) {
    indoor.moveToRoom(actionId.slice("move-room:".length));
    return;
  }
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
  if (actionId.startsWith("door-open:")) {
    indoor.tryOpenDoor(actionId.slice("door-open:".length));
    return;
  }
  if (actionId.startsWith("door-close:")) {
    indoor.tryCloseDoor(actionId.slice("door-close:".length));
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
  for (const action of outdoor.lockedPassageActions ?? []) {
    if (action.status) lines.push(action.status);
  }
  if (
    outdoor.state.lastSearch?.kind === "fence" &&
    outdoor.state.lastSearch.foundKinds?.includes("hole")
  ) {
    lines.push("On closer inspection, you have found a hole in the fence.");
  } else if (
    outdoor.state.lastSearch?.kind === "fence" &&
    !outdoor.state.lastSearch.found?.length
  ) {
    lines.push("You see a sturdy fence covered in ivy.");
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
    lines.push(`You are at the ${indoor.building.label}.`);
  }
  return lines;
}
