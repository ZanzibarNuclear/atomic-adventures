import { advanceGameTime } from "./gameTime.js";
import { syncComposureFromNeeds } from "./metabolism.js";

/**
 * Unit energy recovery for intentional Rest (points per game hour).
 * Nap, Sleep, and Meditate scale this via ENERGY_RECOVERY_MULTIPLIER.
 */
export const ENERGY_RECOVERY_UNIT_PER_HOUR = 20;

/** Multipliers on ENERGY_RECOVERY_UNIT_PER_HOUR. */
export const ENERGY_RECOVERY_MULTIPLIER = Object.freeze({
  rest: 1,
  nap: 2,
  sleep: 2,
  // Meditate restores energy at the nap rate.
  meditate: 2,
});

/**
 * Unit composure recovery: percent of meter max per game hour while napping.
 * Sleep and Meditate scale this via COMPOSURE_RECOVERY_MULTIPLIER.
 * (Dreams help more than dozing; meditation is twice as effective as sleep.)
 */
export const COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR = 10;

/** Multipliers on COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR. */
export const COMPOSURE_RECOVERY_MULTIPLIER = Object.freeze({
  nap: 1, // 10%/hr
  sleep: 3, // 30%/hr
  meditate: 6, // 2× sleep = 60%/hr
});

/**
 * Proactive wellbeing breaks from the character health card.
 *
 * - Rest: 15 min, energy 1× unit (always available; no energy change at 100%).
 * - Nap: 30 min, energy 2× unit + composure at nap rate.
 * - Sleep: until energy 80%, energy 2× unit + composure at sleep rate.
 * - Meditate: 10/20/30 min, composure 2× sleep + energy at nap rate.
 *
 * Time advances with activity "resting" (food/water drift, clock). Energy and
 * composure for these actions use the unit rates above, not authored drift.
 */
export const WELLBEING_ACTIONS = Object.freeze([
  {
    id: "rest",
    label: "Rest",
    hint: "A short 15-minute rest",
    activity: "resting",
    fixedMinutes: 15,
    wakeAtRatio: null,
    /** Primary gate for availability when maxed. */
    primaryStat: "energy",
    allowWhenPrimaryMaxed: true,
    restoresEnergy: true,
    restoresComposure: false,
    durationOptions: null,
    defaultMinutes: null,
  },
  {
    id: "nap",
    label: "Nap",
    hint: "A 30-minute nap — energy recovers twice as fast as resting",
    activity: "resting",
    fixedMinutes: 30,
    wakeAtRatio: null,
    primaryStat: "energy",
    allowWhenPrimaryMaxed: false,
    restoresEnergy: true,
    restoresComposure: true,
    durationOptions: null,
    defaultMinutes: null,
  },
  {
    id: "sleep",
    label: "Sleep",
    hint: "Sleep until energy is mostly restored (80%)",
    activity: "resting",
    fixedMinutes: null,
    wakeAtRatio: 0.8,
    primaryStat: "energy",
    allowWhenPrimaryMaxed: false,
    restoresEnergy: true,
    restoresComposure: true,
    maxMinutes: 16 * 60,
    durationOptions: null,
    defaultMinutes: null,
  },
  {
    id: "meditate",
    label: "Meditate",
    hint: "Calm the mind and steady composure; also restores energy",
    activity: "resting",
    fixedMinutes: null,
    wakeAtRatio: null,
    primaryStat: "composure",
    allowWhenPrimaryMaxed: false,
    restoresEnergy: true,
    restoresComposure: true,
    maxMinutes: 30,
    durationOptions: Object.freeze([10, 20, 30]),
    defaultMinutes: 10,
  },
]);

export function wellbeingActionById(actionId) {
  return WELLBEING_ACTIONS.find((entry) => entry.id === actionId) ?? null;
}

/** Effective energy points restored per game hour for an action id. */
export function energyRecoveryRatePerHour(actionId) {
  const multiplier = ENERGY_RECOVERY_MULTIPLIER[actionId];
  if (multiplier == null) return 0;
  return ENERGY_RECOVERY_UNIT_PER_HOUR * multiplier;
}

/**
 * Composure points per game hour for an action (percent of max applied to the
 * authored meter max, defaulting to 100).
 */
export function composureRecoveryRatePerHour(actionId, composureMax = 100) {
  const multiplier = COMPOSURE_RECOVERY_MULTIPLIER[actionId];
  if (multiplier == null) return 0;
  const percent = COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR * multiplier;
  const max = Number.isFinite(Number(composureMax)) ? Number(composureMax) : 100;
  return (percent / 100) * max;
}

export function listWellbeingActions(character) {
  return WELLBEING_ACTIONS.map((action) => {
    const minutes = action.defaultMinutes ?? action.fixedMinutes ?? undefined;
    const plan = planWellbeingAction(character, action.id, { minutes });
    return {
      ...action,
      available: plan.ok,
      reason: plan.ok ? null : plan.error,
      plannedMinutes: plan.ok ? plan.minutes : (action.fixedMinutes ?? action.defaultMinutes ?? 0),
      plannedGain: plan.ok ? plan.energyGain : 0,
      plannedComposureGain: plan.ok ? plan.composureGain : 0,
    };
  });
}

/**
 * @param {object} character
 * @param {string} actionId
 * @param {{ minutes?: number } } [options]
 */
export function planWellbeingAction(character, actionId, options = {}) {
  const action = wellbeingActionById(actionId);
  if (!action) return { ok: false, error: "That break is not available." };

  const energy = readMeter(character, "energy");
  const composure = readMeter(character, "composure");
  const energyRate = action.restoresEnergy ? energyRecoveryRatePerHour(action.id) : 0;
  const composureRate = action.restoresComposure
    ? composureRecoveryRatePerHour(action.id, composure.max)
    : 0;

  const energyAtMax = energy.current >= energy.max - 1e-9;
  const composureAtMax = composure.current >= composure.max - 1e-9;

  // Availability: primary stat rules (energy wake threshold for sleep).
  if (action.id === "sleep") {
    const wakeAt = clamp(energy.max * Number(action.wakeAtRatio), energy.min, energy.max);
    if (energy.current >= wakeAt - 1e-9) {
      return {
        ok: false,
        error: "You're rested enough already. Take a nap if you want to top off.",
      };
    }
  } else if (action.primaryStat === "energy" && energyAtMax && !action.allowWhenPrimaryMaxed) {
    return { ok: false, error: maxedMessage("energy") };
  } else if (action.primaryStat === "composure") {
    // Meditate helps energy and composure — available if either needs recovery.
    if (composureAtMax && energyAtMax) {
      return { ok: false, error: "You're already calm and well rested." };
    }
  }

  let minutes;
  let energyTarget = energy.max;

  if (action.wakeAtRatio != null) {
    energyTarget = clamp(energy.max * Number(action.wakeAtRatio), energy.min, energy.max);
    const need = energyTarget - energy.current;
    if (!(energyRate > 0)) {
      return { ok: false, error: "This rest would not restore anything right now." };
    }
    minutes = Math.min(
      action.maxMinutes ?? 16 * 60,
      Math.max(1, Math.ceil((need / energyRate) * 60 - 1e-9)),
    );
  } else if (action.fixedMinutes != null) {
    minutes = Math.max(1, Math.round(Number(action.fixedMinutes)));
  } else {
    minutes = resolveDurationMinutes(action, options.minutes);
    if (!(minutes > 0)) {
      return { ok: false, error: "Choose how long to take." };
    }
  }

  const hours = minutes / 60;
  let energyGain = 0;
  if (action.restoresEnergy && energyRate > 0 && !energyAtMax) {
    if (action.wakeAtRatio != null) {
      energyGain = Math.min(energyTarget - energy.current, energyRate * hours);
    } else {
      energyGain = Math.min(energy.max - energy.current, energyRate * hours);
    }
  }

  let composureGain = 0;
  if (action.restoresComposure && composureRate > 0 && !composureAtMax) {
    composureGain = Math.min(composure.max - composure.current, composureRate * hours);
  }

  // Rest at full energy: still ok with zero energy gain.
  if (action.id === "rest" && energyAtMax) {
    energyGain = 0;
  }

  return {
    ok: true,
    action,
    activity: action.activity,
    minutes,
    energyGain,
    composureGain,
    energyRate,
    composureRate,
    energyTarget,
    atEnergyMax: energyAtMax,
    atComposureMax: composureAtMax,
  };
}

/**
 * @param {object} gameState
 * @param {string} actionId
 * @param {{ minutes?: number } } [options]
 */
export function performWellbeingAction(gameState, actionId, options = {}) {
  const plan = planWellbeingAction(gameState?.character, actionId, options);
  if (!plan.ok) return plan;

  const beforeEnergy = readMeter(gameState.character, "energy");
  const beforeComposure = readMeter(gameState.character, "composure");
  const previousNeeds = {
    satiety: gameState.character.stats?.satiety,
    hydration: gameState.character.stats?.hydration,
  };

  const timeResult = advanceGameTime(gameState, plan.minutes, plan.activity);
  if (!timeResult.ok) return timeResult;

  // Intentional breaks set energy/composure from unit rates (ignore authored drift).
  if (plan.action.restoresEnergy) {
    let next = beforeEnergy.current + plan.energyGain;
    if (plan.action.wakeAtRatio != null) {
      next = Math.min(next, plan.energyTarget);
    }
    gameState.character.stats.energy = clamp(next, beforeEnergy.min, beforeEnergy.max);
  }

  if (plan.action.restoresComposure && plan.composureGain > 1e-9) {
    const next = beforeComposure.current + plan.composureGain;
    gameState.character.stats.composure = clamp(next, beforeComposure.min, beforeComposure.max);
  }

  // Apply need transitions from the break (e.g. satiety drift while napping).
  // Does not permanently clamp composure — meditation gains can remain.
  syncComposureFromNeeds(gameState.character, { previous: previousNeeds });

  const finalEnergy = readMeter(gameState.character, "energy");
  const finalComposure = readMeter(gameState.character, "composure");
  const energyTopped = finalEnergy.current >= finalEnergy.max - 1e-6;
  const composureTopped = finalComposure.current >= finalComposure.max - 1e-6;
  const wokeAtThreshold = plan.action.wakeAtRatio != null
    && finalEnergy.current >= plan.energyTarget - 0.5;

  return {
    ok: true,
    actionId: plan.action.id,
    minutes: plan.minutes,
    energyGain: Math.max(0, finalEnergy.current - beforeEnergy.current),
    composureGain: Math.max(0, finalComposure.current - beforeComposure.current),
    notice: completionNotice(plan.action, plan.minutes, {
      energyTopped,
      composureTopped,
      wokeAtThreshold,
      atEnergyMax: plan.atEnergyMax,
      energyGain: plan.energyGain,
      composureGain: plan.composureGain,
    }),
  };
}

function resolveDurationMinutes(action, requested) {
  const options = action.durationOptions ?? [];
  if (!options.length) {
    return Math.min(
      action.maxMinutes ?? 180,
      Math.max(1, Math.round(Number(requested) || action.defaultMinutes || 1)),
    );
  }
  const value = Number(requested);
  if (options.includes(value)) return value;
  if (options.includes(action.defaultMinutes)) return action.defaultMinutes;
  return options[0];
}

function readMeter(character, statId) {
  const definition = (character?.definitions?.stats ?? []).find((stat) => stat.id === statId);
  const min = finite(definition?.min, 0);
  const max = finite(definition?.max, 100);
  const current = clamp(
    finite(character?.stats?.[statId], definition?.default ?? min),
    min,
    max,
  );
  return { min, max, current };
}

function maxedMessage(statId) {
  if (statId === "energy") return "You're already well rested.";
  if (statId === "composure") return "You're already calm enough.";
  return "That won't help right now.";
}

function completionNotice(action, minutes, {
  energyTopped,
  composureTopped,
  wokeAtThreshold,
  atEnergyMax,
  energyGain,
  composureGain,
}) {
  const duration = formatMinutes(minutes);
  if (action.id === "meditate") {
    const parts = [`You meditate for ${duration}`];
    if (composureGain > 1e-9 && energyGain > 1e-9) {
      return composureTopped && energyTopped
        ? `${parts[0]} and feel calm and restored.`
        : `${parts[0]}. Composure and energy improve.`;
    }
    if (composureGain > 1e-9) {
      return composureTopped
        ? `${parts[0]} and feel calm again.`
        : `${parts[0]}. Composure improves.`;
    }
    if (energyGain > 1e-9) {
      return energyTopped
        ? `${parts[0]} and feel fully restored.`
        : `${parts[0]}. Energy improves.`;
    }
    return `${parts[0]}.`;
  }
  if (action.id === "nap") {
    if (composureGain > 1e-9) {
      return energyTopped
        ? `You nap for ${duration} and wake restored in body and mind.`
        : `You nap for ${duration}. Energy and composure improve.`;
    }
    return energyTopped
      ? `You nap for ${duration} and wake fully restored.`
      : `You nap for ${duration}. Energy improves.`;
  }
  if (action.id === "sleep") {
    if (composureGain > 1e-9) {
      return wokeAtThreshold
        ? `You sleep for ${duration} and wake clearer and mostly restored.`
        : `You sleep for ${duration}. Energy and composure improve.`;
    }
    return wokeAtThreshold
      ? `You sleep for ${duration} and wake mostly restored.`
      : `You sleep for ${duration}. Energy improves.`;
  }
  if (action.id === "rest") {
    if (atEnergyMax) return `You rest for ${duration}.`;
    return energyTopped
      ? `You rest for ${duration} and feel fully restored.`
      : `You rest for ${duration}. Energy improves.`;
  }
  return `You take a break for ${duration}.`;
}

function formatMinutes(minutes) {
  const whole = Math.max(1, Math.round(Number(minutes) || 0));
  if (whole < 60) return `${whole} minute${whole === 1 ? "" : "s"}`;
  const hours = Math.floor(whole / 60);
  const rem = whole % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}m`;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
