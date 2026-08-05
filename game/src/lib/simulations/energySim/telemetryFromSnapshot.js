/**
 * Map energy-sims Snapshot (+ host field state) → console telemetry shape
 * expected by HydroConsoleMonitor / readouts.
 */

import { normalizeHydroState } from "../hydro/state.js";
import { hydroPathOpen } from "./hostHydroInputs.js";
import { presentGrid } from "./energySimPresent.js";

/** Approximate gauge from net head (kPa per m of water column). */
const WATER_KPA_PER_M_HEAD = 9.80665;

/**
 * @param {object|null|undefined} snapshot - engine Snapshot (camelCase)
 * @param {object} [hostState] - facilities.hydro
 */
export function telemetryFromSnapshot(snapshot, hostState = {}) {
  const n = normalizeHydroState(hostState);
  if (!snapshot || typeof snapshot !== "object") {
    return emptyTelemetry(n, "offline");
  }

  const flowM3s = finite(snapshot.flowM3s);
  const netHeadM = finite(snapshot.netHeadM);
  const electricalPowerKw = finite(snapshot.electricalPowerKw);
  const targetElectricalPowerKw = finite(snapshot.targetElectricalPowerKw);
  const turbineSpeedRpm = finite(snapshot.turbineSpeedRpm);
  const pathOpen = hydroPathOpen(n);

  const warnings = buildHostWarnings(n, snapshot.warnings ?? []);
  const faults = [];
  if (n.online && !n.startupComplete) faults.push("startup-incomplete");
  if (n.online && n.leakageFraction >= 0.65) faults.push("major-penstock-leak");

  const status = statusFor({
    n,
    pathOpen,
    electricalPowerKw,
    targetElectricalPowerKw,
    faults,
  });

  const grid = presentGrid(snapshot);

  return {
    flowM3s: round(flowM3s, 5),
    netHeadM: round(netHeadM, 2),
    grossHeadM: round(finite(snapshot.grossHeadM), 2),
    headLossM: round(finite(snapshot.headLossM), 2),
    penstockPressureKpa: round(netHeadM * WATER_KPA_PER_M_HEAD, 1),
    turbineSpeedRpm: Math.round(turbineSpeedRpm),
    generatorOutputKw: round(electricalPowerKw, 3),
    targetElectricalPowerKw: round(targetElectricalPowerKw, 3),
    hydraulicPowerKw: round(finite(snapshot.hydraulicPowerKw), 3),
    energyGeneratedKwh: round(finite(snapshot.energyGeneratedKwh), 4),
    availableGenerationKw: round(finite(snapshot.availableGenerationKw), 3),
    totalLoadKw: round(finite(snapshot.totalLoadKw), 3),
    marginKw: round(finite(snapshot.marginKw), 3),
    busEnergized: Boolean(snapshot.busEnergized),
    gridStatus: snapshot.gridStatus ?? "ok",
    lightLevel: grid?.lightLevel ?? 0,
    loads: grid?.loads ?? [],
    warnings,
    faults,
    status,
    plantId: snapshot.plantId ?? "clearwater-diversion",
    simTimeS: finite(snapshot.simTimeS),
    source: "energy-sims",
  };
}

function emptyTelemetry(n, status) {
  return {
    flowM3s: 0,
    netHeadM: 0,
    grossHeadM: 0,
    headLossM: 0,
    penstockPressureKpa: 0,
    turbineSpeedRpm: 0,
    generatorOutputKw: 0,
    targetElectricalPowerKw: 0,
    hydraulicPowerKw: 0,
    energyGeneratedKwh: 0,
    availableGenerationKw: 0,
    totalLoadKw: 0,
    marginKw: 0,
    busEnergized: false,
    gridStatus: "ok",
    lightLevel: 0,
    loads: [],
    warnings: buildHostWarnings(n, []),
    faults: [],
    status,
    plantId: "clearwater-diversion",
    simTimeS: 0,
    source: "energy-sims",
  };
}

function buildHostWarnings(n, engineWarnings) {
  const warnings = [...engineWarnings];
  if (!n.intakeClear) warnings.push("intake-needs-clearing");
  if (!n.intakeOpen) warnings.push("intake-closed");
  if (!n.manualValves.upstreamOpen || !n.manualValves.powerhouseOpen) {
    warnings.push("manual-valves-not-open");
  }
  if (n.debrisFraction > 0.2) warnings.push("intake-debris-reducing-flow");
  if (n.leakageFraction > 0.05) warnings.push("penstock-leakage");
  if (!n.online) warnings.push("station-power-off");
  return [...new Set(warnings)];
}

function statusFor({ n, pathOpen, electricalPowerKw, targetElectricalPowerKw, faults }) {
  if (faults.length) return "faulted";
  // Ramping toward target after connect-power
  if (
    n.online &&
    targetElectricalPowerKw > 0.05 &&
    electricalPowerKw < targetElectricalPowerKw * 0.85
  ) {
    return "spinning-up";
  }
  if (n.online && electricalPowerKw > 0.01) return "online";
  if (n.online && pathOpen) return "spinning-up";
  if (pathOpen && !n.online) return "ready";
  if (!pathOpen) return n.online ? "startup-blocked" : "offline";
  return "offline";
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
