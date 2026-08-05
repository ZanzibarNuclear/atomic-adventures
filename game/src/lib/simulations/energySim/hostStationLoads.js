/**
 * Map host gameplay state → Clearwater Station load drawing flags.
 * Load ids must stay stable with fixtures/stations/clearwater-station.json.
 */

export const STATION_LOAD_IDS = Object.freeze({
  lighting: "lighting.main",
  holoReader: "holo-reader.library",
  evCharge: "ev-charge.port-1",
  kitchen: "kitchen.appliance",
});

/**
 * @param {{
 *   hydroOnline?: boolean,
 *   facility?: object|null,
 *   activeStageKind?: string|null,
 *   flags?: Iterable<string>|Set<string>|null,
 * }} context
 * @returns {Record<string, boolean>}
 */
export function deriveStationLoads(context = {}) {
  const facility = context.facility ?? null;
  const busOnline = Boolean(
    context.hydroOnline
      ?? facility?.hydroOnline
      ?? false,
  );
  const flags = toFlagSet(context.flags);

  return {
    [STATION_LOAD_IDS.lighting]: busOnline && anyLightsDrawing(facility),
    [STATION_LOAD_IDS.holoReader]:
      busOnline && isHoloDrawing(context.activeStageKind, flags),
    [STATION_LOAD_IDS.evCharge]:
      busOnline && isEvChargeDrawing(facility, flags),
    [STATION_LOAD_IDS.kitchen]:
      busOnline && isKitchenDrawing(facility, flags),
  };
}

function anyLightsDrawing(facility) {
  const switches = facility?.lightSwitches;
  if (!switches || typeof switches !== "object") return false;
  return Object.values(switches).some(Boolean);
}

function isHoloDrawing(activeStageKind, flags) {
  if (activeStageKind === "lesson") return true;
  return flags.has("hub.holo_reader_active") || flags.has("hub.holo-reader-active");
}

function isEvChargeDrawing(facility, flags) {
  if (facility?.evChargeDrawing === true) return true;
  if (facility?.loads?.["ev-charge.port-1"] === true) return true;
  return (
    flags.has("hub.ev_charging")
    || flags.has("hub.ev-charging")
    || flags.has("hub.buggy_charging")
    || flags.has("hub.buggy-charging")
  );
}

function isKitchenDrawing(facility, flags) {
  if (facility?.loads?.["kitchen.appliance"] === true) return true;
  if (flags.has("hub.kitchen_drawing") || flags.has("hub.kitchen-drawing")) {
    return true;
  }
  // Stove / electrical fixtures when present (future multi-level burners)
  const fixtures = facility?.fixtures;
  if (!fixtures || typeof fixtures !== "object") return false;
  for (const state of Object.values(fixtures)) {
    if (!state || typeof state !== "object") continue;
    if (Array.isArray(state.burners) && state.burners.some((level) => level && level !== "off")) {
      return true;
    }
    if (state.heat && state.heat !== "off") return true;
    if (state.power && state.power !== "off") return true;
  }
  return false;
}

function toFlagSet(flags) {
  if (!flags) return new Set();
  if (flags instanceof Set) return flags;
  if (Array.isArray(flags)) return new Set(flags);
  if (typeof flags[Symbol.iterator] === "function") return new Set(flags);
  return new Set();
}
