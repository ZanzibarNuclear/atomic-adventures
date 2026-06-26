import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { useOutdoorWorldBuilderDocument } from "./useOutdoorWorldBuilderDocument.js";

function makeOutdoor() {
  return reactive({
    editableHexes: [],
    editableFeatures: [],
    editableRoutes: [],
    syncFromMapData(world) {
      this.editableHexes = world.hexes ?? [];
      this.editableFeatures = world.features ?? [];
      this.editableRoutes = world.routes ?? [];
    },
  });
}

describe("useOutdoorWorldBuilderDocument", () => {
  it("applies loaded world content and selects the start hex when nothing is selected", () => {
    const selectInitial = vi.fn();
    const document = useOutdoorWorldBuilderDocument({
      outdoor: makeOutdoor(),
      hasSelection: () => false,
      selectInitial,
    });

    document.applyLoaded({
      version: 4,
      world: {
        orientation: "pointy",
        size: 44,
        start: "camp",
        journey: ["camp"],
        hexes: [{ id: "camp", q: 0, r: 0 }],
        features: [],
        routes: [],
      },
      warnings: [],
    });

    expect(document.currentWorld.value.start).toBe("camp");
    expect(document.dirty.value).toBe(false);
    expect(selectInitial).toHaveBeenCalledWith("camp");
  });

  it("tracks dirty state and restores the loaded snapshot on discard", () => {
    const outdoor = makeOutdoor();
    const document = useOutdoorWorldBuilderDocument({
      outdoor,
      hasSelection: () => true,
    });

    document.applyLoaded({
      version: 1,
      world: {
        orientation: "pointy",
        size: 44,
        start: "camp",
        journey: ["camp"],
        hexes: [{ id: "camp", q: 0, r: 0, label: "Camp" }],
        features: [],
        routes: [],
      },
      warnings: [],
    });
    outdoor.editableHexes[0].label = "Changed Camp";

    expect(document.dirty.value).toBe(true);

    document.discardWorld();

    expect(document.currentWorld.value.hexes[0].label).toBe("Camp");
    expect(document.dirty.value).toBe(false);
  });
});
