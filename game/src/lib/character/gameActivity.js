import { applyEffectsAtomically } from "./effects.js";
import { ACTIVITY_PROFILES, advanceGameTime } from "./gameTime.js";

export function commitGameActivity(gameState, {
  effects = [],
  timeMinutes = 0,
  activity = "light",
} = {}) {
  const minutes = Number(timeMinutes);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return { ok: false, error: "Activity time must be a non-negative number." };
  }
  if (!ACTIVITY_PROFILES.includes(activity)) {
    return { ok: false, error: `Unknown activity profile "${activity}".` };
  }
  const result = applyEffectsAtomically(effects, {
    character: gameState.character,
    flags: gameState.flags,
  });
  if (!result.ok) return result;
  return minutes > 0
    ? advanceGameTime(gameState, minutes, activity)
    : { ok: true };
}
