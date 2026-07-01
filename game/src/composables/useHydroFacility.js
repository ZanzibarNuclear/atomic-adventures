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
