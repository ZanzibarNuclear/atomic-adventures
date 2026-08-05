/**
 * Clearwater-shaped penstock teaching model for Holo-Reader sandbox.
 * Mutates a plant JSON clone + operator inputs; does not touch ops facility state.
 */

import clearwaterDiversion from "../simulations/energySim/fixtures/clearwater-diversion.json";
import idealTeaching from "../simulations/energySim/fixtures/ideal-teaching.json";

export const PENSTOCK_LAB_PRESETS = Object.freeze({
  clearwater: {
    id: "clearwater",
    label: "Clearwater-like diversion",
    plant: clearwaterDiversion,
  },
  ideal: {
    id: "ideal",
    label: "Ideal (no pipe losses)",
    plant: idealTeaching,
  },
});

/**
 * @param {string} [presetId]
 */
export function defaultPenstockLabKnobs(presetId = "clearwater") {
  const { plant, presetId: id } = plantForPreset(presetId);
  return {
    presetId: id,
    grossHeadM: Number(plant.penstock.grossHeadM),
    availableFlowM3s: Number(plant.stream.availableFlowM3s),
    diameterM: Number(plant.penstock.diameterM),
    lengthM: Number(plant.penstock.lengthM),
    gateOpening: id === "clearwater" ? 0.8 : 1,
    debrisClogFraction: 0,
    leakageFraction: 0,
    online: true,
  };
}

/**
 * @param {object} knobs
 * @returns {{ plant: object, operator: object, presetId: string }}
 */
export function buildPenstockLabConfig(knobs = {}) {
  const { plant: basePlant, presetId } = plantForPreset(knobs.presetId);
  const plant = structuredClone(basePlant);
  plant.stream = {
    ...plant.stream,
    availableFlowM3s: clampPositive(knobs.availableFlowM3s, plant.stream.availableFlowM3s),
  };
  plant.penstock = {
    ...plant.penstock,
    grossHeadM: clampPositive(knobs.grossHeadM, plant.penstock.grossHeadM),
    diameterM: clampPositive(knobs.diameterM, plant.penstock.diameterM),
    lengthM: clampPositive(knobs.lengthM, plant.penstock.lengthM),
  };
  // Teaching sandbox: plant id stays identifiable as a lab trial
  plant.id = `${basePlant.id}-lab`;
  plant.label = `${basePlant.label} (lab)`;

  const operator = {
    gateOpening: clamp01(knobs.gateOpening ?? 1),
    debrisClogFraction: clamp01(knobs.debrisClogFraction ?? 0),
    leakageFraction: clamp01(knobs.leakageFraction ?? 0),
    online: knobs.online !== false,
  };
  return { plant, operator, presetId };
}

/**
 * Evaluate via energy-sims evaluateHydro (injected) or null if unavailable.
 * @param {object} knobs
 * @param {(plantJson: string, operatorJson?: string) => object} [evaluateHydro]
 */
export function evaluatePenstockLab(knobs, evaluateHydro) {
  const { plant, operator, presetId } = buildPenstockLabConfig(knobs);
  if (typeof evaluateHydro !== "function") {
    return {
      ok: false,
      reason: "no-engine",
      presetId,
      plant,
      operator,
      result: null,
    };
  }
  try {
    const result = evaluateHydro(JSON.stringify(plant), JSON.stringify(operator));
    return {
      ok: true,
      presetId,
      plant,
      operator,
      result,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message ?? String(err),
      presetId,
      plant,
      operator,
      result: null,
    };
  }
}

export function summarizePenstockResult(result) {
  if (!result) {
    return {
      flowM3s: 0,
      grossHeadM: 0,
      netHeadM: 0,
      headLossM: 0,
      electricalPowerKw: 0,
      hydraulicPowerKw: 0,
      turbineSpeedRpm: 0,
      warnings: [],
      delivering: false,
    };
  }
  return {
    flowM3s: Number(result.flowM3s) || 0,
    grossHeadM: Number(result.grossHeadM) || 0,
    netHeadM: Number(result.netHeadM) || 0,
    headLossM: Number(result.headLossM) || 0,
    electricalPowerKw: Number(result.electricalPowerKw) || 0,
    hydraulicPowerKw: Number(result.hydraulicPowerKw) || 0,
    turbineSpeedRpm: Number(result.turbineSpeedRpm) || 0,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    delivering: Boolean(result.delivering),
  };
}

function plantForPreset(presetId) {
  const key = presetId === "ideal" ? "ideal" : "clearwater";
  const entry = PENSTOCK_LAB_PRESETS[key];
  return {
    presetId: key,
    plant: entry.plant,
  };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clampPositive(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Number(fallback) || 0.01;
  return n;
}
