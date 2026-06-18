import { computed } from "vue";
import {
  applyEnablerAutoUnlock,
  relockEnablerDoor,
} from "../useDoors.js";

export function createIndoorFacility({ building, indoor, syncDoorState }) {
  const roomSwitches = computed(() => {
    const roomId = indoor.currentRoom;
    if (!roomId) return [];
    return (building.value.switches ?? []).filter((s) => s.room === roomId);
  });

  function toggleManualRelease(doorId) {
    const sw = (building.value.switches ?? []).find((s) => s.door === doorId);
    if (!sw || sw.room !== indoor.currentRoom) return;
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
    applyEnablerAutoUnlock(
      indoor.doorState,
      building.value,
      building.value.areaId,
      indoor.facility,
    );
    syncDoorState();
  }

  return {
    roomSwitches,
    toggleManualRelease,
    setHydroOnline,
  };
}
