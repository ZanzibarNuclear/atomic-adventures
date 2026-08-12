import { describe, expect, it } from "vitest";
import {
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
  satietyDrainPerHour,
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
});
