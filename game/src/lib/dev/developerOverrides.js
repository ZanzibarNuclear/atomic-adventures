import {
  ensureHydroFacilityState,
  refreshEngineFromHost,
  setHydroFacilityState,
} from "../../composables/useHydroFacility.js";

export const HYDRO_POWER_FLAG = "hub.hydro_online";
export const HYDRO_LEVEL_COMPLETE_FLAG = "hydro.level-1-complete";
export const HYDRO_DISCOVERED_FLAG = "hydro.discovered";

/** Flags set when the station is brought online through field startup / dev override. */
export const STATION_POWER_FLAGS = Object.freeze([
  HYDRO_POWER_FLAG,
  HYDRO_LEVEL_COMPLETE_FLAG,
  HYDRO_DISCOVERED_FLAG,
]);

export function isStationPowerOverriddenOn(gameState, indoor) {
  return Boolean(
    indoor?.indoor?.facility?.hydroOnline ||
    gameState?.flags?.has?.(HYDRO_POWER_FLAG) ||
    gameState?.facilities?.hydro?.online,
  );
}

/**
 * Dev toggle: fully engage or disengage hydro as if startup completed.
 * Sets facility hydro state (intake, valves, online) + story flags, and
 * syncs the energy-sims session when available.
 */
export function setStationPowerOverride({ gameState, indoor }, on) {
  if (!gameState?.flags || !indoor?.indoor?.facility) {
    return { ok: false, error: "Game state is not ready." };
  }

  if (on) {
    for (const flag of STATION_POWER_FLAGS) {
      gameState.flags.add(flag);
    }
    ensureHydroFacilityState(gameState);
    setHydroFacilityState(
      gameState,
      {
        online: true,
        startupComplete: true,
        intakeClear: true,
        intakeOpen: true,
        manualValves: {
          upstreamOpen: true,
          powerhouseOpen: true,
        },
        debrisFraction: 0,
        leakageFraction: 0,
      },
      {
        elapsedMinutes: Number(gameState.clock?.elapsedMinutes) || 0,
        type: "state-transition",
        source: "developer",
        actor: "developer",
        label: "Developer: station power on (full hydro startup)",
        payload: { online: true, developerOverride: true },
      },
    );
  } else {
    for (const flag of STATION_POWER_FLAGS) {
      gameState.flags.delete(flag);
    }
    ensureHydroFacilityState(gameState);
    setHydroFacilityState(
      gameState,
      {
        online: false,
        startupComplete: false,
        intakeClear: false,
        intakeOpen: false,
        manualValves: {
          upstreamOpen: false,
          powerhouseOpen: false,
        },
        debrisFraction: 0.65,
        leakageFraction: 0,
        engineCheckpoint: null,
      },
      {
        elapsedMinutes: Number(gameState.clock?.elapsedMinutes) || 0,
        type: "state-transition",
        source: "developer",
        actor: "developer",
        label: "Developer: station power off (reset hydro startup)",
        payload: { online: false, developerOverride: true },
      },
    );
  }

  indoor.setHydroOnline?.(on);
  indoor.indoor.facility.hydroOnline = on;

  // Keep engine telemetry in line with the forced facility state
  void refreshEngineFromHost(gameState, {
    durationSecs: on ? 30 : 5,
    forceRecreate: !on,
  });

  return { ok: true };
}
