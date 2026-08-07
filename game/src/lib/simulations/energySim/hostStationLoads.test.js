import { describe, expect, it } from "vitest";
import { deriveStationLoads, STATION_LOAD_IDS } from "./hostStationLoads.js";

describe("deriveStationLoads", () => {
  it("draws nothing when the bus is offline", () => {
    const loads = deriveStationLoads({
      hydroOnline: false,
      facility: { lightSwitches: { kitchen: true } },
      activeStageKind: "lesson",
      flags: ["hub.ev_charging"],
    });
    expect(Object.values(loads).every((v) => v === false)).toBe(true);
  });

  it("maps lights, holo stage, EV flag, and stove burners when online", () => {
    const loads = deriveStationLoads({
      hydroOnline: true,
      facility: {
        lightSwitches: { library: true },
        fixtures: {
          "kitchen-stove": { burners: ["off", "high", "off", "off"] },
        },
      },
      activeStageKind: "lesson",
      flags: new Set(["hub.ev_charging"]),
    });
    expect(loads[STATION_LOAD_IDS.lighting]).toBe(true);
    expect(loads[STATION_LOAD_IDS.holoReader]).toBe(true);
    expect(loads[STATION_LOAD_IDS.evCharge]).toBe(true);
    expect(loads[STATION_LOAD_IDS.kitchen]).toBe(true);
  });

  it("leaves idle loads off when online but idle", () => {
    const loads = deriveStationLoads({
      hydroOnline: true,
      facility: { lightSwitches: {}, fixtures: {} },
      activeStageKind: "console",
      flags: [],
    });
    expect(loads[STATION_LOAD_IDS.lighting]).toBe(false);
    expect(loads[STATION_LOAD_IDS.holoReader]).toBe(false);
    expect(loads[STATION_LOAD_IDS.evCharge]).toBe(false);
    expect(loads[STATION_LOAD_IDS.kitchen]).toBe(false);
  });
});
