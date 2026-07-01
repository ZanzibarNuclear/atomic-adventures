import { describe, expect, it } from "vitest";
import {
  HYDRO_LEVEL_COMPLETE_FLAG,
  HYDRO_POWER_FLAG,
  isStationPowerOverriddenOn,
  setStationPowerOverride,
} from "./developerOverrides.js";

function harness() {
  return {
    gameState: { flags: new Set() },
    indoor: {
      indoor: { facility: { hydroOnline: false } },
      setHydroOnline(on) {
        this.indoor.facility.hydroOnline = on;
      },
    },
  };
}

describe("developer overrides", () => {
  it("turns station power on through flags and facility state", () => {
    const ctx = harness();

    expect(setStationPowerOverride(ctx, true)).toEqual({ ok: true });

    expect(ctx.gameState.flags.has(HYDRO_POWER_FLAG)).toBe(true);
    expect(ctx.gameState.flags.has(HYDRO_LEVEL_COMPLETE_FLAG)).toBe(true);
    expect(ctx.indoor.indoor.facility.hydroOnline).toBe(true);
    expect(isStationPowerOverriddenOn(ctx.gameState, ctx.indoor)).toBe(true);
  });

  it("turns station power off through flags and facility state", () => {
    const ctx = harness();
    setStationPowerOverride(ctx, true);

    expect(setStationPowerOverride(ctx, false)).toEqual({ ok: true });

    expect(ctx.gameState.flags.has(HYDRO_POWER_FLAG)).toBe(false);
    expect(ctx.gameState.flags.has(HYDRO_LEVEL_COMPLETE_FLAG)).toBe(false);
    expect(ctx.indoor.indoor.facility.hydroOnline).toBe(false);
    expect(isStationPowerOverriddenOn(ctx.gameState, ctx.indoor)).toBe(false);
  });
});
