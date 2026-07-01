import { electricalPowerWatts } from "../../learning/hydroPower.js";
import { getHydroConfig } from "./config.js";
import { fieldReadyForHydroStartup, normalizeHydroState } from "./state.js";

const WATER_KPA_PER_M_HEAD = 9.80665;

export function generateHydroTelemetry(state, options = {}) {
  const normalized = normalizeHydroState(state);
  const config = getHydroConfig(normalized.activeConfigId);
  if (!config) {
    return emptyTelemetry({
      status: "configuration-missing",
      faults: [`Unknown hydro configuration: ${normalized.activeConfigId}`],
    });
  }

  const streamFlowM3s = Math.max(0, finite(options.streamFlowAvailableM3s ?? config.stream.easyModeFlowM3s));
  const valveFactor = manualValveFactor(normalized);
  const intakeFactor = normalized.intakeOpen ? 1 : 0;
  const debrisFactor = normalized.intakeClear ? 1 - normalized.debrisFraction : 0;
  const leakFactor = 1 - normalized.leakageFraction;
  const maxCaptureFlowM3s = Math.max(0, finite(config.intake.maxCaptureFlowM3s));
  const designFlowM3s = Math.max(0, finite(config.equationInputs.designFlowM3s));
  const capturedFlowM3s = Math.min(streamFlowM3s, maxCaptureFlowM3s, designFlowM3s || Infinity);
  const flowM3s = capturedFlowM3s * intakeFactor * valveFactor * debrisFactor * leakFactor;
  const designRatio = designFlowM3s > 0 ? clamp01(flowM3s / designFlowM3s) : 0;
  const leakageHeadPenalty = normalized.leakageFraction * 0.35;
  const debrisHeadPenalty = normalized.debrisFraction * 0.18;
  const netHeadM = config.equationInputs.netHeadM * Math.max(0, 1 - leakageHeadPenalty - debrisHeadPenalty);
  const penstockPressureKpa = netHeadM * WATER_KPA_PER_M_HEAD * intakeFactor * valveFactor;
  const turbineSpeedRpm = config.turbine.ratedSpeedRpm * speedCurve(designRatio) * valveFactor;
  const efficiency = config.equationInputs.baseTurbineEfficiency * config.equationInputs.baseGeneratorEfficiency;
  const rawOutputKw = electricalPowerWatts({
    efficiency,
    flowM3s,
    netHeadM,
  }) / 1000;
  const generatorOutputKw = normalized.online
    ? Math.min(config.generator.ratedPowerKw, rawOutputKw)
    : 0;
  const warnings = buildWarnings({ config, normalized, flowM3s, penstockPressureKpa, turbineSpeedRpm, streamFlowM3s });
  const faults = buildFaults({ normalized, config });
  const status = statusFor({ normalized, config, flowM3s, penstockPressureKpa, turbineSpeedRpm, faults });

  return {
    flowM3s: round(flowM3s, 5),
    netHeadM: round(netHeadM, 2),
    penstockPressureKpa: round(penstockPressureKpa, 1),
    turbineSpeedRpm: Math.round(turbineSpeedRpm),
    generatorOutputKw: round(generatorOutputKw, 3),
    warnings,
    faults,
    status,
  };
}

function emptyTelemetry({ status, warnings = [], faults = [] }) {
  return {
    flowM3s: 0,
    netHeadM: 0,
    penstockPressureKpa: 0,
    turbineSpeedRpm: 0,
    generatorOutputKw: 0,
    warnings,
    faults,
    status,
  };
}

function manualValveFactor(state) {
  const upstream = state.manualValves.upstreamOpen ? 1 : 0;
  const powerhouse = state.manualValves.powerhouseOpen ? 1 : 0;
  return Math.min(upstream, powerhouse);
}

function speedCurve(designRatio) {
  if (designRatio <= 0) return 0;
  return Math.min(1, Math.sqrt(designRatio));
}

function buildWarnings({ config, normalized, flowM3s, penstockPressureKpa, turbineSpeedRpm, streamFlowM3s }) {
  const warnings = [];
  if (!normalized.intakeClear) warnings.push("intake-needs-clearing");
  if (!normalized.intakeOpen) warnings.push("intake-closed");
  if (!normalized.manualValves.upstreamOpen || !normalized.manualValves.powerhouseOpen) {
    warnings.push("manual-valves-not-open");
  }
  if (normalized.debrisFraction > 0.2) warnings.push("intake-debris-reducing-flow");
  if (normalized.leakageFraction > 0.05) warnings.push("penstock-leakage");
  if (streamFlowM3s < config.stream.minimumUsefulFlowM3s) warnings.push("low-stream-flow");
  if (flowM3s > 0 && penstockPressureKpa < config.telemetry.minimumPressureKpa) warnings.push("low-pressure");
  if (flowM3s > 0 && turbineSpeedRpm < config.telemetry.minimumSyncSpeedRpm) warnings.push("low-turbine-speed");
  return warnings;
}

function buildFaults({ normalized, config }) {
  const faults = [];
  if (!getHydroConfig(normalized.activeConfigId)) faults.push("configuration-missing");
  if (normalized.online && !normalized.startupComplete) faults.push("startup-incomplete");
  if (normalized.online && normalized.leakageFraction >= 0.65) faults.push("major-penstock-leak");
  if (normalized.online && normalized.debrisFraction >= 0.9) faults.push("intake-blocked");
  return faults;
}

function statusFor({ normalized, config, flowM3s, penstockPressureKpa, turbineSpeedRpm, faults }) {
  if (faults.length > 0) return "faulted";
  if (!normalized.online) return fieldReadyForHydroStartup(normalized) ? "ready" : "offline";
  if (!fieldReadyForHydroStartup(normalized)) return "startup-blocked";
  if (flowM3s < config.stream.minimumUsefulFlowM3s) return "insufficient-flow";
  if (penstockPressureKpa < config.telemetry.minimumPressureKpa) return "insufficient-pressure";
  if (turbineSpeedRpm < config.telemetry.minimumSyncSpeedRpm) return "spinning-up";
  return "online";
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finite(value)));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(finite(value) * scale) / scale;
}
