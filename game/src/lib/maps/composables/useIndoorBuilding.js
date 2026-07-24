import { reactive } from "vue";
import { createIndoorPlayer } from "./indoor/useIndoorPlayer.js";
import { createIndoorDoors } from "./indoor/useIndoorDoors.js";
import { createIndoorMovement } from "./indoor/useIndoorMovement.js";
import { createIndoorFacility } from "./indoor/useIndoorFacility.js";
import { createIndoorActions } from "./indoor/useIndoorActions.js";

export function useIndoorBuilding(buildingData, outdoor, ctx) {
  const { place, builderView, gameState } = ctx;

  const player = createIndoorPlayer(buildingData, builderView, {
    flags: gameState?.flags,
    character: gameState?.character,
  });

  const movement = createIndoorMovement({
    building: player.building,
    indoor: player.indoor,
    indoorVisibility: player.indoorVisibility,
    currentExteriorNode: player.currentExteriorNode,
    discoverIndoorRoom: player.discoverIndoorRoom,
    exitTravelHint: player.exitTravelHint,
    place,
    outdoor,
    builderView,
    gameState,
  });

  const doors = createIndoorDoors({
    building: player.building,
    indoor: player.indoor,
    indoorVisibility: player.indoorVisibility,
    builderView,
    playerRoomId: player.playerRoomId,
    currentExteriorNode: player.currentExteriorNode,
    reachableRooms: movement.reachableRooms,
    bargeMoves: movement.bargeMoves,
    moveToRoom: movement.moveToRoom,
    exitTravelHint: player.exitTravelHint,
    character: gameState?.character,
  });

  const facility = createIndoorFacility({
    building: player.building,
    indoor: player.indoor,
    syncDoorState: doors.syncDoorState,
    gameState,
  });

  const actions = createIndoorActions({
    building: player.building,
    indoor: player.indoor,
    setHydroOnline: facility.setHydroOnline,
    builderView,
    flagsAreShared: player.flagsAreShared,
    character: gameState?.character,
    gameState,
  });

  const resetIndoor = () => {
    player.resetIndoor();
    player.indoor.completedActions = new Set();
  };

  return reactive({
    buildingData,
    character: gameState?.character,
    gameState: gameState ?? null,
    ...player,
    ...movement,
    ...doors,
    ...facility,
    ...actions,
    resetIndoor,
  });
}
