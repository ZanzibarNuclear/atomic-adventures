import { reactive } from "vue";
import { createIndoorPlayer } from "./indoor/useIndoorPlayer.js";
import { createIndoorDoors } from "./indoor/useIndoorDoors.js";
import { createIndoorMovement } from "./indoor/useIndoorMovement.js";
import { createIndoorFacility } from "./indoor/useIndoorFacility.js";

export function useIndoorBuilding(buildingData, outdoor, ctx) {
  const { place, builderView } = ctx;

  const player = createIndoorPlayer(buildingData, builderView);

  const openDoorRef = { fn: () => {} };

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
    tryOpenDoor: (doorId) => openDoorRef.fn(doorId),
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
  });

  openDoorRef.fn = doors.tryOpenDoor;

  const facility = createIndoorFacility({
    building: player.building,
    indoor: player.indoor,
    syncDoorState: doors.syncDoorState,
  });

  return reactive({
    buildingData,
    ...player,
    ...movement,
    ...doors,
    ...facility,
  });
}
