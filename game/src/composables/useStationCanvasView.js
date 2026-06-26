import { ref } from "vue";
import { buildInitialDoorState, setAllDoorsOpen } from "../lib/maps/composables/useDoors.js";

export function useStationCanvasView({ building, doorStates }) {
  const viewportMode = ref("fit-all");
  const exteriorFog = ref(false);

  function setDoorPreview(open) {
    const next = buildInitialDoorState(building.value.areaId, building.value);
    setAllDoorsOpen(next, building.value.areaId, building.value, open);
    doorStates.value = next;
  }

  return {
    viewportMode,
    exteriorFog,
    setDoorPreview,
  };
}
