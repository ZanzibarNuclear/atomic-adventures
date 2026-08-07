import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPenstockLabConfig,
  defaultPenstockLabKnobs,
  evaluatePenstockLab,
  summarizePenstockResult,
} from "./penstockLabModel.js";
import { isRegisteredInteractionId, resolveLessonInteraction } from "./interactionRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("interaction registry", () => {
  it("registers the Clearwater penstock lab", () => {
    expect(isRegisteredInteractionId("hydro-penstock-lab")).toBe(true);
    expect(resolveLessonInteraction("hydro-penstock-lab")?.component).toBeTruthy();
    expect(resolveLessonInteraction("not-a-real-lab")).toBeNull();
  });
});

describe("penstockLabModel", () => {
  it("builds a lab plant clone without mutating the Clearwater fixture", () => {
    const knobs = defaultPenstockLabKnobs("clearwater");
    knobs.grossHeadM = 30;
    const { plant, operator } = buildPenstockLabConfig(knobs);
    expect(plant.id).toContain("lab");
    expect(plant.penstock.grossHeadM).toBe(30);
    expect(operator.gateOpening).toBeCloseTo(0.8);
    expect(operator.online).toBe(true);

    // Fixture module remains plant-of-record numbers
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "../simulations/energySim/fixtures/clearwater-diversion.json"),
        "utf8",
      ),
    );
    expect(fixture.penstock.grossHeadM).toBe(25);
    expect(fixture.id).toBe("clearwater-diversion");
  });

  it("evaluates with energy-sims WASM when available (sandbox only)", async () => {
    let evaluateHydro;
    try {
      const mod = await import("../simulations/energySim/pkg-node/energy_sim_wasm.js");
      evaluateHydro = mod.evaluateHydro;
    } catch {
      return; // skip when pkg-node missing
    }

    const knobs = defaultPenstockLabKnobs("clearwater");
    const report = evaluatePenstockLab(knobs, evaluateHydro);
    expect(report.ok).toBe(true);
    const summary = summarizePenstockResult(report.result);
    expect(summary.electricalPowerKw).toBeGreaterThan(1);
    expect(summary.netHeadM).toBeGreaterThan(20);

    // Higher debris reduces power
    const clogged = evaluatePenstockLab(
      { ...knobs, debrisClogFraction: 0.6 },
      evaluateHydro,
    );
    expect(clogged.ok).toBe(true);
    expect(summarizePenstockResult(clogged.result).electricalPowerKw)
      .toBeLessThan(summary.electricalPowerKw);
  });

  it("does not require ops session state", () => {
    const report = evaluatePenstockLab(defaultPenstockLabKnobs("clearwater"), null);
    expect(report.ok).toBe(false);
    expect(report.reason).toBe("no-engine");
    // Still returns plant/operator for inspection — no facilities.hydro involved
    expect(report.plant.stream.availableFlowM3s).toBeGreaterThan(0);
  });
});
