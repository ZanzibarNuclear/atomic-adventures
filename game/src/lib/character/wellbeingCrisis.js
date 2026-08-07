/**
 * Pre-empty wellbeing crisis alerts (information-only).
 * @see docs/contracts/character-wellbeing.md
 *
 * When a fatal-adjacent reserve hits the display band just above empty,
 * surface a clear one-shot modal so the player can act before collapse.
 * Energy and composure are excluded: exhaustion forces rest; panic will
 * get its own action distortions later.
 */

/** Reserves that warrant a pre-empty crisis modal (not energy/composure). */
export const PRE_EMPTY_ALERT_VITAL_IDS = Object.freeze([
  "hydration",
  "satiety",
  "health",
]);

/**
 * @param {{ displayStates?: { at: number, state: string, tone?: string }[] }} vital
 * @returns {{ at: number, state: string, tone?: string } | null}
 */
export function penultimateDisplayState(vital) {
  const states = [...(vital?.displayStates ?? [])]
    .filter((entry) => Number.isFinite(Number(entry.at)) && String(entry.state ?? "").trim())
    .sort((a, b) => Number(b.at) - Number(a.at));
  if (states.length < 2) return null;
  return states[states.length - 2];
}

/**
 * True when the vital is in the last band above empty (e.g. Parched, Hungry, Critical).
 * Empty itself is not a "pre-empty" crisis — failure handling covers collapse.
 */
export function isPreEmptyCrisisVital(
  vital,
  { alertIds = PRE_EMPTY_ALERT_VITAL_IDS } = {},
) {
  if (!vital?.id || !alertIds.includes(vital.id)) return false;
  const value = Number(vital.value);
  const min = Number(vital.min ?? 0);
  if (!Number.isFinite(value) || value <= min) return false;
  const pre = penultimateDisplayState(vital);
  if (!pre) return false;
  return String(vital.state ?? "").toLowerCase() === String(pre.state).toLowerCase();
}

/** Player-facing copy for a pre-empty crisis vital. */
export function preEmptyCrisisMessage(vital) {
  switch (vital?.id) {
    case "hydration":
      return "Zanzibar needs a beverage now.";
    case "satiety":
      return "Eat something before it's too late.";
    case "health":
      return "Zanzibar is in critical condition. Rest, treat injuries, and tend to food and water.";
    default: {
      const state = String(vital?.state ?? "in trouble").toLowerCase();
      const label = String(vital?.label ?? "condition").toLowerCase();
      return `Zanzibar's ${label} is ${state}. Take care before things get worse.`;
    }
  }
}

export function preEmptyCrisisTitle(vital) {
  switch (vital?.id) {
    case "hydration":
      return "Getting dehydrated";
    case "satiety":
      return "Running on empty";
    case "health":
      return "Critical condition";
    default:
      return "Wellbeing warning";
  }
}

/**
 * Collect crisis vitals from a wellbeing overview, priority order.
 * @param {{ health?: object, vitals?: object[] } | null} overview
 */
export function listPreEmptyCrisisVitals(overview, options) {
  if (!overview) return [];
  const candidates = [
    overview.health,
    ...(overview.vitals ?? []),
  ].filter(Boolean);
  return candidates.filter((vital) => isPreEmptyCrisisVital(vital, options));
}

/**
 * Whether the vital has recovered enough that a future re-entry should alert again.
 * True only when above the pre-empty band (e.g. Thirsty or better). Still empty
 * or still Parched/Hungry/Critical keeps the alert acknowledged.
 */
export function hasRecoveredFromPreEmpty(vital) {
  if (!vital) return true;
  const value = Number(vital.value);
  const min = Number(vital.min ?? 0);
  if (!Number.isFinite(value) || value <= min) return false;
  // Still in the penultimate band → not recovered for re-alert purposes.
  if (isPreEmptyCrisisVital(vital, { alertIds: [vital.id] })) return false;
  return true;
}
