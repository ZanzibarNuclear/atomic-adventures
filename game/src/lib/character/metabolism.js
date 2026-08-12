/**
 * Hunger and thirst metabolism.
 *
 * Food: three Tastee Tack meals/day (~55 satiety each) maintain weight under a
 * normal day (8h sleep + 16h light activity). Sleep is the lightest food drain.
 *
 * Water: five 250 mL glasses/day (1.25 L) keep hydration steady under normal
 * activity. Sleep loses water at the same rate as light activity (breathing /
 * overnight fluid loss). Thirst returns more often than hunger.
 *
 * Reservoir meters are 0–100. Reaching 0 satiety or hydration ends the game
 * (see GameView catastrophic vitals).
 *
 * Composure is also a side effect of these needs (see syncComposureFromNeeds):
 * hungry/parched → Concerned, starving → Nervous, dehydrated → Scared.
 * Clearing the need restores composure toward the baseline.
 */

/** Starting / recovered composure when needs are fine (Calm band is ≥ 60). */
export const COMPOSURE_BASELINE = 80;

/**
 * Composure forced by survival needs (matches composure displayStates bands).
 * Worst active need wins (lowest value).
 */
export const COMPOSURE_FROM_NEEDS = Object.freeze({
  /** Hungry (satiety &lt; 40) or Parched (hydration &lt; 10). */
  concerned: 40,
  /** Starving (satiety &lt; 10). */
  nervous: 20,
  /** Dehydrated (hydration at minimum / 0). */
  scared: 5,
});

/** Align with satiety display: Peckish/Hungry when below Full. */
export const SATIETY_HUNGRY_BELOW = 40;
export const SATIETY_STARVING_BELOW = 10;
/** Align with hydration display: Parched band. */
export const HYDRATION_PARCHED_BELOW = 10;

export const MEALS_PER_DAY = 3;
/** Satiety restored by one full Tastee Tack meal (authored eat effect). */
export const SATIETY_PER_STANDARD_MEAL = 55;
export const DAILY_SATIETY_BUDGET = MEALS_PER_DAY * SATIETY_PER_STANDARD_MEAL; // 165

export const WAKING_HOURS = 16;
export const SLEEPING_HOURS = 8;

/**
 * Multipliers on the light-activity satiety drain unit.
 * Resting/sleep is the baseline lightest burn without being inactive death.
 */
export const SATIETY_ACTIVITY_MULTIPLIER = Object.freeze({
  resting: 0.45,
  light: 1,
  moderate: 1.45,
  strenuous: 2,
});

const SATIETY_DAY_WEIGHT =
  SLEEPING_HOURS * SATIETY_ACTIVITY_MULTIPLIER.resting +
  WAKING_HOURS * SATIETY_ACTIVITY_MULTIPLIER.light;

/** Satiety points lost per game hour at light activity. */
export const SATIETY_DRAIN_PER_HOUR_LIGHT = DAILY_SATIETY_BUDGET / SATIETY_DAY_WEIGHT;

/**
 * Drinking water: five glasses (vessel drinking-glass = 250 mL) per day.
 * ~1.25 L pure fluid — a practical play target; food moisture is not modeled.
 */
export const GLASS_ML = 250;
export const DRINKS_PER_DAY = 5;
export const DAILY_WATER_ML = GLASS_ML * DRINKS_PER_DAY; // 1250
export const HYDRATION_MAX_POINTS = 100;
/** Points restored per mL of water drunk. Full glass = 20 points. */
export const HYDRATION_POINTS_PER_ML = HYDRATION_MAX_POINTS / DAILY_WATER_ML;
export const HYDRATION_PER_GLASS = GLASS_ML * HYDRATION_POINTS_PER_ML; // 20

/**
 * Hydration drain multipliers. Resting matches light — overnight still loses
 * fluid; thirst cycles more often than hunger.
 */
export const HYDRATION_ACTIVITY_MULTIPLIER = Object.freeze({
  resting: 1,
  light: 1,
  moderate: 1.45,
  strenuous: 2.1,
});

/** Hydration points lost per game hour at light (and resting) activity. */
export const HYDRATION_DRAIN_PER_HOUR_LIGHT = HYDRATION_MAX_POINTS / 24;

export function satietyDrainPerHour(activity = "light") {
  const mult = SATIETY_ACTIVITY_MULTIPLIER[activity] ?? SATIETY_ACTIVITY_MULTIPLIER.light;
  return SATIETY_DRAIN_PER_HOUR_LIGHT * mult;
}

export function hydrationDrainPerHour(activity = "light") {
  const mult = HYDRATION_ACTIVITY_MULTIPLIER[activity] ?? HYDRATION_ACTIVITY_MULTIPLIER.light;
  return HYDRATION_DRAIN_PER_HOUR_LIGHT * mult;
}

/** Authored drift block: negative per-game-hour rates for each activity. */
export function metabolismDriftRates() {
  return {
    satiety: {
      resting: roundRate(-satietyDrainPerHour("resting")),
      light: roundRate(-satietyDrainPerHour("light")),
      moderate: roundRate(-satietyDrainPerHour("moderate")),
      strenuous: roundRate(-satietyDrainPerHour("strenuous")),
    },
    hydration: {
      resting: roundRate(-hydrationDrainPerHour("resting")),
      light: roundRate(-hydrationDrainPerHour("light")),
      moderate: roundRate(-hydrationDrainPerHour("moderate")),
      strenuous: roundRate(-hydrationDrainPerHour("strenuous")),
    },
  };
}

/** Hydration meter points for a volume of water. */
export function hydrationPointsForMl(ml) {
  return Math.max(0, Number(ml) || 0) * HYDRATION_POINTS_PER_ML;
}

/**
 * Hours of light activity from Full (~55) into Hungry (~10) — design target ~4h.
 * (Documented for balance checks; not used at runtime.)
 */
export function hoursLightFromFullToHungry() {
  const drop = 55 - 10;
  return drop / SATIETY_DRAIN_PER_HOUR_LIGHT;
}

function roundRate(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Worst survival need → forced composure target, or null when needs are fine.
 * Dehydrated beats starving beats hungry/parched.
 */
export function needsComposureTarget(character) {
  const satiety = readMeter(character, "satiety");
  const hydration = readMeter(character, "hydration");
  if (!satiety && !hydration) return null;

  const sat = satiety?.current;
  const hyd = hydration?.current;
  const hydMin = hydration?.min ?? 0;

  if (hydration && hyd <= hydMin + 1e-9) return COMPOSURE_FROM_NEEDS.scared;
  if (satiety && sat < SATIETY_STARVING_BELOW) return COMPOSURE_FROM_NEEDS.nervous;
  if (
    (satiety && sat < SATIETY_HUNGRY_BELOW)
    || (hydration && hyd < HYDRATION_PARCHED_BELOW)
  ) {
    return COMPOSURE_FROM_NEEDS.concerned;
  }
  return null;
}

/**
 * Apply composure as a side effect of satiety/hydration.
 * - Active need: set composure to the condition level (Concerned / Nervous / Scared).
 * - Needs just cleared: restore to COMPOSURE_BASELINE (side-effect recovery).
 * - Needs already fine: leave composure alone (nap/meditate gains stick).
 */
export function syncComposureFromNeeds(character) {
  if (!character?.stats) return null;
  const meter = readMeter(character, "composure");
  if (!meter) return null;

  const flags = (character.wellbeingFlags ??= {});
  const forced = needsComposureTarget(character);

  if (forced != null) {
    character.stats.composure = clamp(forced, meter.min, meter.max);
    flags.composureSuppressedByNeeds = true;
    return { composure: character.stats.composure, reason: "needs", target: forced };
  }

  const current = clamp(
    Number(character.stats.composure ?? meter.current),
    meter.min,
    meter.max,
  );

  if (flags.composureSuppressedByNeeds) {
    character.stats.composure = clamp(
      Math.max(current, COMPOSURE_BASELINE),
      meter.min,
      meter.max,
    );
    flags.composureSuppressedByNeeds = false;
    return { composure: character.stats.composure, reason: "recovered", target: COMPOSURE_BASELINE };
  }

  character.stats.composure = current;
  return { composure: current, reason: "unchanged", target: null };
}

function readMeter(character, statId) {
  const definition = (character?.definitions?.stats ?? []).find((stat) => stat.id === statId);
  if (!definition && character?.stats?.[statId] == null) return null;
  const min = finite(definition?.min, 0);
  const max = finite(definition?.max, 100);
  const current = clamp(
    finite(character?.stats?.[statId], definition?.default ?? min),
    min,
    max,
  );
  return { min, max, current, id: statId };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
