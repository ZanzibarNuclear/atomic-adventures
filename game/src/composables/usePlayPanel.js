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

function actionButtonLabel(action) {
  if (action.verb) return `${action.verb} — ${action.label}`;
  return action.label;
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
  }
  if (outdoor.atBuildingEntrance) {
    lines.push(`The ${indoor.building.label} is here — enter from the map or below.`);
  }
  return lines;
}
