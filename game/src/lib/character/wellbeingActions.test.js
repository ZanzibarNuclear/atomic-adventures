import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import {
  COMPOSURE_RECOVERY_MULTIPLIER,
  COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR,
  ENERGY_RECOVERY_MULTIPLIER,
  ENERGY_RECOVERY_UNIT_PER_HOUR,
  composureRecoveryRatePerHour,
  energyRecoveryRatePerHour,
  listWellbeingActions,
  performWellbeingAction,
  planWellbeingAction,
} from "./wellbeingActions.js";

function state(statValues = {}) {
  const character = createCharacterState({
    items: [],
    stats: [
      {
        id: "energy",
        type: "meter",
        min: 0,
        max: 100,
        default: 50,
        drift: { perGameHour: { resting: 5, light: -2 } },
      },
      {
        id: "composure",
        type: "meter",
        min: 0,
        max: 100,
        default: 80,
      },
      {
        id: "satiety",
        type: "meter",
        min: 0,
        max: 100,
        default: 70,
        drift: { perGameHour: { resting: -1 } },
      },
      {
        id: "hydration",
        type: "meter",
        min: 0,
        max: 100,
        default: 70,
        drift: { perGameHour: { resting: -1 } },
      },
    ],
    knowledge: [],
    skills: [],
    quests: [],
    documents: [],
  });
  Object.assign(character.stats, statValues);
  return { character, flags: new Set(), clock: createGameClock() };
}

describe("wellbeing actions", () => {
  it("exposes energy unit rates with nap/sleep/meditate at 2× rest", () => {
    expect(energyRecoveryRatePerHour("rest")).toBe(ENERGY_RECOVERY_UNIT_PER_HOUR);
    expect(energyRecoveryRatePerHour("nap")).toBe(ENERGY_RECOVERY_UNIT_PER_HOUR * 2);
    expect(energyRecoveryRatePerHour("sleep")).toBe(ENERGY_RECOVERY_UNIT_PER_HOUR * 2);
    expect(energyRecoveryRatePerHour("meditate")).toBe(ENERGY_RECOVERY_UNIT_PER_HOUR * 2);
    expect(ENERGY_RECOVERY_MULTIPLIER.rest).toBe(1);
  });

  it("exposes composure rates: nap unit, sleep 3×, meditate 2× sleep", () => {
    expect(COMPOSURE_RECOVERY_UNIT_PERCENT_PER_HOUR).toBe(10);
    expect(COMPOSURE_RECOVERY_MULTIPLIER.nap).toBe(1);
    expect(COMPOSURE_RECOVERY_MULTIPLIER.sleep).toBe(3);
    expect(COMPOSURE_RECOVERY_MULTIPLIER.meditate).toBe(6);
    expect(composureRecoveryRatePerHour("nap", 100)).toBe(10);
    expect(composureRecoveryRatePerHour("sleep", 100)).toBe(30);
    expect(composureRecoveryRatePerHour("meditate", 100)).toBe(60);
  });

  it("lists rest, nap, sleep, and meditate", () => {
    const actions = listWellbeingActions(state().character);
    expect(actions.map((entry) => entry.id)).toEqual(["rest", "nap", "sleep", "meditate"]);
  });

  it("allows rest even at full energy without changing energy", () => {
    const gameState = state({ energy: 100, composure: 70, satiety: 70, hydration: 70 });
    const result = performWellbeingAction(gameState, "rest");
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.energy).toBe(100);
    expect(gameState.character.stats.composure).toBe(70);
  });

  it("rests for 15 minutes at the unit energy rate without composure gain", () => {
    const gameState = state({ energy: 50, composure: 70, satiety: 70, hydration: 70 });
    const result = performWellbeingAction(gameState, "rest");
    expect(result.ok).toBe(true);
    // 15 min at 20/hr → +5 energy.
    expect(gameState.character.stats.energy).toBeCloseTo(55, 1);
    expect(gameState.character.stats.composure).toBe(70);
  });

  it("naps with 2× energy and unit composure recovery when needs are fine", () => {
    const gameState = state({ energy: 50, composure: 40, satiety: 70, hydration: 70 });
    const plan = planWellbeingAction(gameState.character, "nap");
    expect(plan.ok).toBe(true);
    expect(plan.minutes).toBe(30);
    // Energy: 30 min at 40/hr → +20. Composure: 30 min at 10%/hr of 100 → +5.
    expect(plan.energyGain).toBeCloseTo(20, 5);
    expect(plan.composureGain).toBeCloseTo(5, 5);

    const result = performWellbeingAction(gameState, "nap");
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.energy).toBeCloseTo(70, 1);
    expect(gameState.character.stats.composure).toBeCloseTo(45, 1);
    expect(result.notice).toMatch(/energy and composure/i);
  });

  it("sleeps at 2× energy and 3× composure until 80% energy when needs are fine", () => {
    const gameState = state({ energy: 20, composure: 20, satiety: 70, hydration: 70 });
    const plan = planWellbeingAction(gameState.character, "sleep");
    expect(plan.ok).toBe(true);
    // Need 60 energy at 40/hr → 90 minutes.
    expect(plan.minutes).toBe(90);
    // Composure: 1.5 hr at 30%/hr → +45.
    expect(plan.composureGain).toBeCloseTo(45, 5);

    const result = performWellbeingAction(gameState, "sleep");
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.energy).toBeCloseTo(80, 1);
    expect(gameState.character.stats.composure).toBeCloseTo(65, 1);
  });

  it("meditates with 2× sleep composure and nap-rate energy when needs are fine", () => {
    const gameState = state({ energy: 50, composure: 40, satiety: 70, hydration: 70 });
    // 10 min: energy +40/hr → +6.67; composure +60/hr → +10.
    const plan = planWellbeingAction(gameState.character, "meditate", { minutes: 10 });
    expect(plan.ok).toBe(true);
    expect(plan.energyGain).toBeCloseTo(40 * (10 / 60), 5);
    expect(plan.composureGain).toBeCloseTo(60 * (10 / 60), 5);

    const result = performWellbeingAction(gameState, "meditate", { minutes: 10 });
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.energy).toBeCloseTo(50 + 40 / 6, 1);
    expect(gameState.character.stats.composure).toBeCloseTo(50, 1);
    expect(result.notice).toMatch(/composure and energy/i);
  });

  it("allows meditation when composure is full but energy is not", () => {
    const gameState = state({
      energy: 50,
      composure: 100,
      satiety: 70,
      hydration: 70,
    });
    const result = performWellbeingAction(gameState, "meditate", { minutes: 10 });
    expect(result.ok).toBe(true);
    expect(gameState.character.stats.composure).toBe(100);
    expect(gameState.character.stats.energy).toBeGreaterThan(50);
  });

  it("softly refuses nap when energy is already maxed", () => {
    const gameState = state({ energy: 100 });
    const result = performWellbeingAction(gameState, "nap");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/well rested/i);
  });

  it("softly refuses sleep when already at or above 80% energy", () => {
    const gameState = state({ energy: 80 });
    const result = performWellbeingAction(gameState, "sleep");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nap/i);
  });
});
