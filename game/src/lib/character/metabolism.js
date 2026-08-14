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
 * Composure side effects from needs (see syncComposureFromNeeds):
 * - Worst active need wins (not stacked).
 * - Entering a worse band can drop composure once; it is not a permanent clamp
 *   (meditation can raise composure even while still starving).
 * - Eating/drinking restores composure from the resulting satiety/hydration state.
 *
 * Display bands: Calm 90–100, Normal 60–89, Concerned 40–59,
 * Nervous 10–39, Panicked 0–9.
 */

/** Starting composure and restore target when Full/Peckish + Hydrated. */
export const COMPOSURE_BASELINE = 80;
/** Restore target when Stuffed + Hydrated. */
export const COMPOSURE_CALM = 90;

/**
 * Impact levels when a need band is active (lowest value = worst).
 * Aligns with composure displayStates.
 */
export const COMPOSURE_FROM_NEEDS = Object.freeze({
  /** Hungry or Thirsty → Concerned (40–59). */
  concerned: 40,
  /** Starving or Parched → Nervous (10–39). */
  nervous: 10,
  /** Dehydrated → Panicked (0–9). */
  panicked: 5,
});

/** Satiety bands (match displayStates). */
export const SATIETY_STUFFED_AT = 90;
export const SATIETY_FULL_AT = 55;
export const SATIETY_PECKISH_AT = 40;
export const SATIETY_HUNGRY_BELOW = 40;
export const SATIETY_STARVING_BELOW = 10;

/** Hydration bands (match displayStates). */
export const HYDRATION_HYDRATED_AT = 60;
export const HYDRATION_THIRSTY_BELOW = 60;
export const HYDRATION_PARCHED_BELOW = 30;
export const HYDRATION_DEHYDRATED_BELOW = 10;

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
 * Worst survival-need impact on composure, or null when none apply.
 * Only the most severe impact is used (not stacked).
 *
 * | Condition | Composure impact |
 * | Hungry (satiety 10–39) or Thirsty (hydration 30–59) | Concerned (40) |
 * | Starving (satiety &lt; 10) or Parched (hydration 10–29) | Nervous (10) |
 * | Dehydrated (hydration &lt; 10) | Panicked (5) |
 */
export function needsComposureTarget(characterOrSat, hydrationValue = null) {
  let sat;
  let hyd;
  if (hydrationValue != null || typeof characterOrSat === "number") {
    sat = Number(characterOrSat);
    hyd = Number(hydrationValue);
  } else {
    const character = characterOrSat;
    const satiety = readMeter(character, "satiety");
    const hydration = readMeter(character, "hydration");
    if (!satiety && !hydration) return null;
    sat = satiety?.current;
    hyd = hydration?.current;
  }
  if (!Number.isFinite(sat) && !Number.isFinite(hyd)) return null;

  let worst = null;
  const consider = (value) => {
    if (worst == null || value < worst) worst = value;
  };

  if (Number.isFinite(hyd)) {
    if (hyd < HYDRATION_DEHYDRATED_BELOW) consider(COMPOSURE_FROM_NEEDS.panicked);
    else if (hyd < HYDRATION_PARCHED_BELOW) consider(COMPOSURE_FROM_NEEDS.nervous);
    else if (hyd < HYDRATION_THIRSTY_BELOW) consider(COMPOSURE_FROM_NEEDS.concerned);
  }
  if (Number.isFinite(sat)) {
    if (sat < SATIETY_STARVING_BELOW) consider(COMPOSURE_FROM_NEEDS.nervous);
    else if (sat < SATIETY_HUNGRY_BELOW) consider(COMPOSURE_FROM_NEEDS.concerned);
  }
  return worst;
}

/**
 * Composure restore target after eating/drinking, from resulting needs state.
 * - Still under a need impact → that impact level (floor when recovering).
 * - Hydrated + Stuffed → Calm (90).
 * - Hydrated + Full or Peckish → Normal baseline (80).
 * Meditation can raise above these freely when not freshly dropped by needs.
 */
export function recoveryComposureTarget(satietyValue, hydrationValue) {
  const impact = needsComposureTarget(satietyValue, hydrationValue);
  if (impact != null) return impact;

  const sat = Number(satietyValue);
  const hyd = Number(hydrationValue);
  if (!(Number.isFinite(sat) && Number.isFinite(hyd))) return null;

  if (hyd >= HYDRATION_HYDRATED_AT && sat >= SATIETY_STUFFED_AT) return COMPOSURE_CALM;
  if (hyd >= HYDRATION_HYDRATED_AT && sat >= SATIETY_PECKISH_AT) return COMPOSURE_BASELINE;
  return null;
}

/**
 * Set composure from current satiety/hydration (new game, load, content sync).
 * Uses the worst need impact if any; otherwise the eat/drink recovery target
 * (Calm when stuffed+hydrated, Normal when full/peckish+hydrated); else baseline.
 */
export function initializeComposureFromNeeds(character) {
  if (!character?.stats) return null;
  const composure = readMeter(character, "composure");
  const satiety = readMeter(character, "satiety");
  const hydration = readMeter(character, "hydration");
  if (!composure) return null;

  const sat = satiety?.current;
  const hyd = hydration?.current;
  const impact = needsComposureTarget(sat, hyd);
  const restore = recoveryComposureTarget(sat, hyd);
  const target = impact ?? restore ?? COMPOSURE_BASELINE;
  character.stats.composure = clamp(target, composure.min, composure.max);
  return { composure: character.stats.composure, reason: "initialize", target };
}

/**
 * Apply composure side effects from satiety/hydration changes.
 *
 * @param {object} character
 * @param {{ previous?: { satiety?: number, hydration?: number }, initialize?: boolean }} [options]
 *   Pass prior meter values so we can detect worsening vs recovery.
 *   When `initialize` is true (or previous is omitted on a fresh character),
 *   composure is set from the current needs state.
 */
export function syncComposureFromNeeds(character, options = {}) {
  if (!character?.stats) return null;
  if (options.initialize) return initializeComposureFromNeeds(character);

  const composure = readMeter(character, "composure");
  const satiety = readMeter(character, "satiety");
  const hydration = readMeter(character, "hydration");
  if (!composure || (!satiety && !hydration)) return null;

  const sat = satiety?.current;
  const hyd = hydration?.current;
  const hasPrevious = options.previous
    && (options.previous.satiety !== undefined || options.previous.hydration !== undefined);
  const prevSat = hasPrevious ? Number(options.previous.satiety) : sat;
  const prevHyd = hasPrevious ? Number(options.previous.hydration) : hyd;

  const prevImpact = needsComposureTarget(prevSat, prevHyd);
  const nextImpact = needsComposureTarget(sat, hyd);
  const satImproved = Number.isFinite(sat) && Number.isFinite(prevSat) && sat > prevSat + 1e-9;
  const hydImproved = Number.isFinite(hyd) && Number.isFinite(prevHyd) && hyd > prevHyd + 1e-9;
  // Worse impact = lower composure value. Also treat first entry into any impact
  // from a no-impact previous state as a drop.
  const worsened = nextImpact != null
    && (prevImpact == null || nextImpact < prevImpact - 1e-9);

  let current = clamp(
    Number(character.stats.composure ?? composure.current),
    composure.min,
    composure.max,
  );

  // Entering a worse need band: drop composure if currently calmer.
  // Not a permanent clamp — meditation may raise composure afterward.
  if (worsened && current > nextImpact) {
    current = nextImpact;
    character.stats.composure = clamp(current, composure.min, composure.max);
    return { composure: character.stats.composure, reason: "worsened", target: nextImpact };
  }

  // Eating/drinking (or any satiety/hydration gain): restore toward the
  // recovery target for the resulting state.
  if (satImproved || hydImproved) {
    const restore = recoveryComposureTarget(sat, hyd);
    if (restore != null && current < restore) {
      current = restore;
      character.stats.composure = clamp(current, composure.min, composure.max);
      return { composure: character.stats.composure, reason: "restored", target: restore };
    }
  }

  character.stats.composure = current;
  return { composure: current, reason: "unchanged", target: nextImpact };
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
