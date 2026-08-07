import { computed, ref } from "vue";
import {
  appendHydroEvent,
  createHydroEvent,
  createHydroState,
  normalizeHydroState,
  withHydroStatePatch,
} from "../lib/simulations/hydro/index.js";
import { hydroStartupActionPatch } from "../lib/simulations/hydro/startupActions.js";
import {
  captureOpsCheckpoint,
  getLastOpsTelemetry,
  syncOpsSession,
  tickOpsSession,
  unavailableEngineTelemetry,
} from "../lib/simulations/energySim/index.js";

/** Last engine-backed telemetry for reactive consumers (console). */
const engineTelemetryRef = ref(null);

export function ensureHydroFacilityState(gameState) {
  if (!gameState.facilities || typeof gameState.facilities !== "object") {
    gameState.facilities = {};
  }
  gameState.facilities.hydro = normalizeHydroState(
    gameState.facilities.hydro ?? createHydroState(),
  );
  return gameState.facilities.hydro;
}

export function setHydroFacilityState(gameState, patch, eventOptions = null) {
  const current = ensureHydroFacilityState(gameState);
  const next = withHydroStatePatch(current, patch);
  if (eventOptions) {
    next.eventLog = appendHydroEvent(next, createHydroEvent(eventOptions));
  }
  gameState.facilities.hydro = next;
  return next;
}

export function setHydroFacilityOnline(gameState, on, eventOptions = {}) {
  const current = ensureHydroFacilityState(gameState);
  if (current.online === on && (!on || current.startupComplete)) {
    return current;
  }
  return setHydroFacilityState(
    gameState,
    {
      online: on,
      startupComplete: on ? true : ensureHydroFacilityState(gameState).startupComplete,
      lastCheckpointElapsedMinutes: elapsedMinutesFor(gameState, eventOptions),
    },
    {
      elapsedMinutes: elapsedMinutesFor(gameState, eventOptions),
      type: "state-transition",
      source: eventOptions.source ?? "host",
      actor: eventOptions.actor ?? "system",
      label: on ? "Hydro generator online" : "Hydro generator offline",
      payload: { online: on },
      eventId: eventOptions.eventId,
    },
  );
}

export function applyHydroStartupAction(gameState, actionId, options = {}) {
  const patch = hydroStartupActionPatch(actionId);
  if (!gameState || !patch) return { ok: false };
  const elapsedMinutes = elapsedMinutesFor(gameState, options);
  const statePatch = patch.stateFor
    ? patch.stateFor(elapsedMinutes)
    : patch.state;
  const next = setHydroFacilityState(
    gameState,
    statePatch,
    {
      elapsedMinutes,
      type: patch.type,
      source: options.source ?? "field-action",
      actor: options.actor ?? "player",
      label: patch.label,
      payload: {
        actionId,
        patch: statePatch,
      },
      eventId: options.eventId,
    },
  );
  // Fire-and-forget engine sync (console / next read will await)
  void refreshEngineFromHost(gameState, {
    durationSecs: actionId === "connect-power" ? 30 : 5,
  });
  return { ok: true, state: next };
}

/**
 * Push host hydro state into Clearwater Station WASM/HTTP session.
 * Updates engineTelemetryRef. On failure, surfaces engine-unavailable — no
 * alternate plant model.
 */
export async function refreshEngineFromHost(gameState, options = {}) {
  const hydro = ensureHydroFacilityState(gameState);
  try {
    const result = await syncOpsSession(hydro, {
      durationSecs: options.durationSecs,
      forceRecreate: options.forceRecreate,
      loads: options.loads,
    });
    if (result.ok && result.telemetry) {
      engineTelemetryRef.value = result.telemetry;
      return result.telemetry;
    }
    const unavailable = unavailableEngineTelemetry(hydro, result.reason ?? "no-backend");
    engineTelemetryRef.value = unavailable;
    console.error("[hydro] energy-sims sync failed:", result.reason ?? "no-telemetry");
    return unavailable;
  } catch (err) {
    console.error("[hydro] energy-sims sync failed", err);
    const unavailable = unavailableEngineTelemetry(hydro, err?.message ?? "sync-error");
    engineTelemetryRef.value = unavailable;
    return unavailable;
  }
}

/**
 * Persist engine checkpoint onto facilities.hydro for save/load.
 */
export async function persistHydroEngineCheckpoint(gameState) {
  const hydro = ensureHydroFacilityState(gameState);
  const checkpoint = await captureOpsCheckpoint();
  if (checkpoint) {
    gameState.facilities.hydro = withHydroStatePatch(hydro, {
      engineCheckpoint: checkpoint,
    });
  }
  return gameState.facilities.hydro;
}

export function useHydroFacility(gameState, stationContext = null) {
  ensureHydroFacilityState(gameState);

  const hydroState = computed(() => ensureHydroFacilityState(gameState));
  const telemetry = computed(() => resolveEngineTelemetry(hydroState.value));

  function syncStationPower() {
    const online = hydroState.value.online === true;
    if (stationContext?.indoor?.facility) {
      stationContext.indoor.facility.hydroOnline = online;
    }
  }

  function setOnline(on, options = {}) {
    const next = setHydroFacilityOnline(gameState, on, options);
    syncStationPower();
    void refreshEngineFromHost(gameState, {
      durationSecs: on ? 30 : 5,
    });
    return next;
  }

  function updateFieldState(patch, options = {}) {
    const next = setHydroFacilityState(gameState, patch, {
      elapsedMinutes: elapsedMinutesFor(gameState, options),
      type: options.type ?? "facility-change",
      source: options.source ?? "host",
      actor: options.actor ?? "player",
      label: options.label ?? "Hydro facility state changed",
      payload: { patch },
      eventId: options.eventId,
    });
    syncStationPower();
    void refreshEngineFromHost(gameState, { durationSecs: 5 });
    return next;
  }

  function readTelemetry() {
    return resolveEngineTelemetry(hydroState.value);
  }

  async function readTelemetryAsync(options = {}) {
    return refreshEngineFromHost(gameState, options);
  }

  async function tickEngine(dtSecs = 1) {
    try {
      const result = await tickOpsSession(hydroState.value, dtSecs);
      if (result.ok && result.telemetry) {
        engineTelemetryRef.value = result.telemetry;
        return result.telemetry;
      }
      const unavailable = unavailableEngineTelemetry(
        hydroState.value,
        result.reason ?? "tick-failed",
      );
      engineTelemetryRef.value = unavailable;
      console.error("[hydro] energy-sims tick failed:", result.reason ?? "no-telemetry");
      return unavailable;
    } catch (err) {
      console.error("[hydro] energy-sims tick failed", err);
      const unavailable = unavailableEngineTelemetry(
        hydroState.value,
        err?.message ?? "tick-error",
      );
      engineTelemetryRef.value = unavailable;
      return unavailable;
    }
  }

  return {
    hydroState,
    telemetry,
    setOnline,
    updateFieldState,
    readTelemetry,
    readTelemetryAsync,
    tickEngine,
    refreshEngine: (options) => refreshEngineFromHost(gameState, options),
    persistEngineCheckpoint: () => persistHydroEngineCheckpoint(gameState),
    syncStationPower,
  };
}

function resolveEngineTelemetry(hostState) {
  if (engineTelemetryRef.value) return engineTelemetryRef.value;
  const cached = getLastOpsTelemetry();
  if (cached) return cached;
  return unavailableEngineTelemetry(hostState, "not-synced");
}

function elapsedMinutesFor(gameState, options = {}) {
  const explicit = Number(options.elapsedMinutes);
  if (Number.isFinite(explicit)) return explicit;
  const fromClock = Number(gameState?.clock?.elapsedMinutes);
  return Number.isFinite(fromClock) ? fromClock : 0;
}
