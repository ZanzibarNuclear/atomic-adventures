import { describe, expect, it } from "vitest";
import {
  appendHydroEvent,
  createHydroEvent,
  createHydroState,
  sortHydroEvents,
  withHydroStatePatch,
} from "./index.js";

describe("hydro host facility state", () => {
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
    expect(patched.online).toBe(false);
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
      label: "Stream running high",
    });

    const eventLog = appendHydroEvent(state, next);

    expect(eventLog).toEqual([next, initial]);
    expect(state.eventLog).toEqual([initial]);
  });

  it("generates compact unique event IDs when events share time and type", () => {
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

  it("tags events with the Clearwater plant id", () => {
    const event = createHydroEvent({
      elapsedMinutes: 1,
      type: "facility-change",
      label: "Test",
    });
    expect(event.plantId).toBe("clearwater-diversion");
  });
});
