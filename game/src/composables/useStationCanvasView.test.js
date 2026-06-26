import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import { useStationCanvasView } from "./useStationCanvasView.js";

describe("useStationCanvasView", () => {
  it("owns viewport state and applies door preview state", () => {
    const draft = ref({
      id: "utility-station",
      rooms: [{ id: "control", x: 0, y: 0, w: 1, h: 1 }],
      doors: [{
        id: "door-a",
        kind: "man",
        at: { x: 1, y: 0 },
        initial: { closed: true, locked: false },
      }],
      links: [],
      fixtures: [],
      exterior: { nodes: [], paths: [] },
    });
    const building = computed(() => buildBuilding(draft.value));
    const doorStates = ref(buildInitialDoorState(draft.value.id, building.value));
    const view = useStationCanvasView({ building, doorStates });

    expect(view.viewportMode.value).toBe("fit-all");
    expect(view.exteriorFog.value).toBe(false);

    view.setDoorPreview(true);

    expect(doorStates.value["utility-station:door-a"].open).toBe(true);
  });
});
