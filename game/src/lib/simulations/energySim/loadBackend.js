/**
 * Lazy energy-sims backend: WASM default, optional HTTP override.
 */

import {
  createEnergySimBackend,
  createHttpBackend,
  createWasmBackend,
} from "./energySimBackend.js";

/** @type {Promise<import('./energySimBackend.js').EnergySimBackend | null> | null} */
let backendPromise = null;

/**
 * Prefer VITE_ENERGY_SIM_URL (HTTP) when set; otherwise WASM on device.
 * @returns {Promise<object|null>}
 */
export function getEnergySimBackend() {
  if (!backendPromise) {
    backendPromise = createBackend().catch((err) => {
      backendPromise = null;
      console.warn("[energySim] backend init failed; falling back to legacy hydro", err);
      return null;
    });
  }
  return backendPromise;
}

/** Reset cached backend (tests / HMR). */
export function resetEnergySimBackendCache() {
  backendPromise = null;
}

async function createBackend() {
  const httpUrl = readEnvUrl();
  if (httpUrl) {
    return createHttpBackend({ baseUrl: httpUrl });
  }

  const wasm = await loadWasmModule();
  if (!wasm?.Session) {
    throw new Error("energy-sim-wasm Session export missing");
  }
  return createWasmBackend({
    Session: wasm.Session,
    version: wasm.version,
  });
}

async function loadWasmModule() {
  // Web target: default init loads companion .wasm via import.meta.url
  const mod = await import("./pkg/energy_sim_wasm.js");
  if (typeof mod.default === "function") {
    await mod.default();
  }
  return mod;
}

function readEnvUrl() {
  try {
    const url = import.meta.env?.VITE_ENERGY_SIM_URL;
    return url ? String(url).replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

export { createEnergySimBackend, createHttpBackend, createWasmBackend };
