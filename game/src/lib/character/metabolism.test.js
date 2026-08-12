import { describe, expect, it } from "vitest";
import {
  COMPOSURE_BASELINE,
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
    expect(hydrationPointsForMl(500)).toBeCloseTo(40, 5); // full 500 mL bottle

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

  it("maps hungry/parched/starving/dehydrated to composure bands", () => {
    expect(needsComposureTarget(charStats({ satiety: 30, hydration: 50 }))).toBe(
      COMPOSURE_FROM_NEEDS.concerned,
    );
    expect(needsComposureTarget(charStats({ satiety: 50, hydration: 8 }))).toBe(
      COMPOSURE_FROM_NEEDS.concerned,
    );
    expect(needsComposureTarget(charStats({ satiety: 5, hydration: 50 }))).toBe(
      COMPOSURE_FROM_NEEDS.nervous,
    );
    expect(needsComposureTarget(charStats({ satiety: 50, hydration: 0 }))).toBe(
      COMPOSURE_FROM_NEEDS.scared,
    );
    expect(needsComposureTarget(charStats({ satiety: 5, hydration: 0 }))).toBe(
      COMPOSURE_FROM_NEEDS.scared,
    );
    expect(needsComposureTarget(charStats({ satiety: 60, hydration: 60 }))).toBeNull();
  });

  it("forces composure down for needs and restores baseline when fed and watered", () => {
    const character = charStats({ satiety: 20, hydration: 50, composure: 80 });
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(COMPOSURE_FROM_NEEDS.concerned);

    character.stats.satiety = 5;
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(COMPOSURE_FROM_NEEDS.nervous);

    character.stats.satiety = 70;
    character.stats.hydration = 70;
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(COMPOSURE_BASELINE);
  });

  it("does not overwrite composure when needs stay fine", () => {
    const character = charStats({ satiety: 70, hydration: 70, composure: 50 });
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(50);
    character.stats.composure = 90;
    syncComposureFromNeeds(character);
    expect(character.stats.composure).toBe(90);
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
