import { describe, expect, it } from "vitest";
import { createHydroState } from "../hydro/state.js";
import { hostStateToHydroInputs, hydroPathOpen } from "./hostHydroInputs.js";
import { telemetryFromSnapshot } from "./telemetryFromSnapshot.js";
import { presentSnapshot } from "./energySimPresent.js";

function readyHost(overrides = {}) {
  return createHydroState({
    intakeClear: true,
    intakeOpen: true,
    manualValves: { upstreamOpen: true, powerhouseOpen: true },
    debrisFraction: 0,
    leakageFraction: 0,
    ...overrides,
  });
}

describe("hostStateToHydroInputs", () => {
  it("keeps the gate closed until the field path is open", () => {
    const inputs = hostStateToHydroInputs(createHydroState());
    expect(inputs.gate_opening).toBe(0);
    expect(inputs.online).toBe(false);
    expect(hydroPathOpen(createHydroState())).toBe(false);
  });

  it("opens the gate and sets online for a completed startup", () => {
    const inputs = hostStateToHydroInputs(
      readyHost({ online: true, startupComplete: true }),
    );
    expect(inputs.gate_opening).toBe(1);
    expect(inputs.online).toBe(true);
    expect(inputs.debris_clog_fraction).toBe(0);
    expect(inputs.leakage_fraction).toBe(0);
  });

  it("forwards debris and leakage fractions", () => {
    const inputs = hostStateToHydroInputs(
      readyHost({ debrisFraction: 0.4, leakageFraction: 0.1 }),
    );
    expect(inputs.debris_clog_fraction).toBeCloseTo(0.4);
    expect(inputs.leakage_fraction).toBeCloseTo(0.1);
  });
});

describe("telemetryFromSnapshot", () => {
  it("maps engine snapshot fields into console telemetry", () => {
    const host = readyHost({ online: true, startupComplete: true });
    const telemetry = telemetryFromSnapshot(
      {
        simTimeS: 30,
        plantId: "clearwater-diversion",
        flowM3s: 0.05,
        grossHeadM: 25,
        netHeadM: 24.2,
        headLossM: 0.8,
        hydraulicPowerKw: 12,
        electricalPowerKw: 8,
        targetElectricalPowerKw: 8,
        turbineSpeedRpm: 1000,
        energyGeneratedKwh: 0.05,
        availableGenerationKw: 8,
        totalLoadKw: 0.4,
        marginKw: 7.6,
        busEnergized: true,
        gridStatus: "surplus",
        loads: [
          {
            id: "lighting.main",
            label: "Main building lights",
            ratingW: 400,
            priority: "normal",
            drawing: true,
          },
        ],
        warnings: [],
      },
      host,
    );

    expect(telemetry.source).toBe("energy-sims");
    expect(telemetry.status).toBe("online");
    expect(telemetry.generatorOutputKw).toBe(8);
    expect(telemetry.flowM3s).toBeCloseTo(0.05);
    expect(telemetry.penstockPressureKpa).toBeCloseTo(24.2 * 9.80665, 0);
    expect(telemetry.turbineSpeedRpm).toBe(1000);
    expect(telemetry.busEnergized).toBe(true);
    expect(telemetry.lightLevel).toBe(1);
    expect(telemetry.loads).toHaveLength(1);
  });

  it("reports spinning-up when online but power has not settled", () => {
    const host = readyHost({ online: true, startupComplete: true });
    const telemetry = telemetryFromSnapshot(
      {
        electricalPowerKw: 0.2,
        targetElectricalPowerKw: 8,
        flowM3s: 0.05,
        netHeadM: 24,
        turbineSpeedRpm: 100,
        busEnergized: false,
        gridStatus: "ok",
        warnings: [],
      },
      host,
    );
    expect(telemetry.status).toBe("spinning-up");
  });
});

describe("presentSnapshot brownout", () => {
  it("maps brownout to reduced light level", () => {
    const view = presentSnapshot({
      simTimeS: 10,
      electricalPowerKw: 1,
      busEnergized: true,
      gridStatus: "brownout",
      marginKw: -2,
      availableGenerationKw: 1,
      totalLoadKw: 3,
      flowM3s: 0,
      netHeadM: 0,
      turbineSpeedRpm: 0,
      warnings: [],
    });
    expect(view.brownout).toBe(true);
    expect(view.lightLevel).toBe(0.4);
  });
});
