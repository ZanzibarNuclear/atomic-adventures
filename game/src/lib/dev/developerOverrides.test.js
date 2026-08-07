import { describe, expect, it } from "vitest";
import {
  HYDRO_DISCOVERED_FLAG,
  HYDRO_LEVEL_COMPLETE_FLAG,
  HYDRO_POWER_FLAG,
  isStationPowerOverriddenOn,
  setStationPowerOverride,
} from "./developerOverrides.js";

function makeCtx() {
  const gameState = {
    flags: new Set(),
    clock: { elapsedMinutes: 100 },
    facilities: {},
    character: { definitions: { stats: [] }, stats: {} },
  };
  const indoor = {
    indoor: {
      facility: { hydroOnline: false },
    },
    setHydroOnline(on) {
      indoor.indoor.facility.hydroOnline = on;
    },
  };
  return { gameState, indoor };
}

describe("setStationPowerOverride", () => {
  it("engages full hydro startup state and power flags when turned on", () => {
    const ctx = makeCtx();
    const result = setStationPowerOverride(ctx, true);
    expect(result.ok).toBe(true);
    expect(ctx.gameState.flags.has(HYDRO_POWER_FLAG)).toBe(true);
    expect(ctx.gameState.flags.has(HYDRO_LEVEL_COMPLETE_FLAG)).toBe(true);
    expect(ctx.gameState.flags.has(HYDRO_DISCOVERED_FLAG)).toBe(true);
    expect(ctx.indoor.indoor.facility.hydroOnline).toBe(true);
    expect(isStationPowerOverriddenOn(ctx.gameState, ctx.indoor)).toBe(true);

    const hydro = ctx.gameState.facilities.hydro;
    expect(hydro.online).toBe(true);
    expect(hydro.startupComplete).toBe(true);
    expect(hydro.intakeClear).toBe(true);
    expect(hydro.intakeOpen).toBe(true);
    expect(hydro.manualValves.upstreamOpen).toBe(true);
    expect(hydro.manualValves.powerhouseOpen).toBe(true);
    expect(hydro.debrisFraction).toBe(0);
  });

  it("clears hydro startup state and power flags when turned off", () => {
    const ctx = makeCtx();
    setStationPowerOverride(ctx, true);
    const result = setStationPowerOverride(ctx, false);
    expect(result.ok).toBe(true);
    expect(ctx.gameState.flags.has(HYDRO_POWER_FLAG)).toBe(false);
    expect(ctx.gameState.flags.has(HYDRO_LEVEL_COMPLETE_FLAG)).toBe(false);
    expect(ctx.gameState.flags.has(HYDRO_DISCOVERED_FLAG)).toBe(false);
    expect(ctx.indoor.indoor.facility.hydroOnline).toBe(false);

    const hydro = ctx.gameState.facilities.hydro;
    expect(hydro.online).toBe(false);
    expect(hydro.startupComplete).toBe(false);
    expect(hydro.intakeClear).toBe(false);
    expect(hydro.intakeOpen).toBe(false);
    expect(hydro.manualValves.upstreamOpen).toBe(false);
    expect(hydro.manualValves.powerhouseOpen).toBe(false);
  });
});
