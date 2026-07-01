import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { createHydroState } from "../lib/simulations/hydro/index.js";
import {
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
});
