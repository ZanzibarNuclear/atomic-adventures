import { computed, ref } from "vue";
import {
  appendHydroEvent,
  buildHydroGraphData,
  createHydroEvent,
  createHydroState,
  generateHydroTelemetry,
  normalizeHydroState,
  withHydroStatePatch,
} from "../lib/simulations/hydro/index.js";
import { hydroStartupActionPatch } from "../lib/simulations/hydro/startupActions.js";
import {
  captureOpsCheckpoint,
  getLastOpsTelemetry,
  syncOpsSession,
  tickOpsSession,
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
  const beforeTelemetry = currentTelemetry(current);
  const next = withHydroStatePatch(current, patch);
  if (eventOptions) {
    next.eventLog = appendHydroEvent(next, createHydroEvent(eventOptions));
    const afterTelemetry = currentTelemetry(next);
    next.eventLog = appendDiagnosticEvents(next, beforeTelemetry, afterTelemetry, eventOptions);
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
 * Updates engineTelemetryRef on success.
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
  } catch (err) {
    console.warn("[hydro] energy-sims sync failed; using legacy telemetry", err);
  }
  const legacy = generateHydroTelemetry(hydro, options);
  engineTelemetryRef.value = null;
  return legacy;
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
  const telemetry = computed(() => {
    if (engineTelemetryRef.value) return engineTelemetryRef.value;
    const cached = getLastOpsTelemetry();
    if (cached) return cached;
    return generateHydroTelemetry(hydroState.value);
  });

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

  function readTelemetry(options = {}) {
    if (engineTelemetryRef.value) return engineTelemetryRef.value;
    const cached = getLastOpsTelemetry();
    if (cached) return cached;
    return generateHydroTelemetry(hydroState.value, options);
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
    } catch (err) {
      console.warn("[hydro] energy-sims tick failed", err);
    }
    return readTelemetry();
  }

  function readGraphData(options = {}) {
    return buildHydroGraphData(hydroState.value, {
      toElapsedMinutes: elapsedMinutesFor(gameState, options),
      ...options,
    });
  }

  return {
    hydroState,
    telemetry,
    setOnline,
    updateFieldState,
    readGraphData,
    readTelemetry,
    readTelemetryAsync,
    tickEngine,
    refreshEngine: (options) => refreshEngineFromHost(gameState, options),
    persistEngineCheckpoint: () => persistHydroEngineCheckpoint(gameState),
    syncStationPower,
  };
}

function currentTelemetry(state) {
  if (engineTelemetryRef.value) return engineTelemetryRef.value;
  const cached = getLastOpsTelemetry();
  if (cached) return cached;
  return generateHydroTelemetry(state);
}

function elapsedMinutesFor(gameState, options = {}) {
  const explicit = Number(options.elapsedMinutes);
  if (Number.isFinite(explicit)) return explicit;
  const fromClock = Number(gameState?.clock?.elapsedMinutes);
  return Number.isFinite(fromClock) ? fromClock : 0;
}

function appendDiagnosticEvents(state, beforeTelemetry, afterTelemetry, eventOptions) {
  const beforeWarnings = new Set(beforeTelemetry.warnings ?? []);
  const beforeFaults = new Set(beforeTelemetry.faults ?? []);
  let eventLog = state.eventLog;
  for (const warning of afterTelemetry.warnings ?? []) {
    if (beforeWarnings.has(warning)) continue;
    eventLog = appendHydroEvent({ eventLog }, createHydroEvent({
      elapsedMinutes: eventOptions.elapsedMinutes,
      type: "warning-raised",
      source: "simulator",
      actor: "system",
      label: `Hydro warning: ${warning}`,
      payload: { diagnosticId: warning },
      eventId: `${eventOptions.eventId ?? `hydro-event-${eventOptions.elapsedMinutes}`}-warning-${warning}`,
    }));
  }
  for (const fault of afterTelemetry.faults ?? []) {
    if (beforeFaults.has(fault)) continue;
    eventLog = appendHydroEvent({ eventLog }, createHydroEvent({
      elapsedMinutes: eventOptions.elapsedMinutes,
      type: "fault-triggered",
      source: "simulator",
      actor: "system",
      label: `Hydro fault: ${fault}`,
      payload: { diagnosticId: fault },
      eventId: `${eventOptions.eventId ?? `hydro-event-${eventOptions.elapsedMinutes}`}-fault-${fault}`,
    }));
  }
  return eventLog;
}
