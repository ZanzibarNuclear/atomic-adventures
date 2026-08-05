/**
 * EnergySim host integration (Clearwater plant of record via sibling energy-sims).
 *
 * Default: WASM in the browser. Optional HTTP when VITE_ENERGY_SIM_URL is set.
 */

export {
  createEnergySimBackend,
  createHttpBackend,
  createWasmBackend,
  presentGrid,
  presentHydro,
  presentSnapshot,
} from "./energySimBackend.js";

export { getEnergySimBackend, resetEnergySimBackendCache } from "./loadBackend.js";
export { hostStateToHydroInputs, hydroPathOpen } from "./hostHydroInputs.js";
export { telemetryFromSnapshot } from "./telemetryFromSnapshot.js";
export {
  captureOpsCheckpoint,
  disposeOpsSession,
  getLastOpsSnapshot,
  getLastOpsTelemetry,
  hasOpsSession,
  resetOpsSessionState,
  syncOpsSession,
  tickOpsSession,
} from "./stationOps.js";

// Legacy HTTP helpers (compat)
export {
  createEnergySimClient,
  defaultBaseUrl,
  isEnergySimEnabled,
} from "./client.js";
