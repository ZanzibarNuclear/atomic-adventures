/**
 * Room lighting is authored on each room (`room.lighting`) and editable in the
 * World Builder. Runtime switch state lives on the facility snapshot.
 *
 * Electrical convention:
 * - switch **open**  → circuit open → lights off (default)
 * - switch **closed** → circuit closed → lights on only if station power is online
 *
 * Fallback: legacy `poweredObjects` entries with `kind: "lights"` still work
 * until content is fully migrated to `room.lighting`.
 */

export const LIGHT_STYLES = Object.freeze([
  { id: "recessed", label: "Recessed cans" },
  { id: "strip", label: "Strip lights" },
  { id: "can", label: "Can / downlight" },
  { id: "directional", label: "Directional lamps" },
  { id: "mixed", label: "Mixed LED fixtures" },
]);

export function normalizeRoomLighting(input) {
  if (!input || typeof input !== "object") return null;
  if (input.enabled === false) return null;
  const style = normalizeLightStyle(input.style);
  const label = text(input.label);
  const activeLine = text(input.activeLine);
  const switchNote = text(input.switchNote);
  const nearDoor = text(input.nearDoor);
  return {
    enabled: true,
    style,
    ...(label ? { label } : {}),
    ...(activeLine ? { activeLine } : {}),
    ...(switchNote ? { switchNote } : {}),
    ...(nearDoor ? { nearDoor } : {}),
  };
}

export function roomsWithLightFixtures(building) {
  const rooms = new Set();
  for (const room of building?.rooms ?? []) {
    if (lightFixtureForRoom(building, room.id)) rooms.add(room.id);
  }
  // Include rooms only present via legacy poweredObjects
  for (const object of building?.poweredObjects ?? []) {
    if (object?.kind === "lights" && object.room) rooms.add(object.room);
  }
  return rooms;
}

export function lightFixtureForRoom(building, roomId) {
  if (!roomId) return null;
  const room = building?.roomById?.[roomId]
    ?? (building?.rooms ?? []).find((candidate) => candidate.id === roomId)
    ?? null;
  const fromRoom = normalizeRoomLighting(room?.lighting);
  if (fromRoom) {
    return {
      id: `${roomId}-lights`,
      kind: "lights",
      room: roomId,
      label: fromRoom.label || defaultLightLabel(room),
      activeLine: fromRoom.activeLine || defaultActiveLine(room),
      style: fromRoom.style,
      switchNote: fromRoom.switchNote || null,
      nearDoor: fromRoom.nearDoor || null,
      source: "room",
    };
  }
  const legacy = (building?.poweredObjects ?? []).find(
    (object) => object.kind === "lights" && object.room === roomId,
  );
  if (!legacy) return null;
  return {
    ...legacy,
    style: normalizeLightStyle(legacy.style),
    source: "poweredObject",
  };
}

/** True when the wall switch is closed (player intends lights on). */
export function isRoomLightSwitchClosed(facility, roomId) {
  if (!roomId) return false;
  return Boolean(facility?.lightSwitches?.[roomId]);
}

/**
 * Lights actually illuminate only with station power and a closed switch.
 */
export function isRoomLightsOn(facility, roomId, stationPowerOnline) {
  return Boolean(stationPowerOnline) && isRoomLightSwitchClosed(facility, roomId);
}

export function setRoomLightSwitch(facility, roomId, closed) {
  if (!facility || !roomId) return;
  const next = { ...(facility.lightSwitches ?? {}) };
  if (closed) next[roomId] = true;
  else delete next[roomId];
  facility.lightSwitches = next;
}

export function toggleRoomLightSwitch(facility, roomId) {
  const closed = !isRoomLightSwitchClosed(facility, roomId);
  setRoomLightSwitch(facility, roomId, closed);
  return closed;
}

export function normalizeLightSwitches(value = {}) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [roomId, closed] of Object.entries(value)) {
    if (closed) next[roomId] = true;
  }
  return next;
}

/**
 * Play-panel action for the current room's wall switch.
 *
 * - Power out: one ambiguous action, "Flip the light switch" (does not reveal
 *   open/closed). Performing it toggles the switch and should show a dead-switch
 *   notice to the player.
 * - Power on, switch open: "Turn on the lights"
 * - Power on, switch closed (lights lit): "Turn off the lights"
 */
export function roomLightAction(building, facility, roomId, stationPowerOnline) {
  const fixture = lightFixtureForRoom(building, roomId);
  if (!fixture) return null;

  if (!stationPowerOnline) {
    return {
      id: `room-lights:flip:${roomId}`,
      label: "Flip the light switch",
    };
  }

  const closed = isRoomLightSwitchClosed(facility, roomId);
  if (closed) {
    return {
      id: `room-lights:off:${roomId}`,
      label: "Turn off the lights",
    };
  }
  return {
    id: `room-lights:on:${roomId}`,
    label: "Turn on the lights",
    hint: fixture.switchNote || undefined,
  };
}

/** Result notice when flipping a switch with the bus dead. */
export const DEAD_LIGHT_SWITCH_NOTICE =
  "You flip the switch, but nothing happens.";

function defaultLightLabel(room) {
  const name = room?.label || room?.id || "Room";
  return `${name} lights`;
}

function defaultActiveLine(room) {
  const name = (room?.label || room?.id || "room").toLowerCase();
  return `The ${name} lights are on.`;
}

function normalizeLightStyle(value) {
  const style = text(value).toLowerCase();
  if (["recessed", "cans", "can", "strip", "strips", "directional", "lamp", "lamps", "mixed"].includes(style)) {
    if (style === "cans" || style === "can") return "can";
    if (style === "strips") return "strip";
    if (style === "lamp" || style === "lamps") return "directional";
    return style === "can" ? "can" : style;
  }
  return "recessed";
}

function lightStylePhrase(style) {
  switch (normalizeLightStyle(style)) {
    case "recessed":
      return "recessed cans ";
    case "strip":
      return "strip lights ";
    case "can":
      return "can lights ";
    case "directional":
      return "directional lamps ";
    case "mixed":
      return "LED fixtures ";
    default:
      return "lights ";
  }
}

function text(value) {
  return String(value ?? "").trim();
}
