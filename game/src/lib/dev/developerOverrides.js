export const HYDRO_POWER_FLAG = "hub.hydro_online";
export const HYDRO_LEVEL_COMPLETE_FLAG = "hydro.level-1-complete";

export function isStationPowerOverriddenOn(gameState, indoor) {
  return Boolean(
    indoor?.indoor?.facility?.hydroOnline ||
    gameState?.flags?.has?.(HYDRO_POWER_FLAG),
  );
}

export function setStationPowerOverride({ gameState, indoor }, on) {
  if (!gameState?.flags || !indoor?.indoor?.facility) {
    return { ok: false, error: "Game state is not ready." };
  }
  if (on) {
    gameState.flags.add(HYDRO_POWER_FLAG);
    gameState.flags.add(HYDRO_LEVEL_COMPLETE_FLAG);
  } else {
    gameState.flags.delete(HYDRO_POWER_FLAG);
    gameState.flags.delete(HYDRO_LEVEL_COMPLETE_FLAG);
  }
  indoor.setHydroOnline?.(on);
  indoor.indoor.facility.hydroOnline = on;
  return { ok: true };
}
