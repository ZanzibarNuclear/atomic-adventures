import { describe, expect, it } from "vitest";
import { buildEquipmentState } from "./useHydroConsoleMonitor.js";
import { createHydroState } from "../lib/simulations/hydro/state.js";

function readyOnline(overrides = {}) {
  return createHydroState({
    intakeClear: true,
    intakeOpen: true,
    manualValves: { upstreamOpen: true, powerhouseOpen: true },
    startupComplete: true,
    online: true,
    debrisFraction: 0,
    ...overrides,
  });
}

describe("operational console equipment badges", () => {
  it("labels intake blocked/closed and bypass open before field work", () => {
    const eq = buildEquipmentState(createHydroState(), { turbineSpeedRpm: 0 });
    expect(eq.intakeClear).toEqual({ ok: false, label: "Intake blocked" });
    expect(eq.intakeOpen).toEqual({ ok: false, label: "Intake closed" });
    expect(eq.bypass).toEqual({ ok: false, label: "Open" });
    expect(eq.turbineValve).toEqual({ ok: false, label: "Valve closed" });
    expect(eq.generator).toEqual({ ok: false, label: "Disengaged" });
    expect(eq.grid).toEqual({ ok: false, label: "Disconnected" });
  });

  it("shows penstock-ready bypass closed and engaged generator when online and spinning", () => {
    const eq = buildEquipmentState(readyOnline(), {
      turbineSpeedRpm: 900,
      busEnergized: true,
    });
    expect(eq.intakeClear.label).toBe("Intake clear");
    expect(eq.intakeOpen.label).toBe("Intake open");
    expect(eq.bypass).toEqual({ ok: true, label: "Closed" });
    expect(eq.turbineValve).toEqual({ ok: true, label: "Valve open" });
    expect(eq.generator).toEqual({ ok: true, label: "Engaged" });
    expect(eq.grid).toEqual({ ok: true, label: "Connected" });
  });

  it("keeps generator disengaged when online but turbine is not rotating", () => {
    const eq = buildEquipmentState(readyOnline(), { turbineSpeedRpm: 0, busEnergized: false });
    expect(eq.generator.label).toBe("Disengaged");
  });
});
