import { HYDRO_BASELINE_CONFIG_ID } from "./config.js";

export function createHydroState(overrides = {}) {
  return normalizeHydroState({
    activeConfigId: HYDRO_BASELINE_CONFIG_ID,
    online: false,
    intakeClear: false,
    intakeOpen: false,
    manualValves: {
      upstreamOpen: false,
      powerhouseOpen: false,
    },
    startupComplete: false,
    lastCheckpointElapsedMinutes: 0,
    eventLog: [],
    debrisFraction: 0.65,
    leakageFraction: 0,
    ...overrides,
  });
}

export function normalizeHydroState(state = {}) {
  return {
    activeConfigId: String(state.activeConfigId || HYDRO_BASELINE_CONFIG_ID),
    online: Boolean(state.online),
    intakeClear: Boolean(state.intakeClear),
    intakeOpen: Boolean(state.intakeOpen),
    manualValves: {
      upstreamOpen: Boolean(state.manualValves?.upstreamOpen),
      powerhouseOpen: Boolean(state.manualValves?.powerhouseOpen),
    },
    startupComplete: Boolean(state.startupComplete),
    lastCheckpointElapsedMinutes: finite(state.lastCheckpointElapsedMinutes),
    eventLog: Array.isArray(state.eventLog) ? [...state.eventLog] : [],
    debrisFraction: clamp01(state.debrisFraction),
    leakageFraction: clamp01(state.leakageFraction),
    // Opaque energy-sims checkpoint blob (JSON-serializable); optional
    engineCheckpoint: state.engineCheckpoint ?? null,
  };
}

export function withHydroStatePatch(state, patch = {}) {
  const current = normalizeHydroState(state);
  return normalizeHydroState({
    ...current,
    ...patch,
    manualValves: {
      ...current.manualValves,
      ...patch.manualValves,
    },
    eventLog: patch.eventLog ?? current.eventLog,
    engineCheckpoint:
      patch.engineCheckpoint !== undefined
        ? patch.engineCheckpoint
        : current.engineCheckpoint,
  });
}

export function fieldReadyForHydroStartup(state) {
  const normalized = normalizeHydroState(state);
  return normalized.intakeClear &&
    normalized.intakeOpen &&
    normalized.manualValves.upstreamOpen &&
    normalized.manualValves.powerhouseOpen &&
    normalized.startupComplete;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finite(value)));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
