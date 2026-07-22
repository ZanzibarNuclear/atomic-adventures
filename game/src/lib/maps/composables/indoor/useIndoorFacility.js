import { computed } from "vue";
import { doorThresholdForRoom } from "../useGrid.js";
import {
  applyEnablerAutoUnlock,
  relockEnablerDoor,
} from "../useDoors.js";
import { setHydroFacilityOnline } from "../../../../composables/useHydroFacility.js";
import {
  isRoomLightSwitchClosed,
  isRoomLightsOn,
  lightFixtureForRoom,
  setRoomLightSwitch,
} from "./roomLights.js";

export function createIndoorFacility({ building, indoor, syncDoorState, gameState = null }) {
  const roomSwitches = computed(() => {
    const roomId = indoor.currentRoom;
    if (!roomId) return [];
    return (building.value.switches ?? []).filter((s) =>
      s.room === roomId && isAtSwitchStand(s)
    );
  });

  const stationPowerOnline = computed(() =>
    Boolean(
      indoor.facility?.hydroOnline
        || (typeof indoor.flags?.has === "function" && indoor.flags.has("hub.hydro_online")),
    ),
  );

  function isAtSwitchStand(sw) {
    const threshold = doorThresholdForRoom(building.value, sw.room, sw.door);
    return !!threshold && indoor.currentStand === threshold.id;
  }

  function toggleManualRelease(doorId) {
    const sw = (building.value.switches ?? []).find((s) => s.door === doorId);
    if (!sw || sw.room !== indoor.currentRoom || !isAtSwitchStand(sw)) return;
    const next = { ...indoor.facility.manualMode };
    const engaging = !next[doorId];
    next[doorId] = engaging;
    indoor.facility.manualMode = next;
    if (engaging) {
      applyEnablerAutoUnlock(
        indoor.doorState,
        building.value,
        building.value.areaId,
        indoor.facility,
      );
    } else {
      relockEnablerDoor(
        indoor.doorState,
        building.value,
        building.value.areaId,
        doorId,
      );
    }
    syncDoorState();
  }

  function setHydroOnline(on) {
    indoor.facility.hydroOnline = on;
    if (gameState) {
      setHydroFacilityOnline(gameState, on, {
        source: "facility",
        actor: "system",
      });
    }
    applyEnablerAutoUnlock(
      indoor.doorState,
      building.value,
      building.value.areaId,
      indoor.facility,
    );
    syncDoorState();
  }

  /**
   * Room light wall switch. Available from anywhere in the room (no stand
   * requirement). `closed` true = switch closed = lights on when powered.
   */
  function setRoomLights(roomId, closed) {
    const id = roomId || indoor.currentRoom;
    if (!id || !lightFixtureForRoom(building.value, id)) {
      return { ok: false, error: "This room has no light switch." };
    }
    if (!indoor.facility.lightSwitches) indoor.facility.lightSwitches = {};
    setRoomLightSwitch(indoor.facility, id, Boolean(closed));
    return {
      ok: true,
      closed: isRoomLightSwitchClosed(indoor.facility, id),
      lit: isRoomLightsOn(indoor.facility, id, stationPowerOnline.value),
    };
  }

  function toggleRoomLights(roomId) {
    const id = roomId || indoor.currentRoom;
    const closed = isRoomLightSwitchClosed(indoor.facility, id);
    return setRoomLights(id, !closed);
  }

  return {
    roomSwitches,
    stationPowerOnline,
    toggleManualRelease,
    setHydroOnline,
    setRoomLights,
    toggleRoomLights,
  };
}
