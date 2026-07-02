import { computed } from "vue";
import {
  appendHydroEvent,
  createHydroEvent,
  createHydroState,
  generateHydroTelemetry,
  normalizeHydroState,
  withHydroStatePatch,
} from "../lib/simulations/hydro/index.js";

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
  if (!gameState || !hydroActionPatches[actionId]) return { ok: false };
  const patch = hydroActionPatches[actionId];
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
  return { ok: true, state: next };
}

export function useHydroFacility(gameState, stationContext = null) {
  ensureHydroFacilityState(gameState);

  const hydroState = computed(() => ensureHydroFacilityState(gameState));
  const telemetry = computed(() => generateHydroTelemetry(hydroState.value));

  function syncStationPower() {
    const online = hydroState.value.online === true;
    if (stationContext?.indoor?.facility) {
      stationContext.indoor.facility.hydroOnline = online;
    }
  }

  function setOnline(on, options = {}) {
    const next = setHydroFacilityOnline(gameState, on, options);
    syncStationPower();
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
    return next;
  }

  function readTelemetry(options = {}) {
    return generateHydroTelemetry(hydroState.value, options);
  }

  return {
    hydroState,
    telemetry,
    setOnline,
    updateFieldState,
    readTelemetry,
    syncStationPower,
  };
}

function elapsedMinutesFor(gameState, options = {}) {
  const explicit = Number(options.elapsedMinutes);
  if (Number.isFinite(explicit)) return explicit;
  const fromClock = Number(gameState?.clock?.elapsedMinutes);
  return Number.isFinite(fromClock) ? fromClock : 0;
}

const hydroActionPatches = Object.freeze({
  "clear-intake-debris": {
    type: "facility-change",
    label: "Intake cleared and opened",
    state: {
      intakeClear: true,
      intakeOpen: true,
      debrisFraction: 0,
    },
  },
  "align-pipeflow": {
    type: "facility-change",
    label: "Upstream manual valve opened",
    state: {
      manualValves: {
        upstreamOpen: true,
      },
    },
  },
  "open-turbine-valve": {
    type: "facility-change",
    label: "Powerhouse manual valve opened",
    state: {
      manualValves: {
        powerhouseOpen: true,
      },
    },
  },
  "connect-power": {
    type: "state-transition",
    label: "Hydro generator startup completed",
    stateFor: (elapsedMinutes) => ({
      startupComplete: true,
      online: true,
      lastCheckpointElapsedMinutes: elapsedMinutes,
    }),
  },
});
