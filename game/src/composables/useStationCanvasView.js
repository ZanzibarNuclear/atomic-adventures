import { ref } from "vue";

export function useStationCanvasView() {
  const viewportMode = ref("fit-all");

  return {
    viewportMode,
  };
}
