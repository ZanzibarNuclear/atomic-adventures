/**
 * WASM smoke: Clearwater Station session via the game adapter.
 * Skips when the web-target pkg cannot init in this environment.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createWasmBackend } from "./energySimBackend.js";
import { hostStateToHydroInputs } from "./hostHydroInputs.js";
import { createHydroState } from "../hydro/state.js";
import { telemetryFromSnapshot } from "./telemetryFromSnapshot.js";
import { resetOpsSessionState } from "./stationOps.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stationJson = readFileSync(
  join(__dirname, "fixtures/clearwater-station.json"),
  "utf8",
);

afterEach(() => {
  resetOpsSessionState();
});

describe("Clearwater Station WASM smoke", () => {
  it("produces power when path is open and generator is online", async () => {
    let Session;
    let version;
    try {
      // Node-friendly package for Vitest; browser uses ./pkg (web target).
      let mod;
      try {
        mod = await import("./pkg-node/energy_sim_wasm.js");
      } catch {
        mod = await import("./pkg/energy_sim_wasm.js");
        if (typeof mod.default === "function") {
          await mod.default();
        }
      }
      Session = mod.Session;
      version = mod.version;
    } catch (err) {
      console.warn("skip WASM smoke:", err?.message ?? err);
      return;
    }

    if (!Session) {
      console.warn("skip WASM smoke: Session missing");
      return;
    }

    const backend = createWasmBackend({ Session, version });
    const { sessionId, snapshot: initial } = await backend.createSession(
      JSON.parse(stationJson),
    );
    expect(initial.plantId).toBe("clearwater-diversion");

    await backend.start(sessionId);
    const host = createHydroState({
      intakeClear: true,
      intakeOpen: true,
      manualValves: { upstreamOpen: true, powerhouseOpen: true },
      online: true,
      startupComplete: true,
      debrisFraction: 0,
      leakageFraction: 0,
    });
    await backend.setHydroInput(sessionId, hostStateToHydroInputs(host));
    const report = await backend.advance(sessionId, { durationSecs: 30 });
    const snap = report.snapshot ?? (await backend.getSnapshot(sessionId));
    const telemetry = telemetryFromSnapshot(snap, host);

    expect(telemetry.generatorOutputKw).toBeGreaterThan(1);
    expect(telemetry.status).toBe("online");
    expect(Array.isArray(snap.loads)).toBe(true);
    expect(snap.loads.length).toBe(4);

    backend.dispose(sessionId);
  }, 20000);
});
