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
 */

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
