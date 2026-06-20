import { applyEffectsAtomically } from "./effects.js";

export const ACTIVITY_PROFILES = Object.freeze([
  "resting",
  "light",
  "moderate",
  "strenuous",
]);

export function createGameClock(value = {}) {
  return {
    elapsedMinutes: finite(value.elapsedMinutes, 0),
    minuteOfDay: finite(value.minuteOfDay, 8 * 60),
    day: Math.max(1, Math.floor(finite(value.day, 1))),
  };
}

export function advanceGameTime(gameState, minutes, activity = "light") {
  const duration = Number(minutes);
  if (!Number.isFinite(duration) || duration <= 0) return { ok: false, error: "Duration must be positive." };
  if (!ACTIVITY_PROFILES.includes(activity)) {
    return { ok: false, error: `Unknown activity profile "${activity}".` };
  }
  const character = gameState.character;
  let remaining = duration;
  while (remaining > 0) {
    const step = Math.min(1, remaining);
    const effects = driftEffects(character, step, activity);
    const result = applyEffectsAtomically(effects, {
      character,
      flags: gameState.flags,
    });
    if (!result.ok) return result;
    advanceClock(gameState.clock, step);
    remaining -= step;
  }
  return { ok: true, minutes: duration, activity };
}

export function formatGameClock(clock) {
  const hours = Math.floor(clock.minuteOfDay / 60) % 24;
  const minutes = Math.floor(clock.minuteOfDay % 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `Day ${clock.day} · ${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function driftEffects(character, minutes, activity) {
  const hours = minutes / 60;
  const effects = [];
  for (const stat of character.definitions?.stats ?? []) {
    const rate = Number(stat.drift?.perGameHour?.[activity]);
    if (!Number.isFinite(rate) || rate === 0) continue;
    effects.push({ op: "stat.add", id: stat.id, value: rate * hours });
    const current = Number(character.stats?.[stat.id] ?? stat.default ?? 0);
    const next = current + rate * hours;
    for (const threshold of [...(stat.thresholds ?? [])].sort((a, b) => a.at - b.at)) {
      if (next < Number(threshold.at)) continue;
      for (const effect of threshold.effectsPerGameHour ?? []) {
        effects.push(scaleHourlyEffect(effect, hours));
      }
    }
  }
  return effects;
}

function scaleHourlyEffect(effect, hours) {
  if (effect.op === "stat.add") {
    return { ...effect, value: Number(effect.value) * hours };
  }
  return effect;
}

function advanceClock(clock, minutes) {
  clock.elapsedMinutes += minutes;
  clock.minuteOfDay += minutes;
  while (clock.minuteOfDay >= 24 * 60) {
    clock.minuteOfDay -= 24 * 60;
    clock.day += 1;
  }
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
