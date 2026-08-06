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
  lockFreeFromRoom,
} from "../lib/maps/composables/useDoors.js";
import {
  describeBarrierSearchResult,
  searchActionLabel,
} from "../lib/maps/composables/useBarrierOpenings.js";
import { barrierHintAtStand } from "../lib/maps/composables/useBarrierStand.js";
import { pushPlayMessage } from "./usePlayMessages.js";
import { markCharacterChanged } from "./useCharacterState.js";
import {
  buildProcessFixtureActions,
  performProcessFixtureAction,
  processFixtureStatusLines,
} from "../lib/maps/composables/indoor/roomFixtures.js";
import {
  characterHolderId,
  holdingRecords,
  transferHolding,
} from "../lib/character/holdings.js";
import {
  addStartingInstance,
  ensureContainerHolder,
  ensureFixedHolderAt,
} from "../lib/character/holdingsAuthoring.js";
import {
  containerContentsRecords,
  containerGroupInspectLabel,
  containerInstanceLabel,
  contentFlavorLabel,
  formatContainerGroupDiscovery,
} from "../lib/character/containerLabels.js";
import {
  DEAD_LIGHT_SWITCH_NOTICE,
  lightFixtureForRoom,
  roomLightAction,
} from "../lib/maps/composables/indoor/roomLights.js";

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
 * Story movement choices are authored prompts, so action policy and choice
 * application own validity; do not hide them during button construction.
 */
export function buildStoryChoices(pendingBeat) {
  if (!pendingBeat?.choices?.length) return [];
  return pendingBeat.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => !choice.disabled)
    .map(({ choice, index }) => ({
      id: `story:${index}`,
      toHexId: choice.go_hex ?? null,
      toRoomId: choice.go_room ?? null,
      toExteriorNode: choice.go_exterior_node ?? null,
      enterBuilding: choice.enter ?? null,
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
  const exteriorNodes = new Set();
  for (const choice of pendingBeat?.choices ?? []) {
    if (choice.disabled) continue;
    if (choice.go_hex) hexes.add(choice.go_hex);
    if (choice.go_room) rooms.add(choice.go_room);
    if (choice.go_exterior_node) exteriorNodes.add(choice.go_exterior_node);
    if (choice.enter) hexes.add("__enter__");
  }
  return { hexes, rooms, exteriorNodes };
}

export function buildOutdoorSearchActions(outdoor) {
  if (outdoor.hasObviousPassageAtStand) return [];
  if ((outdoor.passageCrossings ?? []).length > 0) return [];
  const kinds = outdoor.availableSearchKinds?.() ?? [];
  if (!kinds.length) {
    if (!outdoor.canSearchHere?.()) return [];
    // Fallback for older outdoor adapters without availableSearchKinds.
    const label = searchActionLabel({
      openings: outdoor.searchableOpenings?.() ?? [],
      atBarrier: outdoor.state.atBarrier ??
        outdoor.state.lastBlocked ??
        (outdoor.barrierCutsCurrentHex?.("fence")
          ? "fence"
          : outdoor.barrierCutsCurrentHex?.("stream")
            ? "stream"
            : outdoor.barrierCutsCurrentHex?.("river")
              ? "river"
              : null),
      lastBlocked: outdoor.state.lastBlocked,
    });
    return [{ id: "search:barrier", label, kind: "search" }];
  }
  return kinds.map((barrierKind) => ({
    id: kinds.length === 1 ? "search:barrier" : `search:barrier:${barrierKind}`,
    label: searchActionLabel(barrierKind),
    kind: "search",
    barrierKind,
  }));
}

export function buildOutdoorPassageActions(outdoor) {
  return (outdoor.passageCrossings ?? []).map((m) => ({
    id: `passage:${m.openingId}`,
    openingId: m.openingId,
    label: m.label,
    kind:
      m.barrierKind === "stream" || m.barrierKind === "river"
        ? m.barrierKind
        : "fence",
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

export function buildOutdoorEnterBuildingActions(outdoor, indoor) {
  if (!outdoor.atBuildingEntrance || !indoor?.building?.label) return [];
  return [{
    id: "enter-building",
    label: "Switch to station map",
    enterBuilding: true,
    kind: "transition",
  }];
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
  if (kind === "stream") return "stream";
  if (kind === "river") return "river";
  if (kind === "cliff") return "cliff edge";
  if (kind === "ravine") return "ravine";
  return kind ?? "barrier";
}

export function buildOutdoorRouteActions(outdoor, pendingBeat = null) {
  const storyDests = storyChoiceDestinations(pendingBeat);
  return (outdoor.moves ?? [])
    .filter((move) => move.routeId)
    .filter((move) => !storyDests.hexes.has(move.toHexId))
    .map((move) => ({
      id: `route:${move.toHexId}`,
      toHexId: move.toHexId,
      label: routeActionLabel(move),
      kind: move.kind ?? "route",
    }));
}

export function buildOutdoorBarrierFollowActions(outdoor, pendingBeat = null) {
  const storyDests = storyChoiceDestinations(pendingBeat);
  const currentBarrier =
    outdoor.barrierHintAtStand?.() ??
    outdoor.state?.atBarrier ??
    outdoor.state?.lastBlocked ??
    null;
  if (!currentBarrier) return [];

  return (outdoor.directMoves ?? [])
    .filter((move) => !storyDests.hexes.has(move.toHexId))
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

export function buildOutdoorDirectMovementActions(outdoor, pendingBeat = null) {
  const storyDests = storyChoiceDestinations(pendingBeat);
  const routeDests = new Set((outdoor.moves ?? [])
    .filter((move) => move.routeId)
    .map((move) => move.toHexId));
  const barrierDests = new Set(buildOutdoorBarrierFollowActions(outdoor, pendingBeat)
    .map((action) => action.toHexId));

  return (outdoor.directMoves ?? [])
    .filter((move) => !routeDests.has(move.toHexId))
    .filter((move) => !barrierDests.has(move.toHexId))
    .filter((move) => !storyDests.hexes.has(move.toHexId))
    .map((move) => ({
      id: `move-hex:${move.toHexId}`,
      toHexId: move.toHexId,
      label: defaultMovementLabel(move),
      kind: "move",
    }));
}

export function buildOutdoorPlayActions(
  outdoor,
  pendingBeat = null,
  indoor = null,
  nearbyHoldings = [],
) {
  return [
    ...buildOutdoorRouteActions(outdoor, pendingBeat),
    ...buildOutdoorBarrierFollowActions(outdoor, pendingBeat),
    ...buildOutdoorDirectMovementActions(outdoor, pendingBeat),
    ...buildOutdoorEnterBuildingActions(outdoor, indoor),
    ...buildOutdoorSearchActions(outdoor),
    ...buildOutdoorPassageUnlockActions(outdoor),
    ...buildOutdoorPassageToggleActions(outdoor),
    ...buildOutdoorPassageActions(outdoor),
    ...nearbyHoldings.map((record) => ({
      id: `holding-pickup:${record.type}:${record.id}`,
      label: `Pick up ${withArticle(record.label)}`,
      kind: "pickup",
    })),
  ].filter(isVisibleAction);
}

export function getMovementOptions(outdoor, pendingBeat, options = {}) {
  void outdoor;
  const actions = buildStoryChoices(pendingBeat);
  if (options.suppressEnterBuilding) {
    return actions.filter((action) => !action.enterBuilding);
  }
  return actions;
}

export function handleOutdoorChooseAction(
  outdoor,
  applyChoice,
  actionId,
  travelToHex = (hexId) => outdoor.moveTo(hexId),
  enterBuilding = () => {},
  pickupHolding = () => {},
) {
  if (actionId === "enter-building") {
    enterBuilding();
    return;
  }
  if (actionId === "search:barrier" || actionId.startsWith("search:barrier:")) {
    const barrierKind = actionId.startsWith("search:barrier:")
      ? actionId.slice("search:barrier:".length)
      : null;
    outdoor.searchBarrier?.(barrierKind || undefined);
    const message = describeBarrierSearchResult(outdoor.state?.lastSearch);
    if (message) pushPlayMessage(message, { source: "action" });
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
  if (actionId.startsWith("holding-pickup:")) {
    pickupHolding(actionId.slice("holding-pickup:".length));
    return;
  }
  if (actionId.startsWith("route:") || actionId.startsWith("barrier:")) {
    travelToHex(actionId.slice(actionId.indexOf(":") + 1));
    return;
  }
  if (actionId.startsWith("move-hex:")) {
    travelToHex(actionId.slice("move-hex:".length));
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
    const itemDef = itemDefinition(indoor, pickup.item);
    const label = pickup.label || itemDef?.label || pickup.item;
    // Container pickups support Look in (materializes a holdings instance at this stand).
    if (itemDef?.container) {
      items.push({
        id: `pickup-look:${pickup.id}`,
        label: `Look in ${withArticle(label)}`,
      });
    }
    items.push({
      id: `pickup:${pickup.id}`,
      label: `Pick up ${withArticle(label)}`,
    });
  }

  const nearbyHoldings = nearbyPortableHoldings(indoor);
  const containerRecords = nearbyHoldings.filter((record) => isNearbyContainerRecord(indoor, record));
  const nonContainerRecords = nearbyHoldings.filter((record) => !isNearbyContainerRecord(indoor, record));
  const containersByItem = groupBy(containerRecords, (record) => record.item);

  for (const [itemId, group] of containersByItem) {
    const baseLabel = group[0]?.definition?.label || itemId;
    if (group.length >= 2) {
      items.push({
        id: `holding-inspect-group:${itemId}`,
        label: containerGroupInspectLabel(baseLabel, group.length),
      });
      for (const record of group) {
        const label = holdingDisplayLabel(indoor, record);
        items.push({
          id: `holding-pickup:${record.type}:${record.id}`,
          label: `Pick up ${withArticle(label)}`,
        });
      }
      continue;
    }
    const record = group[0];
    const label = holdingDisplayLabel(indoor, record);
    items.push({
      id: `holding-look:${record.type}:${record.id}`,
      label: `Look in ${withArticle(label)}`,
    });
    items.push({
      id: `holding-pickup:${record.type}:${record.id}`,
      label: `Pick up ${withArticle(label)}`,
    });
  }

  for (const record of nonContainerRecords) {
    items.push({
      id: `holding-pickup:${record.type}:${record.id}`,
      label: `Pick up ${withArticle(holdingDisplayLabel(indoor, record))}`,
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

  for (const d of doorActionsAvailableHere(indoor)) {
    const door = building.doorById[d.doorId];
    if (!door) continue;
    const state = indoor.doorStateFor(d.doorId);
    const name = contextualDoorLabel(indoor, d);
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
      canToggleLock(
        doorState,
        building.areaId,
        d.doorId,
        building,
        playerRoomId,
        inventory,
        facility,
      )
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

  const lightAction = roomLightPlayAction(indoor);
  if (lightAction) items.push(lightAction);

  for (const action of buildProcessFixtureActions(indoor)) {
    items.push(action);
  }

  return items.filter(isVisibleAction);
}

function roomLightPlayAction(indoor) {
  const roomId = indoor.playerRoomId ?? indoor.indoor?.currentRoom ?? null;
  if (!roomId) return null;
  const powerOn = Boolean(
    indoor.powerOn
      ?? indoor.stationPowerOnline
      ?? indoor.indoor?.facility?.hydroOnline,
  );
  return roomLightAction(
    indoor.building,
    indoor.indoor?.facility ?? indoor.facility,
    roomId,
    powerOn,
  );
}

function doorActionsAvailableHere(indoor) {
  const doors = [...(indoor.nearbyDoors ?? [])];
  const playerRoomId = indoor.playerRoomId;
  if (!playerRoomId) return doors;

  const knownDoorIds = new Set(doors.map((door) => door.doorId));
  for (const door of indoor.building?.doors ?? []) {
    if (knownDoorIds.has(door.id) || lockFreeFromRoom(door) !== playerRoomId) continue;
    const link = (indoor.building?.links ?? []).find((candidate) =>
      candidate.door === door.id &&
      (candidate.from === playerRoomId || candidate.to === playerRoomId),
    );
    const toRoomId = link?.from === playerRoomId ? link.to : link?.from ?? null;
    const room = toRoomId ? indoor.building?.roomById?.[toRoomId] : null;
    doors.push({
      doorId: door.id,
      toRoomId,
      toName: room?.label ?? null,
    });
  }
  return doors;
}

function contextualDoorLabel(indoor, nearbyDoor) {
  const building = indoor.building;
  const door = building.doorById?.[nearbyDoor.doorId];
  const destinationRoomId = nearbyDoor.toRoomId;
  const discovered = indoor.indoor?.discovered;
  if (destinationRoomId && discovered?.has?.(destinationRoomId)) {
    if (door?.label) return door.label;
    const room = building.roomById?.[destinationRoomId];
    const label = room ? doorRoomName(room) : nearbyDoor.toName;
    return label ? `${label} door` : doorLabel(building, nearbyDoor.doorId, nearbyDoor.toName);
  }
  if (destinationRoomId && !discovered?.has?.(destinationRoomId)) {
    const unknownDoors = (indoor.nearbyDoors ?? []).filter((item) =>
      item.toRoomId && !discovered?.has?.(item.toRoomId)
    );
    return unknownDoors.length > 1
      ? positionedDoorLabel(building, indoor.playerRoomId, door)
      : "door";
  }
  return doorLabel(building, nearbyDoor.doorId, nearbyDoor.toName);
}

function doorRoomName(room) {
  return String(room?.label ?? room?.id ?? "")
    .replace(/\s+room$/i, "")
    .toLowerCase();
}

function positionedDoorLabel(building, roomId, door) {
  const room = building.roomById?.[roomId];
  if (!room || !door?.at) return "door";
  const left = room.x;
  const right = room.x + (room.w ?? 1);
  const top = room.y;
  const bottom = room.y + (room.h ?? 1);
  const sides = [
    { label: "west", distance: Math.abs(door.at.x - left) },
    { label: "east", distance: Math.abs(door.at.x - right) },
    { label: "north", distance: Math.abs(door.at.y - top) },
    { label: "south", distance: Math.abs(door.at.y - bottom) },
  ].sort((a, b) => a.distance - b.distance);
  return `${sides[0]?.label ?? "nearby"} door`;
}

function movementLabel(indoor, move) {
  if (move.kind === "stairs" || move.kind === "winding-stairs" || move.onSpiral) {
    return isDescendingStairs(indoor, move) ? "Descend the stairs" : "Climb the stairs";
  }
  if (indoor?.indoor && !indoor.indoor.exteriorNode && move.toExteriorNode) return "Go outside";
  if (indoor?.indoor?.exteriorNode && move.toRoomId && move.kind === "door") return "Go inside";
  if (
    move.toRoomId &&
    !isDestinationRoomDiscovered(indoor, move.toRoomId) &&
    !isKnownGenericDestination(indoor, move.toRoomId)
  ) {
    return "Enter the room";
  }
  if (
    move.toRoomId &&
    move.kind === "door" &&
    indoor?.indoor?.discovered?.has &&
    !indoor.indoor.discovered.has(move.toRoomId)
  ) {
    return "Enter the room";
  }
  if (move.toExteriorNode) return `Go ${move.label ?? "along the footpath"}`;
  if (move.toStandId) return `Go ${move.label ?? "to another spot"}`;
  if (move.toRoomId) return `Go ${move.label ?? "to another room"}`;
  return `Go ${move.label ?? "onward"}`;
}

function isDestinationRoomDiscovered(indoor, roomId) {
  const discovered = indoor?.indoor?.discovered;
  return !discovered?.has || discovered.has(roomId);
}

function isKnownGenericDestination(indoor, roomId) {
  const room = indoor?.building?.roomById?.[roomId];
  return !!room?.feature || !!room?.open;
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
  const storyDests = storyChoiceDestinations(pendingBeat);
  const moves = indoor.indoorMoves ?? [];
  return moves
    .filter((move) => move.toExteriorNode || move.toStandId || move.toRoomId)
    .filter((move) => !move.toRoomId || !storyDests.rooms.has(move.toRoomId))
    .filter((move) => !move.toExteriorNode || !storyDests.exteriorNodes.has(move.toExteriorNode))
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
  if (actionId.startsWith("pickup-look:")) {
    return lookInBuildingPickup(indoor, actionId.slice("pickup-look:".length));
  }
  if (actionId.startsWith("pickup:")) {
    indoor.tryPickup(actionId.slice("pickup:".length));
    return;
  }
  if (actionId.startsWith("holding-inspect-group:")) {
    return inspectNearbyContainerGroup(indoor, actionId.slice("holding-inspect-group:".length));
  }
  if (actionId.startsWith("holding-look:")) {
    return lookInNearbyHolding(indoor, actionId.slice("holding-look:".length));
  }
  if (actionId.startsWith("holding-pickup:")) {
    return pickupNearbyHolding(indoor, actionId.slice("holding-pickup:".length));
  }
  if (actionId.startsWith("action:")) {
    return indoor.performAction(actionId.slice("action:".length));
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
  if (actionId.startsWith("room-lights:flip:")) {
    const roomId = actionId.slice("room-lights:flip:".length);
    const result = indoor.toggleRoomLights?.(roomId)
      ?? { ok: false, error: "Light switches are unavailable." };
    if (!result.ok) return result;
    // Power is out (or unknown): flip still toggles the remembered switch state.
    return { ok: true, notice: DEAD_LIGHT_SWITCH_NOTICE };
  }
  if (actionId.startsWith("room-lights:on:")) {
    const result = indoor.setRoomLights?.(actionId.slice("room-lights:on:".length), true)
      ?? { ok: false, error: "Light switches are unavailable." };
    if (!result.ok) return result;
    return { ok: true, notice: result.lit ? null : DEAD_LIGHT_SWITCH_NOTICE };
  }
  if (actionId.startsWith("room-lights:off:")) {
    const result = indoor.setRoomLights?.(actionId.slice("room-lights:off:".length), false)
      ?? { ok: false, error: "Light switches are unavailable." };
    if (!result.ok) return result;
    return { ok: true };
  }
  if (actionId.startsWith("fixture:")) {
    const result = performProcessFixtureAction(
      indoor,
      actionId,
      indoor.gameState ?? null,
    );
    if (result?.characterChanged && indoor.character) {
      markCharacterChanged(indoor.character);
    }
    return result;
  }
  if (actionId.startsWith("exit-world:")) {
    indoor.exitViaDoor(actionId.slice("exit-world:".length));
    return;
  }
  if (actionId === "exit-building") {
    indoor.exitBuilding();
  }
}

function nearbyPortableHoldings(indoor) {
  const character = indoor.character;
  if (!character?.holdings) return [];
  const holders = nearbyFixedHolderIds(indoor);
  return holdingRecords(character.holdings, character.definitions, holders)
    .filter((record) => record.definition?.portable !== false)
    .map((record) => ({
      ...record,
      label: holdingDisplayLabel(indoor, {
        ...record,
        label: record.definition?.label ?? record.item,
      }),
    }));
}

function holdingDisplayLabel(indoor, record) {
  const base = record.label || record.definition?.label || record.item;
  if (!isNearbyContainerRecord(indoor, record) || record.type !== "instance") {
    return base;
  }
  return containerInstanceLabel(
    indoor.character?.holdings,
    indoor.character?.definitions,
    record.id,
    {
      baseLabel: record.definition?.label || base,
      itemId: record.item,
    },
  );
}

function inspectNearbyContainerGroup(indoor, itemId) {
  const character = indoor.character;
  if (!character?.holdings) return { ok: false, error: "Character holdings are unavailable." };
  const group = nearbyPortableHoldings(indoor)
    .filter((record) => isNearbyContainerRecord(indoor, record))
    .filter((record) => record.item === itemId);
  if (!group.length) return { ok: false, error: "Those containers are not within reach." };

  const baseLabel = group[0].definition?.label || itemId;
  const entries = group.map((record) => {
    const contents = containerContentsRecords(
      character.holdings,
      character.definitions,
      record.id,
    );
    const detail = contents.length
      ? contents
        .map((entry) => {
          const name = contentFlavorLabel(entry.definition?.label || entry.item);
          const qty = Number(entry.quantity) || 1;
          return qty > 1 ? `${name} ×${qty}` : name;
        })
        .join(", ")
      : "Empty";
    return {
      id: record.id,
      type: record.type,
      item: record.item,
      label: holdingDisplayLabel(indoor, record),
      detail,
      canPickUp: record.definition?.portable !== false,
      key: `${record.type}:${record.id}`,
    };
  });

  return {
    ok: true,
    inspectGroup: {
      itemId,
      title: containerGroupInspectLabel(baseLabel, entries.length),
      intro: /tastee\s*tack/i.test(baseLabel)
        ? "Shelf-stable Tastee Tack rations for station crews. Each box is a different meal."
        : "Choose a container to open or take with you.",
      entries,
    },
  };
}

function itemDefinition(indoor, itemId) {
  return (indoor.character?.definitions?.items ?? []).find((item) => item.id === itemId) ?? null;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const entry of list) {
    const key = keyFn(entry);
    const bucket = map.get(key) ?? [];
    bucket.push(entry);
    map.set(key, bucket);
  }
  return map;
}

function isNearbyContainerRecord(indoor, record) {
  if (record?.type !== "instance") return false;
  if (record.definition?.container) return true;
  return Boolean(indoor.character?.holdings?.holders?.[`container:${record.id}`]);
}

/**
 * Open the within-reach inventory focused on a container still in the world.
 * Does not pick the container up.
 */
function lookInNearbyHolding(indoor, encoded) {
  const character = indoor.character;
  if (!character?.holdings) return { ok: false, error: "Character holdings are unavailable." };
  const [type, ...idParts] = String(encoded).split(":");
  const id = idParts.join(":");
  const record = nearbyPortableHoldings(indoor)
    .find((entry) => entry.type === type && entry.id === id);
  if (!record) return { ok: false, error: "That is not within reach." };
  if (!isNearbyContainerRecord(indoor, record)) {
    return { ok: false, error: "There is nothing to look inside." };
  }
  return {
    ok: true,
    lookIn: { type, id, key: `${type}:${id}` },
  };
}

/**
 * Look into a building pickup that is a container item.
 * Materializes a holdings instance on the room/stand if needed so contents can live there.
 */
function lookInBuildingPickup(indoor, pickupId) {
  const character = indoor.character;
  if (!character?.holdings) return { ok: false, error: "Character holdings are unavailable." };
  const pickup = (indoor.building?.pickups ?? indoor.roomPickups ?? [])
    .find((entry) => entry.id === pickupId)
    ?? (indoor.roomPickups ?? []).find((entry) => entry.id === pickupId);
  // Prefer full building pickups list when available for room/stand location.
  const buildingPickup = (indoor.building?.pickups ?? []).find((entry) => entry.id === pickupId) ?? pickup;
  if (!buildingPickup) return { ok: false, error: "That is not within reach." };
  if (buildingPickup.room && indoor.indoor?.currentRoom && buildingPickup.room !== indoor.indoor.currentRoom) {
    return { ok: false, error: "That is not within reach." };
  }
  if (
    buildingPickup.stand
    && indoor.indoor?.currentStand
    && buildingPickup.stand !== indoor.indoor.currentStand
  ) {
    return { ok: false, error: "That is not within reach." };
  }

  const itemDef = itemDefinition(indoor, buildingPickup.item);
  if (!itemDef?.container) {
    return { ok: false, error: "There is nothing to look inside." };
  }

  const instanceId = ensureContainerInstanceAtLocation(character, itemDef, {
    room: buildingPickup.room,
    stand: buildingPickup.stand ?? null,
    roomLabel: indoor.building?.roomById?.[buildingPickup.room]?.label,
    standLabel: (indoor.building?.roomById?.[buildingPickup.room]?.stands ?? [])
      .find((stand) => stand.id === buildingPickup.stand)?.label,
  });
  if (!instanceId) return { ok: false, error: "Could not open that container." };
  markCharacterChanged(character);
  return {
    ok: true,
    lookIn: { type: "instance", id: instanceId, key: `instance:${instanceId}` },
  };
}

/**
 * Ensure a container instance exists on a fixed holder at room/stand.
 * Reuses an existing instance of the same item at that location when present.
 */
export function ensureContainerInstanceAtLocation(character, itemDefinition, {
  room,
  stand = null,
  roomLabel = null,
  standLabel = null,
} = {}) {
  if (!character?.holdings || !itemDefinition?.container) return null;
  const holdings = character.holdings;
  const holderId = ensureFixedHolderAt(holdings, {
    room,
    stand,
    roomLabel,
    standLabel,
    acceptsKinds: [
      "container",
      ...(itemDefinition.container.accepts?.kinds ?? []),
    ],
    slots: Math.max(4, Number(itemDefinition.container.capacity?.slots) || 12),
  });

  const existing = Object.entries(holdings.instances ?? {}).find(
    ([, instance]) => instance.item === itemDefinition.id && instance.holder === holderId,
  );
  if (existing) {
    ensureContainerHolder(holdings, existing[0], itemDefinition);
    return existing[0];
  }

  return addStartingInstance(holdings, itemDefinition, { holderId });
}

/**
 * Portable world items currently within reach (authored pickups + fixed holdings
 * at this room/stand or exterior node).
 */
export function listNearbyReachableItems(indoor) {
  const items = [];
  for (const pickup of indoor.roomPickups ?? []) {
    items.push({
      key: `pickup:${pickup.id}`,
      label: pickup.label || pickup.item || pickup.id,
      itemId: pickup.item,
      isContainer: Boolean(itemDefinition(indoor, pickup.item)?.container),
    });
  }
  for (const record of nearbyPortableHoldings(indoor)) {
    items.push({
      key: `holding:${record.type}:${record.id}`,
      label: record.label || record.item || record.id,
      itemId: record.item,
      isContainer: isNearbyContainerRecord(indoor, record),
    });
  }
  return items;
}

/** Signature for watchers when nearby item set or stand changes. */
export function nearbyReachableItemsSignature(indoor) {
  const room = indoor.indoor?.currentRoom ?? null;
  const stand = indoor.indoor?.currentStand ?? null;
  const exterior = indoor.indoor?.exteriorNode ?? null;
  const keys = listNearbyReachableItems(indoor).map((item) => item.key).sort();
  return `${room ?? ""}|${stand ?? ""}|${exterior ?? ""}|${keys.join(",")}`;
}

/**
 * Player-facing discovery line for items at the current stand, e.g.
 * "There is a bolt cutter." / "There are four drinking glasses."
 * Multiple same-type containers with different contents are summarized by flavor.
 */
export function formatNearbyReachableItemsMessage(indoor) {
  const items = listNearbyReachableItems(indoor);
  if (!items.length) return null;

  const containerGroups = new Map();
  const otherLabels = [];
  for (const item of items) {
    if (item.isContainer && item.itemId) {
      const group = containerGroups.get(item.itemId) ?? [];
      group.push(item);
      containerGroups.set(item.itemId, group);
    } else {
      otherLabels.push(String(item.label ?? "").trim());
    }
  }

  const groupPhrases = [];
  for (const group of containerGroups.values()) {
    if (group.length >= 2) {
      const summary = formatContainerGroupDiscovery(
        itemDefinition(indoor, group[0].itemId)?.label || group[0].label,
        group.map((entry) => entry.label),
      );
      if (summary) groupPhrases.push(summary.replace(/\.$/, ""));
      continue;
    }
    otherLabels.push(String(group[0].label ?? "").trim());
  }

  // Collapse identical ordinary labels: four "drinking glass" → one counted phrase.
  const simplePhrases = collapseIdenticalLabels(otherLabels);

  if (!groupPhrases.length && !simplePhrases.length) return null;

  // Only ordinary pickups (no multi-flavor container summaries).
  if (!groupPhrases.length) {
    if (simplePhrases.length === 1) {
      return simplePhrases[0].plural
        ? `There are ${simplePhrases[0].text}.`
        : `There is ${simplePhrases[0].text}.`;
    }
    const texts = simplePhrases.map((phrase) => phrase.text);
    if (texts.length === 2) return `There is ${texts[0]} and ${texts[1]}.`;
    return `There is ${texts.slice(0, -1).join(", ")}, and ${texts.at(-1)}.`;
  }

  // Container summaries already include "There are N boxes...".
  const parts = [
    ...groupPhrases,
    ...simplePhrases.map((phrase) =>
      phrase.plural ? `there are ${phrase.text}` : `there is ${phrase.text}`,
    ),
  ];
  if (parts.length === 1) {
    const line = parts[0];
    return line.endsWith(".") ? line : `${line}.`;
  }
  const normalized = parts.map((phrase, index) => {
    let text = phrase.replace(/\.$/, "");
    if (index === 0) return text.charAt(0).toUpperCase() + text.slice(1);
    return text.charAt(0).toLowerCase() + text.slice(1);
  });
  return `${normalized.slice(0, -1).join("; ")}; and ${normalized.at(-1)}.`;
}

/**
 * Group identical labels for discovery copy.
 * @returns {{ text: string, plural: boolean }[]}
 */
function collapseIdenticalLabels(labels) {
  const counts = new Map();
  for (const raw of labels) {
    const label = String(raw ?? "").trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const phrases = [];
  for (const [label, count] of counts) {
    if (count === 1) {
      phrases.push({ text: withIndefiniteArticle(label), plural: false });
    } else {
      phrases.push({
        text: `${countWord(count)} ${pluralizeNounPhrase(label)}`,
        plural: true,
      });
    }
  }
  return phrases;
}

const SMALL_COUNT_WORDS = [
  "", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

function countWord(count) {
  return SMALL_COUNT_WORDS[count] ?? String(count);
}

/** "drinking glass" → "drinking glasses"; "box" → "boxes". */
function pluralizeNounPhrase(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return raw;
  const parts = raw.split(/\s+/);
  const last = parts.pop();
  parts.push(pluralizeWord(last));
  return parts.join(" ");
}

function pluralizeWord(word) {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "bolt cutter" → "a bolt cutter"; preserves existing a/an/the. */
function withIndefiniteArticle(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return "";
  if (/^(the|a|an)\s/i.test(raw)) return raw;
  if (/^[aeiou]/i.test(raw)) return `an ${raw}`;
  return `a ${raw}`;
}

function nearbyFixedHolderIds(indoor) {
  const currentRoom = indoor.indoor?.currentRoom ?? null;
  const currentStand = indoor.indoor?.currentStand ?? null;
  const exteriorNode = indoor.indoor?.exteriorNode ?? null;
  return Object.values(indoor.character?.holdings?.holders ?? {})
    .filter((holder) => holder.kind === "fixed" || holder.kind === "vehicle")
    .filter((holder) => {
      const location = holder.location ?? {};
      if (currentRoom && location.room === currentRoom) {
        return !location.stand || location.stand === currentStand;
      }
      if (exteriorNode && location.exteriorNode === exteriorNode) {
        return !location.stand || location.stand === currentStand;
      }
      return false;
    })
    .map((holder) => holder.id);
}

function pickupNearbyHolding(indoor, encoded) {
  const character = indoor.character;
  if (!character?.holdings) return { ok: false, error: "Character holdings are unavailable." };
  const [type, ...idParts] = String(encoded).split(":");
  const id = idParts.join(":");
  const record = nearbyPortableHoldings(indoor)
    .find((entry) => entry.type === type && entry.id === id);
  if (!record) return { ok: false, error: "Holding is not available." };
  try {
    // Stacks default to one; take the whole stack only for unique-style single records.
    const quantity = record.type === "stack"
      ? 1
      : (record.quantity ?? 1);
    transferHolding(character.holdings, character.definitions, {
      type,
      id,
      quantity,
      toHolder: characterHolderId(character.holdings),
    });
    markCharacterChanged(character);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function buildIndoorStatusLines(indoor, wellbeingOverview = null) {
  const lines = buildWellbeingStatusLines(wellbeingOverview);
  if (indoor.powerOn) {
    lines.push("Station power is on.");
    lines.push(...poweredObjectStatusLines(indoor));
  }
  lines.push(...processFixtureStatusLines(indoor));
  return lines;
}

export function buildWellbeingStatusLines(wellbeingOverview) {
  if (!wellbeingOverview) return [];
  const indicators = [
    wellbeingOverview.health,
    ...(wellbeingOverview.vitals ?? []),
    ...(wellbeingOverview.conditions ?? []).filter((condition) => condition.active),
  ].filter(Boolean);
  const phrases = indicators
    .filter((indicator) => indicator.tone !== "positive")
    .map(wellbeingStatusPhrase)
    .filter(Boolean);
  const isPhrases = phrases.filter((phrase) => phrase.verb === "is").map((phrase) => phrase.text);
  const hasPhrases = phrases.filter((phrase) => phrase.verb === "has").map((phrase) => phrase.text);
  return [
    isPhrases.length ? `Zanzibar is ${formatSentenceList(isPhrases)}.` : null,
    hasPhrases.length ? `Zanzibar has ${formatSentenceList(hasPhrases)}.` : null,
  ].filter(Boolean);
}

function wellbeingStatusPhrase(indicator) {
  const state = String(indicator.state ?? "").trim();
  if (!state) return null;
  const normalized = state.toLowerCase();
  if (indicator.id === "health" && normalized === "critical") {
    return { verb: "is", text: "in critical condition" };
  }
  if (indicator.id === "health" && normalized === "collapsed") {
    return { verb: "has", text: "collapsed" };
  }
  if (["injured", "injury"].includes(indicator.id)) {
    return { verb: "has", text: injuryPhrase(normalized) };
  }
  return { verb: "is", text: normalized };
}

function injuryPhrase(state) {
  if (/^(minor|moderate|severe) injury$/.test(state)) return `a ${state}`;
  return state;
}

function formatSentenceList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function poweredObjectStatusLines(indoor) {
  const roomId = indoor.indoor?.currentRoom ?? indoor.playerRoomId ?? null;
  const standId = indoor.indoor?.currentStand ?? null;
  if (!roomId) return [];
  const facility = indoor.indoor?.facility ?? indoor.facility;
  const powerOn = Boolean(
    indoor.powerOn
      ?? indoor.stationPowerOnline
      ?? facility?.hydroOnline,
  );
  const lines = [];
  // Only report light state when station power is on. While the bus is dead,
  // switch position stays hidden so "Flip the light switch" stays ambiguous.
  const lightFixture = lightFixtureForRoom(indoor.building, roomId);
  if (lightFixture && powerOn) {
    const switchClosed = Boolean(facility?.lightSwitches?.[roomId]);
    if (switchClosed) {
      lines.push(lightFixture.activeLine || `${lightFixture.label} are on.`);
    } else {
      lines.push("The lights are off.");
    }
  }
  for (const object of indoor.building?.poweredObjects ?? []) {
    if (object.room !== roomId) continue;
    if (object.kind === "lights") continue; // room.lighting is canonical
    if (object.stand && object.stand !== standId) continue;
    if (!powerOn) continue;
    lines.push(object.activeLine || `${object.label} is powered.`);
  }
  return lines.filter(Boolean);
}

export function buildOutdoorStatusLines(
  outdoor,
  indoor,
  wellbeingOverview = null,
  nearbyHoldings = [],
) {
  const lines = buildWellbeingStatusLines(wellbeingOverview);
  if (nearbyHoldings.length) {
    lines.push(`On the ground: ${formatSentenceList(nearbyHoldings.map((record) => record.label))}.`);
  }
  for (const action of outdoor.lockedPassageActions ?? []) {
    if (action.status) lines.push(action.status);
  }
  // Barrier search results are one-shot play messages (handleOutdoorChooseAction),
  // not ongoing status — leaving them here kept "On closer inspection…" forever.

  const hint = outdoor.barrierHintAtStand?.() ?? null;
  const fencePresent =
    outdoor.state.lastBlocked === "fence" ||
    hint === "fence" ||
    outdoor.barrierCutsCurrentHex?.("fence");
  const streamPresent =
    outdoor.state.lastBlocked === "stream" ||
    hint === "stream" ||
    outdoor.barrierCutsCurrentHex?.("stream");
  const riverPresent =
    outdoor.state.lastBlocked === "river" ||
    hint === "river" ||
    outdoor.barrierCutsCurrentHex?.("river");

  if (outdoor.state.lastBlocked === "fence") {
    lines.push("A fence blocks the way.");
  } else if (fencePresent) {
    lines.push("The fence line is here.");
  }
  if (outdoor.state.lastBlocked === "stream") {
    lines.push("The stream blocks the way.");
  } else if (streamPresent) {
    lines.push("The stream bank is here.");
  }
  if (outdoor.state.lastBlocked === "river") {
    lines.push("The river blocks the way.");
  } else if (riverPresent) {
    lines.push("The river bank is here.");
  }
  if (outdoor.atBuildingEntrance) {
    lines.push(`You are at the ${indoor.building.label}.`);
  }
  return lines;
}
