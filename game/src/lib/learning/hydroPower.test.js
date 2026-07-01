import { describe, expect, it } from "vitest";
import {
  electricalPowerWatts,
  formatPowerWatts,
  hydraulicPowerWatts,
  netHeadMeters,
} from "./hydroPower.js";

describe("hydro power calculations", () => {
  it("calculates hydraulic power from density, flow, and head", () => {
    expect(hydraulicPowerWatts({
      densityKgM3: 1000,
      gravityMs2: 9.8,
      flowM3s: 1,
      headM: 10,
    })).toBe(98_000);
  });

  it("calculates electrical power after efficiency and head loss", () => {
    expect(electricalPowerWatts({
      efficiency: 0.8,
      densityKgM3: 1000,
      gravityMs2: 9.8,
      flowM3s: 1,
      grossHeadM: 12,
      headLossM: 2,
    })).toBe(78_400);
  });

  it("does not allow net head to go below zero", () => {
    expect(netHeadMeters(5, 8)).toBe(0);
    expect(electricalPowerWatts({
      efficiency: 0.9,
      flowM3s: 4,
      grossHeadM: 5,
      headLossM: 8,
    })).toBe(0);
  });

  it("formats power for lesson examples", () => {
    expect(formatPowerWatts(78_400)).toBe("78.4 kW");
    expect(formatPowerWatts(2_205_000)).toBe("2.2 MW");
  });
});
