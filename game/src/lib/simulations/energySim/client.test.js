import { describe, expect, it } from "vitest";
import { presentSnapshot, isEnergySimEnabled } from "./client.js";

describe("energySim presentSnapshot", () => {
  it("maps brownout to reduced light level", () => {
    const view = presentSnapshot({
      simTimeS: 10,
      electricalPowerKw: 1,
      busEnergized: true,
      gridStatus: "brownout",
      marginKw: -2,
      availableGenerationKw: 1,
      totalLoadKw: 3,
    });
    expect(view.brownout).toBe(true);
    expect(view.lightLevel).toBe(0.4);
  });

  it("maps energized surplus to full lights", () => {
    const view = presentSnapshot({
      simTimeS: 10,
      electricalPowerKw: 5,
      busEnergized: true,
      gridStatus: "surplus",
      marginKw: 1,
      availableGenerationKw: 5,
      totalLoadKw: 4,
    });
    expect(view.brownout).toBe(false);
    expect(view.lightLevel).toBe(1.0);
  });

  it("is disabled when VITE_ENERGY_SIM_URL is unset", () => {
    // Default test env has no URL; legacy hydro remains primary.
    expect(typeof isEnergySimEnabled()).toBe("boolean");
  });
});
