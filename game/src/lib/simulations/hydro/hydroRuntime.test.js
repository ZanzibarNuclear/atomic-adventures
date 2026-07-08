import { describe, expect, it } from "vitest";
import {
  appendHydroEvent,
  buildHydroGraphData,
  createHydroEvent,
  createHydroState,
  generateHydroTelemetry,
  sortHydroEvents,
  withHydroStatePatch,
} from "./index.js";

function readyState(overrides = {}) {
  return createHydroState({
    intakeClear: true,
    intakeOpen: true,
    manualValves: {
      upstreamOpen: true,
      powerhouseOpen: true,
    },
    startupComplete: true,
    debrisFraction: 0,
    leakageFraction: 0,
    ...overrides,
  });
}

describe("hydro runtime telemetry", () => {
  it("keeps the generator offline until startup is completed", () => {
    const telemetry = generateHydroTelemetry(createHydroState());

    expect(telemetry.status).toBe("offline");
    expect(telemetry.generatorOutputKw).toBe(0);
    expect(telemetry.warnings).toEqual(expect.arrayContaining([
      "intake-needs-clearing",
      "intake-closed",
      "manual-valves-not-open",
    ]));
  });

  it("produces stable online telemetry for a valid startup", () => {
    const telemetry = generateHydroTelemetry(readyState({ online: true }));

    expect(telemetry.status).toBe("online");
    expect(telemetry.flowM3s).toBeCloseTo(0.012, 5);
    expect(telemetry.netHeadM).toBeCloseTo(15.24, 2);
    expect(telemetry.penstockPressureKpa).toBeCloseTo(149.5, 1);
    expect(telemetry.turbineSpeedRpm).toBe(900);
    expect(telemetry.generatorOutputKw).toBeCloseTo(1, 3);
    expect(telemetry.warnings).toEqual([]);
    expect(telemetry.faults).toEqual([]);
  });

  it("reports readiness without producing power before the online state changes", () => {
    const telemetry = generateHydroTelemetry(readyState({ online: false }));

    expect(telemetry.status).toBe("ready");
    expect(telemetry.flowM3s).toBeGreaterThan(0);
    expect(telemetry.generatorOutputKw).toBe(0);
  });

  it("diagnoses partially closed manual valves", () => {
    const telemetry = generateHydroTelemetry(readyState({
      online: true,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: false,
      },
    }));

    expect(telemetry.status).toBe("startup-blocked");
    expect(telemetry.flowM3s).toBe(0);
    expect(telemetry.generatorOutputKw).toBe(0);
    expect(telemetry.warnings).toContain("manual-valves-not-open");
  });

  it("reduces flow and output when intake debris remains", () => {
    const clean = generateHydroTelemetry(readyState({ online: true }));
    const obstructed = generateHydroTelemetry(readyState({
      online: true,
      debrisFraction: 0.5,
    }));

    expect(obstructed.status).toBe("spinning-up");
    expect(obstructed.flowM3s).toBeLessThan(clean.flowM3s);
    expect(obstructed.generatorOutputKw).toBeLessThan(clean.generatorOutputKw);
    expect(obstructed.warnings).toContain("intake-debris-reducing-flow");
  });

  it("reduces head, flow, and output when penstock leakage is present", () => {
    const healthy = generateHydroTelemetry(readyState({ online: true }));
    const leaking = generateHydroTelemetry(readyState({
      online: true,
      leakageFraction: 0.25,
    }));

    expect(leaking.status).toBe("online");
    expect(leaking.flowM3s).toBeLessThan(healthy.flowM3s);
    expect(leaking.netHeadM).toBeLessThan(healthy.netHeadM);
    expect(leaking.generatorOutputKw).toBeLessThan(healthy.generatorOutputKw);
    expect(leaking.warnings).toContain("penstock-leakage");
  });

  it("reports low flow from the environment without mutating facility state", () => {
    const state = readyState({ online: true });
    const telemetry = generateHydroTelemetry(state, { streamFlowAvailableM3s: 0.001 });

    expect(telemetry.status).toBe("insufficient-flow");
    expect(telemetry.flowM3s).toBe(0.001);
    expect(telemetry.generatorOutputKw).toBeLessThan(0.2);
    expect(telemetry.warnings).toContain("low-stream-flow");
    expect(state.debrisFraction).toBe(0);
  });
});

describe("hydro runtime state and events", () => {
  it("normalizes serializable state patches", () => {
    const patched = withHydroStatePatch(createHydroState(), {
      intakeClear: true,
      manualValves: { upstreamOpen: true },
      debrisFraction: -1,
      leakageFraction: 2,
    });

    expect(patched.intakeClear).toBe(true);
    expect(patched.manualValves.upstreamOpen).toBe(true);
    expect(patched.manualValves.powerhouseOpen).toBe(false);
    expect(patched.debrisFraction).toBe(0);
    expect(patched.leakageFraction).toBe(1);
  });

  it("sorts events by elapsed time, then insertion order", () => {
    const later = createHydroEvent({
      eventId: "hydro-event-0200-valve",
      elapsedMinutes: 200,
      type: "facility-change",
      label: "Valve opened",
    });
    const firstAtSameTime = createHydroEvent({
      eventId: "hydro-event-0100-a",
      elapsedMinutes: 100,
      type: "facility-change",
      label: "Intake opened",
    });
    const secondAtSameTime = createHydroEvent({
      eventId: "hydro-event-0100-b",
      elapsedMinutes: 100,
      type: "facility-change",
      label: "Intake cleared",
    });

    expect(sortHydroEvents([later, secondAtSameTime, firstAtSameTime])).toEqual([
      secondAtSameTime,
      firstAtSameTime,
      later,
    ]);
  });

  it("appends events without rewriting earlier records", () => {
    const initial = createHydroEvent({
      eventId: "hydro-event-0100-intake",
      elapsedMinutes: 100,
      type: "facility-change",
      label: "Intake cleared",
    });
    const state = createHydroState({ eventLog: [initial] });
    const next = createHydroEvent({
      eventId: "hydro-event-0090-stream",
      elapsedMinutes: 90,
      type: "environment-change",
      label: "Brook running high",
    });

    const eventLog = appendHydroEvent(state, next);

    expect(eventLog).toEqual([next, initial]);
    expect(state.eventLog).toEqual([initial]);
  });

  it("keeps generated event IDs unique when events share time and type", () => {
    const state = createHydroState();
    const first = createHydroEvent({
      elapsedMinutes: 12,
      type: "facility-change",
      label: "Inspection recorded",
    });
    const second = createHydroEvent({
      elapsedMinutes: 12,
      type: "facility-change",
      label: "Inspection recorded",
    });

    const eventLog = appendHydroEvent(
      { eventLog: appendHydroEvent(state, first) },
      second,
    );

    expect(eventLog.map((event) => event.eventId)).toEqual([
      "hydro-event-00012000-facility-change-inspection-recorded",
      "hydro-event-00012000-facility-change-inspection-recorded-2",
    ]);
  });

  it("generates compact historical samples, report data, and event markers", () => {
    const state = createHydroState();
    state.lastCheckpointElapsedMinutes = 40;
    state.eventLog = [
      createHydroEvent({
        eventId: "hydro-event-0010-intake",
        elapsedMinutes: 10,
        type: "facility-change",
        label: "Intake debris cleared",
        payload: {
          actionId: "clear-intake-debris",
          patch: { intakeClear: true, debrisFraction: 0 },
        },
      }),
      createHydroEvent({
        eventId: "hydro-event-0015-intake-open",
        elapsedMinutes: 15,
        type: "facility-change",
        label: "Intake opened",
        payload: {
          actionId: "open-intake",
          patch: { intakeOpen: true },
        },
      }),
      createHydroEvent({
        eventId: "hydro-event-0020-upstream",
        elapsedMinutes: 20,
        type: "facility-change",
        label: "Upstream manual valve opened",
        payload: {
          actionId: "align-pipeflow",
          patch: { manualValves: { upstreamOpen: true } },
        },
      }),
      createHydroEvent({
        eventId: "hydro-event-0030-powerhouse",
        elapsedMinutes: 30,
        type: "facility-change",
        label: "Powerhouse manual valve opened",
        payload: {
          actionId: "open-turbine-valve",
          patch: { manualValves: { powerhouseOpen: true } },
        },
      }),
      createHydroEvent({
        eventId: "hydro-event-0040-online",
        elapsedMinutes: 40,
        type: "state-transition",
        label: "Hydro generator startup completed",
        payload: {
          actionId: "connect-power",
          patch: { startupComplete: true, online: true, lastCheckpointElapsedMinutes: 40 },
        },
      }),
    ];

    const graphData = buildHydroGraphData(state, {
      fromElapsedMinutes: 0,
      toElapsedMinutes: 40,
      stepMinutes: 10,
    });

    expect(graphData.samples.map((sample) => sample.elapsedMinutes)).toEqual([0, 10, 20, 30, 40]);
    expect(graphData.samples.at(0).telemetry.status).toBe("offline");
    expect(graphData.samples.at(-1).telemetry.status).toBe("online");
    expect(graphData.samples.at(-1).telemetry.generatorOutputKw).toBe(1);
    expect(graphData.markers.map((marker) => marker.label)).toEqual([
      "Intake debris cleared",
      "Intake opened",
      "Upstream manual valve opened",
      "Powerhouse manual valve opened",
      "Hydro generator startup completed",
    ]);
    expect(graphData.report.generatedEnergyKwh).toBe(0);
    expect(graphData.report.online).toBe(true);
    expect(graphData.report.markerCount).toBe(5);
  });
});
