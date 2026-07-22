import {
  normalizeStandEntries,
  resolveStandPoint,
} from "./composables/useAvatarStand.js";
import { hasAllFlags, hasAnyFlag, hasFlag } from "./composables/useFlags.js";

const POINT_EPSILON = 1.5;

/**
 * Location view conditions (`when`) — same model indoors and outdoors.
 *
 * Authored shape (all fields optional; omit or empty = always show):
 * ```yaml
 * when:
 *   all: [flag.a, flag.b]     # every flag must be set
 *   any: [flag.c]             # at least one must be set (if non-empty)
 *   not: [flag.d]             # none of these may be set
 *   stationPower: online|offline   # station hydro / hub power
 *   roomLights: on|off        # effective room lights (power + closed switch)
 *   passage: compound-gate    # outdoor passage id
 *   open: true|false          # required open state when passage is set
 * ```
 *
 * Legacy shape still accepted: `{ passage, open }` only.
 */

export function publicAssetPath(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

export function normalizeViewWhen(input) {
  if (!input || typeof input !== "object") return null;
  const all = stringList(input.all ?? input.flags?.all);
  const any = stringList(input.any ?? input.flags?.any);
  const not = stringList(input.not ?? input.flags?.not);
  const stationPower = normalizeStationPower(input.stationPower ?? input.facility?.online ?? input.facility?.["hydro.online"]);
  const roomLights = normalizeRoomLights(input.roomLights ?? input.lights);
  const passage = text(input.passage?.id ?? input.passage);
  const openRaw = input.passage && typeof input.passage === "object" && "open" in input.passage
    ? input.passage.open
    : input.open;
  const open = typeof openRaw === "boolean" ? openRaw : null;
  if (!all.length && !any.length && !not.length && !stationPower && !roomLights && !passage) return null;
  return {
    ...(all.length ? { all } : {}),
    ...(any.length ? { any } : {}),
    ...(not.length ? { not } : {}),
    ...(stationPower ? { stationPower } : {}),
    ...(roomLights ? { roomLights } : {}),
    ...(passage ? { passage, open: open === null ? true : open } : {}),
  };
}

export function viewWhenIsEmpty(when) {
  const normalized = normalizeViewWhen(when);
  return !normalized;
}

export function describeViewWhen(when) {
  const normalized = normalizeViewWhen(when);
  if (!normalized) return "Always";
  const parts = [];
  if (normalized.stationPower === "online") parts.push("station power on");
  if (normalized.stationPower === "offline") parts.push("station power off");
  if (normalized.roomLights === "on") parts.push("room lights on");
  if (normalized.roomLights === "off") parts.push("room lights off");
  if (normalized.all?.length) parts.push(`flags all: ${normalized.all.join(", ")}`);
  if (normalized.any?.length) parts.push(`flags any: ${normalized.any.join(", ")}`);
  if (normalized.not?.length) parts.push(`flags not: ${normalized.not.join(", ")}`);
  if (normalized.passage) {
    parts.push(`passage ${normalized.passage} ${normalized.open ? "open" : "closed"}`);
  }
  return parts.join(" · ") || "Always";
}

export function evaluateViewWhen(when, context = {}) {
  const normalized = normalizeViewWhen(when);
  if (!normalized) return true;
  const flags = context.flags ?? new Set();
  const passageStates = context.passageStates ?? {};
  const stationPowerOnline = Boolean(context.stationPowerOnline);
  const roomLightsOn = Boolean(context.roomLightsOn);

  if (normalized.all?.length && !hasAllFlags(flags, normalized.all)) return false;
  if (normalized.any?.length && !hasAnyFlag(flags, normalized.any)) return false;
  if (normalized.not?.some((id) => hasFlag(flags, id))) return false;

  if (normalized.stationPower === "online" && !stationPowerOnline) return false;
  if (normalized.stationPower === "offline" && stationPowerOnline) return false;

  if (normalized.roomLights === "on" && !roomLightsOn) return false;
  if (normalized.roomLights === "off" && roomLightsOn) return false;

  if (normalized.passage) {
    const isOpen = Boolean(passageStates[normalized.passage]);
    if (isOpen !== Boolean(normalized.open)) return false;
  }
  return true;
}

export function imageLocationViews(views = [], context = {}) {
  return (Array.isArray(views) ? views : [])
    .filter((view) => view?.kind === "image" && view.src)
    .filter((view) => evaluateViewWhen(view.when, context))
    .map((view) => ({
      ...view,
      when: normalizeViewWhen(view.when),
      label: view.label || view.id || "Location view",
      alt: view.alt || view.label || view.id || "Location view",
    }));
}

export function resolveLocationMediaContext(source = {}) {
  const flags = source.flags ?? new Set();
  const stationPowerOnline = resolveStationPowerOnline(source);
  const roomLightsOn = typeof source.roomLightsOn === "boolean"
    ? source.roomLightsOn
    : resolveRoomLightsOn(source, stationPowerOnline);
  const passageStates = source.passageStates
    ?? source.passageMarkerStates
    ?? {};
  return { flags, stationPowerOnline, roomLightsOn, passageStates };
}

export function resolveIndoorLocationMedia(indoor, context = {}) {
  const roomId = indoor?.indoor?.currentRoom;
  if (!roomId) return null;
  const room = indoor.building?.roomById?.[roomId];
  if (!room) return null;
  const stationPowerOnline = context.stationPowerOnline ?? resolveStationPowerOnline(indoor);
  const mediaContext = resolveLocationMediaContext({
    flags: context.flags ?? indoor.flags,
    stationPowerOnline,
    roomLightsOn: context.roomLightsOn ?? resolveRoomLightsOn({
      ...indoor,
      facility: indoor.facility ?? indoor.indoor?.facility,
      currentRoom: roomId,
    }, stationPowerOnline),
    passageStates: context.passageStates ?? context.passageMarkerStates ?? {},
  });
  const standId = indoor.indoor.currentStand ?? null;
  const stand = standId
    ? (room.stands ?? []).find((candidate) => candidate.id === standId)
    : null;
  const standViews = imageLocationViews(stand?.views, mediaContext);
  if (standViews.length) {
    return {
      key: `indoors:${roomId}:stand:${standId}`,
      scope: "stand",
      locationId: standId,
      views: standViews,
    };
  }
  const roomViews = imageLocationViews(room.views, mediaContext);
  if (!roomViews.length) return null;
  return {
    key: `indoors:${roomId}`,
    scope: "room",
    locationId: roomId,
    views: roomViews,
  };
}

export function resolveOutdoorLocationMedia(outdoor, context = {}) {
  const hex = outdoor?.currentHexData;
  if (!hex) return null;
  const mediaContext = resolveLocationMediaContext({
    flags: context.flags ?? outdoor.flags,
    stationPowerOnline: context.stationPowerOnline ?? resolveStationPowerOnline(outdoor),
    passageStates: context.passageStates
      ?? context.passageMarkerStates
      ?? outdoor?.passageMarkerStates
      ?? outdoor?.state?.passageStates
      ?? {},
  });
  const stand = currentOutdoorStand(hex, outdoor.state?.stand, Number(outdoor.size ?? 0));
  const standViews = imageLocationViews(stand?.views, mediaContext);
  if (standViews.length) {
    return {
      key: `outdoors:${hex.id}:stand:${stand.id}`,
      scope: "stand",
      locationId: stand.id,
      views: standViews,
    };
  }
  const hexViews = imageLocationViews(hex.views, mediaContext);
  if (!hexViews.length) return null;
  return {
    key: `outdoors:${hex.id}`,
    scope: "hex",
    locationId: hex.id,
    views: hexViews,
  };
}

export function currentOutdoorStand(hex, point, size) {
  if (!hex || !point || !Number.isFinite(size)) return null;
  return normalizeStandEntries(hex).find((stand) => {
    const resolved = resolveStandPoint(hex, stand.at, size);
    if (!resolved) return false;
    return Math.hypot(
      Math.round(resolved.x) - Math.round(point.x),
      Math.round(resolved.y) - Math.round(point.y),
    ) <= POINT_EPSILON;
  }) ?? null;
}

function resolveStationPowerOnline(source = {}) {
  if (typeof source.stationPowerOnline === "boolean") return source.stationPowerOnline;
  const powerOn = source.powerOn;
  if (typeof powerOn === "boolean") return powerOn;
  if (powerOn && typeof powerOn === "object" && "value" in powerOn) return Boolean(powerOn.value);
  if (source.facility?.hydroOnline) return true;
  const flags = source.flags;
  if (flags && (hasFlag(flags, "hub.hydro_online") || hasFlag(flags, "hydro.level-1-complete"))) {
    return true;
  }
  return false;
}

function normalizeStationPower(value) {
  if (value === true || value === "online" || value === "on") return "online";
  if (value === false || value === "offline" || value === "off") return "offline";
  return null;
}

function normalizeRoomLights(value) {
  if (value === true || value === "on" || value === "lit") return "on";
  if (value === false || value === "off" || value === "dark") return "off";
  return null;
}

function resolveRoomLightsOn(source = {}, stationPowerOnline = false) {
  if (!stationPowerOnline) return false;
  const roomId = source.currentRoom
    ?? source.indoor?.currentRoom
    ?? source.roomId
    ?? null;
  if (!roomId) return false;
  const facility = source.facility ?? source.indoor?.facility ?? null;
  return Boolean(facility?.lightSwitches?.[roomId]);
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean);
}

function text(value) {
  return String(value ?? "").trim();
}
