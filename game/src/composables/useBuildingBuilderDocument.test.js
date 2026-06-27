import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useBuildingBuilderDocument } from "./useBuildingBuilderDocument.js";

const emptyBuilding = {
  id: "utility-station",
  label: "Utility Station",
  levels: [],
  rooms: [],
  doors: [],
  links: [],
  fixtures: [],
  exterior: { level: "yard", nodes: [], paths: [] },
};

describe("useBuildingBuilderDocument", () => {
  it("tracks dirty state and resets route-owned state when discarding", () => {
    const reset = vi.fn();
    const document = useBuildingBuilderDocument({
      emptyBuilding,
      buildDoorState: (building) => ({ area: building.id }),
      onDocumentReset: reset,
    });

    document.applyLoaded({
      version: 3,
      building: { ...emptyBuilding, label: "Loaded station" },
      warnings: [],
    });
    document.draft.value.label = "Changed station";

    expect(document.dirty.value).toBe(true);

    document.discardDraft();

    expect(document.draft.value.label).toBe("Loaded station");
    expect(document.dirty.value).toBe(false);
    expect(document.doorStates.value).toEqual({ area: "utility-station" });
    expect(reset).toHaveBeenLastCalledWith(expect.objectContaining({ label: "Loaded station" }));
  });

  it("moves the active level to a loaded building level when needed", () => {
    const level = ref("missing");
    const document = useBuildingBuilderDocument({ emptyBuilding, level });

    document.applyLoaded({
      version: 1,
      building: {
        ...emptyBuilding,
        exterior: { level: "yard", nodes: [], paths: [] },
        levels: [{ id: "inside" }],
      },
      warnings: [],
    });

    expect(level.value).toBe("yard");
  });

  it("tracks dirty state when visual wall points are replaced", () => {
    const document = useBuildingBuilderDocument({ emptyBuilding });

    document.applyLoaded({
      version: 1,
      building: {
        ...emptyBuilding,
        cliffWall: {
          onLevels: ["yard"],
          points: [
            { x: 7.26, y: 0.1 },
            { x: 4.4, y: 0.1 },
          ],
        },
      },
      warnings: [],
    });

    document.draft.value.cliffWall.points[1] = { x: 4.2, y: 0.3 };

    expect(document.dirty.value).toBe(true);
  });
});
