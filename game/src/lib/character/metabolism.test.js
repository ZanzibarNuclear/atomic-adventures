import { describe, expect, it } from "vitest";
import {
  COMPOSURE_BASELINE,
  COMPOSURE_CALM,
  COMPOSURE_FROM_NEEDS,
  DAILY_SATIETY_BUDGET,
  DAILY_WATER_ML,
  DRINKS_PER_DAY,
  GLASS_ML,
  HYDRATION_PER_GLASS,
  MEALS_PER_DAY,
  SATIETY_PER_STANDARD_MEAL,
  hoursLightFromFullToHungry,
  hydrationDrainPerHour,
  hydrationPointsForMl,
  metabolismDriftRates,
  needsComposureTarget,
  recoveryComposureTarget,
  satietyDrainPerHour,
  syncComposureFromNeeds,
} from "./metabolism.js";

describe("metabolism", () => {
  it("balances three Tastee Tack meals against a normal day of satiety drain", () => {
    expect(MEALS_PER_DAY * SATIETY_PER_STANDARD_MEAL).toBe(DAILY_SATIETY_BUDGET);
    const day =
      8 * satietyDrainPerHour("resting") +
      16 * satietyDrainPerHour("light");
    expect(day).toBeCloseTo(DAILY_SATIETY_BUDGET, 5);
  });

  it("drops from full toward hungry in about four hours of light activity", () => {
    expect(hoursLightFromFullToHungry()).toBeGreaterThan(3.5);
    expect(hoursLightFromFullToHungry()).toBeLessThan(6);
  });

  it("uses sleep as the lightest satiety burn and scales activity upward", () => {
    expect(satietyDrainPerHour("resting")).toBeLessThan(satietyDrainPerHour("light"));
    expect(satietyDrainPerHour("light")).toBeLessThan(satietyDrainPerHour("moderate"));
    expect(satietyDrainPerHour("moderate")).toBeLessThan(satietyDrainPerHour("strenuous"));
  });

  it("matches five glasses (1.25 L) of water to a day of hydration drain", () => {
    expect(GLASS_ML * DRINKS_PER_DAY).toBe(DAILY_WATER_ML);
    expect(HYDRATION_PER_GLASS).toBeCloseTo(20, 5);
    expect(hydrationPointsForMl(GLASS_ML)).toBeCloseTo(HYDRATION_PER_GLASS, 5);
    expect(hydrationPointsForMl(500)).toBeCloseTo(40, 5);

    const day =
      8 * hydrationDrainPerHour("resting") +
      16 * hydrationDrainPerHour("light");
    expect(day).toBeCloseTo(100, 5);
  });

  it("keeps sleep hydration loss equal to light activity", () => {
    expect(hydrationDrainPerHour("resting")).toBeCloseTo(hydrationDrainPerHour("light"), 5);
    expect(hydrationDrainPerHour("light")).toBeLessThan(hydrationDrainPerHour("moderate"));
  });

  it("exports negative authored drift rates for content", () => {
    const rates = metabolismDriftRates();
    expect(rates.satiety.light).toBeLessThan(0);
    expect(rates.hydration.light).toBeLessThan(0);
    expect(rates.hydration.resting).toBeCloseTo(rates.hydration.light, 5);
  });

  it("maps need bands to composure with worst impact winning", () => {
    // Hungry or Thirsty → Concerned
    expect(needsComposureTarget(30, 70)).toBe(COMPOSURE_FROM_NEEDS.concerned);
    expect(needsComposureTarget(70, 45)).toBe(COMPOSURE_FROM_NEEDS.concerned);
    // Starving or Parched → Nervous
    expect(needsComposureTarget(5, 70)).toBe(COMPOSURE_FROM_NEEDS.nervous);
    expect(needsComposureTarget(70, 15)).toBe(COMPOSURE_FROM_NEEDS.nervous);
    // Dehydrated beats starving
    expect(needsComposureTarget(5, 0)).toBe(COMPOSURE_FROM_NEEDS.panicked);
    expect(needsComposureTarget(70, 5)).toBe(COMPOSURE_FROM_NEEDS.panicked);
    // Fine
    expect(needsComposureTarget(70, 70)).toBeNull();
  });

  it("drops composure only when needs worsen, not as a permanent clamp", () => {
    const character = charStats({ satiety: 70, hydration: 70, composure: 80 });
    // Cross into hungry
    character.stats.satiety = 30;
    syncComposureFromNeeds(character, { previous: { satiety: 70, hydration: 70 } });
    expect(character.stats.composure).toBe(COMPOSURE_FROM_NEEDS.concerned);

    // Meditate while still hungry — composure may rise and stay up
    character.stats.composure = 55;
    syncComposureFromNeeds(character, { previous: { satiety: 30, hydration: 70 } });
    expect(character.stats.composure).toBe(55);

    // Worsen to starving — drop again
    character.stats.satiety = 5;
    syncComposureFromNeeds(character, { previous: { satiety: 30, hydration: 70 } });
    expect(character.stats.composure).toBe(COMPOSURE_FROM_NEEDS.nervous);
  });

  it("restores composure from eating and drinking based on resulting state", () => {
    const character = charStats({ satiety: 5, hydration: 70, composure: 10 });
    // Eat to stuffed while hydrated → Calm
    character.stats.satiety = 95;
    syncComposureFromNeeds(character, { previous: { satiety: 5, hydration: 70 } });
    expect(character.stats.composure).toBe(COMPOSURE_CALM);

    // Drop via thirst
    character.stats.hydration = 40;
    syncComposureFromNeeds(character, { previous: { satiety: 95, hydration: 70 } });
    expect(character.stats.composure).toBe(COMPOSURE_FROM_NEEDS.concerned);

    // Drink to hydrated while full → Normal
    character.stats.hydration = 70;
    character.stats.satiety = 60;
    syncComposureFromNeeds(character, { previous: { satiety: 95, hydration: 40 } });
    expect(character.stats.composure).toBe(COMPOSURE_BASELINE);
  });

  it("uses recovery targets for stuffed/full/peckish when hydrated", () => {
    expect(recoveryComposureTarget(95, 70)).toBe(COMPOSURE_CALM);
    expect(recoveryComposureTarget(60, 70)).toBe(COMPOSURE_BASELINE);
    expect(recoveryComposureTarget(45, 70)).toBe(COMPOSURE_BASELINE);
    expect(recoveryComposureTarget(20, 70)).toBe(COMPOSURE_FROM_NEEDS.concerned);
  });

  it("does not change composure when meters are unchanged and needs stay fine", () => {
    const character = charStats({ satiety: 70, hydration: 70, composure: 50 });
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(50);
    character.stats.composure = 95;
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(95);
  });
});

function charStats(stats) {
  return {
    definitions: {
      stats: [
        { id: "satiety", type: "meter", min: 0, max: 100, default: 50 },
        { id: "hydration", type: "meter", min: 0, max: 100, default: 50 },
        { id: "composure", type: "meter", min: 0, max: 100, default: COMPOSURE_BASELINE },
      ],
    },
    stats: {
      satiety: 50,
      hydration: 50,
      composure: COMPOSURE_BASELINE,
      ...stats,
    },
  };
}
