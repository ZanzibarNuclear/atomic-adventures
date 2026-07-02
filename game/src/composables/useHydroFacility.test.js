import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { createHydroState } from "../lib/simulations/hydro/index.js";
import {
  applyHydroStartupAction,
  ensureHydroFacilityState,
  setHydroFacilityOnline,
  useHydroFacility,
} from "./useHydroFacility.js";

function gameState(overrides = {}) {
  return reactive({
    clock: { elapsedMinutes: 42 },
    facilities: {
      hydro: createHydroState(overrides),
    },
  });
}

describe("useHydroFacility", () => {
  it("ensures a serializable hydro facility state exists", () => {
    const state = reactive({ clock: { elapsedMinutes: 0 } });

    const hydro = ensureHydroFacilityState(state);

    expect(hydro.activeConfigId).toBe("hydro-generator-baseline");
    expect(hydro.online).toBe(false);
    expect(Array.isArray(hydro.eventLog)).toBe(true);
  });

  it("sets hydro online and records an ordered host event", () => {
    const state = gameState();

    const hydro = setHydroFacilityOnline(state, true, {
      elapsedMinutes: 12,
      actor: "player",
      eventId: "hydro-event-0012-online",
    });

    expect(hydro.online).toBe(true);
    expect(hydro.startupComplete).toBe(true);
    expect(hydro.lastCheckpointElapsedMinutes).toBe(12);
    expect(hydro.eventLog).toMatchObject([
      {
        eventId: "hydro-event-0012-online",
        elapsedMinutes: 12,
        type: "state-transition",
        actor: "player",
        payload: { online: true },
      },
    ]);
  });

  it("mirrors online state into the existing station facility bridge", () => {
    const state = gameState();
    const stationContext = reactive({
      indoor: {
        facility: {
          hydroOnline: false,
          manualMode: {},
        },
      },
    });
    const hydro = useHydroFacility(state, stationContext);

    hydro.setOnline(true, { eventId: "hydro-event-online" });

    expect(state.facilities.hydro.online).toBe(true);
    expect(stationContext.indoor.facility.hydroOnline).toBe(true);
  });

  it("reads telemetry without mutating facility state", () => {
    const state = gameState({
      intakeClear: true,
      intakeOpen: true,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      startupComplete: true,
      online: true,
      debrisFraction: 0,
    });
    const hydro = useHydroFacility(state);
    const before = JSON.stringify(state.facilities.hydro);

    const telemetry = hydro.readTelemetry();

    expect(telemetry.status).toBe("online");
    expect(telemetry.generatorOutputKw).toBeGreaterThan(0.9);
    expect(JSON.stringify(state.facilities.hydro)).toBe(before);
  });

  it("applies authored startup actions as host-owned facility changes", () => {
    const state = gameState();
    state.clock.elapsedMinutes = 90;

    expect(applyHydroStartupAction(state, "clear-intake-debris").ok).toBe(true);
    expect(applyHydroStartupAction(state, "align-pipeflow").ok).toBe(true);
    expect(applyHydroStartupAction(state, "open-turbine-valve").ok).toBe(true);
    expect(applyHydroStartupAction(state, "connect-power").ok).toBe(true);

    expect(state.facilities.hydro).toMatchObject({
      intakeClear: true,
      intakeOpen: true,
      debrisFraction: 0,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      startupComplete: true,
      online: true,
      lastCheckpointElapsedMinutes: 90,
    });
    expect(state.facilities.hydro.eventLog.map((event) => event.label)).toEqual([
      "Intake cleared and opened",
      "Upstream manual valve opened",
      "Powerhouse manual valve opened",
      "Hydro generator startup completed",
    ]);
  });
});
